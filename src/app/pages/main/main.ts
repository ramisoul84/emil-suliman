import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, OnInit, ViewChild, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { BlurService } from '../../_services/blur.service';
import { Header } from "../../components/header/header";
import { Home } from "../../sections/home/home";
import { About } from "../../sections/about/about";
import { Timeline } from "../../sections/timeline/timeline";
import { Cases } from "../../sections/cases/cases";
import { Solidarity } from "../../sections/solidarity/solidarity";
import { Contact } from "../../sections/contact/contact";
import { Footer } from "../../components/footer/footer";
import { AnalyticsService } from '../../_services/analytics.service';
import { GridFx } from '../../components/grid-fx/grid-fx';
import { SideMenu } from '../../components/side-menu/side-menu';
import { PageScrollService } from '../../_services/page-scroll.service';
import { ThemeService } from '../../_services/theme.service';
import { SHOW_SOLIDARITY } from '../../_config/sections';
import { isPhone } from '../../_config/phone';
import { IntroService } from '../../_services/intro.service';
import { BlobService } from '../../_services/blob.service';
import { PhonePagerService } from '../../_services/phone-pager.service';

/** the curtain plays once per visit (not again when coming back from the imprint) */
let curtainShown = false;

/** Elements whose height is snapped up to whole grid cells (see snapToGrid). */
const SNAP_SELECTOR = 'section, [data-snap]';

@Component({
  selector: 'app-main',
  imports: [Header, Home, About, Timeline, Cases, Solidarity, Contact, Footer, GridFx, SideMenu],
  templateUrl: './main.html',
  styleUrl: './main.scss',
})
export class Main implements OnInit, AfterViewInit, OnDestroy {
  readonly showSolidarity = SHOW_SOLIDARITY;

  /* ---- phones: the curtain (main.html, main.scss) ----------------------------------------
     It covers the page white at once; when the LCD letters are there it comes down, holds,
     and drops away. The page is already all in place under it (no way in of its own). */
  readonly curtain = signal(false);
  readonly curtainPlay = signal(false);
  private curtainTimers: any[] = [];
  private readonly intro = inject(IntroService);
  private readonly blobService = inject(BlobService);
  private readonly phonePager = inject(PhonePagerService);
  private menuSub?: Subscription;

  private startCurtain(): void {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (curtainShown || !isPhone()) return;
    curtainShown = true;
    this.intro.skip();
    if (reduced) return;
    this.curtain.set(true);
    const go = () => {
      if (this.curtainPlay()) return;
      this.alignCurtain();
      this.curtainPlay.set(true);
    };
    // the letters first (at most a moment): the name must be readable on the way down
    (document.fonts?.load('26px lcd_solidregular') ?? Promise.resolve()).then(() => setTimeout(go, 80), go);
    this.curtainTimers.push(setTimeout(go, 1200));
    // whatever happens, never leave the page covered
    this.curtainTimers.push(setTimeout(() => this.curtainDone(), 4500));
  }

  /** the curtain's name exactly over the page's own, line for line (Emil 22 Oct): as the
      curtain runs down past them its white words turn into the page's black ones */
  private alignCurtain(): void {
    const text = this.host.nativeElement.querySelector<HTMLElement>('.curtain-text');
    const lines = this.host.nativeElement.querySelectorAll<HTMLElement>('#home .current-text:not(.light) .ln');
    const g = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dynamic-grid-size'));
    if (!text || !lines.length || !g) return;
    const r = lines[0].getBoundingClientRect();
    if (!r.height) return;
    // the first line's middle = the curtain's first row's middle (rows 3 cells tall)
    text.style.top = `${Math.round(r.top + r.height / 2 - 1.5 * g)}px`;
    text.style.transform = 'none';
  }

  curtainDone(): void {
    this.curtain.set(false);
  }
  isBlur: boolean = false;
  @ViewChild('main') private mainRef?: ElementRef<HTMLElement>;
  private blurSub?: Subscription;

  private resizeObserver?: ResizeObserver;
  private mutationObserver?: MutationObserver;
  private restObserver?: IntersectionObserver;
  private snapFrame = 0;

