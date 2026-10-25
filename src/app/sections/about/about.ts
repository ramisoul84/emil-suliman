import { AfterViewInit, Component, ElementRef, HostListener, NgZone, OnDestroy, Pipe, PipeTransform, ViewChild, effect, inject, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { AnalyticsService } from '../../_services/analytics.service';
import { Palette, ThemeService } from '../../_services/theme.service';
import { COLLAGE_SPRITES as SPRITES, PHONE_SPRITES, RecolorSource, warmCollage } from '../../_services/recolor';
import { isDesktop, isPhone } from '../../_config/phone';
import { Parallax } from './parallax';


type Topic = { key: 'urban' | 'arch' | 'story' | 'personal'; label: string; text: string };

/** Turns the "<br/><br/>" breaks in the about texts into real paragraphs (tighter spacing). */
@Pipe({ name: 'paragraphs' })
export class ParagraphsPipe implements PipeTransform {
  transform(html: string | null | undefined): string {
    if (!html) return '';
    return html.split(/(?:<br\s*\/?>\s*){2,}/i).map(p => `<p>${p}</p>`).join('');
  }
}

/**
 * About section: photo, text panel and the HTML/CSS word collage on the page grid.
 * The topics take turns every 4 s while the page is in view: the text switches and the
 * words of that topic are tinted. Picking the tree / house / camera / duck (or the arrows)
 * shows that topic at once and keeps it 8 s. Design reference: 9999.mp4.
 */
@Component({
  selector: 'app-about',
  imports: [TranslateModule, ParagraphsPipe],
  templateUrl: './about.html',
  styleUrl: './about.scss',
})
export class About implements AfterViewInit, OnDestroy {
  @ViewChild('reveal') reveal?: ElementRef<HTMLVideoElement>;

  /** phones (Emil 22 Oct): three topics, without urban development, in the order of the
      symbols there (ttt.mp4: the house, the camera, the duck) */
  readonly phone = isPhone();
  readonly topics: Topic[] = (this.phone ? [
    { key: 'arch', label: 'ABOUT.ARCH-BTN', text: 'ABOUT.ARCH' },
    { key: 'story', label: 'ABOUT.VIS-BTN', text: 'ABOUT.VIS' },
    { key: 'personal', label: 'ABOUT.EXP-BTN', text: 'ABOUT.EXP' },
    // urban development too, the fourth frame (Emil 23 Oct)
    { key: 'urban', label: 'ABOUT.URBAN-BTN', text: 'ABOUT.URBAN' },
  ] : [
    { key: 'arch', label: 'ABOUT.ARCH-BTN', text: 'ABOUT.ARCH' },
    // the duck's words (colours, light, sound, media architecture, film...): experience design
    { key: 'personal', label: 'ABOUT.EXP-BTN', text: 'ABOUT.EXP' },
    { key: 'story', label: 'ABOUT.VIS-BTN', text: 'ABOUT.VIS' },
    { key: 'urban' as const, label: 'ABOUT.URBAN-BTN', text: 'ABOUT.URBAN' },
  ]) as Topic[];

  /** phones: the photo pressed shows the intro over it, the photo faded back (Emil 22 Oct) */
  readonly introOpen = signal(false);

  /** phones: the symbols in a row, in the topics' order; each one's picture, its size in the
      collage (cells), how much bigger it is on the phone, so each is drawn as tall as in Emil's
      ttt.mp4 (the house 4.9 cells, the camera 4, the duck 4.3), and the empty room under the
      drawing in its picture (cells), so all three stand on one line */
  readonly symbols: Record<Topic['key'], { cls: string; w: number; h: number; k: number; b: number; dx?: number;
    /** phones, in its frame (Emil's mockup, 23 Oct): the picture's left, top and height, cells */
    card: [number, number, number] }> = {
    // the house 10% bigger in its frame, around the same middle (Emil 23 Oct; it was 4.31 tall)
    arch: { cls: 's-house', w: 5.684, h: 4.394, k: 1.47, b: .54, card: [.95, .70, 4.74] },
    // the duck and the camera a cell further right (Emil 22 Oct)
    personal: { cls: 's-duck', w: 4.542, h: 3.116, k: 1.886, b: .64, dx: 1, card: [.19, .32, 4.96] },
    story: { cls: 's-cam', w: 3.745, h: 2.876, k: 1.682, b: .49, dx: 1, card: [1.36, 1.28, 3.81] },
    // the tree as tall as the others (its drawing is small in its picture)
    urban: { cls: 's-tree', w: 3.878, h: 3.595, k: 1.8, b: .48, card: [.99, .76, 4.82] },
  };
  /* ---- phones (Emil's sketches, 23 Oct): the four topics in frames under the photo, all the
     same size, each its symbol, a + and its name; tapped, a frame opens over the others to
     its whole text (they stay where they are underneath, nothing else moves), in 3 frames at
     12 fps; tapped again (−), it folds back ---- */
  readonly openTopic = signal<number | null>(null);
  /** the one folding back: over the others until it has */
  readonly closingTopic = signal<number | null>(null);
  /** the open frame: its top (cells from the first frame's) and height (whole cells) */
  readonly openTop = signal(0);
  readonly openRows = signal(6);
  private closeTimer = 0;
  /** opening and folding: 6 frames at 12 fps, eased in and out (Emil 23 Oct) */
  private static readonly FOLD_MS = 500;

  toggleTopic(i: number): void {
    const was = this.openTopic();
    clearTimeout(this.closeTimer);
    if (was !== null) {
      this.closingTopic.set(was);
      this.closeTimer = window.setTimeout(() => this.closingTopic.set(null), About.FOLD_MS);
    }
    if (was === i) { this.openTopic.set(null); return; }
    const card = this.host.nativeElement.querySelectorAll<HTMLElement>('.ph-card-btn')[i];
    if (!card) return;
    const g = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dynamic-grid-size')) || 13;
    const R = parseFloat(getComputedStyle(card).getPropertyValue('--card-rows')) || 6;
    const text = card.querySelector<HTMLElement>('.ph-text')!;
    // as tall as its whole text needs, whole cells; where it is, or up as far as it must so it
    // ends with the last frame
    const rows = R + Math.ceil(text.offsetHeight / g + .8 - .05);
    const n = this.topics.length, all = n * R + n - 1, own = i * (R + 1);
    let top = Math.max(0, Math.min(own, all - rows)), bottom = top + rows;
    // its edges never half across another frame: out to that frame's edge, so no cut name
    // shows under it
    const inside = (y: number) => { const k = Math.floor(y / (R + 1)); const a = k * (R + 1); return y > a && y < a + R ? k : -1; };
    if (inside(top) >= 0) top = inside(top) * (R + 1);
    if (inside(bottom) >= 0) bottom = inside(bottom) * (R + 1) + R;
    this.openRows.set(bottom - top);
    this.openTop.set(top);
    this.openTopic.set(i);
    this.analytics.trackAction(`about ${this.topics[i].key}`);
  }

  /** a tap anywhere else folds the open frame back */
  @HostListener('document:click', ['$event'])
  tapAway(e: MouseEvent): void {
    const i = this.openTopic();
    if (i === null || (e.target instanceof Element && e.target.closest('.ph-card-btn'))) return;
    this.toggleTopic(i);
  }

  /** the frames' height, whole cells: the four, a cell apart, fill the window under the photo
      (5 to 8 cells each) */
  private sizeCards(): void {
    const layout = this.host.nativeElement.querySelector<HTMLElement>('.about-layout');
    if (!layout || !this.phone) return;
    const g = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dynamic-grid-size')) || 13;
    const rows = Math.floor(window.innerHeight / g + .001);
    const n = this.topics.length;
    // the title (4), a cell, the photo (15), a cell; a cell between the frames and under them
    const each = Math.max(5, Math.min(8, Math.floor((rows - 21 - 1 - (n - 1)) / n)));
    layout.style.setProperty('--card-rows', String(each));
  }
  private offCardResize?: () => void;

  /** topic shown in the text panel */
  readonly index = signal(0);
  /** the topic whose text is on screen: it follows index after the old text has faded out */
  readonly shown = signal(0);
  readonly fading = signal(false);
  private fadeTimer = 0;
  private static readonly FADE_MS = 300;   // the 3-frame fade (12 fps) has finished
  /** topic whose words are tinted in the collage (none until the visitor picks one) */
  readonly active = signal<Topic['key'] | null>(null);
  /** arriving: none lit while the symbols lift (instead of active; null: active shows) */
  readonly lit = signal<Topic['key'] | 'none' | null>(null);
  /** the collage's tutorial line: there while the symbols are lifted (3 s) on arriving */
  readonly hint = signal(false);
  private hintTimer = 0;
  private litTimers: number[] = [];

  /** the reveal video is a VP9 WebM with transparency, which Safari can't play */
  readonly canPlayReveal =
    typeof navigator !== 'undefined' &&
    !/iPad|iPhone|iPod/.test(navigator.userAgent) &&
    !/^((?!chrome|android).)*safari/i.test(navigator.userAgent);

  private observer?: IntersectionObserver;

  /* ---- the photo in depth with the mouse (desktop, Emil 25 Oct: parallax.ts) ---- */
  @ViewChild('depth') depthEl?: ElementRef<HTMLElement>;
  private readonly zone = inject(NgZone);
  private depth?: Parallax;
  private depthObserver?: IntersectionObserver;
  private depthLoaded?: Promise<void>;
  /** the reveal has played (or there is none): the layers may show over it */
  private revealDone = false;
  private photoInView = false;
  private setupDepth(): void {
    const el = this.depthEl?.nativeElement;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const mouse = window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;
    if (!el || this.phone || !isDesktop() || reduce || !mouse || !('IntersectionObserver' in window)) return;
    this.depth = new Parallax(el);
    this.revealDone = !this.reveal;
    this.reveal?.nativeElement.addEventListener('ended', () => { this.revealDone = true; this.startDepth(); }, { once: true });
    // the layers load when the photo comes into view (while the reveal plays over it); the
    // effect runs only while it is in view
    this.depthObserver = new IntersectionObserver(([e]) => {
      this.photoInView = e.isIntersecting;
      if (e.isIntersecting) this.loadDepth(el).then(() => this.startDepth());
      else this.depth?.pause();
    });
    this.depthObserver.observe(el);
  }
  private loadDepth(el: HTMLElement): Promise<void> {
    return this.depthLoaded ??= Promise.all([['.depth-back', 'emil-bg'], ['.depth-front', 'emil-fg']].map(([sel, name]) => {
      const img = el.querySelector<HTMLImageElement>(sel)!;
      img.src = `assets/images/parallax/${name}.webp`;
      return img.decode().catch(() => { /* no layer: the photo underneath stays */ });
    })).then(() => undefined);
  }
  private startDepth(): void {
    // its pointer listener and frames outside Angular: they only restyle the two layers
    if (this.revealDone && this.photoInView) this.zone.runOutsideAngular(() => this.depth?.start());
  }

  /** while the page is in view the topics take turns: the next one every 4 s; one picked by
      hand (a symbol or the arrows) stays 8 s before they go on */
  private static readonly TURN_MS = 4000;
  private static readonly PICKED_MS = 8000;
  private turnTimer = 0;
  private inView = false;
  private sectionObserver?: IntersectionObserver;
  private motionObserver?: IntersectionObserver;

  /* ---- the text, desktop: it ends half a cell above the collage (16.5 cells below the panel's
     top); a longer one is cut at a word, with "…" (the full text comes back on a resize) */
  private static readonly TEXT_END = 16.5;
  private fullText = '';
  private fitting = false;
  private textWatch?: MutationObserver;
  private offResize?: () => void;

  private fitText(): void {
    const panel = this.host.nativeElement.querySelector<HTMLElement>('.panel');
    const text = panel?.querySelector<HTMLElement>('.text');
    if (!panel || !text) return;
    this.fitting = true;
    try {
      if (this.fullText && text.innerHTML !== this.fullText) text.innerHTML = this.fullText;
      if (!isDesktop()) return;
      const g = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dynamic-grid-size')) || 21;
      const limit = panel.getBoundingClientRect().top + About.TEXT_END * g;
      const fits = () => text.getBoundingClientRect().bottom <= limit + .5;
      if (fits()) return;
      const ps = Array.from(text.querySelectorAll('p'));
      // whole paragraphs that start past the end go; the last one left is cut at a word
      while (ps.length > 1 && ps[ps.length - 1].getBoundingClientRect().top >= limit - g) ps.pop()!.remove();
      const last = ps[ps.length - 1];
      if (!last) return;
      const words = (last.textContent ?? '').split(/\s+/);
      const cut = (n: number) => words.slice(0, n).join(' ').replace(/[\s,;:.–—-]+$/, '') + '…';
      let lo = 0, hi = words.length;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        last.textContent = cut(mid);
        if (fits()) lo = mid; else hi = mid - 1;
      }
      last.textContent = cut(lo);
    } finally {
      this.textWatch?.takeRecords();      // its own changes are not a new text
      this.fitting = false;
    }
  }
  /** the collage all in view (the page reached): the symbols lift */
  private arriveObserver?: IntersectionObserver;
  private arriveTimer = 0;

  constructor(private analytics: AnalyticsService, private theme: ThemeService, private host: ElementRef<HTMLElement>) {
    // the duck, house, camera and tree in the site's colours, as soon as they change
    effect(() => this.paintSprites(this.theme.palette()));
  }

  private viewReady = false;

  /** draw the sprite sheets in the palette (Emil's own colours: the original pictures) */
  private paintSprites(palette: Palette): void {
    if (!this.viewReady) return;
    const plain = this.theme.isDefault(palette);
    for (const [cls, url] of SPRITES) {
      // the collage's and (phones) the row of squares'
      this.host.nativeElement.querySelectorAll<HTMLElement>('.' + cls).forEach(el => {
        const canvas = el.querySelector('canvas');
        if (!canvas) return;
        if (plain) { el.classList.remove('recolored'); return; }
        // phones' frames: the pictures without the collage's lines and dots over them
        const sheet = el.closest('.ph-band') ? PHONE_SPRITES[cls] ?? url : url;
        RecolorSource.load(sheet).then(src => {
          if (!src || this.theme.palette() !== palette) return;   // changed again meanwhile
          src.draw(canvas, palette);
          el.classList.add('recolored');
        });
      });
    }
  }

  ngAfterViewInit(): void {
    this.setupDepth();
    // phones: the topic frames fill the window under the photo
    if (this.phone) {
      this.sizeCards();
      let raf = 0;
      const resize = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => this.sizeCards()); };
      window.addEventListener('resize', resize);
      this.offCardResize = () => { window.removeEventListener('resize', resize); cancelAnimationFrame(raf); };
    }
    // the text cut to its room: each time Angular puts a new one in (topic, language), the
    // fonts arriving and the window changing size
    const text = this.host.nativeElement.querySelector<HTMLElement>('.panel .text');
    if (text) {
      this.fullText = text.innerHTML;
      this.textWatch = new MutationObserver(() => {
        if (this.fitting) return;
        this.fullText = text.innerHTML;
        this.fitText();
      });
      this.textWatch.observe(text, { childList: true, subtree: true, characterData: true });
      document.fonts?.ready.then(() => this.fitText());
      let pending = 0;
      const onResize = () => { cancelAnimationFrame(pending); pending = requestAnimationFrame(() => this.fitText()); };
      window.addEventListener('resize', onResize);
      this.offResize = () => { window.removeEventListener('resize', onResize); cancelAnimationFrame(pending); };
      this.fitText();
    }
    // "reduce motion": the pulsing squares (SVG animations) hold still like the rest
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      this.host.nativeElement.querySelectorAll<SVGSVGElement>('svg.pulse').forEach(svg => svg.pauseAnimations());
    }
    this.viewReady = true;
    this.paintSprites(this.theme.palette());
    // other colours chosen: get the sheets ready while the browser is idle
    if (!this.theme.isDefault()) {
      (window as any).requestIdleCallback ? (window as any).requestIdleCallback(warmCollage) : setTimeout(warmCollage, 500);
    }
    const reduceMotion = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    // the topics take turns while the page is in view
    const section = this.host.nativeElement.querySelector('#about');
    // the collage's moving pieces only move while some of it is in the window
    if (section && 'IntersectionObserver' in window) {
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      this.motionObserver = new IntersectionObserver(([e]) => {
        section.classList.toggle('still', !e.isIntersecting);
        if (reduce) return;
        this.host.nativeElement.querySelectorAll<SVGSVGElement>('svg.pulse')
          .forEach(svg => e.isIntersecting ? svg.unpauseAnimations() : svg.pauseAnimations());
      });
      this.motionObserver.observe(section);
    }
    if (section && 'IntersectionObserver' in window) {
      this.sectionObserver = new IntersectionObserver(entries => {
        const seen = entries.some(e => e.isIntersecting);
        if (seen === this.inView) return;
        this.inView = seen;
        if (seen) {
          // tint the words (with motion the arrival does it: after the symbols' pulse)
          if (!this.active() && reduceMotion) this.active.set(this.topics[this.index()].key);
          this.nextTurn(About.TURN_MS);
        } else {
          clearTimeout(this.turnTimer);
        }
      }, { threshold: 0.35 });
      this.sectionObserver.observe(section);
    }
    const stage = this.host.nativeElement.querySelector<HTMLElement>('.stage');
    if (stage && 'IntersectionObserver' in window && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      let shown = false;
      // once the page has come to rest (the window has stopped moving for a moment)
      const whenStill = (last: number) => {
        this.arriveTimer = window.setTimeout(() => {
          if (!shown) return;
          if (Math.abs(window.scrollY - last) > 0.5) { whenStill(window.scrollY); return; }
          stage.classList.remove('arrive');
          void stage.offsetWidth;                 // start again if it was still on
          stage.classList.add('arrive');
          // the line goes as the symbols come down (their last 3 frames, about.scss)
          this.hint.set(true);
          clearTimeout(this.hintTimer);
          this.hintTimer = window.setTimeout(() => this.hint.set(false), 2750);
          this.runThrough();
          this.arriveTimer = window.setTimeout(() => stage.classList.remove('arrive'), 3100);
        }, 90);
      };
      this.arriveObserver = new IntersectionObserver(([e]) => {
        if (e.intersectionRatio >= 0.9 && !shown) {
          shown = true;
          clearTimeout(this.arriveTimer);
          whenStill(window.scrollY);
        } else if (!e.isIntersecting) {
          shown = false;                          // the page left: next time again
        }
      }, { threshold: [0, 0.9] });
      this.arriveObserver.observe(stage);
    }
    const video = this.reveal?.nativeElement;
    if (!video || !('IntersectionObserver' in window)) return;
    // play the reveal once when the photo first comes into view
    this.observer = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) {
        this.observer?.disconnect();
        this.playReveal();
      }
    }, { threshold: 0.4 });
    this.observer.observe(video);
  }

  pick(key: Topic['key']): void {
    clearTimeout(this.hintTimer);
    this.hint.set(false);
    this.stopRunThrough();
    // picked by hand: it stays a while (picking it again keeps it longer)
    this.nextTurn(About.PICKED_MS);
    if (this.active() === key) return;
    this.index.set(this.topics.findIndex(t => t.key === key));
    this.active.set(key);
    this.analytics.trackAction(`about ${key}`);
  }

  step(direction: 1 | -1): void {
    this.stopRunThrough();
    this.show((this.index() + direction + this.topics.length) % this.topics.length);
    this.nextTurn(About.PICKED_MS);
    this.analytics.trackAction(`about ${this.topics[this.index()].key}`);
  }

  private show(i: number): void {
    this.index.set(i);
    this.active.set(this.topics[i].key);
  }

  /** the text follows the topic: fade out, change, fade in (12 fps, CSS .swap) */
  private readonly textFollows = effect(() => {
    const i = this.index();
    const shown = this.shown();
    if (i === shown) return;
    clearTimeout(this.fadeTimer);
    this.fading.set(true);
    this.fadeTimer = window.setTimeout(() => {
      this.shown.set(this.index());
      this.fading.set(false);
    }, About.FADE_MS);
  });

  /** the next topic's turn, in ms (only while the page is in view) */
  private nextTurn(ms: number): void {
    clearTimeout(this.turnTimer);
    if (!this.inView || this.phone) return;
    this.turnTimer = window.setTimeout(() => {
      this.show((this.index() + 1) % this.topics.length);
      this.nextTurn(About.TURN_MS);
    }, ms);
  }

  /** arriving (12 fps): the four symbols lift (about.scss) with nothing lit; 9 frames on,
      architecture (its words and text); the turns go on */
  private runThrough(): void {
    this.stopRunThrough();
    clearTimeout(this.turnTimer);
    this.lit.set('none');
    this.litTimers.push(window.setTimeout(() => {
      this.lit.set(null);
      this.show(this.topics.findIndex(t => t.key === 'arch'));
      this.nextTurn(About.TURN_MS);
    }, 9 * 1000 / 12));
  }

  private stopRunThrough(): void {
    this.litTimers.forEach(t => clearTimeout(t));
    this.litTimers = [];
    if (this.lit() === null) return;
    this.lit.set(null);
    if (!this.active()) this.active.set(this.topics[this.index()].key);
  }

  private playReveal(): void {
    const video = this.reveal?.nativeElement;
    if (!video) return;
    video.currentTime = 0;
    video.play().catch(() => { /* autoplay blocked: the photo underneath stays visible */ });
  }

  ngOnDestroy(): void {
    this.depthObserver?.disconnect();
    this.depth?.destroy();
    clearTimeout(this.closeTimer);
    this.offCardResize?.();
    this.textWatch?.disconnect();
    this.offResize?.();
    this.observer?.disconnect();
    this.sectionObserver?.disconnect();
    this.motionObserver?.disconnect();
    this.arriveObserver?.disconnect();
    clearTimeout(this.arriveTimer);
    clearTimeout(this.hintTimer);
    this.litTimers.forEach(t => clearTimeout(t));
    clearTimeout(this.turnTimer);
    clearTimeout(this.fadeTimer);
  }
}
