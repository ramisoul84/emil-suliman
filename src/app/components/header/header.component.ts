import { Component, HostListener, inject, OnDestroy, OnInit } from '@angular/core';
import { distinctUntilChanged, Subscription } from 'rxjs';
import { gsap } from 'gsap';
import { GridService } from '../../services/grid.service';
import { ScrollService } from '../../services/scroll.service';
import { CommonModule } from '@angular/common';
import { BlurService } from '../../services/blur.service';
import { GoogleAnalyticsService } from 'ngx-google-analytics';

@Component({
  selector: 'app-header',
  imports: [CommonModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent implements OnInit, OnDestroy {
  private isCompact: boolean = false;
  private isAnimating: boolean = true;
  private isFirstLoad: boolean = true;
  showMenu: boolean = false;
  scrollY: number = 0;
  private gridWidth: number = 20;
  private subscriptions = new Subscription();

  private gaService = inject(GoogleAnalyticsService);

  constructor(
    private gridService: GridService,
    private scrollService: ScrollService,
    private blurService: BlurService
  ) { }

  ngOnInit() {
    console.log("ngOnInit")
    window.scrollTo(0, 0);
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

    this.subscriptions.add(
      this.scrollService.scrollY$.subscribe(
        (scrollY: number) => {
          this.scrollY = scrollY
          this.handleScroll(scrollY);
        }
      )
    );
  }

  private handleScroll(scrollY: number): void {
    const toCompact = scrollY > 120;
    if (toCompact && !this.isCompact && !this.isAnimating) {
      this.headerCompact()
    } else if (!toCompact && this.isCompact && !this.isAnimating) {
      this.sideNavHide()
      this.headerExtended()
      this.showMenu = false
      this.blurService.setBlur(false);

    }
  }

  private headerLoad(): void {
    console.log("load")
    gsap.to(".line",
      {
        height: this.gridWidth, duration: 0.6, stagger: 0.08, ease: "power2.inOut"
      })
    gsap.to("nav p", { opacity: 1, duration: 0.6, delay: 0.6 })
    gsap.to(".logo", {
      opacity: 1, duration: 0.4, delay: 0.6, onComplete: () => {
        this.isAnimating = false;
        this.isFirstLoad = false;
      }
    })
  }

  private headerCompact(): void {
    console.log("compact")
    this.isAnimating = true;
    gsap.to(".line6", { height: 0, duration: 0.6, ease: "power2.inOut" })
    gsap.to(".line5", { height: 0, duration: 0.6, delay: 0.1, ease: "power2.inOut" })
    gsap.to(".line4", { height: 0, duration: 0.6, delay: 0.2, ease: "power2.inOut" })
    gsap.to("nav p", { opacity: 0, duration: 0.6, delay: 0.2, ease: "power2.inOut" })
    gsap.to(".line3", { width: 3 * this.gridWidth, duration: 0.6, delay: 0.8, ease: "power3.inOut" })
    gsap.to(".line2", { width: 3 * this.gridWidth, duration: 0.6, delay: 0.8, ease: "power3.inOut" })
    gsap.to(".line1", {
      width: 3 * this.gridWidth, height: 3 * this.gridWidth, duration: 0.6, delay: 0.8, ease: "power3.inOut"
    })
    gsap.to(".letter:not(.e, .s)", {
      display: "none",
      duration: 0.4,
      delay: 0.3,
      stagger: { each: 0.05, from: "end" },
      ease: "power2.inOut"
    });

    gsap.to(".letter.e", {
      scale: 2,
      y: -0.1 * this.gridWidth,
      x: -0.5 * this.gridWidth,
      duration: 0.2,
      delay: 1,
      ease: "power2.inOut",

    });

    gsap.to(".letter.s", {
      scale: 2,
      y: -0.1 * this.gridWidth,
      x: 0.3 * this.gridWidth,
      duration: 0.2,
      delay: 1,
      ease: "power2.inOut",

    });

    gsap.to(".dot",
      {
        scale: 1,
        opacity: 1,
        duration: 1,
        delay: 1.6,
        ease: "power2.inOut",
        onComplete: () => {
          this.isCompact = true;
          this.isAnimating = false;
          if (this.scrollY <= 120) {
            this.headerExtended()
          }
        }
      });

    gsap.to(".hamburger-menu", { zIndex: 11, opacity: 1, duration: 0.4, delay: 1.2, ease: "power3.inOut" })
  }

  private headerExtended(): void {
    console.log("extended")
    this.isAnimating = true;
    gsap.to(".hamburger-menu", { zIndex: 1, opacity: 0, duration: 0.2, ease: "power3.inOut" })
    gsap.to(".line1", { width: "100%", height: this.gridWidth, duration: 0.6, ease: "power3.inOut" })
    gsap.to(".line2", { width: "100%", duration: 0.6, ease: "power3.inOut" })
    gsap.to(".line3", { width: "100%", duration: 0.6, ease: "power3.inOut" })
    gsap.to("nav p", { opacity: 1, duration: 0.6, delay: 0.6, ease: "power2.inOut" })
    gsap.to(".line4", { height: this.gridWidth, duration: 0.6, delay: 0.4, ease: "power2.inOut" })
    gsap.to(".line5", { height: this.gridWidth, duration: 0.6, delay: 0.5, ease: "power2.inOut" })
    gsap.to(".line6", {
      height: this.gridWidth, duration: 0.6, delay: 0.6, ease: "power2.inOut", onComplete: () => {
        this.isCompact = false;
        this.isAnimating = false;
        if (this.scrollY > 120) {
          this.headerCompact()
        }
      }
    })

    gsap.to(".dot", {
      opacity: 0,
      scale: 8,
      duration: 0,

    });

    gsap.to(".letter.e", {
      scale: 1,
      y: 0,
      x: 0,
      duration: 0.2,
      ease: "power2.inOut",

    });

    gsap.to(".letter.s", {
      scale: 1,
      y: 0,
      x: 0,
      duration: 0.2,
      ease: "power2.inOut",

    });

    gsap.to(".letter:not(.e, .s)", {
      display: "block",
      duration: 0.4,
      delay: 0.2,
      stagger: { each: 0.05 },
      ease: "power2.inOut",

    });
  }

  @HostListener('window:resize')
  onWindowResize() {
    this.update()
  }

  update(): void {
    if (this.isCompact) {
      gsap.to(" .line1", { height: 3 * this.gridWidth, width: 3 * this.gridWidth })
      gsap.to(" .line2, .line3", { height: this.gridWidth, width: 3 * this.gridWidth })
      gsap.to(".letter.e", {
        y: -0.1 * this.gridWidth,
        x: -0.5 * this.gridWidth,
      });
      gsap.to(".letter.s", {
        y: -0.1 * this.gridWidth,
        x: 0.3 * this.gridWidth,
      });
    } else if (!this.isCompact) {
      gsap.to(" .line", { height: this.gridWidth })
    }
  }


  goToSection(section: string) {
    try {
      const element = document.getElementById(section);
      this.gaService.event('section_click', section, 'engagement');

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
    this.showMenu = !this.showMenu;
    if (this.showMenu) {
      this.sideNavShow()
      setTimeout(() => {
        const firstMenuItem = document.querySelector('.side-nav p');
        (firstMenuItem as HTMLElement)?.focus();
      }, 400);
    } else {
      this.sideNavHide()
    }

    this.blurService.setBlur(this.showMenu)
  }

  sideNavShow(): void {
    gsap.fromTo(".side-nav",
      {
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

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }
}