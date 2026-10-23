import { Directive, ElementRef, OnDestroy, OnInit } from '@angular/core';

/**
 * A picture or video never pops in: until it can show something (an image loaded, a video's
 * first frame) it is invisible, then it fades in. One already loaded (cached, preloaded) is
 * simply there. Works through the Web Animations API, so the element's own CSS transitions
 * and animations are left alone.
 */
@Directive({ selector: 'img[appFadeIn], video[appFadeIn]', standalone: true })
export class FadeIn implements OnInit, OnDestroy {
  private static readonly MS = 450;
  private off?: () => void;

  constructor(private host: ElementRef<HTMLImageElement | HTMLVideoElement>) { }

  ngOnInit(): void {
    // once the element's own bindings (src, poster) are in
    queueMicrotask(() => this.start());
  }

  private start(): void {
    const el = this.host.nativeElement;
    if (this.ready(el)) return;
    el.style.opacity = '0';
    const show = () => {
      this.off?.(); this.off = undefined;
      el.style.opacity = '';
      el.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: FadeIn.MS, easing: 'ease-out' });
    };
    const events = el instanceof HTMLVideoElement ? ['loadeddata', 'error'] : ['load', 'error'];
    events.forEach(e => el.addEventListener(e, show));
    this.off = () => events.forEach(e => el.removeEventListener(e, show));
    // the poster of a video is enough to show it
    if (el instanceof HTMLVideoElement && el.poster) {
      const p = new Image();
      p.onload = () => { if (this.off) show(); };
      p.src = el.poster;
    }
  }

  ngOnDestroy(): void { this.off?.(); }

  private ready(el: HTMLImageElement | HTMLVideoElement): boolean {
    return el instanceof HTMLVideoElement ? el.readyState >= 2 : el.complete && el.naturalWidth > 0;
  }
}

/** fetch pictures ahead (a cached picture shows at once) */
export function preloadImages(srcs: string[]): void {
  srcs.forEach(src => { const i = new Image(); i.decoding = 'async'; i.src = src; });
}
