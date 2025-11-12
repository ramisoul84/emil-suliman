import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

@Component({
  selector: 'app-solidarity',
  imports: [CommonModule],
  templateUrl: './solidarity.component.html',
  styleUrl: './solidarity.component.scss'
})
export class SolidarityComponent {
  links = [
    { logo: "assets/logos/sea-watch.png", link: "https://www.ramisuliman.ru/" },
    { logo: "assets/logos/pro.png", link: "ramisuliman.ru" },
    { logo: "assets/logos/queer.png", link: "ramisuliman.ru" },
    { logo: "assets/logos/fridays.png", link: "ramisuliman.ru" },
  ]

  constructor(private sanitizer: DomSanitizer) { }

  openLink(link: string): void {
    if (!link) return;

    try {
      // Sanitize the URL for security
      const safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(link);

      window.open(link, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('Invalid or unsafe URL:', link);
    }
  }
}
