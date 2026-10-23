import { HttpClient, HttpErrorResponse } from "@angular/common/http";
import { Inject, Injectable, PLATFORM_ID } from "@angular/core";
import { BehaviorSubject, catchError, map, Observable, tap, throwError, } from "rxjs";
import { isPlatformBrowser } from "@angular/common";
import { environment } from "../../environments/environment";

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private apiUrl = environment.apiUrl;
    private readonly tokenKey = 'access_token';
    private isBrowser: boolean;

    private isAuthenticatedSubject = new BehaviorSubject<boolean>(this.hasToken());
    public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

    constructor(
        private http: HttpClient,
        @Inject(PLATFORM_ID) private platformId: Object
    ) {
        this.isBrowser = isPlatformBrowser(this.platformId);
    }

    login(email: string, password: string): Observable<{ token: string }> {
        return this.http.post<{ token: string }>(
            `${this.apiUrl}/auth/login`,
            { email, password }
        ).pipe(
            tap(response => {
                if (response.token) {
                    this.setToken(response.token);
                    this.isAuthenticatedSubject.next(true);
                }
            }),
            catchError(this.handleError)
        );
    }

    logout(): void {
        this.removeToken();
        this.isAuthenticatedSubject.next(false);
    }

    private setToken(token: string): void {
        if (this.isBrowser) {
            localStorage.setItem(this.tokenKey, token);
        }
    }

    private removeToken(): void {
        if (this.isBrowser) {
            localStorage.removeItem(this.tokenKey);
        }
    }

    private hasToken(): boolean {
        if (this.isBrowser) {
            return !!localStorage.getItem(this.tokenKey);
        }
        return false;
    }

    private getToken(): string | null {
        if (this.isBrowser) {
            return localStorage.getItem(this.tokenKey);
        }
        return null;
    }

    isAuthenticated(): Observable<boolean> {
        return this.isAuthenticated$.pipe(
            map(isAuth => isAuth)
        );
    }

    isAuthenticatedSync(): boolean {
        return this.hasToken();
    }

    private handleError(error: HttpErrorResponse) {
        let errorMessage = 'An error occurred';

        if (error.error instanceof ErrorEvent) {
            errorMessage = error.error.message;
        } else {
            // Server-side error
            switch (error.status) {
                case 401:
                    errorMessage = 'Invalid email or password';
                    break;
                case 403:
                    errorMessage = 'Access denied';
                    break;
                case 404:
                    errorMessage = 'Resource not found';
                    break;
                case 500:
                    errorMessage = 'Server error. Please try again later.';
                    break;
                default:
                    errorMessage = error.error?.message || `Error: ${error.status}`;
            }
        }

        console.error('API Error:', error);
        return throwError(() => ({
            status: error.status,
            message: errorMessage,
            error: error.error
        }));
    }
}