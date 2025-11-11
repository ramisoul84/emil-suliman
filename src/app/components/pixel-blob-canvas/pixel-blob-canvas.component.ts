import { Component, effect, ElementRef, ViewChild } from '@angular/core';
import { PixelBlobService } from '../../services/pixel.blob.service';

interface GridConfig {
  cellsX: number;
  cellsY: number;
}


@Component({
  selector: 'app-pixel-blob-canvas',
  imports: [],
  templateUrl: './pixel-blob-canvas.component.html',
  styleUrl: './pixel-blob-canvas.component.scss'
})
export class PixelBlobCanvasComponent {
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  private ctx: CanvasRenderingContext2D | null = null;
  private offscreenCanvas: HTMLCanvasElement | null = null;
  private offscreenCtx: CanvasRenderingContext2D | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private animationFrameId: number | null = null;
  private dpr = 1;

  private gridConfig: GridConfig = { cellsX: 44, cellsY: 44 };

  // Responsive breakpoints for pixel/cell count
  private readonly breakpoints = [
    { minWidth: 1580, cells: 60 },
    { minWidth: 1180, cells: 50 },
    { minWidth: 972, cells: 44 },
    { minWidth: 748, cells: 38 },
    { minWidth: 556, cells: 32 },
    { minWidth: 0, cells: 27 }
  ];

  constructor(public blobService: PixelBlobService) {
    effect(() => {
      this.blobService.state();
      this.render();
    });

    let previousPixelated: boolean | undefined;
    effect(() => {
      const params = this.blobService.params();

      // Resize canvas when pixelated mode changes
      if (previousPixelated !== undefined && previousPixelated !== params.pixelated) {
        this.resizeCanvas();
      }
      previousPixelated = params.pixelated;

      this.render();
    });
  }

  ngOnInit(): void {
    this.initCanvas();
    this.setupResizeObserver();
    this.blobService.startAnimation();
  }

