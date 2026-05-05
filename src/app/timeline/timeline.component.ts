import {
  AfterViewInit, Component, ElementRef, EventEmitter, Input, NgZone,
  OnChanges, OnDestroy, OnInit, Output, SimpleChanges, ViewChild
} from '@angular/core';
import { HttpClient } from '@angular/common/http';

interface Tick { year: number; x: number; major: boolean; label?: string; }
interface EraSource { year: number; label: string; lng?: number; lat?: number; zoom?: number; }
interface Era extends EraSource { x: number; }

export interface EraFlyTarget { year: number; lng?: number; lat?: number; zoom?: number; label?: string; }

const FALLBACK_ERAS: EraSource[] = [
  { year: -753, label: 'Founding of Rome',     lng:  12.50, lat:  41.90, zoom: 6 },
  { year:  330, label: 'Constantinople',       lng:  28.98, lat:  41.01, zoom: 5 },
  { year:  476, label: 'Fall of the West',     lng:  12.50, lat:  41.90, zoom: 4 },
  { year:  622, label: 'Hijra',                lng:  39.61, lat:  24.47, zoom: 5 },
  { year:  800, label: 'Charlemagne crowned',  lng:   6.08, lat:  50.78, zoom: 5 },
  { year: 1066, label: 'Hastings',             lng:   0.49, lat:  50.91, zoom: 8 },
  { year: 1453, label: 'Constantinople falls', lng:  28.98, lat:  41.01, zoom: 6 },
  { year: 1492, label: 'Columbus',             lng: -77.43, lat:  23.95, zoom: 4 },
  { year: 1789, label: 'French Revolution',    lng:   2.35, lat:  48.86, zoom: 5 },
  { year: 1914, label: 'Great War',            lng:   4.40, lat:  50.85, zoom: 4 },
  { year: 1945, label: 'Atomic Age',           lng: 132.45, lat:  34.39, zoom: 5 },
  { year: 1989, label: 'Wall falls',           lng:  13.38, lat:  52.52, zoom: 6 },
];

@Component({
  selector: 'ohm-timeline',
  templateUrl: './timeline.component.html',
  styleUrls: ['./timeline.component.scss'],
  standalone: false
})
export class OhmTimelineComponent implements OnInit, AfterViewInit, OnChanges, OnDestroy {
  @Input() year: number = 866;
  @Output() yearChange = new EventEmitter<number>();
  @Output() flyTo = new EventEmitter<EraFlyTarget>();
  @Input() eraSource = 'assets/eras.json';

  @ViewChild('host', { static: true }) hostRef!: ElementRef<HTMLDivElement>;

  width = 1000;
  height = 96;
  viewStart = 766;
  viewEnd = 966;

  ticks: Tick[] = [];
  eras: Era[] = [];
  hoveredEraIndex: number | null = null;

  cursorYear = 866;
  cursorX = 0;
  cursorPlain = '866 CE';

  private allEras: EraSource[] = FALLBACK_ERAS;
  private dragging = false;
  private dragStartX = 0;
  private dragStartView: [number, number] = [0, 0];
  private dragMoved = false;

  private resizeObs?: ResizeObserver;
  private rafId?: number;

  constructor(private zone: NgZone, private http: HttpClient) {}

  ngOnInit(): void {
    this.http.get<EraSource[]>(this.eraSource).subscribe({
      next: (src) => {
        if (Array.isArray(src) && src.length) {
          this.allEras = src;
          if (this.hostRef?.nativeElement) this.recompute();
        }
      },
      error: () => { /* keep fallback */ }
    });
  }

  ngAfterViewInit(): void {
    queueMicrotask(() => this.firstLayout());
  }

