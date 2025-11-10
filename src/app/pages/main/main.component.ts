import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../../components/header/header.component';
import { HomeComponent } from "../../sections/home/home.component";
import { AboutComponent } from "../../sections/about/about.component";
import { TimelineComponent } from "../../sections/timeline/timeline.component";
import { CasesComponent } from "../../sections/cases/cases.component";
import { SolidarityComponent } from "../../sections/solidarity/solidarity.component";
import { ContactComponent } from "../../sections/contact/contact.component";
import { FooterComponent } from "../../components/footer/footer.component";
import { BlurService } from '../../services/blur.service';

@Component({
  selector: 'app-main',
  imports: [
    CommonModule,
    HeaderComponent, HomeComponent, AboutComponent, TimelineComponent, CasesComponent, SolidarityComponent, ContactComponent, FooterComponent],
  templateUrl: './main.component.html',
  styleUrl: './main.component.scss'
})
export class MainComponent {
  isBlur: boolean = false;

  constructor(private blurService: BlurService) {
    this.blurService.blurState$.subscribe(data => this.isBlur = data)
  }
}
