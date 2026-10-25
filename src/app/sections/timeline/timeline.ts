import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, HostListener, NgZone, OnDestroy, OnInit, ViewChild, effect, inject, untracked } from '@angular/core';
import { GridService } from '../../_services/grid.service';
import type { AnimationItem } from 'lottie-web';
import { BlurService } from '../../_services/blur.service';
import { Subject, takeUntil } from 'rxjs';
import { TimelineHtml } from './timeline-html/timeline-html';
import { CARDS, HEADINGS, PLACE_FRAME, PLACES, ROWS, STORY_STOPS, TIME_STOPS, placeAt } from './timeline-html/timeline-data';
import { PageScrollService } from '../../_services/page-scroll.service';
import { LanguageService } from '../../_services/language.service';
import { SectionProgressService } from '../../_services/section-progress.service';
import { DEFAULT_PALETTE, ThemeService } from '../../_services/theme.service';
import { recolorLottie } from '../../_services/recolor';
import { DATA_VERSION } from '../../_config/data-version';
import { isDesktop, isPhone } from '../../_config/phone';
import { PhonePagerService } from '../../_services/phone-pager.service';
import { GERMANY_FROM, Mark, PLACE_NAMES, SYRIA_ID, cityMarkId, germanLeg, litCountries, routeState, withCityMarks } from './map-cities';

/** the site's first two colours as they are by default (0..1): the lit countries' gradient,
    mapped to the chosen palette by recolorLottie like the rest of the map */
const rgb01 = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
const DEFAULT_GREENS: [number[], number[]] = [rgb01(DEFAULT_PALETTE[0]), rgb01(DEFAULT_PALETTE[1])];

