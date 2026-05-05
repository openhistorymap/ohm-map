import {
  AfterViewInit, Component, Input, OnInit, ViewChild, isDevMode
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Clipboard } from '@angular/cdk/clipboard';
import { Observable } from 'rxjs';
import { MatomoTracker } from 'ngx-matomo-client';
import { NgxCaptureService } from 'ngx-capture';
import maplibregl from 'maplibre-gl';

import { OhmService } from './../ohm.service';
import { DateComponent } from './../date/date.component';
import { EnvService } from './../env.service';
import { OhmSidenavComponent } from './../sidenav/sidenav.component';

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.scss'],
  standalone: false
})
export class MapComponent implements OnInit, AfterViewInit {
  map: maplibregl.Map;
  ts: string;
  maptilerKey: string;

  @Input() style: string;

  start: { center: [number, number]; zoom: number } = {
    center: [1.57, 43.67],
    zoom: 3.5
  };

  rels: string;
  atDate: number = 866.001;

  events: Observable<any[]>;
  infoData: any;

  selectedFeatures: any[] = [];
  shareLink = '';

  @ViewChild('aboutBar') aboutBar!: OhmSidenavComponent;
  @ViewChild('hereBar')  hereBar!:  OhmSidenavComponent;
  @ViewChild('shareBar') shareBar!: OhmSidenavComponent;
  @ViewChild('screen', { static: false }) screen: any;

  constructor(
    private env: EnvService,
    private ar: ActivatedRoute,
    private l: Location,
    private md: MatDialog,
    private ohm: OhmService,
    private http: HttpClient,
    private matomoTracker: MatomoTracker,
    private snackBar: MatSnackBar,
    private clipboard: Clipboard,
    private capture: NgxCaptureService
  ) { }

  ngOnInit(): void {
    this.http.get('assets/info.json').subscribe(data => { this.infoData = data; });

    this.ts = this.env.getEnv('TILESERVER');
    this.maptilerKey = this.env.getEnv('MAPTILER_KEY');

    this.ar.params.subscribe(params => {
      this.atDate = parseFloat(params.year);
      this.start.center = [parseFloat(params.x), parseFloat(params.y)];
      this.start.zoom = parseFloat(params.z);
      if (this.map) this.map.panTo(this.start.center);
    });

    this.atDate = parseFloat(this.ar.snapshot.params.year);
    this.start.center = [
      parseFloat(this.ar.snapshot.params.x),
      parseFloat(this.ar.snapshot.params.y)
    ];
    this.start.zoom = parseFloat(this.ar.snapshot.params.z);
    this.rels = this.ar.snapshot.params.rels;
  }

  ngAfterViewInit(): void {
    queueMicrotask(() => this.initMap());
  }

  initMap() {
    if (this.map) return;
    this.map = new maplibregl.Map({
      container: 'ohm_map',
      style: this.style,
      center: this.start.center,
      zoom: this.start.zoom,
      canvasContextAttributes: { preserveDrawingBuffer: true },
      attributionControl: { compact: true },
      transformRequest: (url, resourceType) => {
        let nurl = url;
        if (isDevMode()) {
          nurl = nurl.replace('https://tiles.openhistorymap.org', this.ts);
          nurl = nurl.replace('https://a.tiles.openhistorymap.org', this.ts);
          nurl = nurl.replace('https://b.tiles.openhistorymap.org', this.ts);
          nurl = nurl.replace('https://c.tiles.openhistorymap.org', this.ts);
        }
        if (resourceType === 'Tile' && url.indexOf('openhistory') >= 0) {
          return { url: nurl.replace('{atDate}', this.atDate.toString()) };
        }
        if (this.maptilerKey && url.indexOf('api.maptiler.com') >= 0 && url.indexOf('key=') < 0) {
          return {
            url: nurl + (nurl.indexOf('?') >= 0 ? '&' : '?') + 'key=' + this.maptilerKey
          };
        }
        return undefined;
      }
    });

    this.map.on('load', () => this.showRels());
    this.map.on('load', () => this.showOverlays());
    this.map.on('moveend', () => this.changeUrl());
    this.map.on('mouseenter', () => { this.map.getCanvas().style.cursor = 'pointer'; });
    this.map.on('mouseleave', () => { this.map.getCanvas().style.cursor = ''; });
    this.map.on('click', (e) => {
      this.ohm.drilldown(e.lngLat).subscribe(feats => {
        if (feats.length > 0) {
          this.selectedFeatures = feats;
          this.hereBar?.toggle();
          new maplibregl.Popup().setLngLat(e.lngLat).addTo(this.map);
        }
      });
    });
  }

  changeStyle(style: string): void {
    this.style = style;
    if (!this.map) return;
    try { this.map.setStyle(style); } catch { /* swallow */ }
  }

