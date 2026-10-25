import { FadeIn } from '../../_directives/fade-in.directive';
import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { BlurService } from '../../_services/blur.service';
import { AnalyticsService } from '../../_services/analytics.service';

@Component({
  selector: 'app-solidarity',
  imports: [CommonModule, FadeIn],
  templateUrl: './solidarity.html',
  styleUrl: './solidarity.scss'
})
export class Solidarity {
  isBlur: boolean = false;
  links = [
    { logo: "assets/logos/sea-watch.webp", link: "https://sea-watch.org/en/donate/", organization: 'sea-watch' },
    { logo: "assets/logos/pro.webp", link: "https://www.proasyl.de/spenden/", organization: 'proasyl' },
    { logo: "assets/logos/queer.webp", link: "https://queer-refugees.de/en/", organization: 'queer-refugees' },
    { logo: "assets/logos/fridays.webp", link: "https://fridaysforfuture.de/spenden/", organization: 'fridays-for-future' },
  ]

  constructor(private blurService: BlurService, private analyticsService: AnalyticsService) {
    this.blurService.blurState$.subscribe(data => this.isBlur = data);
  }

  openLink(link: string, organization: string): void {
    this.analyticsService.trackAction(organization)
    if (!link) return;

    window.open(link, '_blank', 'noopener,noreferrer');
  }
}
