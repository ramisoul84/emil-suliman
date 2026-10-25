import { AfterViewInit, Component, ElementRef, HostListener, NgZone, OnDestroy, OnInit, ViewChild, effect, inject, signal } from '@angular/core';
import { distinctUntilChanged, Subscription } from 'rxjs';

import { gsap } from 'gsap';
import { GridService } from '../../_services/grid.service';
import { TranslateModule } from '@ngx-translate/core';
import { BlurService } from '../../_services/blur.service';
import { LanguageService } from '../../_services/language.service';
import { PageScrollService } from '../../_services/page-scroll.service';
import { IntroService } from '../../_services/intro.service';
import { isPhone } from '../../_config/phone';
import { CommonModule } from '@angular/common';
import { SHOW_SOLIDARITY } from '../../_config/sections';


/** the menu's box, px from the nav's left edge */
interface Span { x0: number; x1: number; }

/**
 * The bar moves at 12 frames a second, like the rest of the site: a tween's times are put
 * on the 1/12 s clock (so all the rows step together) and its ease is held in 1/12 s steps.
 */
const FRAME = 1 / 12;
const onClock = (s: number) => Math.max(0, Math.round(s / FRAME)) * FRAME;
function at12fps<T extends gsap.TweenVars>(vars: T, cell = 0): T {
  const out: gsap.TweenVars = { ...vars };
  // the bar's rows: every frame in whole grid cells, so the bar always sits on the grid
  if (cell) {
    const snap: Record<string, number> = {};
    for (const k of ['width', 'height']) if (k in vars) snap[k] = cell;
    out.snap = snap;
  }
  const duration = onClock(typeof vars.duration === 'number' ? vars.duration : 0.5) || FRAME;
  out.duration = duration;
  if (typeof vars.delay === 'number') out.delay = onClock(vars.delay);
  if (typeof vars.stagger === 'number') out.stagger = onClock(vars.stagger) || FRAME;
  const ease = gsap.parseEase(typeof vars.ease === 'string' ? vars.ease : 'power1.out');
  const n = Math.max(1, Math.round(duration / FRAME));
  out.ease = (t: number) => ease(Math.min(1, Math.ceil(t * n - 1e-6) / n));
  return out as T;
}

@Component({
  selector: 'app-header',
  imports: [TranslateModule, CommonModule],
  templateUrl: './header.html',
  styleUrl: './header.scss'
})
export class Header implements OnInit, AfterViewInit, OnDestroy {
  private compactThreshold: number = 400;
  private isCompact: boolean = false;
  /** the hamburger shows (unfolding from the logo) — see .hamburger-menu.shown */
  readonly compact = signal(false);
  /** the name has turned into the logo once: from then on it plays back when the bar opens */
  readonly logoPlayed = signal(false);
  private isFirstLoad: boolean = true;
  private isAnimating: boolean = false;
  showMenu: boolean = false;
  private gridWidth: number = 20;
  private subscriptions = new Subscription();
  private scrollListener: any;

  isEnglish: boolean = true
  /** solidarity is off for now (_config/sections.ts) */
  readonly showSolidarity = SHOW_SOLIDARITY;

  @ViewChild('nav') private navRef?: ElementRef<HTMLElement>;
  @ViewChild('marker') private markerRef?: ElementRef<HTMLElement>;
  private readonly zone = inject(NgZone);
  private readonly host = inject(ElementRef<HTMLElement>);

  /* ---- the way in (intro.service.ts): once the second row shows, a pink bar wipes over the name
     (frames 2-9) and one over the menu (4-14); each leaves its words there once it covers
     them (frames 4 and 8) */
  private readonly intro = inject(IntroService);
  readonly introOn = signal(false);
  private introShown = { name: false, menu: false };
  private readonly introSteps = effect(() => {
    const f = this.intro.frame();
    if (f < 0) return;
    if (f < 15 && !this.introOn() && !this.introShown.menu) { this.placeWipes(); this.introOn.set(true); }
    if (f >= 4 && !this.introShown.name) {
      this.introShown.name = true;
      const logo = this.host.nativeElement.querySelector('.logo-img') as HTMLElement | null;
      if (logo) logo.style.opacity = '1';
    }
    if (f >= 8 && !this.introShown.menu) {
      this.introShown.menu = true;
      if (!this.isCompact) gsap.set('nav p', { opacity: 1 });
    }
    if (f >= 15 && this.introOn()) this.introOn.set(false);
  });

