import { Injectable } from '@angular/core';

/**
 * How far the story of a page has been told, 0..1 (the timeline: how much is drawn; the
 * cases: which case of how many). The side menu shows it as a percentage beside the page
 * you are on. Plain values (read at 12 fps by the menu), no change detection needed.
 */
@Injectable({ providedIn: 'root' })
export class SectionProgressService {
  private values = new Map<string, number>();

  set(id: string, value: number | undefined): void {
    if (value === undefined || Number.isNaN(value)) this.values.delete(id);
    else this.values.set(id, Math.max(0, Math.min(1, value)));
  }

  get(id: string): number | undefined {
    return this.values.get(id);
  }
}
