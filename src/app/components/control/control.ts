import { AfterViewInit, Component, ElementRef, HostListener, NgZone, OnDestroy, OnInit, ViewChild, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BlobService } from '../../_services/blob.service';
import { AnalyticsService } from '../../_services/analytics.service';
import { Palette, ThemeService } from '../../_services/theme.service';
import { warmCollage } from '../../_services/recolor';
import { TutorialService } from '../../_services/tutorial.service';
import { LanguageService } from '../../_services/language.service';
import { PICKER_GRID } from '../color-card/picker-grid';
import { IntroService } from '../../_services/intro.service';
import { isPhone } from '../../_config/phone';

/**
 * The landing tutorial, frame by frame as in Emil's 89.mp4 (24 frames a second; most of it
 * moves in 12 fps steps). Each line: [frame, value], the value holding until the next one.
 * Lengths in grid cells.
 */
const TUT = {
  /** "Customize the website.": comes up from below as it fades in, goes at 2.25 s */
  t1o: [[0, 0], [2, .41], [4, .81], [6, 1], [54, .5], [56, 0]],
  t1y: [[0, .359], [4, .139], [6, .046], [8, .0115], [10, 0]],
  /** the pink along the four sliders: how far it has run, and its thickness (it thins away with
      the buttons' shadow, step for step) */
  sweep: [[0, 0], [12, .031], [14, .499], [16, .796], [18, .915], [20, .973], [22, .996], [24, 1]],
  lineH: [[0, .338], [38, .330], [40, .229], [42, .101], [44, 0]],
  /** the buttons' pink shadow */
  lift: [[0, 0], [14, .225], [16, .301], [18, .327], [20, .329], [38, .321], [40, .223], [42, .098], [44, 0]],
} as const satisfies Record<string, readonly (readonly [number, number])[]>;
const TUT_FRAMES = 57;   // the words gone (frame 56)

/**
 * The controls open from "customize the blob" (Emil's 999.mp4, 12 frames a second): the wide
 * button's left edge runs to the right, easing out, until it is the square fold button, while
 * the sliders fade in; the buttons under it show as it passes. Folding plays it backwards.
 * One value per frame after the click: how far the edge has run (0-1), the words, the sliders.
 */
/** start folded into "customize the blob"? Off for now (Emil, 20 Oct): the controls come open
    with the blob and the square only folds them away; true brings the button back as it was */
const START_FOLDED = false;

const UNFOLD = {
  p: [0, .12, .594, .808, .911, .965, .992, 1],
  text: [.5, 0, 0, 0, 0, 0, 0, 0],
  ctl: [0, .25, .5, .75, 1, 1, 1, 1],
} as const;


interface Slider {
  key: 'speed' | 'wobble' | 'intensity' | 'radius';
  name: string;
  min: number;
  max: number;
  step: number;
  aria: string;
}

@Component({
  selector: 'app--control',
  imports: [CommonModule],
  templateUrl: './control.html',
  styleUrl: './control.scss'
})
export class Control implements OnInit, AfterViewInit, OnDestroy {
  /** phones: the slider being held (its name and value show only then: Emil 22 Oct) */
  readonly held = signal<string | null>(null);
  @HostListener('window:pointerup')
  @HostListener('window:pointercancel')
  letGo(): void { if (this.held()) this.held.set(null); }

  /** touch screens: a pressed button flashes lifted (.25 s, half a second in all), then lets go (it has no hover
      to end it: the last one pressed stayed lifted, Emil 23 Oct) */
  @HostListener('pointerdown', ['$event'])
  flash(e: PointerEvent): void {
    if (e.pointerType === 'mouse') return;
    const el = (e.target as Element | null)?.closest<HTMLElement>('.toggle-btn, .control-btn, .randomize-color, .reset-color, .reset-all, .info, .pick-custom');
    if (!el) return;
    el.classList.add('flash');
    window.setTimeout(() => el.classList.remove('flash'), 250);
  }

  /* ---- folded into "customize the blob" until it is clicked (UNFOLD above) */
  /** phones start folded too, into "press to customize" (Emil's ttt.mp4, 22 Oct) */
  readonly startFolded = START_FOLDED || isPhone();
  readonly open = signal(!this.startFolded);
  readonly unfoldWords = computed(() => isPhone()
    ? (this.lang.currentLang() === 'de' ? 'tippen zum gestalten' : 'press to customize')
    : (this.lang.currentLang() === 'de' ? 'gestalte den blob' : 'customize the blob'));
  @ViewChild('wrap') private wrap?: ElementRef<HTMLElement>;
  /** the frame of UNFOLD on show: -1 folded, UNFOLD.p.length - 1 open */
  private ufPos = -1;
  private ufTimer = 0;
  private offResize?: () => void;

