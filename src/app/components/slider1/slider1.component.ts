import { CommonModule } from '@angular/common';
import {
  Component, Input, Output, EventEmitter, OnInit, OnDestroy,
  ElementRef, ViewChildren, QueryList, AfterViewInit,
  OnChanges, SimpleChanges
} from '@angular/core';
import { gsap } from 'gsap';
import { AnimationOptions, LottieComponent } from 'ngx-lottie';
import { AnimationItem } from 'lottie-web';

export interface Slide {
  id: number;
  src: string;
  alt?: string;
  title?: string;
  description?: string;
  overlayColor?: string;
  type?: 'image' | 'lottie';
  lottieOptions?: AnimationOptions;
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
  lottieWidth?: string;
  lottieHeight?: string;
}

@Component({
  selector: 'app-slider1',
  imports: [CommonModule, LottieComponent],
  templateUrl: './slider1.component.html',
  styleUrl: './slider1.component.scss'
})
export class SliderComponent implements OnInit, AfterViewInit, OnDestroy, OnChanges {
  @Input() slides: Slide[] = [];
  @Input() config: SliderConfig = {};
  @Output() slideChange = new EventEmitter<number>();
  @Output() slideClick = new EventEmitter<Slide>();
  @Output() lottieLoaded = new EventEmitter<{index: number, animation: AnimationItem}>();

  @ViewChildren('slide') slideElements!: QueryList<ElementRef>;
  @ViewChildren('dot') dotElements!: QueryList<ElementRef>;
  @ViewChildren(LottieComponent) lottieComponents!: QueryList<LottieComponent>;

  currentSlide = 0;
  isAnimating = false;
  autoPlayInterval: any;
  isHovering = false;
  progress = 0;
  progressInterval: any;

  // Store Lottie animation instances
  private lottieAnimations: Map<number, AnimationItem> = new Map();

  defaultLottieOptions: AnimationOptions = {
    autoplay: false,
    loop: true,
    rendererSettings: {
      preserveAspectRatio: 'xMidYMid slice'
    }
  };

