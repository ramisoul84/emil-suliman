import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core';

interface About {
  info: string;
  img: string;
}

@Component({
  selector: 'app-about',
  imports: [CommonModule],
  templateUrl: './about.component.html',
  styleUrl: './about.component.scss'
})
export class AboutComponent implements AfterViewInit {
  @ViewChild('aboutVideo') aboutVideo!: ElementRef<HTMLVideoElement>;
  private video1!: HTMLVideoElement;
  @ViewChild('emilVideo') emilVideo!: ElementRef<HTMLVideoElement>;
  private intersectionObserver!: IntersectionObserver;
  private video2!: HTMLVideoElement;
  selectedField: number = 0
  about: About[] = [
    { info: "I am a trained architect and a registered member of the Architects’ Chamber of Berlin. Over the course of my career, I have worked in several offices in different countries, across different scales and disciplines, from private houses and small shops to large cultural, commercial, and pavilion projects. My expertise spans concept creation, design development, visualization, and turning ideas into built spaces. For larger commissions, I collaborate with a trusted team of architects to deliver comprehensive support at every stage.", img: "assets/images/house.webm" },
    { info: "Storytelling and narrative building are at the core of my creative work, developed through collaborations with artists, agencies, and cultural projects. I have worked as a motion designer and art director, exploring how stories can unfold across visual and sonic media. My experience spans media architecture, motion design, and branding, with a focus on crafting clear, engaging, and memorable narratives. Whether through moving images or immersive environments.", img: "assets/images/camera.webm" },
    { info: "Hi, I’m Emil. I live in Berlin and love electronic music (obviously). I’m learning to mix and produce my own tracks though I still have a long way to go. I’m also working on my Portuguese (Ainda falo muito mal, mas estou a aprender!). I care deeply about immigrant rights, queer issues and marginalized communities, values that guide my moral compass in both life and work. Berlin is my favorite place in the world with Lisbon close behind, and at home I care for 32 plants… I guess you could say my career isn’t the only thing I’m growing :)", img: "assets/images/duck.webm" }
  ]

  ngAfterViewInit() {
    this.video1 = this.aboutVideo.nativeElement;
    this.video2 = this.emilVideo.nativeElement;
    this.setupVideo();
    this.setupScrollPlayback();
  }

  private setupVideo() {
    if (!this.video1 || !this.video2) return;
    this.video1.preload = 'auto';
    this.video1.muted = true;
    this.video1.playsInline = true;
    this.video1.load();

    this.video2.preload = 'auto';
    this.video2.muted = true;
    this.video2.playsInline = true;
    this.video2.load();
  }

  onFieldChange(newField: number) {
    this.selectedField = newField;
    setTimeout(() => {
      if (this.aboutVideo) {
        this.aboutVideo.nativeElement.load();
      }
    });
  }

  setupScrollPlayback() {
    const options = {
      root: null,
      rootMargin: '0px',
      threshold: 0.1 // 10% of video visible
    };

    this.intersectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const video = this.emilVideo.nativeElement;

        if (entry.isIntersecting) {
          // Video is visible - play from start
          video.currentTime = 0; // Reset to beginning
          video.play().catch(error => {
            console.log('Play prevented:', error);
          });
        } else {
          // Video is not visible - pause and reset
          video.pause();
          video.currentTime = 0;
        }
      });
    }, options);

    this.intersectionObserver.observe(this.emilVideo.nativeElement);
  }

  ngOnDestroy() {
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }
  }

}
