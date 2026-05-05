import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { MatDialogModule } from '@angular/material/dialog';
import { MatSnackBarModule } from '@angular/material/snack-bar';

const modules = [
  MatDialogModule,
  MatSnackBarModule,
];

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ...modules,
  ],
  exports: [
    CommonModule,
    FormsModule,
    ...modules,
  ]
})
export class SharedModule { }
