/** The site's two layouts (Emil 25 Oct): below DESKTOP_MIN_WIDTH the phone layout (one column
    of 29 cells; phones open with the curtain, main.ts, and keep the header folded into the logo
    box, header.ts; Emil's Comp 13 sketch), from it the desktop layout (67 / 77 / 87 cells).
    Keep in step with _styles/_breakpoints.scss. */
export const DESKTOP_MIN_WIDTH = 900;
export const PHONE_QUERY = `(max-width: ${DESKTOP_MIN_WIDTH - 0.02}px)`;
export const DESKTOP_QUERY = `(min-width: ${DESKTOP_MIN_WIDTH}px)`;

export function isPhone(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.(PHONE_QUERY).matches;
}

/** the desktop layout (side menu, page-by-page scrolling, the cases' slides…) */
export function isDesktop(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.(DESKTOP_QUERY).matches;
}
