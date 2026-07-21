import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { GridService } from '../../_services/grid.service';
import { gsap } from 'gsap';
import { BlurService } from '../../_services/blur.service';
import { Subject, takeUntil } from 'rxjs';
import { Blob } from "../../components/blob/blob";
import { Control } from "../../components/control/control";

@Component({
  selector: 'app-home',
  imports: [CommonModule, Blob, Control],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home implements OnInit, OnDestroy {
  @ViewChild('textElement', { static: true }) textElement!: ElementRef;
  loading: boolean = true;
  progress: number = 0;
  isBlur: boolean = false;

  private timeline: gsap.core.Timeline | null = null;
  private tickerAnimation: any;
  private lastSolidEndTime: number = 0;
  private currentIndex: number = 0;
  private isBlinking: boolean = false;
  private blinkStartTime: number = 0;
  private blinkDuration: number = 4000; // Total blink duration
  private solidDuration: number = 3200; // Time text stays solid
  private destroy$ = new Subject<void>(); // ADD: Cleanup

  currentText: string = '';
  texts: string[] = [
    "ARCHITECTURE, EXPANDED",
    "DIGITAL EXPERIENCES,<br>SYSTEMS, AND INTERFACES",
    "STORIES TOLD THROUGH<br>SPACE, AND MOTION.",
  ];

  constructor(private gridService: GridService, private blurService: BlurService) {
    this.blurService.blurState$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(data => this.isBlur = data);
  }

  ngOnInit(): void {

    setTimeout(() => {
      this.loading = false;
      this.currentText = this.texts[0];
      this.startTickerAnimation();
    }, 800);
  }


  private startTickerAnimation() {
    this.lastSolidEndTime = performance.now();
    this.currentIndex = 0;
    this.isBlinking = false;

    // Set initial state
    gsap.set(this.textElement.nativeElement, { opacity: 1, willChange: 'opacity' });

    // Main animation loop
    this.tickerAnimation = () => {
      const now = performance.now();
      const timeSinceLastSolid = now - this.lastSolidEndTime;

      // Start blinking if enough time has passed
      if (timeSinceLastSolid >= this.solidDuration && !this.isBlinking) {
        this.startBlinkSequence();
      }

      // Check if blink should be complete (backup check)
      if (this.isBlinking) {
        const blinkElapsed = now - this.blinkStartTime;
        if (blinkElapsed >= this.blinkDuration) {
          this.completeBlinkSequence();
        }
      }
    };

    // Add to GSAP ticker
    gsap.ticker.add(this.tickerAnimation);
  }

  private startBlinkSequence() {
    this.isBlinking = true;
    this.blinkStartTime = performance.now();

    // Kill any existing timeline
    if (this.timeline) {
      this.timeline.kill();
    }

    // Create new blink timeline
    this.timeline = gsap.timeline({
      onStart: () => {
        this.blinkStartTime = performance.now();
      },
      onComplete: () => {
        this.completeBlinkSequence();
      },
      onInterrupt: () => {
        // If interrupted, complete the sequence anyway
        setTimeout(() => this.completeBlinkSequence(), 0);
      }
    });

    // Blink pattern: 3 quick blinks then fade out
    this.timeline
      .to(this.textElement.nativeElement, {
        opacity: 0,
        duration: 0.03,
        ease: "power3.inOut"
      })
      .to(this.textElement.nativeElement, {
        opacity: 1,
        duration: 0.03,
        ease: "power3.inOut"
      })
      .to(this.textElement.nativeElement, {
        opacity: 0,
        duration: 0.03,
        ease: "power3.inOut"
      })
      .to(this.textElement.nativeElement, {
        opacity: 1,
        duration: 0.03,
        ease: "power3.inOut"
      })
      .to(this.textElement.nativeElement, {
        opacity: 0,
        duration: 0.05,
        ease: "power3.inOut"
      });
  }

  private completeBlinkSequence() {
    if (!this.isBlinking) return;

    this.isBlinking = false;

    // Move to next text
    this.currentIndex = (this.currentIndex + 1) % this.texts.length;
    this.currentText = this.texts[this.currentIndex];

    // Reset timing
    this.lastSolidEndTime = performance.now();

    // Fade in new text immediately
    gsap.killTweensOf(this.textElement.nativeElement);
    gsap.to(this.textElement.nativeElement, {
      opacity: 1,
      duration: 0.1,
      ease: "power1.out"
    });
  }

  private stopTickerAnimation() {
    if (this.tickerAnimation) {
      gsap.ticker.remove(this.tickerAnimation);
    }
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
    }
  }

  private backupInterval: any;
  private startBackupCheck() {
    this.backupInterval = setInterval(() => {
      const now = performance.now();
      const timeSinceLastSolid = now - this.lastSolidEndTime;

      // Check if animation is stuck (shouldn't happen with the new logic)
      if (timeSinceLastSolid > this.solidDuration + this.blinkDuration + 1000) {
        console.warn('Animation stuck detected, restarting...');
        this.restartAnimation();
      }
    }, 2000);
  }

  private restartAnimation() {
    this.stopTickerAnimation();

    if (this.timeline) {
      this.timeline.kill();
      this.timeline = null;
    }

    // Reset state
    this.isBlinking = false;
    gsap.set(this.textElement.nativeElement, { opacity: 1 });

    // Restart
    this.startTickerAnimation();
    this.startBackupCheck();
  }

  ngOnDestroy() {
    // Clean up
    this.destroy$.next();
    this.destroy$.complete();

    // Stop animations
    if (this.timeline) {
      this.timeline.kill();
      this.timeline = null;
    }

    // Clear any pending timeouts
    if ((this as any)._resizeTimer) {
      clearTimeout((this as any)._resizeTimer);
    }

    // Clean up GSAP tweens
    if (this.textElement) {
      gsap.killTweensOf(this.textElement.nativeElement);
    }
  }
}