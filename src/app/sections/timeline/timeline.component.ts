import { CommonModule } from '@angular/common';
import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, HostListener } from '@angular/core';
import { AnimationItem } from 'lottie-web';
import { AnimationOptions, LottieComponent } from 'ngx-lottie';

@Component({
  selector: 'app-timeline',
  imports: [CommonModule, LottieComponent],
  templateUrl: './timeline.component.html',
  styleUrls: ['./timeline.component.scss']
})
export class TimelineComponent implements AfterViewInit, OnDestroy {
  @ViewChild('timelineSection', { static: true }) timelineSection!: ElementRef;
  @ViewChild('lottieContainer', { static: true }) lottieContainer!: ElementRef;

  private animationItem: AnimationItem | null = null;
  private totalFrames: number = 0;
  private isPlaying: boolean = false;
  private rafId: number = 0;

  // Animation dimensions and positions
  private lottieTop: number = 0;
  private lottieBottom: number = 0;
  private lottieHeight: number = 0;
  private windowHeight: number = 0;

  // Debug info
  public debugInfo = {
    isPlaying: false,
    currentFrame: 0,
    targetFrame: 0,
    totalFrames: 0,
    scrollProgress: 0,
    lottieTop: 0,
    lottieBottom: 0,
    windowTop: 0,
    windowBottom: 0
  };

  timeLineOptions: AnimationOptions = {
    path: '/assets/animations/timeline.json',
    autoplay: false,
    loop: false
  };

  ngAfterViewInit(): void {
    this.calculateDimensions();
    this.startAnimationLoop();

    // Recalculate on resize
    window.addEventListener('resize', this.handleResize.bind(this));
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  onAnimationCreated(animationItem: AnimationItem): void {
    this.animationItem = animationItem;

    this.animationItem.setSpeed(1);
    animationItem.addEventListener('data_ready', () => {
      this.totalFrames = animationItem.totalFrames;
      this.debugInfo.totalFrames = this.totalFrames;
    });

  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    this.handleScroll();
  }

  private handleResize(): void {
    this.calculateDimensions();
  }

  private calculateDimensions(): void {
    if (!this.lottieContainer?.nativeElement) return;

    const rect = this.lottieContainer.nativeElement.getBoundingClientRect();
    this.lottieTop = rect.top + window.scrollY;
    this.lottieHeight = rect.height;
    this.lottieBottom = this.lottieTop + this.lottieHeight;
    this.windowHeight = window.innerHeight;

    this.debugInfo.lottieTop = this.lottieTop;
    this.debugInfo.lottieBottom = this.lottieBottom;
  }

  private handleScroll(): void {
    if (!this.animationItem) return;

    const scrollY = window.scrollY;
    const windowTop = scrollY;
    const windowBottom = scrollY + this.windowHeight;

    this.debugInfo.windowTop = windowTop;
    this.debugInfo.windowBottom = windowBottom;

    // Check if Lottie section is in viewport
    const isLottieInView = windowBottom > this.lottieTop && windowTop < this.lottieBottom;

    if (isLottieInView) {
      this.calculateTargetFrame(windowTop, windowBottom);
    } else {
      // Stop animation when out of view
      if (this.isPlaying) {
        this.stopAnimation();
      }
    }
  }

  private calculateTargetFrame(windowTop: number, windowBottom: number): void {
    // Calculate the visible portion of the Lottie section
    const visibleTop = Math.max(this.lottieTop, windowTop);
    const visibleBottom = Math.min(this.lottieBottom, windowBottom);
    const visibleHeight = visibleBottom - visibleTop;

    // Calculate scroll progress through the Lottie section (0 to 1)
    let scrollProgress = 0;

    if (visibleHeight > 0) {
      // Method 1: Progress based on top of viewport position
      const viewportProgress = (windowTop - this.lottieTop) / (this.lottieHeight - this.windowHeight);
      scrollProgress = Math.max(0, Math.min(1, viewportProgress));

      // Method 2: Alternative - progress based on middle of viewport
      // const viewportMiddle = windowTop + (this.windowHeight / 2);
      // scrollProgress = (viewportMiddle - this.lottieTop) / this.lottieHeight;
      // scrollProgress = Math.max(0, Math.min(1, scrollProgress));
    }

    this.debugInfo.scrollProgress = scrollProgress;

    // Map scroll progress to target frame
    const targetFrame = Math.floor(scrollProgress * this.totalFrames);
    this.debugInfo.targetFrame = targetFrame;

    this.controlAnimation(targetFrame);
  }

  private controlAnimation(targetFrame: number): void {
    if (!this.animationItem) return;

    const currentFrame = this.animationItem.currentFrame;
    const frameDifference = targetFrame - currentFrame;
    const frameThreshold = 2;

    // Only play if we're significantly away from target frame
    if (Math.abs(frameDifference) > frameThreshold) {
      if (!this.isPlaying) {
        this.startAnimation();
      }

      // Set direction based on whether we need to go forward or backward
      this.animationItem.setDirection(frameDifference > 0 ? 1 : -1);

      // Adjust speed slightly based on distance (optional)
      const speed = this.calculateSpeed(Math.abs(frameDifference));
      this.animationItem.setSpeed(speed);

    } else if (this.isPlaying) {
      // We're close enough to target, stop and fine-tune
      this.stopAnimation();
      this.animationItem.goToAndStop(targetFrame, true);
    }
  }

  private calculateSpeed(frameDifference: number): number {
    // Adaptive speed - faster when further away, slower when closer
    const baseSpeed = 1;
    const speedMultiplier = Math.min(0.5, frameDifference / 30); // Max 0.5x additional speed
    return baseSpeed + speedMultiplier;
  }

  private startAnimationLoop(): void {
    const animate = () => {
      this.updateDebugInfo();
      this.rafId = requestAnimationFrame(animate);
    };

    this.rafId = requestAnimationFrame(animate);
  }

  private updateDebugInfo(): void {
    if (this.animationItem) {
      this.debugInfo.currentFrame = Math.floor(this.animationItem.currentFrame);
    }
  }

  private startAnimation(): void {
    if (!this.animationItem) return;

    this.isPlaying = true;
    this.debugInfo.isPlaying = true;
    this.animationItem.play();
  }

  private stopAnimation(): void {
    if (!this.animationItem) return;

    this.isPlaying = false;
    this.debugInfo.isPlaying = false;
    this.animationItem.pause();
  }

  private cleanup(): void {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }

    if (this.animationItem) {
      this.animationItem.destroy();
    }

    window.removeEventListener('resize', this.handleResize.bind(this));
  }