  /** the bars on the second row: over the name (as drawn by the strip, 1.1-7.7 cells) and from
      the first word of the menu to just past the last (none when the menu isn't on the bar) */
  private placeWipes(): void {
    const header = this.host.nativeElement.querySelector('header') as HTMLElement | null;
    const words = this.navRef?.nativeElement.querySelectorAll('p');
    if (!header) return;
    const g = this.gridWidth, h = header.getBoundingClientRect();
    // the bars' frames on the same clock as the rest (this runs a moment after frame 0 began)
    header.style.setProperty('--wipe-lag', `${Math.max(0, performance.now() - this.intro.t0)}ms`);
    header.style.setProperty('--wa-l', `${1.1 * g}px`);
    header.style.setProperty('--wa-w', `${6.6 * g}px`);
    header.style.setProperty('--wb-w', '0px');
    if (words?.length) {
      // from where the first word's letters start to a little past the last word's
      const letters = (p: Element) => { const r = document.createRange(); r.selectNodeContents(p); return r.getBoundingClientRect(); };
      const a = letters(words[0]), b = letters(words[words.length - 1]);
      if (a.width && b.width) {
        const x0 = a.left - h.left;
        const x1 = b.right - h.left + .8 * g;
        header.style.setProperty('--wb-l', `${x0}px`);
        header.style.setProperty('--wb-w', `${x1 - x0}px`);
      }
    }
  }

  constructor(
    private gridService: GridService,
    private blurService: BlurService,
    public languageService: LanguageService,
    private pageScroll: PageScrollService,
  ) {
    this.isEnglish = this.languageService.isEnglish();
  }

  ngOnInit() {
    this.isCompact = false;
    this.isAnimating = false;
    this.subscriptions.add(
      this.gridService.gridWidth$.pipe(
        distinctUntilChanged()
      ).subscribe(gridWidth => {
        this.gridWidth = gridWidth;
        if (this.isFirstLoad) {
          if (this.phone) this.phoneLoad(); else this.headerLoad();
        }
      })
    );
    this.scrollListener = this.handleScroll.bind(this);
    // outside Angular: a scroll (every frame of a glide) only comes in when the bar changes
    this.zone.runOutsideAngular(() => window.addEventListener('scroll', this.scrollListener, { passive: true }));

  }
  private latestScrollRequest: number = 0;

  private handleScroll(): void {
    if (this.phone) return;   // phones: always the logo box and the menu
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;
    const toCompact = scrollY > this.compactThreshold;

    this.latestScrollRequest = scrollY;

    if (this.isAnimating) {
      return;
    }

    if (toCompact !== this.isCompact) this.zone.run(() => this.processScrollState(toCompact));
  }

  // Call this at the end of your animations
  private checkPendingScroll(): void {
    if (!this.isAnimating) {
      // Use the stored latest scroll position instead of current scroll
      const toCompact = this.latestScrollRequest > this.compactThreshold;

      // Only change state if different from current
      if ((toCompact && !this.isCompact) || (!toCompact && this.isCompact)) {
        this.processScrollState(toCompact);
      }
    }
  }

  private processScrollState(toCompact: boolean): void {
    if (toCompact && !this.isCompact) {
      this.headerCompact();
    } else if (!toCompact && this.isCompact) {
      this.headerExtended();
      this.sideNavHide();
      this.showMenu = false;
      this.blurService.setBlur(false);
      this.blurService.setSlide(-1)
    }
  }


  /** phones: the bar stays folded into the logo box, the menu beside it, from the start (the
      curtain opens the page instead, main.ts; Emil's Comp 13) */
  private readonly phone = isPhone();
  readonly logoStill = signal(false);

  private phoneLoad(): void {
    this.isFirstLoad = false;
    this.isCompact = true;
    const g = this.gridWidth;
    // the logo box and the menu 4 x 4 cells on phones (Emil 22 Oct)
    gsap.set('.line1', { width: 4 * g, height: 4 * g });
    gsap.set('.line2, .line3', { width: 4 * g, height: g });
    gsap.set('.line4, .line5, .line6', { height: 0 });
    gsap.set('nav p', { opacity: 0, display: 'none' });
    this.logoStill.set(true);
    this.compact.set(true);
    this.logoPlayed.set(true);
    const logo = this.host.nativeElement.querySelector('.logo-img') as HTMLElement | null;
    if (logo) logo.style.opacity = '1';
  }

