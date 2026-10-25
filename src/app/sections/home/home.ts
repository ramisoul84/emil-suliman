import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, OnInit, ViewChild, computed, effect, inject, signal } from '@angular/core';
import { GridService } from '../../_services/grid.service';
import { gsap } from 'gsap';
import { BlurService } from '../../_services/blur.service';
import { Subject, takeUntil } from 'rxjs';
import { Blob, BlobMask } from "../../components/blob/blob";
import { Control } from "../../components/control/control";
import { TutorialService } from '../../_services/tutorial.service';
import { IntroService } from '../../_services/intro.service';

@Component({
  selector: 'app-home',
  imports: [CommonModule, Blob, Control],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('textElement') textElement?: ElementRef;
  @ViewChild('lightText') lightText?: ElementRef<HTMLElement>;

  /* ---- the way in (intro.service.ts, 12 fps frames after the header's second row; Emil's
     Comp 15.mp4): a pink bar runs over each line of the name, two frames apart, and leaves the
     line there (as the header's bars do); then the blob fades in, and its controls a second
     after it */
  private readonly intro = inject(IntroService);
  /** the frame each line's bar starts */
  private static readonly LINE_FROM = [7, 9, 11];
  /** a line's bar, per frame from its start: how far its right end has run, then its left end
      (0-1 of the bar); gone after the last */
  private static readonly BAR_R = [.04, .52, .855, .955, .993, 1, 1, 1, 1, 1, 1, 1];
  private static readonly BAR_L = [0, 0, 0, 0, .035, .283, .61, .77, .87, .93, .965, .99];
  /** the line is there from this frame of its bar (all covered by then) */
  private static readonly LINE_SHOWN = 4;
  /** the blob: frames 18-20; its controls a second later, 30-32 */
  private static readonly BLOB_FROM = 18;
  private static readonly UI_FROM = 30;
  readonly blobOpacity = computed(() => Home.fade(this.intro.frame(), Home.BLOB_FROM));
  readonly uiOpacity = computed(() => Home.fade(this.intro.frame(), Home.UI_FROM));
  private static fade(f: number, from: number): number {
    return f < from ? 0 : f === from ? .35 : f === from + 1 ? .7 : 1;
  }
  lineShown(i: number): string {
    return this.intro.frame() >= Home.LINE_FROM[i] + Home.LINE_SHOWN ? 'visible' : 'hidden';
  }
  /** the three bars: where (over the line's letters) and how much of them shows this frame */
  readonly nameWipes = signal<{ left: number; top: number; width: number; height: number; clip: string }[]>([]);
  private readonly wipeFrames = effect(() => {
    const f = this.intro.frame();
    const last = Home.LINE_FROM[Home.LINE_FROM.length - 1] + Home.BAR_R.length;
    if (f < Home.LINE_FROM[0] - 1 || f > last) { if (this.nameWipes().length) this.nameWipes.set([]); return; }
    const stack: HTMLElement | undefined = this.textElement?.nativeElement;
    const lines = stack?.querySelectorAll<HTMLElement>('.current-text:not(.light) .ln');
    if (!stack || !lines?.length) return;
    const s = stack.getBoundingClientRect();
    const g = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dynamic-grid-size')) || 21;
    this.nameWipes.set([...lines].map((ln, i) => {
      const k = f - Home.LINE_FROM[i];
      const r = ln.getBoundingClientRect();
      const h = 1.75 * g;   // a little taller than the capitals, as in the video
      const box = { left: r.left - s.left - .4 * g, top: r.top - s.top + r.height / 2 - h / 2 + Home.INK_DY * g, width: r.width + .8 * g, height: h };
      const clip = k < 0 || k >= Home.BAR_R.length ? 'inset(0 100% 0 0)'
        : `inset(0 ${((1 - Home.BAR_R[k]) * 100).toFixed(1)}% 0 ${(Home.BAR_L[k] * 100).toFixed(1)}%)`;
      return { ...box, clip };
    }));
  });
  /** the capitals' middle below the middle of the line's box (cells) */
  private static readonly INK_DY = 0;

  @ViewChild(Blob, { static: true }) blob!: Blob;
  private lastClip = '';
  loading: boolean = true;
  progress: number = 0;
  isBlur: boolean = false;

  private timeline: gsap.core.Timeline | null = null;
  private tickerAnimation: any;
  private readonly tutorial = inject(TutorialService);
  /** after the landing's tutorial, "Emil Suliman" stays this long before the lines take turns */
  private static readonly AFTER_TUTORIAL_MS = 3000;
  /** after the way in, "Emil Suliman" stays this long before the lines take turns */
  private static readonly AFTER_INTRO_MS = 4000;
  private blinkCheck: any = 0;
  private lastSolidEndTime: number = 0;
  private currentIndex: number = 0;
  private isBlinking: boolean = false;
  private blinkStartTime: number = 0;
  private blinkDuration: number = 4000; // Total blink duration
  private solidDuration: number = 3200; // Time text stays solid
  private destroy$ = new Subject<void>(); // ADD: Cleanup

  currentText: string = '';
  texts: string[] = [
    // the name's lines one by one (the way in shows each with its bar: home.html, --ln0-2)
    '<span class="ln">EMIL SULIMAN</span><br><span class="ln">ARCHITECT - DESIGNER</span><br><span class="ln">BERLIN, GERMANY</span>',
    "ARCHITECTURE, EXPANDED",
    "DIGITAL EXPERIENCES,<br>SYSTEMS, AND INTERFACES",
    "STORIES TOLD THROUGH<br>SPACE, AND MOTION.",
  ];

  /** the landing page has been out of view: it starts again with the name on return */
  private away = false;
  private observer?: IntersectionObserver;

  constructor(private gridService: GridService, private blurService: BlurService,
    private host: ElementRef<HTMLElement>, private zone: NgZone) {
    this.blurService.blurState$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(data => this.isBlur = data);
  }

  ngAfterViewInit(): void {
    this.blob.onMask = mask => this.applyMask(mask);
    // coming back to the landing page: start again with the name, so you know where you are
    if (typeof IntersectionObserver !== 'undefined') {
      this.observer = new IntersectionObserver(([e]) => {
        if (!e.isIntersecting) { this.away = true; return; }
        if (this.away) { this.away = false; this.zone.run(() => this.showName()); }
      });
      this.observer.observe(this.host.nativeElement.querySelector('section') ?? this.host.nativeElement);
    }
  }

  /** back to the first text (the name), shown solid for its full time */
  private showName(): void {
    if (this.loading || !this.textElement) return;
    this.timeline?.kill();
    this.timeline = null;
    gsap.killTweensOf(this.textElement!.nativeElement);
    this.isBlinking = false;
    this.currentIndex = 0;
    this.currentText = this.texts[0];
    this.lastSolidEndTime = performance.now();
    gsap.set(this.textElement!.nativeElement, { opacity: 1 });
  }

  /**
   * The white copy of the text is cut to the blob's pink cells: one rectangle per run of
   * pink cells in a row, in the copy's own coordinates. So over pink the text reads white,
   * everywhere else black, switching cell by cell like the pixels of the blob.
   */
  private applyMask(mask: BlobMask): void {
    const light = this.lightText?.nativeElement;
    const canvas = this.blob?.canvasRef?.nativeElement;
    if (!light || !canvas) return;
    const c = canvas.getBoundingClientRect();
    const r = light.getBoundingClientRect();
    if (!r.width || !c.width || !c.height) return;
    const cw = c.width / mask.cols, ch = c.height / mask.rows;
    const y0 = Math.max(0, Math.floor((r.top - c.top) / ch)), y1 = Math.min(mask.rows, Math.ceil((r.bottom - c.top) / ch));
    const x0 = Math.max(0, Math.floor((r.left - c.left) / cw)), x1 = Math.min(mask.cols, Math.ceil((r.right - c.left) / cw));
    const f = (n: number) => Math.round(n * 10) / 10;
    let d = '';
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1;) {
        if (!mask.cells[y * mask.cols + x]) { x++; continue; }
        let e = x;
        while (e < x1 && mask.cells[y * mask.cols + e]) e++;
        d += `M${f(c.left + x * cw - r.left)} ${f(c.top + y * ch - r.top)}h${f((e - x) * cw)}v${f(ch)}h${f(-(e - x) * cw)}z`;
        x = e;
      }
    }
    const clip = d ? `path('${d}')` : 'inset(50%)';
    if (clip !== this.lastClip) {
      light.style.clipPath = clip;
      this.lastClip = clip;
    }
  }

  ngOnInit(): void {
    // (no header to start the way in: start it here)
    setTimeout(() => this.intro.begin(), 2500);
  }

  /** the page is ready when the way in begins: the name is set (its lines come with their bars) */
  private readonly ready = effect(() => {
    if (this.intro.frame() < 0 || !this.loading) return;
    this.loading = false;
    this.currentText = this.texts[0];
    // after this view's first check (the text element is there by then)
    setTimeout(() => this.startTickerAnimation());
  });


  private startTickerAnimation() {
    if (!this.textElement) return;          // landing B has no rotating lines
    // (this starts with the way in) the name stays 4 s after the way in is over, then the
    // lines take turns
    this.lastSolidEndTime = performance.now() + IntroService.END * 1000 / 12 + Home.AFTER_INTRO_MS - this.solidDuration;
    this.currentIndex = 0;
    this.isBlinking = false;

    // Set initial state
    gsap.set(this.textElement!.nativeElement, { opacity: 1, willChange: 'opacity' });

    // Main animation loop
    this.tickerAnimation = () => {
      const now = performance.now();
      // "Emil Suliman" stays through the tutorial (control.ts), the lines take turns 3 s after
      if (!this.tutorial.done()) { this.lastSolidEndTime = now + Home.AFTER_TUTORIAL_MS - this.solidDuration; return; }
      const timeSinceLastSolid = now - this.lastSolidEndTime;

      // Start blinking if enough time has passed
      if (timeSinceLastSolid >= this.solidDuration && !this.isBlinking) {
        this.startBlinkSequence();
      }

      // Check if blink should be complete (backup check)
      if (this.isBlinking) {
        const blinkElapsed = now - this.blinkStartTime;
        if (blinkElapsed >= this.blinkDuration) {
          this.completeBlinkSequence();
        }
      }
    };

    // checked ten times a second, outside Angular: not on GSAP's ticker, which then kept
    // the page's animation clock (and change detection) running every frame for good
    clearInterval(this.blinkCheck);
    this.zone.runOutsideAngular(() => { this.blinkCheck = setInterval(() => this.tickerAnimation?.(), 100); });
  }

  private startBlinkSequence() {
    this.isBlinking = true;
    this.blinkStartTime = performance.now();

    // Kill any existing timeline
    if (this.timeline) {
      this.timeline.kill();
    }

    // Create new blink timeline
    this.timeline = gsap.timeline({
      onStart: () => {
        this.blinkStartTime = performance.now();
      },
      onComplete: () => {
        this.completeBlinkSequence();
      },
      onInterrupt: () => {
        // If interrupted, complete the sequence anyway
        setTimeout(() => this.completeBlinkSequence(), 0);
      }
    });

    // the text fades out, eased, in 4 frames at 12 fps (it used to blink three times first)
    this.timeline.to(this.textElement!.nativeElement, { opacity: 0, duration: 4 / 12, ease: Home.at12fps('power1.in', 4) });
  }

  /** an ease held in whole 1/12 s frames (n of them), like the rest of the site */
  private static at12fps(name: string, n: number): (t: number) => number {
    const ease = gsap.parseEase(name);
    return (t: number) => ease(Math.min(1, Math.ceil(t * n - 1e-6) / n));
  }

  private completeBlinkSequence() {
    if (!this.isBlinking) return;

    this.isBlinking = false;

    // Move to next text (the view is told: the blink runs outside Angular)
    this.zone.run(() => {
      this.currentIndex = (this.currentIndex + 1) % this.texts.length;
      this.currentText = this.texts[this.currentIndex];
    });

    // Reset timing
    this.lastSolidEndTime = performance.now();

    // the next text fades in the same way (4 frames)
    gsap.killTweensOf(this.textElement!.nativeElement);
    gsap.to(this.textElement!.nativeElement, { opacity: 1, duration: 4 / 12, ease: Home.at12fps('power1.out', 4) });
  }

  private stopTickerAnimation() {
    clearInterval(this.blinkCheck);
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
    }
  }

  private backupInterval: any;
  private startBackupCheck() {
    this.backupInterval = setInterval(() => {
      const now = performance.now();
      const timeSinceLastSolid = now - this.lastSolidEndTime;

      // Check if animation is stuck (shouldn't happen with the new logic)
      if (timeSinceLastSolid > this.solidDuration + this.blinkDuration + 1000) {
        console.warn('Animation stuck detected, restarting...');
        this.restartAnimation();
      }
    }, 2000);
  }

  private restartAnimation() {
    this.stopTickerAnimation();

    if (this.timeline) {
      this.timeline.kill();
      this.timeline = null;
    }

    // Reset state
    this.isBlinking = false;
    gsap.set(this.textElement!.nativeElement, { opacity: 1 });

    // Restart
    this.startTickerAnimation();
    this.startBackupCheck();
  }

  ngOnDestroy() {
    // Clean up
    clearInterval(this.blinkCheck);
    clearInterval(this.backupInterval);
    this.observer?.disconnect();
    this.destroy$.next();
    this.destroy$.complete();

    // Stop animations
    if (this.timeline) {
      this.timeline.kill();
      this.timeline = null;
    }

    // Clear any pending timeouts
    if ((this as any)._resizeTimer) {
      clearTimeout((this as any)._resizeTimer);
    }

    // Clean up GSAP tweens
    if (this.textElement) {
      gsap.killTweensOf(this.textElement!.nativeElement);
    }
  }
}