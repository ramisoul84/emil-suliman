import { isPlatformBrowser } from "@angular/common";
import { HttpClient } from "@angular/common/http";
import { Inject, Injectable, PLATFORM_ID } from "@angular/core";
import { fromEvent, merge, Observable, tap } from "rxjs";
import { v4 as uuidv4 } from 'uuid';
import { Visit, VisitStats } from "../_models/visit";
import { environment } from "../../environments/environment";

interface VisitData {
    session_id: string;
    user_id: string;
    referrer: string;
    user_agent: string;
}

interface VisitEndData {
    session_id: string;
    user_id: string;
    referrer: string;
    user_agent: string;
    start_time: string;
    duration: number;
    actions: Record<string, number>,
}

@Injectable({
    providedIn: 'root'
})
export class AnalyticsService {
    private apiUrl = environment.apiUrl;
    private isBrowser: boolean;
    private sessionId: string;
    private userId: string;

    private visitTracked = false;

    private startTime!: number;
    private visitEnded = false;

    private sessionActive = true;
    private pauseStartTime: number | null = null;
    private totalPausedTime = 0;

    private clicks = new Map<string, number>();

    constructor(
        private http: HttpClient,
        @Inject(PLATFORM_ID) private platformId: Object
    ) {
        this.isBrowser = isPlatformBrowser(this.platformId);
        this.sessionId = this.generateSessionId();
        this.userId = this.getOrCreateUserId();
    }

    trackVisit(): void {
        if (!this.isBrowser || this.visitTracked) return;
        this.startTime = Date.now();
        this.visitTracked = true;

        const visitData: VisitData = {
            session_id: this.sessionId,
            user_id: this.userId,
            referrer: document.referrer || 'direct',
            user_agent: navigator.userAgent
        };

        this.http.post(`${this.apiUrl}/analytics/visit-start`, visitData).subscribe();

        // Setup visit end tracking
        this.setupVisitEndTracking();
    }


    private setupVisitEndTracking(): void {
        // Track visibility changes for pause/resume
        fromEvent(document, 'visibilitychange').subscribe(() => {
            if (document.visibilityState === 'hidden' && this.sessionActive) {
                // Tab hidden - pause session
                this.pauseStartTime = Date.now();
                this.sessionActive = false;
            } else {
                // Tab visible again - resume session
                if (this.pauseStartTime && !this.sessionActive) {
                    const pauseDuration = (Date.now() - this.pauseStartTime) / 1000;
                    this.totalPausedTime += pauseDuration;
                    this.pauseStartTime = null;
                }
                this.sessionActive = true;
            }
        });

        // Only end session on actual unload
        const exitEvents = merge(
            fromEvent(window, 'beforeunload'),
            fromEvent(window, 'unload'),
            fromEvent(window, 'pagehide')
        );

        exitEvents.pipe(
            tap(() => {
                // Calculate actual active time (excluding paused time)
                const totalActiveTime = ((Date.now() - this.startTime) / 1000) - this.totalPausedTime;
                this.trackVisitEnd(totalActiveTime);
            })
        ).subscribe();
    }

    private trackVisitEnd(activeTime: number): void {
        if (this.visitEnded || !this.startTime) return;
        this.visitEnded = true;

        const endData: VisitEndData = {
            session_id: this.sessionId,
            user_id: this.userId,
            referrer: document.referrer || 'direct',
            user_agent: navigator.userAgent,
            start_time: new Date(this.startTime).toISOString(),
            duration: activeTime,
            actions: this.getAllClicks()
        };

        if (navigator.sendBeacon) {
            const blob = new Blob([JSON.stringify(endData)], { type: 'application/json' });
            navigator.sendBeacon(`${this.apiUrl}/analytics/visit-end`, blob);
        } else {
            // Fallback to sync XHR
            const xhr = new XMLHttpRequest();
            xhr.open('POST', `${this.apiUrl}/analytics/visit-end`, false);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.send(JSON.stringify(endData));
        }
    }

    trackAction(btn: string): void {
        const currentCount = this.clicks.get(btn) || 0;
        const newCount = currentCount + 1;
        this.clicks.set(btn, newCount);
    }

    getAllClicks(): Record<string, number> {
        return Object.fromEntries(this.clicks);
    }

    getVisits(): Observable<Visit[]> {
        return this.http.get<Visit[]>(`${this.apiUrl}/analytics/list`,)
    }

    getVisitStats(): Observable<VisitStats> {
        return this.http.get<VisitStats>(`${this.apiUrl}/analytics/stats`)
    }

    // Helper
    private generateSessionId(): string {
        return uuidv4();
    }

    private getOrCreateUserId(): string {
        try {
            let userId = localStorage.getItem('user_id');
            if (!userId) {
                userId = uuidv4();
                localStorage.setItem('user_id', userId);
            }
            return userId;
        } catch (e) {
            return this.generateSessionId();
        }
    }
}
