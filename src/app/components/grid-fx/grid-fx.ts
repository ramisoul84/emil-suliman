import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, NgZone, OnDestroy, ViewChild } from '@angular/core';

/** look of the effect — tweak here */
const GRID = 'rgb(220, 223, 220)';    // the page grid's grey (rgba(196,202,196,.6) on white)
const PAPER = 'rgb(255, 255, 255)';   // the page behind the grid (--color-bg-top / -bottom)
const R_CORE = 0.7;                   // cells: smallest crosses inside this radius
const R_EDGE = 5.5;                   // cells: crosses are full-size and grid grey again here
const MIN_ARM = 0.12;                 // arm length at the cursor, as a share of half a cell
const IDLE_MS = 2000;                 // the hole shrinks to nothing after the mouse rests this long
const ZOOM_STEP = 0.45;               // per 1/12 s frame (ease-out, 12 fps like the timeline):
                                      // ~6 frames to zoom fully in or out
const FOLLOW = 0.16;                  // per screen frame: how fast the hole catches up (the lag)
const TRAIL_MS = 750;                 // a spot the hole has left closes up over this long
const TRAIL_STEP = 0.35;              // cells between the drops it leaves behind
/** what counts as clickable: anything showing the pointer hand, links, buttons, form fields */
const CLICKABLE = 'a, button, input, textarea, select, label, [role="button"], .pick, .card';

/** a spot the hole passed through: where, when, and how open it was then */
interface Drop { x: number; y: number; t: number; s: number; }

/**
 * Mouse-reactive page grid: around the cursor the grid is reduced to its crossings — the
 * lines between them are taken away, leaving grey + marks, smallest at the cursor and longer
 * further out until they join up into the plain grid again at the edge.
 * The hole is liquid: it trails the cursor, and every spot it leaves closes up slowly behind
 * it (the outside first), so a tapering trace runs from the closing old spot to the open new
 * one. A transparent canvas under the page content (z-index -1 inside .main) covers just the
 * hole and its trace, so it only shows where the grid shows. Mouse / trackpad only.
 */
