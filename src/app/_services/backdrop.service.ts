import { Injectable } from '@angular/core';

/**
 * The side menu floats over the pages; over a dark picture or film its words turn white. A
 * page says, for each of the menu's words and arrows (its rectangle on screen and its id:
 * 'up', 'down' or the page's id), whether it should be white there: true / false, or
 * undefined where the page has nothing to say (not over its picture).
 */
export type ToneProvider = (rects: DOMRect[], ids: string[]) => (boolean | undefined)[];

/** a case's menu: white over its picture, these ones ('up', 'down', a page id) kept black */
export interface MenuTone { white: boolean; except?: string[]; }

@Injectable({ providedIn: 'root' })
export class BackdropService {
  private providers = new Set<ToneProvider>();

  register(fn: ToneProvider): () => void {
    this.providers.add(fn);
    return () => this.providers.delete(fn);
  }

  /** white (true) or black (false) for each */
  white(rects: DOMRect[], ids: string[]): boolean[] {
    const out: (boolean | undefined)[] = rects.map(() => undefined);
    for (const fn of this.providers) {
      fn(rects, ids).forEach((v, i) => { if (out[i] === undefined && v !== undefined) out[i] = v; });
    }
    return out.map(v => !!v);
  }
}
