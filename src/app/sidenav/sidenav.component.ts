import {
  Component, EventEmitter, HostListener, Input, Output, ViewEncapsulation
} from '@angular/core';

@Component({
  selector: 'ohm-sidenav',
  templateUrl: './sidenav.component.html',
  styleUrls: ['./sidenav.component.scss'],
  standalone: false,
  encapsulation: ViewEncapsulation.None
})
export class OhmSidenavComponent {
  @Input() title = '';
  @Input() position: 'start' | 'end' = 'end';
  @Input() open = false;

  @Output() openChange = new EventEmitter<boolean>();
  @Output() closed = new EventEmitter<void>();

  close() {
    if (!this.open) return;
    this.open = false;
    this.openChange.emit(false);
    this.closed.emit();
  }

  toggle() {
    this.open = !this.open;
    this.openChange.emit(this.open);
    if (!this.open) this.closed.emit();
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    this.close();
  }
}
