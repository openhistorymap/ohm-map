import { HttpClient } from '@angular/common/http';
import {
  Component, ElementRef, EventEmitter, HostListener, Input, OnInit, Output
} from '@angular/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

interface MapStyle {
  style: string;
  label: string;
  default?: boolean;
}

@Component({
  selector: 'ohm-style-selector',
  templateUrl: './style-selector.component.html',
  styleUrls: ['./style-selector.component.scss'],
  standalone: false
})
export class StyleSelectorComponent implements OnInit {
  @Input() styleBase = 'https://raw.githubusercontent.com/openhistorymap/mapstyles/master/';

  @Output() styleChange = new EventEmitter<string>();

  styles$: Observable<MapStyle[]>;
  selected = 'political.json';
  selectedLabel = 'Political';
  open = false;

  constructor(private http: HttpClient, private host: ElementRef) {}

  ngOnInit(): void {
    this.styles$ = this.http.get<MapStyle[]>(this.styleBase + 'styles.json').pipe(
      tap((list) => {
        const def = list.find(a => a.default) ?? list[0];
        if (def) {
          this.selected = def.style;
          this.selectedLabel = def.label;
          this.styleChange.emit(this.styleBase + def.style);
        }
      })
    );
  }

  pick(s: MapStyle) {
    this.selected = s.style;
    this.selectedLabel = s.label;
    this.styleChange.emit(this.styleBase + s.style);
    this.open = false;
  }

  toggle() {
    this.open = !this.open;
  }

  @HostListener('document:click', ['$event'])
  onDocClick(ev: MouseEvent) {
    if (!this.open) return;
    if (!this.host.nativeElement.contains(ev.target as Node)) {
      this.open = false;
    }
  }

  @HostListener('document:keydown.escape')
  onEsc() { this.open = false; }
}
