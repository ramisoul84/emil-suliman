import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { BlurService } from '../../_services/blur.service';
import { AnalyticsService } from '../../_services/analytics.service';

@Component({
  selector: 'app-solidarity',
  imports: [CommonModule],
  templateUrl: './solidarity.html',
  styleUrl: './solidarity.scss'
})
export class Solidarity {
  isBlur: boolean = false;
  links = [
    { logo: "assets/logos/sea-watch.png", link: "https://sea-watch.org/en/donate/", organization: 'sea-watch' },
    { logo: "assets/logos/pro.png", link: "https://www.proasyl.de/spenden/", organization: 'proasyl' },
    { logo: "assets/logos/queer.png", link: "https://queer-refugees.de/en/", organization: 'queer-refugees' },
    { logo: "assets/logos/fridays.png", link: "https://fridaysforfuture.de/spenden/", organization: 'fridays-for-future' },
  ]

  constructor(private sanitizer: DomSanitizer, private blurService: BlurService, private analyticsService: AnalyticsService) {
    this.blurService.blurState$.subscribe(data => this.isBlur = data);
  }

  openLink(link: string, organization: string): void {
    this.analyticsService.trackAction(organization)
    if (!link) return;

    try {
      const safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(link);
      window.open(link, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('Invalid or unsafe URL:', link);
    }
  }
}
