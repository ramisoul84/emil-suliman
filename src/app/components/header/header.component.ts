import { Component, HostListener, inject, OnDestroy, OnInit } from '@angular/core';
import { distinctUntilChanged, Subscription } from 'rxjs';
import { gsap } from 'gsap';
import { GridService } from '../../services/grid.service';
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
  private compactThreshold: number = 40;
  private isCompact: boolean = false;
  private isFirstLoad: boolean = true;
  private isAnimating: boolean = false;
  showMenu: boolean = false;
  private gridWidth: number = 20;
  private subscriptions = new Subscription();

  private gaService = inject(GoogleAnalyticsService);

  constructor(
    private gridService: GridService,
    private blurService: BlurService
  ) { }

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
    window.addEventListener('scroll', this.handleScroll.bind(this), { passive: true });
  }
  private latestScrollRequest: number = 0;

  private handleScroll(): void {
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;
    const toCompact = scrollY > this.compactThreshold;

    // Store the latest scroll position
    this.latestScrollRequest = scrollY;

    // If animating, wait for completion then process latest request
    if (this.isAnimating) {
      return; // Let the current animation finish, then check latest state
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
    gsap.fromTo("nav p", { opacity: 1 }, { opacity: 0, duration: 0.4, delay: 0.2, ease: "power2.inOut", overwrite: true })
    gsap.fromTo(".line3", { width: "100%" }, { width: 3 * this.gridWidth, duration: 0.4, delay: 0.6, ease: "power3.inOut", overwrite: true })
    gsap.fromTo(".line2", { width: "100%" }, { width: 3 * this.gridWidth, duration: 0.4, delay: 0.6, ease: "power3.inOut", overwrite: true })
    gsap.fromTo(".line1", { width: "100%", height: this.gridWidth }, {
      width: 3 * this.gridWidth, height: 3 * this.gridWidth, duration: 0.4, delay: 0.6, ease: "power3.inOut", overwrite: true
    })
    gsap.fromTo(".letter:not(.e, .s)",
      { display: "block" },
      {
        display: "none",
        duration: 0.2,
        delay: 0.2,
        stagger: { each: 0.05, from: "end" },
        ease: "power2.inOut", overwrite: true
      });

    gsap.fromTo(".letter.e",
      {
        scale: 1,
        y: 0,
        x: 0,
      },
      {
        scale: 2.2,
        y: -0.2 * this.gridWidth,
        x: -0.44 * this.gridWidth,
        duration: 0.2,
        delay: 1,
        ease: "power2.inOut",
        overwrite: true
      });

    gsap.fromTo(".letter.s",
      {
        scale: 1,
        y: 0,
        x: 0,
      },
      {
        scale: 2.2,
        y: -0.2 * this.gridWidth,
        x: 0.44 * this.gridWidth,
        duration: 0.2,
        delay: 1,
        ease: "power2.inOut",
        overwrite: true
      });

    gsap.fromTo(".dot",
      { opacity: 0 },
      {
        opacity: 1,
        duration: 0.6,
        delay: 1.2,
        ease: "power2.inOut", overwrite: true
      });

    gsap.to(".dot", {
      keyframes: {
        "0%": { opacity: 1 },
        "15%": { opacity: 1 },
        "20%": { opacity: 0 },
        "80%": { opacity: 0 },
        "85%": { opacity: 1 },
        "100%": { opacity: 1 }
      },
      delay:1.8,
      duration: 0.15, // total animation duration
    });

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

    gsap.fromTo(".dot", { opacity: 1 }, {
      opacity: 0,
      duration: 0,
      overwrite: true
    });
    gsap.fromTo(".letter.e", {
      scale: 2.8,
      y: -0.2 * this.gridWidth,
      x: -0.44 * this.gridWidth,
    }, {
      scale: 1,
      y: 0,
      x: 0,
      duration: 0.2,
      ease: "power2.inOut", overwrite: true
    });

    gsap.fromTo(".letter.s", {
      scale: 2.8,
      y: -0.2 * this.gridWidth,
      x: 0.44 * this.gridWidth,
    },
      {
        scale: 1,
        y: 0,
        x: 0,
        duration: 0.2,
        ease: "power2.inOut", overwrite: true

      });

    gsap.fromTo(".letter:not(.e, .s)", { display: "none" }, {
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
    gsap.fromTo("nav p", { opacity: 0 }, { opacity: 1, duration: 0.4, delay: 0.4, ease: "power2.inOut", overwrite: true })
    gsap.fromTo(".line4", { height: 0 }, { height: this.gridWidth, duration: 0.4, delay: 0.4, ease: "power2.inOut", overwrite: true })
    gsap.fromTo(".line5", { height: 0 }, { height: this.gridWidth, duration: 0.4, delay: 0.5, ease: "power2.inOut", overwrite: true })
    gsap.fromTo(".line6", { height: 0 }, {
      height: this.gridWidth, duration: 0.4, delay: 0.6, ease: "power2.inOut", overwrite: true
    })
  }

  @HostListener('window:resize')
  onWindowResize() {
    this.update()
  }

  update(): void {
    if (this.isAnimating) return;

    if (this.isCompact) {
      gsap.set(" .line1", { height: 3 * this.gridWidth, width: 3 * this.gridWidth })
      gsap.set(" .line2, .line3", { height: this.gridWidth, width: 3 * this.gridWidth })
      gsap.set(".letter.e", {
        y: -0.1 * this.gridWidth,
        x: -0.5 * this.gridWidth,
      });
      gsap.set(".letter.s", {
        y: -0.1 * this.gridWidth,
        x: 0.3 * this.gridWidth,
      });
    } else if (!this.isCompact) {
      gsap.set(" .line", { height: this.gridWidth })
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

  ngOnDestroy() {
    window.removeEventListener('scroll', this.handleScroll.bind(this));
    this.subscriptions.unsubscribe();
  }
}
