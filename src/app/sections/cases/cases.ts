import { AfterViewInit, Component, ElementRef, HostListener, NgZone, OnDestroy, afterEveryRender, computed, effect, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageService } from '../../_services/language.service';
import { PageScrollService } from '../../_services/page-scroll.service';
import { AnalyticsService } from '../../_services/analytics.service';
import { SectionProgressService } from '../../_services/section-progress.service';
import { CASES, CASE_TAGS, CaseItem, CaseTag, Txt } from './cases-data';
import { VideoBar } from './video-bar';
import { FadeIn, preloadImages } from '../../_directives/fade-in.directive';
import { BackdropService } from '../../_services/backdrop.service';
import { isDesktop, isPhone } from '../../_config/phone';

/**
 * Cases: one case at a time, laid out exactly like a slide of the pitch deck — the deck's
 * slide as a video, with the web text on top in the deck's places and type. The category
 * tabs (on the logo's row) choose which cases are shown. On desktop the page stands still and
 * each swipe shows the next case (as on the timeline); the side menu counts how far you are.
 * At the last case (or back at the first) the page moves on after a short rest.
 * A video plays from its start only once the page is in view (and stops when it leaves).
 */
@Component({
  selector: 'app-cases',
  imports: [TranslateModule, FadeIn],
  templateUrl: './cases.html',
  styleUrl: './cases.scss',
})
export class Cases implements AfterViewInit, OnDestroy {
  readonly tags = CASE_TAGS;
  /** categories switched on (all to start with) */
  readonly active = signal<Set<CaseTag>>(new Set(CASE_TAGS.map(t => t.tag)));
  readonly list = computed(() => CASES.filter(c => c.tags.some(t => this.active().has(t))));
  readonly index = signal(0);
  /** the category filters beside the title: shown, or hidden with the filter button */
  readonly filtersOpen = signal(true);
  readonly current = computed<CaseItem | null>(() => this.list()[Math.min(this.index(), this.list().length - 1)] ?? null);
  /** phones (Emil's mockup, 23 Oct): the case's text as many whole lines as fit above the
      square, the rest cut ("…") */
  @HostListener('window:resize')
  fitPhoneText(): void {
    if (!this.phone) return;
    // the name on one line: smaller as far as it must (Emil 23 Oct: Nottingham Student Dormitory)
    const name = this.host.nativeElement.querySelector<HTMLElement>('.stage.ph .ph-name');
    if (name && name.dataset['fit'] !== name.textContent + '|' + name.clientWidth) {
      name.style.removeProperty('font-size');
      const fs = parseFloat(getComputedStyle(name).fontSize);
      if (name.scrollWidth > name.clientWidth + .5) name.style.fontSize = `${Math.floor(fs * name.clientWidth / name.scrollWidth * 10) / 10 - .1}px`;
      name.dataset['fit'] = name.textContent + '|' + name.clientWidth;
    }
    const box = this.host.nativeElement.querySelector<HTMLElement>('.stage.ph .ph-text');
    const desc = box?.querySelector<HTMLElement>('.c-desc');
    if (!box || !desc) return;
    const lh = parseFloat(getComputedStyle(desc).lineHeight) || 16;
    const lines = String(Math.max(1, Math.floor((box.clientHeight - desc.offsetTop) / lh + .02)));
    if (desc.style.getPropertyValue('--lines') !== lines) desc.style.setProperty('--lines', lines);
  }

  /** phones: which case of how many, under the frame */
  readonly caseNo = computed(() => Math.min(this.index(), this.list().length - 1) + 1);

  /* ---- phones (Emil's sketch, 22 Oct): the title between two arrows, the text, and a square
     frame with the case's pictures one at a time (its own arrows). Each case gets a set of
     pictures made for it later; until then its video or still, then its drawings. */
  readonly phone = isPhone();
  readonly mediaIndex = signal(0);
  /** a logo that is a film (.mp4) rather than a picture */
  isFilm(src: string): boolean { return src.endsWith('.mp4'); }

