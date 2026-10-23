/**
 * The German part of the map: Ludwigshafen → Stuttgart → Berlin.
 *
 * The map (map.json) is zoomed in once the story arrives in Germany (css: .germany), and the
 * moves between its cities are drawn over it (Emil's animation, 2.5 s at 24 fps): the place
 * you are at is a white square (like the map's pin), a dashed line to a black dot at the next
 * city, its dashes running on towards it; they swap — the square shrinks into a dot, the dot grows into a square — and
 * the old dot and the line fade away, leaving the square on the new city.
 *
 * The cities are found on screen through three invisible marks added to the map's animation,
 * children of its camera, so they move and zoom with it exactly.
 */

/** the cities in the map's camera space (= its route lines' ends) */
const CITY_POINTS: Record<string, [number, number]> = {
  ludwigshafen: [-294.12, -187.7],
  stuttgart: [-279.39, -173.83],
  berlin: [-250.5, -228.28],
};

/** each move between two German cities: its map frames (as Timeline.MAP_MOVES) */
export const GERMAN_LEGS: { a: number; b: number; from: string; to: string }[] = [
  { a: 359, b: 400, from: 'ludwigshafen', to: 'stuttgart' },
  { a: 433, b: 474, from: 'stuttgart', to: 'berlin' },
];
/** from this map frame on the story is in Germany (the route from Norway has gone) */
export const GERMANY_FROM = 342;

export function germanLeg(frame: number) {
  return GERMAN_LEGS.find(l => frame > l.a - 2 && frame < l.b + 2) ?? null;
}

export const cityMarkId = (city: string) => `tl-city-${city}`;
/** Syria's colour (its layer), faded in by timeline.ts on the story's first swipe */
export const SYRIA_ID = 'tl-syria';

/** the countries lit when the story reaches them */
export const COUNTRY_CLASS = 'country';
const COUNTRY_LAYERS = ['Syria', 'Russia', 'Norway', 'Germany 2'];

/**
 * The lit countries (Emil, 21 Oct): one gradient of the site's two greens, the first from the
 * country's top right corner to the second at its bottom left; their edge drawn in the same
 * gradient over the black borders under it (timeline.scss: 3px on screen), so a country sits
 * inside its lines with no black outline. 'Germany', a second Germany under 'Germany 2' that
 * showed at its edges, is left out. Run on the default colours, before recolorLottie maps
 * them to the palette (c1, c2: the default first and second colour, 0..1).
 */
export function litCountries(data: any, c1: number[], c2: number[]): any {
  const stops = () => ({ p: 2, k: { a: 0, k: [0, ...c1, 1, ...c2] } });
  const val = (v: any) => (Array.isArray(v?.k) && typeof v.k[0] === 'object' ? v.k[0].s : v?.k);
  type M = (p: number[]) => number[];
  const trOf = (tr: any): M => {
    const p = val(tr?.p) ?? [0, 0], a = val(tr?.a) ?? [0, 0], sc = val(tr?.s) ?? [100, 100];
    const r = ((Array.isArray(val(tr?.r)) ? val(tr?.r)[0] : val(tr?.r)) ?? 0) * Math.PI / 180;
    const cos = Math.cos(r), sin = Math.sin(r);
    return ([x, y]) => {
      const u = (x - a[0]) * sc[0] / 100, v = (y - a[1]) * sc[1] / 100;
      return [u * cos - v * sin + p[0], u * sin + v * cos + p[1]];
    };
  };
  // the corners of everything a style item paints: the shapes in its list and in the groups
  // below it (through their transforms)
  const bounds = (items: any[]) => {
    const b = [Infinity, Infinity, -Infinity, -Infinity];
    const walk = (list: any[], m: M) => list.forEach(it => {
      if (it.ty === 'sh') {
        const k = it.ks?.k, verts: number[][] = (Array.isArray(k) ? k[0]?.s?.[0]?.v : k?.v) ?? [];
        verts.forEach(pt => { const [x, y] = m(pt); b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y); });
      } else if (it.ty === 'gr') {
        const t = trOf((it.it ?? []).find((x: any) => x.ty === 'tr'));
        walk(it.it ?? [], pt => m(t(pt)));
      }
    });
    walk(items, pt => pt);
    return b;
  };
  const visit = (items: any[]) => {
    const at = items.findIndex(i => i.ty === 'gf');
    if (at >= 0) {
      const [x0, y0, x1, y1] = bounds(items);
      const gf = items[at];
      Object.assign(gf, { t: 1, g: stops(), s: { a: 0, k: [x1, y0] }, e: { a: 0, k: [x0, y1] } });
      // its edge, in the same gradient, drawn over it
      items.splice(at, 0, {
        ty: 'gs', nm: 'edge', t: 1, o: { a: 0, k: 100 }, w: { a: 0, k: 4 }, lc: 2, lj: 2, ml: 4,
        g: stops(), s: { a: 0, k: [x1, y0] }, e: { a: 0, k: [x0, y1] },
      });
    }
    items.forEach(i => {
      if (i.ty === 'gr') visit(i.it ?? []);
      if (i.ty === 'st') i.o = { a: 0, k: 0 };     // their own black lines (width 0): off
    });
  };
  const layers = data.layers.map((l: any) => {
    if (l.nm === 'Germany') return { ...l, hd: true };
    if (!COUNTRY_LAYERS.includes(l.nm)) return l;
    const copy = JSON.parse(JSON.stringify(l));
    visit(copy.shapes ?? []);
    return { ...copy, cl: COUNTRY_CLASS };
  });
  return { ...data, layers };
}

