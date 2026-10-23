import { Injectable, NgZone, inject } from '@angular/core';
import { isPhone } from '../_config/phone';
import { PhonePagerService } from './phone-pager.service';

/**
 * Page-by-page scrolling for the main page (mouse / trackpad / keyboard).
 *
 * One scroll gesture moves to the next "page" (landing, about, timeline, cases, solidarity,
 * contact + whale) with a long, soft glide. A page taller than the window (the timeline)
 * scrolls freely inside; at its end the next gesture moves on.
 *
 * The glide is measured from Emil's reference video (24 fps): 880 px in 1.35 s on
 * cubic-bezier(0.52, 0, 0.01, 1) — a slow start, a quick middle and a long, gentle landing.
 *
 * Touch screens and "reduce motion" keep the browser's own scrolling with CSS scroll
 * snapping (styles.scss), so nothing here runs there.
 */

/** where each page starts; the stop puts its title beside the logo (CSS scroll-margin-top) */
const PAGES = ['#home', '#about', '#timeline', '#cases', '#solidarity', '.last-page'];

const GLIDE_MS = 1350;          // for a one-page step (the video: 880 px)
const GLIDE_PX = 880;
const NEW_GESTURE_MS = 160;     // a pause this long between wheel events starts a new gesture
const RELAUNCH_AT = 0.6;        // a new gesture may start the next glide once 60% has played
const SETTLE_MS = 140;          // after a native scroll stops, glide to the nearest page
const EDGE_HOLD_MS = 1000;      // scrolled to the start / end of a tall page: rest there this long before moving on
const EDGE_GLIDE_MS = 260;

/** cubic-bezier(x1, y1, x2, y2) as a function of time 0..1, like CSS */
function bezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const x = (s: number) => ((ax * s + bx) * s + cx) * s;
  const y = (s: number) => ((ay * s + by) * s + cy) * s;
  const dx = (s: number) => (3 * ax * s + 2 * bx) * s + cx;
  return (t: number) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    let s = t;
    for (let i = 0; i < 8; i++) {           // Newton, then bisection if it stalls
      const e = x(s) - t, d = dx(s);
      if (Math.abs(e) < 1e-6) return y(s);
      if (Math.abs(d) < 1e-6) break;
      s -= e / d;
    }
    let lo = 0, hi = 1; s = t;
    for (let i = 0; i < 30; i++) {
      const v = x(s);
      if (Math.abs(v - t) < 1e-6) break;
      if (v < t) lo = s; else hi = s;
      s = (lo + hi) / 2;
    }
    return y(s);
  };
}
const ease = bezier(0.52, 0, 0.01, 1);

/**
 * A page that tells a story while the page itself stands still (the timeline): resting on
 * it, scrolling goes to the story instead of the page, and the page only moves on once the
 * story says so (told to the end and rested).
 */
export interface PageStory {
  el: HTMLElement;
  /** whether the story runs right now (e.g. only in the desktop layout) */
  active(): boolean;
  /** scroll input while resting on the page (px, + = down; fresh = the first event of a new
      swipe / key press): true = the story used it, the page stays; false = the page may move
      on now; a number = told to this end and resting, the page may move on in that many ms */
  scroll(deltaPx: number, fresh: boolean): boolean | number;
  /** the page is being glided to: from above (1) or below (-1), arriving in ms */
  arrive?(dir: number, inMs: number): void;
}

interface Layout {
  /** resting places, top to bottom: each page's start, and the end of a page taller than the window */
  stops: number[];
  /** ranges that scroll freely (pages taller than the window) */
  zones: [number, number][];
}

@Injectable({ providedIn: 'root' })
export class PageScrollService {
  private host: HTMLElement | null = null;
  private off: (() => void)[] = [];

  private raf = 0;
  private animating = false;
  private animStart = 0;
  private animDur = 0;
  private target = 0;

  private lastWheel = 0;
  private gestureUsed = false;
  private pointerDown = false;
  private settleTimer = 0;
  private lastY = 0;
  private lastDir = 0;
  /** resting at the edge of a tall page (reached by scrolling inside it) until this time */
  private holdUntil = 0;
  private holdPos = -1;
  private stories: PageStory[] = [];
  /** a swipe made during a rest: the page moves on by itself once the rest is over */
  private queued = 0;
  private queuedDir = 0;

  private readonly phonePager = inject(PhonePagerService);

  constructor(private zone: NgZone) { }

