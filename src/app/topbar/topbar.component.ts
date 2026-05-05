import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'ohm-topbar',
  templateUrl: './topbar.component.html',
  styleUrls: ['./topbar.component.scss'],
  standalone: false
})
export class OhmTopbarComponent {
  @Input() year: number | string = 0;

  @Output() menu = new EventEmitter<void>();
  @Output() info = new EventEmitter<void>();
  @Output() share = new EventEmitter<void>();
  @Output() styleChange = new EventEmitter<string>();

  get yearLabel(): string {
    const y = typeof this.year === 'string' ? parseFloat(this.year) : this.year;
    if (y === null || y === undefined || isNaN(y)) return '';
    const yr = Math.trunc(y);
    return yr >= 0 ? `${yr} CE` : `${Math.abs(yr)} BCE`;
  }
}
