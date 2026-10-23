import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

/** Only the admin API needs the token; nothing else (tracker, contact form, i18n files) gets it. */
const ADMIN_API = `${environment.apiUrl}/admin/`;

export const authInterceptor: HttpInterceptorFn = (req, next) => {
    if (!req.url.startsWith(ADMIN_API)) return next(req);

    const auth = inject(AuthService);
    const token = auth.getToken();
    const authReq = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

    return next(authReq).pipe(
        catchError((error) => {
            // Expired or revoked: back to the login form (the admin page shows it).
            if (error.status === 401) auth.logout();
            return throwError(() => error);
        })
    );
};
