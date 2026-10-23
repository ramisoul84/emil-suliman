import { Component, computed, input, signal } from '@angular/core';
import { HeatmapCell } from '../data/analytics.models';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * When visits start: weekday × hour, one hue from light to dark (5 steps).
 * Hover (or tap) a cell for its count; a legend shows the scale.
 */
@Component({
    selector: 'app-heatmap',
    template: `
        <div class="heat" role="img" aria-label="Sessions by weekday and hour">
            <span></span>
            @for (h of hours; track h) {
            <span class="hour">{{ h % 3 === 0 ? h : '' }}</span>
            }
            @for (day of weekdays; track $index; let d = $index) {
            <span class="day">{{ day }}</span>
            @for (h of hours; track h) {
            <span class="cell" [attr.data-step]="step(d, h)"
                (pointerenter)="hover.set({ d, h })" (pointerdown)="hover.set({ d, h })" (pointerleave)="hover.set(null)"></span>
            }
            }
        </div>
        <div class="foot">
            <span class="readout">
                @if (hover(); as c) {
                {{ weekdays[c.d] }} {{ c.h }}:00–{{ c.h + 1 }}:00 · <b>{{ value(c.d, c.h) }}</b> session{{ value(c.d, c.h) === 1 ? '' : 's' }}
                } @else {
                Hover a cell for its count · server time
                }
            </span>
            <span class="legend" aria-hidden="true">
                0 @for (s of [0, 1, 2, 3, 4]; track s) {<span class="cell" [attr.data-step]="s"></span>} {{ max() }}
            </span>
        </div>
    `,
    styles: `
        :host { display: block; }
        .heat { display: grid; grid-template-columns: 2.2rem repeat(24, minmax(0, 1fr)); gap: 2px; align-items: center; }
        .hour, .day { color: var(--a-ink-3); font-size: 0.7rem; font-variant-numeric: tabular-nums; }
        .cell { display: block; height: 1.15rem; border-radius: 2px; background: var(--a-grid); }
        .cell[data-step='1'] { background: color-mix(in oklab, var(--a-viz) 25%, var(--a-surface)); }
        .cell[data-step='2'] { background: color-mix(in oklab, var(--a-viz) 45%, var(--a-surface)); }
        .cell[data-step='3'] { background: color-mix(in oklab, var(--a-viz) 70%, var(--a-surface)); }
        .cell[data-step='4'] { background: var(--a-viz); }
        .heat .cell:hover { outline: 2px solid var(--a-ink); outline-offset: 0; }
        .foot { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 0.5rem; margin-top: 0.75rem; font-size: 0.82rem; color: var(--a-ink-2); }
        .legend { display: inline-flex; align-items: center; gap: 3px; color: var(--a-ink-3); }
        .legend .cell { width: 12px; height: 12px; }
    `,
})
export class Heatmap {
    readonly cells = input.required<HeatmapCell[]>();
    readonly weekdays = WEEKDAYS;
    readonly hours = Array.from({ length: 24 }, (_, h) => h);
    readonly hover = signal<{ d: number; h: number } | null>(null);

    private readonly grid = computed(() => {
        const g = new Map<number, number>();
        for (const c of this.cells()) g.set(c.weekday * 24 + c.hour, c.visitors);
        return g;
    });

    readonly max = computed(() => Math.max(0, ...this.grid().values()));

    value(d: number, h: number): number {
        return this.grid().get(d * 24 + h) ?? 0;
    }

    /** 0 = none, 1–4 = quartiles of the busiest cell. */
    step(d: number, h: number): number {
        const v = this.value(d, h);
        return v === 0 ? 0 : Math.max(1, Math.ceil((v / Math.max(1, this.max())) * 4));
    }
}
