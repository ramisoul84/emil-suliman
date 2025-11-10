import { CommonModule } from '@angular/common';
import {
  Component, Input, Output, EventEmitter, OnInit, OnDestroy,
  ElementRef, ViewChildren, QueryList, AfterViewInit,
  OnChanges, SimpleChanges
} from '@angular/core';
import { gsap } from 'gsap';
import { AnimationOptions, LottieComponent } from 'ngx-lottie';

export interface Slide {
  id: number;
  src: string;
  alt?: string;
  title?: string;
  description?: string;
  overlayColor?: string;
  lottieAnimation?: string; // Lottie animation path
  lottiePosition?: 'background' | 'foreground' | 'overlay'; // Where to position Lottie
  lottieConfig?: AnimationOptions; // Custom Lottie config for this slide
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
  parallaxEffect?: boolean;
  lottieAutoPlay?: boolean;
  lottieLoop?: boolean;
}

@Component({
  selector: 'app-slider',
  imports: [CommonModule, LottieComponent],
  templateUrl: './slider.component.html',
  styleUrl: './slider.component.scss'
})
export class SliderComponent implements OnInit, AfterViewInit, OnDestroy, OnChanges {
  @Input() slides: Slide[] = [];
  @Input() config: SliderConfig = {};
  @Output() slideChange = new EventEmitter<number>();
  @Output() slideClick = new EventEmitter<Slide>();
  @Output() lottieLoaded = new EventEmitter<{ slideId: number, animation: any }>();

  @ViewChildren('slide') slideElements!: QueryList<ElementRef>;
  @ViewChildren('dot') dotElements!: QueryList<ElementRef>;
  @ViewChildren('lottieAnim') lottieComponents!: QueryList<LottieComponent>;

  currentSlide = 0;
  isAnimating = false;
  autoPlayInterval: any;
  isHovering = false;
  progress = 0;
  private progressInterval: any;

  // Touch swipe properties with improved detection
  private touchStartX = 0;
  private touchStartY = 0;
  private touchEndX = 0;
  private touchEndY = 0;
  private isSwiping = false;
  private swipeThreshold = 50;
  private readonly SWIPE_DIRECTION = {
    LEFT: 'left',
    RIGHT: 'right',
    UP: 'up',
    DOWN: 'down',
    NONE: 'none'
  };

  private defaultConfig: SliderConfig = {
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
    parallaxEffect: true,
    lottieAutoPlay: true,
    lottieLoop: true
  };

  get effectiveConfig(): SliderConfig {
    return { ...this.defaultConfig, ...this.config };
  }

  constructor(private elementRef: ElementRef) { }

  ngOnInit() {
    this.startAutoPlay();
    this.startProgressBar();
    this.swipeThreshold = this.effectiveConfig.swipeThreshold || 50;
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['slides'] && !changes['slides'].firstChange) {
      this.resetSlider();
    }

