import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { GridService } from './services/grid.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'emil-suliman';

  constructor(private grid: GridService) { }
}
