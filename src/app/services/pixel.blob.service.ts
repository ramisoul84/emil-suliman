import { Injectable, NgZone, signal } from '@angular/core';

export interface BlobParams {
    radius: number;      // 0.10 - 0.20 (relative to canvas size)
    speed: number;       // 0.20 - 1.50
    wobble: number;      // 0.00 - 0.50
    intensity: number;   // 0.50 - 2.00 (bubble opacity multiplier)
    fgColor: string;     // Foreground color
    bgColor: string;     // Background color
    pixelated: boolean;  // Enable/disable pixelated effect
}

export interface BlobState {
    cx: number;          // Center X position
    cy: number;          // Center Y position
    time: number;        // Animation time
    isPaused: boolean;   // Animation pause state
}

const DEFAULT_PARAMS: BlobParams = {
    radius: 0.16,
    speed: 0.345,
    wobble: 1.0,
    intensity: 1.0,
    fgColor: '#00ff41',
    bgColor: '#000000',
    pixelated: true
};

@Injectable({
    providedIn: 'root'
})
export class PixelBlobService {
    params = signal<BlobParams>({ ...DEFAULT_PARAMS });
    state = signal<BlobState>({
        cx: 0.5,
        cy: 0.5,
        time: 0,
        isPaused: false
    });

    private animationFrameId: number | null = null;
    private lastTimestamp = 0;
    private prefersReducedMotion = false;

    constructor(private ngZone: NgZone) {
        // Check for reduced motion preference
        if (typeof window !== 'undefined' && window.matchMedia) {
            const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
            this.prefersReducedMotion = mediaQuery.matches;

            mediaQuery.addEventListener('change', (e) => {
                this.prefersReducedMotion = e.matches;
                if (this.prefersReducedMotion) {
                    this.pause();
                }
            });
        }
    }

    startAnimation(): void {
        if (this.animationFrameId !== null) {
            return;
        }

        this.lastTimestamp = performance.now();

        // Run animation outside Angular zone for better performance
        this.ngZone.runOutsideAngular(() => {
            this.animate(this.lastTimestamp);
        });
    }

    private animate(timestamp: number): void {
        if (this.state().isPaused) {
            this.animationFrameId = null;
            return;
        }

        const deltaTime = (timestamp - this.lastTimestamp) / 1000;
        this.lastTimestamp = timestamp;

        const currentState = this.state();
        const currentParams = this.params();

        // Clamp speed if reduced motion is preferred
        const effectiveSpeed = this.prefersReducedMotion
            ? Math.min(currentParams.speed, 0.3)
            : currentParams.speed;

        // Adjust speed based on wobble to compensate for perceived speed increase
        const adjustedSpeed = effectiveSpeed / currentParams.wobble;

        const newTime = currentState.time + deltaTime * adjustedSpeed;

        // Animate center position in circular pattern (±12% of canvas size)
        const moveRadius = 0.12;
        const cx = 0.5 + Math.sin(newTime * 0.8) * moveRadius;
        const cy = 0.5 + Math.cos(newTime * 0.6) * moveRadius;

        this.state.set({
            ...currentState,
            cx,
            cy,
            time: newTime
        });

        this.animationFrameId = requestAnimationFrame((ts) => this.animate(ts));
    }

    stopAnimation(): void {
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    pause(): void {
        this.state.update(s => ({ ...s, isPaused: true }));
        this.stopAnimation();
    }

    resume(): void {
        this.state.update(s => ({ ...s, isPaused: false }));
        this.startAnimation();
    }

    togglePause(): void {
        if (this.state().isPaused) {
            this.resume();
        } else {
            this.pause();
        }
    }

    updateParams(params: Partial<BlobParams>): void {
        this.params.update(current => ({ ...current, ...params }));
    }

    resetToDefaults(): void {
        this.params.set({ ...DEFAULT_PARAMS });
    }

    randomize(): void {
        this.params.set({
            radius: 0.10 + Math.random() * 0.10,
            speed: 0.20 + Math.random() * 1.30,
            wobble: 0.50 + Math.random() * 1.50,
            intensity: 0.50 + Math.random() * 1.50,
            fgColor: '#00ff41',
            bgColor: '#000000',
            pixelated: this.params().pixelated
        });
    }

    getDefaults(): BlobParams {
        return { ...DEFAULT_PARAMS };
    }
}
