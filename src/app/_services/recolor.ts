import { DEFAULT_PALETTE, Palette } from './theme.service';

/*
 * Re-colouring pictures and animations drawn in Emil's identity to another palette.
 *
 * Their colours are of two families:
 *  - greens, along the ramp from the dark green (--color1) to the yellow-green (--color2):
 *    a colour's place on that ramp is kept and moved onto the new ramp, its little
 *    difference from the ramp (the shading) added back;
 *  - pinks/magentas (--color3): hue turned, saturation and lightness scaled like the new
 *    accent colour against the old.
 * Greys, black, white and other hues (the map's orange, red guide lines) stay. With the
 * default palette every colour comes back exactly as it was.
 */

type RGB = [number, number, number];

/** the about collage's spinning pictures (sprite sheets), drawn in the site's palette */
export const COLLAGE_SPRITES: [string, string][] = [
  ['s-tree', 'assets/images/collage/tree.webp'],
  ['s-house', 'assets/images/collage/house.webp'],
  ['s-cam', 'assets/images/collage/cam.webp'],
  ['s-duck', 'assets/images/collage/duck.webp'],
];

/** the phones' topic frames: the same sheets with the collage's patterns (lines, dots) taken
    off the symbols (Emil 23 Oct); the tree has none */
export const PHONE_SPRITES: Record<string, string> = {
  's-house': 'assets/images/collage/house-clean.webp',
  's-cam': 'assets/images/collage/cam-clean.webp',
  's-duck': 'assets/images/collage/duck-clean.webp',
};

/** get the collage pictures ready for re-colouring (decoded once, in the background) */
export function warmCollage(): void {
  COLLAGE_SPRITES.forEach(([, url]) => RecolorSource.load(url));
  Object.values(PHONE_SPRITES).forEach(url => RecolorSource.load(url));
}

export function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function rgbToHsl(r: number, g: number, b: number): RGB {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

function hslToRgb(h: number, s: number, l: number): RGB {
  h = ((h % 360) + 360) % 360 / 360;
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t: number) => {
    t = (t + 1) % 1;
    return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p;
  };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}

const clamp = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);

/** the colour mapping for a palette (null: the default palette, nothing to do) */
export function colorMapper(palette: Palette): ((r: number, g: number, b: number) => RGB) | null {
  if (palette.every((c, i) => c === DEFAULT_PALETTE[i])) return null;
  const [o1, o2, o3] = DEFAULT_PALETTE.map(hexToRgb);
  const [n1, n2, n3] = palette.map(hexToRgb);
  const d = [o2[0] - o1[0], o2[1] - o1[1], o2[2] - o1[2]];
  const dd = d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
  const nd = [n2[0] - n1[0], n2[1] - n1[1], n2[2] - n1[2]];
  const h3o = rgbToHsl(...o3), h3n = rgbToHsl(...n3);
  const dh = h3n[0] - h3o[0], sk = h3o[1] ? h3n[1] / h3o[1] : 1;
  return (r, g, b) => {
    const [h, s, l] = rgbToHsl(r, g, b);
    if (s < 0.18 || l < 0.06 || l > 0.96) return [r, g, b];
    if (h >= 45 && h <= 175) {
      // green ramp: where on it, plus the shading off it
      let t = ((r - o1[0]) * d[0] + (g - o1[1]) * d[1] + (b - o1[2]) * d[2]) / dd;
      t = Math.max(-0.6, Math.min(1.6, t));
      const res = [r - (o1[0] + t * d[0]), g - (o1[1] + t * d[1]), b - (o1[2] + t * d[2])];
      return [clamp(n1[0] + t * nd[0] + res[0]), clamp(n1[1] + t * nd[1] + res[1]), clamp(n1[2] + t * nd[2] + res[2])];
    }
    if (h >= 260 && h <= 350) {
      // accent: turn and scale like the new accent against the old (#ff00fc: s 1, l .5)
      const l2 = h3n[2] <= 0.5 ? l * (h3n[2] / 0.5) : l + (1 - l) * ((h3n[2] - 0.5) / 0.5);
      const [R, G, B] = hslToRgb(h + dh, Math.min(1, s * sk), l2);
      return [clamp(R), clamp(G), clamp(B)];
    }
    return [r, g, b];
  };
}

const cache = new Map<string, Promise<string>>();

/** a picture re-coloured to the palette, as an object URL (the original URL if default) */
export function recolorImage(url: string, palette: Palette): Promise<string> {
  const map = colorMapper(palette);
  if (!map) return Promise.resolve(url);
  const key = url + '|' + palette.join(',');
  let p = cache.get(key);
  if (!p) {
    p = new Promise<string>(resolve => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        try {
          const c = document.createElement('canvas');
          c.width = img.naturalWidth; c.height = img.naturalHeight;
          const ctx = c.getContext('2d', { willReadFrequently: true })!;
          ctx.drawImage(img, 0, 0);
          const im = ctx.getImageData(0, 0, c.width, c.height), px = im.data;
          const memo = new Map<number, RGB>();
          for (let i = 0; i < px.length; i += 4) {
            if (!px[i + 3]) continue;
            const k = (px[i] << 16) | (px[i + 1] << 8) | px[i + 2];
            let o = memo.get(k);
            if (!o) { o = map(px[i], px[i + 1], px[i + 2]); memo.set(k, o); }
            px[i] = o[0]; px[i + 1] = o[1]; px[i + 2] = o[2];
          }
          ctx.putImageData(im, 0, 0);
          c.toBlob(b => resolve(b ? URL.createObjectURL(b) : url), 'image/png');
        } catch { resolve(url); }
      };
      img.onerror = () => resolve(url);
      img.src = url;
    });
    cache.set(key, p);
    // keep only the last few palettes' pictures
    if (cache.size > 24) {
      const [oldKey, old] = cache.entries().next().value!;
      cache.delete(oldKey);
      old.then(u => { if (u.startsWith('blob:')) URL.revokeObjectURL(u); });
    }
  }
  return p;
}

