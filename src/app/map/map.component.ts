import { Component, OnInit, Input, isDevMode, ViewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { MatSidenav } from '@angular/material/sidenav';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Clipboard } from '@angular/cdk/clipboard';
import { Observable } from 'rxjs';
import { MatomoTracker } from 'ngx-matomo-client';
import { NgxCaptureService } from 'ngx-capture';
import maplibregl from 'maplibre-gl';

import { OhmService } from './../ohm.service';
import { DateComponent } from './../date/date.component';
import { DecimaldatePipe } from './../decimaldate.pipe';
import { EnvService } from './../env.service';

declare const vis: any;

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.scss'],
  standalone: false
})
export class MapComponent implements OnInit {
  map: maplibregl.Map;
  ts: string;
  maptilerKey: string;

  layers: any;
  startstopicons = {
    stop: 'play_arrow',
    play: 'stop'
  };
  startstopicon = 'play_arrow';
  startstopstatus = 'stop';
  startstopInterval: any;

  @Input() style: string;

  start: { center: [number, number]; zoom: number } = {
    center: [1.57, 43.67],
    zoom: 3.5
  };

  rels: string;

  atDate: number = 866.001;
  atMacroDate = 800;
  atMicroDate = 870;

  timeline: any;

  speed = 2000;

  events: Observable<any[]>;

  infoData: any;

  @ViewChild('ibar') ibar: MatSidenav;
  @ViewChild('sharebar') sharebar: MatSidenav;
  @ViewChild('screen') screen: any;

  share_link: string;

  selectedFeatures: any[] = [];

  constructor(
    private env: EnvService,
    private ar: ActivatedRoute,
    private l: Location,
    private md: MatDialog,
    private ohm: OhmService,
    private http: HttpClient,
    private matomoTracker: MatomoTracker,
    private _snackBar: MatSnackBar,
    private clipboard: Clipboard,
    private capture: NgxCaptureService
  ) { }

  ngOnInit(): void {
    this.http.get('assets/info.json').subscribe(data => {
      this.infoData = data;
    });
    this.ts = this.env.getEnv('TILESERVER');
    this.maptilerKey = this.env.getEnv('MAPTILER_KEY');
    this.ar.params.subscribe(params => {
      this.atDate = params.year;
      this.start.center = [params.x, params.y];
      this.start.zoom = params.z;
      if (this.map) {
        this.map.panTo(this.start.center);
      }
    });

    this.atDate = this.ar.snapshot.params.year;
    this.start.center = [this.ar.snapshot.params.x, this.ar.snapshot.params.y];
    this.start.zoom = this.ar.snapshot.params.z;
    this.rels = this.ar.snapshot.params.rels;

    this.map = new maplibregl.Map({
      container: 'ohm_map',
      style: this.style,
      center: this.start.center,
      zoom: this.start.zoom,
      canvasContextAttributes: { preserveDrawingBuffer: true },
      transformRequest: (url, resourceType) => {
        let nurl = url;
        if (isDevMode()) {
          nurl = nurl.replace('https://tiles.openhistorymap.org', this.ts);
          nurl = nurl.replace('https://a.tiles.openhistorymap.org', this.ts);
          nurl = nurl.replace('https://b.tiles.openhistorymap.org', this.ts);
          nurl = nurl.replace('https://c.tiles.openhistorymap.org', this.ts);
        }
        if (resourceType === 'Tile' && url.indexOf('openhistory') >= 0) {
          return {
            url: nurl.replace('{atDate}', this.atDate.toString())
          };
        }
        if (this.maptilerKey && url.indexOf('api.maptiler.com') >= 0 && url.indexOf('key=') < 0) {
          return {
            url: nurl + (nurl.indexOf('?') >= 0 ? '&' : '?') + 'key=' + this.maptilerKey
          };
        }
        return undefined;
      }
    });

    this.map.on('load', () => {
      this.showRels();
    });

    this.map.on('load', () => {
      this.showOverlays();
    });


    this.map.on('moveend', () => {
      this.changeUrl();
    });
    this.map.on('mouseenter', () => {
      this.map.getCanvas().style.cursor = 'pointer';
    });

    this.map.on('mouseleave', () => {
      this.map.getCanvas().style.cursor = '';
    });
    this.map.on('click', (e) => {
      console.log(e.lngLat);
      this.ohm.drilldown(e.lngLat).subscribe(feats => {
        if (feats.length > 0) {
          this.selectedFeatures = feats;
          console.log(feats[0].properties);
          new maplibregl.Popup()
            .setLngLat(e.lngLat)
            .addTo(this.map);
        }
      });
    });

    const container = document.getElementById('visualization');

    const items = new vis.DataSet([]);

    this.timeline = new vis.Timeline(container, items, {
      showCurrentTime: false
    });

    this.timeline.addCustomTime(this.toFloatDate(this.atDate), 'atTime');
    const d = this.toFloatDate(this.atDate);
    this.timeline.setWindow(
      new Date(d.getFullYear() - 10, d.getMonth(), d.getDate()),
      new Date(d.getFullYear() + 10, d.getMonth(), d.getDate())
    );


    this.timeline.on('click', (properties) => {
      this.atDate = this.toDateFloat(properties.time);
      this.timeline.setCustomTime(properties.time, 'atTime');
      this.changeUrl(this.atDate);
    });

    this.timeline.on('rangechanged', () => {});
  }