  constructor(
    private analyticsService: AnalyticsService,
    private host: ElementRef<HTMLElement>,
    private ngZone: NgZone,
    private pageScroll: PageScrollService,
    private blurService: BlurService,
    _theme: ThemeService, /* the chosen colours, applied from the start */
  ) { }

  ngOnInit(): void {
    this.startCurtain();
    this.analyticsService.trackVisit();
  }

  ngAfterViewInit(): void {
    // page-by-page scrolling with a soft glide (mouse / trackpad / keyboard)
    this.pageScroll.attach(this.host.nativeElement);
    // the menu open: the whole page breaks up into grid-cell blocks; closed: it comes back
    this.blurSub = this.blurService.blurState$.subscribe(open =>
      this.ngZone.runOutsideAngular(() => this.pixelate(open)));
    this.ngZone.runOutsideAngular(() => this.restOffscreen());
    // phones: one page at a time, the curtain between them (phone-pager.service); not while
    // the menu is open
    let menuOpen = false;
    this.menuSub = this.blurService.blurState$.subscribe(open => menuOpen = open);
    this.phonePager.blocked = () => menuOpen;
    this.phonePager.attach(this.host.nativeElement);
    if (typeof ResizeObserver === 'undefined') return;
    this.ngZone.runOutsideAngular(() => {
      this.resizeObserver = new ResizeObserver(() => this.scheduleSnap());
      this.observeTargets();
      // sections that render later (@defer, @if) need observing too
      this.mutationObserver = new MutationObserver(() => this.observeTargets());
      this.mutationObserver.observe(this.host.nativeElement, { childList: true, subtree: true });
      this.scheduleSnap();
    });
  }

  ngOnDestroy(): void {
    this.blurSub?.unsubscribe();
    clearTimeout(this.pixelTimer);
    window.removeEventListener('scroll', this.onPixelScroll);
    window.removeEventListener('resize', this.onPixelScroll);
    this.pageScroll.detach();
    this.resizeObserver?.disconnect();
    this.mutationObserver?.disconnect();
    this.restObserver?.disconnect();
    this.menuSub?.unsubscribe();
    this.phonePager.detach();
    cancelAnimationFrame(this.snapFrame);
    this.curtainTimers.forEach(t => clearTimeout(t));
  }

  /**
   * A page out of the window rests: its CSS loops (the About symbols and motifs, the hint
   * chevrons) and its SVG animations hold still until any of it comes back in, so only the
   * page you are looking at costs frames. Nothing visible changes: they go on from where
   * they stopped.
   */
  private restOffscreen(): void {
    if (typeof IntersectionObserver === 'undefined') return;
    this.restObserver = new IntersectionObserver(entries => {
      for (const e of entries) {
        const off = !e.isIntersecting;
        const el = e.target as HTMLElement;
        if (el.classList.contains('resting') === off) continue;
        el.classList.toggle('resting', off);
        el.querySelectorAll('svg').forEach(svg => {
          if (svg.ownerSVGElement) return;
          if (off) svg.pauseAnimations(); else svg.unpauseAnimations();
        });
      }
    });
    this.observeRest();
  }

  private observeRest(): void {
    this.host.nativeElement.querySelectorAll<HTMLElement>('section[id]')
      .forEach(el => this.restObserver?.observe(el));
  }

  private observeTargets(): void {
    this.observeRest();
    this.host.nativeElement.querySelectorAll<HTMLElement>(SNAP_SELECTOR)
      .forEach(el => this.resizeObserver?.observe(el));
  }

  private scheduleSnap(): void {
    if (this.snapFrame) return;
    this.snapFrame = requestAnimationFrame(() => {
      this.snapFrame = 0;
      this.snapToGrid();
    });
  }

