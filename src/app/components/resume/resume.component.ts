import { Component, ElementRef, ViewChild } from '@angular/core';
import { AnimationItem } from 'lottie-web';
import { AnimationOptions, LottieComponent } from 'ngx-lottie';

@Component({
  selector: 'app-resume',
  imports: [LottieComponent],
  templateUrl: './resume.component.html',
  styleUrl: './resume.component.scss'
})
export class ResumeComponent {
  @ViewChild('mapSection') mapSectionRef!: ElementRef;
  @ViewChild('timelineSection') timelineSectionRef!: ElementRef;

  mapAnimation: AnimationItem | null = null;
  mapFrames: number = 0;
  mapTotalFrames: number = 0;
  currentMapFrame: number = 2;
  mapProgress: number = 0;

  timelineAnimation: AnimationItem | null = null;
  timelineFrames: number = 0;
  timelineTotalFrames: number = 0;
  currentTimelineFrame: number = 1;
  timelineProgress: number = 0;


  mapOptions: AnimationOptions = {
    autoplay: false,
    path: 'assets/animations/map.json',
    renderer: 'svg'
  };

  timeLineOptions: AnimationOptions = {
    autoplay: false,
    path: 'assets/animations/timeline.json',
  };

  private scrollListener!: () => void;

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

  private setupScrollListener(): void {
    if (this.timelineTotalFrames > 0 && !this.scrollListener) {
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
  }

  private handleScroll(): void {
    if (!this.timelineSectionRef?.nativeElement) {
      return;
    }

    const scrollPosition = window.scrollY || window.pageYOffset;
    const windowHeight = window.innerHeight;

    const rect = this.timelineSectionRef.nativeElement.getBoundingClientRect();
    const elementTop = rect.top + scrollPosition;
    const elementHeight = rect.height;



    // Calculate when animation should start and end
    const animationStart = elementTop - windowHeight * 0.8; // Start when 50% in view
    const animationEnd = elementTop + elementHeight - windowHeight * 0.5; // End when 50% out of view
    const animationRange = animationEnd - animationStart;


    let progress = (scrollPosition - animationStart) / animationRange;
    progress = Math.max(0, Math.min(1, progress)); // Clamp between 0-1


    // Handle map animation
    this.updateAnimationProgress(
      progress
    );



  }

  private updateAnimationProgress(
    progress: number
  ): void {

    this.mapProgress = progress
    this.timelineProgress = progress

    this.currentMapFrame = Math.floor(progress * this.mapTotalFrames);
    if (this.mapAnimation) {
      this.mapAnimation.goToAndStop(this.currentMapFrame, true);
    }

    this.currentTimelineFrame = Math.floor(progress * this.timelineTotalFrames);
    if (this.timelineAnimation) {
      this.timelineAnimation.goToAndStop(this.currentTimelineFrame, true);
    }

  }



}