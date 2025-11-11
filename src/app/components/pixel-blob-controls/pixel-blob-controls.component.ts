import { Component, computed } from '@angular/core';
import { PixelBlobService } from '../../services/pixel.blob.service';

@Component({
  selector: 'app-pixel-blob-controls',
  imports: [],
  templateUrl: './pixel-blob-controls.component.html',
  styleUrl: './pixel-blob-controls.component.scss'
})
export class PixelBlobControlsComponent {
  isExpanded = true;

  // Get reactive params
  params;
  state;
  defaults;

  // Computed values for display
  radiusPercent;
  speedPercent;
  wobblePercent;
  intensityPercent;

  constructor(public blobService: PixelBlobService) {
    this.params = this.blobService.params;
    this.state = this.blobService.state;
    this.defaults = this.blobService.getDefaults();

    this.radiusPercent = computed(() => Math.round(this.params().radius * 100));
    this.speedPercent = computed(() => Math.round((this.params().speed / 1.5) * 100));
    this.wobblePercent = computed(() => Math.round(((this.params().wobble - 0.5) / 1.5) * 100));
    this.intensityPercent = computed(() => Math.round(((this.params().intensity - 0.5) / 1.5) * 100));
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

  onPixelatedChange(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.blobService.updateParams({ pixelated: checked });
  }

  toggleExpand(): void {
    this.isExpanded = !this.isExpanded;
  }

  reset(): void {
    this.blobService.resetToDefaults();
  }

  randomize(): void {
    this.blobService.randomize();
  }

  togglePause(): void {
    this.blobService.togglePause();
  }
}
