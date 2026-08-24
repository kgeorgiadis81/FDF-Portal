import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { directorRoleGuard } from './guards/director-role.guard';
import { emailVerifiedGuard } from './guards/email-verified.guard';
import { consentGuard } from './guards/consent.guard';
import { unsavedChangesGuard } from './shared/unsaved-changes';

export const routes: Routes = [
  // Default redirect
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },

  // ─── Auth layout (unauthenticated) ────────────────────────────────────────
  {
    path: 'auth',
    loadComponent: () => import('./layouts/auth-layout/auth-layout.component').then(m => m.AuthLayoutComponent),
    children: [
      { path: '', redirectTo: 'login', pathMatch: 'full' },
      {
        path: 'login',
        loadComponent: () => import('./pages/auth/login/login.component').then(m => m.LoginComponent),
      },
      {
        path: 'signup',
        loadComponent: () => import('./pages/auth/signup/signup.component').then(m => m.SignupComponent),
      },
      {
        path: 'verify-email',
        loadComponent: () => import('./pages/auth/verify-email/verify-email.component').then(m => m.VerifyEmailComponent),
      },
      {
        path: 'forgot-password',
        loadComponent: () => import('./pages/auth/forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent),
      },
      {
        path: 'reset-password',
        loadComponent: () => import('./pages/auth/reset-password/reset-password.component').then(m => m.ResetPasswordComponent),
      },
      {
        path: 'google-complete',
        loadComponent: () => import('./pages/auth/google-complete/google-complete.component').then(m => m.GoogleCompleteComponent),
      },
    ],
  },

  // ─── Consent page (authenticated, before entering shell) ──────────────────
  {
    path: 'consent',
    canActivate: [authGuard, directorRoleGuard],
    loadComponent: () => import('./pages/consent/consent.component').then(m => m.ConsentComponent),
  },

  // ─── App shell (authenticated Director + email verified + consent) ────────
  {
    path: '',
    canActivate: [authGuard, directorRoleGuard, emailVerifiedGuard, consentGuard],
    canActivateChild: [authGuard, directorRoleGuard],
    loadComponent: () => import('./layouts/app-shell/app-shell.component').then(m => m.AppShellComponent),
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent),
      },
      {
        path: 'groups',
        children: [
          {
            path: '',
            loadComponent: () => import('./pages/groups/groups.component').then(m => m.GroupsComponent),
          },
          {
            path: 'new',
            loadComponent: () => import('./pages/groups/create-group/create-group.component').then(m => m.CreateGroupComponent),
          },
          {
            path: ':id',
            children: [
              {
                path: '',
                canDeactivate: [unsavedChangesGuard],
                loadComponent: () => import('./pages/groups/group-detail/group-detail.component').then(m => m.GroupDetailComponent),
              },
              {
                path: 'roster',
                loadComponent: () => import('./pages/groups/roster/roster.component').then(m => m.RosterComponent),
              },
              {
                path: 'performance',
                canDeactivate: [unsavedChangesGuard],
                loadComponent: () => import('./pages/groups/performance/performance.component').then(m => m.PerformanceComponent),
              },
              {
                path: 'costumes',
                canDeactivate: [unsavedChangesGuard],
                loadComponent: () => import('./pages/groups/costumes/costumes.component').then(m => m.CostumesComponent),
              },
              {
                path: 'documents',
                loadComponent: () => import('./pages/groups/documents/documents.component').then(m => m.DocumentsComponent),
              },
              {
                path: 'review',
                loadComponent: () => import('./pages/groups/review/review.component').then(m => m.ReviewComponent),
              },
            ],
          },
        ],
      },
      {
        path: 'profile',
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () => import('./pages/profile/profile.component').then(m => m.ProfileComponent),
      },
    ],
  },

  // Wildcard
  { path: '**', redirectTo: '/dashboard' },
];
