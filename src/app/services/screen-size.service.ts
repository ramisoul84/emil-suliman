// screen-size.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, fromEvent } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

export interface ScreenSize {
  width: number;
  height: number;
  gridCount: number;
  gridSize: number;
}

@Injectable({
  providedIn: 'root'
})
export class ScreenSizeService {
  private screenSizeSubject = new BehaviorSubject<ScreenSize>(this.getCurrentSize());
  public screenSize$ = this.screenSizeSubject.asObservable();

  constructor() {
    fromEvent(window, 'resize')
      .pipe(debounceTime(100))
      .subscribe(() => {
        this.screenSizeSubject.next(this.getCurrentSize());
      });
  }

  private getCurrentSize(): ScreenSize {
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    // Define your grid logic here
    let gridCount = 20; // Default for small screens
    
    if (width >= 1200) gridCount = 40;
    else if (width >= 768) gridCount = 30;
    
    const gridSize = width / gridCount;
    
    return { width, height, gridCount, gridSize };
  }
}