import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, ViewChild, inject, input } from '@angular/core';
import { LanguageService } from '../../_services/language.service';

/** a track: [frame, value], the value holding until the next frame (as control.ts's TUT) */
type Track = readonly (readonly [number, number])[];

/**
 * The phones' guide (Emil's WhatsApp video of 25 Oct, 24 frames a second, moving in 12 fps
 * steps), frame by frame. Lengths in grid cells, on a stage 29 x 36 cells in the middle of the
 * screen; the hand's place is its fingertip.
 */
const GUIDE = {
  /** the pink comes in from the right (how much of the screen it leaves free, from the left) */
  wipeIn: [[0, 1], [2, .52], [4, .1575], [6, .03], [8, 0]],
  /** and goes to the left at the end (how much it has left free, from the right) */
  wipeOut: [[0, 0], [148, .125], [150, .9], [152, 1]],

  /* ---- 1: swipe to go to the next page */
  /** the hand comes in after the pink, from the right */
  handIn: [[0, 7.2], [6, 2.9], [8, 1], [10, 0]],
  /** the swipe up (0-1 of the way): the fingertip from its touch to the trail's top */
  swipe: [[0, 0], [18, .25], [20, .65], [22, .9], [24, 1]],
  /** the two pages on the phone, scrolled by (a page is 19 cells) */
  scroll: [[0, 0], [18, 4.7], [20, 13.3], [22, 16.2], [24, 17.6], [26, 18.7], [28, 19]],
  /** the hand off to the card's "+" (from the trail's top) */
  toCardX: [[0, 0], [50, .9], [52, 4.2], [54, 6.4], [56, 7]],
  toCardY: [[0, 0], [50, .3], [52, 4.3], [54, 7.2], [56, 9.5]],
  /** the words go up, behind the card */
  words1: [[0, 0], [54, -.6], [56, -2.5], [58, -10.4], [60, -20]],

  /* ---- 2: press to expand the card */
  /** the words come up from behind the card, and go back down behind it */
  words2: [[0, 11], [60, 8.2], [62, 5.1], [64, 3.2], [66, 1.94], [68, 1.08], [70, .5], [72, .22], [74, .07], [76, 0],
    [110, .3], [112, 3.6], [114, 7.7]],
  /** the card's height as it opens */
  card: [[0, 8], [72, 9.8], [74, 15.7], [76, 19.2], [78, 21.1], [80, 22.4], [82, 23], [84, 23.5], [86, 23.8], [88, 24]],
  /** the touch's ring, from under the fingertip (its outer radius; 0: none) */
  ripple: [[0, 0], [66, .5], [68, 1.5], [70, 2.5], [72, 3.5], [74, 9.4], [76, 12.2], [78, 14.5], [80, 16.5], [82, 18.5],
    [84, 20.5], [86, 22], [88, 23.3], [90, 24.3], [92, 24.8], [94, 25.3], [96, 25.6], [98, 25.9], [100, 26.1],
    [102, 26.3], [104, 26.5], [106, 0]],

  /* ---- 3: enjoy */
  /** the word comes down from behind the heart */
  words3: [[0, -6], [118, -5.25], [120, -4.24], [122, -3.17], [124, -2.3], [126, -1.65], [128, -1.15], [130, -.79],
    [132, -.5], [134, -.29], [136, -.14], [138, -.07], [140, 0]],
} as const satisfies Record<string, Track>;
/** the scenes: the phone until 56, the card until 116, then the heart; the hand until 108; the
    card's text once it opens */
const CARD_FROM = 56, HEART_FROM = 116, HAND_FROM = 4, HAND_TO = 108, TRAIL_FROM = 16, BARS_FROM = 70;
const LAST = 152;
/** where the fingertip touches the phone, and where the swipe ends (stage cells) */
const TOUCH = { x: 13, y: 14.9 }, SWIPE_UP = 8.3;
/** the ring: its middle on the card (cells from the card's corner), how thick, and the card */
const RING = { x: 17, y: 5.1, width: 2.5, alpha: .4 };
const CARD = { w: 23, h: 24 };

/** the heart, from the video: its outline (#) and its light (o); the shine (·) lets the pink through */
const HEART = [
  '..###....###..',
  '.#ooo#..#ooo#.',
  '#ooooo##oo·oo#',
  '#oooooooooo·o#',
  '#oooooooooooo#',
  '#oooooooooooo#',
  '.#oooooooooo#.',
  '..#oooooooo#..',
  '...#oooooo#...',
  '....#oooo#....',
  '.....#oo#.....',
  '......##......',
];

const at = (track: Track, f: number): number => {
  let v = track[0][1];
  for (const [k, x] of track) { if (k > f) break; v = x; }
  return v;
};

@Component({
  selector: 'app-phone-guide',
  templateUrl: './phone-guide.html',
  styleUrl: './phone-guide.scss',
})
export class PhoneGuide implements AfterViewInit, OnDestroy {
  /** the button shows with the landing's controls (home.ts uiOpacity) */
  readonly shown = input(1);

  readonly heart = HEART.flatMap((row, y) => [...row].flatMap((c, x) =>
    c === '#' || c === 'o' ? [{ x, y, line: c === '#' }] : []));

