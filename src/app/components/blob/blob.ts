import { ChangeDetectionStrategy, Component, effect, ElementRef, Input, ViewChild } from '@angular/core';
import { BlobService } from '../../_services/blob.service';

interface GridConfig {
  cellsX: number;
  cellsY: number;
}

export interface BlobMask {
  cols: number;
  rows: number;
  /** 1 = the cell is mostly the third colour */
  cells: Uint8Array;
}

/** grey level from which the colour ramp is more third colour than second (150 → 255) */
const PINK_FROM = 210;

/** growing (blob service growth): each of the five bubbles' [start, length, pulse phase] within it */
const GROW_BUDS: [number, number, number][] = [
  [0, .62, 0], [.2, .58, 2.1], [.08, .66, 4.3], [.34, .52, 1.2], [.46, .54, 3.4],
];

interface RGBColor {
  r: number;
  g: number;
  b: number;
}

@Component({
  selector: 'app-blob',
  imports: [],
  templateUrl: './blob.html',
  styleUrl: './blob.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Blob {
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  private ctx: CanvasRenderingContext2D | null = null;
  private offscreenCanvas: HTMLCanvasElement | null = null;
  private offscreenCtx: CanvasRenderingContext2D | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private animationFrameId: number | null = null;
  private lowRes = false;
  private dpr = 1;
  private lastGrowFrame = -1;

  private gridConfig: GridConfig = { cellsX: 44, cellsY: 44 };

  /** the blob's size against its box (landing B draws it larger in a smaller box) */
  @Input() scale = 1;

  /** called after every frame with the grid cells where the blob is in its third colour (pink):
      the hero text turns white there (see home.ts) */
  onMask?: (mask: BlobMask) => void;

  breakpoints = [
    { minWidth: 2160, cells: 87 },
    { minWidth: 1560, cells: 77 },
    { minWidth: 1160, cells: 67 },
    { minWidth: 536, cells: 37 },
    { minWidth: 0, cells: 27 }
  ];

  private offFrame?: () => void;
  private seen?: IntersectionObserver;

  constructor(public blobService: BlobService) {
    // each frame of the blob's movement draws it (not through change detection)
    this.offFrame = this.blobService.onFrame(() => this.render());

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
    // it only moves while its box is in the window
    const box = this.canvasRef.nativeElement.parentElement ?? this.canvasRef.nativeElement;
    this.seen = new IntersectionObserver(([e]) => this.blobService.setHidden(!e.isIntersecting));
    this.seen.observe(box);
  }

  ngOnDestroy(): void {
    this.offFrame?.();
    this.seen?.disconnect();
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
    this.ctx = canvas.getContext('2d', { alpha: true, willReadFrequently: true });
    //   this.ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (!this.ctx) {
      console.error('Failed to get canvas context');
      return;
    }

    // Disable image smoothing for pixelated look
    this.ctx.imageSmoothingEnabled = false;

    this.dpr = window.devicePixelRatio || 1;

    // Create offscreen canvas for low-res rendering
    this.offscreenCanvas = document.createElement('canvas');
    this.offscreenCtx = this.offscreenCanvas.getContext('2d', { alpha: true, willReadFrequently: true });

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
    // pixelated: one blob pixel per page grid cell (the box sits on grid lines), so the
    // blob's squares are the grid's squares wherever the box is
    const g = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dynamic-grid-size')) || 0;
    const cellsX = params.pixelated
      ? (g ? Math.max(8, Math.round(cssWidth / g)) : this.getCellCountForWidth(cssWidth))
      : Math.floor(cssWidth);
    const cellsY = params.pixelated
      ? (g ? Math.max(8, Math.round(cssHeight / g)) : Math.max(8, Math.round(cellsX * (cssHeight / cssWidth))))
      : Math.floor(cssHeight);

    this.gridConfig = { cellsX, cellsY };

    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;

    // pixelated: the canvas holds one pixel per blob square and the browser blows it up to
    // the box (image-rendering: pixelated, the same hard squares), so each frame hands the
    // screen a few thousand pixels instead of the whole box at full resolution
    this.lowRes = params.pixelated;
    canvas.width = this.lowRes ? cellsX : cssWidth * this.dpr;
    canvas.height = this.lowRes ? cellsY : cssHeight * this.dpr;

    if (this.offscreenCanvas) {
      this.offscreenCanvas.width = cellsX;
      this.offscreenCanvas.height = cellsY;
    }

    // Scale context for DPR (setting the size reset it)
    if (this.ctx) {
      if (!this.lowRes) this.ctx.scale(this.dpr, this.dpr);
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
    // growing (the way in): 12 frames a second, like the rest of the site's motion
    if (this.blobService.growth() < 1) {
      const frame = Math.floor(performance.now() * 12 / 1000);
      if (frame === this.lastGrowFrame) return;
      this.lastGrowFrame = frame;
    }

    const state = this.blobService.current();
    const params = this.blobService.params();
    const { cellsX, cellsY } = this.gridConfig;

    // Step 1: Render to offscreen canvas at low resolution
    this.renderBlobToOffscreen(state, params, cellsX, cellsY);

    // Step 2: Upscale to main canvas with nearest-neighbor interpolation
    if (this.lowRes) {
      this.ctx.clearRect(0, 0, cellsX, cellsY);
      this.ctx.drawImage(this.offscreenCanvas, 0, 0);
      return;
    }
    const canvas = this.canvasRef.nativeElement;
    const cssWidth = canvas.clientWidth;
    const cssHeight = canvas.clientHeight;

    this.ctx.clearRect(0, 0, cssWidth, cssHeight);
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

    // Step 1: Clear canvas for transparent background
    ctx.clearRect(0, 0, cellsX, cellsY);

    const baseRadius = params.radius * Math.min(cellsX, cellsY) * this.scale;
    const centerX = state.cx * cellsX;
    const centerY = state.cy * cellsY;
    // growing (the way in): the bubbles bud one after another from behind the name, each on its
    // own: it swells unevenly (pulsing, a little past its size and back), fades up, pushes out
    // from the bud and drifts over to where the blob is on its way
    const grow = Math.max(0, Math.min(1, this.blobService.growth()));
    const from = grow < 1 ? this.blobService.growOrigin() : null;
    const ox = from ? from.x * cellsX : centerX, oy = from ? from.y * cellsY : centerY;
    const bud = (i: number) => {
      if (grow >= 1) return { size: 1, spread: 1, glow: 1 };
      const [delay, length, phase] = GROW_BUDS[i];
      const x = Math.max(0, Math.min(1, (grow - delay) / length));
      if (x <= 0) return { size: 0, spread: 0, glow: 0 };
      const swell = 1 + 2.4 * Math.pow(x - 1, 3) + 1.4 * Math.pow(x - 1, 2);   // out, past, back
      const pulse = 1 + .22 * Math.sin(x * Math.PI * 3 + phase) * (1 - x);      // uneven, settling
      return { size: Math.max(0, swell * pulse), spread: x * x * (3 - 2 * x), glow: Math.min(1, x * 1.8) };   // stays at the bud, then drifts
    };

    // Render metaball in grayscale with additive blending
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    const numBubbles = 5;
    let spreadAll = 1;
    for (let i = 0; i < numBubbles; i++) {
      const b = bud(i);
      spreadAll = Math.min(spreadAll, b.spread);
      if (b.size <= 0) continue;
      const angle = (i / numBubbles) * Math.PI * 2 + time * 1.5;
      const wobbleStrength = params.wobble * baseRadius * 0.75 * b.spread;

      const offset1 = Math.sin(angle * 1.3 + time * 1.8) * wobbleStrength;
      const offset2 = Math.cos(angle * 1.7 - time * 1.2) * wobbleStrength * 0.7;

      // from the bud (behind the name) over to the blob's own middle
      const bx = ox + (centerX - ox) * b.spread + offset1;
      const by = oy + (centerY - oy) * b.spread + offset2;
      const br = baseRadius * (0.7 + Math.sin(time * 0.8 + i) * 0.15) * b.size;
      if (br <= 0) continue;

      const layers = 4;
      for (let layer = layers; layer >= 1; layer--) {
        const t = layer / layers;
        const r = br * (0.9 + t * 0.9);
        const grayValue = Math.round(60 + t * 100); // Grayscale range: 60-160
        const alpha = (0.06 + t * 0.18) * params.intensity * b.glow;

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
    // the highlight comes last, with the last bud
    const hcx = ox + (centerX - ox) * spreadAll, hcy = oy + (centerY - oy) * spreadAll;
    const hx = hcx + Math.cos(highlightAngle) * baseRadius * 0.6 * spreadAll;
    const hy = hcy + Math.sin(highlightAngle) * baseRadius * 0.6 * spreadAll;
    const hr = baseRadius * 0.4 * spreadAll;

    if (hr > 0) {
      const highlightGradient = ctx.createRadialGradient(hx, hy, 0, hx, hy, hr);
      highlightGradient.addColorStop(0, `rgba(220, 220, 220, ${0.25 * params.intensity})`);
      highlightGradient.addColorStop(0.5, `rgba(180, 180, 180, ${0.12 * params.intensity})`);
      highlightGradient.addColorStop(1, `rgba(0, 0, 0, 0)`);

      ctx.fillStyle = highlightGradient;
      ctx.beginPath();
      ctx.arc(hx, hy, hr, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // Step 2: Apply gradient mapping to convert grayscale to colors
    this.applyGradientMap(ctx, cellsX, cellsY);
  }

  private hexToRgb(hex: string): RGBColor {
    // Remove # if present
    hex = hex.replace('#', '');

    // Parse hex values
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    return { r, g, b };
  }

  private applyGradientMap(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    const root = document.documentElement;
    const style = getComputedStyle(root)

    const darkGreenHex = style.getPropertyValue('--color1').trim() || '#226B22';
    const yellowGreenHex = style.getPropertyValue('--color2').trim() || '#ACC424';
    const magentaHex = style.getPropertyValue('--color3').trim() || '#FF00FC';


    const darkGreen = this.hexToRgb(darkGreenHex);
    const yellowGreen = this.hexToRgb(yellowGreenHex);
    const magenta = this.hexToRgb(magentaHex);

    //const magenta = { r: 255, g: 0, b: 252 };
    //const yellowGreen = { r: 172, g: 196, b: 36 };
    //const darkGreen = { r: 34, g: 107, b: 34 };

    // Color gradient: Black → Dark Green → Yellow-Green → Magenta
    const colorStops = [
      { threshold: 0, color: { r: 0, g: 0, b: 0 } },
      { threshold: 20, color: darkGreen },
      { threshold: 150, color: yellowGreen },
      { threshold: 255, color: magenta },
    ];

    const grays = this.onMask ? new Uint8Array(width * height) : null;
    for (let i = 0; i < data.length; i += 4) {
      const gray = data[i]; // Use R channel as grayscale value
      if (grays && data[i + 3] >= 128) grays[i >> 2] = gray;

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
    if (grays) this.reportMask(grays, width, height);
  }

  /** the pink cells, always on the page grid (also in the smooth, unpixelated mode) */
  private reportMask(grays: Uint8Array, width: number, height: number): void {
    const pixelated = this.blobService.params().pixelated;
    const canvas = this.canvasRef.nativeElement;
    const cols = pixelated ? width : this.getCellCountForWidth(canvas.clientWidth);
    const rows = pixelated ? height : Math.max(1, Math.round(cols * height / width));
    const cells = new Uint8Array(cols * rows);
    for (let y = 0; y < rows; y++) {
      const sy = Math.min(height - 1, Math.floor((y + 0.5) * height / rows));
      for (let x = 0; x < cols; x++) {
        const sx = Math.min(width - 1, Math.floor((x + 0.5) * width / cols));
        if (grays[sy * width + sx] >= PINK_FROM) cells[y * cols + x] = 1;
      }
    }
    this.onMask?.({ cols, rows, cells });
  }


}
