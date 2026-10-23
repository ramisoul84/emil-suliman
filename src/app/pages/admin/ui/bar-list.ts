import { DecimalPipe, PercentPipe } from '@angular/common';
import { Component, computed, input, signal } from '@angular/core';

export interface BarRow {
    label: string;
    value: number;
    /** Optional secondary text after the value, e.g. "2 conv." */
    note?: string;
    /** Optional leading glyph (flag emoji, icon). */
    lead?: string;
}

/**
 * Ranked horizontal bars as a real list: label · thin bar · value.
 * One series → one colour. Doubles as its own table view.
 */
@Component({
    selector: 'app-bar-list',
    imports: [DecimalPipe, PercentPipe],
    template: `
        @if (rows().length === 0) {
        <p class="empty">No data in this range.</p>
        } @else {
        <ol class="bar-list" [attr.aria-label]="label()">
            @for (row of visible(); track row.label) {
            <li class="bar-row" [title]="row.label + ': ' + row.value">
                <span class="bar-label">
                    @if (row.lead) {<span class="bar-lead" aria-hidden="true">{{ row.lead }}</span>}
                    {{ row.label }}
                </span>
                <span class="bar-track" aria-hidden="true">
                    <span class="bar-fill" [style.width.%]="(row.value / max()) * 100"></span>
                </span>
                <span class="bar-value">
                    {{ row.value | number }}
                    @if (showShare()) {<span class="bar-share">{{ row.value / total() | percent }}</span>}
                    @if (row.note) {<span class="bar-note">{{ row.note }}</span>}
                </span>
            </li>
            }
        </ol>
        @if (rows().length > limit()) {
        <button type="button" class="more" (click)="expanded.set(!expanded())">
            {{ expanded() ? 'Show less' : '+ ' + (rows().length - limit()) + ' more' }}
        </button>
        }
        }
    `,
    styles: `
        :host { display: block; }
        .bar-list { display: flex; flex-direction: column; gap: 0.6rem; margin: 0; padding: 0; list-style: none; }
        .bar-row {
            display: grid;
            grid-template-columns: minmax(6rem, 1fr) minmax(3rem, 1.2fr) auto;
            align-items: center;
            gap: 0.75rem;
            font-size: 0.92rem;
        }
        .bar-label { color: var(--a-ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .bar-lead { margin-right: 0.4rem; }
        .bar-track { height: 6px; background: var(--a-grid); border-radius: 3px; overflow: hidden; }
        .bar-fill { display: block; height: 100%; min-width: 2px; background: var(--a-viz); border-radius: 0 3px 3px 0; transition: width 0.4s ease; }
        .bar-value { color: var(--a-ink); text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
        .bar-share, .bar-note { margin-left: 0.5rem; color: var(--a-ink-3); font-size: 0.8rem; }
        .empty { margin: 0; color: var(--a-ink-3); font-size: 0.9rem; }
        .more { margin-top: 0.7rem; padding: 0; border: 0; background: none; color: var(--a-ink-2); font: inherit; font-size: 0.85rem; text-decoration: underline; cursor: pointer; }
    `,
})
export class BarList {
    readonly rows = input.required<BarRow[]>();
    readonly label = input('');
    readonly limit = input(6);
    readonly showShare = input(true);
    readonly expanded = signal(false);

    readonly visible = computed(() => (this.expanded() ? this.rows() : this.rows().slice(0, this.limit())));
    readonly max = computed(() => Math.max(1, ...this.rows().map((r) => r.value)));
    readonly total = computed(() => Math.max(1, this.rows().reduce((sum, r) => sum + r.value, 0)));
}
