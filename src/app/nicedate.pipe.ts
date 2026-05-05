import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'nicedate',
  standalone: false
})
export class NicedatePipe implements PipeTransform {

  transform(value: string, ...args: unknown[]): unknown {
    if (value) {
      return value.replace('AD', 'CE').replace('BC', 'BCE');
    } else {
      return '';
    }
  }

}
