import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, HostListener, NgZone, OnDestroy, ViewChild, signal } from '@angular/core';
import { LanguageService } from '../../_services/language.service';
import { PageScrollService } from '../../_services/page-scroll.service';
import { SectionProgressService } from '../../_services/section-progress.service';
import { ThemeService } from '../../_services/theme.service';
import { BackdropService } from '../../_services/backdrop.service';
import { warmCollage } from '../../_services/recolor';
import { SHOW_SOLIDARITY } from '../../_config/sections';
import { ColorCard } from '../color-card/color-card';
import { isDesktop } from '../../_config/phone';

/** a rectangle in the menu, px: left, right, top, bottom */
interface Box { x0: number; x1: number; y0: number; y1: number; }

/**
 * The site menu on the right (desktop): two cells to the right of the pages' text column,
 * in the middle of the window, on the grid. It comes in once the page reaches "about me"
 * (on the landing page the header's own menu is shown). Small screens keep the hamburger.
 *
 * - The page you are on sits in a magenta box of whole grid cells, its word white. When
 *   the page changes the box travels like a wing (Emil's video, 12 fps): it widens to the
 *   longer word if needed, stretches out to the new page (leading edge first), pulls in
 *   behind, then fits the new word. Words read white wherever the box is (a white copy of
 *   the menu inside the box), so they turn white as it passes.
 * - The words start in the middle of a cell, so the box has half a cell before them.
 * - Beside it a counter shows how far the page's story is told (timeline, cases).
 * - Arrows above and below step like one swipe: the next case / part, else the next page.
 * - In the lower right corner: a reset button and the site's three colours (click one to
 *   change it, like the blob's pickers on the landing page), and the language, EN / DE. It sits on a line of the
 *   page you are on (cornerRow) and steps there when the page changes.
 */
