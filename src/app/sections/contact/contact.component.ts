import { Component, inject } from '@angular/core';
import { GridService } from '../../services/grid.service';
import { CommonModule } from '@angular/common';
import { GoogleAnalyticsService } from 'ngx-google-analytics';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-contact',
  imports: [CommonModule, ReactiveFormsModule],
  providers: [ApiService],
  templateUrl: './contact.component.html',
  styleUrl: './contact.component.scss'
})
export class ContactComponent {
  msg: string = ""
  height: number = 0
  isSubmitting: boolean = false;

  contactForm: FormGroup;

  private gaService = inject(GoogleAnalyticsService);
  constructor(private gridService: GridService, private fb: FormBuilder, private apiSercvice: ApiService) {
    this.contactForm = this.fb.group({
      name: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      text: ['', [Validators.required]]
    });
  }

  ngOnInit(): void {
    this.height = this.gridService.getMaxHeight(5)
  }

  onLinkClick(link: string, platform: string): void {

    this.gaService.event('contact_click', platform, 'engagement');

    const newWindow = window.open(link, '_blank');

    // Security measure to prevent tabnabbing
    if (newWindow) {
      newWindow.opener = null;
    }
  }

  openWhatsApp(): void {
    const phoneNumber = '+4915771032625'; // Replace with your number
    const message = 'Hello, I would like to contact you';
    const url = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
    this.onLinkClick(url, "whatsapp");
  }

  openTelegram(): void {
    const username = 'Emsusn'; //Emsusn
    const url = `https://t.me/${username}`;
    this.onLinkClick(url, "telegram");
  }

  openEmail(): void {
    const email = 'rami.suliman@mail.ru'; // Replace with your email
    const subject = 'Contact Request';
    const body = 'Hello, I would like to get in touch with you.';
    const url = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    this.onLinkClick(url, "email");
  }

  submitForm(): void {
    this.isSubmitting = true;
    this.apiSercvice.sendMessage(this.contactForm.value)
      .subscribe({
        next: () => {
          this.isSubmitting = false;
          this.msg = "✅ Thank you! Your message has been sent successfully.";
          this.contactForm.reset(); // Clear the form
          this.hideMessageAfterDelay(3000);
        },
        error: (error) => {
          this.isSubmitting = false;
          console.error('Contact form error:', error);
          this.msg = "❌ Sorry, there was an error sending your message. Please try again.";
          this.hideMessageAfterDelay(4000); // Longer for errors
        }
      });
  }

  private hideMessageAfterDelay(delay: number = 3000): void {
    setTimeout(() => {
      this.msg = "";
    }, delay);
  }
}
