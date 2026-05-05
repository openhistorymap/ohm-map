import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'decimaldate',
  standalone: false
})
export class DecimaldatePipe implements PipeTransform {

  ms = (x) => 31; /*{
    1: (y) => 31,
    2: (y) => {
      let leap = false;
      if (y % 4 === 0) {
        if (y % 100 === 0) {
          leap = false;
        } else {
          leap = true;
        }
      } else if (y % 100 === 0) {
          leap = false;
        } else {
          leap = true;
        }
      return 28 + (leap ? 1 : 0);
    },
    3: (y) => 31,
    4: (y) => 30,
    5: (y) => 31,
    6: (y) => 30,
    7: (y) => 31,
    8: (y) => 31,
    9: (y) => 30,
    10: (y) => 31,
    11: (y) => 30,
    12: (y) => 31,
  }*/

  transform(value: number, ...args: unknown[]): Date {
    const adbc = value / Math.abs(value);
    const y = Math.trunc(value);
    let rest = Math.abs(value - y);
    const m = Math.trunc(rest * 12);
    rest = (rest * 12) - m;
    const d = Math.trunc(rest * this.ms(y));
    rest = (rest * this.ms(y)) - d;
    const H = Math.trunc(rest * 24);
    rest = (rest * 24) - H;
    const M = Math.trunc(rest * 60);
    rest = (rest * 60) - M;
    const S = Math.trunc(rest * 60);
    rest = (rest * 60) - S;
    const ret = new Date();
    ret.setFullYear(y);
    ret.setMonth(m);
    ret.setDate(d);
    ret.setHours(H);
    ret.setMinutes(M);
    ret.setSeconds(S);
    ret.setMilliseconds(rest);
    return ret;
  }
}