@Component({
  selector: 'app-grid-fx',
  template: '<canvas #canvas aria-hidden="true"></canvas>',
  styles: [`
    :host { position: absolute; inset: 0; z-index: -1; pointer-events: none; overflow: hidden; }
    canvas { position: absolute; left: 0; top: 0; display: block; opacity: 0; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GridFx implements AfterViewInit, OnDestroy {
  @ViewChild('canvas') private canvasRef!: ElementRef<HTMLCanvasElement>;

  private ctx?: CanvasRenderingContext2D;
  private frame = 0;
  /** where the mouse last was, in cells on the grid (fixed to the page: when the page
      scrolls under a resting mouse the hole stays where it is on the grid) */
  private gx = NaN;
  private gy = NaN;
  private lastX = NaN;
  private lastY = NaN;
  private g = 0;
  private x = NaN;           // the hole's centre (trailing the cursor), cells from the grid origin
  private y = NaN;
  /** 0..1: how far the effect is zoomed in. Out = the crosses expand back into the grid from
   *  the outside in (the centre goes last); in = they grow out from the centre. */
  private zoom = 0;
  private zoomTick = 0;
  private lastMove = 0;
  private overClickable = false;
  private inside = false;
  private trail: Drop[] = [];
  private size = { w: 0, h: 0, dpr: 1 };
  private cleanups: (() => void)[] = [];

  constructor(private host: ElementRef<HTMLElement>, private zone: NgZone) { }

  ngAfterViewInit(): void {
    if (!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) return;
    this.ctx = this.canvasRef.nativeElement.getContext('2d') ?? undefined;
    if (!this.ctx) return;

    this.zone.runOutsideAngular(() => {
      const move = (e: PointerEvent) => {
        if (e.pointerType && e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
        // the browser sends a 'move' at the same place after the page scrolls (to update
        // hover): the mouse hasn't moved, so the hole stays where it is
        if (e.clientX === this.lastX && e.clientY === this.lastY) return;
        this.lastX = e.clientX; this.lastY = e.clientY;
        const g = this.g || this.gridSize();
        if (!g) return;
        const origin = this.host.nativeElement.getBoundingClientRect();   // = the grid origin (.main)
        this.gx = (e.clientX - origin.left) / g;
        this.gy = (e.clientY - origin.top) / g;
        const el = e.target instanceof Element ? e.target : null;
        this.overClickable = !!el && (!!el.closest(CLICKABLE) || getComputedStyle(el).cursor === 'pointer');
        this.inside = true;
        this.lastMove = performance.now();
        this.kick();
      };
      const leave = () => { this.inside = false; this.kick(); };
      const scroll = () => { if (this.zoom > 0 || this.trail.length) this.kick(); };
      window.addEventListener('pointermove', move, { passive: true });
      document.documentElement.addEventListener('pointerleave', leave);
      window.addEventListener('blur', leave);
      window.addEventListener('scroll', scroll, { passive: true });
      this.cleanups.push(
        () => window.removeEventListener('pointermove', move),
        () => document.documentElement.removeEventListener('pointerleave', leave),
        () => window.removeEventListener('blur', leave),
        () => window.removeEventListener('scroll', scroll),
      );
    });
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.frame);
    this.cleanups.forEach(fn => fn());
  }

  private kick(): void {
    if (!this.frame) this.frame = requestAnimationFrame(() => this.tick());
  }

  private gridSize(): number {
    return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dynamic-grid-size')) || 0;
  }

  private tick(): void {
    this.frame = 0;
    const g = this.g = this.gridSize();
    if (!g || Number.isNaN(this.gx)) return;
    const tx = this.gx, ty = this.gy;

    const now = performance.now();
    const active = this.inside && now - this.lastMove < IDLE_MS;
    // zoomed in while the mouse moves over plain grid; out when it rests, leaves, or is over
    // something clickable — always stepped in whole 1/12 s frames
    const target = active && !this.overClickable ? 1 : 0;
    if (now >= this.zoomTick) {
      // fixed 12 fps clock (not "since last frame", which drifts to 10 fps on 60 Hz screens)
      this.zoomTick = Math.max(this.zoomTick + 1000 / 12, now - 1000 / 12);
      this.zoom += (target - this.zoom) * ZOOM_STEP;
      if (Math.abs(target - this.zoom) < 0.02) this.zoom = target;
    }
    if (Number.isNaN(this.x) || this.zoom < 0.02) { this.x = tx; this.y = ty; }
    else { this.x += (tx - this.x) * FOLLOW; this.y += (ty - this.y) * FOLLOW; }
    // close enough: settle exactly, so a resting hole is perfectly still (no flicker of the
    // + marks while it creeps the last fraction of a pixel)
    if (Math.abs(tx - this.x) < 0.03 && Math.abs(ty - this.y) < 0.03) { this.x = tx; this.y = ty; }

    // drops along the way the hole has come, every TRAIL_STEP cells; old ones run out
    if (this.zoom >= 0.02) {
      const last = this.trail[this.trail.length - 1];
      if (!last) this.trail.push({ x: this.x, y: this.y, t: now, s: this.zoom });
      else {
        const d = Math.hypot(this.x - last.x, this.y - last.y);
        for (let k = 1; k * TRAIL_STEP <= d; k++) {
          const f = (k * TRAIL_STEP) / d;
          this.trail.push({ x: last.x + (this.x - last.x) * f, y: last.y + (this.y - last.y) * f, t: now, s: this.zoom });
        }
      }
    }
    this.trail = this.trail.filter(p => now - p.t < TRAIL_MS);

    this.draw(g, now);

    const settling = tx !== this.x || ty !== this.y;
    if (settling || active || this.zoom !== target || this.trail.length) this.kick();
  }

  /** how open a drop still is (0 closed … its own strength), closing smoothly */
  private strength(p: Drop, now: number): number {
    const a = Math.min(1, (now - p.t) / TRAIL_MS);
    return p.s * (1 - a * a * (3 - 2 * a));
  }

  private draw(g: number, now: number): void {
    const canvas = this.canvasRef.nativeElement;
    const ctx = this.ctx!;
    // the hole and its trace: the drops, oldest first, then the hole itself
    const pts = this.trail.map(p => ({ x: p.x, y: p.y, s: this.strength(p, now) }));
    if (this.zoom > 0.01) pts.push({ x: this.x, y: this.y, s: this.zoom });
    const open = pts.filter(p => p.s > 0.01);
    if (!open.length) { canvas.style.opacity = '0'; return; }

    // a canvas over just that, snapped to whole cells (grown with some slack, never shrunk)
    const pad = R_EDGE + 1;
    const col = Math.floor(Math.min(...open.map(p => p.x)) - pad);
    const row = Math.floor(Math.min(...open.map(p => p.y)) - pad);
    const cols = Math.ceil(Math.max(...open.map(p => p.x)) + pad) - col;
    const rows = Math.ceil(Math.max(...open.map(p => p.y)) + pad) - row;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const needW = cols * g + 1, needH = rows * g + 1;
    if (needW > this.size.w || needH > this.size.h || this.size.dpr !== dpr) {
      const w = Math.max(needW, this.size.w, (2 * pad + 8) * g + 1);
      const h = Math.max(needH, this.size.h, (2 * pad + 8) * g + 1);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      this.size = { w, h, dpr };
    }
    canvas.style.transform = `translate(${col * g}px, ${row * g}px)`;
    canvas.style.opacity = '1';

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.size.w, this.size.h);   // transparent: the page grid shows as it is

    const smooth = (a: number, b: number, v: number) => {
      const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
      return t * t * (3 - 2 * t);
    };
    // how far a crossing is inside the hole: its distance to the trace (the path through the
    // drops), stretched where the trace is closing — so a closing spot shrinks from the
    // outside in and the trace tapers off behind the hole
    const segs = pts.length > 1 ? pts.slice(1).map((b, i) => [pts[i], b]) : [[pts[0], pts[0]]];
    const reach = (px: number, py: number) => {
      let best = Infinity;
      for (const [a, b] of segs) {
        const dx = b.x - a.x, dy = b.y - a.y;
        const len2 = dx * dx + dy * dy;
        const u = len2 ? Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / len2)) : 0;
        const s = a.s + (b.s - a.s) * u;
        if (s <= 0.01) continue;
        const d = Math.hypot(px - (a.x + dx * u), py - (a.y + dy * u));
        const n = d / s + R_EDGE * Math.pow(1 - s, 3);
        if (n < best) best = n;
      }
      return best;
    };
    // arm of the + at each crossing, in whole pixels; half a cell = plain grid
    const nx = cols + 1, ny = rows + 1;
    const half = g / 2;
    const arms: number[] = new Array(nx * ny);
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < ny; j++) {
        const n = reach(col + i, row + j);
        arms[i * ny + j] = n >= R_EDGE ? half
          : Math.round((MIN_ARM + (1 - MIN_ARM) * smooth(R_CORE, R_EDGE, n)) * half);
      }
    }
    // every grid line between two crossings where either is a +: take the line away (paint
    // the paper over it, crossings left alone) and draw back the two arms in grid grey
    const gap = (a: number, b: number) => a < half || b < half;
    const edge = (x: number, y: number, horizontal: boolean, a: number, b: number) => {
      const len = g - 1;
      ctx.fillStyle = PAPER;
      if (horizontal) ctx.fillRect(x + 1, y, len, 1); else ctx.fillRect(x, y + 1, 1, len);
      ctx.fillStyle = GRID;
      const la = Math.min(a, len / 2), lb = Math.min(b, len / 2);
      if (horizontal) { ctx.fillRect(x + 1, y, la, 1); ctx.fillRect(x + g - lb, y, lb, 1); }
      else { ctx.fillRect(x, y + 1, 1, la); ctx.fillRect(x, y + g - lb, 1, lb); }
    };
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < ny; j++) {
        const a = arms[i * ny + j];
        if (i + 1 < nx && gap(a, arms[(i + 1) * ny + j])) edge(i * g, j * g, true, a, arms[(i + 1) * ny + j]);
        if (j + 1 < ny && gap(a, arms[i * ny + j + 1])) edge(i * g, j * g, false, a, arms[i * ny + j + 1]);
      }
    }
  }
}
