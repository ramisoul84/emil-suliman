import { DecimalPipe } from '@angular/common';
import { AfterViewInit, Component, ElementRef, OnDestroy, computed, input, signal, viewChild } from '@angular/core';

export interface TrendPoint {
    /** x label, e.g. "23 Oct". */
    label: string;
    value: number;
}

const HEIGHT = 220;
const PAD = { top: 12, right: 12, bottom: 26, left: 36 };

/**
 * One series over time: a 2px line over a faint area, a recessive grid, and a
 * crosshair + tooltip on hover (or touch). Plain SVG, measured to its box so text
 * never scales.
 */
@Component({
    selector: 'app-trend-chart',
    imports: [DecimalPipe],
    template: `
        <div class="frame" #frame>
            @if (width() > 0) {
            <svg [attr.width]="width()" [attr.height]="height" role="img" [attr.aria-label]="name() + ' over time'"
                (pointermove)="onPointer($event)" (pointerleave)="hover.set(null)" (pointerdown)="onPointer($event)">
                @for (tick of ticks(); track tick) {
                <line class="grid" [attr.x1]="pad.left" [attr.x2]="width() - pad.right" [attr.y1]="y(tick)" [attr.y2]="y(tick)" />
                <text class="tick" [attr.x]="pad.left - 8" [attr.y]="y(tick)" text-anchor="end" dominant-baseline="middle">{{ tick | number }}</text>
                }
                @for (i of xLabels(); track i) {
                <text class="tick" [attr.x]="x(i)" [attr.y]="height - 6" [attr.text-anchor]="anchor(i)">{{ points()[i].label }}</text>
                }
                <path class="area" [attr.d]="areaPath()" />
                <path class="line" [attr.d]="linePath()" />
                @if (points().length === 1) {
                <circle class="dot" [attr.cx]="x(0)" [attr.cy]="y(points()[0].value)" r="4" />
                }
                @if (hover(); as h) {
                <line class="cross" [attr.x1]="x(h)" [attr.x2]="x(h)" [attr.y1]="pad.top" [attr.y2]="height - pad.bottom" />
                <circle class="dot" [attr.cx]="x(h)" [attr.cy]="y(points()[h].value)" r="5" />
                }
            </svg>
            @if (hover(); as h) {
            <div class="tip" [style.left.px]="tipLeft(h)" [style.top.px]="y(points()[h].value) - 12">
                <span class="tip-label">{{ points()[h].label }}</span>
                <span class="tip-value">{{ points()[h].value | number }} {{ name() }}</span>
            </div>
            }
            }
        </div>
    `,
    styles: `
        :host { display: block; }
        .frame { position: relative; width: 100%; }
        svg { display: block; touch-action: pan-y; }
        .grid { stroke: var(--a-grid); stroke-width: 1; }
        .tick { fill: var(--a-ink-3); font-size: 11px; font-variant-numeric: tabular-nums; }
        .area { fill: var(--a-viz); opacity: 0.12; }
        .line { fill: none; stroke: var(--a-viz); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
        .cross { stroke: var(--a-ink-3); stroke-width: 1; stroke-dasharray: 3 3; }
        .dot { fill: var(--a-viz); stroke: var(--a-surface); stroke-width: 2; }
        .tip {
            position: absolute;
            transform: translate(-50%, -100%);
            display: flex;
            flex-direction: column;
            gap: 0.1rem;
            padding: 0.4rem 0.6rem;
            background: var(--a-ink);
            color: var(--a-surface);
            font-size: 0.8rem;
            white-space: nowrap;
            pointer-events: none;
        }
        .tip-label { opacity: 0.75; }
        .tip-value { font-weight: 600; font-variant-numeric: tabular-nums; }
    `,
})
export class TrendChart implements AfterViewInit, OnDestroy {
    readonly points = input.required<TrendPoint[]>();
    /** What is counted, for the tooltip and the label: "visitors". */
    readonly name = input.required<string>();

    readonly height = HEIGHT;
    readonly pad = PAD;
    readonly width = signal(0);
    readonly hover = signal<number | null>(null);

    private readonly frame = viewChild.required<ElementRef<HTMLElement>>('frame');
    private resize?: ResizeObserver;

    ngAfterViewInit(): void {
        const el = this.frame().nativeElement;
        this.width.set(el.clientWidth);
        if (typeof ResizeObserver === 'undefined') return;
        this.resize = new ResizeObserver(() => this.width.set(el.clientWidth));
        this.resize.observe(el);
    }

    ngOnDestroy(): void {
        this.resize?.disconnect();
    }

    /** A "nice" top of the y-axis and 3–4 round ticks under it. */
    readonly ticks = computed(() => {
        const max = Math.max(...this.points().map((p) => p.value), 0);
        if (max === 0) return [0, 1];
        const rough = max / 3;
        const mag = 10 ** Math.floor(Math.log10(rough));
        const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= rough) ?? rough;
        const steps = Math.max(1, Math.round(step));
        const out: number[] = [];
        for (let v = 0; v < max + steps; v += steps) out.push(v);
        return out;
    });

    private readonly yMax = computed(() => this.ticks()[this.ticks().length - 1] || 1);

    x(i: number): number {
        const n = this.points().length;
        const inner = this.width() - PAD.left - PAD.right;
        return n <= 1 ? PAD.left + inner / 2 : PAD.left + (i / (n - 1)) * inner;
    }

    y(v: number): number {
        return PAD.top + (1 - v / this.yMax()) * (HEIGHT - PAD.top - PAD.bottom);
    }

    readonly linePath = computed(() =>
        this.points().map((p, i) => `${i ? 'L' : 'M'}${this.x(i).toFixed(1)},${this.y(p.value).toFixed(1)}`).join(''));

    readonly areaPath = computed(() => {
        const n = this.points().length;
        if (n < 2) return '';
        const base = this.y(0);
        return `${this.linePath()}L${this.x(n - 1).toFixed(1)},${base}L${this.x(0).toFixed(1)},${base}Z`;
    });

    /** Up to ~6 evenly spaced x labels, always including the first and last. */
    readonly xLabels = computed(() => {
        const n = this.points().length;
        const room = Math.max(2, Math.floor((this.width() - PAD.left - PAD.right) / 70));
        if (n <= room) return [...Array(n).keys()];
        const step = (n - 1) / (room - 1);
        return [...new Set(Array.from({ length: room }, (_, k) => Math.round(k * step)))];
    });

    anchor(i: number): string {
        const n = this.points().length;
        if (n > 1 && i === 0) return 'start';
        if (n > 1 && i === n - 1) return 'end';
        return 'middle';
    }

    onPointer(event: PointerEvent): void {
        const n = this.points().length;
        if (!n) return;
        const rect = (event.currentTarget as SVGElement).getBoundingClientRect();
        const inner = this.width() - PAD.left - PAD.right;
        const t = (event.clientX - rect.left - PAD.left) / Math.max(1, inner);
        this.hover.set(Math.min(n - 1, Math.max(0, Math.round(t * (n - 1)))));
    }

    /** Keeps the tooltip inside the chart near the edges. */
    tipLeft(i: number): number {
        return Math.min(Math.max(this.x(i), 70), this.width() - 70);
    }
}
