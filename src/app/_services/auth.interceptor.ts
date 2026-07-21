import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

const PUBLIC_ROUTES: string[] = [
    '/auth/login',
    '/analytics/visit-start',
    '/analytics/visit-end',
    '/message/save'
];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (isPublicRoute(req.url)) {
        // For public routes, proceed without token
        return next(req).pipe(
            catchError((error) => {
                // Still handle errors but don't redirect to login for public routes
                return throwError(() => error);
            })
        );
    }

    const token = authService['getToken']();

    const authReq = token
        ? req.clone({
            headers: req.headers.set('Authorization', `Bearer ${token}`)
        })
        : req;

    return next(authReq).pipe(
        catchError((error) => {
            if (error.status === 401) {
                authService.logout();
                router.navigate(['/']);
            }
            return throwError(() => error);
        })
    );
};

function isPublicRoute(url: string): boolean {
    // Remove domain and query parameters
    const cleanUrl = cleanUrlPath(url);

    // Check if the URL matches any public route pattern
    return PUBLIC_ROUTES.some(route =>
        cleanUrl.includes(route) || cleanUrl.endsWith(route)
    );
}

function cleanUrlPath(url: string): string {
    try {
        // Create URL object to easily parse
        const urlObj = new URL(url, window.location.origin);

        // Get just the pathname
        let path = urlObj.pathname;

        // Remove /api/v1 prefix if present
        path = path.replace(/^\/api\/v1/, '');

        return path;
    } catch {
        // Fallback for relative URLs or parsing errors
        let path = url;

        // Remove domain if present
        path = path.replace(/^https?:\/\/[^\/]+/, '');

        // Remove /api/v1 prefix
        path = path.replace(/^\/api\/v1/, '');

        // Remove query parameters
        path = path.split('?')[0];

        return path;
    }
}
