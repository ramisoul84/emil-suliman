import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core';
import { AnimationItem } from 'lottie-web';
import { AnimationOptions, LottieComponent } from 'ngx-lottie';
import { GridService } from '../../services/grid.service';
import { debounceTime, fromEvent, Subscription, throttleTime } from 'rxjs';

@Component({
  selector: 'app-resume',
  imports: [CommonModule, LottieComponent],
  templateUrl: './resume.component.html',
  styleUrl: './resume.component.scss'
})
export class ResumeComponent implements AfterViewInit {
  @ViewChild('timelineSection') timelineSection!: ElementRef;

  isLoaded: boolean = true;
  grid: number = 0;
  mapHeight: number = 0

  private timelineAnimation: AnimationItem | null = null;
  private timelineTotalFrames: number = 0;

  private mapAnimation: AnimationItem | null = null;
  private mapTotalFrames: number = 0;

  private scrollSubscription!: Subscription;
  private resizeSubscription!: Subscription;



  mapOptions: AnimationOptions = {
    path: '/assets/animations/map.json',
    autoplay: false,
    loop: false
  };

  timeLineOptions: AnimationOptions = {
    path: '/assets/animations/timeline.json',
    autoplay: false,
    loop: false
  };

  constructor(private gridService: GridService) { }

  ngAfterViewInit() {
    this.calculateTimelineDimensions();
    this.gridService.gridWidth$.subscribe(data => this.grid = data)
    this.calculateMapHeight()
    this.resizeSubscription = fromEvent(window, 'resize').pipe(
      debounceTime(100)
    ).subscribe(() => {
      this.calculateTimelineDimensions();
      this.calculateMapHeight()
    });
  }

  private calculateMapHeight(): void {
    if (window.innerWidth >= 1200) {
      this.mapHeight = this.gridService.getMaxHeight(8)
    } else {
      this.gridService.gridWidth$.subscribe(data => this.grid = data)
      this.mapHeight = 10 * this.grid
    }
  }

  onTimelineAnimationCreated(animationItem: AnimationItem) {
    this.timelineAnimation = animationItem;
    animationItem.addEventListener('data_ready', () => {
      this.timelineTotalFrames = animationItem.totalFrames;
      console.log('Timeline animation ready. Total frames:', animationItem.totalFrames);
    });
  }

  onMapAnimationCreated(animationItem: AnimationItem): void {
    this.mapAnimation = animationItem;
    animationItem.addEventListener('data_ready', () => {
      this.mapTotalFrames = animationItem.totalFrames;
      console.log('Map animation ready. Total frames:', animationItem.totalFrames);
    });
  }

  calculateTimelineDimensions() {
    setTimeout(() => {
      if (this.timelineSection?.nativeElement) {
        const element = this.timelineSection.nativeElement;
        const rect = element.getBoundingClientRect();

        const sectionTop = rect.top + window.pageYOffset;
        const sectionHeight = rect.height;

        console.log('Section dimensions calculated:', { sectionTop, sectionHeight });

        this.setupScrollListener(sectionTop, sectionHeight);
      }
    }, 300); // Small delay to ensure DOM is fully rendered
  }

  setupScrollListener(sectionTop: number, sectionHeight: number) {
    if (this.scrollSubscription) {
      this.scrollSubscription.unsubscribe();
    }

    this.scrollSubscription = fromEvent(window, 'scroll').pipe(
      throttleTime(16)
    ).subscribe(() => {
      this.handleScrollAnimation(sectionTop, sectionHeight);
    });
  }

  handleScrollAnimation(sectionTop: number, sectionHeight: number) {
    if (!this.timelineAnimation || !this.mapAnimation) return;

    const scrollY = window.scrollY;
    const viewportHeight = window.innerHeight;

    // When timeline section enters viewport
    //const sectionStart = sectionTop - viewportHeight;
    const sectionStart = sectionTop
    const startPlay = sectionTop - (this.grid * 12);
    const endPlay = sectionTop + sectionHeight - (viewportHeight / 2) + (this.grid * 16);
    const playHeight = endPlay - startPlay

    // Calculate current scroll position in relation to timeline section
    const currentPosition = scrollY + viewportHeight;

    let progress = (scrollY - startPlay) / playHeight

    progress = Math.max(0, Math.min(1, progress));
    console.log(scrollY, startPlay, endPlay, playHeight, progress)
    const timelineTargetFrame = Math.floor(progress * this.timelineTotalFrames);
    const mapTargetFrame = Math.floor(progress * this.mapTotalFrames);
    console.log("targ", timelineTargetFrame)
    this.mapAnimation.goToAndStop(timelineTargetFrame, true);
    this.timelineAnimation.goToAndStop(mapTargetFrame, true);


    /*
        // Calculate progress (0 to 1)
        let progress = (currentPosition - sectionStart) / (sectionEnd - sectionStart);
        progress = Math.max(0, Math.min(1, progress)); // Clamp between 0-1
    
        // Convert progress to frame number
        const totalFrames = this.timelineAnimation.totalFrames;
        const targetFrame = Math.floor(progress * totalFrames);
    
        // Update animation frame
        this.timelineAnimation.goToAndStop(targetFrame, true);
        */
  }



  ngOnDestroy() {
    if (this.scrollSubscription) {
      this.scrollSubscription.unsubscribe();
    }
    if (this.resizeSubscription) {
      this.resizeSubscription.unsubscribe();
    }
  }

}