/** the dashed routes between countries (path 1–3), this much of their drawn width */
const COUNTRY_LINE = 0.5;
function thinner(items: any[], k: number): any[] {
  return items.map(it => it.ty === 'gr' ? { ...it, it: thinner(it.it ?? [], k) }
    : it.ty === 'st' && it.w?.a === 0 ? { ...it, w: { ...it.w, k: it.w.k * k } } : it);
}

/** the map's animation with the marks added, its own thin German route lines hidden and the
    routes between countries thinner */
export function withCityMarks(data: any): any {
  const layers = data.layers.map((l: any) => (l.nm === 'path 4' || l.nm === 'path 5') ? { ...l, hd: true }
    : /^path [123]$/.test(l.nm) ? { ...l, shapes: thinner(l.shapes, COUNTRY_LINE) }
    : l.nm === 'Syria' ? { ...l, ln: SYRIA_ID } : l);
  const camera = data.layers.find((l: any) => l.nm === 'Null 65')?.ind ?? 3;
  let ind = Math.max(...data.layers.map((l: any) => l.ind ?? 0)) + 1;
  const v = (k: unknown) => ({ a: 0, k });
  for (const [city, [x, y]] of Object.entries(CITY_POINTS)) {
    layers.push({
      ddd: 0, ind: ind++, ty: 4, nm: `city ${city}`, ln: cityMarkId(city), parent: camera, sr: 1,
      ks: { o: v(100), r: v(0), p: v([x, y, 0]), a: v([0, 0, 0]), s: v([100, 100, 100]) },
      ao: 0, ip: data.ip ?? 0, op: data.op, st: 0, bm: 0,
      shapes: [{
        ty: 'gr', nm: 'mark', it: [
          { ty: 'rc', d: 1, s: v([2, 2]), p: v([0, 0]), r: v(0), nm: 'r' },
          { ty: 'fl', c: v([0, 0, 0, 1]), o: v(0), r: 1, nm: 'f' },
          { ty: 'tr', p: v([0, 0]), a: v([0, 0]), s: v([100, 100]), r: v(0), o: v(100), sk: v(0), sa: v(0), nm: 't' },
        ],
      }],
    });
  }
  return { ...data, layers };
}

/** what the move shows at t (0..1 along it), in the animation's 60 frames */
export interface RouteState {
  line: number;                     // opacity of the dashed line
  flow: number;                     // how far its dashes have run on towards the next city (cells)
  a: Mark; b: Mark;                 // the city left, the city reached
}
/** a square (s: its size, 0..1 of a cell), a ring (outline circle) or a dot (r: 0..1 of full) */
export type Mark = { kind: 'square'; s: number } | { kind: 'ring'; r: number } | { kind: 'dot'; r: number } | null;

export function routeState(t: number): RouteState {
  const f = Math.max(0, Math.min(60, t * 60));
  const ease = (x: number) => 1 - (1 - Math.max(0, Math.min(1, x))) ** 2;
  // the line between the two, its dashes running on towards the city reached
  const line = f < 6 ? ease(f / 6) : f < 36 ? 1 : f < 56 ? 1 - ease((f - 36) / 20) : 0;
  const flow = f * 0.08;
  let a: Mark, b: Mark;
  // the place left: the square, shrinking into a ring, a dot, then gone
  if (f < 21) a = { kind: 'square', s: 1 };
  else if (f < 22) a = { kind: 'square', s: .8 };
  else if (f < 23) a = { kind: 'square', s: .6 };
  else if (f < 25) a = { kind: 'ring', r: .75 };
  else if (f < 26) a = { kind: 'dot', r: .75 };
  else if (f < 48) a = { kind: 'dot', r: 1 };
  else if (f < 56) a = { kind: 'dot', r: 1 - (f - 48) / 8 };
  else a = null;
  // the place reached: a dot growing in, a ring, then the square growing to a cell
  if (f < 6) b = { kind: 'dot', r: ease(f / 6) };
  else if (f < 21) b = { kind: 'dot', r: 1 };
  else if (f < 22) b = { kind: 'ring', r: .9 };
  else if (f < 23) b = { kind: 'square', s: .55 };
  else if (f < 29) b = { kind: 'square', s: .55 + .45 * ease((f - 23) / 6) };
  else b = { kind: 'square', s: 1 };
  return { line, flow, a, b };
}

/** the name shown beside the pin at each place */
export const PLACE_NAMES: Record<string, string> = {
  syria: 'LATAKIA',
  russia: 'MOSCOW',
  norway: 'MOSJØEN',
  ludwigshafen: 'LUDWIGSHAFEN AM RHEIN',
  stuttgart: 'STUTTGART',
  berlin: 'BERLIN',
};
