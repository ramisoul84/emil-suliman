import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ObjViewerComponent } from "../obj-viewer/obj-viewer.component";
import { RouterLink } from '@angular/router';


interface Project {
  name: string;
  info: string;
  img: string;
}

@Component({
  selector: 'app-cases',
  imports: [CommonModule, ObjViewerComponent, RouterLink],
  templateUrl: './cases.component.html',
  styleUrl: './cases.component.scss'
})
export class CasesComponent {
  selectedproject: number = 0;
  projects: Project[] = [
    { name: "Project.1", info: "industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type                   with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop     ublishing software like Aldus PageMaker including versions of Lorem Ipsum.", img: "assets/images/project1.jpg" },
    { name: "Project.2", info: "Lorem Ipsum is simply dummy text of the printing and typesetting industry.", img: "assets/images/project2.jpg" },
    { name: "Project.3", info: "orem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum h", img: "assets/images/project3.jpg" },
    { name: "Project.4", info: "awillah", img: "assets/images/project4.jpg" },
    { name: "Project.5", info: "shi fakhm.", img: "assets/images/project5.jpg" },
    { name: "Project.6", info: "ya  mohhamad", img: "assets/images/project6.png" },
    { name: "Project.7", info: "essssssssssss", img: "assets/images/project7.png" },
  ]

  next(): void {
    if (this.selectedproject < this.projects.length) {
      this.selectedproject++
    }
  }

  prev(): void {
    if (this.selectedproject > 0) {
      this.selectedproject--
    }

  }

  select(i: number): void {
    this.selectedproject = i
  }

}
