import { CommonModule } from '@angular/common';
import { Component, ElementRef, Input, OnChanges, SimpleChanges, ViewChild, AfterViewInit, OnDestroy, HostListener } from '@angular/core';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';

@Component({
  selector: 'app-obj-viewer',
  imports: [CommonModule],
  templateUrl: './obj-viewer.component.html',
  styleUrl: './obj-viewer.component.scss'
})
export class ObjViewerComponent implements AfterViewInit, OnDestroy, OnChanges {
  @ViewChild('rendererContainer') rendererContainer!: ElementRef;

  @Input() objPath: string = '';
  @Input() autoRotate: boolean = false;
  @Input() backgroundColor: string = '#222222';
  @Input() showZoomButtons: boolean = true; // Control visibility of zoom buttons

  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private object: THREE.Group | null = null;
  private animationId!: number;
  private objLoader!: OBJLoader;

  // Mouse control variables
  private isMouseDown: boolean = false;
  private mouseX: number = 0;
  private mouseY: number = 0;
  private previousMouseX: number = 0;
  private previousMouseY: number = 0;
  private targetRotationX: number = 0;
  private targetRotationY: number = 0;
  private currentRotationX: number = 0;
  private currentRotationY: number = 0;

  // Zoom variables
  private zoomSpeed: number = 0.5;
  private minZoom: number = 1;
  private maxZoom: number = 10;
  private currentZoom: number = 5;

  isLoaded: boolean = false;
  statusMessage: string = 'Ready to load OBJ file';

  ngAfterViewInit(): void {
    this.initThree();
    this.objLoader = new OBJLoader();
    this.animate();

    if (this.objPath) {
      this.loadObj();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['objPath'] && this.objPath) {
      this.loadObj();
    }

    if (changes['backgroundColor']) {
      this.updateBackgroundColor();
    }
  }

  ngOnDestroy(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    if (this.renderer) {
      this.renderer.dispose();
    }
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.updateSize();
  }

  private initThree(): void {
    const container = this.rendererContainer.nativeElement;

    this.scene = new THREE.Scene();
    this.updateBackgroundColor();

    this.camera = new THREE.PerspectiveCamera(75, this.getAspectRatio(), 0.1, 1000);
    this.camera.position.z = this.currentZoom;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.updateSize();
    container.appendChild(this.renderer.domElement);

    // Add lights
    const ambientLight = new THREE.AmbientLight(0x404040);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(1, 1, 1);
    this.scene.add(directionalLight);

    // Add event listeners for mouse controls
    this.setupMouseControls();
  }

