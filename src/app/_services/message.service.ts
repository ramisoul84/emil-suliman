import { HttpClient, HttpParams } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { Observable } from "rxjs";
import { Message, MessageList, MessageRequest } from "../_models/message";
import { environment } from "../../environments/environment";
import { AnalyticsService } from "./analytics.service";

@Injectable({
    providedIn: 'root'
})
export class MessageService {
    private readonly http = inject(HttpClient);
    private readonly analytics = inject(AnalyticsService);
    private readonly apiUrl = environment.apiUrl;

    /** The contact form. `website` is the honeypot: people leave it empty, bots don't. */
    sendMessage(message: MessageRequest, website = ''): Observable<void> {
        return this.http.post<void>(`${this.apiUrl}/messages`, {
            ...message,
            ...this.analytics.ids,
            site_language: this.analytics.siteLang,
            website,
        });
    }

    // --- Admin inbox ---

    getList(limit = 20, offset = 0, unreadOnly = false): Observable<MessageList> {
        let params = new HttpParams().set('limit', limit).set('offset', offset);
        if (unreadOnly) params = params.set('unread', 'true');
        return this.http.get<MessageList>(`${this.apiUrl}/admin/messages`, { params });
    }

    getMessage(id: number): Observable<Message> {
        return this.http.get<Message>(`${this.apiUrl}/admin/messages/${id}`);
    }

    setUnread(id: number, unread: boolean): Observable<void> {
        return this.http.patch<void>(`${this.apiUrl}/admin/messages/${id}`, { unread });
    }

    deleteMessage(id: number): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}/admin/messages/${id}`);
    }
}
