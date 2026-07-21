import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild, } from '@angular/core';
import { gsap } from 'gsap';
import { BlurService } from '../../_services/blur.service';
import { Case } from "../../_models/case";
import { TranslateModule } from '@ngx-translate/core';
import { GridService } from '../../_services/grid.service';
import { Slider, SliderConfig } from '../../components/slider/slider';
import { ContainsTagPipe } from '../../_services/contains-tag.pipe';
import { data, dataIOS } from './data';
import { AnalyticsService } from '../../_services/analytics.service';


@Component({
  selector: 'app-cases',
  imports: [CommonModule, Slider, TranslateModule, ContainsTagPipe],
  templateUrl: './cases.html',
  styleUrl: './cases.scss'
})
export class Cases implements AfterViewInit, OnDestroy, OnInit {
  private slideElement!: HTMLElement;
  isBlur: boolean = false;
  loading = false;
  error = '';
  bigSlider: boolean = false;
  gridSize!: number;
  showFilter: boolean = false;

  activeTags: string[] = ["Architecture", "Visualization", "Experience Design", "Video", "Branding"
  ]

  tags: string[] = ["Architecture", "Visualization", "Experience Design", "Video", "Branding"
  ]
  private isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

  @ViewChild('slide') set slide(el: ElementRef) {
    if (el) {
      this.slideElement = el.nativeElement;
    }
  }

  currentSlide: number = 0;
  cases!: Case[]
  casesData!: Case[]

  isShowFilter: boolean = false;

  sliderConfig: SliderConfig = {
    startIndex: 0,
    autoPlay: false,
    autoPlayInterval: 2000,
    showArrows: true,
    showDots: true,
    swipeThreshold: 30,
    allowSwip: true,
  };

  sliderConfigBig: SliderConfig = {
    startIndex: 2,
    autoPlay: false,
    autoPlayInterval: 4000,
    showArrows: true,
    showDots: true,
    swipeThreshold: 30,
    allowSwip: false,
  };



  constructor(private blurService: BlurService, private gridService: GridService, private analyticsService: AnalyticsService) {
    this.blurService.blurState$.subscribe(data => this.isBlur = data);
    this.blurService.slideState$.subscribe(data => {
      this.bigSlider = data != -1
      this.sliderConfigBig.startIndex = data
    });
    this.gridService.gridWidth$.subscribe(data => this.gridSize = data)
  }

  ngOnInit() {
    // Initialize with all data
    if (this.isIOS) {
      this.casesData = [...dataIOS];
    } else {
      this.casesData = [...data];
    }
    this.cases = this.casesData
  }

  ngAfterViewInit() {
    this.initSliderAnimation()
  }

  initSliderAnimation() {
    if (this.slideElement) {
      gsap.set([this.slideElement.querySelector('.case-title'),
      this.slideElement.querySelector('.case-text'),
      this.slideElement.querySelector('.case-slider')],
        { opacity: 1, x: 0 }); // Ensure initial state
    }
  }

  nextSlide() {
    if (!this.cases) return;
    this.analyticsService.trackAction('case prev')
    const oldIndex = this.currentSlide;
    this.currentSlide = (this.currentSlide + 1) % this.cases.length;
    this.animateContent(this.slideElement, 'next');
  }

  prevSlide() {
    if (!this.cases) return;
    this.analyticsService.trackAction('case next')
    const oldIndex = this.currentSlide;
    this.currentSlide = (this.currentSlide - 1 + this.cases.length) % this.cases.length;
    this.animateContent(this.slideElement, 'prev');
  }

  animateContent(slideElement: HTMLElement, direction: 'next' | 'prev' = 'next') {
    const title = slideElement.querySelector('.case-title');
    const description = slideElement.querySelector('.case-text');
    const slider = slideElement.querySelector('.case-slider');
    const tags = slideElement.querySelector('.tags');
    const youtube = slideElement.querySelector('.youtube');

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
    gsap.fromTo(tags, { opacity: 0, y: "100%" }, { opacity: 1, y: 0, duration: 0.3, delay: 0.9, ease: 'power2.out' })
    if (youtube) {
      gsap.fromTo(youtube, { opacity: 0 }, { opacity: 1, duration: 0.3, delay: 0.9, ease: 'power2.out' })
    }
  }

  @HostListener('window:resize')
  onWindowResize() {
    this.gridService.gridWidth$.subscribe(data => this.gridSize = data)
  }

  exit() {
    this.bigSlider = false
    this.blurService.setBlur(false)
  }

  openVideo(url: string): void {
    window.open(url, '_blank', 'noopener,noreferrer');
    this.analyticsService.trackAction('case youtube')
  }

  toggleTag(tag: string) {
    const tagIndex = this.activeTags.findIndex(t => t === tag);

    // Create a NEW array reference
    if (tagIndex === -1) {
      // Add tag - create new array
      this.activeTags = [...this.activeTags, tag];
    } else {
      // Remove tag - create new array
      this.activeTags = this.activeTags.filter((_, index) => index !== tagIndex);
    }
    this.cases = this.filterCases(this.activeTags);
  }

  contain(tag: string): boolean {
    return this.tags.includes(tag)
  }

  toggleFilter() {
    const width = window.innerWidth
    let filterHeight: number = 0
    if (width < 1200) {
      filterHeight = 6 * this.gridSize
    } else {
      filterHeight = 2 * this.gridSize
    }
    this.analyticsService.trackAction('filter-toggle')

    if (this.isShowFilter) {
      gsap.to(".filter-btn", { opacity: 0, delay: 0, stagger: { each: 0.05 }, overwrite: true })
      gsap.to(".filters", { display: "none", duration: 0.1, delay: 0.2, overwrite: true })
      gsap.to(".cases-filters", {
        height: this.gridSize * 0,
        width: this.gridSize * 0, // 7
        duration: 0.3,
        delay: 0.3,
        ease: "power3.inOut", overwrite: true
      })
    } else {
      gsap.to(".cases-filters", {
        height: filterHeight,
        width: "100%",
        duration: 0.3,
        ease: "power3.inOut",
        overwrite: true
      })
      gsap.to(".filters", { display: "grid", duration: 0.1, delay: 0.3, overwrite: true })
      gsap.to(".filter-btn", { opacity: 1, delay: 0.4, stagger: { each: 0.05 }, overwrite: true })
    }

    this.isShowFilter = !this.isShowFilter
  }


  filterCases(tags: string[]): Case[] {
    this.analyticsService.trackAction('filter')
    const res = this.casesData.filter(caseItem => {
      return tags.some(tag =>
        caseItem.tags.some(caseTag =>
          caseTag.toLowerCase().trim() === tag.toLowerCase().trim()
        )
      );
    });

    setTimeout(() => {
      this.currentSlide = 0;
      this.initSliderAnimation();
      //this.isFiltering = false;
    }, 0);


    return res
  }


  ngOnDestroy(): void {

  }
}
