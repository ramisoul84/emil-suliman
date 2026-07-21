import { Injectable } from '@angular/core';
import { AnimationItem } from 'lottie-web';
import { BehaviorSubject } from 'rxjs';

export interface AssetConfig {
    type: 'image' | 'video' | 'json';
    url: string;
    id?: string;
}

export interface CachedAsset {
    element: HTMLImageElement | HTMLVideoElement;
    url: string;
    type: 'image' | 'video' | 'json';
    loaded: boolean;
    timestamp: number;
    data?: any;
}

@Injectable({
    providedIn: 'root'
})
export class LoaderService {
    private isLoading = new BehaviorSubject<boolean>(true);
    private progress = new BehaviorSubject<number>(0);

    isLoading$ = this.isLoading.asObservable();
    progress$ = this.progress.asObservable();

    private assetCache = new Map<string, CachedAsset>();

    private assetsToLoad: AssetConfig[] = [];
    private loadedCount = 0;
    private failedCount = 0;
    private assetPromises: Promise<void>[] = [];

    registerAssets(assets: AssetConfig[]): void {
        this.assetsToLoad.push(...assets);
    }

    async startLoading(): Promise<void> {
        if (this.assetsToLoad.length === 0) {
            this.completeLoading();
            return;
        }

        this.isLoading.next(true);
        this.progress.next(0);

        this.assetsToLoad.forEach((asset, index) => {
            const promise = this.loadAsset(asset, index);
            this.assetPromises.push(promise);
        });

        await Promise.allSettled(this.assetPromises);

        this.completeLoading();
    }

    private async loadAsset(asset: AssetConfig, index: number): Promise<void> {
        return new Promise((resolve) => {
            switch (asset.type) {
                case 'image':
                    this.loadImage(asset, index, resolve);
                    break;
                case 'video':
                    this.loadVideo(asset, index, resolve);
                    break;
                case 'json':
                    this.loadJson(asset, index, resolve);
                    break;
                default:
                    console.warn(`[${index}] Unknown asset type: ${asset.type}`);
                    this.onAssetFailed();
                    resolve();
            }
        });
    }

    private loadImage(asset: AssetConfig, index: number, resolve: () => void): void {
        const img = new Image();

        const onLoad = () => {
            this.assetCache.set(asset.url, {
                element: img,
                url: asset.url,
                type: 'image',
                loaded: true,
                timestamp: Date.now()
            });

            this.onAssetLoaded();
            cleanup();
            resolve();
        };

        const onError = (error: any) => {
            this.onAssetFailed();
            cleanup();
            resolve();
        };

        const cleanup = () => {
            img.removeEventListener('load', onLoad);
            img.removeEventListener('error', onError);
        };

        img.addEventListener('load', onLoad);
        img.addEventListener('error', onError);
        img.src = asset.url;

        if (img.complete) {
            onLoad();
        }
    }

    private loadVideo(asset: AssetConfig, index: number, resolve: () => void): void {
        const video = document.createElement('video');
        video.preload = 'auto';
        video.muted = true;
        video.autoplay = false;
        video.setAttribute('preload', 'metadata');

        const onCanPlay = () => {
            this.assetCache.set(asset.url, {
                element: video,
                url: asset.url,
                type: 'video',
                loaded: true,
                timestamp: Date.now()
            });

            this.onAssetLoaded();
            cleanup();
            resolve();
        };

        const onError = (error: any) => {
            console.warn(`[${index}] Failed to load video: ${asset.url}`, error);
            this.onAssetFailed();
            cleanup();
            resolve();
        };

        const cleanup = () => {
            video.removeEventListener('canplay', onCanPlay);
            video.removeEventListener('canplaythrough', onCanPlay);
            video.removeEventListener('loadeddata', onCanPlay);
            video.removeEventListener('error', onError);
        };

        video.addEventListener('canplay', onCanPlay);
        video.addEventListener('canplaythrough', onCanPlay);
        video.addEventListener('loadeddata', onCanPlay);
        video.addEventListener('error', onError);
        video.src = asset.url;

        video.load();
    }


