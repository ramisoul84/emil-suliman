/**
 * The about photo in depth (Emil 25 Oct): the photo as two layers, the city behind and Emil cut
 * out in front (design-sources/parallax). With the mouse the background slides the other way
 * and Emil a little towards it, a touch closer, so the picture opens up in depth; it eases to
 * the mouse and back to rest when the mouse leaves. At rest the two make up the photo exactly.
 *
 * Nothing runs while it is paused (the photo out of view) or settled: no listener, no frame.
 */
export class Parallax {
  /** how far each layer goes at the window's edge, as a share of the photo's width / height */
  // (the background's margin is 48 of 640px: it never shows; Emil only sideways — his
  // shirt runs to the photo's bottom edge — and closer from that edge)
  private static readonly BACK = { x: 0.06, y: 0.045 };
  private static readonly FRONT = { x: 0.019, y: 0 };   // of the layer's 115%: 2.2% of the photo
  /** Emil, at the mouse's furthest: this much closer */
  private static readonly ZOOM = 0.02;
  /** easing towards the mouse each frame (of 60 a second) */
  private static readonly EASE = 0.07;

  private target = { x: 0, y: 0 };
  private now = { x: 0, y: 0 };
  private frame = 0;
  private running = false;

  constructor(private readonly el: HTMLElement) {}

  /** follow the mouse (the photo in view, the layers loaded) */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.el.classList.add('on');
    window.addEventListener('pointermove', this.onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', this.onLeave);
    window.addEventListener('blur', this.onLeave);
  }

  /** out of view: the listeners go, the layers stay where they are */
  pause(): void {
    if (!this.running) return;
    this.running = false;
    window.removeEventListener('pointermove', this.onMove);
    document.documentElement.removeEventListener('pointerleave', this.onLeave);
    window.removeEventListener('blur', this.onLeave);
    cancelAnimationFrame(this.frame);
    this.frame = 0;
  }

  destroy(): void {
    this.pause();
  }

  /** the mouse across the window, each side of the photo's middle to that edge: -1 … 1 */
  private readonly onMove = (e: PointerEvent): void => {
    if (e.pointerType !== 'mouse') return;
    const r = this.el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const side = (v: number, mid: number, size: number) =>
      Math.max(-1, Math.min(1, (v - mid) / Math.max(1, v < mid ? mid : size - mid)));
    this.aim(side(e.clientX, cx, window.innerWidth), side(e.clientY, cy, window.innerHeight));
  };

  private readonly onLeave = (): void => this.aim(0, 0);

  private aim(x: number, y: number): void {
    this.target = { x, y };
    if (!this.frame) this.frame = requestAnimationFrame(this.tick);
  }

  private readonly tick = (): void => {
    const k = Parallax.EASE, n = this.now, t = this.target;
    n.x += (t.x - n.x) * k;
    n.y += (t.y - n.y) * k;
    const settled = Math.abs(t.x - n.x) < 0.004 && Math.abs(t.y - n.y) < 0.004;   // under 0.03% of a shift: unseen
    if (settled) { n.x = t.x; n.y = t.y; }
    this.paint();
    this.frame = settled ? 0 : requestAnimationFrame(this.tick);
  };

  /** the layers' offsets as custom properties (about.scss turns them into transforms) */
  private paint(): void {
    const { x, y } = this.now, s = this.el.style;
    s.setProperty('--px-back-x', `${(-x * Parallax.BACK.x * 100).toFixed(3)}%`);
    s.setProperty('--px-back-y', `${(-y * Parallax.BACK.y * 100).toFixed(3)}%`);
    s.setProperty('--px-front-x', `${(x * Parallax.FRONT.x * 100).toFixed(3)}%`);
    s.setProperty('--px-front-y', `${(y * Parallax.FRONT.y * 100).toFixed(3)}%`);
    s.setProperty('--px-zoom', (1 + Math.min(1, Math.hypot(x, y)) * Parallax.ZOOM).toFixed(4));
  }
}