  private touchStartX = 0;
  private touchStartY = 0;
  private touchEndX = 0;
  private touchEndY = 0;
  private isSwiping = false;
  private swipeThreshold = 50;

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
    lottieWidth: '100%',
    lottieHeight: '100%'
  };

  get effectiveConfig(): SliderConfig {
    return { ...this.defaultConfig, ...this.config };
  }

  constructor(private elementRef: ElementRef) { }

  ngOnInit() {
    this.startAutoPlay();
    this.swipeThreshold = this.effectiveConfig.swipeThreshold || 50;
    this.initializeSlides();
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

  private initializeSlides() {
    this.slides = this.slides.map(slide => {
      if (!slide.type) {
        slide.type = this.detectContentType(slide.src);
      }
      
      if (slide.type === 'lottie' && !slide.lottieOptions) {
        slide.lottieOptions = {
          ...this.defaultLottieOptions,
          path: slide.src
        };
      }
      
      return slide;
    });
  }

  private detectContentType(src: string): 'image' | 'lottie' {
    const extension = src.split('.').pop()?.toLowerCase();
    const lottieExtensions = ['json', 'lottie'];
    return lottieExtensions.includes(extension || '') ? 'lottie' : 'image';
  }

  // Touch Events
  private setupTouchEvents() {
    const sliderElement = this.elementRef.nativeElement.querySelector('.image-slider');
    if (sliderElement) {
      sliderElement.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
      sliderElement.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
      sliderElement.addEventListener('touchend', this.handleTouchEnd.bind(this));
    }
  }

  private handleTouchStart(event: TouchEvent) {
    this.touchStartX = event.touches[0].clientX;
    this.touchStartY = event.touches[0].clientY;
    this.isSwiping = false;
  }

  private handleTouchMove(event: TouchEvent) {
    if (!this.touchStartX || !this.touchStartY) return;

    this.touchEndX = event.touches[0].clientX;
    this.touchEndY = event.touches[0].clientY;

    const diffX = this.touchStartX - this.touchEndX;
    const diffY = this.touchStartY - this.touchEndY;

    if (Math.abs(diffX) > Math.abs(diffY)) {
      event.preventDefault();
      this.isSwiping = true;
      this.updateSlidePositionDuringSwipe(diffX);
    }
  }

  private handleTouchEnd() {
    if (!this.isSwiping) return;

    const diffX = this.touchStartX - this.touchEndX;
    const diffY = this.touchStartY - this.touchEndY;

    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > this.swipeThreshold) {
      if (diffX > 0) {
        this.nextSlide();
      } else {
        this.prevSlide();
      }
    }

    this.resetSlidePosition();
    this.touchStartX = 0;
    this.touchStartY = 0;
    this.touchEndX = 0;
    this.touchEndY = 0;
    this.isSwiping = false;
  }

  private updateSlidePositionDuringSwipe(diffX: number) {
    if (this.isAnimating || this.slides.length <= 1) return;

    const currentSlideElement = this.slideElements.toArray()[this.currentSlide].nativeElement;
    const swipePercent = Math.min(Math.abs(diffX) / window.innerWidth, 1);
    const direction = diffX > 0 ? 1 : -1;

    gsap.set(currentSlideElement, {
      x: direction * swipePercent * 100 + '%',
      overwrite: true
    });

    if (this.effectiveConfig.infinite || (direction > 0 && this.currentSlide < this.slides.length - 1) ||
      (direction < 0 && this.currentSlide > 0)) {
      const nextIndex = direction > 0 ?
        (this.currentSlide + 1) % this.slides.length :
        this.currentSlide === 0 ? this.slides.length - 1 : this.currentSlide - 1;

      const nextSlideElement = this.slideElements.toArray()[nextIndex].nativeElement;

      gsap.set(nextSlideElement, {
        x: (direction * -100) + (direction * swipePercent * 100) + '%',
        opacity: 1,
        overwrite: true
      });
    }
  }

  private resetSlidePosition() {
    if (this.isAnimating || this.slides.length <= 1) return;

    const currentSlideElement = this.slideElements.toArray()[this.currentSlide].nativeElement;

    gsap.to(currentSlideElement, {
      x: '0%',
      duration: 0.3,
      ease: 'power2.out'
    });

    this.slideElements.forEach((slide, index) => {
      if (index !== this.currentSlide) {
        gsap.set(slide.nativeElement, {
          x: index > this.currentSlide ? '100%' : '-100%',
          opacity: 0
        });
      }
    });
  }

  // AutoPlay Methods
  startAutoPlay() {
    if (this.effectiveConfig.autoPlay && this.slides.length > 1) {
      this.stopAutoPlay();
      this.startProgress();
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
      this.autoPlayInterval = null;
    }
    this.stopProgress();
  }

  restartAutoPlay() {
    this.stopAutoPlay();
    this.startAutoPlay();
  }

  startProgress() {
    if (this.effectiveConfig.showProgress) {
      this.progress = 0;
      const interval = 50;
      const increment = (interval / this.effectiveConfig.autoPlayInterval!) * 100;
      
      this.progressInterval = setInterval(() => {
        if (!this.isHovering || !this.effectiveConfig.pauseOnHover) {
          this.progress += increment;
          if (this.progress >= 100) {
            this.progress = 0;
          }
        }
      }, interval);
    }
  }

  stopProgress() {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
    this.progress = 0;
  }

  // Navigation Methods
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

    // Handle Lottie animations
    if (this.slides[this.currentSlide].type === 'lottie') {
      this.pauseLottieAnimation(this.currentSlide);
    }

    const currentSlideElement = this.slideElements.toArray()[this.currentSlide].nativeElement;
    const nextSlideElement = this.slideElements.toArray()[index].nativeElement;
    const direction = index > this.currentSlide ? 1 : -1;

    // Animate current slide out
    gsap.to(currentSlideElement, {
      x: direction * -100 + '%',
      opacity: 0,
      duration: this.effectiveConfig.animationDuration,
      ease: 'power2.inOut'
    });

    // Prepare and animate next slide in
    gsap.set(nextSlideElement, {
      x: direction * 100 + '%',
      opacity: 0
    });

    gsap.to(nextSlideElement, {
      x: '0%',
      opacity: 1,
      duration: this.effectiveConfig.animationDuration,
      ease: 'power2.inOut',
      onComplete: () => {
        if (this.slides[index].type === 'lottie') {
          this.playLottieAnimation(index);
        }

        this.currentSlide = index;
        this.isAnimating = false;
        this.slideChange.emit(this.currentSlide);
        this.startAutoPlay();
        this.animateDots();
      }
    });

    this.animateContent(nextSlideElement);
  }

  // Animation Methods
  animateSlideIn(index: number) {
    const slideElement = this.slideElements.toArray()[index].nativeElement;

    gsap.fromTo(slideElement,
      { x: 100, opacity: 0 },
      { x: 0, opacity: 1, duration: this.effectiveConfig.animationDuration, ease: 'power2.out' }
    );

    this.animateContent(slideElement);
  }

  animateContent(slideElement: HTMLElement) {
    const title = slideElement.querySelector('.slide-title');
    const description = slideElement.querySelector('.slide-description');
    const media = slideElement.querySelector('.slide-media');

    if (title || description || media) {
      gsap.set([title, description, media], { y: 30, opacity: 0 });

      const tl = gsap.timeline();
      
      tl.to(media, { y: 0, opacity: 1, duration: 0.6, ease: 'power2.out' })
        .to(title, { y: 0, opacity: 1, duration: 0.5, ease: 'power2.out' }, '-=0.3')
        .to(description, { y: 0, opacity: 1, duration: 0.5, ease: 'power2.out' }, '-=0.2');
    }
  }

  animateDots() {
    if (this.dotElements && this.effectiveConfig.showDots) {
      const dots = this.dotElements.toArray();
      dots.forEach((dot, index) => {
        if (index === this.currentSlide) {
          gsap.to(dot.nativeElement, { scale: 1.2, duration: 0.3, ease: 'back.out' });
        } else {
          gsap.to(dot.nativeElement, { scale: 1, duration: 0.3, ease: 'power2.out' });
        }
      });
    }
  }

  // Lottie Methods - CORRECTED
  onLottieAnimationCreated(animation: AnimationItem, index: number) {
    // Store the animation instance in our map
    this.lottieAnimations.set(index, animation);
    this.lottieLoaded.emit({ index, animation });
    
    // Only play if this is the current slide
    if (index === this.currentSlide) {
      this.playLottieAnimation(index);
    } else {
      this.pauseLottieAnimation(index);
    }
  }

  playLottieAnimation(index: number) {
    const animation = this.lottieAnimations.get(index);
    if (animation) {
      animation.play();
    }
  }

  pauseLottieAnimation(index: number) {
    const animation = this.lottieAnimations.get(index);
    if (animation) {
      animation.pause();
    }
  }

  stopLottieAnimation(index: number) {
    const animation = this.lottieAnimations.get(index);
    if (animation) {
      animation.stop();
    }
  }

  // Event Handlers
  onSlideClick(slide: Slide) {
    this.slideClick.emit(slide);
  }

  onMouseEnter() {
    this.isHovering = true;
  }

  onMouseLeave() {
    this.isHovering = false;
  }

  resetSlider() {
    // Stop all Lottie animations
    this.lottieAnimations.forEach((animation, index) => {
      animation.stop();
    });

    this.currentSlide = 0;
    this.stopAutoPlay();
    this.startAutoPlay();

    if (this.slideElements) {
      this.slideElements.forEach((slide, index) => {
        gsap.set(slide.nativeElement, {
          x: index === 0 ? '0%' : '100%',
          opacity: index === 0 ? 1 : 0
        });
      });
    }

    if (this.slides[this.currentSlide].type === 'lottie') {
      setTimeout(() => this.playLottieAnimation(this.currentSlide), 100);
    }
  }

  ngOnDestroy() {
    this.stopAutoPlay();
    const sliderElement = this.elementRef.nativeElement.querySelector('.image-slider');
    if (sliderElement) {
      sliderElement.removeEventListener('touchstart', this.handleTouchStart.bind(this));
      sliderElement.removeEventListener('touchmove', this.handleTouchMove.bind(this));
      sliderElement.removeEventListener('touchend', this.handleTouchEnd.bind(this));
    }
    
    // Clean up Lottie animations
    this.lottieAnimations.forEach((animation) => {
      animation.destroy();
    });
    this.lottieAnimations.clear();
  }
}