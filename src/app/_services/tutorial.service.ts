import { Injectable, signal } from '@angular/core';

/** The landing page's short tutorial (control.ts): the hero's lines wait for it to end */
@Injectable({ providedIn: 'root' })
export class TutorialService {
  readonly done = signal(false);
}