  private headerLoad(): void {
    this.isAnimating = true
    setTimeout(() => {
      this.isAnimating = false;
      this.isFirstLoad = false;
    }, 1300)
    // once the grid has faded in (main.scss, 3 frames) the rows come down one after another,
    // each growing to its cell in 12 fps steps (no longer popping in whole); the way in (the
    // pink bars, the name, ...) starts the moment the second row is half down
    const second = this.host.nativeElement.querySelector('.line2') as HTMLElement | null;
    const half = this.gridWidth / 2;
    gsap.fromTo(".line", { height: 0 },
      at12fps({
        height: this.gridWidth, duration: 0.6, delay: 0.25, stagger: 0.1, ease: "power2.inOut",
        // (the height the tween gives it, not the rule's before the tween has set it)
        onUpdate: () => { if (this.intro.frame() < 0 && parseFloat(second?.style.height || '0') >= half) this.intro.begin(); },
        onComplete: () => this.intro.begin(),
      }))
    // (in case the rows are stopped on the way: the way in all the same)
    setTimeout(() => this.intro.begin(), 2000);
  }



  private headerCompact(): void {
    const full = (document.querySelector('header') as HTMLElement | null)?.clientWidth || window.innerWidth;
    this.markerOff();
    gsap.killTweensOf(this.host.nativeElement.querySelectorAll("*"));
    this.isAnimating = true;

    setTimeout(() => {
      this.isCompact = true;
      this.isAnimating = false;
      this.checkPendingScroll();
    }, 2200)

    gsap.fromTo(".line6", { height: this.gridWidth }, at12fps({ height: 0, duration: 0.4, ease: "power2.inOut", overwrite: true }))
    gsap.fromTo(".line5", { height: this.gridWidth }, at12fps({ height: 0, duration: 0.4, delay: 0.1, ease: "power2.inOut", overwrite: true }),)
    gsap.fromTo(".line4", { height: this.gridWidth }, at12fps({ height: 0, duration: 0.4, delay: 0.2, ease: "power2.inOut", overwrite: true }),)
    gsap.fromTo("nav p", { opacity: 1 }, at12fps({ opacity: 0, display: "none", duration: 0.4, delay: 0.2, ease: "power2.inOut", overwrite: true }))
    gsap.fromTo(".line3", { width: full }, at12fps({ width: 3 * this.gridWidth, duration: 0.4, delay: 0.6, ease: "power3.inOut", overwrite: true }, this.gridWidth))
    gsap.fromTo(".line2", { width: full }, at12fps({ width: 3 * this.gridWidth, duration: 0.4, delay: 0.6, ease: "power3.inOut", overwrite: true }, this.gridWidth))
    gsap.fromTo(".line1", { width: full, height: this.gridWidth }, at12fps({
      width: 3 * this.gridWidth, height: 3 * this.gridWidth, duration: 0.4, delay: 0.6, ease: "power3.inOut", overwrite: true
    }, this.gridWidth))
    // ...then the menu button unfolds out of the logo box (CSS: .hamburger-menu.shown, 1 s in);
    // the name breaks up into e's and grows into the box meanwhile (CSS: .logo-anim.to-logo)
    this.compact.set(true);
    this.logoPlayed.set(true);
  }

