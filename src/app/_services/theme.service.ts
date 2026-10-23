import { Injectable, effect, signal } from '@angular/core';

/** the site's three colours: dark (--color1), light (--color2), accent (--color3) */
export type Palette = [string, string, string];

/** Emil's identity: dark green, yellow-green, magenta */
export const DEFAULT_PALETTE: Palette = ['#226b22', '#acc424', '#ff00fc'];

const KEY = 'es-palette';

/**
 * The site's colours. Changed with the blob's colour pickers on the landing page, they
 * re-colour the whole site — header, buttons, the timeline and its map, the collage
 * pictures (see recolor.ts) — and stay chosen in this browser (localStorage) until changed
 * again. Applied as the CSS variables --color1 / --color2 / --color3 on <html>.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly palette = signal<Palette>(this.load());

  constructor() {
    this.apply(this.palette());               // at once, before the first paint
    effect(() => {
      const p = this.palette();
      this.apply(p);
      this.save(p);
    });
  }

  set(index: 0 | 1 | 2, color: string): void {
    const hex = normalize(color);
    if (!hex) return;
    const p = [...this.palette()] as Palette;
    p[index] = hex;
    this.palette.set(p);
  }

  setAll(p: Palette): void {
    const n = p.map(normalize);
    if (n.every(Boolean)) this.palette.set(n as Palette);
  }

  reset(): void {
    this.palette.set([...DEFAULT_PALETTE]);
  }

  /** shows other colours for a moment (the landing tutorial): only the CSS colours, nothing
      kept or redrawn; null shows the site's own again */
  preview(p: Palette | null): void {
    this.apply(p ?? this.palette());
  }

  isDefault(p: Palette = this.palette()): boolean {
    return p.every((c, i) => c === DEFAULT_PALETTE[i]);
  }

  private apply(p: Palette): void {
    const root = document.documentElement.style;
    root.setProperty('--color1', p[0]);
    root.setProperty('--color2', p[1]);
    root.setProperty('--color3', p[2]);
    // the timeline's cards: black words on their gradient, white where black can't be read
    // (measured a quarter of the way in, where the words are: 3/4 the first colour)
    root.setProperty('--ink-cards', inkOn(mix(p[0], p[1], .25)));
  }

  private load(): Palette {
    try {
      const v = JSON.parse(localStorage.getItem(KEY) ?? 'null');
      if (Array.isArray(v) && v.length === 3) {
        const n = v.map((c: unknown) => normalize(String(c)));
        if (n.every(Boolean)) return n as Palette;
      }
    } catch { /* no storage here: the default colours */ }
    return [...DEFAULT_PALETTE];
  }

  private save(p: Palette): void {
    try {
      if (this.isDefault(p)) localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, JSON.stringify(p));
    } catch { /* not kept, fine */ }
  }
}

/** '#ABC' / '#AABBCC' → '#aabbcc' (else '') */
function normalize(c: string): string {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c.trim());
  if (!m) return '';
  const h = m[1].length === 3 ? m[1].split('').map(x => x + x).join('') : m[1];
  return '#' + h.toLowerCase();
}

/* ---- reading on a colour */
const lin = (c: number) => (c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
const rgb = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
function luminance(h: string): number {
  const [r, g, b] = rgb(h).map(c => lin(c / 255));
  return .2126 * r + .7152 * g + .0722 * b;
}
/** a and b mixed (t of b) */
function mix(a: string, b: string, t: number): string {
  const x = rgb(a), y = rgb(b);
  return '#' + x.map((c, i) => Math.round(c + (y[i] - c) * t).toString(16).padStart(2, '0')).join('');
}
/** black, unless it can hardly be read on this colour (contrast under 3.5: 4.4 on Emil's
    green cards) and white reads better */
function inkOn(bg: string): string {
  const y = luminance(bg);
  const black = (y + .05) / .05, white = 1.05 / (y + .05);
  return black >= 3.5 || black >= white ? '#000' : '#fff';
}
