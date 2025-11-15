import { Component, HostListener } from '@angular/core';
import { PixelBlobCanvasComponent } from '../../components/pixel-blob-canvas/pixel-blob-canvas.component';
import { PixelBlobControlsComponent } from '../../components/pixel-blob-controls/pixel-blob-controls.component';
import { GridService } from '../../services/grid.service';

@Component({
  selector: 'app-home',
  imports: [PixelBlobCanvasComponent, PixelBlobControlsComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent {
  canvasHeight: number = 0
  homeHeight: number = 0
  constructor(private gridService: GridService) {
  }

  ngOnInit(): void {
    setTimeout(()=>{
    this.homeHeight = this.gridService.getMaxHeight(0)
    this.canvasHeight = this.gridService.getMaxHeight(6)
    })

  }

  @HostListener('window:resize')
  onWindowResize() {
    this.homeHeight = this.gridService.getMaxHeight(0)
    this.canvasHeight = this.gridService.getMaxHeight(6)
  }

}
