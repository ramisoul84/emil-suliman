// blur.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class BlurService {
  private blurState = new BehaviorSubject<boolean>(false);
  blurState$ = this.blurState.asObservable();

  setBlur(shouldBlur: boolean) {
    this.blurState.next(shouldBlur);
  }
}