    private loadJson(asset: AssetConfig, index: number, resolve: () => void): void {
        if (this.assetCache.has(asset.url)) {
            this.onAssetLoaded();
            resolve();
            return;
        }

        fetch(asset.url)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                return response.json();
            })
            .then(jsonData => {
                this.assetCache.set(asset.url, {
                    element: jsonData,
                    url: asset.url,
                    type: 'json',
                    loaded: true,
                    timestamp: Date.now(),
                    data: jsonData
                });

                this.onAssetLoaded();
                resolve();
            })
            .catch(error => {
                this.onAssetFailed();
                resolve();
            });
    }

    getCachedAsset(url: string): HTMLImageElement | HTMLVideoElement | AnimationItem | undefined {
        const cached = this.assetCache.get(url);
        return cached?.element;
    }

    isAssetCached(url: string): boolean {
        return this.assetCache.has(url);
    }

    getAllCachedAssets(): CachedAsset[] {
        return Array.from(this.assetCache.values());
    }

    getCachedAssetsByType(type: 'image' | 'video' | 'json'): CachedAsset[] {
        return this.getAllCachedAssets().filter(asset => asset.type === type);
    }

    isJsonCached(url: string): boolean {
        const cached = this.assetCache.get(url);
        return cached?.type === 'json' && cached.loaded === true;
    }

    getJsonData(url: string): any {
        const cached = this.assetCache.get(url);
        if (cached?.type === 'json') {
            return cached.data || cached.element;
        }
        return null;
    }

    async cacheAsset(asset: AssetConfig): Promise<void> {
        if (this.isAssetCached(asset.url)) {
            return Promise.resolve();
        }

        return new Promise((resolve) => {
            switch (asset.type) {
                case 'image':
                    this.loadImage(asset, -1, resolve);
                    break;
                case 'video':
                    this.loadVideo(asset, -1, resolve);
                    break;
                case 'json':
                    this.loadJson(asset, -1, resolve);
                    break;
                default:
                    resolve();
            }
        });
    }

    clearCache(): void {
        this.assetCache.clear();
    }

    getCacheStats() {
        const total = this.assetCache.size;
        const images = this.getCachedAssetsByType('image').length;
        const videos = this.getCachedAssetsByType('video').length;

        return {
            total,
            images,
            videos,
            cacheSize: `${total} assets (${images} images, ${videos} videos)`
        };
    }


    private onAssetLoaded(): void {
        this.loadedCount++;
        this.updateProgress();
    }

    private onAssetFailed(): void {
        this.failedCount++;
        this.updateProgress();
    }

    private updateProgress(): void {
        const totalProcessed = this.loadedCount + this.failedCount;
        const totalAssets = this.assetsToLoad.length;
        const progress = Math.round((totalProcessed / totalAssets) * 100);

        this.progress.next(progress);
    }

    private completeLoading(): void {
        this.progress.next(100);

        setTimeout(() => {
            this.isLoading.next(false);
        }, 500);
    }

    getAssetSrc(url: string): string {
        const cached = this.assetCache.get(url);
        if (cached?.loaded) {
            if (cached.type === 'image') {
                return (cached.element as HTMLImageElement).src;
            } else if (cached.type === 'video') {
                return (cached.element as HTMLVideoElement).src;
            }
        }
        return url; // Fallback to original URL
    }

    getStats() {
        return {
            total: this.assetsToLoad.length,
            loaded: this.loadedCount,
            failed: this.failedCount
        };
    }

    reset(): void {
        this.assetsToLoad = [];
        this.assetPromises = [];
        this.loadedCount = 0;
        this.failedCount = 0;
        this.isLoading.next(true);
        this.progress.next(0);
    }
}