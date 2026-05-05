import { HttpClient } from '@angular/common/http';
import { Component, OnInit, EventEmitter, Output, Input } from '@angular/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';


@Component({
  selector: 'ohm-style-selector',
  templateUrl: './style-selector.component.html',
  styleUrls: ['./style-selector.component.scss'],
  standalone: false
})
export class StyleSelectorComponent implements OnInit {
  @Input() styleBase = 'https://raw.githubusercontent.com/openhistorymap/mapstyles/master/';

  @Output() styleChange: EventEmitter<string> = new EventEmitter<string>();

  styles: Observable<any[]>;

  selected = 'political.json';

  constructor(
    private http: HttpClient
  ) { }

  ngOnInit(): void {
    this.styles = this.http.get<any[]>(this.styleBase + 'styles.json').pipe(tap((x: any[]) => {
      const s = x.filter(a => a.default)[0].style;
      this.selected = s;
      this.styleChange.next(this.styleBase + s);
    }) );
  }

  change(ev): void{
    this.styleChange.next(this.styleBase + ev.value);
  }

}
