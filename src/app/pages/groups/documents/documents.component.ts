import {
  Component, OnInit, signal, computed, ChangeDetectionStrategy, OnDestroy,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { DatePipe } from '@angular/common';

import {
  DocumentService, DocumentContext, DocumentType, DocumentTypeContext,
} from '../../../services/document.service';

interface DocSection {
  type: DocumentType;
  label: string;
  description: string;
  ctx: DocumentTypeContext;
}

@Component({
  selector: 'fdp-documents',
  imports: [
    RouterLink, DatePipe,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatSnackBarModule,
  ],
  templateUrl: './documents.component.html',
  styleUrl: './documents.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class DocumentsComponent implements OnInit, OnDestroy {
  groupId = 0;
  loading = signal(true);
  error = signal('');
  uploading = signal<DocumentType | null>(null);
  showHistory = signal(false);
  history = signal<import('../../../services/document.service').RegistrationDocument[]>([]);
  context = signal<DocumentContext | null>(null);

  private objectUrls: string[] = [];

  readonly sections = computed<DocSection[]>(() => {
    const ctx = this.context();
    if (!ctx) return [];
    const labels: Record<DocumentType, { label: string; description: string }> = {
      SIGNED_ROSTER: {
        label: 'Signed Roster',
        description: 'Roster signed by the director (PDF only).',
      },
      YOUTH_SAFETY: {
        label: 'Youth Safety Compliance',
        description: 'Youth safety and compliance documentation (PDF only).',
      },
    };
    return ctx.documents.map((d) => ({
      type: d.document_type,
      label: labels[d.document_type].label,
      description: labels[d.document_type].description,
      ctx: d,
    }));
  });

  readonly canEdit = computed(() => this.context()?.deadline.can_edit ?? false);
  readonly isReadOnly = computed(() => !this.canEdit());
  readonly isActiveEvent = computed(() => this.context()?.group.isActive ?? false);

  constructor(
    private route: ActivatedRoute,
    private docSvc: DocumentService,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.groupId = Number(this.route.snapshot.paramMap.get('id'));
    if (!this.groupId) {
      this.error.set('Invalid group.');
      this.loading.set(false);
      return;
    }
    this.loadContext();
  }

  ngOnDestroy(): void {
    this.objectUrls.forEach((u) => URL.revokeObjectURL(u));
  }

  private loadContext(): void {
    this.loading.set(true);
    this.docSvc.getDocumentContext(this.groupId).subscribe({
      next: (ctx) => {
        this.context.set(ctx);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.error ?? 'Unable to load documents.');
      },
    });
  }

  toggleHistory(): void {
    if (!this.showHistory()) {
      this.docSvc.getHistory(this.groupId).subscribe({
        next: (rows) => {
          this.history.set(rows);
          this.showHistory.set(true);
        },
        error: () => this.snackBar.open('Unable to load document history.', 'Close', { duration: 5000 }),
      });
    } else {
      this.showHistory.set(false);
    }
  }

  onFileSelected(event: Event, docType: DocumentType): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    input.value = '';
    this.upload(file, docType);
  }

  private upload(file: File, docType: DocumentType): void {
    this.uploading.set(docType);
    this.docSvc.uploadDocument(this.groupId, file, docType).subscribe({
      next: () => {
        this.uploading.set(null);
        this.snackBar.open('Document uploaded. Awaiting FDF review.', 'Close', {
          duration: 4000,
        });
        this.loadContext();
        if (this.showHistory()) this.toggleHistory();
      },
      error: (err) => {
        this.uploading.set(null);
        this.snackBar.open(err?.error?.error ?? 'Upload failed.', 'Close', {
          duration: 6000,
          panelClass: 'error-snackbar',
        });
      },
    });
  }

  viewDocument(docId: number): void {
    this.docSvc.fetchContent(this.groupId, docId).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        this.objectUrls.push(url);
        window.open(url, '_blank', 'noopener,noreferrer');
      },
      error: () => this.snackBar.open('Unable to view document.', 'Close', { duration: 5000 }),
    });
  }

  downloadDocument(docId: number, filename: string): void {
    this.docSvc.fetchContent(this.groupId, docId, true).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        this.objectUrls.push(url);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
      },
      error: () => this.snackBar.open('Unable to download document.', 'Close', { duration: 5000 }),
    });
  }

  statusLabel(status: string): string {
    switch (status) {
      case 'VERIFIED': return 'Verified';
      case 'REJECTED': return 'Rejected';
      case 'PENDING': return 'Pending Review';
      default: return 'Not Uploaded';
    }
  }

  statusClass(status: string): string {
    switch (status) {
      case 'VERIFIED': return 'status-verified';
      case 'REJECTED': return 'status-rejected';
      case 'PENDING': return 'status-pending';
      default: return 'status-missing';
    }
  }

  formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }

  formatDeadlineDate(date: string | null): string {
    if (!date) return '';
    const [y, m, d] = date.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  }

  formatEffectiveCutoff(iso: string | null): string {
    if (!iso) return '';
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit',
    });
  }

  historyForType(type: DocumentType) {
    return this.history().filter((d) => d.document_type === type);
  }
}
