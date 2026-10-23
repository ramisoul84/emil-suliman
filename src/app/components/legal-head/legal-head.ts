import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LanguageService } from '../../_services/language.service';

/**
 * The head of the pages outside the main one (imprint, privacy, 404), in the site's own look:
 * the e's logo in the top-left 3 x 3 cells (back to the site), the page's title in a framed
 * box a cell lower, like every section's, and on the right "back to the site" and EN / DE
 * as in the side menu's corner.
 */
@Component({
  selector: 'app-legal-head',
  imports: [RouterLink],
  template: `
    <div class="head">
      <a class="logo" routerLink="/" [attr.aria-label]="de() ? 'zur Website' : 'to the site'">
        <img src="assets/images/timeline/es.webp" alt="" width="256" height="256">
      </a>
      <h1 class="title">{{ de() ? headingDe() : heading() }}</h1>
      <div class="tools">
        <a class="btn" routerLink="/">{{ de() ? 'zurück zur website' : 'back to the site' }}</a>
        <button type="button" class="lang" [class.on]="!de()" (click)="lang.setLanguage('en')">EN</button>
        <button type="button" class="lang" [class.on]="de()" (click)="lang.setLanguage('de')">DE</button>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; --g: var(--dynamic-grid-size); }
    /* on the grid: the logo from the top edge, the title and the tools a cell down */
    .head {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      gap: 0 var(--g);
      padding: 0 var(--g);
    }
    .logo { display: block; flex: none; width: calc(3 * var(--g)); height: calc(3 * var(--g)); }
    .logo img { display: block; width: 100%; height: 100%; }
    .logo:focus-visible { outline: 3px solid var(--color3); outline-offset: 2px; }
    .title {
      box-sizing: border-box;
      display: flex;
      align-items: center;
      justify-content: center;
      width: calc(16 * var(--g));
      max-width: calc(100vw - 6 * var(--g));
      height: calc(2 * var(--g));
      margin: var(--g) 0 0;
      background: #fff;
      outline: var(--frame, 2px solid #000);
      outline-offset: -1px;
      font: 400 var(--size-title, 1rem) / 1 var(--font-title);
      user-select: none;
    }
    .tools { display: flex; gap: var(--g); margin: var(--g) 0 0 auto; }
    /* like the footer's buttons: a cell tall, framed, lifting under the mouse */
    .btn {
      display: flex;
      align-items: center;
      height: var(--g);
      padding: 0 calc(.5 * var(--g));
      background: #fff;
      color: #000;
      text-decoration: none;
      outline: var(--frame, 2px solid #000);
      outline-offset: -1px;
      font: 400 calc(.7 * var(--g)) / 1 var(--font-title);
      white-space: nowrap;
      box-shadow: var(--shadow-0);
      transition: var(--lift);
    }
    .btn:hover, .btn:focus-visible { box-shadow: var(--shadow); }
    /* EN / DE as in the side menu's corner */
    .lang {
      width: calc(2 * var(--g));
      height: var(--g);
      padding: 0;
      border: 0;
      background: #fff;
      color: #000;
      outline: var(--frame, 2px solid #000);
      outline-offset: -1px;
      font: 400 max(calc(.7 * var(--g)), 11px) / var(--g) var(--font-title);
      cursor: pointer;
    }
    .lang.on { background: #000; color: #fff; }
    .lang:focus-visible { box-shadow: var(--shadow); }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LegalHead {
  readonly heading = input.required<string>();
  readonly headingDe = input.required<string>();
  protected readonly lang = inject(LanguageService);
  protected readonly de = computed(() => this.lang.currentLang() === 'de');
}