  media(c: CaseItem): { src: string; video: boolean; main: boolean; poster?: string; pan?: number }[] {
    const out: { src: string; video: boolean; main: boolean; poster?: string; pan?: number }[] = [];
    if (c.phoneMedia) return c.phoneMedia.map((m, i) => ({ src: m.src, video: !!m.video, main: i === 0, poster: m.poster, pan: m.pan }));
    if (c.video) out.push({ src: c.video, video: true, main: true, poster: c.poster });
    else if (c.image) out.push({ src: c.image.src, video: false, main: true });
    for (const p of c.pieces ?? []) out.push({ src: p.src, video: !!p.video, main: false, poster: p.poster });
    return out;
  }
  shownMedia(c: CaseItem) {
    const all = this.media(c);
    return all.length ? all[this.mediaIndex() % all.length] : null;
  }
  stepMedia(c: CaseItem, d: number): void {
    const n = this.media(c).length;
    if (n > 1) this.mediaIndex.set((this.mediaIndex() + d + n) % n);
  }
  private readonly mediaFromStart = effect(() => { this.current(); this.mediaIndex.set(0); });

  /** told to this end: rest this long before the page moves on (down / back up) */
  private static readonly REST_MS = 1000;
  private static readonly REST_BACK_MS = 500;
  /** a case change plays this long; a new swipe can start the next one after it */
  private static readonly STEP_MS = 420;
  private restFrom = 0;
  private stepAt = 0;
  private unregister?: () => void;
  /** the frame is (almost) fully in view: videos play */
  private inView = false;
  private video: HTMLVideoElement | null = null;
  private observer?: IntersectionObserver;
  private nearObserver?: IntersectionObserver;

  constructor(
    private host: ElementRef<HTMLElement>,
    private pageScroll: PageScrollService,
    private analytics: AnalyticsService,
    private zone: NgZone,
    public lang: LanguageService,
    progress: SectionProgressService,
    private backdrop: BackdropService,
  ) {
    afterEveryRender(() => { this.markClipped(); this.syncVideo(); this.snapTabs(); this.fitPhoneText(); });
    // which case of how many, for the side menu's counter
    effect(() => {
      const n = this.list().length;
      progress.set('cases', n ? (Math.min(this.index(), n - 1) + 1) / n : undefined);
    });
  }