  ngOnDestroy(): void {
    this.blobService.stopAnimation();
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  private initCanvas(): void {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d', { alpha: false });

    if (!this.ctx) {
      console.error('Failed to get canvas context');
      return;
    }

    // Disable image smoothing for pixelated look
    this.ctx.imageSmoothingEnabled = false;

    this.dpr = window.devicePixelRatio || 1;

    // Create offscreen canvas for low-res rendering
    this.offscreenCanvas = document.createElement('canvas');
    this.offscreenCtx = this.offscreenCanvas.getContext('2d', { alpha: false });

    if (this.offscreenCtx) {
      this.offscreenCtx.imageSmoothingEnabled = false;
    }

    this.resizeCanvas();
  }

  private setupResizeObserver(): void {
    const canvas = this.canvasRef.nativeElement;

    this.resizeObserver = new ResizeObserver(() => {
      this.resizeCanvas();
    });

    this.resizeObserver.observe(canvas.parentElement || canvas);
  }

  private resizeCanvas(): void {
    const canvas = this.canvasRef.nativeElement;
    const parent = canvas.parentElement;

    if (!parent) return;

    const cssWidth = parent.clientWidth;
    const cssHeight = parent.clientHeight;

    const params = this.blobService.params();

    // Determine grid size: use breakpoints for pixelated mode, full resolution otherwise
    const cellsX = params.pixelated
      ? this.getCellCountForWidth(cssWidth)
      : Math.floor(cssWidth);
    const cellsY = params.pixelated
      ? Math.max(8, Math.round(cellsX * (cssHeight / cssWidth)))
      : Math.floor(cssHeight);

    this.gridConfig = { cellsX, cellsY };

    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;

    // Set canvas internal resolution (device pixels)
    canvas.width = cssWidth * this.dpr;
    canvas.height = cssHeight * this.dpr;

    if (this.offscreenCanvas) {
      this.offscreenCanvas.width = cellsX;
      this.offscreenCanvas.height = cellsY;
    }

    // Scale context for DPR
    if (this.ctx) {
      this.ctx.scale(this.dpr, this.dpr);
      this.ctx.imageSmoothingEnabled = !params.pixelated;
    }

    this.render();
  }

  private getCellCountForWidth(width: number): number {
    for (const bp of this.breakpoints) {
      if (width >= bp.minWidth) {
        return bp.cells;
      }
    }
    return 27;
  }

  private render(): void {
    if (!this.ctx || !this.offscreenCtx || !this.offscreenCanvas) {
      return;
    }

    const state = this.blobService.state();
    const params = this.blobService.params();
    const { cellsX, cellsY } = this.gridConfig;

    // Step 1: Render to offscreen canvas at low resolution
    this.renderBlobToOffscreen(state, params, cellsX, cellsY);

    // Step 2: Upscale to main canvas with nearest-neighbor interpolation
    const canvas = this.canvasRef.nativeElement;
    const cssWidth = canvas.clientWidth;
    const cssHeight = canvas.clientHeight;

    this.ctx.fillStyle = params.bgColor || '#000000';
    this.ctx.fillRect(0, 0, cssWidth, cssHeight);
    this.ctx.drawImage(this.offscreenCanvas, 0, 0, cssWidth, cssHeight);
  }

  private renderBlobToOffscreen(
    state: any,
    params: any,
    cellsX: number,
    cellsY: number
  ): void {
    if (!this.offscreenCtx) return;

    const ctx = this.offscreenCtx;
    const time = state.time;

    // Step 1: Render blob in grayscale
    const bgColor = params.bgColor || '#000000';
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, cellsX, cellsY);

    const centerX = state.cx * cellsX;
    const centerY = state.cy * cellsY;
    const baseRadius = params.radius * Math.min(cellsX, cellsY);

    // Render metaball in grayscale with additive blending
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    const numBubbles = 5;
    for (let i = 0; i < numBubbles; i++) {
      const angle = (i / numBubbles) * Math.PI * 2 + time * 1.5;
      const wobbleStrength = params.wobble * baseRadius * 0.75;

      const offset1 = Math.sin(angle * 1.3 + time * 1.8) * wobbleStrength;
      const offset2 = Math.cos(angle * 1.7 - time * 1.2) * wobbleStrength * 0.7;

      const bx = centerX + offset1;
      const by = centerY + offset2;
      const br = baseRadius * (0.7 + Math.sin(time * 0.8 + i) * 0.15);

      const layers = 4;
      for (let layer = layers; layer >= 1; layer--) {
        const t = layer / layers;
        const r = br * (0.9 + t * 0.9);
        const grayValue = Math.round(60 + t * 100); // Grayscale range: 60-160
        const alpha = (0.06 + t * 0.18) * params.intensity;

        const gradient = ctx.createRadialGradient(bx, by, 0, bx, by, r);
        gradient.addColorStop(0, `rgba(${grayValue}, ${grayValue}, ${grayValue}, ${alpha})`);
        gradient.addColorStop(0.7, `rgba(${grayValue}, ${grayValue}, ${grayValue}, ${alpha * 0.5})`);
        gradient.addColorStop(1, `rgba(0, 0, 0, 0)`);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(bx, by, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const highlightAngle = time * 1.2;
    const hx = centerX + Math.cos(highlightAngle) * baseRadius * 0.6;
    const hy = centerY + Math.sin(highlightAngle) * baseRadius * 0.6;

    const highlightGradient = ctx.createRadialGradient(hx, hy, 0, hx, hy, baseRadius * 0.4);
    highlightGradient.addColorStop(0, `rgba(220, 220, 220, ${0.25 * params.intensity})`);
    highlightGradient.addColorStop(0.5, `rgba(180, 180, 180, ${0.12 * params.intensity})`);
    highlightGradient.addColorStop(1, `rgba(0, 0, 0, 0)`);

    ctx.fillStyle = highlightGradient;
    ctx.beginPath();
    ctx.arc(hx, hy, baseRadius * 0.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // Step 2: Apply gradient mapping to convert grayscale to colors
    this.applyGradientMap(ctx, cellsX, cellsY);
  }

  private applyGradientMap(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    const magenta = { r: 255, g: 0, b: 252 };
    const yellowGreen = { r: 172, g: 196, b: 36 };
    const darkGreen = { r: 34, g: 107, b: 34 };

    // Color gradient: Black → Dark Green → Yellow-Green → Magenta
    const colorStops = [
      { threshold: 0, color: { r: 0, g: 0, b: 0 } },
      { threshold: 60, color: darkGreen },
      { threshold: 120, color: yellowGreen },
      { threshold: 180, color: magenta },
      { threshold: 255, color: { r: 255, g: 150, b: 253 } }
    ];

    for (let i = 0; i < data.length; i += 4) {
      const gray = data[i]; // Use R channel as grayscale value

      if (gray > 0) {
        let color = { r: 0, g: 0, b: 0 };
        for (let j = 0; j < colorStops.length - 1; j++) {
          const stop1 = colorStops[j];
          const stop2 = colorStops[j + 1];

          if (gray >= stop1.threshold && gray <= stop2.threshold) {
            // Interpolate between color stops
            const t = (gray - stop1.threshold) / (stop2.threshold - stop1.threshold);
            color = {
              r: Math.round(stop1.color.r + (stop2.color.r - stop1.color.r) * t),
              g: Math.round(stop1.color.g + (stop2.color.g - stop1.color.g) * t),
              b: Math.round(stop1.color.b + (stop2.color.b - stop1.color.b) * t)
            };
            break;
          }
        }

        data[i] = color.r;
        data[i + 1] = color.g;
        data[i + 2] = color.b;
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }
}
