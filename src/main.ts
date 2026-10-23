import './zone-flags';
import 'zone.js';
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

/* phones (Emil 23 Oct): the page opens at its right size and doesn't zoom, in or out. The
   viewport (index.html) says so from the first moment, and it is set again whenever the page
   is shown (Safari brought back an old zoom, e.g. from a text field, with the page); an iPhone
   ignores it for pinching, so its pinch gestures are stopped too; double-tap zoom is off in
   styles.scss (touch-action). Larger screens may zoom. */
if (typeof window !== 'undefined') {
  const meta = document.querySelector('meta[name="viewport"]');
  const LOCKED = 'width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no';
  if (window.matchMedia?.('(max-width: 575.98px)').matches) {
    // re-applied, so Safari snaps back to scale 1
    const lock = () => { meta?.setAttribute('content', LOCKED + ', shrink-to-fit=no'); requestAnimationFrame(() => meta?.setAttribute('content', LOCKED)); };
    lock();
    window.addEventListener('pageshow', lock);
    window.addEventListener('orientationchange', lock);
    for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
      document.addEventListener(type, e => e.preventDefault(), { passive: false });
    }
    document.addEventListener('touchmove', e => { if (e.touches.length > 1 && e.cancelable) e.preventDefault(); }, { passive: false });
  } else {
    meta?.setAttribute('content', 'width=device-width, initial-scale=1');
  }
}

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));