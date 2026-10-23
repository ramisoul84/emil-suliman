import { Injectable, NgZone, signal } from '@angular/core';
import { isPhone } from '../_config/phone';

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
    // phones: bigger as it comes, the size slider at 85% (Emil 22 Oct); elsewhere 60%
    radius: typeof window !== 'undefined' && isPhone() ? 0.185 : 0.16, // 0.2
    speed: 0.6,  // 1.2
    wobble: 1.3,
    intensity: 1.4,
    fgColor: '#00ff41',
    bgColor: '#000000',
    pixelated: true
};

@Injectable({
    providedIn: 'root'
})
export class BlobService {
    params = signal<BlobParams>({ ...DEFAULT_PARAMS });
    state = signal<BlobState>({
        cx: 0.5,
        cy: 0.5,
        time: 0,
        isPaused: false
    });

    private animationFrameId: number | null = null;
    private lastTimestamp = 0;
    /** where the blob is this frame: kept out of the signal, so its 60 frames a second don't
        make the whole page check itself for changes; the canvas listens instead (onFrame) */
    private live = { cx: 0.5, cy: 0.5, time: 0 };
    private frameListeners = new Set<() => void>();
    /** off screen: no frames at all (the landing's blob only moves while it can be seen) */
    private hidden = false;

    /** how far the blob has grown, 0-1, read every frame: the landing's way in grows it out of
        nothing from behind the name (home.ts) */
    growth: () => number = () => 1;
    /** where it grows out from, as parts of its box (null: its own middle) */
    growOrigin: () => { x: number; y: number } | null = () => null;

    /** the blob this frame (position, time) with its pause state */
    current(): BlobState {
        return { ...this.live, isPaused: this.state().isPaused };
    }

    onFrame(fn: () => void): () => void {
        this.frameListeners.add(fn);
        return () => this.frameListeners.delete(fn);
    }

    /** the blob's box left (or came back into) the window */
    setHidden(hidden: boolean): void {
        if (hidden === this.hidden) return;
        this.hidden = hidden;
        if (hidden) this.stopAnimation();
        else if (!this.state().isPaused) this.startAnimation();
    }
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
        if (this.animationFrameId !== null || this.hidden) {
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

        const currentState = this.live;
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

        this.live = { cx, cy, time: newTime };
        this.frameListeners.forEach(fn => fn());

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

    hexToRgb(hex: string) {
        // Remove the hash if present
        hex = hex.replace(/^#/, '');

        // Parse the hex values
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);

        return { r, g, b };
    }

    getDefaults(): BlobParams {
        return { ...DEFAULT_PARAMS };
    }
}
