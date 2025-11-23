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
    });
  }

  onMapAnimationCreated(animationItem: AnimationItem): void {
    this.mapAnimation = animationItem;
    animationItem.addEventListener('data_ready', () => {
      this.mapTotalFrames = animationItem.totalFrames;
    });
  }

  calculateTimelineDimensions() {
    setTimeout(() => {
      if (this.timelineSection?.nativeElement) {
        const element = this.timelineSection.nativeElement;
        const rect = element.getBoundingClientRect();

        const sectionTop = rect.top + window.pageYOffset;
        const sectionHeight = rect.height;
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

    const sectionStart = sectionTop
    const startPlay = sectionTop - (this.grid * 16);
    const endPlay = sectionTop + sectionHeight - (viewportHeight / 1.1) + (this.grid * 10);
    const playHeight = endPlay - startPlay


    let progress = (scrollY - startPlay) / playHeight

    if (progress >= 0 && progress <= 1) {
      progress = Math.max(0, Math.min(1, progress));
      const timelineTargetFrame = Math.floor(progress * this.timelineTotalFrames);
      const mapTargetFrame = Math.floor(progress * this.timelineTotalFrames);
      this.mapAnimation.goToAndPlay(mapTargetFrame, true);
      this.timelineAnimation.goToAndPlay(timelineTargetFrame, true);
    }


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