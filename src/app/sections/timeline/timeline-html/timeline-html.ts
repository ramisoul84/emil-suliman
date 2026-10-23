import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, HostListener, effect, inject, output, signal, viewChild } from '@angular/core';
import { LanguageService } from '../../../_services/language.service';
import { ThemeService } from '../../../_services/theme.service';
import { recolorImage } from '../../../_services/recolor';
import { AXIS, BARS, CARDS, CONNECTORS, GRADUATION, HEADINGS, PLACE_FRAME, PLACES, ROWS, TlBar, TlSegment, Txt, YEARS, placeAt } from './timeline-data';
import { isPhone } from '../../../_config/phone';

/**
 * The timeline in HTML (it replaced the original After Effects animation).
 * The parent calls update() with the reading line (the middle of the window) measured in grid
 * cells from the top of the panel: everything above the line is shown, the bars and the axis
 * grow down to it — the same scroll behaviour as the original animation.
 */
@Component({
  selector: 'app-timeline-html',
  templateUrl: './timeline-html.html',
  styleUrl: './timeline-html.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimelineHtml {
  private host = inject(ElementRef<HTMLElement>);
  protected lang = inject(LanguageService);
  private theme = inject(ThemeService);

  /** Emil's own logo (the freelance card) in the site's colours */
  private static readonly ES_LOGO = 'assets/images/timeline/es.webp';
  readonly esLogo = signal(TimelineHtml.ES_LOGO);
  private readonly recolorLogo = effect(() => {
    const palette = this.theme.palette();
    recolorImage(TimelineHtml.ES_LOGO, palette).then(u => { if (this.theme.palette() === palette) this.esLogo.set(u); });
  });

  /** card titles are .9 of a cell; the few too long for their box come down just enough to
      fit (on every size of window, in both languages) */
  private readonly fitOnLang = effect(() => { this.lang.currentLang(); requestAnimationFrame(() => this.fitTitles()); });
  private readonly fitOnResize = (() => {
    if (typeof ResizeObserver === 'undefined') return;
    const fit = () => this.fitTitles();
    const ro = new ResizeObserver(fit);
    ro.observe(this.host.nativeElement);
    // measured again once the card font has arrived (its letters are wider than the fallback's)
    document.fonts?.ready.then(fit);
    document.fonts?.addEventListener?.('loadingdone', fit);
    inject(DestroyRef).onDestroy(() => { ro.disconnect(); document.fonts?.removeEventListener?.('loadingdone', fit); });
  })();
  private fitTitles(): void {
    const titles = (this.host.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.card .c-title');
    titles.forEach(p => p.style.removeProperty('font-size'));
    const range = document.createRange();
    titles.forEach(p => {
      range.selectNodeContents(p);
      const room = p.clientWidth, need = range.getBoundingClientRect().width;
      if (!room || need <= room) return;
      const fs = parseFloat(getComputedStyle(p).fontSize);
      p.style.fontSize = `${Math.floor(fs * room / need * 10) / 10 - .1}px`;
    });
  }

  /** phones: the story place by place like the desktop's, the places told fading back like
      its (Emil 22 Oct, again) */
  readonly phone = isPhone();

  readonly rows = ROWS;
  readonly headings = HEADINGS;
  readonly cards = CARDS;
  readonly bars = BARS;
  /** each bar's card (index in CARDS): a bar is drawn only once its card is shown */
  readonly barCard = BARS.map((_, i) => CARDS.findIndex(c => c.bar === i));
  /** arrows for bars that began before the axis (above) or are still going (below):
      separate from the bar, so they are never stretched while it grows */
  readonly caps = this.bars.map((b, i) => ({ b, i })).filter(({ b }) => b.cap).map(({ b, i }) => ({
    kind: b.kind, col: b.col, dir: b.cap!, bar: i, card: this.barCard[i], y0: b.y0, y1: b.y1,
  }));
  /** place → its order in the story (for fading the places already told) */
  readonly placeIndex = Object.fromEntries(PLACES.map((p, i) => [p, i])) as Record<string, number>;
  /** phones: the years' last two figures ('89, '13...: Emil 22 Oct) */
  readonly years = YEARS.map(y => ({ ...y, label: this.phone ? y.label.slice(2) : y.label }));
  readonly axis = AXIS;
  readonly graduation = GRADUATION;
  /**
   * Connectors drawn like the reference: the node on the axis grows first, then the line
   * draws out from the axis towards the heading (segments in reverse, each growing from its
   * axis-side end, timed by length), then the heading fades in where the line arrives.
   */
  /** phones: where a line bends up to its year (x, cells): Norway's a cell and Germany's two
      cells further right than drawn, clear of the longer cards and of each other (Emil 22 Oct) */
  private static readonly PHONE_BEND: Partial<Record<string, number>> = { norway: 16, ludwigshafen: 17 };
  private bend(c: (typeof CONNECTORS)[number]) {
    const to = this.phone ? TimelineHtml.PHONE_BEND[c.place] : undefined;
    if (to === undefined) return c;
    const mv = (x: number) => x === 15 ? to : x;
    return { ...c, segments: c.segments.map(s => ({ ...s, x0: mv(s.x0), x1: mv(s.x1) })) };
  }
  readonly connectors = CONNECTORS.map(c => this.bend(c)).map(c => {
    const F = 1 / 12;                       // one frame at 12 fps
    let t = c.node ? 2 * F : 0;               // the node grows first (2 frames)
    const segs = [...c.segments].reverse().map(s => {
      const g = this.seg(s);
      const n = Math.max(1, Math.round(g.len / 5.4));   // about 5.4 cells per frame
      const seg = { ...g, delay: t, dur: n * F, n };
      t += n * F;
      return seg;
    });
    return { at: c.at, node: c.node, until: c.until, segs, total: t };
  });
  /** heading fade-in waits for its connector line: it starts on the line's last frame */
  headingDelay(at: number): number {
    const total = this.connectors.find(c => c.at === at)?.total ?? 0;
    return Math.max(0, total - 1 / 12);
  }

  /** the clicked card (index in CARDS), or null */
  readonly selected = signal<number | null>(null);
  /** the opened card's text box: above the card when there is no room under it */
  readonly openUp = signal(false);
  /** ...and its height in whole cells, measured from its text */
  readonly moreRows = signal(4);
  private moreText = viewChild<ElementRef<HTMLElement>>('moreText');
  /** map frame to show for the selected card's place, or null to follow the scroll again */
  readonly place = output<number | null>();
  /** a card of a place already told was clicked: the story goes back there (its place) */
  readonly goTo = output<string>();

  private items?: { el: HTMLElement; at: number; time: boolean }[];
  private placed?: { el: HTMLElement; i: number }[];
  private growers?: { el: HTMLElement; y0: number; y1: number; card: number; grow?: number }[];
  private lastLine = NaN;
  private lastTick = 0;
  private pendingLine = NaN;
  private tickTimer: any = 0;

  /** an axis-aligned connector segment as position + length in cells (lines are 2px, centred on the grid line) */
  seg(s: TlSegment) {
    const v = s.x0 === s.x1;
    const x = Math.min(s.x0, s.x1);
    return {
      v,
      x,
      // the panel is wider than the original 25 cells: the left edge (x = 0, the headings)
      // stays left, everything else (bends, axis) moves with the right side
      ra: x === 0 ? 0 : 1,
      x2: Math.max(s.x0, s.x1),
      y: Math.min(s.y0, s.y1),
      len: v ? Math.abs(s.y1 - s.y0) : Math.abs(s.x1 - s.x0),
      // grow from the axis end of the segment (x1, y1) back towards the heading
      origin: v ? (s.y1 >= s.y0 ? 'bottom' : 'top') : (s.x1 >= s.x0 ? 'right' : 'left'),
    };
  }

  private releaseTimer: any = 0;

  /** mouse left the selected card: let go after 2 s (cancelled if the mouse comes back) */
  leave(i: number, e: PointerEvent): void {
    if (e.pointerType !== 'mouse' || this.selected() !== i) return;
    clearTimeout(this.releaseTimer);
    this.releaseTimer = setTimeout(() => {
      if (this.selected() === i) this.toggle(i);
    }, 2000);
  }

  enter(i: number): void {
    if (this.selected() === i) clearTimeout(this.releaseTimer);
  }

  /** click / Enter on a card (or on its time bar): open it — its time span, its place on the
      map and its text; again (or the close button) to let go. A card of a place already told
      (faded) first takes the story back to that place; a second click opens it there. */
  toggle(i: number): void {
    if (i < 0) return;
    if (this.selected() !== i && this.isPast(i)) {
      if (this.selected() !== null) { this.selected.set(null); this.place.emit(null); }
      clearTimeout(this.releaseTimer);
      this.goTo.emit(this.cards[i].place);
      return;
    }
    clearTimeout(this.releaseTimer);
    const next = this.selected() === i ? null : i;
    if (next !== null) this.placeMore(next);
    this.selected.set(next);
    this.place.emit(next === null ? null : PLACE_FRAME[this.cards[next].place]);
  }

  /** the opened card's box fits its whole text (whole cells), measured whenever the text is
      laid out (a new card, a language, the window), and opens where there is room for it */
  private moreObserver?: ResizeObserver;
  private readonly fitMore = effect(() => {
    const p = this.moreText()?.nativeElement;
    this.moreObserver?.disconnect();
    if (!p || typeof ResizeObserver === 'undefined') return;
    this.moreObserver = new ResizeObserver(() => {
      const g = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dynamic-grid-size')) || 21;
      const rows = Math.max(3, Math.ceil((p.offsetHeight + 2) / g));
      this.moreRows.set(rows);
      const i = this.selected();
      if (i !== null) this.placeMore(i, rows);
    });
    this.moreObserver.observe(p);
  });
  private readonly stopFitMore = inject(DestroyRef).onDestroy(() => this.moreObserver?.disconnect());

  /** a card of a place already told (faded back) */
  private isPast(i: number): boolean {
    const now = this.placeIndex[placeAt(Number.isNaN(this.lastLine) ? 0 : this.lastLine)] ?? 0;
    return (this.placeIndex[this.cards[i].place] ?? 0) < now;
  }

  /** open the text box under the card, or over it when the window ends too soon below */
  private placeMore(i: number, rows = 6): void {
    const root: HTMLElement = this.host.nativeElement;
    const card = root.querySelectorAll<HTMLElement>('.card')[i];
    const win = root.closest('.tl-window') as HTMLElement | null;
    if (!card) return;
    const g = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dynamic-grid-size')) || 21;
    const w = win?.getBoundingClientRect();
    const top = Math.max(0, w?.top ?? 0), bottom = Math.min(window.innerHeight, w?.bottom ?? Infinity);
    const c = card.getBoundingClientRect();
    // under the card it starts 5 cells below its top; over it, it ends 5 cells above its bottom
    const below = bottom - (c.top + 5 * g), above = c.bottom - 5 * g - top;
    this.openUp.set(rows * g > below && above > below);
  }

  /** a click anywhere but on a card or a time bar lets the opened card go */
  @HostListener('document:click', ['$event'])
  clickAway(e: MouseEvent): void {
    if (this.selected() === null) return;
    const t = e.target instanceof Element ? e.target : null;
    if (t?.closest('.card, .bar')) return;
    clearTimeout(this.releaseTimer);
    this.selected.set(null);
    this.place.emit(null);
  }

  /** the selected card's bar (for the highlight on the axis) */
  selBar(): TlBar | null {
    const i = this.selected();
    return i === null ? null : this.bars[this.cards[i].bar];
  }

  inSpan(y: number): boolean {
    const b = this.selBar();
    return !!b && y >= b.y0 - 0.01 && y <= b.y1 + 0.01;
  }

  tx(v: Txt): string {
    return this.lang.currentLang() === 'de' ? v.de : v.en;
  }

  /**
   * @param line reading line in grid cells from the panel top (cards and headings).
   * @param time how far the time line (axis, years, bars, arrows) is drawn; the same as line
   * unless the story is told place by place.
   * Applied at most 12 times a second (the timeline's frame rate); the latest value always lands.
   */
  private pendingTime = NaN;
  private lastTime = NaN;

  update(line: number, time: number = line): void {
    const frame = 1000 / 12;
    const now = performance.now();
    if (now - this.lastTick < frame) {
      this.pendingLine = line;
      this.pendingTime = time;
      this.tickTimer ||= setTimeout(() => {
        this.tickTimer = 0;
        this.update(this.pendingLine, this.pendingTime);
      }, frame - (now - this.lastTick));
      return;
    }
    this.lastTick = now;
    if (Math.abs(line - this.lastLine) < 0.01 && Math.abs(time - this.lastTime) < 0.01) return;
    this.lastLine = line;
    this.lastTime = time;
    const root: HTMLElement = this.host.nativeElement;
    this.items ??= Array.from(root.querySelectorAll<HTMLElement>('[data-at]'))
      .map(el => ({ el, at: parseFloat(el.dataset['at'] || '0'), time: el.hasAttribute('data-time') }));
    this.growers ??= Array.from(root.querySelectorAll<HTMLElement>('[data-y0]'))
      .map(el => ({
        el, y0: parseFloat(el.dataset['y0'] || '0'), y1: parseFloat(el.dataset['y1'] || '0'),
        card: el.dataset['card'] ? parseInt(el.dataset['card'], 10) : -1,
      }));

    for (const it of this.items) it.el.classList.toggle('on', (it.time ? time : line) >= it.at);

    // the places already told fade back: the time line stays, the current place reads
    // (a country's heading and line stay lit until its last city is told)
    this.placed ??= Array.from(root.querySelectorAll<HTMLElement>('[data-place]'))
      .map(el => ({ el, i: this.placeIndex[el.dataset['place'] || ''] ?? 0 }));
    const now_ = this.placeIndex[placeAt(line)] ?? 0;
    for (const p of this.placed) p.el.classList.toggle('past', p.i < now_);
    // moving on to the next place closes a card left open in the one before
    const open = this.selected();
    if (open !== null && this.isPast(open)) {
      this.selected.set(null);
      this.place.emit(null);
    }

    // let go of a selected card once it has been scrolled out of view
    const sel = this.selected();
    if (sel !== null) {
      const card = root.querySelectorAll<HTMLElement>('.card')[sel];
      const r = card?.getBoundingClientRect();
      if (!r || r.bottom < 0 || r.top > window.innerHeight) {
        this.selected.set(null);
        this.place.emit(null);
      }
    }
    for (const g of this.growers) {
      // grows in whole grid cells — a card's bar (and its arrow) only once the card is shown
      const shown = g.card < 0 || line >= this.cards[g.card].y + 2;
      const grow = shown ? Math.max(0, Math.min(1, Math.floor(time - g.y0) / (g.y1 - g.y0))) : 0;
      // only what changed is touched: each write restyles its element
      if (grow === g.grow) continue;
      g.grow = grow;
      g.el.style.setProperty('--grow', grow.toFixed(4));
      g.el.classList.toggle('on', grow > 0);
      g.el.classList.toggle('full', grow >= 1);
    }
  }
}
