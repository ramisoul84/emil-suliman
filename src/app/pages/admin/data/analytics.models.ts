/**
 * Admin analytics API contract.
 *
 * These types ARE the contract the Go backend (emil-server) implements — keep the JSON
 * names in sync with emil-server/internal/domain/analytics.go.
 * All dates are ISO-8601; all durations are seconds.
 */

export interface DateRangeQuery {
    /** Inclusive, YYYY-MM-DD (visitor-agnostic, server timezone). */
    from: string;
    /** Inclusive, YYYY-MM-DD. */
    to: string;
}

/** A metric for the selected range plus the same-length period right before it. */
export interface Kpi {
    current: number;
    previous: number;
}

export interface OverviewKpis {
    visitors: Kpi;
    sessions: Kpi;
    pageviews: Kpi;
    /** Mean engaged (tab visible) seconds per session. */
    avg_engaged_seconds: Kpi;
    /** Share of sessions with one pageview and < 10 s engaged, 0–1. */
    bounce_rate: Kpi;
    /** Share of visitors seen before the range start, 0–1. */
    returning_rate: Kpi;
    /** Contact-form messages received. */
    messages: Kpi;
    contact_clicks: Kpi;
    /** Share of sessions with a contact click or a sent message, 0–1. */
    conversion_rate: Kpi;
}

export interface TimeseriesPoint {
    date: string;
    visitors: number;
    sessions: number;
    pageviews: number;
    conversions: number;
}

export interface CountRow {
    key: string;
    count: number;
}

export interface SourceRow {
    /** Normalised: 'direct', 'google', 'instagram', 'linkedin', 'youtube', 'telegram', or a hostname. */
    source: string;
    visitors: number;
    conversions: number;
}

export interface CampaignRow {
    campaign: string;
    source: string | null;
    medium: string | null;
    visitors: number;
    conversions: number;
}

export interface LocationRow {
    /** ISO-3166 alpha-2. */
    country: string;
    city: string | null;
    visitors: number;
}

export interface FunnelStep {
    /** Section id: home, about, timeline, cases, contact. */
    section: string;
    /** Sessions that reached this section. */
    sessions: number;
}

export interface HeatmapCell {
    /** 0 = Monday … 6 = Sunday. */
    weekday: number;
    /** 0–23, server timezone. */
    hour: number;
    visitors: number;
}

export interface PageRow {
    page: string;
    views: number;
    avg_engaged_seconds: number;
}

export interface WebVitalsSummary {
    /** 75th percentile across visits; null when no samples. */
    lcp_p75_ms: number | null;
    cls_p75: number | null;
    inp_p75_ms: number | null;
    ttfb_p75_ms: number | null;
    samples: number;
}

export interface Overview {
    range: DateRangeQuery & { previous_from: string; previous_to: string };
    kpis: OverviewKpis;
    timeseries: TimeseriesPoint[];
    sources: SourceRow[];
    campaigns: CampaignRow[];
    locations: LocationRow[];
    devices: CountRow[];
    browsers: CountRow[];
    os: CountRow[];
    /** Language the site was read in (site_language), by sessions. */
    site_languages: CountRow[];
    /** navigator.language, by visitors. */
    browser_languages: CountRow[];
    funnel: FunnelStep[];
    /** Sessions reaching each scroll threshold (25/50/75/100) on the home page. */
    scroll_depth: CountRow[];
    contact_by_channel: CountRow[];
    /** Every other custom event name → count (case_next, slide_next, blob, whale_game, …). */
    interactions: CountRow[];
    top_pages: PageRow[];
    heatmap: HeatmapCell[];
    web_vitals: WebVitalsSummary;
}

export interface LivePage {
    page: string;
    visitors: number;
}

export interface LiveSnapshot {
    visitors: number;
    window_seconds: number;
    pages: LivePage[];
}

export interface SessionSummary {
    session_id: string;
    visitor_id: string;
    started_at: string;
    ended_at: string;
    duration_seconds: number;
    engaged_seconds: number;
    pageviews: number;
    country: string | null;
    city: string | null;
    device: 'desktop' | 'mobile' | 'tablet' | 'bot' | string;
    os: string | null;
    browser: string | null;
    browser_language: string | null;
    site_language: string | null;
    source: string;
    referrer: string | null;
    utm_campaign: string | null;
    landing_page: string;
    /** Visitor had at least one earlier session. */
    is_returning: boolean;
    /** Conversion event names that happened in this session. */
    conversions: string[];
    /** Deepest scroll threshold reached, 0 if none. */
    max_scroll: number;
    sections: string[];
}

export interface SessionsQuery extends DateRangeQuery {
    limit: number;
    offset: number;
    /** Only sessions with a contact click or a sent message. */
    converted?: boolean;
    country?: string;
    source?: string;
}

export interface SessionsPage {
    total: number;
    sessions: SessionSummary[];
}

export interface SessionEvent {
    at: string;
    type: 'pageview' | 'leave' | 'section_view' | 'heartbeat' | 'click' | 'custom';
    page: string | null;
    section: string | null;
    /** custom_name for custom events. */
    name: string | null;
    data: Record<string, unknown> | null;
    engaged_seconds: number | null;
}

export interface SessionDetail {
    session: SessionSummary;
    events: SessionEvent[];
}