  private setupMouseControls(): void {
    const canvas = this.renderer.domElement;

    // Mouse down event
    canvas.addEventListener('mousedown', (event) => {
      this.isMouseDown = true;
      this.previousMouseX = event.clientX;
      this.previousMouseY = event.clientY;
      canvas.style.cursor = 'grabbing';
    });

    // Mouse move event
    canvas.addEventListener('mousemove', (event) => {
      if (!this.isMouseDown || !this.object) return;

      const deltaX = event.clientX - this.previousMouseX;
      const deltaY = event.clientY - this.previousMouseY;

      this.targetRotationY += deltaX * 0.01;
      this.targetRotationX += deltaY * 0.01;
      this.targetRotationX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.targetRotationX));

      this.previousMouseX = event.clientX;
      this.previousMouseY = event.clientY;
    });

    // Mouse up event
    canvas.addEventListener('mouseup', () => {
      this.isMouseDown = false;
      canvas.style.cursor = 'grab';
    });

    // Mouse leave event
    canvas.addEventListener('mouseleave', () => {
      this.isMouseDown = false;
      canvas.style.cursor = 'default';
    });

    // Mouse enter event
    canvas.addEventListener('mouseenter', () => {
      if (!this.isMouseDown) {
        canvas.style.cursor = 'grab';
      }
    });

    // Mouse wheel event for zoom
    canvas.addEventListener('wheel', (event) => {
      event.preventDefault();
      this.handleZoom(event.deltaY);
    });

    // Touch events for mobile support
    this.setupTouchControls(canvas);
  }

  private setupTouchControls(canvas: HTMLElement): void {
    let touchStartX: number = 0;
    let touchStartY: number = 0;
    let touchStartDistance: number = 0;
    let lastTouchTime: number = 0;

    canvas.addEventListener('touchstart', (event) => {
      event.preventDefault();

      if (event.touches.length === 1) {
        touchStartX = event.touches[0].clientX;
        touchStartY = event.touches[0].clientY;
        lastTouchTime = Date.now();
      } else if (event.touches.length === 2) {
        touchStartDistance = this.getTouchDistance(event.touches[0], event.touches[1]);
      }
    });

    canvas.addEventListener('touchmove', (event) => {
      event.preventDefault();

      if (event.touches.length === 1 && this.object) {
        const deltaX = event.touches[0].clientX - touchStartX;
        const deltaY = event.touches[0].clientY - touchStartY;

        this.targetRotationY += deltaX * 0.01;
        this.targetRotationX += deltaY * 0.01;
        this.targetRotationX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.targetRotationX));

        touchStartX = event.touches[0].clientX;
        touchStartY = event.touches[0].clientY;
      } else if (event.touches.length === 2) {
        const currentDistance = this.getTouchDistance(event.touches[0], event.touches[1]);
        const zoomDelta = (currentDistance - touchStartDistance) * 0.01;

        this.handleZoom(zoomDelta * 50);
        touchStartDistance = currentDistance;
      }
    });

    // Double tap to reset zoom
    canvas.addEventListener('touchend', (event) => {
      const currentTime = Date.now();
      const tapLength = currentTime - lastTouchTime;

      if (tapLength < 500 && event.touches.length === 0) {
        // Double tap detection
        if (currentTime - lastTouchTime < 300) {
          this.resetZoom();
        }
      }
      lastTouchTime = currentTime;
    });
  }

  private getTouchDistance(touch1: Touch, touch2: Touch): number {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private handleZoom(deltaY: number): void {
    this.currentZoom += deltaY * this.zoomSpeed * 0.01;
    this.currentZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.currentZoom));
    this.camera.position.z = this.currentZoom;
  }

  // Public zoom methods for buttons
  zoomIn(): void {
    this.currentZoom -= this.zoomSpeed;
    this.currentZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.currentZoom));
    this.camera.position.z = this.currentZoom;
  }

  zoomOut(): void {
    this.currentZoom += this.zoomSpeed;
    this.currentZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.currentZoom));
    this.camera.position.z = this.currentZoom;
  }

  resetZoom(): void {
    this.currentZoom = (this.minZoom + this.maxZoom) / 2;
    this.camera.position.z = this.currentZoom;
  }

  private getAspectRatio(): number {
    const container = this.rendererContainer.nativeElement;
    return container.clientWidth / container.clientHeight;
  }

  private updateSize(): void {
    const container = this.rendererContainer.nativeElement;
    const width = container.clientWidth;
    const height = container.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  private updateBackgroundColor(): void {
    if (this.scene) {
      this.scene.background = new THREE.Color(this.backgroundColor);
    }
  }

  private animate = (): void => {
    this.animationId = requestAnimationFrame(this.animate);

    if (this.object) {
      this.currentRotationX += (this.targetRotationX - this.currentRotationX) * 0.1;
      this.currentRotationY += (this.targetRotationY - this.currentRotationY) * 0.1;

      this.object.rotation.x = this.currentRotationX;
      this.object.rotation.y = this.currentRotationY;

      if (this.autoRotate && !this.isMouseDown) {
        this.targetRotationY += 0.002;
      }
    }

    this.renderer.render(this.scene, this.camera);
  }

  private async loadObj(): Promise<void> {
    if (!this.objPath) return;

    this.statusMessage = 'Loading OBJ file...';
    this.isLoaded = false;

    try {
      if (this.object) {
        this.scene.remove(this.object);
      }

      this.object = await new Promise((resolve, reject) => {
        this.objLoader.load(
          this.objPath,
          (object) => resolve(object),
          (progress) => {
            const percent = (progress.loaded / progress.total * 100).toFixed(0);
            this.statusMessage = `Loading: ${percent}%`;
          },
          (error) => reject(error)
        );
      });

      this.scene.add(this.object!);
      this.centerObject();
      this.resetCamera();
      this.isLoaded = true;
      this.statusMessage = 'OBJ file loaded successfully';
    } catch (error) {
      //console.error('Error loading OBJ file:', error);
      this.statusMessage = 'Error loading OBJ file';
    }
  }

  private centerObject(): void {
    if (!this.object) return;

    const box = new THREE.Box3().setFromObject(this.object);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    this.object.position.x = -center.x;
    this.object.position.y = -center.y;
    this.object.position.z = -center.z;

    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = this.camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / Math.sin(fov / 2));

    this.currentZoom = cameraZ * 1.2;
    this.minZoom = cameraZ * 0.5;
    this.maxZoom = cameraZ * 3;
    this.camera.position.z = this.currentZoom;
  }

  private resetCamera(): void {
    this.targetRotationX = 0;
    this.targetRotationY = 0;
    this.currentRotationX = 0;
    this.currentRotationY = 0;

    if (this.object) {
      this.object.rotation.x = 0;
      this.object.rotation.y = 0;
    }
  }

  public loadObjFromPath(path: string): void {
    this.objPath = path;
    this.loadObj();
  }

  public resetViewer(): void {
    if (this.object) {
      this.scene.remove(this.object);
      this.object = null;
    }
    this.resetCamera();
    this.resetZoom();
    this.isLoaded = false;
    this.statusMessage = 'Viewer reset';
  }

  public resetCameraPosition(): void {
    this.resetCamera();
    this.resetZoom();
  }
}