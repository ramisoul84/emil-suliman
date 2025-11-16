import { CommonModule } from '@angular/common';
import { Component, AfterViewInit, ViewChildren, QueryList, ElementRef, ViewChild } from '@angular/core';
import { gsap } from 'gsap';
import { data } from './data';
import { SliderComponent, SliderConfig } from '../../components/slider/slider.component';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { AnimationOptions } from 'ngx-lottie';
import { GridService } from '../../services/grid.service';


@Component({
  selector: 'app-cases',
  imports: [CommonModule, SliderComponent],
  templateUrl: './cases.component.html',
  styleUrl: './cases.component.scss'
})
export class CasesComponent {
  private slideElement!: HTMLElement;

  @ViewChild('slide', { static: true }) set slide(el: ElementRef) {
    if (el) {
      this.slideElement = el.nativeElement;
    }
  }

  currentSlide: number = 0;
  cases = data

    sliderConfig: SliderConfig = {
    autoPlay: false,
    autoPlayInterval: 2000,
    showArrows: true,
    showDots: true,
    swipeThreshold: 30,
  };
  
  constructor(private gridService: GridService) {
  }

  ngAfterViewInit() {
    if (this.slideElement) {
      gsap.set([this.slideElement.querySelector('.case-title'),
      this.slideElement.querySelector('.case-text'),
      this.slideElement.querySelector('.case-slider')],
        { opacity: 1, x: 0 }); // Ensure initial state
    }
  }

  nextSlide() {
    const oldIndex = this.currentSlide;
    this.currentSlide = (this.currentSlide + 1) % this.cases.length;
    this.animateContent(this.slideElement, 'next');
  }

  prevSlide() {
    const oldIndex = this.currentSlide;
    this.currentSlide = (this.currentSlide - 1 + this.cases.length) % this.cases.length;
    this.animateContent(this.slideElement, 'prev');
  }

  animateContent(slideElement: HTMLElement, direction: 'next' | 'prev' = 'next') {
    const title = slideElement.querySelector('.case-title');
    const description = slideElement.querySelector('.case-text');
    const slider = slideElement.querySelector('.case-slider');

    if (!title || !description || !slider) return;

    const xFrom = direction === 'next' ? "100%" : "-100%";

    // Reset and animate
    gsap.set([slider], {
      x: xFrom,
      opacity: 0
    });
    gsap.to(slider, {
      x: 0,
      opacity: 1,
      duration: 0.4,
      ease: 'power2.out'
    })
    gsap.fromTo(title, { opacity: 0, y: "100%" }, { opacity: 1, y: 0, duration: 0.3,delay:0.4, ease: 'power2.out' })
    gsap.fromTo(description, { opacity: 0, y: "100%" }, { opacity: 1, y: 0, duration: 0.3, delay: 0.7, ease: 'power2.out' })
    /*
        const tl = gsap.timeline();
    
        tl.to(slider, {
          x: 0,
          opacity: 1,
          duration: 0.6,
          ease: 'power2.out'
        })
          .to(title, {
            x: 0,
            opacity: 1,
            duration: 0.5,
            ease: 'power2.out'
          }, '-=0.4')
          .to(description, {
            x: 0,
            opacity: 1,
            duration: 0.5,
            ease: 'power2.out'
          }, '-=0.3');
    
        return tl;
        */
  }

}

/*.
 @ViewChildren('slide') slides!: QueryList<ElementRef>;

  currentSlide = 0;
  isAnimating = false;
  autoPlayInterval: any;

  cases = data;


  sliderConfig: SliderConfig = {
    autoPlay: false,
    autoPlayInterval: 2000,
    showArrows: true,
    showDots: true,
    swipeThreshold: 30,
  };

  constructor() {
    gsap.registerPlugin(ScrollTrigger);
  }


  ngAfterViewInit() {
    //this.animateSlideIn(0);
    //this.initScrollAnimations()
  }

  nextSlide() {
    if (this.isAnimating) return;

    const nextIndex = (this.currentSlide + 1) % this.cases.length;
    this.goToSlide(nextIndex);
  }

  prevSlide() {
    if (this.isAnimating) return;

    const prevIndex = this.currentSlide === 0 ? this.cases.length - 1 : this.currentSlide - 1;
    this.goToSlide(prevIndex);
  }

  goToSlide(index: number) {
    if (this.isAnimating || index === this.currentSlide) return;

    this.isAnimating = true;

    const currentSlideElement = this.slides.toArray()[this.currentSlide].nativeElement;
    const nextSlideElement = this.slides.toArray()[index].nativeElement;

    // Animate current slide out
    gsap.to(currentSlideElement, {
      x: index > this.currentSlide ? '-100%' : '100%',
      opacity: 0,
      duration: 0.8,
      ease: 'power2.inOut',
      onComplete: () => {
        gsap.set(currentSlideElement, { x: '0%', opacity: 0, scale: 1 });
      }
    });

    gsap.set(nextSlideElement, {
      x: index > this.currentSlide ? '100%' : '-100%',
      opacity: 1,
    });

    gsap.to(nextSlideElement, {
      x: '0%',
      duration: 0.8,
      ease: 'power2.inOut',
      onComplete: () => {
        this.currentSlide = index;
        this.isAnimating = false;
      }
    });

    this.animateContent(nextSlideElement);
  }

  animateSlideIn(index: number) {
    const slideElement = this.slides.toArray()[index].nativeElement;

    gsap.fromTo(slideElement,
      {
        x: 100,
        opacity: 0,
      },
      {
        x: 0,
        opacity: 1,
        duration: 1,
        ease: 'power2.out'
      }
    );

    this.animateContent(slideElement);
  }

  animateContent(slideElement: HTMLElement) {
    const title = slideElement.querySelector('.case-title');
    const description = slideElement.querySelector('.case-description');

    gsap.set([title, description], { y: 50, opacity: 0 });

    gsap.to([title, description], {
      y: 0,
      opacity: 1,
      duration: 0.6,
      stagger: 0.2,
      ease: 'power2.out',
      delay: 0.9
    });
  }

  initScrollAnimations() {
    gsap.fromTo(".cases-title",
      { opacity: 0, scale: 0.4 },
      {
        opacity: 1,
        scale: 1,
        duration: 0.4,
        scrollTrigger: {
          trigger: ".cases-title",
          start: '0% 60%',
          toggleActions: "play none none reverse",
        }
      }
    )

    gsap.fromTo(".cases",
      { opacity: 0, y: 100 },
      {
        opacity: 1,
        y: 0,
        duration: 0.4,
        scrollTrigger: {
          trigger: ".cases",
          start: '0% 60%',
          toggleActions: "play none none reverse",
        }
      }
    )
  }
*/