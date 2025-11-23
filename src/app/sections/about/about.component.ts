import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, inject, OnInit, ViewChild } from '@angular/core';
import { data } from './data';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { GoogleAnalyticsService } from 'ngx-google-analytics';

@Component({
  selector: 'app-about',
  imports: [CommonModule],
  templateUrl: './about.component.html',
  styleUrl: './about.component.scss'
})
export class AboutComponent implements AfterViewInit {
  @ViewChild('emilVideo', { static: true }) emilVideo!: ElementRef<HTMLVideoElement>;
  @ViewChild('emilPhoto', { static: true }) emilPhoto!: ElementRef<HTMLImageElement>;
  @ViewChild('iconVideo', { static: true }) iconVideo!: ElementRef<HTMLVideoElement>;

  selectedField: number = 0;
  firstLoad: boolean = true;
  videoTop: number = 0;
  about = data;

  private gaService = inject(GoogleAnalyticsService);

  constructor() {
    gsap.registerPlugin(ScrollTrigger);
  }

  ngAfterViewInit(): void {
    this.loadVideo()
    this.calculatePosition();
    window.addEventListener('scroll', this.handleScroll.bind(this), { passive: true });
    window.addEventListener('resize', this.calculatePosition.bind(this));
  }

  private calculatePosition(): void {
    if (this.emilPhoto?.nativeElement) {
      const rect = this.emilPhoto.nativeElement.getBoundingClientRect();
      this.videoTop = rect.top - 120;
    }
  }


  handleScroll() {
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;
    if (scrollY > this.videoTop) {
      if (this.firstLoad) {
        this.emilVideo.nativeElement.play();
        this.firstLoad = false
      }

    }
  }

  loadVideo(): void {
    if (!this.emilVideo || !this.iconVideo) return
    this.emilVideo.nativeElement.preload = 'auto'
    this.emilVideo.nativeElement.muted = true
    this.emilVideo.nativeElement.playsInline = true
    this.emilVideo.nativeElement.load()

    this.iconVideo.nativeElement.preload = 'auto'
    this.iconVideo.nativeElement.muted = true
    this.iconVideo.nativeElement.playsInline = true
    this.iconVideo.nativeElement.load()
  }

  onFieldChange(newField: number, field: string): void {
    this.selectedField = newField;
    this.iconVideo.nativeElement.load()
    this.animateContent()
    this.gaService.event('about_click', field, 'engagement');
  }

  animateContent() {
    gsap.fromTo('.video-wrapper',
      { opacity: 0, y: -20 },
      {
        y: 0,
        opacity: 1,
        duration: 0.8,
      }
    );

    gsap.fromTo('.about-info-text',
      { opacity: 0, y: 30 },
      {
        opacity: 1,
        y: 0,
        duration: 0.6,
        delay: 0.4
      }
    );
  }
  /*
    playVideo() {
      gsap.fromTo('.about-video',
        { opacity: 0 },
        {
          opacity: 1,
          duration: 0.4,
          scrollTrigger: {
            trigger: '.about-video',
            start: '0 80%',
            toggleActions: "play none none none",
  
            onEnter: () => {
              if (this.firstLoad) {
                this.emilVideo.nativeElement.play(),
                  this.firstLoad = false
              }
            }
          }
        }
      );
    }
  */
  ngOnDestroy(): void {
    window.removeEventListener('scroll', this.handleScroll.bind(this));
    window.removeEventListener('resize', this.calculatePosition.bind(this));
  }

}