  /** true while the page-by-page mode is running (desktop pointer, motion allowed) */
  get active(): boolean {
    return !!this.host;
  }

  attach(host: HTMLElement): void {
    this.detach();
    const fine = window.matchMedia('(pointer: fine)');
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)');
    // phones (a narrow window too) page with the curtain instead (phone-pager.service)
    const update = () => {
      if (fine.matches && !calm.matches && !isPhone()) this.start(host); else this.stop();
    };
    update();
    fine.addEventListener('change', update);
    calm.addEventListener('change', update);
    this.off.push(() => {
      fine.removeEventListener('change', update);
      calm.removeEventListener('change', update);
      this.stop();
    });
  }

  detach(): void {
    this.off.splice(0).forEach(f => f());
  }

  /** a page with a story (see PageStory); returns the function that removes it */
  registerStory(story: PageStory): () => void {
    this.stories.push(story);
    return () => { this.stories = this.stories.filter(s => s !== story); };
  }

  /** the story of the page resting at y, if it is running (a few px off still counts: the
      layout above may have shifted since the page arrived) */
  private storyAt(y: number): PageStory | undefined {
    const pages = this.pageElements();
    const tol = this.tolerance();
    return this.stories.find(s => {
      if (!s.active()) return false;
      const i = pages.indexOf(s.el);
      return i >= 0 && Math.abs(this.stopFor(s.el, i, pages.length) - y) <= tol;
    });
  }

  /** how far off a resting place still counts as resting there: half a grid cell */
  private tolerance(): number {
    const g = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dynamic-grid-size')) || 20;
    return Math.max(3, g / 2);
  }

  /** resting a few px off a page's place (something above changed size after the page
      arrived; Safari doesn't keep the view in place then): put it back exactly */
  private realign(): void {
    if (!this.host || this.animating || this.pointerDown) return;
    const y = window.scrollY;
    const { stops, zones } = this.measure();
    if (zones.some(([a, b]) => y > a + 1 && y < b - 1)) return;   // scrolling freely inside a tall page
    const tol = this.tolerance();
    const near = stops.find(s => Math.abs(s - y) > 0.5 && Math.abs(s - y) <= tol);
    if (near === undefined || stops.some(s => Math.abs(s - y) <= 0.5)) return;
    window.scrollTo({ top: near, behavior: 'instant' as ScrollBehavior });
    this.lastY = window.scrollY;
  }

  /** glide to the page holding this element (menu links); false if this mode is off */
  scrollToElement(el: Element): boolean {
    if (this.phonePager.active) return this.phonePager.goToElement(el);
    if (!this.host) return false;
    const pages = this.pageElements();
    const page = pages.find(p => p === el || p.contains(el));
    const layout = this.measure();
    let y: number;
    if (page) {
      y = this.stopFor(page, pages.indexOf(page), pages.length, layout);
    } else {
      const margin = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
      y = el.getBoundingClientRect().top + window.scrollY - margin;
    }
    this.glideTo(this.clamp(y));
    return true;
  }

  // ---------------------------------------------------------------- setup

  private start(host: HTMLElement): void {
    if (this.host) return;
    this.host = host;
    document.documentElement.classList.add('page-scroll');
    this.lastY = window.scrollY;
    this.zone.runOutsideAngular(() => {
      const on = <K extends keyof WindowEventMap>(type: K, fn: (e: WindowEventMap[K]) => void, opts?: AddEventListenerOptions) => {
        window.addEventListener(type, fn as EventListener, opts);
        this.listeners.push(() => window.removeEventListener(type, fn as EventListener, opts));
      };
      on('wheel', e => this.onWheel(e), { passive: false });
      on('keydown', e => this.onKey(e));
      on('scroll', () => this.onScroll(), { passive: true });
      on('pointerdown', () => { this.pointerDown = true; this.stopGlide(); });
      on('pointerup', () => { this.pointerDown = false; this.scheduleSettle(); });
      on('pointercancel', () => { this.pointerDown = false; });
      on('resize', () => this.scheduleSettle(), { passive: true });
      // the pages change size (images, fonts, the map arriving): stay on the page's place
      if (typeof ResizeObserver !== 'undefined') {
        let pending = 0;
        const ro = new ResizeObserver(() => {
          if (!pending) pending = requestAnimationFrame(() => { pending = 0; this.realign(); });
        });
        ro.observe(document.body);
        this.listeners.push(() => { ro.disconnect(); cancelAnimationFrame(pending); });
      }
    });
  }

  private listeners: (() => void)[] = [];

  private stop(): void {
    this.listeners.splice(0).forEach(f => f());
    this.stopGlide();
    this.unqueue();
    clearTimeout(this.settleTimer);
    document.documentElement.classList.remove('page-scroll');
    this.host = null;
  }

  // ---------------------------------------------------------------- layout

  private pageElements(): HTMLElement[] {
    if (!this.host) return [];
    return PAGES.map(s => this.host!.querySelector<HTMLElement>(s)).filter((e): e is HTMLElement => !!e);
  }

  private maxScroll(): number {
    return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  }

  private clamp(y: number): number {
    return Math.min(this.maxScroll(), Math.max(0, Math.round(y)));
  }

  private stopFor(page: HTMLElement, i: number, n: number, layout?: Layout): number {
    // the last page (contact + whale) rests at the very bottom, so the whole footer shows
    if (i === n - 1) return this.maxScroll();
    const margin = parseFloat(getComputedStyle(page).scrollMarginTop) || 0;
    return this.clamp(page.getBoundingClientRect().top + window.scrollY - margin);
  }

  private measure(): Layout {
    const pages = this.pageElements();
    const vh = window.innerHeight, sy = window.scrollY, max = this.maxScroll();
    const stops: number[] = [];
    const zones: [number, number][] = [];
    pages.forEach((p, i) => {
      const start = this.stopFor(p, i, pages.length);
      stops.push(start);
      if (i === pages.length - 1) return;
      const r = p.getBoundingClientRect();
      const end = Math.min(max, Math.round(r.bottom + sy - vh));
      if (end > start + 2) {
        zones.push([start, end]);
        stops.push(end);
      }
    });
    stops.sort((a, b) => a - b);
    return { stops: stops.filter((s, i) => i === 0 || s - stops[i - 1] > 2), zones };
  }

  private zoneAt(y: number, zones: [number, number][]): [number, number] | undefined {
    return zones.find(([a, b]) => y >= a - 1 && y <= b + 1);
  }

  private nextStop(from: number, dir: number, stops: number[]): number | undefined {
    return dir > 0 ? stops.find(s => s > from + 2) : [...stops].reverse().find(s => s < from - 2);
  }

  // ---------------------------------------------------------------- input

  private onWheel(e: WheelEvent): void {
    if (e.defaultPrevented || e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    if (document.body.classList.contains('no-scroll')) return;
    const dir = Math.sign(e.deltaY);
    if (!dir || this.scrollsInside(e.target, dir)) return;

    const now = performance.now();
    if (now - this.lastWheel > NEW_GESTURE_MS) this.gestureUsed = false;
    this.lastWheel = now;
    if (this.queued && dir !== this.queuedDir) this.unqueue();

    // a glide is playing: swallow the wheel, unless a new gesture comes once it has mostly arrived
    if (this.animating) {
      e.preventDefault();
      if (this.gestureUsed || now - this.animStart < this.animDur * RELAUNCH_AT) return;
      if (this.storyAt(this.target)) return;    // never glide past a story page before it is told
      const { stops } = this.measure();
      const next = this.nextStop(this.target, dir, stops);
      if (next !== undefined) { this.gestureUsed = true; this.glideTo(next); }
      return;
    }

    this.realign();
    const y = window.scrollY;
    const { stops, zones } = this.measure();
    const px = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1);

    // resting on a story page: the page stands still and the scroll tells the story; only
    // when it is told (and has rested) does a new gesture move on
    const story = this.storyAt(y);
    if (story) {
      e.preventDefault();
      this.realign();
      const at = window.scrollY;                // exactly on the page's place again
      const fresh = !this.gestureUsed;
      const used = story.scroll(px, fresh);
      if (typeof used === 'number') {
        // resting at the end of the story: a new swipe still counts, the page goes once rested
        if (fresh) this.queue(at, dir, used);
        this.gestureUsed = true;
        return;
      }
      if (used) { this.gestureUsed = true; return; }
      if (this.gestureUsed) return;
      const next = this.nextStop(at, dir, stops);
      if (next !== undefined) { this.gestureUsed = true; this.glideTo(next); }
      return;
    }

    const z = this.zoneAt(y, zones);
    if (z) {
      // inside a tall page: the browser scrolls; stop exactly at its edges and rest there
      // (a gesture that scrolled inside never also changes the page)
      if (dir > 0 && y < z[1] - 1) {
        this.gestureUsed = true;
        if (y + px > z[1]) { e.preventDefault(); this.holdAt(z[1]); }
        return;
      }
      if (dir < 0 && y > z[0] + 1) {
        this.gestureUsed = true;
        if (y + px < z[0]) { e.preventDefault(); this.holdAt(z[0]); }
        return;
      }
    }

    e.preventDefault();
    if (this.holding(y)) {                      // still resting at the start / end of a tall page:
      if (!this.gestureUsed) { this.gestureUsed = true; this.queue(y, dir, this.holdUntil - now); }
      return;                                   // a new swipe moves on once the rest is over
    }
    if (this.gestureUsed) return;               // one page per gesture: the trackpad's momentum is ignored
    const next = this.nextStop(y, dir, stops);
    if (next === undefined) return;
    this.gestureUsed = true;
    this.glideTo(next);
  }

  /** the wheel is for an inner scroller (a text field, a scrolling list) that can still move */
  private scrollsInside(target: EventTarget | null, dir: number): boolean {
    for (let el = target as HTMLElement | null; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
      const oy = getComputedStyle(el).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 1) {
        const atTop = el.scrollTop <= 0, atEnd = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
        if ((dir > 0 && !atEnd) || (dir < 0 && !atTop)) return true;
      }
    }
    return false;
  }

  /** one step down (1) or up (-1), like a swipe: the next part of a story, else the next page
      (the side menu's arrows) */
  step(dir: number): void {
    if (!this.host) { window.scrollBy({ top: dir * window.innerHeight, behavior: 'smooth' }); return; }
    this.move(dir, false);
  }

  private onKey(e: KeyboardEvent): void {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    if (document.body.classList.contains('no-scroll')) return;
    const t = e.target as HTMLElement | null;
    const onPage = !t || t === document.body || t === document.documentElement;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;

    let dir = 0, line = false;
    switch (e.key) {
      case 'PageDown': dir = 1; break;
      case 'PageUp': dir = -1; break;
      case 'ArrowDown': dir = 1; line = true; break;
      case 'ArrowUp': dir = -1; line = true; break;
      case ' ': if (!onPage) return; dir = e.shiftKey ? -1 : 1; break;
      case 'Home': if (!onPage) return; e.preventDefault(); this.glideTo(0); return;
      case 'End': if (!onPage) return; e.preventDefault(); this.glideTo(this.maxScroll()); return;
      default: return;
    }
    if (this.move(dir, line)) e.preventDefault();
  }

  /** a key press / arrow click: true = handled here (else the browser scrolls, e.g. by a line) */
  private move(dir: number, line: boolean): boolean {
    if (this.queued && dir !== this.queuedDir) this.unqueue();
    this.realign();
    const y = this.animating ? this.target : window.scrollY;
    const { stops, zones } = this.measure();
    if (this.animating && this.storyAt(this.target)) return true;
    const story = this.animating ? undefined : this.storyAt(y);
    if (story) {
      this.realign();
      const at = window.scrollY;                // exactly on the page's place again
      const used = story.scroll((line ? 48 : window.innerHeight * 0.85) * dir, true);
      if (typeof used === 'number') { this.queue(at, dir, used); return true; }
      if (used) return true;
      const next = this.nextStop(at, dir, stops);
      if (next !== undefined) this.glideTo(next);
      return true;
    }
    const z = this.zoneAt(y, zones);
    // inside a tall page the keys scroll as usual (arrows by a line, Page Down by a screen)
    if (z && !this.animating && ((dir > 0 && y < z[1] - 1) || (dir < 0 && y > z[0] + 1))) {
      const step = (line ? 48 : window.innerHeight * 0.85) * dir;
      const edge = dir > 0 ? z[1] : z[0];
      if ((dir > 0 && y + step >= edge) || (dir < 0 && y + step <= edge)) {
        this.holdAt(edge);
        return true;
      }
      if (line) return false;
      this.glideTo(y + step, 500);
      return true;
    }
    if (this.holding(y)) { this.queue(y, dir, this.holdUntil - performance.now()); return true; }
    if (this.animating && performance.now() - this.animStart < this.animDur * RELAUNCH_AT) return true;
    const next = this.nextStop(y, dir, stops);
    if (next !== undefined) this.glideTo(next);
    return true;
  }

  private onScroll(): void {
    const y = window.scrollY;
    if (y === this.lastY) return;
    this.lastDir = Math.sign(y - this.lastY);
    this.lastY = y;
    if (this.animating) return;
    // scrolled (from inside) exactly onto the start / end of a tall page: rest there too
    for (const [a, b] of this.measure().zones) {
      const edge = this.lastDir > 0 ? b : a;
      if (Math.abs(y - edge) <= 1 && Math.abs(this.holdPos - y) > 1) {
        this.holdPos = y;
        this.holdUntil = performance.now() + EDGE_HOLD_MS;
      }
    }
    this.scheduleSettle();
  }

  /** after scrolling some other way (scroll bar, find in page, window resized) rest on a page */
  private scheduleSettle(): void {
    clearTimeout(this.settleTimer);
    this.settleTimer = window.setTimeout(() => this.settle(), SETTLE_MS);
  }

  private settle(): void {
    if (!this.host || this.animating || this.pointerDown) return;
    if (performance.now() - this.lastWheel < NEW_GESTURE_MS) { this.scheduleSettle(); return; }
    const y = window.scrollY;
    const { stops, zones } = this.measure();
    if (this.zoneAt(y, zones) || stops.some(s => Math.abs(s - y) <= 2)) return;
    let best = stops[0], bestD = Infinity;
    for (const s of stops) {
      // a little bias towards the way the page was moving
      const d = Math.abs(s - y) - (Math.sign(s - y) === this.lastDir ? window.innerHeight * 0.15 : 0);
      if (d < bestD) { bestD = d; best = s; }
    }
    this.glideTo(best, 600);
  }

  /** stop at the start / end of a tall page and rest there before the next page */
  private holdAt(edge: number): void {
    this.holdPos = this.clamp(edge);
    this.holdUntil = performance.now() + EDGE_GLIDE_MS + EDGE_HOLD_MS;
    this.glideTo(edge, EDGE_GLIDE_MS);
  }

  private holding(y: number): boolean {
    return performance.now() < this.holdUntil && Math.abs(y - this.holdPos) <= 2;
  }

  /** scrolled on while resting at y: move on to the next page in `dir` once the rest is over
      (so the swipe isn't lost and needn't be repeated) */
  private queue(y: number, dir: number, inMs: number): void {
    this.unqueue();
    this.queuedDir = dir;
    this.queued = window.setTimeout(() => {
      this.queued = 0;
      if (!this.host || this.animating || this.pointerDown || Math.abs(window.scrollY - y) > 2) return;
      const next = this.nextStop(y, dir, this.measure().stops);
      if (next !== undefined) this.glideTo(next);
    }, Math.max(0, inMs) + 20);
  }

  private unqueue(): void {
    clearTimeout(this.queued);
    this.queued = 0;
  }

  // ---------------------------------------------------------------- the glide

  /** while gliding: where the page is going (scroll y), else null — the side menu flips to
      that page as the glide starts */
  glideTarget(): number | null {
    return this.animating ? this.target : null;
  }

  /** while gliding: how far along the page is (0..1, with the glide's easing), else null */
  glideProgress(): number | null {
    if (!this.animating) return null;
    return ease(Math.min(1, (performance.now() - this.animStart) / this.animDur));
  }

  private glideTo(to: number, duration?: number): void {
    const from = window.scrollY;
    to = this.clamp(to);
    const d = to - from;
    this.stopGlide();
    if (Math.abs(d) < 1) return;
    // one page takes the video's 1.35 s; long jumps (menu) take a little longer, short ones less
    this.unqueue();
    const T = duration ?? GLIDE_MS * Math.min(1.5, Math.max(0.75, Math.pow(Math.abs(d) / GLIDE_PX, 0.25)));
    this.animating = true;
    this.animStart = performance.now();
    this.animDur = T;
    this.target = to;
    const arriving = this.storyAt(to);
    arriving?.arrive?.(Math.sign(d), T);
    const step = (now: number) => {
      const x = Math.min(1, (now - this.animStart) / T);
      window.scrollTo({ top: from + d * ease(x), behavior: 'instant' as ScrollBehavior });
      if (x < 1) {
        this.raf = requestAnimationFrame(step);
      } else {
        this.raf = 0;
        this.animating = false;
        this.lastY = window.scrollY;
        this.realign();      // the page's place may have moved a little during the glide
      }
    };
    this.raf = requestAnimationFrame(step);
  }

  private stopGlide(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.animating = false;
  }
}
