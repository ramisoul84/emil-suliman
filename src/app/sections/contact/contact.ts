import { Component, computed, inject, NgZone, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { GridService } from '../../_services/grid.service';
import { BlurService } from '../../_services/blur.service';
import { Subject, takeUntil } from 'rxjs';
import { AnalyticsService } from '../../_services/analytics.service';
import { AnalyticsEvent, ContactChannel } from '../../_services/analytics-events';
import { MessageService } from '../../_services/message.service';
import { LanguageService } from '../../_services/language.service';

@Component({
  selector: 'app-contact',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './contact.html',
  styleUrl: './contact.scss'
})
export class Contact implements OnInit, OnDestroy {
  msg: string = ""
  height: number = 0
  isSubmitting: boolean = false;
  isBlur: boolean = false;
  private destroy$ = new Subject<void>();

  contactForm: FormGroup;


  private readonly zone = inject(NgZone);
  private readonly lang = inject(LanguageService);
  readonly de = computed(() => this.lang.currentLang() === 'de');

  constructor(
    private gridService: GridService,
    private fb: FormBuilder,
    private messageSercvice: MessageService,
    private blurService: BlurService,
    private analyticsService: AnalyticsService
  ) {
    this.contactForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      text: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(5000)]],
      // honeypot: hidden from people (contact.html), filled in by spam bots
      website: [''],
    });

    this.blurService.blurState$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(data => this.isBlur = data);
  }

  ngOnInit(): void {
    // (frames run outside Angular: zone-flags.ts)
    requestAnimationFrame(() => this.zone.run(() => {
      this.height = this.gridService.getMaxHeight(5);
    }));
  }

  onLinkClick(link: string, channel: ContactChannel): void {
    this.analyticsService.track(AnalyticsEvent.ContactClick, { channel, source: 'contact' });
    const newWindow = window.open(link, '_blank', 'noopener,noreferrer');

    // Security measure to prevent tabnabbing
    if (newWindow) {
      newWindow.opener = null;
    }
  }

  openWhatsApp(): void {
    const phoneNumber = '+4915771032625';
    const message = 'Hello, I would like to contact you';
    const url = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
    this.onLinkClick(url, "whatsapp");
  }

  openTelegram(): void {
    const username = 'Emsusn';
    const url = `https://t.me/${username}`;
    this.onLinkClick(url, "telegram");
  }

  openEmail(): void {
    const email = 'emil.suliman@outlook.com';
    const url = `mailto:${email}`;
    this.onLinkClick(url, "email");
  }

  submitForm(): void {
    if (this.isSubmitting || this.contactForm.invalid) {
      return;
    }

    this.isSubmitting = true;

    const { website, ...message } = this.contactForm.value;
    this.messageSercvice.sendMessage(message, website)
      .subscribe({
        next: () => {
          this.analyticsService.track(AnalyticsEvent.MessageSent, { lang: this.lang.currentLang() });
          this.isSubmitting = false;
          this.msg = this.de() ? "✅ Danke! Deine Nachricht ist angekommen." : "✅ Thank you! Your message has been sent successfully.";
          this.contactForm.reset();
          this.hideMessageAfterDelay(3000);
        },
        error: (error) => {
          this.isSubmitting = false;
          console.error('Contact form error:', error);
          this.msg = this.de() ? "❌ Das hat leider nicht geklappt. Bitte versuch es noch einmal." : "❌ Sorry, there was an error sending your message. Please try again.";
          this.hideMessageAfterDelay(4000);
        }
      });
  }

  private hideMessageAfterDelay(delay: number = 3000): void {
    setTimeout(() => {
      this.msg = "";
    }, delay);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}