  /**
   * Keep everything on the page grid: text-driven blocks (and the 500px minimum of the
   * hero) rarely come out a whole number of grid cells tall, which pushes every section
   * below them off the grid lines. Each target gets `--snap` = the pixels missing to the
   * next whole cell; CSS adds it as bottom margin (sections) or padding (framed boxes).
   * `data-snap="2"` measures a box whose frame sticks 2px past the cell edge.
   */
  private snapToGrid(): void {
    const g = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dynamic-grid-size'));
    if (!g) return;
    this.host.nativeElement.querySelectorAll<HTMLElement>(SNAP_SELECTOR).forEach(el => {
      const own = el.style.getPropertyValue('--snap');
      const previous = parseFloat(own) || 0;
      const extra = parseFloat(el.dataset['snap'] || '0') || 0;
      // height without the snap we added last time (padding-based snaps sit inside the box)
      const inside = el.matches('section') ? 0 : previous;
      const h = el.getBoundingClientRect().height - inside - extra;
      const pad = Math.max(0, Math.ceil(h / g - 0.01) * g - h);
      // always set it on the element itself: custom properties inherit, and a nested
      // target must not pick up its section's value
      if (!own || Math.abs(pad - previous) > 0.05) el.style.setProperty('--snap', `${pad.toFixed(2)}px`);
    });
  }

  /* ---- the menu's pixel effect --------------------------------------------------------
     Like an image loading pixel by pixel, at 12 frames a second: opening the menu breaks the
     page up in 3 frames (a quarter cell, half a cell, a whole grid cell) and holds it there;
     closing it plays back down to sharp. The blocks start at the page's grid origin, so the
     last step sits exactly in the grid's cells. */
  private pixelStep = 0;          // 0 sharp … 3 whole cells
  private pixelTimer: any = 0;
  private readonly onPixelScroll = () => this.placePixelRegion();

  private pixelate(open: boolean): void {
    clearTimeout(this.pixelTimer);
    const target = open ? 3 : 0;
    // phones (Emil 22 Oct): in one step, at once, with the X
    if (isPhone()) {
      if (this.pixelStep === target) return;
      this.pixelStep = target;
      this.applyPixels();
      return;
    }
    const step = () => {
      if (this.pixelStep === target) return;
      this.pixelStep += Math.sign(target - this.pixelStep);
      this.applyPixels();
      if (this.pixelStep !== target) this.pixelTimer = setTimeout(step, 1000 / 12);
    };
    step();
  }

