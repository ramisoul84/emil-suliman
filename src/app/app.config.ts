import { ApplicationConfig, importProvidersFrom, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withInMemoryScrolling, withRouterConfig } from '@angular/router';

import { routes } from './app.routes';
import { HttpClient, provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideLottieOptions } from 'ngx-lottie';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import { DATA_VERSION } from './_config/data-version';
import { authInterceptor } from './_services/auth.interceptor';


export function createTranslateLoader(http: HttpClient) {
  return {
    getTranslation: (lang: string): Observable<any> => {
      return http.get(`./assets/i18n/${lang}.json?v=${DATA_VERSION}`);
    }
  };
}


export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(
      routes,
      withInMemoryScrolling({
        scrollPositionRestoration: 'top'
      }),
      withRouterConfig({
        paramsInheritanceStrategy: 'always'
      })
    ),
    provideHttpClient(
      withFetch(),
      withInterceptors([authInterceptor])
    ),
    provideLottieOptions({
      // Loaded on demand: keeps lottie (~150 kB) out of the initial bundle.
      // The light SVG build is enough — none of our animations use expressions.
      player: () => import('lottie-web/build/player/esm/lottie_light.min.js'),
    }),
    importProvidersFrom(
      TranslateModule.forRoot({
        fallbackLang: 'en',
        loader: {
          provide: TranslateLoader,
          useFactory: createTranslateLoader,
          deps: [HttpClient]
        }
      })
    ),
  ]
};
