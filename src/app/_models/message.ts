/** A contact-form message, as the admin API returns it. */
export interface Message {
    id: number;
    name: string;
    email: string;
    text: string;
    visitor_id: string | null;
    session_id: string | null;
    site_language: string | null;
    ip: string;
    /** ISO-3166 alpha-2, '' when unknown. */
    country: string;
    city: string;
    device: string;
    os: string;
    browser: string;
    unread: boolean;
    created_at: string;
}

export interface MessageRequest {
    name: string;
    email: string;
    text: string;
}

export interface MessageList {
    total: number;
    unread: number;
    messages: Message[];
}
