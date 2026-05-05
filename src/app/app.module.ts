import { APP_INITIALIZER, NgModule, inject } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ClipboardModule } from '@angular/cdk/clipboard';
import { provideHttpClient } from '@angular/common/http';
import { provideMatomo } from 'ngx-matomo-client';
import { withRouter } from 'ngx-matomo-client/router';

import { AppRoutingModule } from './app-routing.module';
import { SharedModule } from './shared.module';
import { AppComponent } from './app.component';
import { MapComponent } from './map/map.component';
import { StyleSelectorComponent } from './style-selector/style-selector.component';
import { OhmTopbarComponent } from './topbar/topbar.component';
import { OhmSidenavComponent } from './sidenav/sidenav.component';
import { OhmTimelineComponent } from './timeline/timeline.component';
import { DecimaldatePipe } from './decimaldate.pipe';
import { NicedatePipe } from './nicedate.pipe';
import { DateComponent } from './date/date.component';
import { EnvService } from './env.service';

@NgModule({
  declarations: [
    AppComponent,
    MapComponent,
    StyleSelectorComponent,
    OhmTopbarComponent,
    OhmSidenavComponent,
    OhmTimelineComponent,
    DecimaldatePipe,
    NicedatePipe,
    DateComponent
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    AppRoutingModule,
    ClipboardModule,
    SharedModule
  ],
  providers: [
    provideHttpClient(),
    provideMatomo(
      { trackerUrl: '//tracker.openhistorymap.org/', siteId: 2 },
      withRouter()
    ),
    {
      provide: APP_INITIALIZER,
      multi: true,
      useFactory: () => {
        const env = inject(EnvService);
        return () => env.load();
      }
    }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