@Component({
  selector: 'app-side-menu',
  imports: [ColorCard],
  template: `
    <nav #nav class="side-menu" aria-label="Sections" [class.shown]="shown()" [attr.aria-hidden]="!shown()"
         [style.left.px]="left()" [style.top.px]="top()">
      <button type="button" class="arrow up" aria-label="Previous" (click)="step(-1)">
        <svg viewBox="0 0 12 8" aria-hidden="true"><path d="M1 7 6 2l5 5" /></svg>
      </button>
      @for (it of items; track it.id) {
        <button type="button" class="item" [attr.data-id]="it.id" [attr.aria-current]="active() === it.id ? 'true' : null"
          (click)="go(it.id)">{{ lang.currentLang() === 'de' ? it.de : it.en }}</button>
      }
      <button type="button" class="arrow down" aria-label="Next" (click)="step(1)">
        <svg viewBox="0 0 12 8" aria-hidden="true"><path d="M1 1l5 5 5-5" /></svg>
      </button>
      <span #marker class="marker" aria-hidden="true">
        <span #ink class="ink">
          @for (it of items; track it.id) {
            <span class="ink-label" [attr.data-id]="it.id">{{ lang.currentLang() === 'de' ? it.de : it.en }}</span>
          }
        </span>
      </span>
      <span #counter class="counter" aria-hidden="true"></span>
    </nav>

    <!-- lower right corner: the site's colours and the language (not over the projects'
         full-screen pictures and films) -->
    <div class="corner" [class.shown]="shown() && active() !== 'cases'" [attr.aria-hidden]="!shown() || active() === 'cases'"
         [style.left.px]="cornerLeft()" [style.top.px]="cornerTop()">
      <div class="swatches">
        <!-- back to Emil's own colours -->
        <button type="button" class="reset" (click)="theme.reset()" [disabled]="theme.isDefault()"
                [attr.aria-label]="lang.currentLang() === 'de' ? 'Farben zurücksetzen' : 'Reset the colours'"
                [attr.title]="lang.currentLang() === 'de' ? 'Farben zurücksetzen' : 'Reset the colours'">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13.2 9.4A5.4 5.4 0 1 1 11.6 4.2" /><path d="M12.2 1.4v3.4H8.8" /></svg>
        </button>
        <span class="swatch-row">
          @for (i of swatches; track i) {
            <!-- each opens the colour card above (color-card.ts), as on the landing -->
            <button type="button" class="swatch" [class.on]="editing() === i" [style.background]="theme.palette()[i]"
              (pointerenter)="warm()" (click)="openCard(i)" [attr.aria-expanded]="editing() === i"
              [attr.aria-label]="(lang.currentLang() === 'de' ? 'Farbe ' : 'Colour ') + (i + 1)"></button>
          }
        </span>
        @if (editing() !== null) {
          <app-color-card class="corner-card" [slot]="editing()!" [out]="cardOut()" />
        }
      </div>
      <div class="langs">
        <button type="button" class="lang" [class.on]="lang.currentLang() !== 'de'" (click)="lang.setLanguage('en')">EN</button>
        <button type="button" class="lang" [class.on]="lang.currentLang() === 'de'" (click)="lang.setLanguage('de')">DE</button>
      </div>
    </div>
  `,
  styles: [`
    :host { display: none; }
    @media (min-width: 900px) { :host { display: block; } }   /* DESKTOP_MIN_WIDTH (_config/phone.ts) */
    .side-menu {
      --g: var(--dynamic-grid-size);
      position: fixed;
      z-index: 998;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: var(--g);
      /* out of sight on the landing page; fades in / out in 12 fps steps */
      opacity: 0;
      visibility: hidden;
      transition: opacity .33s steps(4, end), visibility 0s linear .33s;
    }
    .side-menu.shown {
      opacity: 1;
      visibility: visible;
      transition: opacity .33s steps(4, end), visibility 0s;
    }
    @media (prefers-reduced-motion: reduce) { .side-menu, .side-menu.shown { transition: none; } }
    button {
      position: relative;
      z-index: 1;
      height: var(--g);
      padding: 0;
      border: 0;
      background: none;
      color: #000;
      font-family: var(--font-title);
      font-size: var(--size-main-nav, .8rem);
      line-height: var(--g);
      white-space: nowrap;
      cursor: pointer;
      user-select: none;
      /* a little bolder than the LCD font's one weight */
      -webkit-text-stroke: .4px currentColor;
    }
    button:focus-visible { outline: none; }
    /* no line on hover (only on the page you are on); keyboard focus still shows one */
    .item:focus-visible::before {
      content: '';
      position: absolute;
      left: calc(-.5 * var(--g));
      right: calc(-.5 * var(--g));
      top: calc(50% - 2px);
      height: 4px;
      background: var(--color3);
      animation: side-blink .15s steps(2, jump-start) both;
      z-index: -1;
    }
    @keyframes side-blink { from { opacity: 0; } to { opacity: 1; } }
    /* the arrows: a chevron a cell wide */
    .arrow {
      width: var(--g);
      margin-left: calc(-.5 * var(--g));   /* its own cell: the chevron centred where the words start */
      display: grid;
      place-items: center;
    }
    .arrow svg {
      width: calc(.55 * var(--g));
      height: calc(.4 * var(--g));
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: square;
      overflow: visible;
    }
    /* over a case's dark picture or film the words are white (tone()), fading over */
    .side-menu button { transition: color .5s ease-in-out; }
    .side-menu button.light { color: #fff; }
    .side-menu .arrow:hover, .side-menu .arrow:focus-visible { color: var(--color3); }
    /* the box on the page you are on (placed and moved from the script), over the words,
       with the words again in white inside it */
    .marker {
      position: absolute;
      z-index: 2;
      left: 0;
      top: 0;
      width: 0;
      height: 0;
      overflow: hidden;
      background: var(--color3);
      pointer-events: none;
    }
    .ink { position: absolute; left: 0; top: 0; }
    .ink-label {
      position: absolute;
      left: 0;
      top: 0;
      height: var(--g);
      font-family: var(--font-title);
      font-size: var(--size-main-nav, .8rem);
      line-height: var(--g);
      color: #fff;
      -webkit-text-stroke: .4px currentColor;
      white-space: nowrap;
    }
    /* the corner: three colour squares a cell each (a cell apart), and EN / DE below */
    .corner {
      --g: var(--dynamic-grid-size);
      position: fixed;
      z-index: 998;
      display: flex;
      flex-direction: column;
      gap: var(--g);
      opacity: 0;
      visibility: hidden;
      transition: opacity .33s steps(4, end), visibility 0s linear .33s, top .25s steps(3, end);
    }
    .corner.shown {
      opacity: 1;
      visibility: visible;
      transition: opacity .33s steps(4, end), visibility 0s, top .25s steps(3, end);
    }
    /* the reset button, a cell free, then the three colours: a whole cell each, side by side
       (Emil's sketch, 21 Oct) */
    .swatches, .langs { display: flex; gap: var(--g); }
    .swatch-row {
      display: flex;
      width: calc(3 * var(--g));
      height: var(--g);
    }
    .reset {
      width: var(--g);
      height: var(--g);
      padding: 0;
      display: grid;
      place-items: center;
      background: #fff;
      color: #000;
      outline: var(--frame, 2px solid #000);
      outline-offset: -1px;
      -webkit-text-stroke: 0;
    }
    .reset svg {
      width: calc(.6 * var(--g));
      height: calc(.6 * var(--g));
      fill: none;
      stroke: currentColor;
      stroke-width: 1.8;
      stroke-linecap: square;
      overflow: visible;
    }
    /* the colour and language switches stay still under the mouse (no highlight) */
    .reset:focus-visible, .lang:focus-visible { box-shadow: var(--shadow); }
    .reset:disabled { cursor: default; color: #b3b3b3; }
    .swatch {
      position: relative;
      flex: none;
      width: var(--g);
      height: var(--g);
      cursor: pointer;
    }
    /* under the mouse a black frame, as on the landing */
    .swatch:hover { outline: 2px solid #000; outline-offset: -1px; z-index: 1; }
    .swatch { padding: 0; border: 0; }
    .swatch.on { outline: 2px solid #000; outline-offset: -1px; z-index: 1; }
    .swatch:focus-visible { outline: 2px solid #000; outline-offset: -1px; }
    /* the colour card: its right edge on the corner's, half a cell above the colours */
    .corner-card { right: 0; bottom: calc(100% + .5 * var(--g)); }
    .lang {
      width: calc(2 * var(--g));
      height: var(--g);
      padding: 0;
      background: #fff;
      color: #000;
      outline: var(--frame, 2px solid #000);
      outline-offset: -1px;
      font-size: max(calc(.7 * var(--g)), 11px);
      line-height: var(--g);
      text-align: center;
      -webkit-text-stroke: 0;
    }
    .lang.on { background: #000; color: #fff; }
    .counter {
      position: absolute;
      left: 0;
      top: 0;
      height: var(--g);
      font-family: var(--font-title);
      font-size: var(--size-main-nav, .8rem);
      line-height: var(--g);
      color: var(--color3);
      -webkit-text-stroke: .4px currentColor;
      white-space: nowrap;
      pointer-events: none;
      visibility: hidden;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SideMenu implements AfterViewInit, OnDestroy {
  readonly items = [
    { id: 'about', en: 'about me', de: 'über mich' },
    { id: 'timeline', en: 'timeline', de: 'timeline' },
    { id: 'cases', en: 'cases', de: 'arbeit' },
    { id: 'solidarity', en: 'solidarity', de: 'solidarität' },
    { id: 'contact', en: 'contact', de: 'kontakt' },
  ].filter(it => it.id !== 'solidarity' || SHOW_SOLIDARITY);
  readonly left = signal(0);
  readonly top = signal(0);
  readonly cornerLeft = signal(0);
  readonly cornerTop = signal(0);
  readonly swatches = [0, 1, 2] as const;
  /** shown from "about me" on */
  readonly shown = signal(false);
  /** the page you are on */
  readonly active = signal<string | null>(null);

  @ViewChild('nav') private navRef!: ElementRef<HTMLElement>;
  @ViewChild('marker') private markerRef!: ElementRef<HTMLElement>;
  @ViewChild('ink') private inkRef!: ElementRef<HTMLElement>;
  @ViewChild('counter') private counterRef!: ElementRef<HTMLElement>;

  /** the wing's moves, in 1/12 s frames: share of the way each frame (Emil's video) */
  private static readonly WIDEN = [0.22, 0.89, 1];
  private static readonly LEAD = [0.6, 0.92, 1];
  private static readonly TRAIL = [0.15, 0.65, 0.93, 1];
  private static readonly NARROW = [0.64, 0.94, 1];

  private observer?: ResizeObserver;
  private offScroll?: () => void;
  private timer = 0;
  private box: Box | null = null;          // where the line is now
  private at: string | null = null;        // the page it is on (or heading to)
  private frames: Box[] = [];              // the frames still to play
  private shownCount = -1;                 // the counter's value on screen

  constructor(public lang: LanguageService, private pageScroll: PageScrollService,
    private progress: SectionProgressService, private zone: NgZone, public theme: ThemeService,
    private backdrop: BackdropService) { }

  /* ---- the colour card over the corner's colours (null: closed) */
  readonly editing = signal<0 | 1 | 2 | null>(null);
  readonly cardOut = signal(false);
  private cardOff: (() => void)[] = [];
  private cardTimer = 0;

  /** a colour clicked: its card opens above (again: it closes) */
  openCard(i: 0 | 1 | 2): void {
    if (this.editing() === i && !this.cardOut()) { this.closeCard(); return; }
    clearTimeout(this.cardTimer);
    this.cardOut.set(false);
    this.editing.set(i);
    if (this.cardOff.length) return;
    // a click anywhere else, or esc, closes it
    this.zone.runOutsideAngular(() => {
      const down = (e: PointerEvent) => {
        if ((e.target as HTMLElement | null)?.closest('.corner-card, .corner .swatch')) return;
        this.zone.run(() => this.closeCard());
      };
      const key = (e: KeyboardEvent) => { if (e.key === 'Escape') this.zone.run(() => this.closeCard()); };
      document.addEventListener('pointerdown', down, true);
      document.addEventListener('keydown', key, true);
      this.cardOff.push(() => document.removeEventListener('pointerdown', down, true),
        () => document.removeEventListener('keydown', key, true));
    });
  }

  closeCard(): void {
    if (this.editing() === null || this.cardOut()) return;
    this.cardOff.forEach(off => off());
    this.cardOff = [];
    this.cardOut.set(true);
    clearTimeout(this.cardTimer);
    this.cardTimer = window.setTimeout(() => { this.editing.set(null); this.cardOut.set(false); }, 250);
  }

  /** about to pick a colour: get the collage pictures ready */
  warm(): void {
    warmCollage();
  }

  ngAfterViewInit(): void {
    this.place();
    this.update();
    // the pages may still be settling (fonts, grid size): place again once they have
    this.zone.runOutsideAngular(() => {
      setTimeout(() => this.zone.run(() => this.place()), 600);
      if (typeof ResizeObserver !== 'undefined') {
        const main = document.querySelector('.main');
        if (main) {
          this.observer = new ResizeObserver(() => this.zone.run(() => this.place()));
          this.observer.observe(main);
        }
      }
      const onScroll = () => this.update();
      window.addEventListener('scroll', onScroll, { passive: true });
      this.offScroll = () => window.removeEventListener('scroll', onScroll);
    });
  }

  ngOnDestroy(): void {
    this.cardOff.forEach(off => off());
    clearTimeout(this.cardTimer);
    this.observer?.disconnect();
    this.offScroll?.();
    clearInterval(this.timer);
  }

  @HostListener('window:resize')
  place(): void {
    const g = this.grid();
    const main = document.querySelector('.main')?.getBoundingClientRect();
    const column = document.getElementById('about')?.getBoundingClientRect();
    if (!main || !column) return;
    // the words start in the middle of a cell, a cell and a half right of the text column
    this.left.set(Math.round(column.right + 1.5 * g));
    // centred in the window, on a grid row (arrow, 5 items, arrow, a cell apart: 13 cells)
    const rows = Math.floor(window.innerHeight / g);
    const off = (main.top % g + g) % g;
    this.top.set(Math.round((Math.floor((rows - 13) / 2)) * g + off));
    // the corner: on the grid, a cell in from the menu's box. A page at rest has the grid on
    // the window's whole cells; the colours sit on the footer's buttons row and EN / DE on
    // its copyright row (the footer keeps itself on those rows, footer.scss)
    this.cornerLeft.set(Math.round(column.right + 2 * g));
    this.cornerTop.set(Math.round(this.cornerRow(this.active()) * g));
  }

  /**
   * The corner's top row for the page you are on (3 rows: colours, a free row, EN / DE).
   * Its bottom: on the timeline level with the map's bottom line; on cases two cells above
   * the frame's time line, so it doesn't cut it; elsewhere on the footer's rows. A page at
   * rest has its top at its scroll margin, so the lines are measured from the page's top.
   */
  private cornerRow(active: string | null): number {
    const g = this.grid();
    const rows = Math.floor(window.innerHeight / g + 0.001);
    const atRest = (page: string, sel: string): number | null => {
      const p = document.getElementById(page), e = p?.querySelector<HTMLElement>(sel);
      if (!p || !e || !e.offsetHeight) return null;
      const margin = parseFloat(getComputedStyle(p).scrollMarginTop) || 0;
      return Math.round((e.getBoundingClientRect().bottom - p.getBoundingClientRect().top + margin) / g);
    };
    let bottom = rows - 1;
    if (active === 'timeline') bottom = atRest('timeline', '.map-wrapper') ?? bottom;
    if (active === 'cases') { const b = atRest('cases', '.stage'); if (b !== null) bottom = b - 2; }
    return Math.min(rows - 1, bottom) - 3;
  }

  go(id: string): void {
    const el = document.getElementById(id);
    if (!el) return;
    if (!this.pageScroll.scrollToElement(el)) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /** the arrows: straight to the page before / after (not a step within a page) */
  step(dir: number): void {
    const ids = ['home', ...this.items.map(i => i.id)];
    const at = ids.indexOf(this.active() ?? 'home');
    const next = ids[Math.max(0, Math.min(ids.length - 1, at + dir))];
    if (next !== ids[at]) this.go(next);
  }

  private grid(): number {
    return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dynamic-grid-size')) || 21;
  }

  /** shown once "about me" fills half the window; the page you are on — while the page
      glides, the page it is going to, so the menu flips as the page does */
  private update(): void {
    // the phone layout has no side menu: nothing to follow
    if (!isDesktop()) {
      if (this.timer) { clearInterval(this.timer); this.timer = 0; }
      return;
    }
    const mid = window.innerHeight * 0.5;
    const to = this.pageScroll.glideTarget();
    const ahead = to === null ? 0 : to - window.scrollY;
    let active: string | null = null;
    for (const it of this.items) {
      const el = document.getElementById(it.id);
      if (el && el.getBoundingClientRect().top - ahead <= mid) active = it.id;
    }
    const show = active !== null;
    if (show !== this.shown() || active !== this.active()) {
      this.zone.run(() => {
        this.shown.set(show);
        if (!show || active === 'cases') this.closeCard();
        this.active.set(active);
        this.cornerTop.set(Math.round(this.cornerRow(active) * this.grid()));
      });
    }
    // the line and counter run at 12 fps while the menu is out
    if (show && !this.timer) this.timer = window.setInterval(() => this.tick(), 1000 / 12);
    if (!show && this.timer) { clearInterval(this.timer); this.timer = 0; this.box = null; this.at = null; }
  }

  /** the box on an item: its row, half a cell free on both sides of the word (it starts on
      the grid line half a cell before the word) */
  private boxFor(id: string): Box | null {
    const nav = this.navRef?.nativeElement;
    const btn = nav?.querySelector<HTMLElement>(`.item[data-id="${id}"]`);
    if (!btn) return null;
    const g = this.grid();
    const x0 = btn.offsetLeft - g / 2;
    return { x0, x1: Math.round(btn.offsetLeft + btn.offsetWidth + g / 2), y0: btn.offsetTop, y1: btn.offsetTop + g };
  }

  /** the menu's words and arrows white over a case's picture or film, black elsewhere —
      as set for each case (cases-data.ts: menu); the colour fades (css) */
  private tone(): void {
    const nav = this.navRef?.nativeElement;
    if (!nav) return;
    const els = Array.from(nav.querySelectorAll<HTMLElement>('.item, .arrow'));
    const ids = els.map(e => e.dataset['id'] ?? (e.classList.contains('up') ? 'up' : 'down'));
    const white = this.backdrop.white(els.map(e => e.getBoundingClientRect()), ids);
    els.forEach((e, i) => { if (e.classList.contains('light') !== white[i]) e.classList.toggle('light', white[i]); });
  }

  /** the wing from one place to the next: widen, stretch out (leading edge), pull in, fit */
  private flight(from: Box, to: Box): Box[] {
    const T = SideMenu, out: Box[] = [];
    const lerp = (a: number, b: number, f: number) => a + (b - a) * f;
    let b = { ...from };
    if (to.x1 > b.x1 + 0.5 || to.x0 < b.x0 - 0.5) {
      const s = { ...b };
      for (const f of T.WIDEN) out.push(b = { ...b, x0: lerp(s.x0, Math.min(s.x0, to.x0), f), x1: lerp(s.x1, Math.max(s.x1, to.x1), f) });
    }
    if (Math.abs(to.y0 - b.y0) > 0.5) {
      const down = to.y0 > b.y0, s = { ...b };
      for (const f of T.LEAD) out.push(b = down ? { ...b, y1: lerp(s.y1, to.y1, f) } : { ...b, y0: lerp(s.y0, to.y0, f) });
      for (const f of T.TRAIL) out.push(b = down ? { ...b, y0: lerp(s.y0, to.y0, f) } : { ...b, y1: lerp(s.y1, to.y1, f) });
    }
    if (Math.abs(to.x1 - b.x1) > 0.5 || Math.abs(to.x0 - b.x0) > 0.5) {
      const s = { ...b };
      for (const f of T.NARROW) out.push(b = { ...b, x0: lerp(s.x0, to.x0, f), x1: lerp(s.x1, to.x1, f) });
    }
    return out;
  }

  /** the white words inside the box, exactly over the black ones */
  private placeInk(b: Box): void {
    const ink = this.inkRef?.nativeElement, nav = this.navRef?.nativeElement;
    if (!ink || !nav) return;
    ink.style.transform = `translate(${-b.x0}px, ${-b.y0}px)`;
    for (const label of Array.from(ink.children) as HTMLElement[]) {
      const btn = nav.querySelector<HTMLElement>(`.item[data-id="${label.dataset['id']}"]`);
      if (btn) label.style.transform = `translate(${btn.offsetLeft}px, ${btn.offsetTop}px)`;
    }
  }

  /** one 1/12 s frame: move the box, count */
  private tick(): void {
    this.tone();
    const active = this.active();
    const marker = this.markerRef?.nativeElement, counter = this.counterRef?.nativeElement;
    if (!marker || !counter || !active) return;
    const target = this.boxFor(active);
    if (!target) return;
    if (!this.box) {
      // just shown: the line is simply there
      this.box = target; this.at = active; this.frames = [];
    } else if (active !== this.at) {
      this.at = active;
      // (it sets off as the page does: update() takes the page the glide is going to)
      this.frames = this.flight(this.box, target);
    } else if (!this.frames.length) {
      // resting: follow the word (language switched, resized)
      this.box = target;
    }
    if (this.frames.length) this.box = this.frames.shift()!;

    const b = this.box;
    marker.style.transform = `translate(${b.x0}px, ${b.y0}px)`;
    marker.style.width = `${Math.max(0, b.x1 - b.x0)}px`;
    marker.style.height = `${Math.max(0, b.y1 - b.y0)}px`;
    this.placeInk(b);

    // the counter: beside the line once it has landed, counting to the page's progress
    const done = this.progress.get(active);
    const resting = !this.frames.length;
    if (done === undefined || !resting) {
      counter.style.visibility = 'hidden';
      this.shownCount = -1;
      return;
    }
    const want = Math.round(done * 100);
    if (this.shownCount < 0) this.shownCount = want;
    else if (this.shownCount !== want) {
      const d = want - this.shownCount;
      this.shownCount += Math.abs(d) <= 1 ? d : Math.sign(d) * Math.max(1, Math.round(Math.abs(d) * 0.45));
    }
    const g = this.grid();
    counter.textContent = `${this.shownCount}%`;
    counter.style.transform = `translate(${Math.round(b.x1 + 0.3 * g)}px, ${Math.round(b.y0)}px)`;
    counter.style.visibility = 'visible';
  }
}
