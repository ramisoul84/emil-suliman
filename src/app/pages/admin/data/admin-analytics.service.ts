import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
    DateRangeQuery,
    LiveSnapshot,
    Overview,
    SessionDetail,
    SessionsPage,
    SessionsQuery,
} from './analytics.models';

export type RangePreset = 'today' | '7d' | '30d' | '90d' | 'custom';

function isoDay(date: Date): string {
    const m = `${date.getMonth() + 1}`.padStart(2, '0');
    const d = `${date.getDate()}`.padStart(2, '0');
    return `${date.getFullYear()}-${m}-${d}`;
}

function presetRange(preset: Exclude<RangePreset, 'custom'>): DateRangeQuery {
    const to = new Date();
    const from = new Date();
    const days = { today: 0, '7d': 6, '30d': 29, '90d': 89 }[preset];
    from.setDate(from.getDate() - days);
    return { from: isoDay(from), to: isoDay(to) };
}

/**
 * Data access for the admin panel + the state shared between its pages
 * (the selected date range). One instance for the whole admin area.
 */
@Injectable({ providedIn: 'root' })
export class AdminAnalyticsService {
    private readonly http = inject(HttpClient);
    private readonly base = `${environment.apiUrl}/admin/analytics`;

    // --- Shared filter state ---
    readonly preset = signal<RangePreset>('30d');
    readonly range = signal<DateRangeQuery>(presetRange('30d'));
    readonly rangeDays = computed(() => {
        const { from, to } = this.range();
        return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
    });

    setPreset(preset: Exclude<RangePreset, 'custom'>): void {
        this.preset.set(preset);
        this.range.set(presetRange(preset));
    }

    setCustomRange(range: DateRangeQuery): void {
        this.preset.set('custom');
        this.range.set(range);
    }

    // --- Endpoints (emil-server: /api/v1/admin/analytics/*) ---

    overview(range: DateRangeQuery): Observable<Overview> {
        return this.http.get<Overview>(`${this.base}/overview`, { params: this.rangeParams(range) });
    }

    live(): Observable<LiveSnapshot> {
        return this.http.get<LiveSnapshot>(`${this.base}/live`);
    }

    sessions(query: SessionsQuery): Observable<SessionsPage> {
        let params = this.rangeParams(query).set('limit', query.limit).set('offset', query.offset);
        if (query.converted) params = params.set('converted', 'true');
        if (query.country) params = params.set('country', query.country);
        if (query.source) params = params.set('source', query.source);
        return this.http.get<SessionsPage>(`${this.base}/sessions`, { params });
    }

    session(id: string): Observable<SessionDetail> {
        return this.http.get<SessionDetail>(`${this.base}/sessions/${encodeURIComponent(id)}`);
    }

    /** Raw events of the range as CSV. */
    exportCsv(range: DateRangeQuery): Observable<Blob> {
        return this.http.get(`${this.base}/export.csv`, {
            params: this.rangeParams(range),
            responseType: 'blob',
        });
    }

    /** Human-readable message for a failed request. */
    describeError(err: unknown): string {
        if (err instanceof HttpErrorResponse) {
            if (err.status === 0) return 'Cannot reach the analytics server.';
            if (err.status === 401) return 'Session expired — sign in again.';
            if (err.status === 404) return 'Not found.';
            return err.error?.error?.message ?? `Request failed (${err.status}).`;
        }
        return err instanceof Error ? err.message : 'Unexpected error.';
    }

    private rangeParams(range: DateRangeQuery): HttpParams {
        return new HttpParams().set('from', range.from).set('to', range.to);
    }
}
