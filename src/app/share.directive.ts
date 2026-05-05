import { Directive, Input } from '@angular/core';

@Directive({
  selector: '[share]',
  host: {
    "(click)": "onClick($event)"
  },
  standalone: false
})
export class ShareDirective {

  @Input('share') url = ''
  constructor() { }

  onClick(e){
    window.open(this.url, 'share', "width=400,height=300,toolbar=no,status=no,menubar=no");
  }

}
