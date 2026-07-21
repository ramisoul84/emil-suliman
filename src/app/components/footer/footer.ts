import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { BlurService } from '../../_services/blur.service';
import { AnalyticsService } from '../../_services/analytics.service';

@Component({
  selector: 'app-footer',
  imports: [CommonModule],
  templateUrl: './footer.html',
  styleUrl: './footer.scss'
})
export class Footer {
  isBlur: boolean = false;

  constructor(private blur: BlurService, private analyticsService: AnalyticsService, private router: Router) {
    this.blur.blurState$.subscribe(
      data => this.isBlur = data
    )
  }

  goToPage(route: string): void {
    this.analyticsService.trackAction(route)
    this.router.navigate([route])
  }

  openPage() {
    this.analyticsService.trackAction('whale')
    const newWindow = window.open('https://www.wwf.org.uk/learn/fascinating-facts/top-10-facts-about-whales', '_blank');

    if (newWindow) {
      newWindow.opener = null;
    }
  }
}