/** a Lottie animation's data (a copy) with its fills, strokes and gradients re-coloured */
export function recolorLottie<T>(data: T, palette: Palette): T {
  const copy = JSON.parse(JSON.stringify(data));
  const map = colorMapper(palette);
  if (!map) return copy;
  const rgb = (a: number[], i: number) => {
    const o = map(a[i] * 255, a[i + 1] * 255, a[i + 2] * 255);
    a[i] = o[0] / 255; a[i + 1] = o[1] / 255; a[i + 2] = o[2] / 255;
  };
  const walk = (o: any) => {
    if (Array.isArray(o)) { o.forEach(walk); return; }
    if (!o || typeof o !== 'object') return;
    if ((o.ty === 'fl' || o.ty === 'st') && o.c) {
      const k = o.c.k;
      if (Array.isArray(k) && typeof k[0] === 'number') rgb(k, 0);
      else if (Array.isArray(k)) k.forEach((f: any) => { if (f?.s) rgb(f.s, 0); if (f?.e) rgb(f.e, 0); });
    }
    if ((o.ty === 'gf' || o.ty === 'gs') && o.g?.k) {
      const n = o.g.p, k = o.g.k.k;
      const stops = (a: number[]) => { for (let i = 0; i < n; i++) rgb(a, i * 4 + 1); };
      if (Array.isArray(k) && typeof k[0] === 'number') stops(k);
      else if (Array.isArray(k)) k.forEach((f: any) => { if (f?.s) stops(f.s); if (f?.e) stops(f.e); });
    }
    for (const v of Object.values(o)) walk(v);
  };
  walk(copy);
  return copy;
}

/**
 * A picture kept decoded, for re-colouring it fast and often (the collage's sprite sheets):
 * its colours are listed once, each pixel keeps the number of its colour, so a new palette
 * only maps the (few thousand) colours and writes the pixels straight into a canvas — no
 * image encoding or decoding on every change.
 */
export class RecolorSource {
  private static cache = new Map<string, Promise<RecolorSource | null>>();

  private constructor(
    readonly width: number,
    readonly height: number,
    private colors: Uint32Array,                  // RGBA as in the canvas buffer
    private index: Uint16Array | Uint32Array,     // per pixel: which colour
    private out: ImageData,
  ) { }

  static load(url: string): Promise<RecolorSource | null> {
    let p = RecolorSource.cache.get(url);
    if (!p) {
      p = new Promise<RecolorSource | null>(resolve => {
        const img = new Image();
        img.decoding = 'async';
        img.onload = () => {
          try {
            const w = img.naturalWidth, h = img.naturalHeight;
            const c = document.createElement('canvas');
            c.width = w; c.height = h;
            const ctx = c.getContext('2d', { willReadFrequently: true })!;
            ctx.drawImage(img, 0, 0);
            const data = ctx.getImageData(0, 0, w, h);
            const px = new Uint32Array(data.data.buffer);
            const ids = new Map<number, number>();
            const list: number[] = [];
            const index = new Uint32Array(px.length);
            for (let i = 0; i < px.length; i++) {
              const v = px[i];
              let id = ids.get(v);
              if (id === undefined) { id = list.length; ids.set(v, id); list.push(v); }
              index[i] = id;
            }
            const small = list.length < 65536 ? Uint16Array.from(index) : index;
            resolve(new RecolorSource(w, h, Uint32Array.from(list), small, new ImageData(w, h)));
          } catch { resolve(null); }
        };
        img.onerror = () => resolve(null);
        img.src = url;
      });
      RecolorSource.cache.set(url, p);
    }
    return p;
  }

  /** draw it in the palette into a canvas (sized to the picture) */
  draw(canvas: HTMLCanvasElement, palette: Palette): void {
    const map = colorMapper(palette);
    const mapped = new Uint32Array(this.colors.length);
    const bytes = new Uint8Array(this.colors.buffer);
    for (let j = 0; j < this.colors.length; j++) {
      const r = bytes[j * 4], g = bytes[j * 4 + 1], b = bytes[j * 4 + 2], a = bytes[j * 4 + 3];
      const o = a && map ? map(r, g, b) : [r, g, b];
      mapped[j] = ((a << 24) | (Math.round(o[2]) << 16) | (Math.round(o[1]) << 8) | Math.round(o[0])) >>> 0;
    }
    const out = new Uint32Array(this.out.data.buffer), idx = this.index;
    for (let i = 0; i < idx.length; i++) out[i] = mapped[idx[i]];
    if (canvas.width !== this.width) canvas.width = this.width;
    if (canvas.height !== this.height) canvas.height = this.height;
    canvas.getContext('2d')!.putImageData(this.out, 0, 0);
  }
}