  private headerExtended(): void {
    this.isAnimating = true;
    gsap.killTweensOf(this.host.nativeElement.querySelectorAll("*"));

    setTimeout(() => {
      this.isCompact = false;
      this.isAnimating = false;
      this.checkPendingScroll();
    }, 1650)

    // the reverse: the menu button folds back into the logo (3 frames), then the bar grows
    // out of the logo box to the full width and its fading rows come back
    this.compact.set(false);
    const D = 0.25;
    // grow back to the bar's full width in px (a '%' end would be tweened, and snapped to
    // whole cells, in % - which made the bar blink out); the rule's 100 % again at the end
    const full = (document.querySelector('header') as HTMLElement | null)?.clientWidth || window.innerWidth;
    gsap.fromTo(".line1", { width: 3 * this.gridWidth, height: 3 * this.gridWidth }, at12fps({ width: full, clearProps: "width", height: this.gridWidth, duration: 0.4, delay: D, ease: "power3.inOut", overwrite: true }, this.gridWidth))
    gsap.fromTo(".line2", { width: 3 * this.gridWidth }, at12fps({ width: full, clearProps: "width", duration: 0.4, delay: D, ease: "power3.inOut", overwrite: true }, this.gridWidth))
    gsap.fromTo(".line3", { width: 3 * this.gridWidth }, at12fps({ width: full, clearProps: "width", duration: 0.4, delay: D, ease: "power3.inOut", overwrite: true }, this.gridWidth))
    gsap.fromTo("nav p", { opacity: 0, display: "none" }, at12fps({ opacity: 1, display: "flex", duration: 0.4, delay: D + 0.4, ease: "power2.inOut", overwrite: true }))
    gsap.fromTo(".line4", { height: 0 }, at12fps({ height: this.gridWidth, duration: 0.4, delay: D + 0.4, ease: "power2.inOut", overwrite: true }))
    gsap.fromTo(".line5", { height: 0 }, at12fps({ height: this.gridWidth, duration: 0.4, delay: D + 0.5, ease: "power2.inOut", overwrite: true }))
    gsap.fromTo(".line6", { height: 0 }, at12fps({
      height: this.gridWidth, duration: 0.4, delay: D + 0.6, ease: "power2.inOut", overwrite: true
    }))
  }

  @HostListener('window:resize')
  onWindowResize() {
    this.gridService.gridWidth$.subscribe(width => this.update(width))
  }

  update(width: number): void {
    if (this.isAnimating) return;

    if (this.isCompact) {
      const k = this.phone ? 4 : 3;
      gsap.set(" .line1", { height: k * width, width: k * width })
      gsap.set(" .line2, .line3", { height: width, width: k * width })
    } else if (!this.isCompact) {
      gsap.set(" .line", { height: width })
    }

  }

