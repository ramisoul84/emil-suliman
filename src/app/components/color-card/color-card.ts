import { ChangeDetectionStrategy, Component, ElementRef, NgZone, ViewChild, computed, inject, input } from '@angular/core';
import { AnalyticsService } from '../../_services/analytics.service';
import { ThemeService } from '../../_services/theme.service';
import { PICKER_GRID } from './picker-grid';

/** the landing's colours turned for a narrow card: a hue a row (and the greys last), light to dark
    from left to right */
const TURNED: string[] = Array.from({ length: 13 * 4 }, (_, i) => PICKER_GRID[(i % 4) * 13 + Math.floor(i / 4)]);

/**
 * The side menu's colour card: opens above the corner's colours, exactly as wide as the corner
 * (5 cells), for one of the three colours: an eyedropper, a colour of your own, and the
 * landing's colours turned (a hue a row, light to dark), a cell each. It grows out of its
 * bottom edge in 12 fps steps and folds back the same way (.out). The side menu places it
 * and closes it.
 */
@Component({
  selector: 'app-color-card',
  template: `
    <div class="pick-in" role="dialog" aria-label="colours">
      <button type="button" class="pick-eye" (click)="eyedrop()" aria-label="pick a colour from the screen">
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10.5 2.5l3 3M9 4l3 3M11.5 5.5L5 12H3.5v-1.5L10 4" /></svg>
      </button>
      <button type="button" class="pick-custom" (click)="custom()">custom</button>
      <input #customInput class="pick-input" type="color" tabindex="-1" aria-hidden="true"
          [value]="current()" (change)="choose(($any($event.target)).value)">
      <div class="pick-grid">
        @for (c of colors; track $index) {
        <button type="button" class="pick-cell" [style.background-color]="c"
            [class.on]="c === current()" [attr.aria-label]="c" (click)="choose(c)"></button>
        }
      </div>
    </div>
  `,
  styles: [`
    /* 5 cells wide, 15.5 tall: half a cell, the eyedropper and "custom" a cell tall (like the
       corner's buttons), half a cell, thirteen rows of four colours, half a cell */
    :host {
      --g: var(--dynamic-grid-size);
      --h: calc(15.5 * var(--g));
      position: absolute;
      display: block;
      width: calc(5 * var(--g));
      height: var(--h);
      background: #fff;
      outline: var(--frame, 2px solid #000);
      outline-offset: -1px;
      overflow: hidden;
      z-index: 5;
      animation: card-open .5s step-end both;
    }
    :host(.out) { animation: card-close .25s step-end both; }
    .pick-in { position: absolute; left: 0; bottom: 0; width: 100%; height: var(--h); }
    .pick-eye, .pick-custom {
      position: absolute;
      top: calc(.5 * var(--g));
      height: var(--g);
      border: 0;
      padding: 0;
      background: #fff;
      color: #000;
      outline: var(--frame, 2px solid #000);
      outline-offset: -1px;
      cursor: pointer;
      box-shadow: var(--shadow-0);
      transition: var(--lift);
    }
    .pick-eye:hover, .pick-eye:focus-visible, .pick-custom:hover, .pick-custom:focus-visible { box-shadow: var(--shadow); }
    .pick-eye { left: calc(.5 * var(--g)); width: var(--g); display: grid; place-items: center; }
    .pick-eye svg { width: calc(.7 * var(--g)); height: calc(.7 * var(--g)); fill: none; stroke: #000; stroke-width: 1.6; stroke-linecap: square; }
    .pick-custom { left: calc(2 * var(--g)); width: calc(2.5 * var(--g)); font-family: var(--font-title); font-size: calc(.65 * var(--g)); line-height: var(--g); }
    /* the browser's own picker opens from here, under "custom" */
    .pick-input { position: absolute; left: calc(.5 * var(--g)); top: calc(1.5 * var(--g)); width: calc(4 * var(--g)); height: 1px; padding: 0; border: 0; opacity: 0; pointer-events: none; }
    /* the colours: a cell each */
    .pick-grid { position: absolute; left: calc(.5 * var(--g)); top: calc(2 * var(--g)); display: grid; grid-template-columns: repeat(4, var(--g)); grid-auto-rows: var(--g); }
    .pick-cell { width: var(--g); height: var(--g); padding: 0; border: 0; cursor: pointer; }
    .pick-cell:hover, .pick-cell:focus-visible, .pick-cell.on { position: relative; z-index: 1; outline: 2px solid #000; outline-offset: -1px; }
    /* out of its bottom edge upwards, in 6 steps; back in 3 */
    @keyframes card-open {
      0%     { height: calc(.05 * var(--h)); }
      16.67% { height: calc(.625 * var(--h)); }
      33.33% { height: calc(.869 * var(--h)); }
      50%    { height: calc(.962 * var(--h)); }
      66.67% { height: calc(.997 * var(--h)); }
      83.33%, 100% { height: var(--h); }
    }
    @keyframes card-close {
      0%     { height: calc(.869 * var(--h)); }
      33.33% { height: calc(.375 * var(--h)); }
      66.67%, 100% { height: 0; outline-color: transparent; }
    }
    @media (prefers-reduced-motion: reduce) { :host, :host(.out) { animation: none; } }
  `],
  host: { '[class.out]': 'out()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ColorCard {
  readonly slot = input.required<0 | 1 | 2>();
  readonly out = input(false);
  private readonly theme = inject(ThemeService);
  private readonly analytics = inject(AnalyticsService);
  private readonly zone = inject(NgZone);
  @ViewChild('customInput') private customInput?: ElementRef<HTMLInputElement>;

  readonly colors = TURNED;
  readonly current = computed(() => this.theme.palette()[this.slot()]);

  choose(color: string): void {
    this.analytics.trackAction('blob');
    this.theme.set(this.slot(), color);
  }

  /** a colour of your own: the browser's colour picker */
  custom(): void {
    const el = this.customInput?.nativeElement;
    if (!el) return;
    try { el.showPicker(); } catch { el.click(); }
  }

  /** the eyedropper: any colour on the screen (where the browser has one; else the picker) */
  async eyedrop(): Promise<void> {
    const Dropper = (window as any).EyeDropper;
    if (!Dropper) { this.custom(); return; }
    try {
      const { sRGBHex } = await new Dropper().open();
      if (sRGBHex) this.zone.run(() => this.choose(sRGBHex));
    } catch { /* cancelled */ }
  }
}
