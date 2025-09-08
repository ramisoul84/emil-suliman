import { Component } from '@angular/core';
import { HeaderComponent } from "../../components/header/header.component";
import { HomeComponent } from "../../components/home/home.component";
import { AboutComponent } from "../../components/about/about.component";
import { CasesComponent } from "../../components/cases/cases.component";
import { ContactComponent } from "../../components/contact/contact.component";
import { FooterComponent } from "../../components/footer/footer.component";
import { ResumeComponent } from '../../components/resume/resume.component';


@Component({
  selector: 'app-main',
  imports: [
    HeaderComponent,
    HomeComponent,
    AboutComponent,
    ResumeComponent,
    CasesComponent,
    ContactComponent,
    FooterComponent,
  ],
  templateUrl: './main.component.html',
  styleUrl: './main.component.scss'
})
export class MainComponent {

}
