import {
  ChangeDetectionStrategy, Component, ElementRef, NgZone, OnDestroy, OnInit, ViewChild,
  computed, inject, input, output, signal,
} from '@angular/core';
import { LanguageService } from '../../_services/language.service';
import { WHALE_FRAMES, WHALE_H, WHALE_W } from './whale-sprite';
import { DESKTOP_MIN_WIDTH } from '../../_config/phone';

/*
 * The whale game: the footer whale, on the page's grid, swims through the sea while krill and
 * fishing nets come its way. Everything sits in whole grid cells and moves a cell at a time,
 * like an old LCD game: the whale (25 x 16 cells, the same picture as in the footer) moves up
 * and down with the arrow keys or the mouse; krill (pink cells) give a point, a net costs one
 * of three lives. The whale starts where it was in the footer.
 *
 * It is played right on the contact page: the sea is a layer under the page (the page's grid,
 * the form, the menu and the footer stay over it), from under the contact links down to the
 * bottom of the window; the score sits beside the links. The sea (Emil's Comp_11 sketch, an
 * underwater game for the scenery, in greys): rocks behind, near ones with kelp swaying, a
 * sandy floor with corals, krill in swarms that swirl in a turbulent current, and fishing nets
 * (a mesh, changing shape as it floats), both coming past with the sea.
 *
 *   ready → running ⇄ paused → over → running …     (esc closes at any time)
 */

type State = 'ready' | 'running' | 'paused' | 'over';

/** a lump of a net: it sways about its place, the lumps together make the net's shape */
interface Lump { ax: number; ay: number; r: number; fx: number; fy: number; px: number; py: number; }
interface Net {
  x: number; y: number;          // its middle (cells): it comes past with the sea, like the krill
  w: number; h: number;          // how far it can reach from the middle (cells)
  lumps: Lump[];
  cells: [number, number][];     // its cells now, relative to x / y
  torn: boolean;                 // hit once: harmless from then on
}

/** a krill: where it is in its swarm (cells from the swarm's middle) and how strong it shows */
interface Krill { ox: number; oy: number; seed: number; w: number; }
interface Swarm { x: number; y: number; seed: number; krill: Krill[]; }
/** a krill just eaten: a little ring opening out for a few frames */
interface Pop { x: number; y: number; life: number; }

const TEXT = {
  en: {
    title: 'whale game', krill: 'krill', best: 'best', close: 'close',
    intro: 'eat the krill, dodge the nets', legendKrill: 'krill +1', legendNet: 'net −1 life',
    controls: '↑ ↓ or the mouse to swim', start: 'start', orSpace: 'or press space',
    paused: 'paused', goOn: 'go on', caught: 'caught in a net',
    fact: 'About 300,000 whales, dolphins and porpoises die in fishing gear every year.',
    source: 'WWF on bycatch ↗', again: 'play again',
    help: '↑ ↓ / mouse  |  p pause  |  esc close',
  },
  de: {
    title: 'wal-spiel', krill: 'krill', best: 'rekord', close: 'beenden',
    intro: 'friss den Krill, weich den Netzen aus', legendKrill: 'Krill +1', legendNet: 'Netz −1 Leben',
    controls: '↑ ↓ oder die Maus zum Schwimmen', start: 'start', orSpace: 'oder Leertaste',
    paused: 'pause', goOn: 'weiter', caught: 'im netz gefangen',
    fact: 'Rund 300.000 Wale, Delfine und Schweinswale sterben jedes Jahr als Beifang in der Fischerei.',
    source: 'WWF zu Beifang ↗', again: 'nochmal',
    help: '↑ ↓ / maus  |  p pause  |  esc beenden',
  },
};

const LIVES = 3;
const BEST_KEY = 'es-whale-best';
const ANIM_MS = 1000 / 12;           // the whale's animation: 12 frames a second
const SAFE_MS = 1500;                // after a net: can't be hurt again for a moment
const KRILL_PER_LIFE = 20;           // eat this many and a lost life comes back

/** the whale's cells per frame that touch things (opacity in 16 steps at least this) */
function cellSet(frame: string, min: number): Set<number> {
  const s = new Set<number>();
  for (let i = 0; i < frame.length; i++) if (parseInt(frame[i], 16) >= min) s.add(i);
  return s;
}
const HIT_CELLS = WHALE_FRAMES.map(f => cellSet(f, 8));     // a net must touch the body
const EAT_CELLS = WHALE_FRAMES.map(f => cellSet(f, 2));     // krill only the edge
const ALPHA = WHALE_FRAMES.map(f => Array.from(f, c => parseInt(c, 16) / 15));
/** the rows the whale's body can take up (over all frames) */
const BODY_TOP = Math.min(...WHALE_FRAMES.map(f => Math.floor(f.search(/[1-9a-f]/) / WHALE_W)));
const BODY_BOTTOM = Math.max(...WHALE_FRAMES.map(f => Math.floor((f.replace(/0+$/, '').length - 1) / WHALE_W)));

const rand = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
const randf = (a: number, b: number) => a + Math.random() * (b - a);

/** smooth noise in 3D (value noise), about -1 … 1 */
function hash3(i: number, j: number, k: number): number {
  let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(k, 1440662683);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function noise3(x: number, y: number, z: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const l = (a: number, b: number, t: number) => a + (b - a) * t;
  const c = (dx: number, dy: number, dz: number) => hash3(xi + dx, yi + dy, zi + dz);
  return 2 * l(
    l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v),
    l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v), w) - 1;
}

