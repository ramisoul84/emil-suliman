import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, ViewChild, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { BlurService } from '../../_services/blur.service';
import { AnalyticsService } from '../../_services/analytics.service';
import { LanguageService } from '../../_services/language.service';
import { WhaleGame } from '../whale-game/whale-game';
import { isPhone } from '../../_config/phone';

@Component({
  selector: 'app-footer',
  imports: [CommonModule, WhaleGame],
  templateUrl: './footer.html',
  styleUrl: './footer.scss'
})
export class Footer implements AfterViewInit, OnDestroy {
  isBlur: boolean = false;

  private readonly lang = inject(LanguageService);
  readonly hint = computed(() => this.lang.currentLang() === 'de' ? 'klick hier für das wal-spiel' : 'click here to play the whale game');
  readonly de = computed(() => this.lang.currentLang() === 'de');

  /** the whale game (components/whale-game), over the whole window */
  readonly gameOpen = signal(false);
  whaleRect: DOMRect | null = null;
  @ViewChild('whaleBox') private whaleBox?: ElementRef<HTMLElement>;
  private readonly zone = inject(NgZone);
  private hintObserver?: IntersectionObserver;
  private hintTimer = 0;

  constructor(private blur: BlurService, private analyticsService: AnalyticsService, private router: Router) {
    this.blur.blurState$.subscribe(
      data => this.isBlur = data
    )
  }

  /** the page reached (the whale in view, the window at rest): "click here to play" shows a
      few seconds */
  ngAfterViewInit(): void {
    const box = this.whaleBox?.nativeElement;
    if (!box || !('IntersectionObserver' in window)) return;
    this.zone.runOutsideAngular(() => {
      let shown = false;
      const whenStill = (last: number) => {
        this.hintTimer = window.setTimeout(() => {
          if (!shown) return;
          if (Math.abs(window.scrollY - last) > 0.5) { whenStill(window.scrollY); return; }
          if (this.gameOpen()) return;
          box.classList.add('hint-on');
          this.hintTimer = window.setTimeout(() => box.classList.remove('hint-on'), 3000);
        }, 90);
      };
      this.hintObserver = new IntersectionObserver(([e]) => {
        if (e.intersectionRatio >= 0.8 && !shown) {
          shown = true;
          clearTimeout(this.hintTimer);
          whenStill(window.scrollY);
        } else if (!e.isIntersecting) {
          shown = false;
          clearTimeout(this.hintTimer);
          box.classList.remove('hint-on');
        }
      }, { threshold: [0, 0.8] });
      this.hintObserver.observe(box);
    });
  }

  ngOnDestroy(): void {
    this.hintObserver?.disconnect();
    clearTimeout(this.hintTimer);
  }

  goToPage(route: string): void {
    this.analyticsService.trackAction(route)
    this.router.navigate([route])
  }

  openGame(): void {
    // phones: no whale game for now (Emil 22 Oct)
    if (this.gameOpen() || isPhone()) return;
    this.analyticsService.trackAction('whale-game');
    clearTimeout(this.hintTimer);
    this.whaleBox?.nativeElement.classList.remove('hint-on');
    // the game's whale starts where this one is
    this.whaleRect = this.whaleBox?.nativeElement.getBoundingClientRect() ?? null;
    this.gameOpen.set(true);
  }

  closeGame(): void {
    this.gameOpen.set(false);
    this.whaleBox?.nativeElement.focus({ preventScroll: true });
  }
}
