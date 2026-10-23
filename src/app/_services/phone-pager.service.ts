import { Injectable, NgZone, inject } from '@angular/core';
import { isPhone } from '../_config/phone';

/**
 * Phones (Emil's ttt.mp4, 22 Oct): one page at a time, and instead of sliding from one to the
 * next the curtain of the way in comes down over the page with the next page's title, the
 * page changes under it, and it runs on down the screen leaving the new page (12 fps).
 *
 * The page never scrolls by itself: a swipe (or a wheel / key on a narrow window) is one step.
 * A page with a story (the timeline) takes the steps first, one part per swipe, and lets the
 * page move on only at its ends (the cases never scroll: FIXED). A page taller than the screen (about on a small phone)
 * follows the finger inside itself; a swipe that starts at its end moves on.
 */
export interface PhoneStory {
  el: HTMLElement;
  /** a swipe while on the page: true = the story used it and the page stays */
  step(dir: number): boolean;
  /** the page arrives (under the curtain): from the page above (1) or below (-1) */
  arrive?(dir: number): void;
}

/** the pages, top to bottom */
const PAGES = ['#home', '#about', '#timeline', '#cases', '.last-page'];
/** pages that never scroll inside: a swipe always goes on (Emil 23 Oct: the cases) */
const FIXED = ['#cases'];
/** the curtain, frame by frame at 12 fps, measured from the video: how much of the screen it
    covers coming down (from the top), the frames it covers it all (the page changes under the
    second), then where its top edge is as it runs on down (% of the screen) */
export const COVER = [10.2, 58.5, 80.4, 90.9, 96.5, 99.2];
export const HOLD = 3;
export const REVEAL = [12.6, 42.4, 61.2, 73.5, 82.1, 88.5, 93.4, 96.9, 99.5];
export const FRAME_MS = 1000 / 12;
/** the curtain's frame k as a clip-path (the about page's topic box uses it too) */
export function curtainClip(k: number): string {
  return k < COVER.length ? `inset(0 0 ${(100 - COVER[k]).toFixed(1)}% 0)`
    : k < COVER.length + HOLD ? 'none' : `inset(${REVEAL[k - COVER.length - HOLD]}% 0 0 0)`;
}
/** a swipe at least this long (px) is a step */
const SWIPE_PX = 36;
/** wheel: a pause this long starts a new gesture; this much of one is a step */
const WHEEL_GAP_MS = 220;
const WHEEL_PX = 40;
/** touches here are the element's own (sliders, text fields, the colour card) */
const FREE = 'input[type="range"], textarea, select, .picker, [data-free-touch]';

@Injectable({ providedIn: 'root' })
export class PhonePagerService {
  private readonly zone = inject(NgZone);
  private host: HTMLElement | null = null;
  private off: (() => void)[] = [];
  private stories: PhoneStory[] = [];
  private index = 0;
  private busy = false;
  private raf = 0;
  private curtain?: HTMLElement;
  /** the menu is open: no paging */
  blocked: () => boolean = () => false;

  private touch: { x: number; y: number; y0: number; free: boolean } | null = null;
  private wheelLast = 0;
  private wheelAcc = 0;
  private wheelUsed = false;
  private wheelY0 = 0;

  get active(): boolean { return !!this.host; }

  attach(host: HTMLElement): void {
    this.detach();
    if (!isPhone()) return;
    this.host = host;
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    this.zone.runOutsideAngular(() => {
      const on = <K extends keyof WindowEventMap>(type: K, fn: (e: WindowEventMap[K]) => void, opts?: AddEventListenerOptions) => {
        window.addEventListener(type, fn as EventListener, opts);
        this.off.push(() => window.removeEventListener(type, fn as EventListener, opts));
      };
      on('touchstart', e => this.onTouchStart(e), { passive: true });
      on('touchmove', e => this.onTouchMove(e), { passive: false });
      on('touchend', e => this.onTouchEnd(e), { passive: true });
      on('touchcancel', () => { this.touch = null; }, { passive: true });
      on('wheel', e => this.onWheel(e), { passive: false });
      on('keydown', e => this.onKey(e));
      let pending = 0;
      const later = () => { cancelAnimationFrame(pending); pending = requestAnimationFrame(() => this.realign()); };
      on('resize', later, { passive: true });
      // pages change size as they load (fonts, pictures, the map): stay on the page
      if (typeof ResizeObserver !== 'undefined') {
        const ro = new ResizeObserver(later);
        ro.observe(document.body);
        this.off.push(() => ro.disconnect());
      }
      this.off.push(() => cancelAnimationFrame(pending));
      this.setHeight();
      // start on the page nearest to where the window is
      const tops = this.pages().map(p => this.topOf(p));
      let best = 0;
      tops.forEach((t, i) => { if (Math.abs(t - window.scrollY) < Math.abs(tops[best] - window.scrollY)) best = i; });
      this.index = best;
      this.realign();
    });
  }

  detach(): void {
    this.off.splice(0).forEach(f => f());
    cancelAnimationFrame(this.raf);
    this.curtain?.remove();
    this.curtain = undefined;
    this.busy = false;
    this.host = null;
  }

