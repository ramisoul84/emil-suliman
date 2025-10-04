import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from "../../components/header/header.component";
import { HomeComponent } from "../../components/home/home.component";
import { AboutComponent } from '../../components/about/about.component';
import { CasesComponent } from "../../components/cases/cases.component";
import { ContactComponent } from "../../components/contact/contact.component";
import { FooterComponent } from "../../components/footer/footer.component";
import { ScreenSizeService } from '../../services/screen-size.service';
import { BlurService } from '../../services/blur.service';
import { ResumeComponent } from "../../components/resume/resume.component";
import { Resume1Component1 } from "../../components/resume1/resume.component";
import { ResumeComponent2 } from "../../components/resume2/resume.component";
import { Subscription } from 'rxjs';


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
    ResumeComponent
],
  templateUrl: './main.component.html',
  styleUrl: './main.component.scss'
})
export class MainComponent {
  isBlur: boolean = false;
  //currentGridSize = 20;
  //private subscription!: Subscription;
  constructor(private screenSizeService: ScreenSizeService, private blurService: BlurService) {
    this.blurService.blurState$.subscribe(data => this.isBlur = data)
    
  }
/*
  ngOnInit() {
    this.subscription = this.screenSizeService.screenSize$.subscribe(
      (size) => {
        this.currentGridSize = size.gridSize;
        console.log(this.currentGridSize )
      }
    );
  }

  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }
    */
}
