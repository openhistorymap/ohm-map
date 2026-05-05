# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

`ohm-map` is the public-facing Angular 21 map viewer for OpenHistoryMap. It is one sub-project of the OHM ecosystem — see `/srv/ohm/CLAUDE.md` for the wider service graph and shared infra.

## Stack

- **Angular 21** (NgModule API, not standalone). TypeScript 5.8, RxJS 7.8, zone.js 0.15.
- **MapLibre GL 5.x**, bundled (no CDN). MapLibre is API-compatible with Mapbox v1, which is what this code originally targeted.
- **`@ngx-matomo/tracker` v7+** for Matomo analytics.
- **`@angular/build:application`** builder (esbuild-based). Karma is still the test runner.
- Node 20.19+ / 22.12+ / 24+ required by Angular 21.

## Commands

**All builds run in Docker.** The host is not expected to have a compatible Node toolchain.

- One-off install / build:
  ```
  docker run --rm -v $(pwd):/app -w /app node:22 npm install
  docker run --rm -v $(pwd):/app -w /app node:22 npx ng build
  ```
- Dev server (port 4200):
  ```
  docker run --rm -it -v $(pwd):/app -w /app -p 4200:4200 node:22 npx ng serve --host 0.0.0.0
  ```
- Image build (multi-stage, the production path): `docker build -t ohm-map .`. The build stage uses `node:22`; the runtime stage is `nginx:alpine`. The application builder writes to `dist/<projectName>/browser/` — the Dockerfile copies from `dist/out/browser/` after passing `--output-path=./dist/out`.
- Single test file: `docker run --rm -v $(pwd):/app -w /app node:22 npx ng test --include='**/decimaldate.spec.ts'`. Note that Karma needs a Chrome — locally you'll want a headless-Chrome container, not bare `node:22`.

## Deploy targets

Two deployment paths are supported:

1. **GitHub Pages** (primary). `.github/workflows/deploy.yml` runs on push to `master`, builds with `ng build --configuration production --base-href "${BASE_HREF:-/}"`, generates a `404.html` SPA fallback (copy of `index.html`) and a Netlify-style `_redirects` file, then publishes via `actions/deploy-pages@v4`. Set the `BASE_HREF` repo variable to `/ohm-map/` for project-page hosting; leave it `/` for a custom CNAME.
2. **Netlify**. `netlify.toml` declares the build command, publish directory (`dist/ohm-map/browser`), `NODE_VERSION = 22`, and the `/* → /index.html 200` SPA redirect. Connecting the repo on netlify.com is enough — no extra config.

The `Dockerfile` + `docker-entrypoint.sh` + `nginx.conf` still work for self-hosted nginx deployments, but are no longer the canonical CI path.

## Runtime config injection

There are two distinct strategies depending on host:

**Docker / nginx host** — `docker-entrypoint.sh` runs `jq -n env > ./assets/env.json` on every container start, writing the **process environment** into `/usr/share/nginx/html/assets/env.json`. Truly runtime: rebuild not required to swap targets.

**Static host (GitHub Pages, Netlify)** — `assets/env.json` must be **baked at build time**. The GH workflow inspects the `TILESERVER` repository variable and, if set, writes it into `src/assets/env.json` before `ng build`. For Netlify, add a prebuild step or commit the desired `src/assets/env.json` directly.

Either way, at app boot the `APP_INITIALIZER` calls `EnvService.load()` which fetches `assets/env.json` (via `HttpBackend` directly, bypassing interceptors). Components read values via `EnvService.getEnv('TILESERVER')`. `src/assets/env.json` is committed with a default (`http://51.15.160.236:9034/`) so `ng serve` works out of the box.

## Time-as-float convention (unchanged)

The whole map is parameterized by a single float year (`atDate`), matching the OHM tileserver convention (`PERSIST_STEP = 1/12`, `EPHEMERAL_STEP = 1/12/31`):

- Routing: `:year/:z/:y/:x[/:rels]` in `app-routing.module.ts`. Default redirect is `866/4/43.67/1.57` (year 866 CE, Toulouse).
- `DecimaldatePipe` (`src/app/decimaldate.pipe.ts`) decomposes the float into `{y, m, d, H, M, S, ms}` using a fixed `ms = 31` (every month treated as 31 days — leap-year code is commented out by design; keep it that way unless coordinating with the tileserver).
- `MapComponent.toDateFloat` / `toFloatDate` are the inverse pair used to drive the `vis-timeline` ruler.
- Tile URLs returned by MapLibre sources contain a `{atDate}` placeholder; `MapComponent.transformRequest` substitutes the current float year on every tile fetch.
- In dev mode (`isDevMode()`), `transformRequest` rewrites `https://*.tiles.openhistorymap.org` → `this.ts` (the runtime `TILESERVER` env), so prod-style tile URLs still hit the local/dev tileserver. The substitution is intentionally limited to `Tile`-resourceType requests; style and source-metadata fetches are not rewritten.

