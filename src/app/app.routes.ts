import { Routes } from '@angular/router';

export const routes: Routes = [
    {
        path: '',
        loadComponent: () => import('./pages/main/main.component').then(m => m.MainComponent)
    },
    {
        path: 'project1',
        loadComponent: () => import('./pages/project1/project1.component').then(m => m.Project1Component)
    },
    { path: '**', redirectTo: '' }
];
