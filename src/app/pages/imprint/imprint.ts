import { Component, OnInit } from '@angular/core';
import { GridService } from '../../_services/grid.service';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageService } from '../../_services/language.service';

@Component({
  selector: 'app-imprint',
  imports: [RouterLink, TranslateModule],
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