  @ViewChild('layer') private layerRef!: ElementRef<HTMLElement>;
  @ViewChild('button') private buttonRef!: ElementRef<HTMLButtonElement>;
  @ViewChild('ring') private ringRef!: ElementRef<HTMLCanvasElement>;
  protected readonly lang = inject(LanguageService);
  private readonly zone = inject(NgZone);

  private raf = 0;
  private t0 = 0;
  private frame = -1;
  /** the frame the pink starts to go (a touch ends it early) */
  private outFrom = 148;
  private readonly stopTouch = (e: TouchEvent) => e.preventDefault();
  private readonly onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') this.close(); };

  get de(): boolean { return this.lang.currentLang() === 'de'; }

  /** the guide over everything: on <body>, out of the page's transformed column */
  ngAfterViewInit(): void {
    const layer = this.layerRef.nativeElement;
    document.body.appendChild(layer);
    layer.addEventListener('touchmove', this.stopTouch, { passive: false });
  }

  ngOnDestroy(): void {
    this.end();
    this.layerRef?.nativeElement.remove();
  }

  open(): void {
    const layer = this.layerRef.nativeElement;
    // its own "i" where the button is
    layer.style.setProperty('--i-top', `${this.buttonRef.nativeElement.getBoundingClientRect().top}px`);
    this.outFrom = GUIDE.wipeOut[1][0];
    this.frame = -1;
    layer.classList.add('on');
    this.show(0);
    window.addEventListener('keydown', this.onKey);
    this.zone.runOutsideAngular(() => {
      this.t0 = performance.now();
      const tick = (now: number) => {
        const f = Math.floor((now - this.t0) * 24 / 1000);
        if (f >= this.outFrom + LAST - GUIDE.wipeOut[1][0]) { this.end(); return; }
        if (f !== this.frame) this.show(f);
        this.raf = requestAnimationFrame(tick);
      };
      this.raf = requestAnimationFrame(tick);
    });
  }

  /** a touch on the guide: the pink goes now (as at the end) */
  close(): void {
    if (this.frame < 0) return;
    const out = Math.max(this.frame + 1, GUIDE.wipeIn[GUIDE.wipeIn.length - 1][0]);
    if (out < this.outFrom) this.outFrom = out;
  }

  private end(): void {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this.onKey);
    this.frame = -1;
    this.layerRef?.nativeElement.classList.remove('on');
    this.buttonRef?.nativeElement.focus({ preventScroll: true });
  }

  /** one frame, as CSS variables and classes on the layer (phone-guide.scss draws it) */
  private show(f: number): void {
    this.frame = f;
    const layer = this.layerRef.nativeElement, st = layer.style;
    const g = (t: Track) => at(t, f);
    // the way out runs from outFrom, whenever that is
    const out = f < this.outFrom ? 0 : at(GUIDE.wipeOut, f - this.outFrom + GUIDE.wipeOut[1][0]);
    st.setProperty('--wipe-l', `${g(GUIDE.wipeIn) * 100}%`);
    st.setProperty('--wipe-r', `${out * 100}%`);

    const scene = f < CARD_FROM ? 1 : f < HEART_FROM ? 2 : 3;
    layer.dataset['scene'] = String(scene);
    layer.classList.toggle('trail-on', f >= TRAIL_FROM && f < CARD_FROM);
    layer.classList.toggle('hand-on', f >= HAND_FROM && f < HAND_TO);
    layer.classList.toggle('bars-on', f >= BARS_FROM);

    const y = TOUCH.y - SWIPE_UP * g(GUIDE.swipe);
    st.setProperty('--hand-x', String(TOUCH.x + g(GUIDE.handIn) + g(GUIDE.toCardX)));
    st.setProperty('--hand-y', String(y + g(GUIDE.toCardY)));
    st.setProperty('--trail-top', String(y - .5));
    st.setProperty('--scroll', String(g(GUIDE.scroll)));
    st.setProperty('--words1', String(g(GUIDE.words1)));
    st.setProperty('--words2', String(g(GUIDE.words2)));
    st.setProperty('--card-h', String(g(GUIDE.card)));
    st.setProperty('--words3', String(g(GUIDE.words3)));
    this.drawRing(g(GUIDE.ripple));
  }

  /** the touch's ring in half-cell pixels, as the blob's (a filled dot at first) */
  private lastRing = -1;
  private drawRing(r: number): void {
    if (r === this.lastRing) return;
    this.lastRing = r;
    const canvas = this.ringRef.nativeElement, ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = CARD.w * 2, H = CARD.h * 2;
    if (canvas.width !== W) { canvas.width = W; canvas.height = H; }
    ctx.clearRect(0, 0, W, H);
    if (!r) return;
    const inner = Math.max(0, r - RING.width);
    ctx.fillStyle = `rgba(255, 255, 255, ${RING.alpha})`;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const d = Math.hypot((i + .5) / 2 - RING.x, (j + .5) / 2 - RING.y);
      if (d <= r && d >= inner) ctx.fillRect(i, j, 1, 1);
    }
  }
}
