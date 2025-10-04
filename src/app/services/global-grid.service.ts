// src/app/services/global-grid.service.ts
import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject } from 'rxjs';


export interface ScreenSize {
  width: number;
  height: number;
  gridCount: number;
  gridSize: number;
}

const breakpoints = [
  { minWidth: 1900, gridCount: 60 },
  { minWidth: 1180, gridCount: 50 },
  { minWidth: 972, gridCount: 40 },
  { minWidth: 748, gridCount: 30 },
  { minWidth: 556, gridCount: 24 },
  { minWidth: 0, gridCount: 20 }
];

@Injectable({
  providedIn: 'root'
})
export class GlobalGridService {
  private screenWidthSubject = new BehaviorSubject<number>(window.innerWidth);
  public screenWidth$ = this.screenWidthSubject.asObservable();

  private gridWidthSubject = new BehaviorSubject<number>(this.getGridWidth());
  public gridWidth$ = this.gridWidthSubject.asObservable();



  constructor(private ngZone: NgZone) {
    this.initializeGrid();
  }

  private initializeGrid(): void {

    this.updateGrid();

    this.ngZone.runOutsideAngular(() => {
      // Use multiple event types for iOS
      window.addEventListener('resize', () => this.updateGrid());
      window.addEventListener('orientationchange', () => this.updateGrid());

      if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', () => this.updateGrid());
      }
    });
  }

  private getGridWidth(): number {
    const width = this.getAccurateWidth();
    const gridCount = this.getGridCount(width);
    const gridSize = width / gridCount;

    return gridSize
  }

  private updateGrid(): void {
    const width = this.getAccurateWidth() - 20;
    const height = window.innerHeight;
    const gridCount = this.getGridCount(width);
    //const gridSize = width / gridCount;
    const gridSize = Math.floor(width / gridCount);
    const totalGridWidth = gridSize * gridCount;
    const extraSpace = width - totalGridWidth;
    const margin = 10 + (extraSpace-1) / 2

    this.screenWidthSubject.next(width)
    this.gridWidthSubject.next(gridSize)

    // Set CSS variables
    document.documentElement.style.setProperty('--dynamic-grid-size', `${gridSize}px`);
    document.documentElement.style.setProperty('--margin', `${margin}px`);
  }

  private getAccurateWidth(): number {
    // Priority order for width detection
    /*
    if (window.visualViewport) {
      return window.visualViewport.width;
    }
      */
    return document.documentElement.clientWidth
    //return document.documentElement.clientWidth || window.outerWidth;
  }

  private getGridCount(width: number): number {
    const breakpoint = breakpoints.find(bp => width >= bp.minWidth);
    return breakpoint?.gridCount || 20;
  }





}
/*
private gridSizeSubject = new BehaviorSubject<number>(this.calculateGridSize());
  public gridSize$ = this.gridSizeSubject.asObservable();

  constructor() {
    this.updateRootVariable(this.calculateGridSize());
    
    fromEvent(window, 'resize')
      .pipe(debounceTime(100))
      .subscribe(() => {
        const newSize = this.calculateGridSize();
        this.updateRootVariable(newSize);
        this.gridSizeSubject.next(newSize);
      });
  }

  private calculateGridSize(): number {
    const screenWidth = document.documentElement.clientWidth;//window.innerWidth;
    let gridCount = 18; // Default for small screens
    
    if (screenWidth >= 1920) gridCount = 60;
    else if (screenWidth >= 1200) gridCount = 50;
    else if (screenWidth >= 992) gridCount = 40;
    else if (screenWidth >= 768) gridCount = 30;
    else if (screenWidth >= 576) gridCount = 24;
    
    return screenWidth / gridCount;
  }

  private updateRootVariable(gridSize: number): void {
    document.documentElement.style.setProperty('--dynamic-grid-size', `${gridSize}px`);
  }

  // Method to get current grid size synchronously
  getCurrentGridSize(): number {
    return this.calculateGridSize();
  }

  ngOnDestroy() {
    // Clean up the root variable if needed
    document.documentElement.style.removeProperty('--dynamic-grid-size');
  }
*/