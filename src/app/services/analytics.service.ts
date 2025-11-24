// src/app/services/analytics.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({
    providedIn: 'root'
})
export class AnalyticsService {
    private readonly COOKIE_NAME = 'visit_tracked';
    private readonly COOKIE_MAX_AGE = 30 * 60; // 30 minutes in seconds

    constructor(private http: HttpClient) { }

    trackVisit(): void {
        console.log("trackVisit")
        if (!this.hasTrackingCookie()) {
            console.log("send")
            this.sendTrackRequest();
            this.setTrackingCookie();
        }
    }

    private hasTrackingCookie(): boolean {
        return document.cookie.includes(`${this.COOKIE_NAME}=true`);
    }


    private setTrackingCookie(): void {
        const expires = new Date();
        expires.setTime(expires.getTime() + (this.COOKIE_MAX_AGE * 1000));

        document.cookie = `${this.COOKIE_NAME}=true; expires=${expires.toUTCString()}; path=/`;
    }

    private sendTrackRequest(): void {
        this.http.get('https://ramisuliman.ru/api/emil/analytics/track')
            .subscribe({
                next: () => console.log('📊 Tracked visit'),
                error: () => console.log('⚠️ Analytics offline')
            });
    }
}