  goToSection(section: string) {
    try {
      const element = document.getElementById(section);
      //this.gaService.event('section_click', section, 'engagement');

      if (element) {
        this.blurService.setBlur(false);
        this.showMenu = false;
        this.sideNavHide();

        setTimeout(() => {
          // Check if element still exists and is in DOM
          if (document.contains(element)) {
            // same glide as scrolling page by page; the browser's own smooth scroll otherwise
            if (!this.pageScroll.scrollToElement(element)) {
              element.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
              });
            }
          }
        }, 300);
      } else {
        console.warn(`Section '${section}' not found`);
      }
    } catch (error) {
      console.error('Error navigating to section:', error);
    }
  }

  toggleMenu(): void {
    //this.showMenu = !this.showMenu;
    if (!this.showMenu) {
      this.sideNavShow();
      this.showMenu = true
      setTimeout(() => {
        const firstMenuItem = document.querySelector('.side-nav p');
        (firstMenuItem as HTMLElement)?.focus();
      }, 400);
    } else {
      this.sideNavHide()
      this.showMenu = false
    }

    this.blurService.setBlur(this.showMenu)
    this.blurService.setSlide(-1)
  }

  /** phones: the menu grows down out of the logo and the button, its frame all round at
      every step, like the colour card (12 fps), and folds back up (header.scss) */
  private navTimer = 0;
  private phoneNav(open: boolean): void {
    const nav = document.querySelector<HTMLElement>('header .side-nav');
    if (!nav) return;
    clearTimeout(this.navTimer);
    if (open) { nav.classList.remove('ph-closing'); nav.classList.add('ph-open'); return; }
    if (!nav.classList.contains('ph-open')) return;
    nav.classList.remove('ph-open');
    nav.classList.add('ph-closing');
    this.navTimer = window.setTimeout(() => nav.classList.remove('ph-closing'), 260);
  }

  sideNavShow(): void {
    if (this.phone) { this.phoneNav(true); return; }
    gsap.fromTo(".side-nav",
      {
        x: 0,
        scale: 0,
        opacity: 0,
      },
      {
        scale: 1,
        opacity: 1,
        transformOrigin: "100% 0%",
        duration: 0.4,
        ease: "power3.out"
      }
    );
  }

  sideNavHide(): void {
    if (this.phone) { this.phoneNav(false); return; }
    const tl = gsap.timeline();
    tl.fromTo(".side-nav",
      {
        x: 0,
        opacity: 1,
      },
      {
        x: "-100%",
        opacity: 0,
        duration: 0.4,
        ease: "power3.out"
      }
    );
    tl.to(".side-nav",
      {
        x: 0,
        scale: 0,
        opacity: 0,
        duration: 0,
      },
    );
  }

  toggleLanguage(): void {
    this.isEnglish = !this.isEnglish;
    this.languageService.toggleLanguage();
    this.blurService.setBlur(false);
    this.showMenu = false;
    this.sideNavHide();
  }



  /* ---- the menu's box -----------------------------------------------------------------
     Like the side menu's (side-menu.ts), turned on its side: a magenta box of whole grid
     cells behind the word under the mouse, moving at 12 frames a second with the frames of
     Emil's wing video. It unfolds from the word's left, travels to the next word leading
     edge first (the back edge follows), and folds away to the right when the mouse leaves. */
  private static readonly LEAD = [0.6, 0.92, 1];
  private static readonly TRAIL = [0.15, 0.65, 0.93, 1];
  private span: Span | null = null;          // where the box is
  private frames: (Span | null)[] = [];      // still to play
  private hot: HTMLElement | null = null;    // the word it is on (or heading to)
  private markerTimer = 0;
  private offNav: (() => void)[] = [];

  /* the bar's colours flowing down its rows (header.scss .line): the meeting point swings
     between a third and two thirds, a sine in eighths of 12 s, each eighth in 18 steps; each row
     8 frames after the one above. Set here 12 times a second rather than as a css animation of
     a registered property, which restyled the page every screen frame (Emil 22 Oct: iPhone) */
  private static readonly FLOW = [50, 61.3, 66, 61.3, 50, 38.7, 34, 38.7, 50];
  private flowTimer = 0;
  private startFlow(): void {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const rows = Array.from((this.host.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('header .line'));
    if (!rows.length) return;
    const last: string[] = [];
    const tick = () => {
      if (document.hidden) return;
      const now = performance.now() / 1000;
      rows.forEach((row, i) => {
        const t = (((now + 8 * i / 12) % 12) + 12) % 12;
        const e = Math.min(7, Math.floor(t / 1.5));
        const f = Math.floor(((t - e * 1.5) / 1.5) * 18) / 18;
        const v = `${(Header.FLOW[e] + (Header.FLOW[e + 1] - Header.FLOW[e]) * f).toFixed(2)}%`;
        if (v !== last[i]) { last[i] = v; row.style.setProperty('--hmid', v); }
      });
    };
    tick();
    this.zone.runOutsideAngular(() => this.flowTimer = window.setInterval(tick, 1000 / 12));
  }

  ngAfterViewInit(): void {
    this.startFlow();
    const nav = this.navRef?.nativeElement;
    if (!nav) return;
    this.sizeNav();
    document.fonts?.ready.then(() => this.sizeNav());
    if (typeof ResizeObserver !== 'undefined') {
      // the words change size (the font arriving, the language, the grid): size again
      let pending = 0;
      const ro = new ResizeObserver(() => {
        if (!pending) pending = requestAnimationFrame(() => { pending = 0; this.sizeNav(); });
      });
      ro.observe(document.documentElement);
      // the words themselves changing (the language): size again
      const mo = new MutationObserver(() => {
        if (!pending) pending = requestAnimationFrame(() => { pending = 0; this.sizeNav(); });
      });
      mo.observe(nav, { subtree: true, characterData: true, childList: true });
      this.offNav.push(() => { ro.disconnect(); mo.disconnect(); cancelAnimationFrame(pending); });
    }
    this.zone.runOutsideAngular(() => {
      const over = (e: PointerEvent) => {
        const p = (e.target as HTMLElement | null)?.closest?.('p');
        if (p && nav.contains(p) && p !== this.hot) this.markerTo(p as HTMLElement);
      };
      const leave = () => this.markerTo(null);
      nav.addEventListener('pointerover', over);
      nav.addEventListener('pointerleave', leave);
      this.offNav.push(() => nav.removeEventListener('pointerover', over), () => nav.removeEventListener('pointerleave', leave));
    });
  }

  /** the box on a word: the same room on both sides of the word (not tied to the grid) */
  private spanFor(p: HTMLElement): Span | null {
    const nav = this.navRef?.nativeElement;
    if (!nav || !p.offsetWidth) return null;
    const g = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dynamic-grid-size')) || 0;
    // the word itself, measured where it is drawn (the item around it is whole cells)
    const range = document.createRange();
    range.selectNodeContents(p);
    const word = range.getBoundingClientRect(), box = nav.getBoundingClientRect();
    if (!word.width) return { x0: p.offsetLeft, x1: p.offsetLeft + p.offsetWidth };
    const pad = 0.75 * g;
    const x0 = word.left - box.left - pad;
    return { x0: Math.round(x0), x1: Math.round(x0 + word.width + 2 * pad) };
  }

  /** each menu item whole grid cells wide, at least a quarter cell free each side of its word,
      the word in the middle (again when the font arrives or the language changes) */
  private sizeNav(): void {
    const nav = this.navRef?.nativeElement;
    const g = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dynamic-grid-size')) || 0;
    if (!nav || !g) return;
    nav.querySelectorAll<HTMLElement>('p').forEach(p => {
      p.style.width = 'auto';
      p.style.padding = '0';
      const word = p.scrollWidth;
      if (!word) return;
      p.style.width = `${Math.ceil((word + 0.5 * g) / g - 0.01) * g}px`;
    });
  }

  private markerTo(p: HTMLElement | null): void {
    const T = Header, lerp = (a: number, b: number, f: number) => Math.round(a + (b - a) * f);
    this.hot?.classList.remove('hot');
    this.hot = p;
    p?.classList.add('hot');
    const from = this.span;
    const to = p ? this.spanFor(p) : null;
    const out: (Span | null)[] = [];
    if (to && !from) {
      // unfold from the word's left edge
      for (const f of T.LEAD) out.push({ x0: to.x0, x1: lerp(to.x0, to.x1, f) });
    } else if (to && from) {
      // leading edge out to the new word, then the back edge after it
      const right = to.x0 >= from.x0;
      let b = { ...from };
      for (const f of T.LEAD) out.push(b = right ? { ...b, x1: lerp(from.x1, to.x1, f) } : { ...b, x0: lerp(from.x0, to.x0, f) });
      const s = { ...b };
      for (const f of T.TRAIL) out.push(b = right ? { ...b, x0: lerp(s.x0, to.x0, f) } : { ...b, x1: lerp(s.x1, to.x1, f) });
    } else if (from) {
      // fold away to the right
      for (const f of T.TRAIL) out.push({ x0: lerp(from.x0, from.x1, f), x1: from.x1 });
      out.push(null);
    }
    this.frames = out;
    if (out.length && !this.markerTimer) {
      this.markerFrame();
      this.markerTimer = window.setInterval(() => this.markerFrame(), 1000 / 12);
    }
  }

  private markerFrame(): void {
    const m = this.markerRef?.nativeElement;
    if (!this.frames.length || !m) { clearInterval(this.markerTimer); this.markerTimer = 0; return; }
    const b = this.frames.shift()!;
    this.span = b && b.x1 - b.x0 > 0 ? b : null;
    if (this.span) {
      m.style.transform = `translateX(${this.span.x0}px)`;
      m.style.width = `${this.span.x1 - this.span.x0}px`;
      m.style.visibility = 'visible';
    } else {
      m.style.visibility = 'hidden';
    }
  }

  /** the bar is shrinking away: no box */
  private markerOff(): void {
    clearInterval(this.markerTimer);
    this.markerTimer = 0;
    this.frames = [];
    this.span = null;
    this.hot?.classList.remove('hot');
    this.hot = null;
    if (this.markerRef) this.markerRef.nativeElement.style.visibility = 'hidden';
  }

  ngOnDestroy() {
    if (this.scrollListener) {
      window.removeEventListener('scroll', this.scrollListener);
    }
    this.subscriptions.unsubscribe();
    this.offNav.forEach(f => f());
    clearInterval(this.markerTimer);
    clearInterval(this.flowTimer);
    gsap.killTweensOf(this.host.nativeElement.querySelectorAll("*"));
  }
}
