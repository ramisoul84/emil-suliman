import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Message } from '../../_models/message';
import { Visit, VisitStats } from '../../_models/visit';
import { AnalyticsService } from '../../_services/analytics.service';
import { AuthService } from '../../_services/auth.service';
import { MessageService } from '../../_services/message.service';

@Component({
  selector: 'app-admin',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './admin.html',
  styleUrl: './admin.scss'
})
export class Admin implements OnInit, OnDestroy {
  loginForm: FormGroup;
  protected errMsg: string = ""
  protected loading: boolean = false;
  private subscriptions: Subscription = new Subscription();

  protected messages: Message[] = [];
  protected totalMessages:number = 0
  protected visits: Visit[] = [];
  protected visitStats: VisitStats | null = null;
  protected isLoadingData: boolean = false;

  protected authService = inject(AuthService)
  protected analytics = inject(AnalyticsService)
  protected messageService = inject(MessageService)

  constructor(private fb: FormBuilder) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
    });
  }

  ngOnInit(): void {
    this.subscriptions.add(
      this.authService.isAuthenticated().subscribe(isAuthenticated => {
        if (isAuthenticated) {
          this.loadAdminData();
        }
      })
    );

    // Check if already authenticated
    if (this.authService.isAuthenticatedSync()) {
      this.loadAdminData();
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  protected onSubmit(): void {
    if (this.loginForm.invalid) {
      this.markFormFieldsTouched();
      return;
    }

    this.loading = true;
    this.errMsg = "";

    const { email, password } = this.loginForm.value;

    this.subscriptions.add(
      this.authService.login(email, password).subscribe({
        next: (response) => {
          this.loading = false;
        },
        error: (error) => {
          this.errMsg = error.message || "Login failed. Please try again.";

          setTimeout(() => {
            this.errMsg = "";
          }, 3000);

          this.loading = false;
          console.error('Login error:', error);
        }
      })
    );
  }

  protected logout(): void {
    this.authService.logout();
    this.visits = [];
    this.messages = [];
    this.visitStats = null;
  }

  private loadAdminData(): void {
    this.isLoadingData = true;
    this.loadMessages();
    this.loadVisits();
    this.loadStats();
  }

  private loadMessages() {
     this.subscriptions.add(
       this.messageService.getList().subscribe({
         next: (data) => {
           this.messages = data.messages;
           this.totalMessages = data.total
         },
         error: (err) => console.error('Failed to load messages:', err)
       })
     );

  }

  private loadVisits(): void {
    this.subscriptions.add(
      this.analytics.getVisits().subscribe({
        next: (data) => {
          this.visits = data;
          this.isLoadingData = false;
        },
        error: (err) => {
          this.isLoadingData = false;
        }
      })
    );
  }


  private loadStats() {
    this.subscriptions.add(
      this.analytics.getVisitStats().subscribe({
        next: (data) => {
          this.visitStats = data;
        },
        error: (err) => console.error('Failed to load stats:', err)
      })
    );
  }

  private markFormFieldsTouched(): void {
    Object.keys(this.loginForm.controls).forEach(field => {
      const control = this.loginForm.get(field);
      control?.markAsTouched({ onlySelf: true });
    });
  }

  // Helper methods for template
  get email() { return this.loginForm.get('email'); }
  get password() { return this.loginForm.get('password'); }


  protected getFlagEmoji(country: string): string {
    const flags: { [key: string]: string } = {
      'USA': '🇺🇸', 'United States': '🇺🇸',
      'UK': '🇬🇧', 'United Kingdom': '🇬🇧',
      'Canada': '🇨🇦',
      'Australia': '🇦🇺',
      'Germany': '🇩🇪',
      'France': '🇫🇷',
      'Spain': '🇪🇸',
      'Italy': '🇮🇹',
      'Japan': '🇯🇵',
      'China': '🇨🇳',
      'India': '🇮🇳',
      'Brazil': '🇧🇷',
      'Russia': '🇷🇺',
    };

    return flags[country] || '🌍';
  }
}
