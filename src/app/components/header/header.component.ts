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
  constructor() {

  }

  @HostListener('window:scroll', ['getScrollPosition()'])
  getScrollPosition() {
    this.scrollY = window.scrollY;
    if (this.firstLoad && window.scrollY >= 180) {
      this.firstLoad = false
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
}