## Bundled vs CDN

Bundled into the Angular build:

- **maplibre-gl** (and its CSS, registered in `angular.json` styles) — the entire map runtime.

Loaded as web fonts in `src/index.html`:

- **Marcellus SC** + **EB Garamond** from Google Fonts. The whole UI is set in those two families; do not introduce a third without updating the design context.

`vis-timeline` was removed in the chrome+timeline craft pass. The bottom ruler is a custom `OhmTimelineComponent` (`src/app/timeline/`) drawn in SVG — see "Custom timeline" below.

## Map sources and styles

- Style manifest: `StyleSelectorComponent` fetches `https://raw.githubusercontent.com/openhistorymap/mapstyles/master/styles.json`, picks the entry with `default: true`, and emits the full style URL (`styleBase + style`) to `MapComponent.changeStyle`. The styles are Mapbox/MapLibre style-spec JSON.
- `MapComponent.showOverlays()` adds three `circle` layers (`ships`, `planes`, `human`) and an `events` circle layer, all reading from the `ohm-ephemeral` source (`source-layer: 'movement'` / `'event'`) defined in the loaded style.
- `MapComponent.showRels()` parses the optional `rels` URL segment as `id[:color[:width[:opacity]]]` pipe-separated and adds one `line` layer per relation against `http://51.15.160.236:9034/relation/<ids>`.
- `MapComponent.refreshTileSource(id)` calls `(VectorTileSource).setTiles(tiles)` with the source's existing tile URL pattern to invalidate the tile cache after `atDate` changes. This replaces the Mapbox v1 internal `setSourceProperty(() => {})` calls from the original code — verify the cache-bust actually fires when wiring up new vector sources.

## API surface (`src/app/ohm.service.ts`)

- `getEvents(date, bbox, ...)` → `https://api.events.openhistorymap.org/events/timeline.json`. Returns `of([])` if `bbox` is falsy — the map calls it before `bbox` is known, so that early-out is intentional.
- `getStats(...)` → `https://api.stats.openhistorymap.org/stats.json` (same `bbox`-required pattern).
- `su(url, image)` → `https://su.openhistorymap.org/?url=<url>` (POST). Used by `copy_url()` together with `NgxCaptureService` to upload a screenshot and get back a short share link.
- `drilldown(...)` is currently a stub returning `of([])`. The map calls it on click; "what is here" sidenav is wired up but always empty until this is implemented.

## Modules and components map

- `AppModule` declares `MapComponent`, `StyleSelectorComponent`, `OhmTopbarComponent`, `OhmSidenavComponent`, `OhmTimelineComponent`, `DateComponent`, `DecimaldatePipe`, `NicedatePipe`, `ShareDirective`. Providers include `provideHttpClient()`, `provideMatomo({ trackerUrl, siteId }, withRouter())`, and the `APP_INITIALIZER` that runs `EnvService.load()`.
- `SharedModule` is now lean — just `MatDialogModule` and `MatSnackBarModule` (and `CommonModule` / `FormsModule`). All other Material chrome was dropped in the chrome+timeline craft pass; chrome is now hand-built.
- The legacy `@modalnodes/mn-docker` / `mn-configurator` / `mn-registry` packages from the Angular 10 era have been removed. `MnDockerService.getEnv()` was inlined as `EnvService` (`src/app/env.service.ts`).

## Custom timeline (`src/app/timeline/`)