  /** iPhones (every browser there is Safari's engine) leave parts of the page out of an SVG
      filter: there the page goes soft under the grid instead, which takes everything */
  private readonly webkitPhone = typeof navigator !== 'undefined' && isPhone() &&
    (/iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
  private gridVeil?: HTMLElement;

  private softPixels(on: boolean): void {
    const main = this.mainRef?.nativeElement;
    if (!main) return;
    main.classList.toggle('soft-cells', on);
    if (!on) { this.gridVeil?.remove(); this.gridVeil = undefined; this.holdStill(false); return; }
    this.holdStill(true);
    // the page's grid, crisp over the softened page, on the same lines
    const g = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dynamic-grid-size')) || 13;
    const r = main.getBoundingClientRect();
    const veil = this.gridVeil ??= document.body.appendChild(document.createElement('div'));
    veil.className = 'grid-veil';
    veil.setAttribute('aria-hidden', 'true');
    veil.style.backgroundSize = `${g}px ${g}px`;
    veil.style.backgroundPosition = `${(r.left % g + g) % g}px ${(r.top % g + g) % g}px`;
  }

  private applyPixels(): void {
    const main = this.mainRef?.nativeElement;
    if (!main) return;
    if (this.webkitPhone) { this.softPixels(this.pixelStep > 0); return; }
    if (this.pixelStep === 0) {
      main.style.filter = '';
      this.holdStill(false);
      window.removeEventListener('scroll', this.onPixelScroll);
      window.removeEventListener('resize', this.onPixelScroll);
      return;
    }
    this.placePixelRegion();
    if (!main.style.filter) {
      this.holdStill(true);
      main.style.filter = 'url(#menu-pixels)';
      window.addEventListener('scroll', this.onPixelScroll, { passive: true });
      window.addEventListener('resize', this.onPixelScroll, { passive: true });
    }
  }

  /**
   * While the page is broken up, it holds still (styles.scss .pixelating): nothing moves under
   * the filter, so it is worked out once per step instead of every frame (it was slow on
   * phones), and nothing is drawn on a layer of its own, which an iPhone leaves out of the
   * filter (the blob, the videos, the moving motifs stayed sharp). The blob and any video in
   * view are shown as still pictures meanwhile.
   */
  private stills: (() => void)[] = [];
  private blobWasRunning = false;
  private holdStill(on: boolean): void {
    const main = this.mainRef?.nativeElement;
    if (!main) return;
    this.stills.forEach(undo => undo());
    this.stills = [];
    if (!on) {
      main.classList.remove('pixelating');
      if (this.blobWasRunning) this.blobService.resume();
      this.blobWasRunning = false;
      return;
    }
    main.classList.add('pixelating');
    this.blobWasRunning = !this.blobService.state().isPaused;
    if (this.blobWasRunning) this.blobService.pause();
    const seen = (el: Element) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.bottom > 0 && r.top < window.innerHeight;
    };
    // the blob: its canvas as the box's background picture
    main.querySelectorAll<HTMLCanvasElement>('app-blob canvas').forEach(c => {
      const box = c.parentElement;
      if (!box || !seen(c)) return;
      try {
        box.style.background = `url(${c.toDataURL()}) 0 0 / 100% 100% no-repeat`;
        box.style.imageRendering = 'pixelated';
        c.style.visibility = 'hidden';
        this.stills.push(() => { box.style.background = ''; box.style.imageRendering = ''; c.style.visibility = ''; });
      } catch { /* left as it is */ }
    });
    // a video: its frame as a picture in its place
    main.querySelectorAll<HTMLVideoElement>('video').forEach(v => {
      if (!seen(v) || v.readyState < 2 || !v.videoWidth) return;
      try {
        const k = Math.min(1, 960 / v.videoWidth);
        const cv = document.createElement('canvas');
        cv.width = Math.round(v.videoWidth * k);
        cv.height = Math.round(v.videoHeight * k);
        cv.getContext('2d')!.drawImage(v, 0, 0, cv.width, cv.height);
        const img = document.createElement('img');
        const cs = getComputedStyle(v);
        img.src = cv.toDataURL('image/jpeg', .8);
        img.alt = '';
        img.style.cssText = `position:absolute;left:${v.offsetLeft}px;top:${v.offsetTop}px;width:${v.offsetWidth}px;height:${v.offsetHeight}px;` +
          `max-width:none;object-fit:${cs.objectFit};object-position:${cs.objectPosition};z-index:${cs.zIndex === 'auto' ? 1 : cs.zIndex};pointer-events:none;margin:0`;
        const wasPlaying = !v.paused;
        v.pause();
        v.after(img);
        v.style.visibility = 'hidden';
        this.stills.push(() => { img.remove(); v.style.visibility = ''; if (wasPlaying) v.play().catch(() => { }); });
      } catch { /* left as it is */ }
    });
  }

  /**
   * Filter only what is on screen (and a cell around it): the page is very tall. The filter's
   * space is the page's own (its grid origin at 0, 0), so the sampling tile starts on a grid
   * corner inside that region: blocks of b px, one sample from the middle of each.
   */
  private placePixelRegion(): void {
    const main = this.mainRef?.nativeElement;
    const filter = document.getElementById('menu-pixels');
    if (!main || !filter || this.pixelStep === 0) return;
    const g = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dynamic-grid-size')) || 21;
    const b = this.pixelStep === 3 ? g : Math.max(2, Math.round(g / (this.pixelStep === 2 ? 2 : 4)));
    const r = main.getBoundingClientRect();
    const x = -g;
    const y = Math.floor(-r.top / g) * g - g;          // whole cells from the grid origin
    const s = Math.floor((b - 1) / 2);
    const set = (el: Element | null, attrs: Record<string, number>) => {
      for (const [k, v] of Object.entries(attrs)) el?.setAttribute(k, String(v));
    };
    set(filter, { x, y, width: Math.ceil(r.width / g) * g + 2 * g, height: Math.ceil(window.innerHeight / g) * g + 3 * g });
    set(filter.querySelector('feGaussianBlur'), { stdDeviation: Math.max(0.5, b / 4) });
    set(filter.querySelector('feFlood'), { x: x + s, y: y + s });
    set(filter.querySelector('feComposite:not([in])'), { x, y, width: b, height: b });
    set(filter.querySelector('feMorphology'), { radius: Math.ceil((b - 1) / 2) });
  }
}