  private firstLayout() {
    this.measure();
    const initial = this.numericYear(this.year);
    this.cursorYear = initial;
    this.centerOn(initial);
    this.recompute();

    this.resizeObs = new ResizeObserver(() => {
      this.measure();
      this.recompute();
    });
    this.resizeObs.observe(this.hostRef.nativeElement);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.year && this.hostRef?.nativeElement) {
      const target = this.numericYear(this.year);
      if (Math.abs(target - this.cursorYear) > 0.0001) {
        this.animateCursorTo(target);
      }
    }
  }

  ngOnDestroy(): void {
    this.resizeObs?.disconnect();
    if (this.rafId) cancelAnimationFrame(this.rafId);
  }

  private numericYear(v: number | string): number {
    const n = typeof v === 'string' ? parseFloat(v) : v;
    return isNaN(n) ? 0 : n;
  }

  private measure() {
    this.width = this.hostRef.nativeElement.clientWidth || 1000;
  }

  private centerOn(year: number, span = 240) {
    this.viewStart = year - span / 2;
    this.viewEnd   = year + span / 2;
  }

  private xFor(year: number): number {
    const span = this.viewEnd - this.viewStart;
    return ((year - this.viewStart) / span) * this.width;
  }

  private recompute() {
    const span = this.viewEnd - this.viewStart;
    const pxPerYear = this.width / span;

    let minor: number, major: number;
    if (pxPerYear >= 12)        { minor = 1;    major = 10;   }
    else if (pxPerYear >= 1.2)  { minor = 10;   major = 100;  }
    else if (pxPerYear >= 0.12) { minor = 100;  major = 1000; }
    else                        { minor = 1000; major = 5000; }

    const ticks: Tick[] = [];
    const startTick = Math.ceil(this.viewStart / minor) * minor;
    for (let y = startTick; y <= this.viewEnd; y += minor) {
      const x = this.xFor(y);
      const isMajor = (y % major === 0);
      ticks.push({
        year: y,
        x,
        major: isMajor,
        label: isMajor ? this.formatTickLabel(y) : undefined
      });
    }
    this.ticks = ticks;

    this.eras = this.allEras
      .filter(e => e.year >= this.viewStart && e.year <= this.viewEnd)
      .map(e => ({ ...e, x: this.xFor(e.year) }));

    this.updateCursorXOnly();
  }

  private updateCursorXOnly() {
    this.cursorX = this.xFor(this.cursorYear);
    this.cursorPlain = this.formatPlain(this.cursorYear);
  }

  formatTickLabel(y: number): string {
    if (y === 0) return '0';
    return y > 0 ? `${y}` : `${Math.abs(y)} BCE`;
  }

  formatPlain(y: number): string {
    const yr = Math.trunc(y);
    if (yr === 0) return '0';
    return yr >= 0 ? `${yr} CE` : `${Math.abs(yr)} BCE`;
  }

  /* Pointer interaction ---------------------------------------------------- */

  onPointerDown(ev: PointerEvent) {
    (ev.currentTarget as Element).setPointerCapture?.(ev.pointerId);
    this.dragging = true;
    this.dragMoved = false;
    this.dragStartX = ev.clientX;
    this.dragStartView = [this.viewStart, this.viewEnd];
  }

  onPointerMove(ev: PointerEvent) {
    if (!this.dragging) return;
    const dx = ev.clientX - this.dragStartX;
    if (Math.abs(dx) > 3) this.dragMoved = true;
    const span = this.dragStartView[1] - this.dragStartView[0];
    const dy = -dx / this.width * span;
    this.viewStart = this.dragStartView[0] + dy;
    this.viewEnd   = this.dragStartView[1] + dy;
    this.recompute();
  }

  onPointerUp(ev: PointerEvent) {
    if (!this.dragging) return;
    this.dragging = false;
    if (!this.dragMoved) {
      const rect = (ev.currentTarget as HTMLElement).getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const span = this.viewEnd - this.viewStart;
      const y = this.viewStart + (x / this.width) * span;
      this.cursorYear = y;
      this.updateCursorXOnly();
      this.yearChange.emit(y);
    }
  }

  onWheel(ev: WheelEvent) {
    ev.preventDefault();
    const rect = (ev.currentTarget as HTMLElement).getBoundingClientRect();
    const cx = ev.clientX - rect.left;
    const span = this.viewEnd - this.viewStart;
    const yAtCursor = this.viewStart + (cx / this.width) * span;
    const factor = ev.deltaY > 0 ? 1.2 : 1 / 1.2;
    const newSpan = Math.max(20, Math.min(20000, span * factor));
    const ratio = (yAtCursor - this.viewStart) / span;
    this.viewStart = yAtCursor - ratio * newSpan;
    this.viewEnd   = this.viewStart + newSpan;
    this.recompute();
  }

  jumpToEra(idx: number) {
    const e = this.eras[idx];
    if (!e) return;
    this.cursorYear = e.year;
    this.updateCursorXOnly();
    this.yearChange.emit(e.year);
    if (e.lng !== undefined && e.lat !== undefined) {
      this.flyTo.emit({ year: e.year, lng: e.lng, lat: e.lat, zoom: e.zoom, label: e.label });
    }
  }

  hoverEra(idx: number | null) {
    this.hoveredEraIndex = idx;
  }

  /* Animation -------------------------------------------------------------- */

  private animateCursorTo(target: number) {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    const start = this.cursorYear;
    const t0 = performance.now();
    const dur = 320;
    const ease = (t: number) => 1 - Math.pow(1 - t, 4);

    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / dur);
      this.zone.run(() => {
        this.cursorYear = start + (target - start) * ease(t);
        this.updateCursorXOnly();
      });
      if (t < 1) this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  /* Cursor edge -------------------------------------------------------------*/
  get cursorOffLeft(): boolean { return this.cursorX < 0; }
  get cursorOffRight(): boolean { return this.cursorX > this.width; }
  get cursorVisible(): boolean { return !this.cursorOffLeft && !this.cursorOffRight; }
}
