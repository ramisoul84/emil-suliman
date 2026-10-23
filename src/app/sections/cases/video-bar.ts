/**
 * The time line under a case video (where the deck had its progress line).
 *
 * At rest it is a thin black line growing with the video, as thick as the frame's line under
 * it. Hovered, it opens smoothly into a bar a cell tall along the bottom of the frame (and
 * closes back into the line when the mouse leaves): grey, filled up to where the video is,
 * a black line at the mouse. At the play head a label always says what a press does there:
 * "press to stop" / "press to play". Press anywhere else and the video goes there, fast at
 * first and slowing down as it arrives (12 steps a second); drag to scrub.
 */
export interface VideoBarLabels { stop: string; play: string; }

export class VideoBar {
  /** a trip to a pressed point takes this long, in 1/12 s steps */
  private static readonly TRIP_S = 0.75;
  private static readonly FPS = 12;

  private readonly fill: HTMLElement;
  private readonly cursor: HTMLElement;
  private readonly button: HTMLButtonElement;
  private raf = 0;
  private open = false;
  private onLabel = false;
  private mouseX = 0;
  private drag: { id: number; x: number; moved: boolean; onLabel: boolean; wasPlaying: boolean } | null = null;
  private trip: { wasPlaying: boolean; steps: number[] } | null = null;
  private tripTimer = 0;
  private seekTo: number | null = null;
  private off: (() => void)[] = [];
  /** only drawn while the bar is in the window; and only what changed is written */
  private seen?: IntersectionObserver;
  private last = { fill: '', button: '', cursor: '', bw: 0, text: '' };

  constructor(private v: HTMLVideoElement, private strip: HTMLElement, private canPlay: () => boolean,
    private labels: () => VideoBarLabels = () => ({ stop: 'press to stop', play: 'press to play' })) {
    this.fill = strip.querySelector('.scrub-fill')!;
    this.cursor = strip.querySelector('.scrub-cursor')!;
    this.button = strip.querySelector('.scrub-toggle')!;
    const on = <K extends keyof HTMLElementEventMap>(el: HTMLElement, type: K, fn: (e: HTMLElementEventMap[K]) => void) => {
      el.addEventListener(type, fn as EventListener);
      this.off.push(() => el.removeEventListener(type, fn as EventListener));
    };
    on(strip, 'pointerenter', e => { this.open = true; this.move(e); });
    on(strip, 'pointermove', e => this.move(e));
    on(strip, 'pointerleave', () => { if (!this.drag) { this.open = false; this.onLabel = false; } });
    on(strip, 'pointerdown', e => this.down(e));
    on(strip, 'pointerup', e => this.up(e));
    on(strip, 'pointercancel', () => this.endDrag());
    // the label works from the keyboard too (a mouse press is handled on the bar)
    on(this.button, 'click', e => { e.preventDefault(); if ((e as MouseEvent).detail === 0) this.toggle(); });
    const seeked = () => {
      if (this.seekTo === null) return;
      const t = this.seekTo; this.seekTo = null; this.v.currentTime = t;
    };
    v.addEventListener('seeked', seeked);
    this.off.push(() => v.removeEventListener('seeked', seeked));
    this.seen = new IntersectionObserver(([e]) => {
      cancelAnimationFrame(this.raf);
      this.raf = e.isIntersecting ? requestAnimationFrame(this.frame) : 0;
    });
    this.seen.observe(strip);
  }

  destroy(): void {
    this.seen?.disconnect();
    cancelAnimationFrame(this.raf);
    clearInterval(this.tripTimer);
    this.off.forEach(f => f());
  }

  // ------------------------------------------------------------------ drawing

  private frame = () => {
    const v = this.v, d = v.duration || 0;
    const w = this.strip.clientWidth;
    // the head: the mouse while dragging, else where the video is (or is going)
    const f = this.drag?.moved ? this.at(this.mouseX) : d ? v.currentTime / d : 0;
    const head = f * w, L = this.last;
    const fill = `${(f * 100).toFixed(3)}%`;
    if (fill !== L.fill) this.fill.style.width = L.fill = fill;
    // the label sits at the play head (inside the bar at the ends)
    const playing = this.trip ? this.trip.wasPlaying : !v.paused;
    const text = playing ? this.labels().stop : this.labels().play;
    if (text !== L.text || !L.bw) {
      if (this.button.textContent !== text) this.button.textContent = text;
      L.text = text; L.bw = this.button.offsetWidth;
    }
    const bw = L.bw;
    const bl = Math.round(Math.max(0, Math.min(w - bw, head)));
    const bt = `translateX(${bl}px)`;
    if (bt !== L.button) this.button.style.transform = L.button = bt;
    this.onLabel = this.open && !this.drag?.moved && this.mouseX >= bl && this.mouseX <= bl + bw;
    this.strip.classList.toggle('open', this.open || !!this.drag);
    this.strip.classList.toggle('near', this.onLabel);
    this.strip.classList.toggle('dragging', !!this.drag?.moved);
    const ct = `translateX(${Math.round(this.mouseX)}px)`;
    if (ct !== L.cursor) this.cursor.style.transform = L.cursor = ct;
    this.raf = requestAnimationFrame(this.frame);
  };

