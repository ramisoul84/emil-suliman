import { CommonModule } from '@angular/common';
import { Component, HostListener, Inject, OnInit, OnDestroy, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil, debounceTime } from 'rxjs/operators';

@Component({
  selector: 'app-header',
  imports: [CommonModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent implements OnInit, OnDestroy {
  scrollY: number = 0;
  animatedY: number = 180;
  firstLoad: boolean = true;
  sideNav: boolean = false;
  showMenu: boolean = false;

  @HostListener('window:scroll')
  onWindowScroll() {
    this.scrollY = window.scrollY;
    if (this.firstLoad && this.scrollY >= this.animatedY) {
      this.firstLoad = false;
    }
    if (this.scrollY < this.animatedY) {
      this.sideNav = false;
      this.showMenu = false;
    } else {
      this.sideNav = true;
    }
  }


  ngOnInit() {
  }

  toggleMenu(): void {
    this.showMenu = !this.showMenu;
  }

 goToSection(section: string) {
  const element = document.getElementById(section);
  if (element) {
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'start' // or 'center', 'end', 'nearest'
    });
  }
}


  ngOnDestroy() {

  }
  /*
  scrollY: number = 0;
  firstLoad: boolean = true;
  sideNav: boolean = false;
  private destroy$ = new Subject<void>();
  private scrollSubject = new Subject<void>();

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      // Handle scroll events with debouncing
      this.scrollSubject.pipe(
        debounceTime(10),
        takeUntil(this.destroy$)
      ).subscribe(() => {
        this.getScrollPosition();
      });
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  @HostListener('window:scroll')
  onWindowScroll() {
    this.scrollSubject.next();
  }

  getScrollPosition() {
    if (isPlatformBrowser(this.platformId)) {
      this.scrollY = window.scrollY;
      if (this.firstLoad && this.scrollY >= 180) {
        this.firstLoad = false;
      }
    }
  }

  toggleMenu(): void {
    this.sideNav = !this.sideNav;
    this.updateBodyScroll();
  }

  private updateBodyScroll(): void {
    if (isPlatformBrowser(this.platformId)) {
      document.body.style.overflow = this.sideNav ? 'hidden' : '';
    }
  }

  closeMenu(): void {
    this.sideNav = false;
    this.updateBodyScroll();
  }

  goTop(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  }

  @HostListener('window:keydown.escape')
  onEscapeKey(): void {
    this.closeMenu();
  }
    */
}
/*
import { CommonModule } from '@angular/common';
import { Component, HostListener } from '@angular/core';

@Component({
  selector: 'app-header',
  imports: [CommonModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent {
  scrollY: number = 0
  firstLoad: boolean = true;
  sideNav: boolean = false;

@HostListener('window:scroll')
getScrollPosition() {
    this.scrollY = window.scrollY;
    if (this.firstLoad && window.scrollY >= 180) {
        this.firstLoad = false;
    }
}

  toggleMenu(): void {
    this.sideNav = !this.sideNav
    this.blurSections()
  }

  blurSections(): void {
    const sections = document.querySelectorAll("section");
    if (this.sideNav) {
      sections.forEach((e) => (e.style.filter = "blur(0.5rem)"))
    } else {
      sections.forEach((e) => (e.style.filter = "blur(0rem)"))
    }
  }

  goTop(): void {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }
}
*/