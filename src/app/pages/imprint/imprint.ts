import { Component, OnInit } from '@angular/core';
import { GridService } from '../../_services/grid.service';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageService } from '../../_services/language.service';
import { LegalHead } from '../../components/legal-head/legal-head';

@Component({
  selector: 'app-imprint',
  imports: [TranslateModule, LegalHead],
  templateUrl: './imprint.html',
  styleUrl: './imprint.scss'
})
export class Imprint{
  isEnglish: boolean = true

  constructor(private grid: GridService, public languageService: LanguageService) {
    this.isEnglish = this.languageService.isEnglish();
  }

  toggleLanguage(): void {
    this.isEnglish = !this.isEnglish;
    this.languageService.toggleLanguage();
  }
}
