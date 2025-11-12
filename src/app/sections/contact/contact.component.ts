import { Component, inject } from '@angular/core';
import { GridService } from '../../services/grid.service';
import { CommonModule } from '@angular/common';
import { GoogleAnalyticsService } from 'ngx-google-analytics';

@Component({
  selector: 'app-contact',
  imports: [CommonModule],
  templateUrl: './contact.component.html',
  styleUrl: './contact.component.scss'
})
export class ContactComponent {
  height: number = 0

  private gaService = inject(GoogleAnalyticsService);
  constructor(private gridService: GridService) {
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

    sendMessage(msg: string): void {

  }

}