  registerStory(story: PhoneStory): () => void {
    this.stories.push(story);
    return () => { this.stories = this.stories.filter(s => s !== story); };
  }

  /** the menu's links: to the page holding this element, under the curtain */
  goToElement(el: Element): boolean {
    if (!this.host) return false;
    const i = this.pages().findIndex(p => p === el || p.contains(el) || el.contains(p));
    if (i < 0) return false;
    this.go(i);
    return true;
  }

  // ---------------------------------------------------------------- pages

  private pages(): HTMLElement[] {
    if (!this.host) return [];
    return PAGES.map(s => this.host!.querySelector<HTMLElement>(s)).filter((e): e is HTMLElement => !!e);
  }

  private topOf(el: HTMLElement): number {
    return Math.round(el.getBoundingClientRect().top + window.scrollY);
  }

  private cell(): number {
    return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dynamic-grid-size')) || 14;
  }

  /** every page at least a window tall, in whole cells (styles.scss --ph-h), so the next one
      never shows under it and each starts on a grid line */
  private setHeight(): void {
    const g = this.cell();
    const h = Math.ceil(window.innerHeight / g - 0.01) * g;
    document.documentElement.style.setProperty('--ph-h', `${h}px`);
    document.documentElement.style.setProperty('--ph-vh', `${window.innerHeight}px`);
    document.documentElement.style.setProperty('--ph-floor', `${Math.floor(window.innerHeight / g + 0.001) * g}px`);
    // what is left under the last whole row of the window (the last page keeps it free, so
    // what sits at its bottom is on the grid)
    document.documentElement.style.setProperty('--ph-rest', `${(window.innerHeight - Math.floor(window.innerHeight / g + 0.001) * g).toFixed(2)}px`);
  }

  /** where the window may rest on the current page: [its top, its top + what doesn't fit] */
  private range(): [number, number] {
    const pages = this.pages();
    const page = pages[this.index];
    if (!page) return [window.scrollY, window.scrollY];
    const top = this.topOf(page);
    if (FIXED.some(f => page.matches(f))) return [top, top];
    const next = pages[this.index + 1];
    const end = next ? this.topOf(next) : document.documentElement.scrollHeight;
    const over = end - top - window.innerHeight;
    // a page only a little taller than the window (its last part-cell) doesn't scroll
    return [top, over > this.cell() ? top + over : top];
  }

  private realign(): void {
    if (!this.host || this.busy || this.touch) return;
    // typing (the keyboard takes part of the window): the pages keep their heights
    const typing = document.activeElement?.matches?.('input, textarea, select, [contenteditable]');
    if (!typing) this.setHeight();
    const [a, b] = this.range();
    const y = Math.max(a, Math.min(b, window.scrollY));
    if (Math.abs(y - window.scrollY) > 0.5) window.scrollTo({ top: y, behavior: 'instant' as ScrollBehavior });
  }

  private storyOf(page: HTMLElement | undefined): PhoneStory | undefined {
    if (!page) return undefined;
    return this.stories.find(s => s.el === page || page.contains(s.el) || s.el.contains(page));
  }

  /** one step down (1) or up (-1): the page's story first, then the next page */
  private step(dir: number): void {
    if (this.busy || this.blocked()) return;
    const pages = this.pages();
    if (this.storyOf(pages[this.index])?.step(dir)) return;
    this.go(this.index + dir, dir);
  }

  private go(i: number, dir = Math.sign(i - this.index)): void {
    const pages = this.pages();
    if (this.busy || i < 0 || i >= pages.length || i === this.index) return;
    const page = pages[i];
    const jump = () => {
      this.index = i;
      this.setHeight();
      window.scrollTo({ top: this.topOf(page), behavior: 'instant' as ScrollBehavior });
      this.storyOf(page)?.arrive?.(dir || 1);
    };
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { jump(); return; }
    this.play(this.titleOf(page), jump, page.id === 'home' ? this.nameTop(page) : null);
  }

  /** the page's title as the curtain shows it: "ABOUT ME"; the landing: the way in's three
      lines, the name, what Emil does and where (Emil 22 Oct: like the first pink screen) */
  private titleOf(page: HTMLElement): string[] {
    if (page.id === 'home') return ['EMIL SULIMAN', 'ARCHITECT - DESIGNER', 'BERLIN, GERMANY'];
    const t = page.querySelector('.title')?.textContent ?? '';
    return [t.trim().replace(/\.$/, '').toUpperCase()];
  }

  /** where the landing's name will be on the screen (its three lines are centred in the text's
      room), so the curtain's lines lie exactly on it, as on the way in (px from the top) */
  private nameTop(home: HTMLElement): number | null {
    const box = home.querySelector<HTMLElement>('.text-container');
    if (!box) return null;
    const g = this.cell();
    const h = home.getBoundingClientRect(), b = box.getBoundingClientRect();
    return Math.round((b.top + b.bottom) / 2 - h.top - 4.5 * g);
  }

