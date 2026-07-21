import { Component } from '@angular/core';
import { GridService } from '../../_services/grid.service';
import { LanguageService } from '../../_services/language.service';
import { TranslateModule } from '@ngx-translate/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-privacy-policy',
  imports: [TranslateModule,RouterLink],
  templateUrl: './privacy.html',
  styleUrl: './privacy.scss'
})
export class Privacy {
  isEnglish: boolean = true

  constructor(private grid: GridService, public languageService: LanguageService) {
    this.isEnglish = this.languageService.isEnglish();
  }

  toggleLanguage(): void {
    this.isEnglish = !this.isEnglish;
    this.languageService.toggleLanguage();
  }

  goToSection(section: string) {
    try {
      const element = document.getElementById(section);

      if (element) {

        setTimeout(() => {
          if (document.contains(element)) {
            element.scrollIntoView({
              behavior: 'smooth',
              block: 'start'
            });
          }
        }, 300);
      } else {
        console.warn(`Section '${section}' not found`);
      }
    } catch (error) {
      console.error('Error navigating to section:', error);
    }
  }
}
