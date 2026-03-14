import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { DesktopFlowComponent } from './desktop-flow.component';
import { WindowsDesktopComponent } from './windows-desktop.component';
import { PaintComponent } from './apps/paint.component';
import { NotepadComponent } from './apps/notepad.component';
import { CalculatorComponent } from './apps/calculator.component';

@NgModule({
  declarations: [
    DesktopFlowComponent,
    WindowsDesktopComponent,
    PaintComponent,
    NotepadComponent,
    CalculatorComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule.forChild([
      { path: '', component: DesktopFlowComponent }
    ])
  ]
})
export class DesktopFlowModule {}