/*
  @ViewChild('timelineSection') timelineSectionRef!: ElementRef;

    @ViewChild('timelineSection') timelineSection!: ElementRef;

  isLoaded = false;
  mapHeight = 0
  grid = 0
  timelineAnimation: AnimationItem | null = null;
  mapAnimation: AnimationItem | null = null;
  timelineTotalFrames: number = 0;
  mapTotalFrames: number = 0

  timelineSectionTop = 0;
  timelineSectionHeight = 0;

  timelineCurrentFrame: number = 0;
  mapCurrentFrame: number = 0

  resumeHeight: number = 0

  private isAutoScrolling = false;

  mapOptions: AnimationOptions = {
    path: '/assets/animations/map.json',
    autoplay: false,
  };

  timeLineOptions: AnimationOptions = {
    path: '/assets/animations/timeline.json',
    autoplay: false
  };

  constructor(private gridService: GridService) {
    gsap.registerPlugin(ScrollTrigger);
  }

  ngOnInit() {
    setTimeout(() => {
      this.isLoaded = true;
    }, 1400);
    if (window.innerWidth >= 1200) {
      this.mapHeight = this.gridService.getMaxHeight(8)
    } else {
      this.gridService.gridWidth$.subscribe(data => this.grid = data)
      this.mapHeight = 10 * this.grid
      this.resumeHeight = this.gridService.getMaxHeight(5)
    }

  }

  ngAfterViewInit() {
    this.calculateTimelineDimensions();

    // Recalculate on window resize
    fromEvent(window, 'resize').pipe(
      debounceTime(250)
    ).subscribe(() => {
      this.calculateTimelineDimensions();
    });
  }

  calculateTimelineDimensions() {
    if (this.timelineSection?.nativeElement) {
      const element = this.timelineSection.nativeElement;
      const rect = element.getBoundingClientRect();

      this.timelineSectionTop = rect.top + window.pageYOffset;
      this.timelineSectionHeight = rect.height;

      console.log('Timeline Top:', this.timelineSectionTop);
      console.log('Timeline Height:', this.timelineSectionHeight);

      // Start scroll listener after dimensions are calculated
      this.setupScrollListener();
    } else {
      // Retry after a short delay if element not available
      setTimeout(() => this.calculateTimelineDimensions(), 100);
    }
  }

  initScrollAnimations() {
    gsap.fromTo(".resume-title",
      { opacity: 0, scale: 0.4 },
      {
        opacity: 1,
        scale: 1,
        duration: 0.4,
        scrollTrigger: {
          trigger: ".resume-title",
          start: '0% 60%',
          toggleActions: "play none none reverse",
        }
      }
    )
  }

  onMapAnimationCreated(animationItem: AnimationItem): void {
    this.mapAnimation = animationItem;
    animationItem.addEventListener('data_ready', () => {
      this.mapTotalFrames = animationItem.totalFrames;
    });
  }

  onTimelineAnimationCreated(animationItem: AnimationItem): void {
    this.timelineAnimation = animationItem;
    animationItem.addEventListener('data_ready', () => {
      this.timelineTotalFrames = animationItem.totalFrames;
      this.setupScrollListener();
    });
  }

  private scrollListener!: () => void;

  private setupScrollListener(): void {

    if (this.timelineSectionRef) {
      this.scrollListener = this.handleScroll.bind(this);
      window.addEventListener('scroll', this.scrollListener, { passive: true });
      setTimeout(() => {
        this.handleScroll();
      }, 100);
    } else {
      console.warn('DOM elements not available yet, retrying...');
      setTimeout(() => this.setupScrollListener(), 100);
    }

  }

  private handleScroll(): void {
    if (!this.timelineSectionRef?.nativeElement) {
      return;
    }

    const scrollPosition = window.scrollY || window.pageYOffset;
    const windowHeight = window.innerHeight;
    console.log(scrollPosition)

    const rect = this.timelineSectionRef.nativeElement.getBoundingClientRect();
    const elementTop = rect.top + scrollPosition;
    const elementHeight = rect.height;

    // Calculate when animation should start and end
    const animationStart = elementTop - windowHeight * 0.8; // Start when 50% in view
    const animationEnd = elementTop + elementHeight - windowHeight * 0.5; // End when 50% out of view
    const animationRange = animationEnd - animationStart;


    let progress = (scrollPosition - animationStart) / animationRange;
    progress = Math.max(0, Math.min(1, progress));

    // Handle map animation
    this.updateAnimationProgress(
      progress
    );

  }

  private updateAnimationProgress(progress: number): void {
    this.timelineCurrentFrame = Math.floor(progress * this.timelineTotalFrames);
    this.mapCurrentFrame = Math.floor(progress * this.mapTotalFrames);
    this.timelineAnimation?.goToAndStop(this.timelineCurrentFrame, true);
    this.mapAnimation?.goToAndStop(this.mapCurrentFrame, true)
  }

  @HostListener('window:resize')
  onWindowResize() {
    if (window.innerWidth >= 1200) {
      this.mapHeight = this.gridService.getMaxHeight(8)
    } else {
      this.gridService.gridWidth$.subscribe(data => this.grid = data)
      this.mapHeight = 10 * this.grid
    }
  }

*/