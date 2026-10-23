/**
 * Before zone.js: animation frames are not watched by Angular. Every frame of the page's own
 * animations (GSAP's clock, the glides, the map) otherwise ran a change detection pass over
 * the whole app — the stutter on the way from one page to the next. The few frame callbacks
 * that change what a template shows tell Angular themselves (zone.run / signals).
 */
(globalThis as any).__Zone_disable_requestAnimationFrame = true;
