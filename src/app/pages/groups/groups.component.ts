import { Component, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'fdp-groups',
  imports: [],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: '',
})
export class GroupsComponent {
  constructor(router: Router) {
    // /groups redirects to dashboard which shows My Groups
    router.navigate(['/dashboard'], { replaceUrl: true });
  }
}