/** a fixed random sequence (so the scenery is always the same) */
function seeded(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** the scenery repeats every this many columns */
const PERIOD = 240;
/** a row of rocks: per column how high it reaches and how high an arch under it opens (parts
    of the sea's height), its grey and how slowly it passes (world steps a cell) */
interface Rocks { grey: number; every: number; h: Float32Array; hole: Float32Array; }

/** far: big rock masses with flat, broken tops, some with an arch, gaps between */
function farRocks(): Rocks {
  const r = seeded(11), h = new Float32Array(PERIOD), hole = new Float32Array(PERIOD);
  let x = 0;
  while (x < PERIOD) {
    if (r() < 0.32 || x === 0) {
      const w = 3 + Math.floor(r() * 7), low = 0.06 + r() * 0.08;
      for (let i = 0; i < w && x < PERIOD; i++, x++) h[x] = low;
      continue;
    }
    const w = 10 + Math.floor(r() * 15), top = 0.32 + r() * 0.26;
    let bump = 0;
    const start = x;
    for (let i = 0; i < w && x < PERIOD; i++, x++) {
      if (i % (2 + Math.floor(r() * 2)) === 0) bump = (r() - 0.5) * 0.08;
      const edge = Math.min(i, w - 1 - i);
      h[x] = (edge === 0 ? top * 0.55 : edge === 1 ? top * 0.85 : top) + bump;
    }
    if (w >= 14 && r() < 0.45) {
      // an arch through it
      const mid = start + w / 2, half = w * 0.18, ah = top * (0.35 + r() * 0.15);
      for (let c = Math.ceil(mid - half); c < mid + half && c < PERIOD; c++) {
        const k = (c + 0.5 - mid) / half;
        if (Math.abs(k) < 1) hole[c] = ah * Math.sqrt(1 - k * k);
      }
    }
  }
  return { grey: 222, every: 6, h, hole };
}

/** near: narrow rock pillars, rounded on top, on low ground */
function nearRocks(): Rocks {
  const r = seeded(23), h = new Float32Array(PERIOD), hole = new Float32Array(PERIOD);
  let x = 0;
  while (x < PERIOD) {
    const gap = 6 + Math.floor(r() * 12), low = 0.03 + r() * 0.03;
    for (let i = 0; i < gap && x < PERIOD; i++, x++) h[x] = low;
    const w = 2 + Math.floor(r() * 4), top = 0.16 + r() * 0.2;
    for (let i = 0; i < w && x < PERIOD; i++, x++) {
      const edge = Math.min(i, w - 1 - i);
      h[x] = edge === 0 && w > 2 ? top * 0.86 : top;
    }
  }
  return { grey: 210, every: 3, h, hole };
}
const ROCKS = [farRocks(), nearRocks()];

/** kelp: stems from the floor (column, height as a part of the sea, sway phase) */
const KELP = (() => {
  const r = seeded(37), out: { x: number; h: number; ph: number }[] = [];
  for (let x = 2; x < PERIOD; x += 4 + Math.floor(r() * 9)) out.push({ x, h: 0.12 + r() * 0.24, ph: r() * 6.3 });
  return out;
})();
const KELP_GREY = 202;

/** the floor: sand a cell or two high, rolling, and corals on it (cell patterns, bottom row
    on the sand) */
const SAND = (() => {
  const r = seeded(41), h = new Float32Array(PERIOD);
  const a = r() * 6.3, b = r() * 6.3;
  for (let x = 0; x < PERIOD; x++) {
    h[x] = 1.3 + 0.6 * Math.sin(2 * Math.PI * 4 * x / PERIOD + a) + 0.35 * Math.sin(2 * Math.PI * 11 * x / PERIOD + b);
  }
  return h;
})();
const SAND_GREY = 196;
const CORAL_SHAPES = [
  ['#.#.#', '#.#.#', '.###.', '..#..'],
  ['.#..#', '##.##', '.###.', '..#..'],
  ['#..#', '#.##', '###.', '.#..'],
  ['.#.', '###', '.#.'],
  ['#.#', '.#.'],
  ['..#', '#.#', '###'],
];
const CORALS = (() => {
  const r = seeded(53), out: { x: number; shape: string[] }[] = [];
  for (let x = 1; x < PERIOD - 6; x += 5 + Math.floor(r() * 12)) out.push({ x, shape: CORAL_SHAPES[Math.floor(r() * CORAL_SHAPES.length)] });
  return out;
})();
const CORAL_GREY = 184;
const FLOOR_EVERY = 2;
const FLOOR_GREY = 170;
const NET_GREY = '85,85,85';

/** a field the visitor writes in */
function isTyping(t: EventTarget | null): boolean {
  return !!(t as HTMLElement | null)?.closest?.('input, textarea, select, [contenteditable=""], [contenteditable="true"]');
}

@Component({
  selector: 'app-whale-game',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wg" #root role="dialog" aria-modal="true" [attr.aria-label]="t().title"
         [class.closing]="closing()" tabindex="-1">
      <!-- the score: a framed box between the contact links and "send" (or under the links),
           the whale showing through it when it swims up there -->
      <div class="hud" [style.left.px]="hud().x" [style.top.px]="hud().y" [style.width.px]="hud().w" [style.height.px]="hud().h">
        <span class="score lcd">{{ t().krill }} <span [class.bump]="bump()">{{ pad(score()) }}</span></span>
        <span class="best lcd">{{ t().best }} {{ pad(best()) }}</span>
        <span class="lives" [attr.aria-label]="lives() + ' / 3'">
          @for (i of [0, 1, 2]; track i) {
          <svg class="heart" [class.on]="i < lives()" viewBox="0 0 7 6" aria-hidden="true">
            <rect x="1" y="0" width="2" height="1" /><rect x="4" y="0" width="2" height="1" />
            <rect x="0" y="1" width="7" height="2" /><rect x="1" y="3" width="5" height="1" />
            <rect x="2" y="4" width="3" height="1" /><rect x="3" y="5" width="1" height="1" />
          </svg>
          }
        </span>
        <button class="btn close" type="button" (click)="close()">{{ t().close }}</button>
      </div>

      @if (state() !== 'running') {
        <div class="panel" [class.late]="state() === 'over'" [style.left]="col(L())" [style.top]="row(top() + 1)">
          @switch (state()) {
            @case ('ready') {
              <p class="lcd">{{ t().title }}: {{ t().intro }}</p>
              <p class="legend">
                <span><i class="krill"></i>{{ t().legendKrill }}</span>
                <span><i class="net"></i>{{ t().legendNet }}</span>
              </p>
              <p>{{ t().controls }}</p>
              <p class="lcd">{{ t().help }}</p>
              <p class="row"><button class="btn main" type="button" #first (click)="start()">{{ t().start }}</button>
                <span class="or">{{ t().orSpace }}</span></p>
            }
            @case ('paused') {
              <p class="lcd">{{ t().paused }}</p>
              <p class="row"><button class="btn main" type="button" #first (click)="resume()">{{ t().goOn }}</button>
                <button class="btn" type="button" (click)="close()">{{ t().close }}</button></p>
            }
            @case ('over') {
              <p class="lcd caught">{{ t().caught }}</p>
              <p class="lcd">{{ t().krill }} {{ pad(score()) }} &nbsp; {{ t().best }} {{ pad(best()) }}</p>
              <p class="fact">{{ t().fact }}</p>
              <p><a href="https://wwfwhales.org/bycatch" target="_blank" rel="noopener">{{ t().source }}</a></p>
              <p class="row"><button class="btn main wide" type="button" #first (click)="start()">{{ t().again }}</button>
                <button class="btn" type="button" (click)="close()">{{ t().close }}</button></p>
            }
          }
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: contents; }
    /* over the page, but only the score and the panels take the mouse: the page stays usable
       around them (the sea itself is a canvas under the page, see ngOnInit) */
    .wg {
      --g: 20px;
      position: fixed;
      inset: 0;
      z-index: 2000;
      overflow: hidden;
      pointer-events: none;
      user-select: none;
      outline: none;
      font-family: var(--font-main);
      color: #000;
      animation: wg-in .33s steps(4, end);
    }
    .wg.closing { opacity: 0; transition: opacity .5s steps(6, end); }
    @keyframes wg-in { from { opacity: 0; } }

    .lcd { font-family: var(--font-title); font-size: calc(.7 * var(--g)); line-height: var(--g); white-space: nowrap; }
    .hud, .panel { position: absolute; pointer-events: auto; }
    .hud {
      display: flex; align-items: center; gap: var(--g);
      padding: 0 var(--g); box-sizing: border-box;
      outline: var(--frame); outline-offset: -1px;
      background: rgba(255, 255, 255, .5);
    }
    .hud .lcd { font-size: calc(.9 * var(--g)); }

    .score span { display: inline-block; }
    .score span.bump { animation: wg-bump .25s steps(3, end); }
    @keyframes wg-bump { 0% { color: var(--color3); } 99% { color: var(--color3); } }
    /* the lives: pixel hearts, red; a lost one grey */
    .lives { display: flex; gap: calc(.5 * var(--g)); margin: 0 auto; }
    .heart { width: var(--g); height: calc(var(--g) * 6 / 7); fill: #e3172d; shape-rendering: crispEdges; }
    .heart:not(.on) { fill: #cfcfcf; }

    /* buttons like the footer's: a cell tall, framed */
    .btn {
      height: var(--g); min-width: calc(6 * var(--g)); padding: 0 calc(.5 * var(--g));
      border: 0; outline: var(--frame); outline-offset: -1px; background: #fff; color: #000;
      font-family: var(--font-title); font-size: calc(.7 * var(--g)); line-height: var(--g);
      cursor: pointer;
      box-shadow: var(--shadow-0); transition: var(--lift);
    }
    .btn:hover, .btn:focus-visible { box-shadow: var(--shadow); }
    .btn.main { background: #000; color: #fff; }
    .btn.wide { min-width: calc(8 * var(--g)); }
    .close { width: calc(7 * var(--g)); }

    .panel {
      display: flex; flex-direction: column; gap: var(--g);
      width: calc(24 * var(--g)); max-width: calc(100vw - 2 * var(--g));
      padding: var(--g);
      background: #fff; outline: var(--frame); outline-offset: -1px;
      font-size: calc(.8 * var(--g)); line-height: var(--g);
    }
    .panel.late { animation: wg-in .33s steps(4, end) .6s both; }
    .panel p { margin: 0; min-height: var(--g); }
    .panel .row { display: flex; gap: var(--g); align-items: center; }
    .panel .or { font-family: var(--font-title); font-size: calc(.7 * var(--g)); }
    .panel .caught { color: var(--color3); font-size: var(--size-title); }
    .panel .fact { white-space: normal; }
    .panel a { color: #000; font-family: var(--font-title); font-size: calc(.7 * var(--g)); }
    .legend { display: flex; gap: calc(2 * var(--g)); }
    .legend span { display: inline-flex; align-items: center; gap: calc(.5 * var(--g)); }
    .legend i { width: var(--g); height: var(--g); display: inline-block; }
    .legend .krill { background: var(--color3); }
    .legend .net {
      background:
        linear-gradient(45deg, transparent calc(50% - 1px), #000 calc(50% - 1px), #000 calc(50% + 1px), transparent calc(50% + 1px)) 0 0 / 50% 50%,
        linear-gradient(-45deg, transparent calc(50% - 1px), #000 calc(50% - 1px), #000 calc(50% + 1px), transparent calc(50% + 1px)) 0 0 / 50% 50%;
    }
  `],
})
export class WhaleGame implements OnInit, OnDestroy {
  /** where the footer whale is on the screen: the game whale starts there */
  readonly whaleRect = input<DOMRect | null>(null);
  readonly closed = output<void>();

  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly zone = inject(NgZone);
  private readonly lang = inject(LanguageService);

  @ViewChild('root', { static: true }) private rootRef!: ElementRef<HTMLDivElement>;
  /** the sea: a canvas under the page's content (in the last page), multiplied onto it */
  private canvas!: HTMLCanvasElement;

  readonly t = computed(() => TEXT[this.lang.currentLang() === 'de' ? 'de' : 'en']);
  readonly state = signal<State>('ready');
  readonly score = signal(0);
  readonly best = signal(0);
  readonly lives = signal(LIVES);
  readonly bump = signal(false);
  readonly closing = signal(false);

  // the grid (px) and the field (cells)
  private g = 20;
  private x0 = 0;
  private y0 = 0;
  private cols = 0;
  readonly geo = signal({ g: 20, x0: 0, y0: 0 });
  readonly rows = signal(0);
  readonly L = signal(1);                // left column of the texts
  readonly R = signal(0);                // right column of the texts (exclusive)
  readonly hud = signal({ x: 0, y: 0, w: 0, h: 0 });   // the score's box (px)
  readonly top = signal(4);              // the sea: rows top … bottom - 1
  private bottom = 0;

  // the whale
  private wx = 0;
  private wy = 0;
  private target = 0;
  private frame = 0;
  private keyDir = 0;                    // -1 up, 1 down (keys held)
  private mouseRow: number | null = null;
  private safeUntil = 0;

  // the sea's contents
  private nets: Net[] = [];
  private swarms: Swarm[] = [];
  private pops: Pop[] = [];
  private seaT = 0;                      // the current's clock (s): krill swirl, nets sway
  private travel = 0;                    // how far the whale has come: the mountains pass
  private untilNet = 0;
  private untilKrill = 0;
  private ticks = 0;
  private eaten = 0;

  // time
  private raf = 0;
  private last = 0;
  private playTime = 0;                  // ms of play (it speeds up)
  private worldAcc = 0;
  private whaleAcc = 0;
  private animAcc = 0;
  private dirty = true;
  private ctx!: CanvasRenderingContext2D;
  private dpr = 1;
  private colors = { accent: '#ff00fc' };
  private off: (() => void)[] = [];
  private bumpTimer = 0;

  ngOnInit(): void {
    // out of the page (its transforms would make "fixed" relative to them), onto the body
    document.body.appendChild(this.host.nativeElement);
    try { this.best.set(parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0); } catch { /* none */ }
    // the sea goes under the page: in the last page (inside the page's own layer, after the
    // grid effect), so the grid, the form and the footer are drawn over it
    const cv = this.canvas = document.createElement('canvas');
    cv.setAttribute('aria-hidden', 'true');
    Object.assign(cv.style, {
      position: 'absolute', left: '0', top: '0', zIndex: '-1', pointerEvents: 'none',
      mixBlendMode: 'multiply', transition: 'opacity .5s steps(6, end)',
    });
    (document.querySelector('.last-page') ?? document.body).appendChild(cv);
    this.ctx = cv.getContext('2d')!;
    this.layout(true);

    this.zone.runOutsideAngular(() => {
      const on = (target: EventTarget, type: string, fn: (e: any) => void, opts: AddEventListenerOptions = {}) => {
        target.addEventListener(type, fn, opts);
        this.off.push(() => target.removeEventListener(type, fn, opts));
      };
      // the page must not react to the game's keys
      on(window, 'keydown', e => this.onKeyDown(e), { capture: true });
      on(window, 'keyup', e => this.onKeyUp(e), { capture: true });
      on(window, 'resize', () => this.zone.run(() => this.layout(false)));
      on(window, 'blur', () => this.autoPause());
      // going into the contact form pauses the game and leaves the field to the visitor
      on(document, 'focusin', (e: FocusEvent) => { if (isTyping(e.target)) this.autoPause(false); });
      on(document, 'visibilitychange', () => { if (document.hidden) this.autoPause(); });
      // scrolling away (up to solidarity) ends the game: everything of it fades out with the page
      const startY = window.scrollY;
      on(window, 'scroll', () => {
        if (Math.abs(window.scrollY - startY) > this.g / 2 && !this.closing()) this.zone.run(() => this.close());
      }, { passive: true });
      on(window, 'pointermove', (e: PointerEvent) => {
        this.mouseRow = Math.floor((e.clientY - this.y0) / this.g);
        this.keyDir = 0;
      });
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.loop);
    });
    setTimeout(() => this.focusFirst());
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.raf);
    clearTimeout(this.bumpTimer);
    this.off.forEach(f => f());
    this.canvas?.remove();
  }

  // ------------------------------------------------------------------ template helpers

  col(c: number): string { const q = this.geo(); return `${q.x0 + c * q.g}px`; }
  row(r: number): string { const q = this.geo(); return `${q.y0 + r * q.g}px`; }
  pad(n: number): string { return String(n).padStart(3, '0'); }

  // ------------------------------------------------------------------ layout

  private layout(first: boolean): void {
    const root = document.documentElement;
    const g = parseFloat(getComputedStyle(root).getPropertyValue('--dynamic-grid-size')) || 20;
    const main = document.querySelector('.main')?.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    this.g = g;
    this.x0 = main ? ((main.left % g) + g) % g : 0;
    this.y0 = main ? ((Math.round(main.top) % g) + g) % g : 0;
    this.cols = Math.floor((vw - this.x0) / g);
    const rows = Math.floor((vh - this.y0) / g);
    this.rows.set(rows);
    this.geo.set({ g, x0: this.x0, y0: this.y0 });
    // the texts line up with the page's: from the contact title to the menu's column
    const title = document.querySelector('#contact .contact-title')?.getBoundingClientRect();
    const L = title && title.width ? Math.round((title.left - this.x0) / g) : 1;
    const R = main && vw >= DESKTOP_MIN_WIDTH ? Math.floor((main.right - this.x0) / g) - 2 : this.cols - 1;
    this.L.set(Math.max(1, L));
    this.R.set(Math.max(this.L() + 20, R));
    // the sea: from under the contact links to the window's bottom (the floor's two rows);
    // the score beside the links if there is room between them and "send", else under them
    const links = document.querySelector('#contact .links')?.getBoundingClientRect();
    const send = document.querySelector('#contact .submit')?.getBoundingClientRect();
    const HUD_W = 26;
    const X = (c: number) => this.x0 + c * g, Yr = (r: number) => this.y0 + r * g;
    if (links && links.height && links.bottom > 0 && links.bottom < vh) {
      const lBottom = Math.ceil((links.bottom - this.y0) / g);
      const from = Math.ceil((links.right - this.x0) / g) + 1;
      const to = send && send.width ? Math.floor((send.left - this.x0) / g) - 1 : this.R();
      if (to - from >= HUD_W) {
        // as tall as "send", level with it
        const y = send && send.height ? send.top : links.top, h = send && send.height ? send.height : links.height;
        this.hud.set({ x: X(from), y, w: (to - from) * g, h });
        this.top.set(lBottom + 1);
      } else {
        this.hud.set({ x: X(this.L()), y: Yr(lBottom + 1), w: Math.min(HUD_W + 4, this.cols - this.L() - 1) * g, h: 2 * g });
        this.top.set(lBottom + 4);
      }
    } else {
      this.hud.set({ x: X(this.L()), y: Yr(1), w: Math.min(HUD_W + 4, this.cols - this.L() - 1) * g, h: 2 * g });
      this.top.set(4);
    }
    const body = BODY_BOTTOM - BODY_TOP + 1;
    if (rows - 2 - this.top() < body + 2) this.top.set(Math.max(1, rows - 2 - body - 2));
    this.bottom = rows - 2;

    const el = this.rootRef.nativeElement;
    el.style.setProperty('--g', `${g}px`);
    el.style.setProperty('--x0', `${this.x0}px`);
    el.style.setProperty('--y0', `${this.y0}px`);
    const cv = this.canvas;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(vw * this.dpr);
    cv.height = Math.round(vh * this.dpr);
    cv.style.width = `${vw}px`;
    cv.style.height = `${vh}px`;
    // over the window: its containing block is the page's layer, wherever that has scrolled to
    const cb = cv.offsetParent as HTMLElement | null;
    if (cb && cb !== document.body) {
      const r = cb.getBoundingClientRect();
      cv.style.left = `${-r.left}px`;
      cv.style.top = `${-r.top}px`;
    } else {
      cv.style.position = 'fixed';
    }
    this.colors.accent = getComputedStyle(root).getPropertyValue('--color3').trim() || '#ff00fc';

    if (first) {
      // start where the footer whale is
      const r = this.whaleRect();
      if (r && r.width && r.bottom > 0 && r.top < vh) {
        this.wx = Math.round((r.left - this.x0) / g);
        this.wy = Math.round((r.top - this.y0) / g);
      } else {
        this.wx = this.R() - WHALE_W;
        this.wy = Math.round((this.top() + this.bottom - WHALE_H) / 2);
      }
    }
    this.wx = Math.max(0, Math.min(this.cols - WHALE_W + 2, this.wx));
    this.wy = this.clampWhale(this.wy);
    this.target = this.wy;
    this.dirty = true;
  }

  /** the whale may go 5 rows above the sea's top (under the links) and 2 into the floor */
  private clampWhale(y: number): number {
    return Math.max(this.top() - BODY_TOP - 5, Math.min(this.bottom + 1 - BODY_BOTTOM, y));
  }

  // ------------------------------------------------------------------ states

  start(): void {
    this.nets = [];
    this.swarms = [];
    this.pops = [];
    this.playTime = 0;
    this.worldAcc = this.whaleAcc = 0;
    this.untilNet = 8;
    this.untilKrill = 0;
    this.ticks = 0;
    this.eaten = 0;
    this.safeUntil = 0;
    this.score.set(0);
    this.lives.set(LIVES);
    this.state.set('running');
    this.rootRef.nativeElement.focus({ preventScroll: true });
    this.dirty = true;
  }

  resume(): void {
    if (this.state() !== 'paused') return;
    this.state.set('running');
    this.rootRef.nativeElement.focus({ preventScroll: true });
  }

  /** `focus` false: the visitor is typing somewhere, so the panel must not take the focus */
  private pause(focus = true): void {
    if (this.state() !== 'running') return;
    this.keyDir = 0;
    this.state.set('paused');
    if (focus) setTimeout(() => this.focusFirst());
  }

  private autoPause(focus = true): void {
    if (this.state() === 'running') this.zone.run(() => this.pause(focus));
  }

  private gameOver(): void {
    this.state.set('over');
    if (this.score() > this.best()) {
      this.best.set(this.score());
      try { localStorage.setItem(BEST_KEY, String(this.score())); } catch { /* not kept */ }
    }
    setTimeout(() => this.focusFirst(), 700);
  }

  close(): void {
    if (this.closing()) return;
    this.closing.set(true);
    this.canvas.style.opacity = '0';
    setTimeout(() => this.closed.emit(), 520);
  }

  private focusFirst(): void {
    const b = this.rootRef.nativeElement.querySelector<HTMLElement>('.panel .btn.main');
    (b ?? this.rootRef.nativeElement).focus({ preventScroll: true });
  }

  // ------------------------------------------------------------------ keys

  private onKeyDown(e: KeyboardEvent): void {
    // typing in the contact form: the keys are the visitor's, the game just waits
    if (isTyping(e.target)) { this.autoPause(false); this.keyDir = 0; return; }
    e.stopPropagation();                               // the page never sees them
    const k = e.key;
    const onButton = !!(e.target as HTMLElement | null)?.closest?.('button, a');
    if (k === 'Escape') { e.preventDefault(); this.zone.run(() => this.close()); return; }
    if (k === 'Tab') return;
    if (k === 'ArrowUp' || k === 'w' || k === 'W') { e.preventDefault(); this.keyDir = -1; this.mouseRow = null; return; }
    if (k === 'ArrowDown' || k === 's' || k === 'S') { e.preventDefault(); this.keyDir = 1; this.mouseRow = null; return; }
    if (k === 'p' || k === 'P') {
      e.preventDefault();
      this.zone.run(() => this.state() === 'running' ? this.pause() : this.resume());
      return;
    }
    if (k === ' ' || k === 'Enter') {
      if (onButton) return;                            // the button's own click
      e.preventDefault();
      if (e.repeat) return;
      this.zone.run(() => {
        const s = this.state();
        if (s === 'ready' || s === 'over') this.start();
        else if (s === 'paused') this.resume();
      });
      return;
    }
    if (['PageUp', 'PageDown', 'Home', 'End'].includes(k)) e.preventDefault();
  }

  private onKeyUp(e: KeyboardEvent): void {
    if (isTyping(e.target)) return;
    e.stopPropagation();
    const k = e.key;
    if ((k === 'ArrowUp' || k === 'w' || k === 'W') && this.keyDir < 0) this.keyDir = 0;
    if ((k === 'ArrowDown' || k === 's' || k === 'S') && this.keyDir > 0) this.keyDir = 0;
  }

  // ------------------------------------------------------------------ the loop

  /** cells a second the sea moves at: faster the longer you play */
  private speed(): number { return Math.min(16, 7 + this.playTime / 1000 * 0.12); }

  private loop = (now: number) => {
    const dt = Math.min(100, now - this.last);
    this.last = now;
    const s = this.state();
    if (s !== 'over') {
      // the whale's own animation goes on (not when caught)
      this.animAcc += dt;
      while (this.animAcc >= ANIM_MS) {
        this.animAcc -= ANIM_MS;
        this.frame = (this.frame + 1) % WHALE_FRAMES.length;
        this.dirty = true;
        if (s === 'running') { this.animateSea(); this.collide(now); }
      }
    }
    if (s === 'running') {
      this.playTime += dt;
      const v = this.speed();
      this.worldAcc += dt;
      while (this.worldAcc >= 1000 / v && this.state() === 'running') {
        this.worldAcc -= 1000 / v;
        this.worldTick();
        this.collide(now);
      }
      const wv = Math.max(15, v * 1.4);
      this.whaleAcc += dt;
      while (this.whaleAcc >= 1000 / wv && this.state() === 'running') {
        this.whaleAcc -= 1000 / wv;
        this.whaleTick();
        this.collide(now);
      }
    } else if (s === 'ready') {
      // before the start the mouse already moves the whale
      this.whaleAcc += dt;
      while (this.whaleAcc >= 1000 / 15) { this.whaleAcc -= 1000 / 15; this.whaleTick(); }
    }
    if (this.dirty) { this.dirty = false; this.draw(now); }
    this.raf = requestAnimationFrame(this.loop);
  };

  private whaleTick(): void {
    if (this.keyDir) this.target = this.wy + this.keyDir;
    else if (this.mouseRow !== null) this.target = this.mouseRow - Math.round((BODY_TOP + BODY_BOTTOM) / 2);
    const t = this.clampWhale(this.target);
    if (t !== this.wy) { this.wy += Math.sign(t - this.wy); this.dirty = true; }
  }

  private worldTick(): void {
    this.ticks++;
    this.travel++;
    for (const w of this.swarms) w.x++;
    for (const n of this.nets) n.x++;
    this.swarms = this.swarms.filter(w => w.krill.length && w.x - 6 < this.cols + 1);
    this.nets = this.nets.filter(n => n.x - n.w < this.cols + 1);
    if (--this.untilNet <= 0) this.spawnNet();
    if (--this.untilKrill <= 0) { this.spawnSwarm(); this.untilKrill = rand(10, 18); }
    this.dirty = true;
  }

  /** 12 times a second: the krill swirl in the current, the nets sway and change shape */
  private animateSea(): void {
    for (const p of this.pops) p.life--;
    this.pops = this.pops.filter(p => p.life > 0);
    const t = (this.seaT += 1 / 12);
    const top = this.top(), bottom = this.bottom;
    for (const sw of this.swarms) {
      for (const k of sw.krill) {
        // a curl of the noise: the water turns in eddies, it never piles up
        const x = k.ox * 0.42 + sw.seed, y = k.oy * 0.42, e = 0.35;
        const vx = (noise3(x, y + e, t * 0.45) - noise3(x, y - e, t * 0.45)) / (2 * e);
        const vy = -(noise3(x + e, y, t * 0.45) - noise3(x - e, y, t * 0.45)) / (2 * e);
        k.ox += vx * 0.45 - k.ox * 0.03;
        k.oy += vy * 0.32 - k.oy * 0.045;
        // within the sea
        const ay = sw.y + k.oy;
        if (ay < top) k.oy = top - sw.y; else if (ay > bottom - 0.01) k.oy = bottom - 0.01 - sw.y;
        k.w = 0.55 + 0.45 * noise3(k.seed, 7.3, t * 0.9);
      }
    }
    // the nets change shape as they float
    for (const n of this.nets) this.shapeNet(n, t);
  }

  // ------------------------------------------------------------------ what comes

  /** a net, coming in from the left at some height (room to pass above or below it) */
  private spawnNet(): void {
    const grow = Math.min(1, this.playTime / 90000);           // they get bigger as it goes on
    const n = this.makeNet(grow);
    n.x = -n.w - 1;
    n.y = rand(this.top() + n.h, Math.max(this.top() + n.h, this.bottom - 1 - n.h));
    this.nets.push(n);
    this.untilNet = Math.max(12, Math.round(22 - this.playTime / 1000 / 8)) + rand(0, 8) + 2 * n.w;
  }

  /** a net: a few lumps that sway, each its own way */
  private makeNet(grow: number): Net {
    const lumps: Lump[] = [];
    const k = rand(3, 5);
    const spread = 2 + grow * 2;
    for (let i = 0; i < k; i++) {
      lumps.push({
        ax: randf(-spread, spread), ay: randf(-1.1, 1.1), r: randf(0.9, 1.35 + grow * 0.6),
        fx: randf(0.5, 1.1), fy: randf(0.4, 0.9), px: randf(0, 6.3), py: randf(0, 6.3),
      });
    }
    const w = Math.ceil(Math.max(...lumps.map(l => Math.abs(l.ax) + l.r)) + 1.2);
    const h = Math.ceil(Math.max(...lumps.map(l => Math.abs(l.ay) + l.r)) + 1);
    const n: Net = { x: 0, y: 0, w, h, lumps, cells: [], torn: false };
    this.shapeNet(n, this.seaT);
    return n;
  }

  /** the net's cells now: where its swaying lumps together are thick enough */
  private shapeNet(n: Net, t: number): void {
    const cells: [number, number][] = [];
    const ls = n.lumps.map(l => [l.ax + 0.8 * Math.sin(t * l.fx + l.px), l.ay + 0.6 * Math.sin(t * l.fy + l.py), l.r * l.r]);
    for (let dy = -n.h; dy <= n.h; dy++) {
      for (let dx = -n.w; dx <= n.w; dx++) {
        let f = 0;
        for (const [lx, ly, rr] of ls) {
          const ex = dx + 0.5 - lx, ey = dy + 0.5 - ly;
          f += rr / (ex * ex + ey * ey + 0.01);
        }
        if (f >= 1) cells.push([dx, dy]);
      }
    }
    n.cells = cells;
  }

  /** a swarm of krill, coming in from the left */
  private spawnSwarm(): void {
    const y = randf(this.top() + 2, this.bottom - 3);
    const krill: Krill[] = [];
    for (let i = rand(8, 13); i > 0; i--) {
      krill.push({ ox: randf(-3, 3), oy: randf(-1.8, 1.8), seed: Math.random() * 1000, w: 1 });
    }
    this.swarms.push({ x: -4, y, seed: Math.random() * 1000, krill });
  }

  // ------------------------------------------------------------------ touching

  private collide(now: number): void {
    if (this.state() !== 'running') return;
    const wx = this.wx, wy = this.wy;
    const eat = EAT_CELLS[this.frame], hit = HIT_CELLS[this.frame];
    const at = (set: Set<number>, c: number, r: number) => {
      const dx = c - wx, dy = r - wy;
      return dx >= 0 && dx < WHALE_W && dy >= 0 && dy < WHALE_H && set.has(dy * WHALE_W + dx);
    };
    let ate = 0;
    for (const sw of this.swarms) {
      if (sw.x + 6 < wx || sw.x - 6 >= wx + WHALE_W) continue;
      sw.krill = sw.krill.filter(k => {
        const c = Math.floor(sw.x + k.ox), r = Math.floor(sw.y + k.oy);
        if (at(eat, c, r)) { ate++; this.pops.push({ x: c + 0.5, y: r + 0.5, life: 3 }); return false; }
        return true;
      });
    }
    if (ate) this.zone.run(() => this.eat(ate));
    if (now < this.safeUntil) return;
    for (const n of this.nets) {
      if (n.torn || n.x + n.w < wx || n.x - n.w >= wx + WHALE_W || n.y + n.h < wy || n.y - n.h >= wy + WHALE_H) continue;
      if (n.cells.some(([dx, dy]) => at(hit, n.x + dx, n.y + dy))) {
        n.torn = true;
        this.safeUntil = now + SAFE_MS;
        this.dirty = true;
        this.zone.run(() => {
          this.lives.update(l => l - 1);
          if (this.lives() <= 0) this.gameOver();
        });
        return;
      }
    }
  }

  private eat(n: number): void {
    this.score.update(s => s + n);
    const before = Math.floor(this.eaten / KRILL_PER_LIFE);
    this.eaten += n;
    if (Math.floor(this.eaten / KRILL_PER_LIFE) > before && this.lives() < LIVES) this.lives.update(l => l + 1);
    this.bump.set(false);
    clearTimeout(this.bumpTimer);
    requestAnimationFrame(() => this.zone.run(() => {
      this.bump.set(true);
      this.bumpTimer = window.setTimeout(() => this.zone.run(() => this.bump.set(false)), 260);
    }));
  }

  // ------------------------------------------------------------------ drawing

  private draw(now: number): void {
    const ctx = this.ctx, g = this.g, d = this.dpr;
    const cv = this.canvas;
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.clearRect(0, 0, cv.width / d, cv.height / d);
    const X = (c: number) => this.x0 + c * g;
    const Y = (r: number) => this.y0 + r * g;
    const left = X(0), right = X(this.cols);

    // behind: the rocks, the kelp, the floor (the canvas multiplies onto the page, so the
    // grid shows through them)
    this.drawScenery(X, Y);
    ctx.fillStyle = `rgb(${FLOOR_GREY},${FLOOR_GREY},${FLOOR_GREY})`;
    ctx.fillRect(left, Y(this.bottom), right - left, Y(this.rows()) - Y(this.bottom) + g);

    // nets
    for (const n of this.nets) this.drawNet(n, X, Y);

    // krill: each swarm a haze of pink cells, stronger where they crowd (multiplied, so over
    // the mountains and the nets they go darker, like seen through water)
    const acc = new Map<number, number>();
    const stride = 4096;
    for (const sw of this.swarms) {
      for (const k of sw.krill) {
        const x = sw.x + k.ox - 0.5, y = sw.y + k.oy - 0.5;
        const cx = Math.floor(x), cy = Math.floor(y), fx = x - cx, fy = y - cy;
        const add = (c: number, r: number, v: number) => {
          if (v <= 0.01) return;
          const key = r * stride + c;
          acc.set(key, (acc.get(key) ?? 0) + v);
        };
        add(cx, cy, (1 - fx) * (1 - fy) * k.w * 1.3);
        add(cx + 1, cy, fx * (1 - fy) * k.w * 1.3);
        add(cx, cy + 1, (1 - fx) * fy * k.w * 1.3);
        add(cx + 1, cy + 1, fx * fy * k.w * 1.3);
      }
    }
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = this.colors.accent;
    for (const [key, v] of acc) {
      const r = Math.floor(key / stride), c = key - r * stride;
      if (r < this.top() || r >= this.bottom) continue;
      ctx.globalAlpha = Math.min(1, v);
      ctx.fillRect(X(c), Y(r), g, g);
    }
    ctx.restore();
    // just eaten: a ring opening out
    ctx.strokeStyle = this.colors.accent;
    ctx.lineWidth = 2;
    for (const p of this.pops) {
      const r = (4 - p.life) * 0.5 * g;
      ctx.globalAlpha = p.life / 3;
      ctx.strokeRect(X(p.x) - r / 2, Y(p.y) - r / 2, r, r);
    }
    ctx.globalAlpha = 1;

    // the whale: grey like in the footer (darker than the scenery); pink just after a net,
    // pulsing softly (every other frame at a third: no on / off blinking)
    const hurt = now < this.safeUntil && this.state() === 'running';
    {
      const a = ALPHA[this.frame];
      const rgb = hurt ? this.hexRgb(this.colors.accent) : '120,120,120';
      const k = hurt && this.frame % 2 ? .35 : 1;
      for (let i = 0; i < a.length; i++) {
        if (!a[i]) continue;
        ctx.fillStyle = `rgba(${rgb},${a[i] * k})`;
        ctx.fillRect(X(this.wx + (i % WHALE_W)), Y(this.wy + Math.floor(i / WHALE_W)), g, g);
      }
    }
    // caught: the net over the whale
    if (this.state() === 'over') {
      ctx.strokeStyle = `rgb(${NET_GREY})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      HIT_CELLS[this.frame].forEach(i => this.mesh(ctx, X(this.wx + (i % WHALE_W)), Y(this.wy + Math.floor(i / WHALE_W)), 3));
      ctx.stroke();
    }
  }

  /** the scenery: rocks far and near (a column of cells each, its top cell as strong as the
      height reaches into it, an arch cut out of some), kelp swaying, sand, corals */
  private drawScenery(X: (c: number) => number, Y: (r: number) => number): void {
    const ctx = this.ctx, g = this.g;
    const sea = this.bottom - this.top(), floor = Y(this.bottom);
    const at = (c: number, every: number) => ((c - Math.floor(this.travel / every)) % PERIOD + PERIOD) % PERIOD;
    for (const rocks of ROCKS) {
      ctx.fillStyle = `rgb(${rocks.grey},${rocks.grey},${rocks.grey})`;
      for (let c = 0; c < this.cols; c++) {
        const w = at(c, rocks.every);
        const rows = sea * rocks.h[w], full = Math.floor(rows), part = rows - full;
        const hole = Math.round(sea * rocks.hole[w]);
        ctx.globalAlpha = 1;
        if (full > hole) ctx.fillRect(X(c), floor - full * g, g, (full - hole) * g);
        if (part > 0.04) {
          ctx.globalAlpha = part;
          ctx.fillRect(X(c), floor - (full + 1) * g, g, g);
        }
      }
    }
    ctx.globalAlpha = 1;
    // kelp: a cell wide, swaying more towards its top (12 fps, with the sea's clock)
    const t = this.seaT;
    ctx.fillStyle = `rgb(${KELP_GREY},${KELP_GREY},${KELP_GREY})`;
    const shift = Math.floor(this.travel / FLOOR_EVERY);
    for (const k of KELP) {
      const n = Math.round(sea * k.h);
      for (let r = 0; r < n; r++) {
        const sway = Math.round(Math.sin(r * 0.45 + t * 1.6 + k.ph) * Math.min(1.6, r * 0.14));
        const c = ((k.x + shift + sway) % PERIOD + PERIOD) % PERIOD;
        for (const cc of [c, c - PERIOD, c + PERIOD]) {
          if (cc >= 0 && cc < this.cols) ctx.fillRect(X(cc), floor - (r + 1) * g, g, g);
        }
      }
    }
    // sand, and the corals on it
    ctx.fillStyle = `rgb(${SAND_GREY},${SAND_GREY},${SAND_GREY})`;
    for (let c = 0; c < this.cols; c++) {
      const sh = SAND[at(c, FLOOR_EVERY)], full = Math.floor(sh), part = sh - full;
      ctx.globalAlpha = 1;
      ctx.fillRect(X(c), floor - full * g, g, full * g);
      if (part > 0.04) { ctx.globalAlpha = part; ctx.fillRect(X(c), floor - (full + 1) * g, g, g); }
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = `rgb(${CORAL_GREY},${CORAL_GREY},${CORAL_GREY})`;
    for (const coral of CORALS) {
      const base = ((coral.x + shift) % PERIOD + PERIOD) % PERIOD;
      const w = coral.shape[0].length;
      const ground = Math.floor(SAND[(coral.x + 1) % PERIOD]);
      for (const x0 of [base, base - PERIOD]) {
        if (x0 + w < 0 || x0 >= this.cols) continue;
        coral.shape.forEach((line, i) => {
          const r = coral.shape.length - 1 - i;     // rows above the sand
          for (let j = 0; j < line.length; j++) {
            if (line[j] === '#') ctx.fillRect(X(x0 + j), floor - (ground + r + 1) * g, g, g);
          }
        });
      }
    }
  }

  /** a net: a black mesh of lines at 45 degrees (Emil's sketch), cut to the net's cells; faint
      once torn */
  private drawNet(n: Net, X: (c: number) => number, Y: (r: number) => number): void {
    const ctx = this.ctx, g = this.g;
    if (!n.cells.length) return;
    const x0 = X(n.x - n.w), y0 = Y(n.y - n.h), y1 = Y(n.y + n.h + 1), x1 = X(n.x + n.w + 1);
    const step = 0.8 * g, H = y1 - y0;
    ctx.save();
    ctx.beginPath();
    for (const [dx, dy] of n.cells) ctx.rect(X(n.x + dx), Y(n.y + dy), g, g);
    ctx.clip();
    ctx.beginPath();
    for (let k = -H; k <= x1 - x0 + H; k += step) {
      ctx.moveTo(x0 + k, y0); ctx.lineTo(x0 + k + H, y1);
      ctx.moveTo(x0 + k, y1); ctx.lineTo(x0 + k + H, y0);
    }
    ctx.strokeStyle = n.torn ? 'rgba(0,0,0,0.22)' : '#000';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  /** a net's cell: its diagonals (bit 1 the one down to the right, bit 2 the other) */
  private mesh(ctx: CanvasRenderingContext2D, x: number, y: number, links: number): void {
    const g = this.g;
    if (links & 1) { ctx.moveTo(x, y); ctx.lineTo(x + g, y + g); }
    if (links & 2) { ctx.moveTo(x + g, y); ctx.lineTo(x, y + g); }
  }

  private rgbCache = new Map<string, string>();
  private hexRgb(c: string): string {
    let v = this.rgbCache.get(c);
    if (!v) {
      const h = c.replace('#', '');
      const f = h.length === 3 ? h.split('').map(x => x + x).join('') : h;
      v = [0, 2, 4].map(i => parseInt(f.slice(i, i + 2), 16) || 0).join(',');
      this.rgbCache.set(c, v);
    }
    return v;
  }
}
