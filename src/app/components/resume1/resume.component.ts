import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { AnimationItem } from 'lottie-web';
import { LottieComponent, AnimationOptions } from 'ngx-lottie';

@Component({
  selector: 'app-resume',
  imports: [LottieComponent],
  templateUrl: './resume.component.html',
  styleUrl: './resume.component.scss'
})
export class Resume1Component implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('mapSection') mapSectionRef!: ElementRef;
  @ViewChild('timelineSection') timelineSectionRef!: ElementRef;

  mapFrames: number = 0;
  timeFrames: number = 0;

  map: AnimationOptions = {
    autoplay: false,
    path: 'assets/animations/map.json',
    renderer: 'svg'
  };

  timeLine: AnimationOptions = {
    autoplay: false,
    path: 'assets/animations/timeline.json',
    renderer: 'svg'
  };

  // Animation metadata
  mapAnimation: AnimationItem | null = null;
  timelineAnimation: AnimationItem | null = null;

  mapTotalFrames: number = 0;
  timelineTotalFrames: number = 0;

  currentMapFrame: number = 0;
  currentTimelineFrame: number = 0;

  mapProgress: number = 0;
  timelineProgress: number = 0;

  // DOM elements
  mapSection!: HTMLElement;
  timelineSection!: HTMLElement;

  private scrollListener!: () => void;

  ngOnInit() {
    this.currentMapFrame = 0;
    this.currentTimelineFrame = 0;
    this.mapProgress = 0;
    this.timelineProgress = 0;

    // You can also setup resize listener here if needed

  }

  ngAfterViewInit() {
    // DOM elements are available here, but animations might not be loaded yet
    // We'll wait for animations to load before setting up scroll listener
  }

  onMapAnimationCreated(animationItem: AnimationItem): void {
    this.mapAnimation = animationItem;
    animationItem.addEventListener('data_ready', () => {
      this.mapTotalFrames = animationItem.totalFrames;
      console.log('Map animation loaded with', this.mapTotalFrames, 'frames');
      this.setupScrollListener();
    });

    animationItem.addEventListener('data_failed', () => {
      console.error('Failed to load map animation');
      // Set some default values or show error
      this.mapTotalFrames = 100; // fallback
      this.setupScrollListener();
    });
  }

  onTimelineAnimationCreated(animationItem: AnimationItem): void {
    this.timelineAnimation = animationItem;
    animationItem.addEventListener('data_ready', () => {
      this.timelineTotalFrames = animationItem.totalFrames;
      console.log('Timeline animation loaded with', this.timelineTotalFrames, 'frames');
      this.setupScrollListener();
    });

    animationItem.addEventListener('data_failed', () => {
      console.error('Failed to load timeline animation');
      this.timelineTotalFrames = 100; // fallback
      this.setupScrollListener();
    });
  }

  private setupScrollListener(): void {
    // Check if both animations are loaded and listener not already set up
    if (this.mapTotalFrames > 0 && this.timelineTotalFrames > 0 && !this.scrollListener) {
      // Double-check that DOM elements are available
      if (this.mapSectionRef && this.timelineSectionRef) {
        this.scrollListener = this.handleScroll.bind(this);
        window.addEventListener('scroll', this.scrollListener, { passive: true });

        // Initial update to set correct frame on load
        setTimeout(() => {
          this.handleScroll();
        }, 100);

        console.log('Scroll listener setup complete');
      } else {
        console.warn('DOM elements not available yet, retrying...');
        setTimeout(() => this.setupScrollListener(), 100);
      }
    }
  }

  private handleScroll(): void {
    if (!this.mapSectionRef?.nativeElement || !this.timelineSectionRef?.nativeElement) {
      return;
    }

    const scrollPosition = window.scrollY || window.pageYOffset;
    const windowHeight = window.innerHeight;

    // Handle map animation
    this.updateAnimationProgress(
      this.mapSectionRef.nativeElement,
      scrollPosition,
      windowHeight,
      'map'
    );

    // Handle timeline animation
    this.updateAnimationProgress(
      this.timelineSectionRef.nativeElement,
      scrollPosition,
      windowHeight,
      'timeline'
    );
  }

  private updateAnimationProgress(
    element: HTMLElement,
    scrollPosition: number,
    windowHeight: number,
    type: 'map' | 'timeline'
  ): void {
    const rect = element.getBoundingClientRect();
    const elementTop = rect.top + scrollPosition;
    const elementHeight = rect.height;

    // Calculate when animation should start and end
    const animationStart = elementTop - windowHeight * 0.5; // Start when 50% in view
    const animationEnd = elementTop + elementHeight - windowHeight * 0.5; // End when 50% out of view
    const animationRange = animationEnd - animationStart;

    if (animationRange <= 0) return;

    let progress = (scrollPosition - animationStart) / animationRange;
    progress = Math.max(0, Math.min(1, progress)); // Clamp between 0-1

    if (type === 'map') {
      this.mapProgress = progress;
      this.currentMapFrame = Math.floor(progress * this.mapTotalFrames);
      if (this.mapAnimation) {
        this.mapAnimation.goToAndStop(this.currentMapFrame, true);
      }
    } else {
      this.timelineProgress = progress;
      this.currentTimelineFrame = Math.floor(progress * this.timelineTotalFrames);
      if (this.timelineAnimation) {
        this.timelineAnimation.goToAndStop(this.currentTimelineFrame, true);
      }
    }
  }

  ngOnDestroy() {
    // Cleanup
    if (this.scrollListener) {
      window.removeEventListener('scroll', this.scrollListener);
    }

    // Destroy animations
    if (this.mapAnimation) {
      this.mapAnimation.destroy();
    }
    if (this.timelineAnimation) {
      this.timelineAnimation.destroy();
    }
  }
}
/*




*/