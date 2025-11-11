import { Component } from '@angular/core';
import { PixelBlobCanvasComponent } from '../../components/pixel-blob-canvas/pixel-blob-canvas.component';
import { PixelBlobControlsComponent } from '../../components/pixel-blob-controls/pixel-blob-controls.component';

@Component({
  selector: 'app-home',
  imports: [PixelBlobCanvasComponent, PixelBlobControlsComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent {

}
