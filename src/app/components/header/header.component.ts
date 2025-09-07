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
    const list = document.querySelector(".sideNav");
    list!.classList.add("showSide");
  }
}
