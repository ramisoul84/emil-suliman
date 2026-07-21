import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { GridService } from '../../_services/grid.service';
import lottie, { AnimationItem } from 'lottie-web';
import { BlurService } from '../../_services/blur.service';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-timeline',
  imports: [CommonModule],
  templateUrl: './timeline.html',
  styleUrl: './timeline.scss',
})
export class Timeline implements OnInit, OnDestroy {
  @ViewChild('timelineSection') timelineSection!: ElementRef;
  @ViewChild('mapSection') mapSection!: ElementRef;

  isBlur: boolean = false;

  private timelineAnimation!: AnimationItem;
  private mapAnimation!: AnimationItem;
  private destroy$ = new Subject<void>(); // ADD: Cleanup
  private resizeTimer: any; // ADD: Debounced resize

  mapHeight: number = 0;
  scrollY: number = 0;
  viewportBottom: number = 0;
  top: number = 0;
  bottom: number = 0;
  grid: number = 0

  private iosDirection: 'up' | 'down' = 'down';
  private iosDone: boolean = false;
  private savedPoint: number = 0;
  private totalFrames: number = 0;
  private isAnimating: boolean = false

  isIOS: boolean = /iPad|iPhone|iPod/.test(navigator.userAgent);

  constructor(private gridService: GridService, private blurService: BlurService) {
    this.blurService.blurState$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(data => this.isBlur = data);
  }

  ngOnInit(): void {
    requestAnimationFrame(() => {
      this.calculateMapHeight();
    });

    setTimeout(() => {
      this.calculateTimelineRect();
      this.loadLottieAnimation();
    }, 1300)
  }

  @HostListener('window:resize')
  onWindowResize() {
    this.calculateMapHeight()
    this.calculateTimelineRect()
  }

  @HostListener('window:scroll')
  onWindowScroll() {
    const scrollY = window.scrollY;
    const oldScrollY = this.scrollY;

    this.iosDirection = scrollY > oldScrollY ? 'down' : 'up';
    this.scrollY = scrollY;
    this.viewportBottom = window.scrollY + window.innerHeight
    const y = scrollY + (0.5 * window.innerHeight)


    if (this.isIOS) {
      this.updateAnimationFrameIOS(y, this.iosDirection)
    } else {
      this.updateAnimationFrame(y);
    }

  }

  private calculateTimelineRect() {
    if (!this.timelineSection?.nativeElement) return;
    const scrollTop = window.pageYOffset ||
      document.documentElement.scrollTop ||
      document.body.scrollTop ||
      0;

    const rect = this.timelineSection.nativeElement.getBoundingClientRect();
    this.top = rect.top + scrollTop;
    this.bottom = rect.bottom + scrollTop;
  }

  private loadLottieAnimation(): void {
    if (!this.timelineSection?.nativeElement) return;

    this.timelineAnimation = lottie.loadAnimation({
      container: this.timelineSection.nativeElement,
      renderer: 'svg',
      loop: false,
      autoplay: false,
      path: 'assets/json/timeline.json',
      rendererSettings: {
        preserveAspectRatio: 'xMidYMid slice',
        progressiveLoad: true,
        hideOnTransparent: true
      }
    });

    this.mapAnimation = lottie.loadAnimation({
      container: this.mapSection.nativeElement,
      renderer: 'svg',
      loop: false,
      autoplay: false,
      path: 'assets/json/map.json',
      rendererSettings: {
        preserveAspectRatio: 'xMidYMid slice',
        progressiveLoad: true,
        hideOnTransparent: true
      }
    });

    this.timelineAnimation.addEventListener('DOMLoaded', () => {
      this.totalFrames = this.timelineAnimation.totalFrames;
    });

    this.timelineAnimation.addEventListener('data_ready', () => {
    });

  }

  private updateAnimationFrame(scrollY: number): void {
    if (!this.timelineSection?.nativeElement || !this.timelineAnimation) return;
    let progress
    if (scrollY < this.top) {
      progress = 0
    } else if (scrollY > this.bottom) {
      progress = 1
    } else {
      progress = (scrollY - this.top) / (this.bottom - this.top)
    }

    let scrollProgress = Math.max(0, Math.min(1, progress));
    const targetFrame = Math.floor(scrollProgress * (this.totalFrames - 1));
    this.timelineAnimation.goToAndPlay(targetFrame, true);
    this.mapAnimation.goToAndPlay(targetFrame, true);
  }

  private updateAnimationFrameIOS(scrollY: number, direction: string): void {
    if (!this.timelineSection?.nativeElement || !this.timelineAnimation) return;
    let progress = 0
    if (scrollY >= this.top && scrollY <= this.bottom) {
      progress = (scrollY - this.top) / (this.bottom - this.top)
    } else if (scrollY > this.bottom) {
      progress = 1;
    }

    progress = Math.max(0, Math.min(1, progress));
    const targetFrame = Math.floor(progress * (this.totalFrames - 1));
    this.mapAnimation.goToAndStop(targetFrame, true);

    if (progress >= 1) {
      this.timelineAnimation.goToAndStop(650, true);
      return
    }

    if (direction === 'up' && this.savedPoint < progress) {
      this.savedPoint = progress
      return
    }

    if (direction === 'down') {
      if (progress < this.savedPoint) {
      } else {
        this.timelineAnimation.goToAndStop(targetFrame, true);
      }
    }
  }

  private calculateMapHeight(): void {
    if (window.innerWidth >= 1200) {
      this.mapHeight = this.gridService.getMaxHeight(8)
    } else {
      this.gridService.gridWidth$.subscribe(data => {
        this.grid = data;
        this.mapHeight = 10 * this.grid;
      });
    }
  }

  ngOnDestroy(): void {
    // Clean up everything
    this.destroy$.next();
    this.destroy$.complete();

    clearTimeout(this.resizeTimer);

    // Destroy Lottie animations
    if (this.timelineAnimation) {
      this.timelineAnimation.destroy();
    }
    if (this.mapAnimation) {
      this.mapAnimation.destroy();
    }
  }
}