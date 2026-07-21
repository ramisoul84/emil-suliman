import { Component, computed, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BlobService } from '../../_services/blob.service';
import { AnalyticsService } from '../../_services/analytics.service';

@Component({
  selector: 'app--control',
  imports: [CommonModule],
  templateUrl: './control.html',
  styleUrl: './control.scss'
})
export class Control implements OnInit, OnDestroy {
  isExpanded = true;
  isPixelated = true

  leftColor: string = '#226b22';
  rightColor: string = '#ACC424';
  centerColor: string = '#FF2D95';

  // Get reactive params
  params;
  state;
  defaults;

  // Computed values for display
  radiusPercent;
  speedPercent;
  wobblePercent;
  intensityPercent;

  constructor(public blobService: BlobService, private analyticsService: AnalyticsService) {
    this.params = this.blobService.params;
    this.state = this.blobService.state;
    this.defaults = this.blobService.getDefaults();

    this.radiusPercent = computed(() => Math.round(this.params().radius * 100));
    this.speedPercent = computed(() => Math.round((this.params().speed / 1.5) * 100));
    this.wobblePercent = computed(() => Math.round(((this.params().wobble - 0.5) / 1.5) * 100));
    this.intensityPercent = computed(() => Math.round(((this.params().intensity - 0.5) / 1.5) * 100));

    window.addEventListener('scroll', this.handleScroll.bind(this), { passive: true });
  }

  ngOnInit(): void {
    window.addEventListener('scroll', this.handleScroll.bind(this), { passive: true });
  }



  private handleScroll(): void {
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;
    const innerHeight = window.innerHeight;
    if (scrollY >= innerHeight) {
      document.documentElement.style.setProperty('--color1', '#226b22');
      document.documentElement.style.setProperty('--color2', '#ACC424');
      document.documentElement.style.setProperty('--color3', '#FF00FC');

      this.leftColor = '#226b22';
      this.rightColor = '#ACC424';
      this.centerColor = '#FF00FC'
    }
  }

  onRadiusChange(event: Event): void {
    const value = (event.target as HTMLInputElement).valueAsNumber;
    this.blobService.updateParams({ radius: value });
  }

  onSpeedChange(event: Event): void {
    const value = (event.target as HTMLInputElement).valueAsNumber;
    this.blobService.updateParams({ speed: value });
  }

  onWobbleChange(event: Event): void {
    const value = (event.target as HTMLInputElement).valueAsNumber;
    this.blobService.updateParams({ wobble: value });
  }

  onIntensityChange(event: Event): void {
    const value = (event.target as HTMLInputElement).valueAsNumber;
    this.blobService.updateParams({ intensity: value });
  }

  onSpeedanalytics(event: Event): void {
    this.analyticsService.trackAction('blob')
  }

  togglePixelated() {
    this.analyticsService.trackAction('blob')
    this.isPixelated = !this.isPixelated
    this.blobService.updateParams({ pixelated: this.isPixelated });
  }

  toggleExpand(): void {
    this.isExpanded = !this.isExpanded;
  }

  reset(): void {
    this.blobService.resetToDefaults();
  }

  randomize(): void {
    this.analyticsService.trackAction('blob')
    this.blobService.randomize();
  }

  togglePause(): void {
    this.blobService.togglePause();
  }

  changeLeftColor(color: string) {
    this.analyticsService.trackAction('blob')
    this.leftColor = color
    document.documentElement.style.setProperty('--color1', color);

  }

  changeRightColor(color: string) {
    this.analyticsService.trackAction('blob')
    this.rightColor = color
    document.documentElement.style.setProperty('--color2', color);
  }

  changeCenterColor(color: string) {
    this.analyticsService.trackAction('blob')
    this.centerColor = color
    document.documentElement.style.setProperty('--color3', color);
  }

  randomizeColor(): void {
    this.analyticsService.trackAction('blob')
    this.leftColor = this.generateRandomHexColor()
    this.rightColor = this.generateRandomHexColor()
    this.centerColor = this.generateRandomHexColor()
    document.documentElement.style.setProperty('--color1', this.leftColor);
    document.documentElement.style.setProperty('--color2', this.rightColor);
    document.documentElement.style.setProperty('--color3', this.centerColor);

  }

  generateRandomHexColor(): string {
    // Generate a random hex color (#RRGGBB)
    const hex = '0123456789ABCDEF';
    let color = '#';

    for (let i = 0; i < 6; i++) {
      color += hex[Math.floor(Math.random() * 16)];
    }

    return color;
  }

  ngOnDestroy(): void {
    window.removeEventListener('scroll', this.handleScroll.bind(this));
  }
}