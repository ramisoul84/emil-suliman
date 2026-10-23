import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AnalyticsService } from '../../_services/analytics.service';
import { AuthService } from '../../_services/auth.service';
import { MessageService } from '../../_services/message.service';
import { AdminAnalyticsService, RangePreset } from './data/admin-analytics.service';
import { LiveSnapshot } from './data/analytics.models';
import { Messages } from './messages/messages';
import { Overview } from './overview/overview';
import { Sessions } from './sessions/sessions';

type Tab = 'overview' | 'sessions' | 'messages';
const TABS: Tab[] = ['overview', 'sessions', 'messages'];
const LIVE_EVERY_MS = 20_000;

@Component({
  selector: 'app-admin',
  imports: [ReactiveFormsModule, Overview, Sessions, Messages],
  templateUrl: './admin.html',
  styleUrl: './admin.scss'
})
export class Admin {
  readonly auth = inject(AuthService);
  readonly data = inject(AdminAnalyticsService);
  private readonly analytics = inject(AnalyticsService);
  private readonly messages = inject(MessageService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly loginForm = inject(FormBuilder).nonNullable.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });
  readonly loggingIn = signal(false);
  readonly loginError = signal('');

  readonly tabs = TABS;
  readonly tab = signal<Tab>('overview');
  readonly unread = signal(0);
  readonly live = signal<LiveSnapshot | null>(null);
  readonly optedOut = signal(AnalyticsService.isOptedOut());

  readonly presets: { id: Exclude<RangePreset, 'custom'>; label: string }[] = [
    { id: 'today', label: 'today' }, { id: '7d', label: '7 days' }, { id: '30d', label: '30 days' }, { id: '90d', label: '90 days' },
  ];
  readonly showRange = computed(() => this.tab() !== 'messages');

  constructor() {
    // ?tab=messages — so links (and the Telegram bot) can open a tab directly
    this.route.queryParamMap.subscribe((q) => {
      const t = q.get('tab') as Tab;
      this.tab.set(TABS.includes(t) ? t : 'overview');
    });

    // signed in: unread badge now, live visitors every 20 s while the tab is visible
    effect((onCleanup) => {
      if (!this.auth.isAuthenticated()) return;
      this.refreshUnread();
      this.refreshLive();
      const timer = setInterval(() => {
        if (document.visibilityState === 'visible') this.refreshLive();
      }, LIVE_EVERY_MS);
      onCleanup(() => clearInterval(timer));
    });
  }

  login(): void {
    if (this.loginForm.invalid || this.loggingIn()) return;
    const { username, password } = this.loginForm.getRawValue();
    this.loggingIn.set(true);
    this.loginError.set('');
    this.auth.login(username.trim(), password).subscribe({
      next: () => {
        this.loggingIn.set(false);
        this.loginForm.reset();
      },
      error: (err: { message: string }) => {
        this.loggingIn.set(false);
        this.loginError.set(err.message);
      },
    });
  }

  logout(): void {
    this.auth.logout();
    this.live.set(null);
  }

  openTab(tab: Tab): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: { tab: tab === 'overview' ? null : tab }, replaceUrl: true });
  }

  setCustom(from: string, to: string): void {
    if (from && to && from <= to) this.data.setCustomRange({ from, to });
  }

  /** Emil's own visits shouldn't count: this browser stops sending analytics. */
  toggleOptOut(): void {
    const next = !this.optedOut();
    this.analytics.setOptOut(next);
    this.optedOut.set(next);
  }

  private refreshLive(): void {
    this.data.live().subscribe({ next: (l) => this.live.set(l), error: () => this.live.set(null) });
  }

  private refreshUnread(): void {
    this.messages.getList(1).subscribe({ next: (l) => this.unread.set(l.unread), error: () => { } });
  }
}
