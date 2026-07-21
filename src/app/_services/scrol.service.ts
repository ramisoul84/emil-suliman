import { Injectable, NgZone, OnDestroy } from "@angular/core";
import { BehaviorSubject, Observable, Subject } from "rxjs";

@Injectable({
    providedIn: 'root'
})
export class ScrollService implements OnDestroy {
    private scrollSubject = new BehaviorSubject<number>(0);
    private resizeSubject = new Subject<void>();
    private destroy$ = new Subject<void>();
    private lastScrollY = 0;
    //private isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;


    scroll$: Observable<number> = this.scrollSubject.asObservable();
    resize$: Observable<void> = this.resizeSubject.asObservable();

    constructor(private ngZone: NgZone) {
        this.init();
    }

    private init(): void {
        //if (this.isIOS) return;

        // Run outside Angular zone for better performance
        this.ngZone.runOutsideAngular(() => {
            // Throttled scroll event
            let ticking = false;

            const handleScroll = () => {
                if (!ticking) {
                    requestAnimationFrame(() => {
                        const y = window.scrollY || document.documentElement.scrollTop;
                        //const x = window.scrollX || document.documentElement.scrollLeft;
                        //const direction = y > this.lastScrollY ? 'down' : y < this.lastScrollY ? 'up' : null;

                        this.lastScrollY = y;

                        // Run back in Angular zone to trigger change detection
                        this.ngZone.run(() => {
                            this.scrollSubject.next(y);
                        });

                        ticking = false;
                    });
                    ticking = true;
                }
            };

            // Use passive listeners for better performance
            window.addEventListener('scroll', handleScroll, { passive: true });
            window.addEventListener('resize', () => this.resizeSubject.next(), { passive: true });

            // Store for cleanup
            this.scrollHandler = handleScroll;
            this.resizeHandler = () => this.resizeSubject.next();
        });
    }


    private scrollHandler: (() => void) | null = null;
    private resizeHandler: (() => void) | null = null;


    getScrollPosition(): number {
        return this.scrollSubject.value;
    }

    // Check if element is in viewport
    isElementInViewport(element: HTMLElement, threshold: number = 0): boolean {
        const rect = element.getBoundingClientRect();
        const windowHeight = window.innerHeight || document.documentElement.clientHeight;
        const windowWidth = window.innerWidth || document.documentElement.clientWidth;

        return (
            rect.bottom <= windowHeight - threshold
        );
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();

        if (this.scrollHandler) {
            window.removeEventListener('scroll', this.scrollHandler);
        }
        if (this.resizeHandler) {
            window.removeEventListener('resize', this.resizeHandler);
        }
    }
}