  /** the curtain: down over the page, the page changes under it, on down off the screen */
  private play(lines: string[], atCover: () => void, top: number | null = null): void {
    const el = this.curtain ??= this.makeCurtain();
    const text = el.querySelector<HTMLElement>('.pc-text')!;
    text.replaceChildren(...lines.map(l => { const s = document.createElement('span'); s.textContent = l; return s; }));
    // one line: in the middle of the screen; the name: where the page's own will be
    text.style.top = top === null ? '' : `${top}px`;
    text.style.marginTop = top === null ? `${-1.5 * lines.length * this.cell()}px` : '0';
    const panel = el.firstElementChild as HTMLElement;
    const frames = COVER.length + HOLD + REVEAL.length;
    const change = COVER.length + 1;          // the second frame it covers everything
    const clip = curtainClip;
    panel.style.clipPath = clip(0);
    el.hidden = false;
    this.busy = true;
    let shown = 0, changed = false;
    const t0 = performance.now();
    const tick = (now: number) => {
      const k = Math.floor((now - t0) / FRAME_MS);
      if (k >= change && !changed) { changed = true; atCover(); }
      if (k >= frames) {
        el.hidden = true;
        this.busy = false;
        this.raf = 0;
        return;
      }
      if (k !== shown) { shown = k; panel.style.clipPath = clip(k); }
      this.raf = requestAnimationFrame(tick);
    };
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(tick);
  }

  private makeCurtain(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'page-curtain';
    el.setAttribute('aria-hidden', 'true');
    el.hidden = true;
    el.innerHTML = '<div class="pc-panel"><p class="pc-text"><span></span></p></div>';
    document.body.appendChild(el);
    return el;
  }

  // ---------------------------------------------------------------- input

  private free(t: EventTarget | null): boolean {
    return t instanceof Element && !!t.closest(FREE);
  }

  private onTouchStart(e: TouchEvent): void {
    if (e.touches.length !== 1) { this.touch = null; return; }
    const t = e.touches[0];
    this.touch = { x: t.clientX, y: t.clientY, y0: window.scrollY, free: this.free(e.target) };
  }

  private onTouchMove(e: TouchEvent): void {
    const s = this.touch;
    if (!s || s.free || e.touches.length !== 1) return;
    // the page never slides by itself
    if (e.cancelable) e.preventDefault();
    if (this.busy || this.blocked()) return;
    // a page taller than the screen follows the finger, inside itself
    const [a, b] = this.range();
    if (b > a) {
      const y = Math.max(a, Math.min(b, s.y0 + s.y - e.touches[0].clientY));
      if (Math.abs(y - window.scrollY) > 0.5) window.scrollTo({ top: y, behavior: 'instant' as ScrollBehavior });
    }
  }

  private onTouchEnd(e: TouchEvent): void {
    const s = this.touch;
    this.touch = null;
    if (!s || s.free) return;
    const t = e.changedTouches[0];
    if (!t) return;
    const dy = s.y - t.clientY, dx = s.x - t.clientX;
    if (Math.abs(dy) < SWIPE_PX || Math.abs(dx) > Math.abs(dy)) return;
    const dir = Math.sign(dy);
    // a tall page: only a swipe that starts at its end moves on
    const [a, b] = this.range();
    if (b > a && (dir > 0 ? s.y0 < b - 1 : s.y0 > a + 1)) return;
    this.step(dir);
  }

  private onWheel(e: WheelEvent): void {
    if (e.ctrlKey || this.free(e.target)) return;
    e.preventDefault();
    const now = performance.now();
    if (now - this.wheelLast > WHEEL_GAP_MS) {
      this.wheelAcc = 0;
      this.wheelUsed = false;
      this.wheelY0 = window.scrollY;
    }
    this.wheelLast = now;
    if (this.busy || this.blocked()) { this.wheelUsed = true; return; }
    const px = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * window.innerHeight : e.deltaY;
    const [a, b] = this.range();
    if (b > a) {
      const dir = Math.sign(px);
      const atEnd = dir > 0 ? this.wheelY0 >= b - 1 : this.wheelY0 <= a + 1;
      if (!atEnd) {
        window.scrollTo({ top: Math.max(a, Math.min(b, window.scrollY + px)), behavior: 'instant' as ScrollBehavior });
        return;
      }
    }
    if (this.wheelUsed) return;
    this.wheelAcc += px;
    if (Math.abs(this.wheelAcc) >= WHEEL_PX) {
      this.wheelUsed = true;
      this.step(Math.sign(this.wheelAcc));
    }
  }

  private onKey(e: KeyboardEvent): void {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    const t = e.target instanceof Element ? e.target : null;
    if (t?.closest('input, textarea, select, [contenteditable]')) return;
    if (e.key === ' ' && t?.closest('button, a, [role="button"]')) return;
    const dir = e.key === 'ArrowDown' || e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey) ? 1
      : e.key === 'ArrowUp' || e.key === 'PageUp' || (e.key === ' ' && e.shiftKey) ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    this.step(dir);
  }
}
