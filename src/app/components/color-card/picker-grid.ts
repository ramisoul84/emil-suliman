/** the colours to pick from, a cell each, row by row: twelve hues and a grey, four rows light to
    dark (the landing's card; the side menu's card shows them turned, a hue a row) */
export const PICKER_GRID: string[] = (() => {
  const hex = (h: number, s: number, l: number) => {
    s /= 100; l /= 100;
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      const c = l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
      return Math.round(c * 255).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  };
  const rows: [number, number, string][] = [[90, 74, '#e6e6e6'], [88, 58, '#a6a6a6'], [78, 42, '#5a5a5a'], [70, 27, '#000000']];
  return rows.flatMap(([s, l, grey]) => [...Array.from({ length: 12 }, (_, i) => hex(i * 30, s, l)), grey]);
})();
