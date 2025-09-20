import { Component } from '@angular/core';
import { HeaderComponent } from "../../components/header/header.component";
import { HomeComponent } from "../../components/home/home.component";
import { AboutComponent } from '../../components/about/about.component';



@Component({
  selector: 'app-main',
  imports: [
    HeaderComponent,
    HomeComponent,
    AboutComponent
  ],
  templateUrl: './main.component.html',
  styleUrl: './main.component.scss'
})
export class MainComponent {

}
