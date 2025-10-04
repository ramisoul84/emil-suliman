import { Component } from '@angular/core';
import { ScreenSizeService } from '../../services/screen-size.service';

@Component({
  selector: 'app-project1',
  imports: [],
  templateUrl: './project1.component.html',
  styleUrl: './project1.component.scss'
})
export class Project1Component {
  constructor(private screenSizeService: ScreenSizeService) {
  
    
  }
}
