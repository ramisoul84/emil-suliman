import { Component } from '@angular/core';
import { Slide, SliderComponent, SliderConfig } from "../../components/slider/slider.component";

@Component({
  selector: 'app-cases',
  imports: [],
  templateUrl: './cases.component.html',
  styleUrl: './cases.component.scss'
})
export class CasesComponent {
  // Slides with Lottie animations
  featureSlides: Slide[] = [
    {
      id: 1,
      src: '/assets/images/feature-bg-1.jpg',
      lottieAnimation: '/assets/animations/rocket.json',
      lottiePosition: 'foreground',
      title: 'Launch Faster',
      description: 'Get to market quickly with our streamlined process',
      overlayColor: 'linear-gradient(135deg, rgba(34, 107, 34, 0.7), rgba(172, 196, 36, 0.5))',
      lottieConfig: {
        autoplay: true,
        loop: true,
        rendererSettings: {
          className: 'rocket-animation'
        }
      }
    },
    {
      id: 2,
      src: '/assets/images/feature-bg-2.jpg',
      lottieAnimation: '/assets/animations/analytics.json',
      lottiePosition: 'overlay',
      title: 'Data Analytics',
      description: 'Make informed decisions with real-time insights',
      overlayColor: 'linear-gradient(135deg, rgba(23, 23, 23, 0.8), rgba(17, 22, 35, 0.6))'
    },
    {
      id: 3,
      lottieAnimation: '/assets/animations/background-pattern.json',
      lottiePosition: 'background',
      src: '/assets/images/feature-bg-3.jpg', // Fallback image
      title: 'Background Patterns',
      description: 'Beautiful animated backgrounds for your content',
      overlayColor: 'rgba(0, 0, 0, 0.3)'
    },
    {
      id: 4,
      src: '/assets/images/feature-bg-4.jpg',
      // No Lottie animation - just image
      title: 'Clean Design',
      description: 'Minimal and modern design principles',
      overlayColor: 'linear-gradient(45deg, var(--color-header-left), var(--color-header-right))'
    }
  ];

  featureSliderConfig: SliderConfig = {
    autoPlay: true,
    autoPlayInterval: 5000,
    showArrows: true,
    showDots: true,
    showProgress: true,
    height: '500px',
    animationDuration: 1.2,
    parallaxEffect: true,
    lottieAutoPlay: true,
    lottieLoop: true,
    pauseOnHover: true
  };

  onLottieLoaded(event: any) {
    console.log('Lottie animation loaded:', event);
    // You can control the animation here if needed
    // event.animation.play();
    // event.animation.pause();
    // event.animation.setSpeed(0.5);
  }

  onFeatureSlideChange(index: number) {
    console.log('Feature slide changed to:', index);
    // You can trigger other animations or load data based on slide
  }

    onSlideClick(slide: Slide) {
    console.log('Slide clicked:', slide);
    // You can navigate to different routes or open modals here
  }
}
