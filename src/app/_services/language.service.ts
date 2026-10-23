import { Injectable, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

export type Language = 'en' | 'de';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  currentLang = signal<Language>('en');

  constructor(private translate: TranslateService) {
    this.initLanguage();
  }

  private initLanguage(): void {
    const savedLang = localStorage.getItem('app-language') as Language;
    const browserLang = this.translate.getBrowserLang()?.substring(0, 2) as Language;
    
    const initialLang = savedLang || (browserLang === 'de' ? 'de' : 'en');
    
    this.translate.setDefaultLang('en');
    this.setLanguage(initialLang);
  }

  setLanguage(lang: Language): void {
    this.currentLang.set(lang);
    this.translate.use(lang);
    localStorage.setItem('app-language', lang);
    document.documentElement.lang = lang;
  }

  toggleLanguage(): void {
    const newLang = this.currentLang() === 'en' ? 'de' : 'en';
    this.setLanguage(newLang);
  }

  isEnglish(): boolean {
    return this.currentLang() === 'en';
  }
}