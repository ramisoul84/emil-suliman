import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class BlurService {
    private blurState = new BehaviorSubject<boolean>(false);
    blurState$ = this.blurState.asObservable();

    private resizeState = new BehaviorSubject<boolean>(false);
    resizeState$ = this.resizeState.asObservable();

    setBlur(isBlur: boolean) {
        this.blurState.next(isBlur);
    }

    setResize(isReszizing: boolean) {
        this.resizeState.next(isReszizing);
    }
}