import { CommonModule } from '@angular/common';
import {
  Component, Input, Output, EventEmitter, OnInit, OnDestroy,
  ElementRef, ViewChildren, QueryList, AfterViewInit,
  OnChanges, SimpleChanges
} from '@angular/core';
import { gsap } from 'gsap';
import { AnimationOptions, LottieComponent } from 'ngx-lottie';
import { BlurService } from '../../_services/blur.service';
import { AnalyticsService } from '../../_services/analytics.service';

export interface Slide {
  id: number;
  src?: string;
  options?: AnimationOptions,
  video?: string,
  bg?: string
}

export interface SliderConfig {
  autoPlay?: boolean;
  autoPlayInterval?: number;
  showArrows?: boolean;
  showDots?: boolean;
  showProgress?: boolean;
  animationDuration?: number;
  pauseOnHover?: boolean;
  infinite?: boolean;
  height?: string;
  overlay?: boolean;
  swipeThreshold?: number;
  startIndex?: number;
  allowSwip?: boolean;
}

@Component({
  selector: 'app-slider',
  imports: [CommonModule, LottieComponent],
  templateUrl: './slider.html',
  styleUrl: './slider.scss'
})
export class Slider implements OnInit, AfterViewInit, OnDestroy, OnChanges {
  @Input() slides: Slide[] = [];
  @Input() config: SliderConfig = {};
  @Output() slideChange = new EventEmitter<number>();
  @Output() slideClick = new EventEmitter<Slide>();


  @ViewChildren('slide') slideElements!: QueryList<ElementRef>;
  @ViewChildren('dot') dotElements!: QueryList<ElementRef>;
  @ViewChildren('videoElement') videoElements!: QueryList<ElementRef<HTMLVideoElement>>;

  currentSlide: number = 0;
  isAnimating = false;
  autoPlayInterval: any;
  isHovering = false;
  private isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  private activeVideos = new Set<HTMLVideoElement>();

  // Touch swipe properties
  private touchStartX = 0;
  private touchStartY = 0;
  private touchEndX = 0;
  private touchEndY = 0;
  private isSwiping = false;
  private swipeThreshold = 50; // Minimum distance for swipe to trigger slide change

  private defaultConfig: SliderConfig = {
    startIndex: 0,
    autoPlay: true,
    autoPlayInterval: 5000,
    showArrows: true,
    showDots: true,
    showProgress: true,
    animationDuration: 0.8,
    pauseOnHover: true,
    infinite: true,
    height: '500px',
    overlay: true,
    swipeThreshold: 50,
    allowSwip: true,
  };

  get effectiveConfig(): SliderConfig {
    return { ...this.defaultConfig, ...this.config };
  }

  constructor(private elementRef: ElementRef, private blur: BlurService, private analyticsService: AnalyticsService) { }

  ngOnInit() {
    const startIndex = this.effectiveConfig.startIndex || 0;
    this.currentSlide = Math.max(0, Math.min(startIndex, this.slides.length - 1));

    this.startAutoPlay();
    this.swipeThreshold = this.effectiveConfig.swipeThreshold || 50;
    this.setupVideoPlayback();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['slides']) {
      // Update currentSlide to stay within new bounds if slides array changes
      this.currentSlide = Math.max(0, Math.min(this.currentSlide, this.slides.length - 1));

      if (!changes['slides'].firstChange) {
        this.resetSlider();
      }
    }

