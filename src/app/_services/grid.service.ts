import { Injectable, NgZone } from "@angular/core";
import { BehaviorSubject } from "rxjs";
import { DESKTOP_MIN_WIDTH } from "../_config/phone";

/** the desktop layout's grids, by the width inside its 10px side margins (Emil 25 Oct: from
    900px wide; the 37-cell tablet grid is gone — below that it is the phone layout — and so
    is the 87-cell one: wider screens keep the 77-cell page at MAX_PAGE_WIDTH) */
const breakpoints = [
    { minWidth: 1560, gridCount: 77 },
    { minWidth: 0, gridCount: 67 },
];

/** rows every desktop page needs in the window's height (about: 37) */
const MIN_ROWS = 37.5;

/** the phone layout's page: 25 cells, with 2 free cells each side on phones (29 across) and
    4 on tablets from TABLET_MIN_WIDTH (33 across: Emil 25 Oct, the page wider than a phone's
    on an iPad); never bigger cells than PHONE_MAX_CELL (a narrow desktop window) */
const TABLET_MIN_WIDTH = 600;
const PHONE_MAX_CELL = 24;
/** rows a phone-layout page needs (an iPhone SE has 51): a short window in the tablet range
    (899 x 700, a phone turned sideways) gets cells small enough that the whole page shows */
const PHONE_MIN_ROWS = 44;

/** the widest page (Emil 25 Oct): a 1920 screen's — beyond it (2560, 4K, ultrawide) the
    cells stop growing (77 of at most 23.4px) and the grid paper just goes on at the sides,
    so the sections never get bigger than there */
const MAX_PAGE_WIDTH = 1800;

@Injectable({
    providedIn: 'root'
})
export class GridService {
    private gridWidthSubject = new BehaviorSubject<number>(this.getGridWidth());
    public gridWidth$ = this.gridWidthSubject.asObservable();
    private resizeTimeout: any = null;

    constructor(private ngZone: NgZone) {
        this.initializeGrid();
    }

    private initializeGrid(): void {
        this.updateGrid();
        this.ngZone.runOutsideAngular(() => {
            window.addEventListener('resize', () => this.updateGrid());
            window.addEventListener('orientationchange', () => this.updateGrid());
            if (window.visualViewport) {
                window.visualViewport.addEventListener('resize', () => this.updateGrid());
            }
        });
    }

    getGridWidth(): number {
        const width = this.getAccurateWidth();
        const gridCount = this.getGridCount(width);
        return width / gridCount;
    }

    getMaxHeight(delta: number): number {
        const screenHeight = window.innerHeight;
        const width = this.gridWidthSubject.value;
        const n = Math.floor(screenHeight / width) - delta;
        return n * width;
    }

    private updateGrid(): void {
        this.ngZone.run(() => {
            const client = this.getAccurateWidth();
            // phones (Emil 22 Oct): 29 columns from the window's whole width, so the pages'
            // 25 have two free cells each side (the rest of a pixel-rounded cell split between
            // the edges); wider screens keep a 10px margin each side
            const phone = client < DESKTOP_MIN_WIDTH;
            const width = phone ? client : client - 20;
            // the phone layout is always 29 cells (the page and two cells each side); on a
            // tablet the cell is sized for 33, so two more free cells show on each side
            const gridCount = phone ? 29 : this.getGridCount(width);
            const sizeFor = phone && client >= TABLET_MIN_WIDTH ? 33 : gridCount;
            // A whole number of *screen* pixels per cell. On 1x/2x screens that's a whole number
            // of CSS px as before; with display scaling (125%, 150%) or browser zoom the cell
            // becomes e.g. 21.6px = 27 screen px, so every grid line lands on the same pixel
            // phase and they all look the same (otherwise some lines render faint or doubled).
            // (1x / 2x / 3x screens keep whole CSS px cells, exactly as designed)
            const ratio = window.devicePixelRatio || 1;
            const dpr = Number.isInteger(ratio) ? 1 : ratio;
            let gridSize = Math.floor(width * dpr / sizeFor) / dpr;
            if (phone) gridSize = Math.min(gridSize, PHONE_MAX_CELL);
            if (phone && client >= TABLET_MIN_WIDTH) gridSize = Math.min(gridSize, Math.floor(window.innerHeight * dpr / PHONE_MIN_ROWS) / dpr);
            else gridSize = Math.min(gridSize, Math.floor(MAX_PAGE_WIDTH * dpr / gridCount) / dpr);
            // short windows (a laptop at 1366 x 657, 125 % scaling, an ultrawide): the cell is
            // also small enough for MIN_ROWS rows to fit the window's height, so no page is cut
            // at the bottom (the about page, the tallest, ends on row 37); the column is then
            // narrower than the window and stays centred
            if (gridCount >= 67) gridSize = Math.min(gridSize, Math.floor(window.innerHeight * dpr / MIN_ROWS) / dpr);
            // the page column is exactly gridCount cells + 1px for the last grid line;
            // the left margin is rounded to a screen pixel, the right takes the rest
            const main = gridSize * gridCount + 1;
            const left = Math.round((client - main) / 2 * dpr) / dpr;
            const right = client - main - left;

            this.gridWidthSubject.next(gridSize);

            document.documentElement.style.setProperty('--dynamic-grid-size', `${gridSize}px`);
            document.documentElement.style.setProperty('--margin', `${left}px`);
            document.documentElement.style.setProperty('--margin-right', `${right}px`);
        });
    }

    ngOnDestroy(): void {
        if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout);
        }
    }

    private getAccurateWidth(): number {
        return document.documentElement.clientWidth;
    }

    private getGridCount(width: number): number {
        const breakpoint = breakpoints.find(bp => width >= bp.minWidth);
        return breakpoint?.gridCount || 20;
    }
}
