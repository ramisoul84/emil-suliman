import { Injectable, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { v4 as uuidv4 } from 'uuid';
import { environment } from '../../environments/environment';
import {
    ANALYTICS_OPT_OUT_KEY,
    AnalyticsEvent,
    EventPayloads,
} from './analytics-events';

interface PageViewPayload {
    page: string;
    title?: string;
}

interface SectionPayload {
    section: string;
    page?: string;
}

interface CustomPayload {
    name: string;
    data?: Record<string, unknown>;
}

interface TrafficSource {
    source: string | null;
    medium: string | null;
    campaign: string | null;
    term: string | null;
    content: string | null;
    /** snake_case to match the server (domain.TrafficSource). */
    landing_page: string;
}

const STORAGE = {
    visitor: '_vid',
    session: '_sid',
    /** Last time this session sent anything — sessions end after 30 min of inactivity. */
    lastActivity: '_sid_last',
} as const;

const HEARTBEAT_MS = 15_000;
const SCROLL_THRESHOLDS = [25, 50, 75, 100] as const;
/** Routes that are never tracked (the admin panel itself). */
const UNTRACKED_PREFIXES = ['/admin'];
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const PAGEVIEW_DEDUP_WINDOW_MS = 500;

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
    private readonly doc = inject(DOCUMENT);
    private readonly base = `${environment.apiUrl}/analytics`;

    // --- State ---
    private readonly _visitorId = signal<string | null>(null);
    private readonly _sessionId = signal<string | null>(null);
    private readonly _currentPage = signal<string>('');
    private readonly _enabled = signal<boolean>(true);

    // --- Dedup guard ---
    private lastTrackedPage = '';
    private lastTrackedAt = 0;

    // --- Timers ---
    private pageEnterTime = 0;
    private engagedTimeMs = 0;
    private lastTickAt = 0;
    private isPageActive = false;
    private heartbeatId: ReturnType<typeof setInterval> | null = null;

    // --- Scroll depth (reset per pageview) ---
    private readonly scrollReached = new Set<number>();
    private scrollFrame = 0;

    // --- Web vitals (sent once per visit) ---
    private readonly vitals: EventPayloads['web_vitals'] = {};
    private vitalsSent = false;

    private siteLanguage: string | null = null;

    // --- Refs ---
    private readonly initialReferrer = this.doc.referrer || null;
    private readonly initialTraffic = this.readTrafficSource();

    constructor() {
        this._enabled.set(!this.isDoNotTrack() && !AnalyticsService.isOptedOut());
        if (this._enabled()) this.init();
    }

    private initialized = false;

    private init(): void {
        if (this.initialized) return;
        this.initialized = true;

        this._visitorId.set(this.getOrCreateVisitorId());
        this._sessionId.set(this.getOrCreateSessionId());
        this.isPageActive = this.doc.visibilityState === 'visible';

        this.attachListeners();
        this.observeWebVitals();
        this.startHeartbeat();
    }

    /** True when this browser was excluded from analytics (Admin → Settings). */
    static isOptedOut(): boolean {
        try {
            return localStorage.getItem(ANALYTICS_OPT_OUT_KEY) === '1';
        } catch {
            return false;
        }
    }

    /** Persistently exclude (or re-include) this browser. */
    setOptOut(optOut: boolean): void {
        try {
            if (optOut) localStorage.setItem(ANALYTICS_OPT_OUT_KEY, '1');
            else localStorage.removeItem(ANALYTICS_OPT_OUT_KEY);
        } catch {
            // Storage blocked — the flag just won't persist.
        }
        const enabled = !optOut && !this.isDoNotTrack();
        if (enabled) this.init();
        this.setEnabled(enabled);
    }

    /** Language the visitor is reading the site in (sent with every event). */
    setSiteLanguage(lang: string): void {
        this.siteLanguage = lang;
    }

    /** Typed custom event — see analytics-events.ts for names and payloads. */
    track<K extends keyof EventPayloads>(name: K, data: EventPayloads[K]): void {
        this.trackCustom({ name, data: data as Record<string, unknown> });
    }

    /**
     * A plain interaction (slider, cases, blob, whale game…), shown under
     * "Interactions" in the admin panel. 'case next' is stored as case_next.
     */
    trackAction(action: string): void {
        const name = action.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
        if (name) this.trackCustom({ name });
    }

    /** Ids to attach to a contact-form message, so the inbox can link it to the visit. */
    get ids(): { visitor_id: string | null; session_id: string | null } {
        return { visitor_id: this._visitorId(), session_id: this._sessionId() };
    }

    get siteLang(): string | null {
        return this.siteLanguage;
    }

    // ---------------------------------------------------------------------------
    // PUBLIC API
    // ---------------------------------------------------------------------------

    trackPageView(payload: PageViewPayload): void {
        if (!this._enabled() || !payload.page) return;

        if (UNTRACKED_PREFIXES.some((prefix) => payload.page.startsWith(prefix))) {
            // Close out the previous public page, then go quiet while in the admin panel.
            if (this._currentPage()) this.trackPageLeave();
            return;
        }

        // Dedup guard: skip if the same page was tracked within the window.
        // Prevents the OnInit + initial NavigationEnd double-fire.
        const now = Date.now();
        if (
            payload.page === this.lastTrackedPage &&
            now - this.lastTrackedAt < PAGEVIEW_DEDUP_WINDOW_MS
        ) {
            return;
        }
        // SPA navigation: close out the previous page so time-on-page is per page.
        if (this._currentPage() && this._currentPage() !== payload.page) {
            this.trackPageLeave();
        }

        this.lastTrackedPage = payload.page;
        this.lastTrackedAt = now;
        this.scrollReached.clear();

        if (this.isSessionExpired()) this.startNewSession();

        this._currentPage.set(payload.page);
        this.pageEnterTime = now;
        this.lastTickAt = now;
        this.engagedTimeMs = 0;
        this.isPageActive = this.doc.visibilityState === 'visible';

        this.send({
            event_type: 'pageview',
            page: payload.page,
            page_title: payload.title ?? this.doc.title,
            traffic: this.initialTraffic,
        });
    }

    trackPageLeave(page?: string): void {
        const current = page ?? this._currentPage();
        if (!this._enabled() || !current || !this.pageEnterTime) return;

        this.flushActiveTime();

        const totalSeconds = Math.max(0, Math.round((Date.now() - this.pageEnterTime) / 1000));
        const engagedSeconds = Math.max(0, Math.round(this.engagedTimeMs / 1000));

        this.send({
            event_type: 'leave',
            page: current,
            time_spent_seconds: totalSeconds,
            engaged_time_seconds: engagedSeconds,
        });

        this._currentPage.set('');
        this.pageEnterTime = 0;
        this.engagedTimeMs = 0;
        this.isPageActive = false;

        // Reset the dedup guard so returning to the same page fires again.
        this.lastTrackedPage = '';
        this.lastTrackedAt = 0;
    }

    trackSectionView(payload: SectionPayload): void {
        if (!this._enabled() || !payload.section) return;

        this.send({
            event_type: 'section_view',
            section: payload.section,
            page: payload.page ?? (this._currentPage() || this.doc.location.pathname),
        });
    }

    trackCustom(payload: CustomPayload): void {
        if (!this._enabled() || !payload.name) return;

        this.send({
            event_type: 'custom',
            name: payload.name,
            data: payload.data ?? {},
            page: this._currentPage() || this.doc.location.pathname,
        });
    }

    private setEnabled(enabled: boolean): void {
        this._enabled.set(enabled);
        if (!enabled) {
            this.stopHeartbeat();
        } else {
            this.startHeartbeat();
        }
    }

    // ---------------------------------------------------------------------------
    // INTERNALS
    // ---------------------------------------------------------------------------

    private attachListeners(): void {
        const win = this.doc.defaultView;
        if (!win) return;

        // pagehide (not beforeunload) — it also fires on mobile and keeps the back/forward cache usable.
        win.addEventListener('pagehide', () => {
            this.sendWebVitals();
            this.trackPageLeave();
        });
        win.addEventListener('scroll', () => this.onScroll(), { passive: true });

        this.doc.addEventListener('visibilitychange', () => {
            if (this.doc.visibilityState === 'hidden') {
                this.sendWebVitals();
                this.flushActiveTime();
                this.isPageActive = false;
                return;
            }
            // Back after 30+ idle minutes: that's a new visit to the page they left open.
            const page = this._currentPage();
            if (page && this.isSessionExpired()) {
                this.trackPageLeave(); // closes the page in the old session
                this.startNewSession();
                this.trackPageView({ page });
                return;
            }
            this.isPageActive = true;
            this.lastTickAt = Date.now();
        });
    }

    private startHeartbeat(): void {
        if (this.heartbeatId || !this._enabled()) return;

        this.lastTickAt = Date.now();
        this.heartbeatId = setInterval(() => {
            // Nothing to report from a background tab — and it would keep the visitor "live".
            if (!this._currentPage() || this.doc.visibilityState !== 'visible') return;

            this.flushActiveTime();
            this.send({
                event_type: 'heartbeat',
                page: this._currentPage(),
                engaged_time_seconds: Math.max(0, Math.round(this.engagedTimeMs / 1000)),
            });
        }, HEARTBEAT_MS);
    }

    // ---------------------------------------------------------------------------
    // SCROLL DEPTH
    // ---------------------------------------------------------------------------

    private onScroll(): void {
        if (this.scrollFrame || !this._currentPage()) return;

        this.scrollFrame = requestAnimationFrame(() => {
            this.scrollFrame = 0;
            const win = this.doc.defaultView;
            const root = this.doc.documentElement;
            if (!win) return;

            const scrollable = root.scrollHeight - win.innerHeight;
            const percent = scrollable <= 0 ? 100 : ((win.scrollY + win.innerHeight) / root.scrollHeight) * 100;

            for (const threshold of SCROLL_THRESHOLDS) {
                // 98 % counts as "the bottom" — the footer rarely clears the viewport exactly.
                const reached = threshold === 100 ? percent >= 98 : percent >= threshold;
                if (reached && !this.scrollReached.has(threshold)) {
                    this.scrollReached.add(threshold);
                    this.track(AnalyticsEvent.ScrollDepth, { percent: threshold });
                }
            }
        });
    }

    // ---------------------------------------------------------------------------
    // WEB VITALS (no dependency — PerformanceObserver directly)
    // ---------------------------------------------------------------------------

    private observeWebVitals(): void {
        const win = this.doc.defaultView;
        if (!win || typeof PerformanceObserver === 'undefined') return;

        const observe = (type: string, onEntries: (entries: PerformanceEntry[]) => void, extra = {}) => {
            try {
                new PerformanceObserver((list) => onEntries(list.getEntries()))
                    .observe({ type, buffered: true, ...extra } as PerformanceObserverInit);
            } catch {
                // Entry type not supported by this browser — skip it.
            }
        };

        observe('largest-contentful-paint', (entries) => {
            const last = entries.at(-1);
            if (last) this.vitals.lcp_ms = Math.round(last.startTime);
        });

        observe('layout-shift', (entries) => {
            for (const entry of entries as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) {
                if (!entry.hadRecentInput) this.vitals.cls = +((this.vitals.cls ?? 0) + entry.value).toFixed(4);
            }
        });

        // INP approximation: the slowest interaction seen during the visit.
        observe('event', (entries) => {
            for (const entry of entries) {
                this.vitals.inp_ms = Math.max(this.vitals.inp_ms ?? 0, Math.round(entry.duration));
            }
        }, { durationThreshold: 40 });

        const nav = win.performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
        if (nav) this.vitals.ttfb_ms = Math.round(nav.responseStart);
    }

    private sendWebVitals(): void {
        if (this.vitalsSent || Object.keys(this.vitals).length === 0) return;
        this.vitalsSent = true;
        this.track(AnalyticsEvent.WebVitals, { ...this.vitals });
    }

    private stopHeartbeat(): void {
        if (this.heartbeatId) {
            clearInterval(this.heartbeatId);
            this.heartbeatId = null;
        }
    }

    private flushActiveTime(): void {
        if (!this.isPageActive) return;

        const now = Date.now();
        const delta = now - this.lastTickAt;
        if (delta > 0) this.engagedTimeMs += delta;
        this.lastTickAt = now;
    }

    private send(payload: Record<string, unknown>): void {
        if (!this._enabled()) return;

        const win = this.doc.defaultView;
        const nav = win?.navigator;
        const scr = win?.screen;

        writeStorage(sessionStorage, STORAGE.lastActivity, Date.now().toString());

        const body = JSON.stringify({
            session_id: this._sessionId(),
            visitor_id: this._visitorId(),
            referrer: this.initialReferrer,
            language: nav?.language ?? null,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            viewport: win ? `${win.innerWidth}x${win.innerHeight}` : null,
            screen: scr ? `${scr.width}x${scr.height}` : null,
            user_agent: nav?.userAgent ?? null,
            site_language: this.siteLanguage,
            timestamp: new Date().toISOString(),
            ...payload,
        });

        // sendBeacon is best-effort — it survives page unload and works
        // without blocking the main thread. The API is on another domain: text/plain
        // keeps it a CORS "simple" request (no preflight, which a beacon would fail);
        // the server reads the body as JSON regardless.
        const beaconSent = nav?.sendBeacon?.(
            `${this.base}/event`,
            new Blob([body], { type: 'text/plain' }),
        );

        if (!beaconSent) {
            fetch(`${this.base}/event`, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body,
                keepalive: true,
                credentials: 'omit',
            }).catch(() => {
                // Silent — analytics must never break the user experience.
            });
        }
    }

    private getOrCreateVisitorId(): string {
        let id = readStorage(localStorage, STORAGE.visitor);
        if (!id) {
            id = uuidv4();
            writeStorage(localStorage, STORAGE.visitor, id);
        }
        return id;
    }

    private getOrCreateSessionId(): string {
        const id = readStorage(sessionStorage, STORAGE.session);
        return id && !this.isSessionExpired() ? id : this.startNewSession();
    }

    private isSessionExpired(): boolean {
        const last = Number(readStorage(sessionStorage, STORAGE.lastActivity) ?? 0);
        return last > 0 && Date.now() - last > SESSION_TIMEOUT_MS;
    }

    private startNewSession(): string {
        const id = uuidv4();
        writeStorage(sessionStorage, STORAGE.session, id);
        writeStorage(sessionStorage, STORAGE.lastActivity, Date.now().toString());
        this._sessionId.set(id);
        this.lastTickAt = Date.now();
        return id;
    }

    private isDoNotTrack(): boolean {
        const win = this.doc.defaultView as (Window & { doNotTrack?: string }) | null;
        const nav = win?.navigator as (Navigator & {
            doNotTrack?: string;
            globalPrivacyControl?: boolean;
        }) | null;

        const dnt = nav?.doNotTrack ?? win?.doNotTrack;
        const gpc = nav?.globalPrivacyControl === true;

        return dnt === '1' || dnt === 'yes' || gpc;
    }

    private readTrafficSource(): TrafficSource {
        const win = this.doc.defaultView;
        const params = new URLSearchParams(win?.location.search ?? '');

        return {
            source: params.get('utm_source'),
            medium: params.get('utm_medium'),
            campaign: params.get('utm_campaign'),
            term: params.get('utm_term'),
            content: params.get('utm_content'),
            landing_page: `${win?.location.pathname ?? ''}${win?.location.search ?? ''}`,
        };
    }
}

// Storage can throw (private mode, blocked cookies) — analytics then runs without persistence.
function readStorage(storage: Storage, key: string): string | null {
    try {
        return storage.getItem(key);
    } catch {
        return null;
    }
}

function writeStorage(storage: Storage, key: string, value: string): void {
    try {
        storage.setItem(key, value);
    } catch {
        // Ignore.
    }
}
