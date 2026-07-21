import { Component, HostListener, inject, OnDestroy, OnInit } from '@angular/core';
import { distinctUntilChanged, Subscription } from 'rxjs';

import { gsap } from 'gsap';
import { GridService } from '../../_services/grid.service';
import { TranslateModule } from '@ngx-translate/core';
import { BlurService } from '../../_services/blur.service';
import { LanguageService } from '../../_services/language.service';
import { CommonModule } from '@angular/common';

type Language = 'en' | 'de';

@Component({
  selector: 'app-header',
  imports: [TranslateModule, CommonModule],
  templateUrl: './header.html',
  styleUrl: './header.scss'
})
export class Header implements OnInit, OnDestroy {
  private compactThreshold: number = 400;
  private isCompact: boolean = false;
  private isFirstLoad: boolean = true;
  private isAnimating: boolean = false;
  showMenu: boolean = false;
  private gridWidth: number = 20;
  private subscriptions = new Subscription();
  private scrollListener: any;

  isEnglish: boolean = true

  constructor(
    private gridService: GridService,
    private blurService: BlurService,
    public languageService: LanguageService
  ) {
    this.isEnglish = this.languageService.isEnglish();
  }

  ngOnInit() {
    this.isCompact = false;
    this.isAnimating = false;
    this.subscriptions.add(
      this.gridService.gridWidth$.pipe(
        distinctUntilChanged()
      ).subscribe(gridWidth => {
        this.gridWidth = gridWidth;
        if (this.isFirstLoad) {
          this.headerLoad()
        }
      })
    );
    this.scrollListener = this.handleScroll.bind(this);
    window.addEventListener('scroll', this.scrollListener, { passive: true });

  }
  private latestScrollRequest: number = 0;

  private handleScroll(): void {
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;
    const toCompact = scrollY > this.compactThreshold;

    this.latestScrollRequest = scrollY;

    if (this.isAnimating) {
      return;
    }

    this.processScrollState(toCompact);
  }

  // Call this at the end of your animations
  private checkPendingScroll(): void {
    if (!this.isAnimating) {
      // Use the stored latest scroll position instead of current scroll
      const toCompact = this.latestScrollRequest > this.compactThreshold;

      // Only change state if different from current
      if ((toCompact && !this.isCompact) || (!toCompact && this.isCompact)) {
        this.processScrollState(toCompact);
      }
    }
  }

  private processScrollState(toCompact: boolean): void {
    if (toCompact && !this.isCompact) {
      this.headerCompact();
    } else if (!toCompact && this.isCompact) {
      this.headerExtended();
      this.sideNavHide();
      this.showMenu = false;
      this.blurService.setBlur(false);
      this.blurService.setSlide(-1)
    }
  }


  private headerLoad(): void {
    this.isAnimating = true
    setTimeout(() => {
      this.isAnimating = false;
      this.isFirstLoad = false;
    }, 1300)
    gsap.fromTo(".line", { height: 0 },
      {
        height: this.gridWidth, duration: 0.6, stagger: 0.1, ease: "power2.inOut"
      })
    gsap.fromTo("nav p", { opacity: 0 }, { opacity: 1, duration: 0.4, delay: 0.4, ease: "power2.inOut" })
    gsap.fromTo(".logo", { opacity: 0 },
      {
        opacity: 1, duration: 0.4, delay: 0.4, ease: "power2.inOut"
      })
  }



  private headerCompact(): void {
    gsap.killTweensOf("*");
    this.isAnimating = true;

    setTimeout(() => {
      this.isCompact = true;
      this.isAnimating = false;
      this.checkPendingScroll();
    }, 2200)

    gsap.fromTo(".line6", { height: this.gridWidth }, { height: 0, duration: 0.4, ease: "power2.inOut", overwrite: true })
    gsap.fromTo(".line5", { height: this.gridWidth }, { height: 0, duration: 0.4, delay: 0.1, ease: "power2.inOut", overwrite: true },)
    gsap.fromTo(".line4", { height: this.gridWidth }, { height: 0, duration: 0.4, delay: 0.2, ease: "power2.inOut", overwrite: true },)
    gsap.fromTo("nav p", { opacity: 1 }, { opacity: 0, display: "none", duration: 0.4, delay: 0.2, ease: "power2.inOut", overwrite: true })
    gsap.fromTo(".line3", { width: "100%" }, { width: 3 * this.gridWidth, duration: 0.4, delay: 0.6, ease: "power3.inOut", overwrite: true })
    gsap.fromTo(".line2", { width: "100%" }, { width: 3 * this.gridWidth, duration: 0.4, delay: 0.6, ease: "power3.inOut", overwrite: true })
    gsap.fromTo(".line1", { width: "100%", height: this.gridWidth }, {
      width: 3 * this.gridWidth, height: 3 * this.gridWidth, duration: 0.4, delay: 0.6, ease: "power3.inOut", overwrite: true
    })
    gsap.fromTo(".letter",
      { display: "block" },
      {
        display: "none",
        duration: 0.2,
        delay: 0.2,
        stagger: { each: 0.05, from: "end" },
        ease: "power2.inOut", overwrite: true
      });
    gsap.fromTo(".logo-img", { opacity: 0 }, {
      opacity: 1, duration: 0.4, delay: 1.2, ease: "power3.inOut", overwrite: true, keyframes: {
        "0%": { opacity: 1 },
        "15%": { opacity: 0 },
        "40%": { opacity: 1 },
        "80%": { opacity: 0 },
        "100%": { opacity: 1 }
      },
    })
    gsap.fromTo(".hamburger-menu", { zIndex: 1, opacity: 0 }, { zIndex: 11, opacity: 1, duration: 0.4, delay: 1.2, ease: "power3.inOut", overwrite: true })
  }

