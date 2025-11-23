import { Component, OnInit } from '@angular/core';
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
import { ResumeComponent } from "../../sections/resume/resume.component";
import { AnalyticsService } from '../../services/analytics.service';

@Component({
  selector: 'app-main',
  imports: [
    CommonModule,
    HeaderComponent,
    HomeComponent,
    AboutComponent,
    CasesComponent,
    SolidarityComponent,
    ContactComponent,
    FooterComponent,
    ResumeComponent
  ],
  templateUrl: './main.component.html',
  styleUrl: './main.component.scss'
})
export class MainComponent implements OnInit {
  isBlur: boolean = false;

  constructor(private blurService: BlurService, private analytics: AnalyticsService) {
    this.blurService.blurState$.subscribe(data => this.isBlur = data)
  }

  ngOnInit(): void {
    this.analytics.trackVisit();
  }
}
