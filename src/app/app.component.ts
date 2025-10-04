import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { GlobalGridService } from './services/global-grid.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'emil';
   constructor(private globalGridService: GlobalGridService) {
    // Service is automatically instantiated here
  }
  
}
