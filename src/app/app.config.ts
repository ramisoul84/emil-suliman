import { ApplicationConfig, importProvidersFrom, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { NgxGoogleAnalyticsModule, NgxGoogleAnalyticsRouterModule } from 'ngx-google-analytics';

import { routes } from './app.routes';
import { provideLottieOptions } from 'ngx-lottie';
import player from 'lottie-web';
import { provideHttpClient } from '@angular/common/http';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(),
    provideLottieOptions({
      player: () => player, // player: () => import('lottie-web'),
    }),
    importProvidersFrom(
      NgxGoogleAnalyticsModule.forRoot('G-LG4VDPQGGY'),
      NgxGoogleAnalyticsRouterModule
    )
  ]
};
