// simple-scroll.service.ts
import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable, fromEvent, throttleTime, map } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ScrollService {
  private scrollYSubject = new BehaviorSubject<number>(this.getScrollY());
  scrollY$: Observable<number> = this.scrollYSubject.asObservable();

  constructor(private ngZone: NgZone) {
    this.initScrollListener();
  }

  private initScrollListener() {
    this.ngZone.runOutsideAngular(() => {
      fromEvent(window, 'scroll', { passive: true })
        .pipe(
          throttleTime(16, undefined, { leading: true, trailing: true }),
          map(() => this.getScrollY())
        )
        .subscribe(scrollY => {
          this.ngZone.run(() => {
            this.scrollYSubject.next(scrollY);
          });
        });
    });
  }

  private getScrollY(): number {
    return window.scrollY || 
           window.pageYOffset || 
           document.documentElement.scrollTop || 
           document.body.scrollTop || 
           0;
  }


  refresh(): void {
    this.scrollYSubject.next(this.getScrollY());
  }

  get currentScrollY(): number {
    return this.getScrollY();
  }
}