  /** each category tab a whole number of cells wide, at least half a cell free on each side
      of its word (at a cell's size the five fit beside the title), so every edge sits on the grid. Measured on the word itself, again whenever
      it changes size (the LCD font arriving, the language) */
  private tabsKey = '';
  private tabsObserver?: ResizeObserver;
  private snapTabs(): void {
    const tabs = Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>('.tabs .tab'));
    const g = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dynamic-grid-size')) || 0;
    if (!g || !tabs.length) return;
    const words = tabs.map(t => t.querySelector<HTMLElement>('.tab-label')?.getBoundingClientRect().width ?? 0);
    const key = `${g}|${words.map(w => w.toFixed(1)).join(',')}`;
    if (key === this.tabsKey) return;
    this.tabsKey = key;
    tabs.forEach((t, i) => t.style.width = `${Math.ceil((words[i] + g) / g - 0.01) * g}px`);
    if (!this.tabsObserver && typeof ResizeObserver !== 'undefined') {
      this.tabsObserver = new ResizeObserver(() => this.snapTabs());
      tabs.forEach(t => { const l = t.querySelector('.tab-label'); if (l) this.tabsObserver!.observe(l); });
    }
  }

  /** a new case's video: from its start if the page is in view, else it waits */
  private syncVideo(): void {
    const v = this.host.nativeElement.querySelector<HTMLVideoElement>('.case video.video');
    if (v === this.video) return;
    this.bar?.destroy();
    this.bar = undefined;
    this.video = v;
    if (v && this.preloaded) v.preload = 'auto';
    this.playPieces();
    if (this.inView || this.preloaded) this.warmNeighbours();
    if (!v) return;
    if (this.inView) this.play(v);
    const strip = v.parentElement?.querySelector<HTMLElement>('.scrub');
    if (strip) this.zone.runOutsideAngular(() => this.bar = new VideoBar(v, strip, () => this.inView,
      () => this.lang.currentLang() === 'de'
        ? { stop: 'klicken zum stoppen', play: 'klicken zum abspielen' }
        : { stop: 'press to stop', play: 'press to play' }));
  }

  /** the next case's video starts loading (kept off the page) once this one's can play
      through, and only while the page is in view: not the one before (going back is rarer),
      and not while the visitor is still on the pages above (Emil's 21 Oct audit: reaching
      the timeline already pulled ~8 MB of videos) */
  private warm = new Map<string, HTMLVideoElement>();
  private warmWait?: () => void;
  private warmNeighbours(): void {
    const list = this.list(), n = list.length;
    if (n < 2 || !this.inView) return;
    const cur = this.video;
    this.warmWait?.();
    this.warmWait = undefined;
    if (cur && cur.readyState < 4) {
      const go = () => { this.warmWait = undefined; this.warmNeighbours(); };
      cur.addEventListener('canplaythrough', go, { once: true });
      this.warmWait = () => cur.removeEventListener('canplaythrough', go);
      return;
    }
    const i = Math.min(this.index(), n - 1);
    const want = new Set([list[(i + 1) % n]?.video].filter((v): v is string => !!v));
    for (const [src, v] of this.warm) if (!want.has(src)) { v.removeAttribute('src'); v.load(); this.warm.delete(src); }
    for (const src of want) {
      if (this.warm.has(src) || src === this.video?.getAttribute('src')) continue;
      const v = document.createElement('video');
      v.muted = true; v.preload = 'auto'; v.src = src;
      this.warm.set(src, v);
    }
  }

  /** all the cases' pictures (stills, posters, marks), fetched ahead once the page is near */
  preloaded = false;
  private preloadPictures(): void {
    if (this.preloaded) return;
    this.preloaded = true;
    if (this.video) this.video.preload = 'auto';
    preloadImages(CASES.flatMap(c => [c.image?.src, c.poster, c.logo?.endsWith('.mp4') ? undefined : c.logo,
      ...(c.pieces ?? []).map(p => p.video ? p.poster : p.src)])
      .filter((s): s is string => !!s));
  }

  /** the time line under the current video (see video-bar.ts) */
  private bar?: VideoBar;

  /** the case's looping animations (pieces) run while the page is in view */
  private playPieces(): void {
    this.host.nativeElement.querySelectorAll<HTMLVideoElement>('.case video.piece, .case video.c-logo').forEach(p => {
      p.muted = true;
      if (this.inView) p.play().catch(() => { }); else p.pause();
    });
  }

  private play(v: HTMLVideoElement): void {
    v.muted = !this.soundOn();
    v.currentTime = 0;
    v.play().catch((e: unknown) => {
      // with sound not allowed (yet): muted, else it stays on its first frame
      if (!v.muted && (e as DOMException)?.name === 'NotAllowedError') { v.muted = true; v.play().catch(() => { }); }
    });
  }

  /** a film's sound, on / off (kept from film to film) */
  readonly soundOn = signal(false);
  toggleSound(): void {
    const on = !this.soundOn();
    this.soundOn.set(on);
    const v = this.video;
    if (!v) return;
    v.muted = !on;
    if (on && v.paused && this.inView) v.play().catch(() => { });
    this.analytics.trackAction(on ? 'case sound on' : 'case sound off');
  }

  /** a text longer than its place gets a fade at the bottom (class, not a signal: no re-render) */
  @HostListener('window:resize')
  markClipped(): void {
    const text = this.host.nativeElement.querySelector<HTMLElement>('.case .c-body');
    if (!text) return;
    text.classList.remove('clip');
    text.classList.toggle('clip', text.scrollHeight > text.clientHeight + 1);
  }

  ngAfterViewInit(): void {
    const section = this.host.nativeElement.querySelector('section') as HTMLElement | null;
    if (!section) return;
    const stage = section.querySelector('.stage');
    if (stage && typeof IntersectionObserver !== 'undefined') {
      // start when the frame has arrived (all of it in view, or filling the window), stop
      // once it is (nearly) gone
      this.observer = new IntersectionObserver(([e]) => {
        const full = e.intersectionRect.height >= Math.min(e.boundingClientRect.height, window.innerHeight) - 2;
        // coming near (a fifth of the frame in view): fetch the pictures and the next videos
        if (e.intersectionRatio > 0.2 && !this.preloaded) this.preloadPictures();
        if (!this.inView && full) {
          this.inView = true;
          this.warmNeighbours();
          if (this.video) this.play(this.video);
          this.playPieces();
        } else if (this.inView && e.intersectionRatio < 0.1) {
          this.inView = false;
          this.video?.pause();
          this.playPieces();
        }
      }, { threshold: Array.from({ length: 21 }, (_, i) => i / 20) });
      this.observer.observe(stage);
      // a window ahead (the timeline being read): the case's video and pictures start coming,
      // not at the page's first load
      this.nearObserver = new IntersectionObserver(([e]) => {
        if (!e.isIntersecting) return;
        this.nearObserver?.disconnect();
        this.preloadPictures();
      }, { rootMargin: '100% 0px' });
      this.nearObserver.observe(stage);
    }
    // the side menu floats over the frame: white or black there, as set for each case
    this.offBackdrop = this.backdrop.register((rects, ids) => {
      const tone = this.current()?.menu;
      const st = section.querySelector('.stage')?.getBoundingClientRect();
      return rects.map((r, i) => {
        if (!tone || !st) return undefined;
        const x = r.left + r.width / 2, y = r.top + r.height / 2;
        if (x < st.left || x > st.right || y < st.top || y > st.bottom) return undefined;
        return tone.white && !tone.except?.includes(ids[i]);
      });
    });
    this.unregister = this.pageScroll.registerStory({
      el: section,
      active: () => isDesktop() && this.list().length > 1,
      scroll: (px, fresh) => this.storyScroll(px, fresh),
      arrive: (dir, inMs) => this.zone.run(() => {
        // from above: the first case; from below: the last
        this.index.set(dir > 0 ? 0 : Math.max(0, this.list().length - 1));
        this.restFrom = performance.now() + inMs;
      }),
    });
  }

  private offBackdrop?: () => void;

  ngOnDestroy(): void {
    this.warmWait?.();
    this.nearObserver?.disconnect();
    this.offBackdrop?.();
    this.warm.forEach(v => { v.removeAttribute('src'); v.load(); });
    this.tabsObserver?.disconnect();
    this.unregister?.();
    this.observer?.disconnect();
    this.bar?.destroy();
  }

  tx(v: Txt | string): string {
    if (typeof v === 'string') return v;
    return this.lang.currentLang() === 'de' ? v.de : v.en;
  }

  /** "Year:  2021" — with the deck's two spaces after the colon (kept: white-space: pre) */
  meta(en: string, de: string, value: string): string {
    return `${this.lang.currentLang() === 'de' ? de : en}:\u00a0 ${value}`;
  }

  /** phones: a span of years short, "2022-26" (Emil 23 Oct: the line fits) */
  shortYears(y: string): string {
    return y.replace(/(\d{4})\s*-\s*(\d{2})(\d{2})/, (_, a: string, c: string, d: string) => a.slice(0, 2) === c ? `${a}-${d}` : `${a}-${c}${d}`);
  }

  isKey(v: Txt | string): v is string {
    return typeof v === 'string';
  }

  toggleTag(tag: CaseTag): void {
    const next = new Set(this.active());
    if (next.has(tag)) next.delete(tag); else next.add(tag);
    this.active.set(next);
    this.index.set(0);
    this.analytics.trackAction('case filter');
  }

  go(step: number): void {
    const n = this.list().length;
    if (!n) return;
    this.index.set((this.index() + step + n) % n);
    this.analytics.trackAction(step > 0 ? 'case next' : 'case prev');
  }

  /** desktop: scroll input while resting on the cases: true = used here (the page stays),
      false = the page may move on, a number = resting at this end, it may go in that many ms */
  private storyScroll(px: number, fresh: boolean): boolean | number {
    const now = performance.now(), T = Cases;
    const dir = Math.sign(px);
    const last = this.list().length - 1;
    const i = this.index();
    if (dir > 0 ? i >= last : i <= 0) {
      // at this end: let the page go once it has rested here
      const left = this.restFrom ? this.restFrom + (dir > 0 ? T.REST_MS : T.REST_BACK_MS) - now : 0;
      return left > 0 ? left : false;
    }
    if (!fresh || now - this.stepAt < T.STEP_MS) return true;   // one case per swipe
    this.stepAt = now;
    this.zone.run(() => this.index.set(i + dir));
    const landed = i + dir;
    this.restFrom = landed === 0 || landed === last ? now + T.STEP_MS : 0;
    return true;
  }
}