  // Manual controls
  play(): void {
    if (this.animationItem && !this.isPlaying) {
      this.startAnimation();
    }
  }

  pause(): void {
    if (this.animationItem && this.isPlaying) {
      this.stopAnimation();
    }
  }

  // Method to handle quarter-based progression as backup
  handleQuarterProgression(): void {
    if (!this.animationItem) return;

    const scrollY = window.scrollY;
    const windowBottom = scrollY + this.windowHeight;

    // Calculate which quarter of the Lottie section is in view
    const lottieProgress = (scrollY - this.lottieTop) / this.lottieHeight;
    const currentQuarter = Math.min(4, Math.max(1, Math.floor(lottieProgress * 4) + 1));

    // Calculate progress within current quarter
    const quarterStart = (currentQuarter - 1) * 0.25;
    const quarterProgress = (lottieProgress - quarterStart) / 0.25;

    // Map to frame range
    const frameRange = this.totalFrames / 4;
    const quarterStartFrame = (currentQuarter - 1) * frameRange;
    const targetFrame = Math.floor(quarterStartFrame + (frameRange * quarterProgress));

    this.controlAnimation(targetFrame);
  }
}

/*
  @ViewChild('timelineSection') timelineSectionRef!: ElementRef;
  scrollY: number = 0
  grid: number = 0
  top: number = 0
  bottom: number = 0
  totalFrames: number = 0
  currentFrame: number = 0;
  isPlaying = false

  timelineAnimation: AnimationItem | null = null;
  private subscriptions = new Subscription();

  timeLineOptions: AnimationOptions = {
    path: '/assets/animations/timeline.json',
    autoplay: false,
    loop: false
  };

  constructor(private scrollService: ScrollService, private gridService: GridService) {
  }

  ngOnInit(): void {
    this.subscriptions.add(
      this.gridService.gridWidth$.subscribe(
        (grid: number) => {
          this.grid = grid
        }
      )
    );

    this.subscriptions.add(
      this.scrollService.scrollY$.subscribe(
        (scrollY: number) => {
          this.scrollY = scrollY + 7 * this.grid + 1
          this.handleScroll(this.scrollY)
        }
      )
    );
  }

  ngAfterViewInit(): void {
    this.initRect()
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  initRect(): void {
    const rect = this.timelineSectionRef.nativeElement.getBoundingClientRect();
    this.top = rect.top
    this.bottom = rect.bottom;
  }

  handleScroll(scrollY: number) {

    if (scrollY > this.top && scrollY < this.bottom) {
      this.control(scrollY)
      this.isPlaying = true
    } else {
      this.isPlaying = false
    }
  }

  onTimelineAnimationCreated(animationItem: AnimationItem): void {
    this.timelineAnimation = animationItem;

    this.timelineAnimation.setSpeed(1);
    animationItem.addEventListener('data_ready', () => {
      this.totalFrames = animationItem.totalFrames;
    });
    animationItem.addEventListener('enterFrame', () => {
      this.currentFrame = Math.floor(animationItem.currentFrame);
    });
  }

  control(s: number) {
    if (s > this.top) {
      this.timelineAnimation?.play()

    }

  }
*/