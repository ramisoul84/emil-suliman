import { Component, computed, input } from '@angular/core';
import { Kpi } from '../data/analytics.models';
import { formatDuration } from './format';

export type KpiFormat = 'number' | 'percent' | 'duration';

/** Stat tile: headline value + change vs the previous period (icon + label, never colour alone). */
@Component({
    selector: 'app-kpi-tile',
    template: `
        <span class="kpi-label">{{ label() }}</span>
        <span class="kpi-value">{{ display() }}</span>
        <span [class]="'kpi-delta ' + quality()">
            @switch (direction()) {
            @case ('up') {<span aria-hidden="true">▲</span>}
            @case ('down') {<span aria-hidden="true">▼</span>}
            @default {<span aria-hidden="true">■</span>}
            }
            {{ deltaText() }}
            <span class="kpi-vs">vs prev.</span>
        </span>
    `,
    styles: `
        :host {
            display: flex;
            flex-direction: column;
            gap: 0.35rem;
            padding: 1rem 1.1rem;
            background: var(--a-surface);
            border: var(--a-frame);
            min-width: 0;
        }
        :host(.highlight) { box-shadow: 0.35rem 0.35rem 0 var(--a-accent-2); }
        .kpi-label { color: var(--a-ink-2); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.06em; }
        .kpi-value { color: var(--a-ink); font-size: 1.9rem; font-weight: 700; line-height: 1.1; font-variant-numeric: tabular-nums; }
        .kpi-delta { display: inline-flex; align-items: baseline; gap: 0.3rem; font-size: 0.8rem; color: var(--a-ink-2); }
        .kpi-delta.good { color: var(--a-good-text); }
        .kpi-delta.bad { color: var(--a-bad-text); }
        .kpi-vs { color: var(--a-ink-3); }
    `,
    host: { '[class.highlight]': 'highlight()' },
})
export class KpiTile {
    readonly label = input.required<string>();
    readonly kpi = input.required<Kpi>();
    readonly format = input<KpiFormat>('number');
    /** For metrics where lower is better (bounce rate). */
    readonly invert = input(false);
    readonly highlight = input(false);

    readonly display = computed(() => {
        const value = this.kpi().current;
        switch (this.format()) {
            case 'percent': return `${(value * 100).toFixed(1)}%`;
            case 'duration': return formatDuration(value);
            default: return new Intl.NumberFormat('en').format(value);
        }
    });

    private readonly change = computed(() => {
        const { current, previous } = this.kpi();
        if (this.format() === 'percent') return (current - previous) * 100; // percentage points
        if (previous === 0) return current === 0 ? 0 : null;
        return ((current - previous) / previous) * 100;
    });

    readonly direction = computed<'up' | 'down' | 'flat'>(() => {
        const change = this.change();
        if (change === null) return 'up';
        if (Math.abs(change) < 0.5) return 'flat';
        return change > 0 ? 'up' : 'down';
    });

    readonly quality = computed(() => {
        const direction = this.direction();
        if (direction === 'flat') return '';
        return (direction === 'up') !== this.invert() ? 'good' : 'bad';
    });

    readonly deltaText = computed(() => {
        const change = this.change();
        if (change === null) return 'new';
        const sign = change > 0 ? '+' : '';
        return this.format() === 'percent' ? `${sign}${change.toFixed(1)} pp` : `${sign}${Math.round(change)}%`;
    });
}