    if (changes['config'] && !changes['config'].firstChange) {
      this.restartAutoPlay();
      this.swipeThreshold = this.effectiveConfig.swipeThreshold || 50;
    }
  }

  ngAfterViewInit() {
    if (this.slides.length > 0) {
      this.animateSlideIn(0);
    }
    this.setupTouchEvents();
  }

  // Enhanced touch event setup
  setupTouchEvents() {
    const sliderElement = this.elementRef.nativeElement.querySelector('.slider-container');

    if (sliderElement) {
      sliderElement.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: true });
      sliderElement.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
      sliderElement.addEventListener('touchend', this.handleTouchEnd.bind(this));
    }
  }

  handleTouchStart(event: TouchEvent) {
    this.touchStartX = event.touches[0].clientX;
    this.touchStartY = event.touches[0].clientY;
    this.isSwiping = false;
  }

  handleTouchMove(event: TouchEvent) {
    if (!this.touchStartX || !this.touchStartY || this.isAnimating) return;

    this.touchEndX = event.touches[0].clientX;
    this.touchEndY = event.touches[0].clientY;

    const diffX = this.touchStartX - this.touchEndX;
    const diffY = this.touchStartY - this.touchEndY;

    // Only prevent default for horizontal swipes to maintain vertical scrolling
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 10) {
      event.preventDefault();
      this.isSwiping = true;
      this.updateSlidePositionDuringSwipe(diffX);
    }
  }

  handleTouchEnd() {
    if (!this.isSwiping) return;

    const swipeDirection = this.getSwipeDirection();

    if (swipeDirection === this.SWIPE_DIRECTION.LEFT) {
      this.nextSlide();
    } else if (swipeDirection === this.SWIPE_DIRECTION.RIGHT) {
      this.prevSlide();
    }

    this.resetSwipeState();
  }

  getSwipeDirection(): string {
    const diffX = this.touchStartX - this.touchEndX;
    const diffY = this.touchStartY - this.touchEndY;

    // Check if swipe meets threshold and is primarily horizontal
    if (Math.abs(diffX) > this.swipeThreshold && Math.abs(diffX) > Math.abs(diffY)) {
      return diffX > 0 ? this.SWIPE_DIRECTION.LEFT : this.SWIPE_DIRECTION.RIGHT;
    }

    return this.SWIPE_DIRECTION.NONE;
  }

  updateSlidePositionDuringSwipe(diffX: number) {
    if (this.isAnimating || this.slides.length <= 1) return;

    const currentSlideElement = this.slideElements.toArray()[this.currentSlide].nativeElement;
    const swipePercent = Math.min(Math.abs(diffX) / window.innerWidth, 0.5); // Limit to 50% of screen
    const direction = diffX > 0 ? 1 : -1;

    // Move current slide with easing
    gsap.set(currentSlideElement, {
      x: direction * swipePercent * 100 + '%',
      overwrite: true
    });

    // Show adjacent slide during swipe
    const adjacentIndex = this.getAdjacentSlideIndex(direction);
    if (adjacentIndex !== -1) {
      const adjacentSlideElement = this.slideElements.toArray()[adjacentIndex].nativeElement;

      gsap.set(adjacentSlideElement, {
        x: (direction * -100) + (direction * swipePercent * 100) + '%',
        opacity: 0.7, // Slightly visible during swipe
        overwrite: true
      });
    }
  }

  getAdjacentSlideIndex(direction: number): number {
    if (this.effectiveConfig.infinite) {
      return direction > 0 ?
        (this.currentSlide + 1) % this.slides.length :
        this.currentSlide === 0 ? this.slides.length - 1 : this.currentSlide - 1;
    } else {
      if (direction > 0 && this.currentSlide < this.slides.length - 1) {
        return this.currentSlide + 1;
      } else if (direction < 0 && this.currentSlide > 0) {
        return this.currentSlide - 1;
      }
    }
    return -1;
  }

  resetSwipeState() {
    this.resetSlidePosition();
    this.touchStartX = 0;
    this.touchStartY = 0;
    this.touchEndX = 0;
    this.touchEndY = 0;
    this.isSwiping = false;
  }

  resetSlidePosition() {
    if (this.isAnimating || this.slides.length <= 1) return;

    const currentSlideElement = this.slideElements.toArray()[this.currentSlide].nativeElement;

    gsap.to(currentSlideElement, {
      x: '0%',
      duration: 0.3,
      ease: 'power2.out'
    });

    // Reset all slides
    this.slideElements.forEach((slide, index) => {
      if (index !== this.currentSlide) {
        gsap.set(slide.nativeElement, {
          x: index > this.currentSlide ? '100%' : '-100%',
          opacity: 0
        });
      }
    });
  }

  // Lottie Animation Methods
  getLottieOptions(slide: Slide): AnimationOptions {
    const defaultOptions: AnimationOptions = {
      path: slide.lottieAnimation,
      autoplay: this.effectiveConfig.lottieAutoPlay,
      loop: this.effectiveConfig.lottieLoop,
      rendererSettings: {
        preserveAspectRatio: 'xMidYMid slice'
      }
    };

    return slide.lottieConfig ? { ...defaultOptions, ...slide.lottieConfig } : defaultOptions;
  }

  onLottieAnimationCreated(animation: any, slideId: number) {
    this.lottieLoaded.emit({ slideId, animation });

    // Optional: Add interactive controls to Lottie animations
    if (this.effectiveConfig.pauseOnHover) {
      const slideElement = this.elementRef.nativeElement.querySelector(`[data-slide-id="${slideId}"]`);
      if (slideElement) {
        slideElement.addEventListener('mouseenter', () => animation.pause());
        slideElement.addEventListener('mouseleave', () => animation.play());
      }
    }
  }

  // Progress Bar
  startProgressBar() {
    if (this.effectiveConfig.showProgress && this.effectiveConfig.autoPlay) {
      this.progress = 0;
      const interval = 50;
      const increment = (interval / (this.effectiveConfig.autoPlayInterval || 5000)) * 100;

      this.progressInterval = setInterval(() => {
        if (!this.isHovering || !this.effectiveConfig.pauseOnHover) {
          this.progress += increment;
          if (this.progress >= 100) {
            this.progress = 0;
            this.nextSlide();
          }
        }
      }, interval);
    }
  }

  stopProgressBar() {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
    }
  }

  resetProgressBar() {
    this.stopProgressBar();
    this.progress = 0;
    this.startProgressBar();
  }

  // Existing methods with enhancements
  resetSlider() {
    this.currentSlide = 0;
    this.stopAutoPlay();
    this.stopProgressBar();
    this.startAutoPlay();
    this.startProgressBar();

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

    const nextIndex = this.effectiveConfig.infinite
      ? (this.currentSlide + 1) % this.slides.length
      : Math.min(this.currentSlide + 1, this.slides.length - 1);

    if (nextIndex !== this.currentSlide) {
      this.goToSlide(nextIndex);
    }
  }

  prevSlide() {
    if (this.isAnimating || this.slides.length <= 1) return;

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
    this.stopProgressBar();

    const currentSlideElement = this.slideElements.toArray()[this.currentSlide].nativeElement;
    const nextSlideElement = this.slideElements.toArray()[index].nativeElement;

    const direction = index > this.currentSlide ? 1 : -1;

    // Enhanced animation with parallax
    gsap.to(currentSlideElement, {
      x: direction * -100 + '%',
      opacity: 0,
      scale: this.effectiveConfig.parallaxEffect ? 1.1 : 1,
      duration: this.effectiveConfig.animationDuration,
      ease: 'power2.inOut'
    });

    gsap.set(nextSlideElement, {
      x: direction * 100 + '%',
      opacity: 1,
      scale: this.effectiveConfig.parallaxEffect ? 0.9 : 1
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
        this.resetProgressBar();
        this.animateDots();
        this.triggerLottieAnimations(index);
      }
    });

    this.animateContent(nextSlideElement);
  }

  triggerLottieAnimations(slideIndex: number) {
    // Optional: Trigger Lottie animations when slide becomes active
    const currentSlide = this.slides[slideIndex];
    if (currentSlide.lottieAnimation) {
      // Lottie will auto-play based on config, but you can add custom triggers here
    }
  }

  animateSlideIn(index: number) {
    const slideElement = this.slideElements.toArray()[index].nativeElement;

    gsap.fromTo(slideElement,
      {
        x: 100,
        opacity: 0,
        scale: 1.1
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
            scale: 1.2,
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

  onSlideClick(slide: Slide) {
    this.slideClick.emit(slide);
  }

  onMouseEnter() {
    this.isHovering = true;
  }

  onMouseLeave() {
    this.isHovering = false;
  }

  ngOnDestroy() {
    this.stopAutoPlay();
    this.stopProgressBar();

    // Clean up event listeners
    const sliderElement = this.elementRef.nativeElement.querySelector('.slider-container');
    if (sliderElement) {
      sliderElement.removeEventListener('touchstart', this.handleTouchStart.bind(this));
      sliderElement.removeEventListener('touchmove', this.handleTouchMove.bind(this));
      sliderElement.removeEventListener('touchend', this.handleTouchEnd.bind(this));
    }
  }
}