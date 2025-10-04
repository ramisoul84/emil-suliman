import { Component, OnInit } from '@angular/core';
import { GlobalGridService } from '../../services/global-grid.service';



@Component({
  selector: 'app-home',
  imports: [],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit {
  width: number = 0
  grid:number= 0
  constructor(private globalGridService: GlobalGridService) {

  }

  ngOnInit(): void {
    this.globalGridService.screenWidth$.subscribe(data => {
      this.width = data
    })
    this.globalGridService.gridWidth$.subscribe(data => this.grid = data)
  }
}
