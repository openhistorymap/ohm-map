import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

@Component({
  selector: 'app-date',
  templateUrl: './date.component.html',
  styleUrls: ['./date.component.scss'],
  standalone: false
})
export class DateComponent implements OnInit {

  date;

  constructor(
    public dialogRef: MatDialogRef<DateComponent>,
    @Inject(MAT_DIALOG_DATA) public data: Date
  ) { }

  ngOnInit(): void {
  }

}