  /* ---- the tutorial, played by the "i" button (TUT above), in two parts: "Customize the
     blob." with the line along the sliders and the shape buttons lifting, then "Change the
     colors of the website." with the colour buttons lifting. Any touch, wheel or key (or the
     controls leaving the screen) ends it at once; the "i" plays it again. */
  private readonly tutorial = inject(TutorialService);
  protected readonly lang = inject(LanguageService);
  private readonly zone = inject(NgZone);
  @ViewChild('panel') private panel?: ElementRef<HTMLElement>;
  readonly tutOn = signal(false);
  /** 1: the blob, 2: the colours */
  readonly tutPart = signal<1 | 2>(1);
  readonly tutWords = computed(() => {
    const de = this.lang.currentLang() === 'de';
    return this.tutPart() === 1 ? (de ? 'Gestalte den Blob.' : 'Customize the blob.')
      : (de ? 'Ändere die Farben der Website.' : 'Change the colors of the website.');
  });
  private tutWait?: ReturnType<typeof setTimeout>;
  private tutRaf = 0;
  private tutFrame = -1;
  private tutSeen?: IntersectionObserver;
  private tutOff: (() => void)[] = [];
  isPixelated = true

  /* the three colours: the whole site's palette (ThemeService) */
  readonly slots = [0, 1, 2] as const;
  readonly slotNames = ['first colour', 'second colour', 'accent colour'];
  readonly swatches = PICKER_GRID;
  get palette() { return this.theme.palette; }

  /* ---- the colour card: open for one of the three colours (null: closed) */
  readonly editing = signal<0 | 1 | 2 | null>(null);
  readonly pickerOut = signal(false);
  readonly pickerAt = signal({ left: 0, bottom: 0 });
  @ViewChild('customInput') private customInput?: ElementRef<HTMLInputElement>;
  private pickerOff: (() => void)[] = [];
  private pickerTimer = 0;

  // Get reactive params
  params;
  state;
  defaults;

  // The four sliders: name and percentage above each (0% = min, 100% = max).
  readonly sliders: Slider[] = [
    { key: 'speed', name: 'speed', min: 0.2, max: 1.5, step: 0.001, aria: 'Animation speed' },
    { key: 'wobble', name: 'wobble', min: 0.5, max: 2, step: 0.001, aria: 'Wobble amount' },
    { key: 'intensity', name: 'intensity', min: 0.5, max: 2, step: 0.001, aria: 'Blob intensity' },
    { key: 'radius', name: 'size', min: 0.1, max: 0.2, step: 0.0001, aria: 'Blob size' },
  ];

  constructor(public blobService: BlobService, private analyticsService: AnalyticsService,
    private theme: ThemeService) {
    this.params = this.blobService.params;
    this.state = this.blobService.state;
    this.defaults = this.blobService.getDefaults();
  }

  ngOnInit(): void { }

