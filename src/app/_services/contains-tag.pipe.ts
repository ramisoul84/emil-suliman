import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'containsTag',
  pure: true 
})
export class ContainsTagPipe implements PipeTransform {
  transform(tags: string[], tagToCheck: string): boolean {
    
    if (!tags || !Array.isArray(tags)) {
      return false;
    }
    return tags.includes(tagToCheck);
  }
}