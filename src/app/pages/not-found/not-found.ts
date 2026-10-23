import { Component, computed, inject } from '@angular/core';
import { LanguageService } from '../../_services/language.service';
import { LegalHead } from '../../components/legal-head/legal-head';

@Component({
  selector: 'app-not-found',
  imports: [LegalHead],
  templateUrl: './not-found.html',
  styleUrl: './not-found.scss',
})
export class NotFound {
  private readonly lang = inject(LanguageService);
  protected readonly de = computed(() => this.lang.currentLang() === 'de');
}