  ngAfterViewInit(): void {
    this.showUnfold(this.startFolded ? -1 : UNFOLD.p.length - 1);
    this.wrap?.nativeElement.classList.toggle('plain', !this.startFolded);
    this.measureRow();
    // open from the start: the tutorial waits for the "i" (the landing's lines needn't wait for it)
    if (!START_FOLDED) this.tutorial.done.set(true);
    this.zone.runOutsideAngular(() => {
      let pending = 0;
      const onResize = () => { cancelAnimationFrame(pending); pending = requestAnimationFrame(() => this.measureRow()); };
      window.addEventListener('resize', onResize);
      document.fonts?.ready.then(() => this.measureRow());
      this.offResize = () => { window.removeEventListener('resize', onResize); cancelAnimationFrame(pending); };
    });
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) this.endTutorial();
  }

  /** "customize the blob" clicked (or the square, to fold them again) */
  toggleExpand(): void {
    const opening = !this.open();
    this.open.set(opening);
    if (!opening) { this.closePicker(); this.endTutorial(); }
    // without the button: the square just folds them away and back
    if (!this.startFolded) { this.showUnfold(opening ? UNFOLD.p.length - 1 : -1); return; }
    this.measureRow();
    const last = UNFOLD.p.length - 1;
    clearTimeout(this.ufTimer);
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { this.showUnfold(opening ? last : -1); return; }
    // frame by frame from where it is (a click half-way turns it round there)
    this.zone.runOutsideAngular(() => {
      const step = () => {
        const pos = this.ufPos + (opening ? 1 : -1);
        this.showUnfold(pos);
        if (opening ? pos < last : pos > -1) { this.ufTimer = window.setTimeout(step, 1000 / 12); return; }
        if (opening && !this.tutorial.done()) this.armTutorial(true);
      };
      step();
    });
  }

  /** one frame of UNFOLD, as CSS variables on the controls (control.scss draws it) */
  private showUnfold(pos: number): void {
    const wrap = this.wrap?.nativeElement;
    this.ufPos = pos;
    if (!wrap) return;
    const at = (track: readonly number[], folded: number) => pos < 0 ? folded : track[pos];
    wrap.style.setProperty('--uf-p', String(at(UNFOLD.p, 0)));
    wrap.style.setProperty('--uf-text', String(at(UNFOLD.text, 1)));
    wrap.style.setProperty('--uf-ctl', String(at(UNFOLD.ctl, 0)));
    wrap.classList.toggle('unfolded', pos === UNFOLD.p.length - 1);
  }

  /** the button folded: from the first button of the bottom row to the fold square's right edge */
  private measureRow(): void {
    const wrap = this.wrap?.nativeElement, panel = this.panel?.nativeElement;
    const btn = wrap?.querySelector<HTMLElement>('.toggle-btn')?.getBoundingClientRect();
    if (!wrap || !panel || !btn || !btn.height) return;
    const square = btn.height;                       // the fold button is as wide as it is tall
    const row = ['.reset-color', '.colors', '.randomize-color', '.randomize', '.pixelated']
      .map(sel => panel.querySelector<HTMLElement>(sel)?.getBoundingClientRect())
      .filter((r): r is DOMRect => !!r && r.width > 0 && r.bottom > btn.top + 1 && r.top < btn.bottom - 1);
    const left = Math.min(btn.right - square, ...row.map(r => r.left));
    wrap.style.setProperty('--uf-w', `${Math.round(btn.right - left)}px`);
  }

  /** once the way in is over (the controls are there), the "i" lifts once, like the buttons in
      the tutorial, so it is seen (intro.service.ts) */
  private static readonly HELLO_FRAME = 36;
  private readonly intro = inject(IntroService);
  private helloDone = false;
  private readonly hello = effect(() => {
    if (this.intro.frame() < Control.HELLO_FRAME || this.helloDone || this.startFolded) return;
    this.helloDone = true;
    if (typeof window === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const info = this.panel?.nativeElement.querySelector<HTMLElement>('.info');
    if (!info) return;
    info.classList.add('hello');
    window.setTimeout(() => info.classList.remove('hello'), 30 / 24 * 1000 + 100);
  });

  /** the "i": the tutorial from the start (again, if it was playing) */
  info(): void {
    this.endTutorial();
    this.zone.runOutsideAngular(() => this.armTutorial(true));
  }

  /** with "customize the blob" (START_FOLDED): it also plays once, the first time they open */
  private tutStarted = false;
  private armTutorial(now: boolean): void {
    const panel = this.panel?.nativeElement;
    if (!panel || this.tutStarted) return;
    this.tutSeen = new IntersectionObserver(([e]) => { if (!e.isIntersecting) this.endTutorial(); });
    this.tutSeen.observe(panel);
    const stop = () => this.endTutorial();
    for (const type of ['pointerdown', 'wheel', 'touchstart', 'keydown']) {
      window.addEventListener(type, stop, { capture: true, passive: true });
      this.tutOff.push(() => window.removeEventListener(type, stop, { capture: true }));
    }
    if (now) this.startTutorial();
  }

  /** the two parts, one after the other: TUT_FRAMES each, at 24 fps */
  private startTutorial(): void {
    if (this.tutStarted) return;
    this.tutStarted = true;
    const panel = this.panel?.nativeElement;
    if (!panel) { this.endTutorial(); return; }
    const part = (n: 1 | 2) => {
      panel.classList.add('tut');
      panel.classList.toggle('tut-a', n === 1);
      panel.classList.toggle('tut-b', n === 2);
      this.zone.run(() => this.tutPart.set(n));
    };
    part(1);
    this.tutFrame = -1;
    this.showFrame(0);
    this.zone.run(() => this.tutOn.set(true));
    const t0 = performance.now();
    const tick = (now: number) => {
      const f = Math.max(0, Math.floor((now - t0) * 24 / 1000));
      if (f >= 2 * TUT_FRAMES) { this.endTutorial(); return; }
      if (f >= TUT_FRAMES && this.tutPart() === 1) part(2);
      const k = f % TUT_FRAMES;
      if (k !== this.tutFrame) this.showFrame(k);
      this.tutRaf = requestAnimationFrame(tick);
    };
    this.tutRaf = requestAnimationFrame(tick);
  }

  /** one frame of TUT, as CSS variables on the panel (control.scss draws it) */
  private showFrame(f: number): void {
    const panel = this.panel?.nativeElement;
    if (!panel) return;
    this.tutFrame = f;
    const at = (track: readonly (readonly [number, number])[]) => {
      let v = track[0][1];
      for (const [k, x] of track) { if (k > f) break; v = x; }
      return v;
    };
    const st = panel.style;
    st.setProperty('--t1o', String(at(TUT.t1o)));
    st.setProperty('--t1y', String(at(TUT.t1y)));
    st.setProperty('--tsw', String(at(TUT.sweep)));
    st.setProperty('--tlh', String(at(TUT.lineH)));
    st.setProperty('--tlift', String(at(TUT.lift)));
  }

  /** the colour buttons' rect on the screen (reset, the three colours, randomize) */
  private buttonsRect(): { left: number; top: number; right: number; bottom: number } | null {
    const panel = this.panel?.nativeElement;
    const rs = ['.reset-color', '.colors', '.randomize-color']
      .map(sel => panel?.querySelector<HTMLElement>(sel)?.getBoundingClientRect()).filter((r): r is DOMRect => !!r && r.width > 0);
    if (!rs.length) return null;
    return {
      left: Math.min(...rs.map(r => r.left)), top: Math.min(...rs.map(r => r.top)),
      right: Math.max(...rs.map(r => r.right)), bottom: Math.max(...rs.map(r => r.bottom)),
    };
  }

  private grid(): number {
    return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dynamic-grid-size')) || 21;
  }

  /** the end (or a touch, or the page left): everything as it was, the hero's lines may go on */
  private endTutorial(): void {
    clearTimeout(this.tutWait);
    cancelAnimationFrame(this.tutRaf);
    this.tutSeen?.disconnect();
    this.tutOff.forEach(off => off());
    this.tutOff = [];
    this.panel?.nativeElement.classList.remove('tut', 'tut-a', 'tut-b');
    if (this.tutOn()) this.zone.run(() => this.tutOn.set(false));
    this.tutStarted = false;
    this.tutorial.done.set(true);
  }

  percent(s: Slider): number {
    const v = this.params()[s.key];
    return Math.round(Math.min(1, Math.max(0, (v - s.min) / (s.max - s.min))) * 100);
  }

  onSlider(s: Slider, event: Event): void {
    const value = (event.target as HTMLInputElement).valueAsNumber;
    this.blobService.updateParams({ [s.key]: value });
  }

  onRadiusChange(event: Event): void {
    const value = (event.target as HTMLInputElement).valueAsNumber;
    this.blobService.updateParams({ radius: value });
  }

  onSpeedChange(event: Event): void {
    const value = (event.target as HTMLInputElement).valueAsNumber;
    this.blobService.updateParams({ speed: value });
  }

  onWobbleChange(event: Event): void {
    const value = (event.target as HTMLInputElement).valueAsNumber;
    this.blobService.updateParams({ wobble: value });
  }

  onIntensityChange(event: Event): void {
    const value = (event.target as HTMLInputElement).valueAsNumber;
    this.blobService.updateParams({ intensity: value });
  }

  onSpeedanalytics(event: Event): void {
    this.analyticsService.trackAction('blob')
  }

  togglePixelated() {
    this.analyticsService.trackAction('blob')
    this.isPixelated = !this.isPixelated
    this.blobService.updateParams({ pixelated: this.isPixelated });
  }

  reset(): void {
    this.blobService.resetToDefaults();
  }

  randomize(): void {
    this.analyticsService.trackAction('blob')
    this.blobService.randomize();
  }

  togglePause(): void {
    this.blobService.togglePause();
  }

  /** about to pick colours: get the collage pictures ready, so they change at once */
  warm(): void {
    warmCollage();
  }

  /** a colour clicked: its card opens above the buttons (again: it closes) */
  openPicker(i: 0 | 1 | 2): void {
    if (this.editing() === i && !this.pickerOut()) { this.closePicker(); return; }
    clearTimeout(this.pickerTimer);
    if (this.editing() === null || this.pickerOut()) this.placePicker();
    this.pickerOut.set(false);
    this.editing.set(i);
    if (this.pickerOff.length) return;
    // a click anywhere else, or esc, closes it
    this.zone.runOutsideAngular(() => {
      const down = (e: PointerEvent) => {
        const t = e.target as HTMLElement | null;
        if (t?.closest('.picker, .color-btn')) return;
        this.zone.run(() => this.closePicker());
      };
      const key = (e: KeyboardEvent) => { if (e.key === 'Escape') this.zone.run(() => this.closePicker()); };
      document.addEventListener('pointerdown', down, true);
      document.addEventListener('keydown', key, true);
      this.pickerOff.push(() => document.removeEventListener('pointerdown', down, true),
        () => document.removeEventListener('keydown', key, true));
    });
  }

  /** the card: 15 cells wide, ending with the three colours, 7.5 cells tall, half a cell above
      the buttons — on the page's grid, so its colours sit in the grid's cells */
  private placePicker(): void {
    const panel = this.panel?.nativeElement, b = this.buttonsRect();
    const colors = panel?.querySelector<HTMLElement>('.colors')?.getBoundingClientRect();
    if (!panel || !b || !colors) return;
    const p = panel.getBoundingClientRect(), g = this.grid();
    const left = Math.max(-p.left, colors.right - p.left - 15 * g);
    // its bottom half a cell above the buttons: it grows upwards from there
    this.pickerAt.set({ left, bottom: p.bottom - (b.top - 0.5 * g) });
  }

  closePicker(): void {
    if (this.editing() === null || this.pickerOut()) return;
    this.pickerOff.forEach(off => off());
    this.pickerOff = [];
    this.pickerOut.set(true);
    clearTimeout(this.pickerTimer);
    this.pickerTimer = window.setTimeout(() => { this.editing.set(null); this.pickerOut.set(false); }, 250);
  }

  // the colours stay when you leave the landing page: they are the site's colours now
  choose(color: string): void {
    const i = this.editing();
    if (i === null) return;
    this.analyticsService.trackAction('blob');
    this.theme.set(i, color);
  }

  /** a colour of your own: the browser's colour picker, as before */
  custom(): void {
    const input = this.customInput?.nativeElement;
    if (!input) return;
    try { input.showPicker(); } catch { input.click(); }
  }

  /** the eyedropper: any colour on the screen (where the browser has one; else the picker) */
  async eyedrop(): Promise<void> {
    const Dropper = (window as any).EyeDropper;
    if (!Dropper) { this.custom(); return; }
    try {
      const { sRGBHex } = await new Dropper().open();
      if (sRGBHex) this.zone.run(() => this.choose(sRGBHex));
    } catch { /* cancelled */ }
  }

  randomizeColor(): void {
    this.analyticsService.trackAction('blob')
    this.theme.setAll([this.generateRandomHexColor(), this.generateRandomHexColor(), this.generateRandomHexColor()] as Palette);
  }

  /** phones (Emil 23 Oct): everything as it came: the sliders, the shape, the pixels and the
      colours */
  resetAll(): void {
    this.analyticsService.trackAction('blob');
    this.blobService.resetToDefaults();
    this.isPixelated = this.blobService.getDefaults().pixelated;
    this.theme.reset();
  }

  /** back to Emil's colours */
  resetColors(): void {
    this.analyticsService.trackAction('blob')
    this.theme.reset();
  }

  generateRandomHexColor(): string {
    // Generate a random hex color (#RRGGBB)
    const hex = '0123456789ABCDEF';
    let color = '#';

    for (let i = 0; i < 6; i++) {
      color += hex[Math.floor(Math.random() * 16)];
    }

    return color;
  }

  ngOnDestroy(): void {
    clearTimeout(this.ufTimer);
    this.offResize?.();
    this.endTutorial();
    this.pickerOff.forEach(off => off());
    clearTimeout(this.pickerTimer);
  }
}