@Component({
  selector: 'app-timeline',
  imports: [CommonModule, TimelineHtml],
  templateUrl: './timeline.html',
  styleUrl: './timeline.scss',
})
export class Timeline implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('timelineSection') timelineSection!: ElementRef;
  @ViewChild('mapSection') mapSection!: ElementRef;
  @ViewChild('htmlTimeline') htmlTimeline?: TimelineHtml;
  @ViewChild('mapPin') mapPin?: ElementRef<HTMLElement>;
  @ViewChild('mapRoute') mapRoute?: ElementRef<SVGSVGElement>;
  @ViewChild('mapLabel') mapLabel?: ElementRef<HTMLElement>;
  @ViewChild('storyHint') storyHint?: ElementRef<HTMLElement>;

  private lastMapFrame = -1;
  /** a clicked card pins the map to its place (map frame); null = the map follows the scroll */
  private pinnedFrame: number | null = null;

  isBlur: boolean = false;

  private mapAnimation!: AnimationItem;
  private destroy$ = new Subject<void>(); // ADD: Cleanup
  private resizeTimer: any; // ADD: Debounced resize

  mapHeight: number = 0;
  grid: number = 0

  private mapRequested = false;
  /** lottie, the map's data as loaded, and the palette it was last drawn in */
  private lottie: any = null;
  private mapData: unknown = null;
  private drawnPalette: unknown = null;
  private rebuildHandle = 0;
  private visibilityObserver?: IntersectionObserver;
  private scrollFrame = 0;
  private readonly onScroll = () => {
    // Coalesce scroll events into one update per frame, outside Angular's change detection.
    if (this.scrollFrame) return;
    this.scrollFrame = requestAnimationFrame(() => {
      this.scrollFrame = 0;
      this.onWindowScroll();
    });
  };

  private totalFrames: number = 0;

  constructor(private gridService: GridService, private blurService: BlurService, private ngZone: NgZone,
    private pageScroll: PageScrollService, public lang: LanguageService,
    private progress: SectionProgressService, private theme: ThemeService) {
    // the site's colours changed: draw the map again in them —
    // when the browser is idle (it is heavy, and the map is pages away from the colour pickers)
    effect(() => {
      const palette = this.theme.palette();
      untracked(() => {
        if (!this.lottie || palette === this.drawnPalette) return;
        const w = window as any;
        if (this.rebuildHandle) (w.cancelIdleCallback ?? clearTimeout)(this.rebuildHandle);
        const go = () => { this.rebuildHandle = 0; if (this.theme.palette() !== this.drawnPalette) this.buildAnimations(); };
        this.rebuildHandle = w.requestIdleCallback ? w.requestIdleCallback(go, { timeout: 1500 }) : setTimeout(go, 300);
      });
    });
    this.blurService.blurState$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(data => this.isBlur = data);
  }

  ngOnInit(): void {
    requestAnimationFrame(() => this.calculateMapHeight());
  }

  private unregisterStory?: () => void;
  private unregisterPhone?: () => void;
  private readonly phonePager = inject(PhonePagerService);

  ngAfterViewInit(): void {
    const section = this.sectionEl();
    if (section) {
      // desktop: resting on the timeline, scrolling tells its story (see page-scroll.service)
      this.unregisterStory = this.pageScroll.registerStory({
        el: section,
        active: () => this.desktop(),
        scroll: (px, fresh) => this.storyScroll(px, fresh),
        arrive: (dir, inMs) => this.storyArrive(dir, inMs),
      });
      // phones: the same story, a place per swipe (phone-pager.service)
      if (this.phone) this.unregisterPhone = this.phonePager.registerStory({
        el: section,
        step: dir => this.phoneStep(dir),
        arrive: dir => this.storyArrive(dir, 0),
      });
    }
    this.ngZone.runOutsideAngular(() => {
      window.addEventListener('scroll', this.onScroll, { passive: true });
      // the timeline needs no download: show the right state straight away
      requestAnimationFrame(() => this.onWindowScroll());

      // the map (~0.4 MB) is fetched once the page has settled, so it is drawn and waiting by
      // the time the timeline is reached — pages glide past in about a second, too quick to
      // start loading on the way (or at once, should the timeline come close before that)
      const target = this.mapSection?.nativeElement;
      const idle = (window as any).requestIdleCallback as ((cb: () => void, o?: { timeout: number }) => number) | undefined;
      const start = () => this.loadMap();
      const later = () => idle ? idle(start, { timeout: 2500 }) : setTimeout(start, 1200);
      if (document.readyState === 'complete') later(); else window.addEventListener('load', later, { once: true });
      if (!target || !('IntersectionObserver' in window)) {
        this.loadMap();
        return;
      }
      this.visibilityObserver = new IntersectionObserver((entries) => {
        if (entries.some(e => e.isIntersecting)) {
          this.visibilityObserver?.disconnect();
          this.loadMap();
        }
      }, { rootMargin: '100% 0px' });
      this.visibilityObserver.observe(target);
    });
  }

  @HostListener('window:resize')
  onWindowResize() {
    this.calculateMapHeight()
    if (!this.partRaf) this.shiftShown = this.shiftFor(this.part)
    this.showLine()
  }

  onWindowScroll() {
    this.updateHtml(window.scrollY + 0.5 * window.innerHeight);
  }

  private async loadMap(): Promise<void> {
    if (this.mapRequested || !this.timelineSection?.nativeElement) return;
    this.mapRequested = true;

    // Light SVG build, fetched on demand (the map uses no expressions). The data is fetched
    // here (not by lottie) so it can be drawn in the site's colours.
    const [lottie, mapData] = await Promise.all([
      import('lottie-web/build/player/esm/lottie_light.min.js').then(m => m.default),
      fetch(`assets/json/map.json?v=${DATA_VERSION}`).then(r => r.json()),
    ]);
    this.lottie = lottie;
    this.mapData = mapData;
    this.buildAnimations();
  }

  /** (re)create the map in the current palette */
  private buildAnimations(): void {
    const lottie = this.lottie;
    if (!lottie || !this.mapData) return;
    const palette = this.theme.palette();
    this.drawnPalette = palette;
    this.mapAnimation?.destroy();
    this.totalFrames = 0;
    const settings = {
      preserveAspectRatio: 'xMidYMid slice',
      progressiveLoad: true,
      hideOnTransparent: true
    };

    this.mapAnimation = lottie.loadAnimation({
      container: this.mapSection.nativeElement,
      renderer: 'svg',
      loop: false,
      autoplay: false,
      animationData: withCityMarks(recolorLottie(litCountries(this.mapData, ...DEFAULT_GREENS), palette)),
      rendererSettings: settings
    });

    this.mapAnimation.addEventListener('DOMLoaded', () => {
      this.totalFrames = this.mapAnimation.totalFrames;
      this.lastMapFrame = -1;
      this.mapCurrent = -1;
      this.onWindowScroll();
      // the story: show the place it is at
      if (this.storyMode()) {
        this.setFar(this.part === 0);
        if (this.part === 0) this.showMapFrame(Timeline.MAP_START, false);
        else this.showMapFrame(PLACE_FRAME[this.placeOfPart(this.part)]);
      }
    });
  }

  /**
   * HTML timeline: reveal everything above the reading line (middle of the window) and scrub
   * the map to the matching frame. Same geometry as the original animation (25 x 68 cells),
   * so the map changes country exactly where it used to.
   */
  /** from the HTML timeline: a card was clicked (frame of its place) or let go (null) */
  showPlace(frame: number | null): void {
    this.pinnedFrame = frame;
    if (!this.mapAnimation || !this.totalFrames) return;
    this.setMapTarget(frame ?? this.scrollFrame_());
  }

  /** the map frame that matches the current scroll position */
  private scrollFrame_(): number {
    const line = this.lineShown >= 0 ? this.lineShown : (this.readingLine() ?? 0);
    return PLACE_FRAME[placeAt(line)];
  }

  /* ---- map follower with a speed limit ------------------------------------------------
     The map never jumps: it travels towards its target frame (from the scroll, or a clicked
     card) at most MAP_MOVE_SPEED frames/s while the camera is moving between places, so
     every move stays readable however fast you scroll. Stretches where nothing moves are
     passed at MAP_HOLD_SPEED. Frames are map.json frames (24 per second of the original). */
  /** each move between two places: the camera's move and the route line drawn and erased
      along it (map.json frames) — played whole, so a line never pops on or off */
  private static readonly MAP_MOVES: [number, number][] = [[93, 139], [238, 283], [296, 342], [359, 400], [433, 474]];
  private static readonly MAP_MOVE_SPEED = 36;    // 1.5x the original animation
  /** the moves between German cities carry Emil's 2.5 s route animation (map-cities.ts) */
  private static readonly MAP_DE_SPEED = 18;
  private static readonly PART_DE_MS = 2300;
  private static readonly MAP_HOLD_SPEED = 900;
  /** passing a place on the way somewhere else: stop there this long, pin showing */
  private static readonly MAP_DWELL_MS = 750;
  private mapTarget = -1;
  private mapCurrent = -1;
  private mapRaf = 0;
  private mapLast = 0;
  private mapRendered = 0;     // last time the map was drawn: it is drawn at 24 fps
  private dwellUntil = 0;      // stopping at a place on the way

  private setMapTarget(frame: number): void {
    this.mapTarget = frame;
    if (this.mapCurrent < 0) {          // first time: just show it
      this.mapCurrent = frame;
      this.renderMap();
      return;
    }
    if (!this.mapRaf && frame !== this.mapCurrent) {
      this.mapLast = performance.now();
      this.ngZone.runOutsideAngular(() => this.mapRaf = requestAnimationFrame(t => this.stepMap(t)));
    }
  }

  private stepMap(now: number): void {
    this.mapRaf = 0;
    const T = Timeline;
    let budget = Math.min(0.1, (now - this.mapLast) / 1000);   // seconds to spend this frame
    this.mapLast = now;
    let cur = this.mapCurrent;
    const target = this.mapTarget;
    if (now < this.dwellUntil) budget = 0;                      // resting at a place on the way
    while (budget > 1e-6 && cur !== target) {
      const dir = Math.sign(target - cur);
      const inMove = T.MAP_MOVES.some(([a, b]) => dir > 0 ? cur >= a && cur < b : cur > a && cur <= b);
      const speed = !inMove ? T.MAP_HOLD_SPEED : germanLeg(cur + dir) ? T.MAP_DE_SPEED : T.MAP_MOVE_SPEED;
      // run to the next move edge (or the target), then re-evaluate the speed
      let next = target;
      for (const [a, b] of T.MAP_MOVES) for (const e of [a, b]) {
        if (dir > 0 && e > cur && e < next) next = e;
        if (dir < 0 && e < cur && e > next) next = e;
      }
      const dist = Math.abs(next - cur);
      if (speed * budget >= dist) { cur = next; budget -= dist / speed; }
      else { cur += dir * speed * budget; budget = 0; }
      // just arrived at a place (end of a move) but heading further: stop there a moment so
      // the pin can be seen — no place along the route is skipped
      const arrived = T.MAP_MOVES.find(([a, b]) => (dir > 0 ? b : a) === cur);
      // ...only if the target lies beyond this place (past the start of the next move)
      const leaving = dir > 0
        ? T.MAP_MOVES.some(([a]) => a > cur && a < target)
        : T.MAP_MOVES.some(([, b]) => b < cur && b > target);
      if (arrived && leaving) {
        cur += dir * 2;                                   // just outside the move, pin shows
        this.dwellUntil = now + T.MAP_DWELL_MS;
        budget = 0;
      }
    }
    this.mapCurrent = cur;
    // the speed is tracked every frame; the map is redrawn 24 times a second (smooth zooms —
    // its route lines are stepped at 12 fps inside map.json)
    // (a fixed frame clock, so 60 Hz screens alternate 2 and 3 refreshes = a true 24 fps)
    if (now >= this.mapRendered || cur === target) {
      const fps = this.phone ? Timeline.PHONE_MAP_FPS : 24;
      this.mapRendered = Math.max(this.mapRendered + 1000 / fps, now - 1000 / fps);
      this.renderMap();
    }
    if (cur !== target || now < this.dwellUntil) this.mapRaf = requestAnimationFrame(t => this.stepMap(t));
  }

  /** @param pin desktop story: whether the pin shows (it comes back just before arriving) */
  private renderMap(pin?: boolean): void {
    // in-between frames too (the animation interpolates them), so a move is smooth on any screen
    const frame = Math.round(this.mapCurrent * 100) / 100;
    if (frame !== this.lastMapFrame) {
      this.lastMapFrame = frame;
      this.mapAnimation.goToAndStop(frame, true);
    }
    // between German cities the route animation carries the squares (the pin waits). The
    // route's square and the pin are the same square on the same spot: they hand over at
    // once, without the pin's shrink / grow (it would flicker)
    const leg = germanLeg(frame);
    this.drawRoute(frame, leg);
    const handover = !!leg !== this.routeShown;
    this.routeShown = !!leg;
    if (handover) this.pinAtOnce();
    if (pin !== undefined) {
      this.mapPin?.nativeElement.classList.toggle('away', !pin || !!leg);
      this.label(frame, pin && !leg);
      return;
    }
    // the pin only marks a place once the map has arrived there
    const resting = performance.now() < this.dwellUntil;
    const travelling = !resting && (Timeline.MAP_MOVES.some(([a, b]) => frame > a - 2 && frame < b + 2)
      || Math.abs(this.mapTarget - this.mapCurrent) > 3);  // still on its way somewhere
    this.mapPin?.nativeElement.classList.toggle('away', travelling || !!leg);
    this.label(frame, !travelling && !leg);
  }

  /** the place's name in a box beside the pin (above it, to the right), unfolding like the
      timeline's cards; it goes with the pin while the map travels */
  private labelPlace = '';
  private label(frame: number, on: boolean): void {
    const el = this.mapLabel?.nativeElement;
    if (!el) return;
    if (on) {
      // the place the map is at: the nearest of the places' frames
      let place = PLACES[0], best = Infinity;
      for (const p of PLACES) { const d = Math.abs(PLACE_FRAME[p] - frame); if (d < best) { best = d; place = p; } }
      if (place !== this.labelPlace) {
        // a new name only while folded away (or first time)
        if (el.classList.contains('on') && this.labelPlace) { el.classList.remove('on'); }
        this.labelPlace = place;
        const text = el.querySelector('span')!;
        const name = PLACE_NAMES[place] ?? '';
        text.textContent = name;
        el.classList.remove('two');
        // too long for the room right of the pin: on two lines (split at the middle space)
        const pin = this.mapPin?.nativeElement.getBoundingClientRect();
        const room = pin && el.parentElement ? el.parentElement.getBoundingClientRect().right - pin.right - this.cell() / 2 : Infinity;
        if (text.getBoundingClientRect().width > room && name.includes(' ')) {
          const mid = name.length / 2;
          const at = [...name.matchAll(/ /g)].map(m => m.index!).reduce((a, b) => Math.abs(b - mid) < Math.abs(a - mid) ? b : a);
          text.textContent = '';
          text.append(name.slice(0, at), document.createElement('br'), name.slice(at + 1));
          el.classList.add('two');
        }
        el.style.setProperty('--label-w', `${Math.ceil(text.getBoundingClientRect().width)}px`);
      }
    }
    if (el.classList.contains('on') !== on) el.classList.toggle('on', on);
  }

  private routeShown = false;
  /** the pin's next change without its transition */
  private pinAtOnce(): void {
    const pin = this.mapPin?.nativeElement;
    if (!pin) return;
    pin.style.transition = 'none';
    requestAnimationFrame(() => requestAnimationFrame(() => { pin.style.transition = ''; }));
  }

  /** Germany: the map zoomed in (css), and a move between its cities drawn over the map —
      the square, the dashed line, the dot, their swap (map-cities.ts) */
  private drawRoute(frame: number, leg: ReturnType<typeof germanLeg>): void {
    const host = this.mapSection?.nativeElement as HTMLElement | undefined;
    const wrap = host?.parentElement;
    if (!host || !wrap) return;
    // in Germany the map comes closer: already on the way there (and away again on the way back)
    const de = this.zoomTo ?? frame >= GERMANY_FROM;
    if (wrap.classList.contains('germany') !== de) wrap.classList.toggle('germany', de);
    const svg = this.mapRoute?.nativeElement;
    if (!svg) return;
    if (!leg) { svg.style.visibility = 'hidden'; return; }
    const w = wrap.getBoundingClientRect();
    const at = (city: string): [number, number] | null => {
      const e = host.querySelector(`#${cityMarkId(city)}`);
      if (!e) return null;
      const r = e.getBoundingClientRect();
      return [r.left + r.width / 2 - w.left, r.top + r.height / 2 - w.top];
    };
    const A = at(leg.from), B = at(leg.to);
    if (!A || !B) { svg.style.visibility = 'hidden'; return; }
    const g = this.cell();
    const st = routeState((frame - leg.a) / (leg.b - leg.a));
    const line = svg.querySelector('line')!;
    line.setAttribute('x1', `${A[0]}`); line.setAttribute('y1', `${A[1]}`);
    line.setAttribute('x2', `${B[0]}`); line.setAttribute('y2', `${B[1]}`);
    // the dashes run on towards the city reached
    line.setAttribute('stroke-dashoffset', `${(-st.flow * g).toFixed(1)}`);
    // dashes like the routes between countries (a little lighter)
    line.setAttribute('stroke-dasharray', `${(0.55 * g).toFixed(1)} ${(0.4 * g).toFixed(1)}`);
    line.style.opacity = `${st.line}`;
    const paint = (sel: string, m: Mark, [x, y]: [number, number]) => {
      const grp = svg.querySelector(sel)!, rect = grp.querySelector('rect')!, dot = grp.querySelector('circle')!;
      rect.style.display = m?.kind === 'square' ? '' : 'none';
      dot.style.display = m && m.kind !== 'square' ? '' : 'none';
      if (m?.kind === 'square') {
        // the pin's square exactly: on whole pixels, its 2px frame on the cell's edge (a pixel
        // out, one in: timeline.scss .map-pin), so they hand over without a change
        const size = Math.max(3, Math.round(m.s * g));
        const left = Math.round(x - size / 2), top = Math.round(y - size / 2);
        rect.setAttribute('x', `${left}`); rect.setAttribute('y', `${top}`);
        rect.setAttribute('width', `${size}`); rect.setAttribute('height', `${size}`);
      } else if (m) {
        dot.setAttribute('cx', `${x}`); dot.setAttribute('cy', `${y}`);
        dot.setAttribute('r', `${Math.max(0, m.r * 0.36 * g)}`);
        dot.classList.toggle('ring', m.kind === 'ring');
      }
    };
    paint('.r-a', st.a, A);
    paint('.r-b', st.b, B);
    svg.style.visibility = 'visible';
  }

  private updateHtml(_y: number): void {
    const line = this.readingLine();
    if (line === null) { this.showLine(); return; }   // the story drives it
    this.setLineTarget(line);
  }

  /** the panel's rows (cells) */
  private static readonly ROWS = ROWS;
  /** small screens: row reached when the timeline arrives (Syria drawn, Russia not yet) */
  private static readonly START_ROW = STORY_STOPS[1] - 0.5;
  /** the story unfolds down to this height of the window, then moves up under it */
  private static readonly UNFOLD_TO = 0.7;
  /** told to the end (or rewound to the start): rest this long before the page moves on */
  private static readonly REST_MS = 1000;
  /** ...but going back up, from its start to the page before, only this long */
  private static readonly REST_BACK_MS = 500;
  /** one part of the story (a place) plays in about this long, at the page's glide */
  private static readonly PART_MS = 1100;
  private static readonly PART_MS_PER_ROW = 8;
  /** the map pin shows again this far into a move, just before the map arrives */
  private static readonly PIN_BACK_AT = 0.8;
  /** a move into or out of Germany takes at least this long (the map zooms with it) */
  private static readonly PART_ZOOM_MS = 1800;
  /** a new swipe may start the next part once the current one has mostly played */
  private static readonly RELAUNCH_AT = 0.6;

  private readonly phone = isPhone();

  private desktop(): boolean {
    // phones never are: and asked every frame, the window's width made the browser lay the
    // page out again each time, after the panel had moved (the iPhone's lag, Emil 22 Oct)
    return !this.phone && isDesktop();
  }

  /** told place by place: the desktop with its page by page scrolling, and phones */
  private storyMode(): boolean {
    return this.phone || (this.desktop() && this.pageScroll.active);
  }

  private cell(): number {
    return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dynamic-grid-size')) || 21;
  }

  private sectionEl(): HTMLElement | null {
    return (this.timelineSection?.nativeElement as HTMLElement | undefined)?.closest('section') ?? null;
  }

  /**
   * Small screens: how far the timeline has been read follows the page (Syria → the end).
   * Desktop: null — the page stands still and each swipe tells the next part of the story;
   * without that mode (reduced motion) the whole story shows.
   */
  private readingLine(): number | null {
    const T = Timeline;
    if (this.desktop()) return this.pageScroll.active ? null : T.ROWS;
    const section = this.sectionEl();
    if (!section) return null;
    // phones: the story, a place per swipe (phoneStep)
    if (this.phone) return null;
    const r = section.getBoundingClientRect();
    const sy = window.scrollY, vh = window.innerHeight;
    const margin = parseFloat(getComputedStyle(section).scrollMarginTop) || 0;
    const start = r.top + sy - margin;
    const end = r.bottom + sy - vh;
    if (sy < start) {
      const k = Math.max(0, Math.min(1, (sy - (start - vh)) / vh));
      return k * T.START_ROW;
    }
    const p = end > start ? Math.min(1, (sy - start) / (end - start)) : 1;
    return T.START_ROW + p * (T.ROWS - T.START_ROW);
  }

  /* ---- the story (desktop): one place per swipe ----
     The page stands still. Each swipe plays the next part — Syria, Russia, Norway,
     Germany / Ludwigshafen, Stuttgart, Berlin — drawing it on and moving the panel with the
     page's glide; swiping back rewinds part by part. The page moves on only once the story
     is told to the end (or back at its start) and has rested there REST_MS. */
  private part = 0;                 // index in STORY_STOPS the story is at (or heading to)
  private restFrom = 0;
  private partRaf = 0;
  private partStart = 0;
  private partDur = 0;
  private lineShown = -1;
  private timeShown = 0;
  private shiftShown = 0;

  private storyArrive(dir: number, inMs: number): void {
    // from above: a blank panel; from below: the whole story, scrolling up rewinds it
    this.part = dir > 0 ? 0 : STORY_STOPS.length - 1;
    this.slack = false;
    cancelAnimationFrame(this.slackRaf);
    this.slackRaf = 0;
    cancelAnimationFrame(this.partRaf);
    this.partRaf = 0;
    this.lineShown = STORY_STOPS[this.part];
    this.timeShown = TIME_STOPS[this.part];
    this.shiftShown = this.shiftFor(this.part);
    this.glideAnim?.cancel();
    this.glideAnim = undefined;
    if (this.phone) this.setZoom(this.zoomOf(this.part));
    this.restFrom = performance.now() + inMs;   // the rest counts from when the page has arrived
    this.showLine();
    this.showHint(this.part === 0);
    this.zoomTo = null;
    this.setFar(this.part === 0);
    if (this.part === 0) this.showMapFrame(Timeline.MAP_START, false);
    else this.showMapFrame(PLACE_FRAME[this.placeOfPart(this.part)]);
  }

  /** before the story: the map a little further out, Syria not lit yet, no pin or name; the
      first swipe comes closer, lights Syria and names Latakia */
  private static readonly MAP_START = 0;
  private static readonly SYRIA_LIT = 4;      // map.json: Syria's colour is in by this frame
  private setFar(on: boolean): void {
    const wrap = (this.mapSection?.nativeElement as HTMLElement | undefined)?.parentElement;
    const far = on && this.storyMode();
    if (wrap && wrap.classList.contains('far') !== far) wrap.classList.toggle('far', far);
  }

  /** Syria's colour fading in (or out) with the first swipe: the map stays on one frame and
      only Syria's layer fades, instead of the whole map redrawing every frame */
  private syriaFade(v: number | null): void {
    const el = (this.mapSection?.nativeElement as HTMLElement | undefined)?.querySelector<SVGElement>(`#${SYRIA_ID}`);
    if (el) el.style.opacity = v === null ? '' : `${v}`;
  }

  /** scroll input while resting on the timeline: true = used by the story (the page stays),
      false = the page may move on, a number = resting at this end, the page may go in that many ms */
  private storyScroll(px: number, fresh: boolean): boolean | number {
    const now = performance.now(), T = Timeline;
    if (this.lineShown < 0) { this.lineShown = 0; this.showLine(); }
    const dir = Math.sign(px);
    const last = STORY_STOPS.length - 1;
    const playing = !!this.partRaf;
    if (!playing && (dir > 0 ? this.part >= last : this.part <= 0)) {
      // told to this end: let the page go once it has rested here
      const left = this.restFrom ? this.restFrom + (dir > 0 ? T.REST_MS : T.REST_BACK_MS) - now : 0;
      return left > 0 ? left : false;
    }
    if (!fresh) return true;                    // one part per swipe
    if (playing && now - this.partStart < this.partDur * T.RELAUNCH_AT) return true;
    this.chainTo = -1;                          // a swipe takes over from a clicked card
    const next = Math.max(0, Math.min(last, this.part + dir));
    if (next !== this.part) this.playPart(next);
    return true;
  }

  /** a card of a place already told was clicked: the story goes back (or on) to that place,
      place by place like the swipes, the places on the way quicker */
  private chainTo = -1;
  goToPlace(place: string): void {
    if (!this.desktop() || !this.pageScroll.active) return;
    const to = PLACES.indexOf(place as typeof PLACES[number]) + 1;
    if (to < 1) return;
    this.chainTo = to;
    if (!this.partRaf) this.chainStep();
  }
  private chainStep(): void {
    const to = this.chainTo;
    if (to < 0 || to === this.part) { this.chainTo = -1; return; }
    const next = this.part + Math.sign(to - this.part);
    this.playPart(next, next === to ? 1 : Timeline.PASSING);
  }
  /** a place passed on the way to a clicked card's place plays this much quicker */
  private static readonly PASSING = 0.55;

  /** the place a stop belongs to: stop p (p >= 1) is the end of place p - 1; stop 0 shows Syria */
  private placeOfPart(part: number): typeof PLACES[number] {
    return PLACES[Math.max(0, Math.min(PLACES.length - 1, part - 1))];
  }

  /** desktop story: put the map on a frame right away (it moves with the panel) */
  private showMapFrame(frame: number, pin = true): void {
    if (!this.mapAnimation || !this.totalFrames) return;
    cancelAnimationFrame(this.mapRaf);
    this.mapRaf = 0;
    this.dwellUntil = 0;
    this.mapTarget = frame;
    this.mapCurrent = frame;
    this.renderMap(pin);
  }

  /** the Germany zoom while the map flies between Norway and Germany: where it is heading */
  private zoomTo: boolean | null = null;

  private playPart(to: number, speed = 1): void {
    const T = Timeline;
    const from = this.part;
    const fromLine = this.lineShown, toLine = STORY_STOPS[to];
    const fromTime = this.timeShown, toTime = TIME_STOPS[to];
    const fromShift = this.shiftShown, toShift = this.shiftFor(to);
    this.part = to;
    this.restFrom = 0;
    if (to > 0) this.showHint(false);
    this.partStart = performance.now();
    this.partDur = T.PART_MS + Math.abs(toLine - fromLine) * T.PART_MS_PER_ROW * 0.25;
    // the map makes its move between the two places in the same time as the panel: it starts
    // and lands with it, but plays its own frames evenly (they carry the original camera
    // easing), every screen frame, in-between frames included, so it glides; the pin comes
    // back a little before it arrives
    const fromPlace = PLACES.indexOf(this.placeOfPart(from)), toPlace = PLACES.indexOf(this.placeOfPart(to));
    const move = fromPlace !== toPlace ? Timeline.MAP_MOVES[Math.min(fromPlace, toPlace)] : null;
    // the start (part 0) and Syria: the map comes closer and Syria lights up (or the other way)
    const start = (from === 0) !== (to === 0);
    const mapFrom = move ? (toPlace > fromPlace ? move[0] : move[1]) : start ? T.SYRIA_LIT : PLACE_FRAME[PLACES[toPlace]];
    const mapTo = move ? (toPlace > fromPlace ? move[1] : move[0]) : mapFrom;
    this.setFar(to === 0);
    if (move && germanLeg((move[0] + move[1]) / 2)) this.partDur = Math.max(this.partDur, T.PART_DE_MS);
    const de = PLACES.indexOf('ludwigshafen' as typeof PLACES[number]);
    this.zoomTo = move && (fromPlace < de) !== (toPlace < de) ? toPlace >= de : null;
    // into (or out of) Germany: a slower move, for the zoom to come with it
    if (this.zoomTo !== null) this.partDur = Math.max(this.partDur, T.PART_ZOOM_MS);
    this.partDur *= speed;
    cancelAnimationFrame(this.partRaf);
    // phones: the panel glides on the compositor (it never waits for the map's drawing); the
    // map is drawn 12 times a second, the site's own beat, its zoom in the same frames
    // (each drawing repaints the whole svg: an iPhone 11 lagged at 24, Emil 23 Oct)
    const zFrom = this.phone ? (Number.isNaN(this.zoomShown) ? this.zoomOf(from) : this.zoomShown) : 0;
    const zTo = this.phone ? this.zoomOf(to) : 0;
    if (this.phone) this.glide(toShift, this.partDur);
    let mapAt = 0;
    const step = (now: number) => {
      const x = Math.min(1, (now - this.partStart) / this.partDur);
      const e = Timeline.ease(x);
      // phones: the place's cards all at once (Emil 22 Oct), as the panel comes near; going
      // back they go at once; desktop: drawn on as the panel moves, leading a touch
      this.lineShown = !this.phone ? fromLine + (toLine - fromLine) * Math.min(1, e * 1.08)
        : toLine < fromLine || x >= Timeline.POP_AT || fromShift === toShift ? toLine : fromLine;
      this.timeShown = fromTime + (toTime - fromTime) * Math.min(1, e * 1.08);
      this.shiftShown = fromShift + (toShift - fromShift) * e;
      this.showLine();
      if (x >= 1) {
        if (start) this.syriaFade(null);
        if (this.phone) this.setZoom(zTo);
        if (to === 0) this.showMapFrame(T.MAP_START, false);
        else this.showMapFrame(PLACE_FRAME[PLACES[toPlace]]);
      } else if (!this.phone || now >= mapAt) {
        mapAt = Math.max(mapAt + 1000 / T.PHONE_MAP_FPS, now - 1000 / T.PHONE_MAP_FPS);
        if (this.phone && zFrom !== zTo) this.setZoom(zFrom + (zTo - zFrom) * Timeline.bezier(.45, .55, x));
        this.showMapFrame(mapFrom + (mapTo - mapFrom) * x, to !== 0 && (!(move || start) || x >= Timeline.PIN_BACK_AT));
        // Syria's colour comes in over the first half of the swipe (goes, going back)
        if (start) this.syriaFade(to === 0 ? Math.max(0, 1 - 2 * x) : Math.min(1, 2 * x));
      }
      if (x < 1) {
        this.partRaf = requestAnimationFrame(step);
      } else {
        this.partRaf = 0;
        this.zoomTo = null;
        this.syriaFade(null);
        this.lineShown = toLine;
        this.timeShown = toTime;
        this.shiftShown = toShift;
        this.showLine();
        if (to === 0 || to === STORY_STOPS.length - 1) this.restFrom = performance.now();
        if (to === 0) this.showHint(true);
        this.chainStep();                         // on to a clicked card's place
      }
    };
    this.ngZone.runOutsideAngular(() => this.partRaf = requestAnimationFrame(step));
  }

  /** "scroll down to see my story", on the map pin's row, while the story has not started */
  private showHint(on: boolean): void {
    const hint = this.storyHint?.nativeElement;
    if (!hint) return;
    if (on && !this.phone) {
      // measured within the map's (sticky) column, which at rest starts level with the window
      const pin = this.mapPin?.nativeElement.getBoundingClientRect();
      const column = this.mapPin?.nativeElement.closest('.sticky')?.getBoundingClientRect();
      const g = this.cell();
      if (pin && column) hint.style.setProperty('--hint-top', `${Math.round((pin.top + pin.height / 2 - column.top) / g - 0.5) * g}px`);
    }
    hint.classList.toggle('on', on && this.storyMode());
  }

  /** cubic-bezier(x1, 0, x2, 1) at t */
  private static bezier(x1: number, x2: number, t: number): number {
    let lo = 0, hi = 1, s = t;
    for (let i = 0; i < 24; i++) {
      const xs = 3 * x1 * s * (1 - s) ** 2 + 3 * x2 * s * s * (1 - s) + s ** 3;
      if (xs < t) lo = s; else hi = s;
      s = (lo + hi) / 2;
    }
    return 3 * s * s * (1 - s) + s ** 3;
  }

  /** the page's glide curve (page-scroll.service): slow start, quick middle, soft landing */
  private static ease(t: number): number {
    // cubic-bezier(0.52, 0, 0.01, 1)
    const x1 = 0.52, x2 = 0.01;
    let lo = 0, hi = 1, s = t;
    for (let i = 0; i < 24; i++) {
      const xs = 3 * x1 * s * (1 - s) ** 2 + 3 * x2 * s * s * (1 - s) + s ** 3;
      if (xs < t) lo = s; else hi = s;
      s = (lo + hi) / 2;
    }
    return 3 * s * s * (1 - s) + s ** 3;        // y1 = 0, y2 = 1
  }

  /* small screens: the reading simply follows the page */
  private setLineTarget(line: number): void {
    this.lineShown = line;
    this.showLine();
  }

  private showLine(): void {
    if (this.lineShown < 0) return;
    // how much of the story is drawn, for the side menu's counter
    const first = STORY_STOPS[0], last = STORY_STOPS[STORY_STOPS.length - 1];
    this.progress.set('timeline', (this.lineShown - first) / (last - first));
    const story = this.storyMode();
    this.htmlTimeline?.update(this.lineShown, story ? this.timeShown : this.lineShown);
    this.placePanel();
    if (!this.mapAnimation || !this.totalFrames) return;
    if (this.pinnedFrame !== null) return;   // a clicked card is showing its place
    if (story) return;   // the story moves the map with the panel
    // the map shows the place being told; it travels there at its own pace
    this.setMapTarget(PLACE_FRAME[placeAt(this.lineShown)]);
  }

  /**
   * Where the panel sits (px, 0 or less, whole cells) once a place has been told: its newest
   * row near 70% of the window, but the whole place in view — its heading at least at the
   * window's top, its end inside the window — and at the very end the panel's last row level
   * with the bottom of the map — the last card's bottom on the map's bottom row. Always a
   * whole number of cells, so it lands on the grid.
   */
  private shiftFor(part: number): number {
    const panel = this.timelineSection?.nativeElement as HTMLElement | undefined;
    if (panel && this.phone) return this.phoneShift(panel, part);
    if (!panel || !this.desktop() || part <= 0) return 0;
    const T = Timeline, g = this.cell(), vh = window.innerHeight;
    const win = panel.parentElement as HTMLElement;
    const winH = win.clientHeight || vh - 2 * g;
    const map = this.mapSection?.nativeElement?.closest('.map-wrapper') as HTMLElement | null;
    // measured within the map's own column: it is sticky, so while the page is still gliding
    // here (coming back up from the next page) it sits lower than it will at rest — at rest
    // its top is level with the window's
    const column = map?.closest('.sticky') as HTMLElement | null;
    const mapBottom = map && column ? map.getBoundingClientRect().bottom - column.getBoundingClientRect().top : winH;
    const lastRow = CARDS[CARDS.length - 1].y + 4;              // bottom of the last card
    const end = Math.min(0, Math.round((mapBottom - lastRow * g) / g) * g);
    if (part === STORY_STOPS.length - 1) return end;
    const line = STORY_STOPS[part];
    const head = Math.max(0, STORY_STOPS[part - 1] - 1.5);     // the place's heading sits above its line
    let s = vh * T.UNFOLD_TO - g - line * g;
    s = Math.max(s, -head * g);
    s = Math.min(s, winH - line * g);
    s = Math.max(s, end);
    s = Math.min(0, s);
    return Math.round(s / g) * g;
  }

  /* ---- phones (Emil 22 Oct): a swipe a place. Arriving, the map is further out over the
     Middle East with "scroll down to follow my story"; each swipe goes on to the next place,
     its cards all at once in the middle of the window (Syria at its top, Berlin, the end, at
     its bottom); after Berlin a swipe pulls it all up a couple of cells and it springs back like
     rubber (Emil 23 Oct); only the next one takes the page on, so it isn't left by mistake. */
  /** the cards pop up once the panel is this far through its move */
  private static readonly POP_AT = 0.4;
  /** how far the end gives, like rubber */
  private static readonly SLACK_CELLS = 2;
  private slack = false;
  private slackRaf = 0;

  /** phones: "skip timeline", on to the cases under the curtain */
  skip(): void {
    const cases = document.getElementById('cases');
    if (cases) this.phonePager.goToElement(cases);
  }

  private phoneStep(dir: number): boolean {
    const T = Timeline, last = STORY_STOPS.length - 1;
    // a part still playing takes the swipe (a quick second swipe waits for most of it)
    if (this.partRaf && performance.now() - this.partStart < this.partDur * T.RELAUNCH_AT) return true;
    if (this.slackRaf) return true;
    if (dir > 0) {
      if (this.part < last) { this.playPart(this.part + 1); return true; }
      if (!this.slack) { this.rubber(); return true; }
      return false;
    }
    this.slack = false;
    if (this.part > 0) { this.playPart(this.part - 1); return true; }
    return false;
  }

  /** the end (Emil 23 Oct): the swipe after Berlin pulls it all up a little and it springs
      back, like rubber; the next one takes the page on */
  private static readonly RUBBER_MS = 700;
  private rubber(): void {
    this.slack = true;
    const panel = this.timelineSection?.nativeElement as HTMLElement | undefined;
    if (!panel || !panel.animate || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const end = this.shiftFor(this.part), pull = end - Timeline.SLACK_CELLS * this.cell();
    this.glideAnim?.cancel();
    this.writePanel(panel, end);
    const anim = panel.animate([
      { transform: `translateY(${end}px)`, easing: 'cubic-bezier(.2, .7, .3, 1)' },
      { transform: `translateY(${pull}px)`, offset: .3, easing: 'cubic-bezier(.45, 0, .3, 1)' },
      { transform: `translateY(${end}px)` },
    ], { duration: Timeline.RUBBER_MS });
    this.glideAnim = anim;
    anim.onfinish = () => { if (this.glideAnim === anim) this.glideAnim = undefined; };
    // swipes wait for it
    cancelAnimationFrame(this.slackRaf);
    const t0 = performance.now();
    const wait = (now: number) => { this.slackRaf = now - t0 < Timeline.RUBBER_MS ? requestAnimationFrame(wait) : 0; };
    this.ngZone.runOutsideAngular(() => this.slackRaf = requestAnimationFrame(wait));
  }

  /** phones: where the panel sits for a part (px, whole cells) — see above */
  private phoneShift(panel: HTMLElement, part: number): number {
    const T = Timeline, g = this.cell(), last = STORY_STOPS.length - 1;
    if (part <= 1) return 0;
    // the window as far as it is on the screen (the page may be a part of a cell taller)
    const win = panel.parentElement as HTMLElement;
    const page = this.sectionEl();
    const top = page ? win.getBoundingClientRect().top - page.getBoundingClientRect().top : 0;
    const h = Math.floor(Math.min(win.clientHeight, window.innerHeight - top) / g) * g;
    // the end: the last card's bottom a free row above the window's (and the skip button's) end
    const lastRow = CARDS[CARDS.length - 1].y + 4 + 1;
    const end = Math.min(0, Math.floor((h - lastRow * g) / g) * g);
    if (part >= last) return end;
    // the place: from its heading to its last card, in the middle of the window
    const place = this.placeOfPart(part);
    const cards = CARDS.filter(c => c.place === place);
    const heads = HEADINGS.filter(hd => hd.place === place);
    const a = Math.min(...heads.map(hd => hd.y), ...cards.map(c => c.y));
    const b = Math.max(...cards.map(c => c.y + 4));
    let s = Math.round((h - (a + b) * g) / 2 / g) * g;
    s = Math.max(s, -Math.floor(a) * g);     // its heading never above the window
    return Math.max(end, Math.min(0, s));
  }

  private placePanel(): void {
    const panel = this.timelineSection?.nativeElement as HTMLElement | undefined;
    if (!panel) return;
    if (this.phone) {
      // while it glides the compositor moves it (glide); otherwise only a change is written
      if (this.glideAnim?.playState === 'running') return;
      this.writePanel(panel, this.shiftShown);
      return;
    }
    const shift = this.desktop() ? this.shiftShown : 0;
    panel.style.transform = shift ? `translateY(${shift.toFixed(1)}px)` : '';
  }

  /* ---- phones (Emil 23 Oct: smoother on his iPhone 11) ---- */
  /** the map drawn this many times a second while it moves */
  private static readonly PHONE_MAP_FPS = 12;
  private static readonly PHONE_FAR_ZOOM = 1.4;
  private glideAnim?: Animation;
  private panelAt = NaN;
  private writePanel(panel: HTMLElement, shift: number): void {
    const v = Math.round(shift * 10) / 10;
    if (v === this.panelAt) return;
    this.panelAt = v;
    panel.style.transform = v ? `translateY(${v.toFixed(1)}px)` : '';
  }
  /** the panel from where it is to `to` (px) in `ms`, the page's glide curve, as a compositor
      animation: an iPhone keeps it smooth even while the map is being drawn */
  private glide(to: number, ms: number): void {
    const panel = this.timelineSection?.nativeElement as HTMLElement | undefined;
    if (!panel) return;
    let from = Number.isNaN(this.panelAt) ? 0 : this.panelAt;
    if (this.glideAnim) {
      // caught mid-glide: from where it is on the screen
      if (this.glideAnim.playState === 'running') {
        const t = getComputedStyle(panel).transform;
        if (t && t !== 'none') from = new DOMMatrixReadOnly(t).m42;
      }
      this.glideAnim.cancel();
      this.glideAnim = undefined;
    }
    this.writePanel(panel, to);
    if (Math.abs(to - from) < .5 || !panel.animate || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const anim = panel.animate(
      [{ transform: `translateY(${from.toFixed(1)}px)` }, { transform: `translateY(${to.toFixed(1)}px)` }],
      { duration: ms, easing: 'cubic-bezier(0.52, 0, 0.01, 1)' });
    this.glideAnim = anim;
    anim.onfinish = () => { if (this.glideAnim === anim) this.glideAnim = undefined; };
  }

  /** the map's zoom for a part: further out before the story, closer in Germany */
  private zoomShown = NaN;
  private zoomOf(part: number): number {
    // before the story: a little further out than the places (as on the desktop: Emil 23 Oct)
    if (part <= 0) return Timeline.PHONE_FAR_ZOOM;
    return PLACES.indexOf(this.placeOfPart(part)) >= PLACES.indexOf('ludwigshafen' as typeof PLACES[number]) ? 3.2 : 2;
  }
  private setZoom(z: number): void {
    const wrap = (this.mapSection?.nativeElement as HTMLElement | undefined)?.parentElement;
    const v = Math.round(z * 1000) / 1000;
    if (!wrap || v === this.zoomShown) return;
    this.zoomShown = v;
    wrap.style.setProperty('--map-zoom', String(v));
    // smaller than its square: the drawing past it shows (timeline.scss .zoom-out)
    if (wrap.classList.contains('zoom-out') !== v < 1) wrap.classList.toggle('zoom-out', v < 1);
  }

  private calculateMapHeight(): void {
    // always an odd number of cells, so the pin has a true middle cell to sit in
    if (isDesktop()) {
      const cell = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dynamic-grid-size')) || 21;
      let rows = Math.round(this.gridService.getMaxHeight(5) / cell);   // window minus title row, gap and a cell below
      if (rows % 2 === 0) rows -= 1;
      this.mapHeight = Math.max(9, rows) * cell;
    } else {
      this.gridService.gridWidth$.subscribe(data => {
        this.grid = data;
        this.mapHeight = 9 * this.grid;
      });
    }
  }

  ngOnDestroy(): void {
    // Clean up everything
    this.destroy$.next();
    this.destroy$.complete();

    clearTimeout(this.resizeTimer);
    cancelAnimationFrame(this.partRaf);
    cancelAnimationFrame(this.slackRaf);
    this.unregisterStory?.();
    this.unregisterPhone?.();
    window.removeEventListener('scroll', this.onScroll);
    cancelAnimationFrame(this.scrollFrame);
    cancelAnimationFrame(this.mapRaf);
    this.visibilityObserver?.disconnect();

    if (this.mapAnimation) {
      this.mapAnimation.destroy();
    }
  }
}