import { Injectable, NgZone } from "@angular/core";
import { BehaviorSubject } from "rxjs";

const breakpoints = [
    { minWidth: 1580, gridCount: 57 },
    { minWidth: 1180, gridCount: 47 },
    { minWidth: 556, gridCount: 37 },
    { minWidth: 0, gridCount: 27 }
];


@Injectable({
    providedIn: 'root'
})
export class GridService {
    private gridWidthSubject = new BehaviorSubject<number>(this.getGridWidth());
    public gridWidth$ = this.gridWidthSubject.asObservable();

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
        const gridSize = width / gridCount;
        return gridSize;
    }

    getMaxHeight(delta:number): number {
        const screenHeight = window.innerHeight
        let width = 0
        this.gridWidth$.subscribe(data => width = data)
        const n = Math.floor(screenHeight / width) - delta

        return n * width
    }

    private updateGrid(): void {
        let width = this.getAccurateWidth() - 20;
        const gridCount = this.getGridCount(width);
        let gridSize = Math.floor(width / gridCount);
        const totalGridWidth = gridSize * gridCount;
        const extraSpace = width - totalGridWidth;
        const margin = 10 + (extraSpace - 1) / 2
        this.gridWidthSubject.next(gridSize)

        document.documentElement.style.setProperty('--dynamic-grid-size', `${gridSize}px`);
        document.documentElement.style.setProperty('--margin', `${margin}px`);

    }

    private getAccurateWidth(): number {
        return document.documentElement.clientWidth
    }

    private getGridCount(width: number): number {
        const breakpoint = breakpoints.find(bp => width >= bp.minWidth);
        return breakpoint?.gridCount || 20;
    }
}