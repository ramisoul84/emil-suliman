import { Component, effect, inject } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AnalyticsService } from './_services/analytics.service';
import { AnalyticsEvent } from './_services/analytics-events';
import { LanguageService } from './_services/language.service';


@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  private readonly analytics = inject(AnalyticsService);
  private readonly language = inject(LanguageService);

  constructor() {
    // every event carries the language the site is read in; a switch is an event of its own
    let previous: string | null = null;
    effect(() => {
      const lang = this.language.currentLang();
      this.analytics.setSiteLanguage(lang);
      if (previous && previous !== lang) {
        this.analytics.track(AnalyticsEvent.LanguageChange, { from: previous, to: lang });
      }
      previous = lang;
    });

    // one pageview per route (the tracker itself skips /admin)
    inject(Router).events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(e => this.analytics.trackPageView({ page: e.urlAfterRedirects.split(/[?#]/)[0] }));
  }
}
