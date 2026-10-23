/** Formatting shared by the admin pages, so tiles, lists and charts agree. */

export function formatDuration(seconds: number | null | undefined): string {
    if (seconds == null) return '—';
    const s = Math.max(0, Math.round(seconds));
    if (s < 60) return `${s}s`;
    if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
    return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

/** ISO-3166 alpha-2 → flag emoji; anything else → globe. */
export function flag(code: string | null | undefined): string {
    const c = (code ?? '').trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(c)) return '🌐';
    return String.fromCodePoint(...[...c].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
}

const regionNames = (() => {
    try {
        return new Intl.DisplayNames(['en'], { type: 'region' });
    } catch {
        return null;
    }
})();

/** 'DE' → 'Germany' (falls back to the code). */
export function countryName(code: string | null | undefined): string {
    if (!code) return 'Unknown';
    try {
        return regionNames?.of(code.toUpperCase()) ?? code;
    } catch {
        return code;
    }
}

export function place(country: string | null | undefined, city: string | null | undefined): string {
    const name = country ? countryName(country) : '';
    return [city, name].filter(Boolean).join(', ') || 'Unknown location';
}

/** '2026-10-23' → '23 Oct'. */
export function shortDate(day: string): string {
    const d = new Date(`${day}T00:00:00`);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** Section ids on the home page → names Emil uses. */
export const SECTION_LABELS: Record<string, string> = {
    home: 'Home', about: 'About', timeline: 'Timeline', cases: 'Projects', solidarity: 'Solidarity', contact: 'Contact',
};

export const CHANNEL_LABELS: Record<string, string> = {
    email: 'E-mail', whatsapp: 'WhatsApp', telegram: 'Telegram', instagram: 'Instagram', linkedin: 'LinkedIn', youtube: 'YouTube',
};

export const LANGUAGE_NAMES: Record<string, string> = { en: 'English', de: 'German' };

/** case_next → 'Case next'. */
export function humanize(key: string): string {
    const s = key.replace(/_/g, ' ').trim();
    return s ? s[0].toUpperCase() + s.slice(1) : key;
}
