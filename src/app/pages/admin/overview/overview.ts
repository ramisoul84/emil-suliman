import { DecimalPipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { AdminAnalyticsService } from '../data/admin-analytics.service';
import { CountRow, Overview as OverviewData, TimeseriesPoint } from '../data/analytics.models';
import { BarList, BarRow } from '../ui/bar-list';
import { CHANNEL_LABELS, LANGUAGE_NAMES, SECTION_LABELS, countryName, flag, humanize, shortDate } from '../ui/format';
import { Heatmap } from '../ui/heatmap';
import { KpiTile } from '../ui/kpi-tile';
import { TrendChart, TrendPoint } from '../ui/trend-chart';

type TrendMetric = 'visitors' | 'sessions' | 'pageviews' | 'conversions';

const TREND_NAMES: Record<TrendMetric, string> = {
  visitors: 'visitors', sessions: 'sessions', pageviews: 'pageviews', conversions: 'converted sessions',
};

/** Core Web Vitals thresholds (good ≤ first, poor > second). */
const VITALS = [
  { key: 'lcp_p75_ms', label: 'LCP', unit: 'ms', good: 2500, poor: 4000, hint: 'Largest Contentful Paint' },
  { key: 'inp_p75_ms', label: 'INP', unit: 'ms', good: 200, poor: 500, hint: 'Interaction to Next Paint' },
  { key: 'cls_p75', label: 'CLS', unit: '', good: 0.1, poor: 0.25, hint: 'Cumulative Layout Shift' },
  { key: 'ttfb_p75_ms', label: 'TTFB', unit: 'ms', good: 800, poor: 1800, hint: 'Time to First Byte' },
] as const;

@Component({
  selector: 'app-admin-overview',
  imports: [DecimalPipe, BarList, KpiTile, TrendChart, Heatmap],
  templateUrl: './overview.html',
  styleUrl: './overview.scss',
})
export class Overview {
  readonly data = inject(AdminAnalyticsService);

  readonly overview = signal<OverviewData | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly metric = signal<TrendMetric>('visitors');
  readonly techTab = signal<'devices' | 'browsers' | 'os'>('devices');
  readonly exporting = signal(false);

  readonly metrics: TrendMetric[] = ['visitors', 'sessions', 'pageviews', 'conversions'];
  readonly trendNames = TREND_NAMES;

  constructor() {
    // Refetch whenever the shared range changes; the previous render stays (dimmed) meanwhile.
    effect((onCleanup) => {
      const range = this.data.range();
      this.loading.set(true);
      const sub = this.data.overview(range).subscribe({
        next: (overview) => {
          this.overview.set(overview);
          this.error.set(null);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(this.data.describeError(err));
          this.loading.set(false);
        },
      });
      onCleanup(() => sub.unsubscribe());
    });
  }

  readonly trend = computed<TrendPoint[]>(() => {
    const metric = this.metric();
    return (this.overview()?.timeseries ?? []).map((p: TimeseriesPoint) => ({ label: shortDate(p.date), value: p[metric] }));
  });

  readonly sources = computed<BarRow[]>(() =>
    (this.overview()?.sources ?? []).map((s) => ({
      label: s.source,
      value: s.visitors,
      note: s.conversions ? `${s.conversions} conv.` : undefined,
    })));

  /** Locations come per city; the card shows countries, cities in the tooltip-free note. */
  readonly countries = computed<BarRow[]>(() => {
    const totals = new Map<string, { visitors: number; cities: string[] }>();
    for (const l of this.overview()?.locations ?? []) {
      const t = totals.get(l.country) ?? { visitors: 0, cities: [] };
      t.visitors += l.visitors;
      if (l.city) t.cities.push(l.city);
      totals.set(l.country, t);
    }
    return [...totals.entries()]
      .sort((a, b) => b[1].visitors - a[1].visitors)
      .map(([code, t]) => ({ label: countryName(code), value: t.visitors, lead: flag(code), note: t.cities.slice(0, 2).join(', ') || undefined }));
  });

  /** Sections reached, as a share of all sessions in the range. */
  readonly funnel = computed(() => {
    const ov = this.overview();
    const sessions = Math.max(1, ov?.kpis.sessions.current ?? 0);
    return (ov?.funnel ?? []).map((s) => ({
      label: SECTION_LABELS[s.section] ?? humanize(s.section),
      sessions: s.sessions,
      share: s.sessions / sessions,
    }));
  });

  readonly channels = computed<BarRow[]>(() => this.rows(this.overview()?.contact_by_channel, CHANNEL_LABELS));
  readonly interactions = computed<BarRow[]>(() => this.rows(this.overview()?.interactions));
  readonly languages = computed<BarRow[]>(() => this.rows(this.overview()?.site_languages, LANGUAGE_NAMES));
  readonly tech = computed<BarRow[]>(() => {
    const ov = this.overview();
    const rows = { devices: ov?.devices, browsers: ov?.browsers, os: ov?.os }[this.techTab()];
    return this.rows(rows).map((r) => ({ ...r, lead: this.techTab() === 'devices' ? deviceIcon(r.label) : undefined }));
  });
  readonly topPages = computed<BarRow[]>(() =>
    (this.overview()?.top_pages ?? []).map((p) => ({ label: p.page || '/', value: p.views })));

  readonly scroll = computed(() => {
    const sessions = Math.max(1, this.overview()?.kpis.sessions.current ?? 0);
    return (this.overview()?.scroll_depth ?? []).map((r) => ({ label: `${r.key}%`, value: r.count, share: r.count / sessions }));
  });

  readonly vitals = computed(() => {
    const v = this.overview()?.web_vitals;
    if (!v || !v.samples) return [];
    return VITALS.map((def) => {
      const value = v[def.key];
      const rating = value == null ? '' : value <= def.good ? 'good' : value <= def.poor ? 'ok' : 'poor';
      const shown = value == null ? '—' : def.unit ? `${Math.round(value)} ${def.unit}` : value.toFixed(3);
      return { ...def, shown, rating };
    });
  });

  readonly vitalsSamples = computed(() => this.overview()?.web_vitals.samples ?? 0);

  exportCsv(): void {
    const range = this.data.range();
    this.exporting.set(true);
    this.data.exportCsv(range).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `emil-analytics-${range.from}_${range.to}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        this.exporting.set(false);
      },
      error: (err) => {
        this.error.set(this.data.describeError(err));
        this.exporting.set(false);
      },
    });
  }

  private rows(rows: CountRow[] | undefined, labels: Record<string, string> = {}): BarRow[] {
    return (rows ?? []).map((r) => ({ label: labels[r.key] ?? humanize(r.key), value: r.count }));
  }
}

function deviceIcon(device: string): string {
  switch (device.toLowerCase()) {
    case 'mobile': return '📱';
    case 'tablet': return '📟';
    default: return '💻';
  }
}
