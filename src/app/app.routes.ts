import { Routes } from '@angular/router';

export const routes: Routes = [
    {
        path: '',
        loadComponent: () => import('./pages/main/main').then(m => m.Main),
        title: 'Emil Suliman | Design Solutions - Innovative Digital Experiences'
    },
    {
        path: 'admin',
        loadComponent: () => import('./pages/admin/admin').then(m => m.Admin),
        title: 'Emil Suliman | Admin',
        canActivate: [] // Add guard here when ready
    },
    {
        path: 'imprint',
        loadComponent: () => import('./pages/imprint/imprint').then(m => m.Imprint),
        title: 'Emil Suliman | Imprint',
        data: { 
            animation: 'imprint',
            description: 'Legal information and imprint'
        }
    },
    {
        path: 'privacy',
        loadComponent: () => import('./pages/privacy/privacy').then(m => m.Privacy),
        title: 'Emil Suliman | Privacy',
        data: { 
            animation: 'privacy',
            description: 'Privacy policy and data protection'
        }
    },
    {
        path: '404',
        loadComponent: () => import('./pages/not-found/not-found').then(m => m.NotFound),
        title: 'Emil Suliman | Page Not Found'
    },
    { 
        path: '**', 
        redirectTo: '404',
        pathMatch: 'full'
    }
];