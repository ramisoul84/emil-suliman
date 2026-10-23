import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, HostListener, computed, effect, inject, signal, untracked } from '@angular/core';
import { AnalyticsEvent } from '../../../_services/analytics-events';
import { AdminAnalyticsService } from '../data/admin-analytics.service';
import { SessionDetail, SessionEvent, SessionSummary } from '../data/analytics.models';
import { CHANNEL_LABELS, SECTION_LABELS, flag, formatDuration, humanize, place } from '../ui/format';

const PAGE_SIZE = 25;

const CONVERSION_LABELS: Partial<Record<string, string>> = {
  [AnalyticsEvent.ContactClick]: 'contact click',
  [AnalyticsEvent.MessageSent]: 'message',
};

interface TimelineItem {
  at: string;
  kind: 'page' | 'section' | 'conversion' | 'action' | 'leave';
  text: string;
  detail: string | null;
}

@Component({
  selector: 'app-admin-sessions',
  imports: [DatePipe, DecimalPipe],
  templateUrl: './sessions.html',
  styleUrl: './sessions.scss',
})
export class Sessions {
  readonly data = inject(AdminAnalyticsService);

  readonly sessions = signal<SessionSummary[]>([]);
  readonly total = signal(0);
  readonly page = signal(0);
  readonly convertedOnly = signal(false);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly selected = signal<SessionDetail | null>(null);
  readonly detailLoading = signal(false);

  readonly conversionLabels = CONVERSION_LABELS;
  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total() / PAGE_SIZE)));
  readonly flag = flag;
  readonly place = place;
  readonly duration = formatDuration;

  constructor() {
    // New range / filter → back to page 1
    effect(() => {
      this.data.range();
      this.convertedOnly();
      untracked(() => this.page.set(0));
    });

    effect((onCleanup) => {
      const range = this.data.range();
      const page = this.page();
      const converted = this.convertedOnly();

      this.loading.set(true);
      const sub = this.data
        .sessions({ ...range, limit: PAGE_SIZE, offset: page * PAGE_SIZE, converted })
        .subscribe({
          next: (res) => {
            this.sessions.set(res.sessions);
            this.total.set(res.total);
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

  @HostListener('document:keydown.escape')
  closeDetail(): void {
    this.selected.set(null);
  }

  open(session: SessionSummary): void {
    this.detailLoading.set(true);
    this.selected.set({ session, events: [] });
    this.data.session(session.session_id).subscribe({
      next: (detail) => {
        this.selected.set(detail);
        this.detailLoading.set(false);
      },
      error: () => this.detailLoading.set(false),
    });
  }

  sectionPath(sections: string[]): string {
    return sections.map((s) => SECTION_LABELS[s] ?? humanize(s)).join(' → ') || '—';
  }

  readonly timeline = computed<TimelineItem[]>(() =>
    (this.selected()?.events ?? [])
      .filter((e) => e.type !== 'heartbeat' && !(e.type === 'custom' && e.name === AnalyticsEvent.WebVitals))
      .map((e) => this.describe(e)),
  );

  private describe(e: SessionEvent): TimelineItem {
    const data = e.data ?? {};
    switch (e.type) {
      case 'pageview':
        return { at: e.at, kind: 'page', text: `opened ${e.page ?? '/'}`, detail: null };
      case 'leave':
        return { at: e.at, kind: 'leave', text: `left ${e.page ?? '/'}`, detail: e.engaged_seconds != null ? `${formatDuration(e.engaged_seconds)} engaged` : null };
      case 'section_view':
        return { at: e.at, kind: 'section', text: `reached ${SECTION_LABELS[e.section ?? ''] ?? e.section}`, detail: null };
      case 'click':
        return { at: e.at, kind: 'action', text: 'click', detail: JSON.stringify(data) };
      default:
        break;
    }

    switch (e.name) {
      case AnalyticsEvent.ContactClick: {
        const channel = String(data['channel'] ?? '');
        return { at: e.at, kind: 'conversion', text: `opened ${CHANNEL_LABELS[channel] ?? channel}`, detail: null };
      }
      case AnalyticsEvent.MessageSent:
        return { at: e.at, kind: 'conversion', text: 'sent a message', detail: 'see Messages' };
      case AnalyticsEvent.ScrollDepth:
        return { at: e.at, kind: 'section', text: `scrolled ${data['percent']}%`, detail: null };
      case AnalyticsEvent.LanguageChange:
        return { at: e.at, kind: 'action', text: 'switched language', detail: `${data['from']} → ${data['to']}` };
      default:
        return { at: e.at, kind: 'action', text: humanize(e.name ?? 'event'), detail: Object.keys(data).length ? JSON.stringify(data) : null };
    }
  }
}