  private headerExtended(): void {
    this.isAnimating = true;
    gsap.killTweensOf("*");

    setTimeout(() => {
      this.isCompact = false;
      this.isAnimating = false;
      this.checkPendingScroll();
    }, 1400)

    gsap.fromTo(".logo-img", { opacity: 1 }, { opacity: 0 })
    gsap.fromTo(".letter", { display: "none" }, {
      display: "block",
      duration: 0.4,
      delay: 0.2,
      stagger: { each: 0.05 },
      ease: "power2.inOut", overwrite: true
    });

    gsap.fromTo(".hamburger-menu", { zIndex: 11, opacity: 1 }, { zIndex: 1, opacity: 0, duration: 0.2, ease: "power3.inOut", overwrite: true })
    gsap.fromTo(".line1", { width: 3 * this.gridWidth, height: 3 * this.gridWidth }, { width: "100%", height: this.gridWidth, duration: 0.4, ease: "power3.inOut", overwrite: true })
    gsap.fromTo(".line2", { width: 3 * this.gridWidth }, { width: "100%", duration: 0.4, ease: "power3.inOut", overwrite: true })
    gsap.fromTo(".line3", { width: 3 * this.gridWidth }, { width: "100%", duration: 0.4, ease: "power3.inOut", overwrite: true })
    gsap.fromTo("nav p", { opacity: 0, display: "none" }, { opacity: 1, display: "flex", duration: 0.4, delay: 0.4, ease: "power2.inOut", overwrite: true })
    gsap.fromTo(".line4", { height: 0 }, { height: this.gridWidth, duration: 0.4, delay: 0.4, ease: "power2.inOut", overwrite: true })
    gsap.fromTo(".line5", { height: 0 }, { height: this.gridWidth, duration: 0.4, delay: 0.5, ease: "power2.inOut", overwrite: true })
    gsap.fromTo(".line6", { height: 0 }, {
      height: this.gridWidth, duration: 0.4, delay: 0.6, ease: "power2.inOut", overwrite: true
    })
  }

  @HostListener('window:resize')
  onWindowResize() {
    this.gridService.gridWidth$.subscribe(width => this.update(width))
  }

  update(width: number): void {
    if (this.isAnimating) return;

    if (this.isCompact) {
      gsap.set(" .line1", { height: 3 * width, width: 3 * width })
      gsap.set(" .line2, .line3", { height: width, width: 3 * width })
    } else if (!this.isCompact) {
      gsap.set(" .line", { height: width })
    }

  }

  goToSection(section: string) {
    try {
      const element = document.getElementById(section);
      //this.gaService.event('section_click', section, 'engagement');

      if (element) {
        this.blurService.setBlur(false);
        this.showMenu = false;
        this.sideNavHide();

        setTimeout(() => {
          // Check if element still exists and is in DOM
          if (document.contains(element)) {
            element.scrollIntoView({
              behavior: 'smooth',
              block: 'start'
            });
          }
        }, 300);
      } else {
        console.warn(`Section '${section}' not found`);
      }
    } catch (error) {
      console.error('Error navigating to section:', error);
    }
  }

  toggleMenu(): void {
    //this.showMenu = !this.showMenu;
    if (!this.showMenu) {
      this.sideNavShow();
      this.showMenu = true
      setTimeout(() => {
        const firstMenuItem = document.querySelector('.side-nav p');
        (firstMenuItem as HTMLElement)?.focus();
      }, 400);
    } else {
      this.sideNavHide()
      this.showMenu = false
    }

    this.blurService.setBlur(this.showMenu)
    this.blurService.setSlide(-1)
  }

  sideNavShow(): void {
    gsap.fromTo(".side-nav",
      {
        x: 0,
        scale: 0,
        opacity: 0,
      },
      {
        scale: 1,
        opacity: 1,
        transformOrigin: "100% 0%",
        duration: 0.4,
        ease: "power3.out"
      }
    );
  }

  sideNavHide(): void {
    const tl = gsap.timeline();
    tl.fromTo(".side-nav",
      {
        x: 0,
        opacity: 1,
      },
      {
        x: "-100%",
        opacity: 0,
        duration: 0.4,
        ease: "power3.out"
      }
    );
    tl.to(".side-nav",
      {
        x: 0,
        scale: 0,
        opacity: 0,
        duration: 0,
      },
    );
  }

  toggleLanguage(): void {
    this.isEnglish = !this.isEnglish;
    this.languageService.toggleLanguage();
    this.blurService.setBlur(false);
    this.showMenu = false;
    this.sideNavHide();
  }



  ngOnDestroy() {
    if (this.scrollListener) {
      window.removeEventListener('scroll', this.scrollListener);
    }
    this.subscriptions.unsubscribe();
    gsap.killTweensOf("*");
  }
}
