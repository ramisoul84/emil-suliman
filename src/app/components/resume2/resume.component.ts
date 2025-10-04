import { Component, ElementRef, HostListener, ViewChild } from '@angular/core';
import { AnimationItem } from 'lottie-web';
import { AnimationOptions, LottieComponent } from 'ngx-lottie';

@Component({
  selector: 'app-resume2',
  imports: [LottieComponent],
  templateUrl: './resume.component.html',
  styleUrl: './resume.component.scss'
})
export class ResumeComponent2 {
  @ViewChild('timelineSection') timelineSectionRef!: ElementRef;
  // Animation metadata
  mapAnimation: AnimationItem | null = null;
  timelineAnimation: AnimationItem | null = null;

  rect!: DOMRect
  top!: number
  height!: number
  total!: number


  mapOptions: AnimationOptions = {
    autoplay: false,
    path: 'assets/animations/map.json',
  };

  timeLineOptions: AnimationOptions = {
    autoplay: false,
    path: 'assets/animations/timeline.json',

  };

  onMapAnimationCreated(animationItem: AnimationItem): void {
    this.mapAnimation = animationItem;
    animationItem.addEventListener('data_ready', () => {
      console.log('Map animation loaded with', this.mapAnimation?.totalFrames, 'frames');
    });
  }
  onTimelineAnimationCreated(animationItem: AnimationItem): void {
    this.timelineAnimation = animationItem;
    animationItem.addEventListener('data_ready', () => {
      const element: HTMLElement = this.timelineSectionRef.nativeElement
      const rect = element.getBoundingClientRect();
      this.height = rect.height
      this.top = rect.top
      this.total = this.timelineAnimation?.totalFrames!
      console.log('Map animation loaded with', this.timelineAnimation?.totalFrames, 'frames');
    });
  }

  @HostListener('window:scroll', ['getScrollPosition()'])
  getScrollPosition() {
    const scrollY = window.scrollY + window.innerHeight-400;
    if (scrollY > this.top && scrollY ) {
      const diff = scrollY - this.top
      const rate = diff / this.height
      console.log(rate)
      this.updateProgress(rate)
    }

  }

  private updateProgress(rate: number) {
    var current: number = 0
    current = Math.floor(rate * this.total);
    console.log("frame", this.timelineAnimation?.currentFrame)
    this.mapAnimation?.goToAndStop(current, true);
    this.timelineAnimation?.goToAndStop(current, true);
    /*
        if (this.timelineAnimation?.currentFrame! < 50) {
     this.mapAnimation?.play()
     this.timelineAnimation?.play()
   } else {
     this.mapAnimation?.pause();
     this.timelineAnimation?.pause();
   }
    */




  }
}