  /** 0..1 along the bar for a mouse x (px from the bar's left) */
  private at(x: number): number {
    const w = this.strip.clientWidth;
    return w ? Math.max(0, Math.min(1, x / w)) : 0;
  }

  private move(e: PointerEvent): void {
    this.mouseX = e.clientX - this.strip.getBoundingClientRect().left;
    const dr = this.drag;
    if (!dr) return;
    if (!dr.moved && Math.abs(this.mouseX - dr.x) > 4) {
      dr.moved = true;
      this.cancelTrip();
      this.v.pause();                    // scrub smoothly; plays on when let go
    }
    if (dr.moved && this.v.duration) this.seek(this.at(this.mouseX) * this.v.duration);
  }

  // ------------------------------------------------------------------ input

  private down(e: PointerEvent): void {
    if (e.button !== 0) return;
    this.move(e);
    this.strip.setPointerCapture?.(e.pointerId);
    this.drag = { id: e.pointerId, x: this.mouseX, moved: false, onLabel: this.onLabel, wasPlaying: !this.v.paused || !!this.trip?.wasPlaying };
  }

  private up(e: PointerEvent): void {
    const dr = this.drag;
    if (!dr) return;
    this.move(e);
    this.drag = null;
    this.strip.releasePointerCapture?.(e.pointerId);
    if (dr.moved) {
      if (dr.wasPlaying && this.canPlay()) this.v.play().catch(() => { });
    } else if (dr.onLabel) {
      this.toggle();                     // "press to stop" / "press to play"
    } else if (this.v.duration) {
      this.travel(this.at(this.mouseX) * this.v.duration);
    }
    if (!this.strip.matches(':hover')) { this.open = false; this.onLabel = false; }
  }

  private endDrag(): void {
    if (this.drag?.moved && this.drag.wasPlaying && this.canPlay()) this.v.play().catch(() => { });
    this.drag = null;
  }

  private toggle(): void {
    const wasPlaying = this.trip ? this.trip.wasPlaying : !this.v.paused;
    this.cancelTrip();
    if (wasPlaying) this.v.pause();
    else if (this.canPlay()) this.v.play().catch(() => { });
  }

  private seek(t: number): void {
    if (this.v.seeking) { this.seekTo = t; return; }   // one seek at a time, the latest wins
    this.v.currentTime = t;
  }

  // ------------------------------------------------------------------ the trip

  /** to a pressed point, either way: fast at first, slowing down as it arrives (ease-out),
      in 1/12 s steps; then it plays on if it was playing */
  private travel(to: number): void {
    const wasPlaying = this.trip ? this.trip.wasPlaying : !this.v.paused;
    this.cancelTrip();
    const from = this.v.currentTime;
    if (Math.abs(to - from) < 0.05) return;
    const n = Math.max(3, Math.round(VideoBar.TRIP_S * VideoBar.FPS));
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
    const steps = Array.from({ length: n }, (_, i) => from + (to - from) * easeOut((i + 1) / n));
    this.trip = { wasPlaying, steps };
    this.v.pause();
    const stepOnce = () => {
      const t = this.trip?.steps.shift();
      if (t === undefined) { this.arrive(); return; }
      this.seek(t);
    };
    stepOnce();
    this.tripTimer = window.setInterval(stepOnce, 1000 / VideoBar.FPS);
  }

  private arrive(): void {
    const trip = this.trip;
    this.cancelTrip();
    if (trip?.wasPlaying && this.canPlay()) this.v.play().catch(() => { });
  }

  private cancelTrip(): void {
    clearInterval(this.tripTimer);
    this.tripTimer = 0;
    this.trip = null;
  }
}
