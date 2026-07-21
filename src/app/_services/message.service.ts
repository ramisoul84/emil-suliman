import { HttpClient, HttpParams } from "@angular/common/http";
import { Inject, Injectable, PLATFORM_ID } from "@angular/core";
import { Message, MessageList, MessageRequest } from "../_models/message";
import { Observable } from "rxjs";
import { isPlatformBrowser } from "@angular/common";
import { environment } from "../../environments/environment";

@Injectable({
    providedIn: 'root'
})
export class MessageService {
    private apiUrl = environment.apiUrl;
    private isBrowser: boolean;

    constructor(
        private http: HttpClient,
        @Inject(PLATFORM_ID) private platformId: Object
    ) {
        this.isBrowser = isPlatformBrowser(this.platformId);
    }

    sendMessage(message: MessageRequest): Observable<void> {
        message.user_id = this.getUserId()!
        return this.http.post<void>(`${this.apiUrl}/message/save`, message)
    }

    markMessageAsRead(id: string): Observable<void> {
        return this.http.put<void>(`${this.apiUrl}/message/${id}`, {})
    }

    getMessage(id: string): Observable<Message> {
        return this.http.get<Message>(`${this.apiUrl}/message/${id}`)
    }

    getList(limit: number = 10, offset: number = 0): Observable<MessageList> {
        const params = new HttpParams()
            .set('limit', limit.toString())
            .set('offset', offset.toString());
        return this.http.get<MessageList>(`${this.apiUrl}/message`, { params })
    }

    deleteMessage(id: string): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}/message/${id}`)
    }


    private getUserId(): string | null {
        if (this.isBrowser) {
            return localStorage.getItem("user_id");
        }
        return null;
    }

}