- SVG-based ruler. Independent of vis-timeline, MapLibre, or any third-party timeline lib.
- Tick density is computed from `pxPerYear` and switches between four scales: 1/10-year, 10/100-year, 100/1000-year, and 1000/5000-year. Wheel zooms; drag pans; click sets year; mid-flight `year` input changes animate the cursor with `ease-out-quart` over 320ms.
- Era markers (`assets/eras.json`) are curated cultural pivot points rendered as faint dashed verticals with rotated italic labels. The component falls back to an inline list if the JSON fetch fails. Replace the JSON file (or override the component's `[eraSource]` input) to change the curated set.
- Cursor: brass vertical hairline (1.25px) with diamond caps at top and bottom edges, plus a two-line readout (`anno` in Marcellus SC small caps + plain `<year> CE/BCE` in EB Garamond italic).

## Analytics

`AppModule` calls `provideMatomo({ trackerUrl: '//tracker.openhistorymap.org/', siteId: 2 }, withRouter())`. `withRouter()` auto-tracks route changes from the Angular Router. `MapComponent.changeUrl` uses `Location.go()` (which does **not** trigger the router) and explicitly calls `matomoTracker.trackPageView(path)` — that path is what shows up in Matomo as the tracked URL.

## CI

`.github/workflows/deploy.yml` builds with Node 22 and deploys to GitHub Pages on every push to `master`. There is no test or lint step in CI.

## Gotchas

- The play/stop, speed-menu, person and ephemeral-events buttons that existed in the old Material toolbar were dropped during the chrome+timeline craft pass. Their MapComponent methods (`startstop`, `setSpeed`, `selectDate`, etc.) still exist but are no longer called from any template — re-wire when the feature is ready.
- `MapComponent.start.center` is read from `ar.snapshot.params` as **strings**, not numbers. MapLibre accepts them, but if you do arithmetic on them, `parseFloat` first.
- `tsconfig.json` keeps `strict: false` and `strictTemplates: false` because the original code is too loose for strict mode. Tightening these is a separate task and will require typing the many `any` fields in `MapComponent`.
- `transformRequest` only rewrites `Tile` resource requests in dev mode; the source-spec metadata fetches still go to the prod URL. This matches the original behavior; do not "fix" it without coordinating with the tileserver layout.
- MapLibre lacks Mapbox v1's `setSourceProperty` — `refreshTileSource` uses `VectorTileSource.setTiles(tiles)` instead, substituting `{atDate}` into the original templated pattern (stashed as `_ohmOriginalTiles`) so each year is a distinct cache key. If a refresh stops working after a maplibre upgrade, that's the place to look.

## Design Context

### Users
Primary: the **history enthusiast** — a curious adult who reads pop-history, browses Wikipedia rabbit holes, plays Crusader Kings, watches documentaries. Late-evening sessions on laptop or tablet, often arriving via a shared link. Patient. Will reward depth.

Job to be done: *"Show me what the world looked like in [year] and let me wander."* Discovery, not analytics. The interface should invite drift, not optimize click-paths.

### Brand Personality
Scholarly + archival + considered. Writes like a museum exhibit caption — confident, factual, never breathless. The emotional goal is the calm of a well-lit reading room at 10pm.

### Aesthetic Direction
**Dark — library at night.** Warm-near-black ground, ivory body text, one brass / aged-gold accent for live interaction. No secondary color. No gradients.

Spirit references: 19th-century historical atlas plates; the brass year-dial on an antique astronomical clock; a David Rumsey scan viewed full-screen at night.

Anti-references (must not look like): Angular Material default (admin-app), Web3 / cyberpunk neon, SaaS dashboard chrome (cards, sidenavs, KPI tiles).

### Design Principles

1. **The map is sovereign.** Chrome lives in the margins. No floating panels.
2. **Time is a tactile object.** The timeline ruler is the spine of the experience and gets the most craft — engraved, typeset, weighted cursor, hairline ticks. Not a default vis-timeline.
3. **Quiet contrast.** Warm-near-black ground, ivory text, ONE brass accent reserved for the live cursor / active state — used sparingly so it carries weight.
4. **Editorial, not templated.** Asymmetry where it earns its place. No card grids. Sidenavs feel like inserted plates in an atlas, not nav drawers.
5. **Restraint everywhere except the moment of state change.** When the year advances, the world changes — that transition earns motion. Everything else is still.

### Type / color
Type pairing TBD at craft time. **Banned defaults**: Inter, DM Sans, Fraunces, Crimson, Playfair, Cormorant, IBM Plex *, Space Grotesk, Outfit, Plus Jakarta Sans, Instrument *, Newsreader, Lora, Syne. Look further (Pangram Pangram, Velvetyne, Klim, Adobe Fonts).

OKLCH targets (approximate, to be tuned against the map style):
- Ground: `oklch(0.18 0.012 60)` — warm-near-black, tinted umber.
- Body: `oklch(0.92 0.015 80)` — ivory.
- Brass accent (one only): `oklch(0.74 0.12 75)`.
- Hairlines: `oklch(0.32 0.01 60)`.

Full version of this section lives in `.impeccable.md` at the project root.