  copy_url() {
    this.capture.getImage(this.screen.elementRef.nativeElement, true).subscribe(img => {
      this.ohm.su(window.location.href, img).subscribe(data => {
        this.clipboard.copy(data);
        this.share_link = data;
        this.sharebar.open();
        this._snackBar.open('Address ready to share', 'Close', {
          duration: 1000
        });
      });
    });
  }

  changeUrl(ev: number | null = null): void {
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
    if (src && typeof src.setTiles === 'function' && Array.isArray(src.tiles)) {
      src.setTiles(src.tiles);
    }
  }

  changeStyle(style: string): void {
    this.style = style;
    try {
      this.map.setStyle(style);
    } catch (ex) { }
  }

  toDateFloat(date: Date): number {
    let ret = date.getFullYear();
    ret += (date.getMonth() + 1) / 12;
    ret += (date.getDate()) * (1 / 12 / 31);
    ret += (date.getHours()) * (1 / 12 / 31 / 24);
    ret += (date.getMinutes()) * (1 / 12 / 31 / 24 / 60);
    ret += (date.getSeconds()) * (1 / 12 / 31 / 24 / 60 / 60);
    return ret;
  }

  toFloatDate(date: number): Date {
    const dd = new DecimaldatePipe();
    return dd.transform(date);
  }

  startstop() {
    this.startstopstatus = this.startstopstatus === 'play' ? 'stop' : 'play';
    this.startstopicon = this.startstopicons[this.startstopstatus];
    if (this.startstopstatus === 'play') {
      this.startstopInterval = setInterval(() => {
        const delta = 1 / 12 / 30;
        this.atDate = parseFloat(this.atDate.toString()) + delta;
        this.timeline.setCustomTime(this.toFloatDate(this.atDate), 'atTime');
        this.changeUrl(this.atDate);
      }, 4000);
    } else {
      clearInterval(this.startstopInterval);
    }
  }

  selectDate() {
    const ref = this.md.open(DateComponent, { data: this.atDate });
    ref.afterClosed().subscribe(date => {
      this.atDate = date;
    });
  }

  setSpeed(speed: number) {
    this.speed = speed;
    if (this.startstopInterval) {
      clearInterval(this.startstopInterval);
      this.startstop();
    }
  }

  info() {}

  showOverlays() {
    this.map.addLayer({
      id: 'ships',
      type: 'circle',
      source: 'ohm-ephemeral',
      'source-layer': 'movement',
      filter: [
        'all',
        ['==', 'type', 'ship']
      ],
      paint: {
        'circle-opacity': 0.6,
        'circle-color': 'rgb(53, 175, 109)',
        'circle-radius': 2
      }
    });
    this.map.addLayer({
      id: 'planes',
      type: 'circle',
      source: 'ohm-ephemeral',
      'source-layer': 'movement',
      filter: [
        'all',
        ['==', 'type', 'aircraft']
      ],
      paint: {
        'circle-opacity': 0.6,
        'circle-color': '#dd3333',
        'circle-radius': 2
      }
    });
    this.map.addLayer({
      id: 'human',
      type: 'circle',
      source: 'ohm-ephemeral',
      'source-layer': 'movement',
      filter: [
        'all',
        ['==', 'type', 'human']
      ],
      paint: {
        'circle-opacity': 0.6,
        'circle-color': 'rgb(53, 53, 200)',
        'circle-radius': 2
      }
    });
    this.map.addLayer({
      id: 'events',
      type: 'circle',
      source: 'ohm-ephemeral',
      'source-layer': 'event',
      paint: {
        'circle-opacity': 1,
        'circle-color': '#dd3333',
        'circle-radius': 1.5
      }
    });
  }

  goTimeSpace(time: number, space: any): void {
    this.l.go(`/${time}/${this.map.getZoom()}/${space.coordinates[0]}/${space.coordinates[1]}` + (this.rels ? '/' + this.rels : ''));
  }

  showRels() {
    if (this.rels) {
      const rc = this.rels.split('|');
      const rels = rc.map(x => x.split(':')[0]);
      const cols = rc.map(x => x.split(':').length > 1 ? x.split(':')[1] : '232323');
      const wids = rc.map(x => x.split(':').length > 2 ? parseFloat(x.split(':')[2]) : 2);
      const opas = rc.map(x => x.split(':').length > 3 ? parseFloat(x.split(':')[3]) : 0.2);
      const zip = (arr1: any[], arr2: any[]) => arr1.map((k, i) => [k, arr2[i]]);

      const rcs = zip(rels, cols);

      this.map.addSource('ohm-movement-rels', {
        type: 'geojson',
        data: 'http://51.15.160.236:9034/relation/' + rels.join('|'),
      });
      rcs.forEach((irc, i) => {
        this.map.addLayer({
          id: 'rel-movements-' + irc[0],
          type: 'line',
          source: 'ohm-movement-rels',
          filter: [
            'all',
            ['==', 'relation', irc[0]]
          ],
          paint: {
            'line-opacity': opas[i],
            'line-color': '#' + irc[1],
            'line-width': wids[i],
          }
        });
      });
      this.map.addLayer({
        id: 'rel-movements-labels',
        type: 'symbol',
        source: 'ohm-movement-rels',
        layout: {
          'text-field': [
            'step', ['zoom'],
            '',
            4, ['get', 'name']
          ],
          'text-size': 9
        }
      });
    }
  }
}
