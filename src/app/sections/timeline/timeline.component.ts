import { CommonModule } from '@angular/common';
import { Component, ElementRef, ViewChild, } from '@angular/core';
import { AnimationItem } from 'lottie-web';
import { AnimationOptions, LottieComponent } from 'ngx-lottie';
import { ScrollService } from '../../services/scroll.service';
import { GridService } from '../../services/grid.service';
import { Subscription } from 'rxjs';


@Component({
  selector: 'app-timeline',
  imports: [CommonModule, LottieComponent],
  templateUrl: './timeline.component.html',
  styleUrls: ['./timeline.component.scss']
})
export class TimelineComponent {
  @ViewChild('timelineSection', { static: true }) timelineSection!: ElementRef;

  timelineAnimation: AnimationItem | null = null;
  timelineTotalFrames: number = 0;
  timelineCurrentFrame: number = 0;


  mapAnimation: AnimationItem | null = null;
  mapTotalFrames: number = 0;
  mapCurrentFrame: number = 0;
  mapHeight: number = 0;

  gridWidth: number = 0;
  scrollY: number = 0;
  private subscriptions = new Subscription();

  mapOptions: AnimationOptions = {
    path: '/assets/animations/map.json',
    autoplay: false,
  };

  timeLineOptions: AnimationOptions = {
    path: '/assets/animations/timeline.json',
    autoplay: false
  };

  constructor(private scrollService: ScrollService, private gridService: GridService) {
  }

  ngOnInit(): void {
    this.subscriptions.add(
      this.gridService.gridWidth$.subscribe(
        (grid: number) => {
          this.gridWidth = grid
        }
      )
    );

    this.subscriptions.add(
      this.scrollService.scrollY$.subscribe(
        (scrollY: number) => {
          this.scrollY = scrollY
          this.handleScroll(scrollY)
        }
      )
    );

    this.mapHeight = this.gridService.getMaxHeight(8)

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
      //this.setupScrollListener();
    });
  }

  private handleScroll(scrollY: number): void {
    if (!this.timelineSection?.nativeElement) {
      return;
    }

    //const scrollPosition = window.scrollY || window.pageYOffset;
    const windowHeight = window.innerHeight;

    const rect = this.timelineSection.nativeElement.getBoundingClientRect();
    const elementTop = rect.top + scrollY;
    const elementHeight = rect.height;

    // Calculate when animation should start and end
    const animationStart = elementTop - windowHeight * 0.8; // Start when 50% in view
    const animationEnd = elementTop + elementHeight - windowHeight * 0.5; // End when 50% out of view
    const animationRange = animationEnd - animationStart;


    let progress = (scrollY - animationStart) / animationRange;
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
}
