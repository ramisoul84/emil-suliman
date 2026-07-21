import { AfterViewInit, Component, ElementRef, inject, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { distinctUntilChanged, Subject, Subscription, takeUntil } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { data, Item } from './data';
import { ScrollService } from '../../_services/scrol.service';
import { CommonModule } from '@angular/common';
import { BlurService } from '../../_services/blur.service';
import { AnalyticsService } from '../../_services/analytics.service';


@Component({
  selector: 'app-about',
  imports: [TranslateModule, CommonModule],
  templateUrl: './about.html',
  styleUrl: './about.scss',
})

export class About implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('emilPhoto') emilPhoto!: ElementRef;
  @ViewChild('emilVideo') emilVideo!: ElementRef;

  private subscription!: Subscription;
  private scrollTriggers: ScrollTrigger[] = [];

  isIOS: boolean = /iPad|iPhone|iPod/.test(navigator.userAgent);
  isBlur: boolean = false;
  isAnimating: boolean = false;

  indices: number[] = [0, 1, 2]
  selectedIndex: number = 0

  private readonly ASSETS = {
    emilImage: 'assets/images/emil.png',
    emilVideo: 'assets/videos/emil.webm',
    houseGif: 'assets/images/house.gif',
    cameraGif: 'assets/images/camera.gif',
    duckGif: 'assets/images/duck.gif'
  };

  private titles: string[] = ["architecture", "storytelling", "personal"]

  aboutItems = data
  hasPlayed: boolean = false
  isVideoLoaded: boolean = false;
  scrollService = inject(ScrollService)
  private destroy$ = new Subject<void>();

  constructor(private blurService: BlurService, private analyticsService: AnalyticsService) {
    this.blurService.blurState$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(data => this.isBlur = data);
  }

  ngOnInit(): void {
    this.subscription = this.scrollService.scroll$
      .pipe(
        distinctUntilChanged((prev, curr) => prev === curr)
      )
      .subscribe(() => {
        this.checkIfInViewport();
      });
  }

  ngAfterViewInit(): void {
    this.loadVideo()
  }

  loadVideo(): void {
    if (!this.isIOS && this.emilVideo?.nativeElement) {
      const video = this.emilVideo.nativeElement;

      video.muted = true;
      video.playsInline = true;

      const loadHandler = () => {
        this.isVideoLoaded = true;
        video.removeEventListener('canplaythrough', loadHandler);
        video.removeEventListener('error', errorHandler);
      };

      const errorHandler = () => {
        this.isVideoLoaded = false;
        video.removeEventListener('canplaythrough', loadHandler);
        video.removeEventListener('error', errorHandler);
      };

      video.addEventListener('canplaythrough', loadHandler);
      video.addEventListener('error', errorHandler);

      if (video.readyState === 0) {
        video.load();
      }
    }
  }

  get activeItem(): Item {
    return this.aboutItems[this.indices[0]];
  }

  get smallItems(): Item[] {
    return [this.aboutItems[this.indices[1]], this.aboutItems[this.indices[2]]];
  }

  private checkIfInViewport(): void {
    if (!this.emilPhoto?.nativeElement || this.hasPlayed) return;
    const element = this.emilPhoto?.nativeElement
    const isInView = this.scrollService.isElementInViewport(element, 100);

    if (isInView) {
      this.playVideo();
      this.hasPlayed = true
    }
  }

  selectActive(smallIndex: number): void {
    if (this.isAnimating) return;
    this.analyticsService.trackAction(this.titles[this.indices[smallIndex + 1]])
    const smallPositionInIndices = smallIndex + 1;
    const temp = this.indices[0];
    this.indices[0] = this.indices[smallPositionInIndices];
    this.indices[smallPositionInIndices] = temp;
    this.playVideo()
    this.animateContent()
  }

  select(index: number): void {
    if (this.isAnimating) return;
    this.selectedIndex = index
    this.playVideo()
    this.animateContent()
    this.analyticsService.trackAction(this.titles[index])
  }

  playVideo(): void {
    const video = this.emilVideo?.nativeElement
    if (!this.isIOS && this.isVideoLoaded && video) {
      video.play()
    }
  }

  initAnimation(): void {
    const title = gsap.from('.about-title', {
      opacity: 0,
      y: 20,
      duration: 0.4,
      scrollTrigger: {
        trigger: '#about',
        start: 'top 60%', // When top of element hits 80% from top of viewport
        end: 'bottom 20%',
        toggleActions: 'play none none', // play on enter, reverse on leave
      }
    });

    const img = gsap.from('.about-emil-img', {
      opacity: 0,
      y: 20,
      duration: 0.4,
      delay: 0.2,
      scrollTrigger: {
        trigger: '.about-emil-img',
        start: 'top 60%',
        end: 'bottom 20%',
        toggleActions: 'play none none'
      }
    });

    const box = gsap.from('.about-right-desktop', {
      opacity: 0,
      y: 20,
      duration: 0.4,
      delay: 0.4,
      scrollTrigger: {
        trigger: '.about-right-desktop',
        start: 'top 60%',
        end: 'bottom 20%',
        toggleActions: 'play none none'
      }
    });

    const imgs = gsap.from('.img-wrapper-desktop', {
      opacity: 0,
      x: 20,
      duration: 0.2,
      delay: 0.6,
      stagger: 0.1,
      scrollTrigger: {
        trigger: '.img-wrapper-desktop',
        start: 'top 60%',
        end: 'bottom 20%',
        toggleActions: 'play none none'
      }
    });

    const infoTitle = gsap.from('.about-info-title', {
      opacity: 0,
      y: 20,
      duration: 0.2,
      delay: 1,
      scrollTrigger: {
        trigger: '#about',
        start: 'top 50%',
        end: 'bottom 20%',
        toggleActions: 'play none none'
      }
    });

    const infoText = gsap.from('.about-info-text', {
      opacity: 0,
      y: 20,
      duration: 0.2,
      delay: 1.2,
      scrollTrigger: {
        trigger: '#about',
        start: 'top 50%',
        end: 'bottom 20%',
        toggleActions: 'play none none'
      }
    });

    this.scrollTriggers.push(
      title.scrollTrigger as ScrollTrigger,
      img.scrollTrigger as ScrollTrigger,
      box.scrollTrigger as ScrollTrigger,
      imgs.scrollTrigger as ScrollTrigger,
      infoTitle.scrollTrigger as ScrollTrigger,
      infoText.scrollTrigger as ScrollTrigger,
    );
  }

  animateContent(): void {
    this.isAnimating = true
    gsap.fromTo(".about-info-title", { opacity: 0, y: 10 }, {
      opacity: 1, y: 0, duration: 0.2, delay: 0, ease: "power3.inOut", overwrite: true,
    });
    gsap.fromTo(".about-info-text", { opacity: 0, y: 10 }, {
      opacity: 1, y: 0, duration: 0.4, delay: 0.2, ease: "power3.inOut", overwrite: true, onComplete: () => {
        this.isAnimating = false;
      }
    });
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }

    this.scrollTriggers.forEach(trigger => {
      if (trigger) {
        trigger.kill();
      }
    });
    ScrollTrigger.getAll().forEach(trigger => trigger.kill());
  }
}