  onYearChange(year: number) {
    this.atDate = year;
    this.changeUrl(year);
  }

  changeUrl(ev: number | null = null): void {
    if (!this.map) return;
    const c = this.map.getCenter();
    const path = `/${this.atDate}/${this.map.getZoom()}/${c.lat}/${c.lng}` + (this.rels ? '/' + this.rels : '');
    this.l.go(path);
    this.matomoTracker.trackPageView(path);
    if (ev) {
      this.refreshTileSource('ohm');
      this.refreshTileSource('ohm-boundaries');
      this.refreshTileSource('ohm-ephemeral');
      this.refreshTileSource('ohm-transportation');
    }
    this.events = this.ohm.getEvents(ev);
  }

  private refreshTileSource(id: string): void {
    const src: any = this.map.getSource(id);
    if (!src || typeof src.setTiles !== 'function' || !Array.isArray(src.tiles)) return;
    src._ohmOriginalTiles ??= src.tiles.slice();
    const refreshed = src._ohmOriginalTiles.map((url: string) =>
      url.replace('{atDate}', this.atDate.toString())
    );
    src.setTiles(refreshed);
  }

  copyShare() {
    if (!this.screen?.elementRef?.nativeElement) {
      this.shareSnack('Open the map first');
      return;
    }
    this.capture.getImage(this.screen.elementRef.nativeElement, true).subscribe(img => {
      this.ohm.su(window.location.href, img).subscribe(data => {
        this.clipboard.copy(data);
        this.shareLink = data;
        this.shareBar?.toggle();
        this.shareSnack('Address copied');
      });
    });
  }

  private shareSnack(msg: string) {
    this.snackBar.open(msg, 'Close', { duration: 1200 });
  }

  selectDate() {
    const ref = this.md.open(DateComponent, { data: this.atDate });
    ref.afterClosed().subscribe(date => {
      if (date !== undefined && date !== null) {
        this.atDate = date;
      }
    });
  }

  goTimeSpace(time: number, space: any): void {
    this.l.go(`/${time}/${this.map.getZoom()}/${space.coordinates[0]}/${space.coordinates[1]}` + (this.rels ? '/' + this.rels : ''));
  }

  showOverlays() {
    if (!this.map.getSource('ohm-ephemeral')) return;
    this.map.addLayer({
      id: 'ships', type: 'circle', source: 'ohm-ephemeral', 'source-layer': 'movement',
      filter: ['all', ['==', 'type', 'ship']],
      paint: { 'circle-opacity': 0.6, 'circle-color': 'rgb(53, 175, 109)', 'circle-radius': 2 }
    });
    this.map.addLayer({
      id: 'planes', type: 'circle', source: 'ohm-ephemeral', 'source-layer': 'movement',
      filter: ['all', ['==', 'type', 'aircraft']],
      paint: { 'circle-opacity': 0.6, 'circle-color': '#dd3333', 'circle-radius': 2 }
    });
    this.map.addLayer({
      id: 'human', type: 'circle', source: 'ohm-ephemeral', 'source-layer': 'movement',
      filter: ['all', ['==', 'type', 'human']],
      paint: { 'circle-opacity': 0.6, 'circle-color': 'rgb(53, 53, 200)', 'circle-radius': 2 }
    });
    this.map.addLayer({
      id: 'events', type: 'circle', source: 'ohm-ephemeral', 'source-layer': 'event',
      paint: { 'circle-opacity': 1, 'circle-color': '#dd3333', 'circle-radius': 1.5 }
    });
  }

  showRels() {
    if (!this.rels) return;
    const rc = this.rels.split('|');
    const rels = rc.map(x => x.split(':')[0]);
    const cols = rc.map(x => x.split(':').length > 1 ? x.split(':')[1] : '232323');
    const wids = rc.map(x => x.split(':').length > 2 ? parseFloat(x.split(':')[2]) : 2);
    const opas = rc.map(x => x.split(':').length > 3 ? parseFloat(x.split(':')[3]) : 0.2);

    this.map.addSource('ohm-movement-rels', {
      type: 'geojson',
      data: 'http://51.15.160.236:9034/relation/' + rels.join('|'),
    });
    rels.forEach((id, i) => {
      this.map.addLayer({
        id: 'rel-movements-' + id,
        type: 'line',
        source: 'ohm-movement-rels',
        filter: ['all', ['==', 'relation', id]],
        paint: {
          'line-opacity': opas[i],
          'line-color': '#' + cols[i],
          'line-width': wids[i],
        }
      });
    });
    this.map.addLayer({
      id: 'rel-movements-labels',
      type: 'symbol',
      source: 'ohm-movement-rels',
      layout: {
        'text-field': ['step', ['zoom'], '', 4, ['get', 'name']],
        'text-size': 9
      }
    });
  }
}
