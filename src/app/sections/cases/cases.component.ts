import { CommonModule } from '@angular/common';
import { Component, ElementRef, ViewChild } from '@angular/core';
import { gsap } from 'gsap';
import { data } from './data';
import { SliderComponent, SliderConfig } from '../../components/slider/slider.component';

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

    gsap.set([slider], {
      x: xFrom,
      opacity: 0,
    });
    gsap.to(slider, {
      x: 0,
      opacity: 1,
      duration: 0.4,
      ease: 'power2.out'
    })
    gsap.fromTo(title, { opacity: 0, y: "100%" }, { opacity: 1, y: 0, duration: 0.3, delay: 0.4, ease: 'power2.out' })
    gsap.fromTo(description, { opacity: 0, y: "100%" }, { opacity: 1, y: 0, duration: 0.3, delay: 0.7, ease: 'power2.out' })
  }
}