    if (changes['config'] && !changes['config'].firstChange) {
      this.restartAutoPlay();
      this.swipeThreshold = this.effectiveConfig.swipeThreshold || 50;

      // Handle startIndex change
      if (changes['config'].currentValue.startIndex !== changes['config'].previousValue?.startIndex) {
        const newStartIndex = this.effectiveConfig.startIndex || 0;
        const validIndex = Math.max(0, Math.min(newStartIndex, this.slides.length - 1));

        if (validIndex !== this.currentSlide) {
          this.currentSlide = validIndex;
          // Reset slide positions if we're not animating
          if (!this.isAnimating && this.slideElements) {
            this.resetSlidePositions();
          }
        }
      }
    }
  }

  ngAfterViewInit() {
    if (this.slides.length > 0) {
      this.animateSlideIn(0);
    }
    if (this.effectiveConfig.allowSwip) {
      this.setupTouchEvents();
    }

  }

  // Helper method to reset slide positions based on currentSlide
  private resetSlidePositions() {
    if (!this.slideElements || this.slideElements.length === 0) return;

    this.slideElements.forEach((slide, index) => {
      if (index === this.currentSlide) {
        gsap.set(slide.nativeElement, {
          x: '0%',
          opacity: 1
        });
      } else {
        gsap.set(slide.nativeElement, {
          x: index > this.currentSlide ? '100%' : '-100%',
          opacity: 0
        });
      }
    });
  }

  setupVideoPlayback() {
    setTimeout(() => {
      this.videoElements.forEach((videoRef, index) => {
        const video = videoRef.nativeElement;
        this.initializeVideo(video, index);
      });
    }, 200);
  }

  initializeVideo(video: HTMLVideoElement, index: number) {
    // Set up video attributes for iOS compatibility
    video.muted = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.play()

    // Preload metadata for better performance
    video.preload = 'metadata';


    // Add event listeners
    video.addEventListener('loadedmetadata', () => {
      console.log(`Video ${index} metadata loaded`);
    });


    video.addEventListener('error', (e) => {
      console.error(`Video ${index} error:`, e);
    });
  }

  setupTouchEvents() {
    const sliderContainer = this.elementRef.nativeElement.querySelector('.image-slider');
    if (sliderContainer) {
      sliderContainer.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
      sliderContainer.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
      sliderContainer.addEventListener('touchend', this.handleTouchEnd.bind(this));
    }
  }

  handleTouchStart(event: TouchEvent) {
    this.touchStartX = event.touches[0].clientX;
    this.touchStartY = event.touches[0].clientY;
    this.isSwiping = false;
  }

  handleTouchMove(event: TouchEvent) {
    if (!this.touchStartX || !this.touchStartY) return;

    this.touchEndX = event.touches[0].clientX;
    this.touchEndY = event.touches[0].clientY;

    const diffX = this.touchStartX - this.touchEndX;
    const diffY = this.touchStartY - this.touchEndY;

    // Determine if it's primarily a horizontal swipe
    if (Math.abs(diffX) > Math.abs(diffY)) {
      // It's a horizontal swipe - prevent default to avoid page scroll
      event.preventDefault();
      this.isSwiping = true;

      // Optional: Add visual feedback during swipe
      this.updateSlidePositionDuringSwipe(diffX);
    }
    // Vertical swipes will naturally scroll the page without prevention
  }

  handleTouchEnd() {
    if (!this.isSwiping) return;

    const diffX = this.touchStartX - this.touchEndX;
    const diffY = this.touchStartY - this.touchEndY;

    // Check if it's a horizontal swipe that meets the threshold
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > this.swipeThreshold) {
      if (diffX > 0) {
        // Swipe left - go to next slide
        this.nextSlide();
      } else {
        // Swipe right - go to previous slide
        this.prevSlide();
      }
    }

    // Reset swipe position
    this.resetSlidePosition();

    // Reset touch coordinates
    this.touchStartX = 0;
    this.touchStartY = 0;
    this.touchEndX = 0;
    this.touchEndY = 0;
    this.isSwiping = false;
  }

  updateSlidePositionDuringSwipe(diffX: number) {
    if (this.isAnimating || this.slides.length <= 1) return;

    const currentSlideElement = this.slideElements.toArray()[this.currentSlide].nativeElement;
    const swipePercent = Math.min(Math.abs(diffX) / window.innerWidth, 1);
    const direction = diffX < 0 ? 1 : -1; // >

    // Move current slide based on swipe distance
    gsap.set(currentSlideElement, {
      x: direction * swipePercent * 100 + '%',
      overwrite: true
    });
  }

  resetSlidePosition() {
    if (this.isAnimating || this.slides.length <= 1) return;

    const currentSlideElement = this.slideElements.toArray()[this.currentSlide].nativeElement;

    gsap.to(currentSlideElement, {
      x: '0%',
      duration: 0.3,
      ease: 'power2.out'
    });

    // Reset all other slides
    this.slideElements.forEach((slide, index) => {
      if (index !== this.currentSlide) {
        gsap.set(slide.nativeElement, {
          x: index > this.currentSlide ? '100%' : '-100%',
          opacity: 0
        });
      }
    });
  }

  resetSlider() {
    this.currentSlide = this.config.startIndex!;
    this.stopAutoPlay();
    this.startAutoPlay();

    // Reset all slides to initial state
    if (this.slideElements) {
      this.slideElements.forEach((slide, index) => {
        gsap.set(slide.nativeElement, {
          x: index === 0 ? '0%' : '100%',
          opacity: index === 0 ? 1 : 0
        });
      });
    }
  }

  startAutoPlay() {
    if (this.effectiveConfig.autoPlay && this.slides.length > 1) {
      this.stopAutoPlay();
      this.autoPlayInterval = setInterval(() => {
        if (!this.isHovering || !this.effectiveConfig.pauseOnHover) {
          this.nextSlide();
        }
      }, this.effectiveConfig.autoPlayInterval);
    }
    this.setupVideoPlayback();
    //this.videoElements
  }

  stopAutoPlay() {
    if (this.autoPlayInterval) {
      clearInterval(this.autoPlayInterval);
    }

  }

  restartAutoPlay() {
    this.stopAutoPlay();
    this.startAutoPlay();
  }

  nextSlide() {
    if (this.isAnimating || this.slides.length <= 1) return;

    this.analyticsService.trackAction('slide next')

    const nextIndex = this.effectiveConfig.infinite
      ? (this.currentSlide + 1) % this.slides.length
      : Math.min(this.currentSlide + 1, this.slides.length - 1);

    if (nextIndex !== this.currentSlide) {
      this.goToSlide(nextIndex);
    }
  }

  prevSlide() {
    if (this.isAnimating || this.slides.length <= 1) return;
    this.analyticsService.trackAction('slide prev')

    const prevIndex = this.effectiveConfig.infinite
      ? this.currentSlide === 0 ? this.slides.length - 1 : this.currentSlide - 1
      : Math.max(this.currentSlide - 1, 0);

    if (prevIndex !== this.currentSlide) {
      this.goToSlide(prevIndex);
    }
  }

  goToSlide(index: number) {
    if (this.isAnimating || index === this.currentSlide || index < 0 || index >= this.slides.length) {
      return;
    }

    this.isAnimating = true;
    this.stopAutoPlay();

    const currentSlideElement = this.slideElements.toArray()[this.currentSlide].nativeElement;
    const nextSlideElement = this.slideElements.toArray()[index].nativeElement;

    const direction = index > this.currentSlide ? 1 : -1;

    // Animate current slide out
    gsap.to(currentSlideElement, {
      x: direction * -100 + '%',
      opacity: 1,
      scale: 1,
      duration: this.effectiveConfig.animationDuration,
      ease: 'power2.inOut'
    });

    // Prepare and animate next slide in
    gsap.set(nextSlideElement, {
      x: direction * 100 + '%',
      opacity: 1,
      scale: 1.1
    });

    gsap.to(nextSlideElement, {
      x: '0%',
      scale: 1,
      duration: this.effectiveConfig.animationDuration,
      ease: 'power2.inOut',
      onComplete: () => {
        this.currentSlide = index;
        this.isAnimating = false;
        this.slideChange.emit(this.currentSlide);
        this.startAutoPlay();
        this.animateDots();
      }
    });

    // Animate content if present
    this.animateContent(nextSlideElement);
  }

  animateSlideIn(index: number) {
    const slideElement = this.slideElements.toArray()[index].nativeElement;

    gsap.fromTo(slideElement,
      {
        x: 100,
        opacity: 0,
        scale: 1
      },
      {
        x: 0,
        opacity: 1,
        scale: 1,
        duration: this.effectiveConfig.animationDuration,
        ease: 'power2.out'
      }
    );

    this.animateContent(slideElement);
  }

  animateContent(slideElement: HTMLElement) {
    const title = slideElement.querySelector('.slide-title');
    const description = slideElement.querySelector('.slide-description');

    if (title || description) {
      gsap.set([title, description], { y: 30, opacity: 0 });

      gsap.to([title, description], {
        y: 0,
        opacity: 1,
        duration: 0.6,
        stagger: 0.2,
        ease: 'power2.out',
        delay: 0.3
      });
    }
  }

  animateDots() {
    if (this.dotElements && this.effectiveConfig.showDots) {
      const dots = this.dotElements.toArray();
      dots.forEach((dot, index) => {
        if (index === this.currentSlide) {
          gsap.to(dot.nativeElement, {
            scale: 1.0,
            duration: 0.3,
            ease: 'back.out'
          });
        } else {
          gsap.to(dot.nativeElement, {
            scale: 1,
            duration: 0.3,
            ease: 'power2.out'
          });
        }
      });
    }
  }

  onSlideClick(index: number) {
    this.blur.setBlur(true)
    this.blur.setSlide(index)
  }

  onMouseEnter() {
    this.isHovering = true;
  }

  onMouseLeave() {
    this.isHovering = false;
  }

  ngOnDestroy() {
    this.stopAutoPlay();
    const sliderContainer = this.elementRef.nativeElement.querySelector('.image-slider');
    if (sliderContainer) {
      sliderContainer.removeEventListener('touchstart', this.handleTouchStart.bind(this));
      sliderContainer.removeEventListener('touchmove', this.handleTouchMove.bind(this));
      sliderContainer.removeEventListener('touchend', this.handleTouchEnd.bind(this));
    }
  }
}