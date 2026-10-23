import { Injectable, NgZone, inject, signal } from '@angular/core';

/**
 * The landing's way in, frame by frame at 12 fps (Emil's Comp 15.mp4), counted from the moment
 * the header's second row is half down (frame 0, header.ts); before it the grid fades in and
 * the header's rows start coming down:
 *   2–9    a pink bar wipes over "emil suliman" in the bar and leaves the name there (header)
 *   4–14   a pink bar wipes over the menu and leaves the words there (header)
 *   7–18, 9–20, 11–22   a pink bar over each line of the name, leaving it there (home.ts)
 *   18–20  the blob fades in (home.ts)
 *   30–32  its controls fade in, a second later (home.ts)
 *   36     the "i" lifts once (control.ts)
 */
@Injectable({ providedIn: 'root' })
export class IntroService {
  static readonly END = 36;
  /** frames since the header's second row showed; -1 before */
  readonly frame = signal(-1);
  /** when frame 0 began (performance.now()) */
  t0 = 0;
  private readonly zone = inject(NgZone);
  private timer = 0;

  /** straight to the end, everything in place (phones open with the curtain instead, main.ts) */
  skip(): void {
    if (this.frame() >= IntroService.END) return;
    clearInterval(this.timer);
    this.t0 = performance.now() - IntroService.END * 1000 / 12;
    this.frame.set(IntroService.END);
  }

  begin(): void {
    if (this.frame() >= 0) return;
    if (typeof window === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      this.frame.set(IntroService.END);
      return;
    }
    const t0 = this.t0 = performance.now();
    this.frame.set(0);
    // counted outside Angular: only a new frame (the signal) brings the views up to date
    this.zone.runOutsideAngular(() => {
      this.timer = window.setInterval(() => {
        const f = Math.min(IntroService.END, Math.floor((performance.now() - t0) * 12 / 1000));
        if (f !== this.frame()) this.zone.run(() => this.frame.set(f));
        if (f >= IntroService.END) clearInterval(this.timer);
      }, 20);
    });
  }
}
