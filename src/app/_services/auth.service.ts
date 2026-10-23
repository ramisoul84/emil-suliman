import { HttpClient, HttpErrorResponse } from "@angular/common/http";
import { Injectable, inject, signal } from "@angular/core";
import { Observable, catchError, tap, throwError } from "rxjs";
import { environment } from "../../environments/environment";

interface LoginResponse {
    token: string;
    /** Seconds until the token expires. */
    expiresIn: number;
}

const TOKEN_KEY = 'access_token';
const EXPIRES_KEY = 'access_token_expires';

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private readonly http = inject(HttpClient);
    private readonly apiUrl = environment.apiUrl;

    /** Signed in with a token that hasn't expired. */
    readonly isAuthenticated = signal(this.getToken() !== null);

    login(username: string, password: string): Observable<LoginResponse> {
        return this.http.post<LoginResponse>(`${this.apiUrl}/auth/login`, { username, password }).pipe(
            tap(({ token, expiresIn }) => {
                write(TOKEN_KEY, token);
                write(EXPIRES_KEY, String(Date.now() + expiresIn * 1000));
                this.isAuthenticated.set(true);
            }),
            catchError((error: HttpErrorResponse) => throwError(() => ({
                status: error.status,
                message: loginError(error),
            }))),
        );
    }

    logout(): void {
        remove(TOKEN_KEY);
        remove(EXPIRES_KEY);
        this.isAuthenticated.set(false);
    }

    getToken(): string | null {
        const token = read(TOKEN_KEY);
        const expires = Number(read(EXPIRES_KEY) ?? 0);
        if (!token || (expires && Date.now() >= expires)) return null;
        return token;
    }
}

function loginError(error: HttpErrorResponse): string {
    switch (error.status) {
        case 0: return 'Cannot reach the server.';
        case 401: return 'Wrong username or password.';
        case 429: return 'Too many attempts — wait a minute.';
        default: return error.error?.error?.message ?? `Login failed (${error.status}).`;
    }
}

// Storage can throw (private mode, blocked site data): then the admin just signs in again.
function read(key: string): string | null {
    try { return localStorage.getItem(key); } catch { return null; }
}
function write(key: string, value: string): void {
    try { localStorage.setItem(key, value); } catch { /* not persisted */ }
}
function remove(key: string): void {
    try { localStorage.removeItem(key); } catch { /* nothing to remove */ }
}
