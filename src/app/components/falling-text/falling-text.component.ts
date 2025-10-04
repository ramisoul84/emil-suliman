import { Component, Input, ElementRef, AfterViewInit, OnDestroy, HostListener, ViewChild, OnInit } from '@angular/core';
import * as Matter from 'matter-js';

@Component({
  selector: 'app-falling-text',
  templateUrl: './falling-text.component.html',
  styleUrls: ['./falling-text.component.scss']
})
export class FallingTextComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() text: string = '';
  @Input() highlightWords: string[] = [];
  @Input() highlightClass: string = 'highlighted';
  @Input() trigger: 'auto' | 'scroll' | 'click' | 'hover' = 'auto';
  @Input() backgroundColor: string = 'transparent';
  @Input() wireframes: boolean = false;
  @Input() gravity: number = 1;
  @Input() mouseConstraintStiffness: number = 0.2;
  @Input() fontSize: string = '1rem';

  @ViewChild('container', { static: true }) containerRef!: ElementRef;
  @ViewChild('textElement', { static: true }) textRef!: ElementRef;
  @ViewChild('canvasContainer', { static: true }) canvasContainerRef!: ElementRef;

  effectStarted = false;
  private observer: IntersectionObserver | null = null;
  private engine: any;
  private render: any;
  private runner: any;
  private wordBodies: any[] = [];

  constructor() { }

  ngOnInit() {
    this.processText();

    if (this.trigger === 'auto') {
      this.effectStarted = true;
    }
  }

  ngAfterViewInit() {
    if (this.trigger === 'scroll') {
      this.setupScrollTrigger();
    }

    if (this.effectStarted) {
      setTimeout(() => this.initEffect(), 0);
    }
  }

  ngOnDestroy() {
    if (this.observer) {
      this.observer.disconnect();
    }

    if (this.render) {
      Matter.Render.stop(this.render);
    }

    if (this.runner) {
      Matter.Runner.stop(this.runner);
    }

    if (this.engine) {
      Matter.World.clear(this.engine.world, false);
      Matter.Engine.clear(this.engine);
    }
  }

  private processText() {
    if (!this.textRef?.nativeElement) return;

    const words = this.text.split(' ');
    const newHTML = words
      .map(word => {
        // Clean the word by removing punctuation and converting to lowercase
        const cleanWord = word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '').toLowerCase();
        
        // Check if any highlight word matches (case-insensitive, ignoring punctuation)
        const isHighlighted = this.highlightWords.some(hw => {
          const cleanHw = hw.toLowerCase();
          return cleanWord === cleanHw || cleanWord.includes(cleanHw);
        });
        
        return `<span class="word ${isHighlighted ? this.highlightClass : ''}">${word}</span>`;
      })
      .join(' ');

    this.textRef.nativeElement.innerHTML = newHTML;
  }

  private setupScrollTrigger() {
    this.observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          this.effectStarted = true;
          this.initEffect();
          if (this.observer) {
            this.observer.disconnect();
          }
        }
      },
      { threshold: 0.1 }
    );

    this.observer.observe(this.containerRef.nativeElement);
  }

  private initEffect() {
    if (!this.effectStarted) return;

    const { Engine, Render, World, Bodies, Runner, Mouse, MouseConstraint } = Matter;

    if (!this.containerRef?.nativeElement || !this.canvasContainerRef?.nativeElement || !this.textRef?.nativeElement) {
      return;
    }

    const containerRect = this.containerRef.nativeElement.getBoundingClientRect();
    const width = containerRect.width;
    const height = containerRect.height;

    if (width <= 0 || height <= 0) {
      return;
    }

    this.engine = Engine.create();
    this.engine.world.gravity.y = this.gravity;

    this.render = Render.create({
      element: this.canvasContainerRef.nativeElement,
      engine: this.engine,
      options: {
        width,
        height,
        background: this.backgroundColor,
        wireframes: this.wireframes
      }
    });

    const boundaryOptions = {
      isStatic: true,
      render: { fillStyle: 'transparent' }
    };

    const floor = Bodies.rectangle(width / 2, height + 25, width, 50, boundaryOptions);
    const leftWall = Bodies.rectangle(-25, height / 2, 50, height, boundaryOptions);
    const rightWall = Bodies.rectangle(width + 25, height / 2, 50, height, boundaryOptions);
    const ceiling = Bodies.rectangle(width / 2, -25, width, 50, boundaryOptions);

    const wordSpans = this.textRef.nativeElement.querySelectorAll('.word');
    this.wordBodies = Array.from(wordSpans).map((elem: any) => {
      const rect = elem.getBoundingClientRect();

      const x = rect.left - containerRect.left + rect.width / 2;
      const y = rect.top - containerRect.top + rect.height / 2;

      const body = Bodies.rectangle(x, y, rect.width, rect.height, {
        render: { fillStyle: 'transparent' },
        restitution: 0.8,
        frictionAir: 0.01,
        friction: 0.2
      });

      Matter.Body.setVelocity(body, {
        x: (Math.random() - 0.5) * 5,
        y: 0
      });
      Matter.Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.05);
      return { elem, body };
    });

    this.wordBodies.forEach(({ elem, body }: any) => {
      elem.style.position = 'absolute';
      elem.style.left = `${body.position.x - (body.bounds.max.x - body.bounds.min.x) / 2}px`;
      elem.style.top = `${body.position.y - (body.bounds.max.y - body.bounds.min.y) / 2}px`;
      elem.style.transform = 'none';
    });

    const mouse = Mouse.create(this.containerRef.nativeElement);
    const mouseConstraint = MouseConstraint.create(this.engine, {
      mouse,
      constraint: {
        stiffness: this.mouseConstraintStiffness,
        render: { visible: false }
      }
    });
    this.render.mouse = mouse;

    World.add(this.engine.world, [floor, leftWall, rightWall, ceiling, mouseConstraint, ...this.wordBodies.map((wb: any) => wb.body)]);

    this.runner = Runner.create();
    Runner.run(this.runner, this.engine);
    Render.run(this.render);

    const updateLoop = () => {
      if (!this.effectStarted) return;

      this.wordBodies.forEach(({ body, elem }: any) => {
        const { x, y } = body.position;
        elem.style.left = `${x}px`;
        elem.style.top = `${y}px`;
        elem.style.transform = `translate(-50%, -50%) rotate(${body.angle}rad)`;
      });
      Matter.Engine.update(this.engine);
      requestAnimationFrame(updateLoop);
    };
    updateLoop();
  }

  @HostListener('click')
  onClick() {
    if (!this.effectStarted && this.trigger === 'click') {
      this.effectStarted = true;
      this.initEffect();
    }
  }

  @HostListener('mouseenter')
  onMouseEnter() {
    if (!this.effectStarted && this.trigger === 'hover') {
      this.effectStarted = true;
      this.initEffect();
    }
  }
}