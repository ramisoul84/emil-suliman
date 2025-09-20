import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from "../../components/header/header.component";
import { HomeComponent } from "../../components/home/home.component";
import { AboutComponent } from '../../components/about/about.component';
import { CasesComponent } from "../../components/cases/cases.component";
import { ContactComponent } from "../../components/contact/contact.component";
import { FooterComponent } from "../../components/footer/footer.component";
import { BlurService } from '../../services/blur.service';





@Component({
  selector: 'app-main',
  imports: [
    CommonModule,
    HeaderComponent,
    HomeComponent,
    AboutComponent,
    CasesComponent,
    ContactComponent,
    FooterComponent,

  ],
  templateUrl: './main.component.html',
  styleUrl: './main.component.scss'
})
export class MainComponent {
  isBlur: boolean = false;
  constructor(private blurService: BlurService) {
    this.blurService.blurState$.subscribe(data => this.isBlur = data)
  }
}
