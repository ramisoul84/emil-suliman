/**
 * Custom analytics events — shared by the tracker (public site) and the admin
 * dashboard so both sides agree on names and payloads.
 *
 * Every event is sent as `event_type: 'custom'` with `name` + `data`, which the
 * backend stores (custom_name / custom_data).
 */
export const AnalyticsEvent = {
    /** Opened a contact channel (email, WhatsApp, Telegram, Instagram…). A conversion. */
    ContactClick: 'contact_click',
    /** The contact form went through. A conversion (the message itself is in the inbox). */
    MessageSent: 'message_sent',
    /** Switched the site language. */
    LanguageChange: 'language_change',
    /** Reached 25 / 50 / 75 / 100 % of the page (once per threshold per pageview). */
    ScrollDepth: 'scroll_depth',
    /** Core Web Vitals of the visit (LCP, CLS, INP, TTFB). */
    WebVitals: 'web_vitals',
} as const;

export type AnalyticsEventName = (typeof AnalyticsEvent)[keyof typeof AnalyticsEvent];

/** Events that count as a conversion ("this visitor wants to get in touch"). */
export const CONVERSION_EVENTS: readonly AnalyticsEventName[] = [
    AnalyticsEvent.ContactClick,
    AnalyticsEvent.MessageSent,
];

export type ContactChannel = 'email' | 'whatsapp' | 'telegram' | 'instagram' | 'linkedin' | 'youtube';

export interface EventPayloads {
    contact_click: { channel: ContactChannel; source: string };
    message_sent: { lang: string };
    language_change: { from: string; to: string };
    scroll_depth: { percent: 25 | 50 | 75 | 100 };
    web_vitals: { lcp_ms?: number; cls?: number; inp_ms?: number; ttfb_ms?: number };
}

/** localStorage flag: when set, this browser sends no analytics (used for the site owner). */
export const ANALYTICS_OPT_OUT_KEY = '_analytics_opt_out';
