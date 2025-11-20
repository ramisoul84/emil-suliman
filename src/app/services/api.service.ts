import { HttpClient, HttpHeaders, HttpParams } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { BehaviorSubject, catchError, Observable, retry, tap, timeout } from "rxjs";
import { List, Message, MessageRequest } from "../models/message";

@Injectable()
export class ApiService {
    private readonly apiUrl = 'https://ramisuliman.ru/api/emil';
    private readonly tokenKey = 'access_token';
    private isAuthenticatedSubject = new BehaviorSubject<boolean>(this.hasToken());

    constructor(private http: HttpClient) { }

    getMessage(id: string): Observable<Message> {
        return this.http.get<Message>(`${this.apiUrl}/message/${id}`, { headers: this.getHeaders() })
    }

    getList(limit: number = 10, offset: number = 0): Observable<List> {
        const params = new HttpParams()
            .set('limit', limit.toString())
            .set('offset', offset.toString());

        return this.http.get<List>(`${this.apiUrl}/message`, { headers: this.getHeaders(), params })
    }

    sendMessage(message: MessageRequest): Observable<void> {
        return this.http.post<void>(`${this.apiUrl}/message`, message)
    }

    markMessageAsRead(id: string): Observable<void> {
        return this.http.put<void>(`${this.apiUrl}/message/${id}`,{}, { headers: this.getHeaders() })
    }

    deleteMessage(id: string): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}/message/${id}`, { headers: this.getHeaders() })
    }

    login(email: string, password: string): Observable<{ access_token: string }> {
        return this.http.post<{ access_token: string }>(
            `${this.apiUrl}/auth/login`,
            { email, password }
        ).pipe(
            tap(response => {
                if (response.access_token) {
                    console.log("LOGIN SERVICE TRUE")
                    this.setToken(response.access_token);
                    this.isAuthenticatedSubject.next(true);
                }
            }),
        );
    }

    logout(): void {
        localStorage.removeItem(this.tokenKey);
        this.isAuthenticatedSubject.next(false);
    }

    getToken(): string | null {
        return localStorage.getItem(this.tokenKey);
    }

    isAuthenticated(): Observable<boolean> {
        return this.isAuthenticatedSubject.asObservable();
    }

    private hasToken(): boolean {
        return !!this.getToken();
    }


    setToken(token: string): void {
        localStorage.setItem(this.tokenKey, token);
    }


    private getHeaders(): HttpHeaders {
        const token = this.getToken();
        return new HttpHeaders({
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
        });
    }
}
