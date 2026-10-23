/** phones (one column of 27 cells): they open with the curtain (main.ts) and keep the header
    folded into the logo box (header.ts); Emil's Comp 13 sketch */
export const PHONE_QUERY = '(max-width: 575.98px)';

export function isPhone(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.(PHONE_QUERY).matches;
}
