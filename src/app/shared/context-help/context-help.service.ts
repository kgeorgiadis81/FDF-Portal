import { Injectable } from '@angular/core';
import { MatMenuTrigger } from '@angular/material/menu';

@Injectable({ providedIn: 'root' })
export class ContextHelpService {
  private currentTrigger: MatMenuTrigger | null = null;

  registerOpen(trigger: MatMenuTrigger): void {
    if (this.currentTrigger && this.currentTrigger !== trigger && this.currentTrigger.menuOpen) {
      this.currentTrigger.closeMenu();
    }
    this.currentTrigger = trigger;
  }

  registerClosed(trigger: MatMenuTrigger): void {
    if (this.currentTrigger === trigger) {
      this.currentTrigger = null;
    }
  }
}
