import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { FormBuilder, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';

import { getPortalHelp, PortalHelpKey } from './portal-help-content';
import { ContextHelpComponent } from './context-help/context-help.component';
import { ContextHelpService } from './context-help/context-help.service';
import { ConfirmDialogComponent } from './confirm-dialog/confirm-dialog.component';
import { cloneFormValue, formValuesEqual } from './unsaved-changes/form-values.util';
import { FormAutosaveCoordinator } from './unsaved-changes/form-autosave';
import { implementsHasUnsavedChanges } from './unsaved-changes/has-unsaved-changes';
import { unsavedChangesGuard } from './unsaved-changes/unsaved-changes.guard';
import { UnsavedChangesService } from './unsaved-changes/unsaved-changes.service';
import { UnsavedChangesDialogComponent } from './unsaved-changes/unsaved-changes-dialog.component';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

describe('portal help content', () => {
  it('returns an entry for every help key', () => {
    const keys: PortalHelpKey[] = [
      'signup.dateOfBirth', 'signup.consent', 'group.name', 'group.parish', 'group.groupType',
      'roster.firstName', 'performance.danceName', 'costume.region', 'documents.signedRoster',
    ];
    for (const key of keys) {
      expect(getPortalHelp(key).title.length).toBeGreaterThan(0);
      expect(getPortalHelp(key).body.length).toBeGreaterThan(0);
    }
  });
});

describe('form value helpers and autosave', () => {
  it('treats blanks and key order as equal and clones values', () => {
    expect(formValuesEqual({ b: '', a: 1 }, { a: 1, b: null })).toBeTrue();
    expect(formValuesEqual({ a: 1 }, { a: 2 })).toBeFalse();
    expect(formValuesEqual(null, undefined)).toBeTrue();
    expect(formValuesEqual(['', 1], [null, 1])).toBeFalse();
    expect(formValuesEqual([{ name: '' }], [{ name: null }])).toBeTrue();
    const original = { nested: { name: 'A' } };
    const copy = cloneFormValue(original);
    copy.nested.name = 'B';
    expect(original.nested.name).toBe('A');
  });

  it('debounces a valid change, ignores invalid and disabled edits, and reports errors', fakeAsync(() => {
    const fb = new FormBuilder();
    const form = fb.group({ name: ['Ada', Validators.required] });
    const saves: string[] = [];
    const autosave = new FormAutosaveCoordinator(form, {
      debounceMs: 10,
      enabled: () => true,
      isValid: () => form.valid,
      save: (value) => {
        saves.push(String(value['name']));
        return of({ ok: true });
      },
      onSuccess: () => undefined,
    });
    autosave.setBaseline({ name: 'Ada' });
    autosave.connect();
    expect(autosave.hasUnsavedChanges()).toBeFalse();

    form.controls.name.setValue('Grace');
    expect(autosave.hasUnsavedChanges()).toBeTrue();
    tick(10);
    expect(saves).toEqual(['Grace']);
    expect(autosave.getBaseline()).toEqual({ name: 'Grace' });

    form.controls.name.setValue('');
    tick(10);
    expect(saves).toEqual(['Grace']);

    form.controls.name.setValue('Grace');
    tick(10);
    autosave.discardChanges();
    expect(form.controls.name.value).toBe('Grace');
    autosave.disconnect();
    form.controls.name.setValue('Ignored');
    tick(10);
    expect(saves).toEqual(['Grace']);
  }));

  it('keeps the baseline when the save fails and skips while disabled', fakeAsync(() => {
    const form = new FormBuilder().group({ name: ['A'] });
    let enabled = false;
    let failed = false;
    const autosave = new FormAutosaveCoordinator(form, {
      debounceMs: 5,
      enabled: () => enabled,
      save: () => throwError(() => new Error('nope')),
      onError: () => { failed = true; },
    });
    autosave.setBaseline({ name: 'A' });
    autosave.connect();
    form.controls.name.setValue('B');
    tick(5);
    expect(failed).toBeFalse();
    enabled = true;
    form.controls.name.setValue('C');
    tick(5);
    expect(failed).toBeTrue();
    expect(autosave.hasUnsavedChanges()).toBeTrue();
    autosave.disconnect();
  }));
});

describe('unsaved changes', () => {
  it('recognizes the interface and the guard lets clean components through', async () => {
    expect(implementsHasUnsavedChanges(null)).toBeFalse();
    expect(implementsHasUnsavedChanges({ hasUnsavedChanges() { return false; } })).toBeFalse();
    const clean = {
      hasUnsavedChanges: () => false,
      discardUnsavedChanges: () => undefined,
    };
    const guard = TestBed.runInInjectionContext(() => unsavedChangesGuard(clean, {} as never, {} as never, {} as never));
    expect(await guard).toBeTrue();
    const plain = TestBed.runInInjectionContext(() => unsavedChangesGuard({} as never, {} as never, {} as never, {} as never));
    expect(await plain).toBeTrue();
  });

  it('prompts and discards or keeps editing', async () => {
    let discarded = false;
    const dirty = {
      hasUnsavedChanges: () => true,
      discardUnsavedChanges: () => { discarded = true; },
    };
    const dialog = jasmine.createSpyObj<MatDialog>('MatDialog', ['open']);
    dialog.open.and.returnValue({ afterClosed: () => of(true) } as never);
    TestBed.configureTestingModule({ providers: [{ provide: MatDialog, useValue: dialog }] });
    const service = TestBed.inject(UnsavedChangesService);

    const leave = TestBed.runInInjectionContext(() => unsavedChangesGuard(dirty, {} as never, {} as never, {} as never));
    expect(await leave).toBeTrue();
    expect(discarded).toBeTrue();

    dialog.open.and.returnValue({ afterClosed: () => of(false) } as never);
    const stay = TestBed.runInInjectionContext(() => unsavedChangesGuard(dirty, {} as never, {} as never, {} as never));
    expect(await stay).toBeFalse();

    expect(await service.confirmLeave(() => false, () => undefined)).toBeTrue();
    expect(await service.confirmLeave(() => true, () => undefined)).toBeFalse();
    service.ngOnDestroy();
  });

  it('warns on beforeunload only while the check is true', () => {
    TestBed.configureTestingModule({ providers: [{ provide: MatDialog, useValue: {} }] });
    const service = TestBed.inject(UnsavedChangesService);
    let dirty = false;
    let handler: ((event: BeforeUnloadEvent) => void) | undefined;
    spyOn(window, 'addEventListener').and.callFake(((type: string, fn: EventListener) => {
      if (type === 'beforeunload') handler = fn as (event: BeforeUnloadEvent) => void;
    }) as never);
    spyOn(window, 'removeEventListener');
    const unbind = service.bindBeforeUnload(() => dirty);
    const event = { preventDefault() {}, returnValue: '' } as BeforeUnloadEvent;
    const prevent = spyOn(event, 'preventDefault');
    handler!(event);
    expect(prevent).not.toHaveBeenCalled();
    dirty = true;
    handler!(event);
    expect(prevent).toHaveBeenCalled();
    unbind();
    service.unbindBeforeUnload();
  });
});

describe('dialogs and context help', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideNoopAnimations()],
    });
  });

  it('renders confirm and unsaved dialogs with defaults and supplied copy', () => {
    const ref = jasmine.createSpyObj<MatDialogRef<unknown>>('MatDialogRef', ['close']);
    TestBed.overrideProvider(MatDialogRef, { useValue: ref });
    TestBed.overrideProvider(MAT_DIALOG_DATA, {
      useValue: { title: 'Delete', message: 'Sure?', confirmLabel: 'Delete', cancelLabel: 'Keep' },
    });
    const confirm = TestBed.createComponent(ConfirmDialogComponent);
    confirm.detectChanges();
    expect(confirm.nativeElement.textContent).toContain('Sure?');
    confirm.nativeElement.querySelector('button').click();
    expect(ref.close).toHaveBeenCalledWith(false);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideNoopAnimations()] });
    const unsavedRef = jasmine.createSpyObj<MatDialogRef<unknown>>('MatDialogRef', ['close']);
    TestBed.overrideProvider(MatDialogRef, { useValue: unsavedRef });
    TestBed.overrideProvider(MAT_DIALOG_DATA, { useValue: null });
    const unsaved = TestBed.createComponent(UnsavedChangesDialogComponent);
    unsaved.detectChanges();
    expect(unsaved.nativeElement.textContent).toContain('Unsaved changes');
    const buttons = unsaved.nativeElement.querySelectorAll('button');
    buttons[1].click();
    expect(unsavedRef.close).toHaveBeenCalledWith(true);
  });

  it('opens one help menu at a time', () => {
    const service = TestBed.inject(ContextHelpService);
    const first = { menuOpen: true, closeMenu: jasmine.createSpy('closeMenu') } as never;
    const second = { menuOpen: false, closeMenu: jasmine.createSpy('closeMenu') } as never;
    service.registerOpen(first);
    service.registerOpen(second);
    expect((first as { closeMenu: jasmine.Spy }).closeMenu).toHaveBeenCalled();
    service.registerClosed(first);
    service.registerClosed(second);

    const fixture = TestBed.createComponent(ContextHelpComponent);
    fixture.componentRef.setInput('helpKey', 'group.name');
    fixture.componentRef.setInput('label', 'Group name');
    fixture.componentRef.setInput('compact', true);
    fixture.detectChanges();
    expect(fixture.componentInstance.content().title).toBe('Group Name');
    expect(fixture.componentInstance.ariaLabel()).toContain('Group name');
    const event = new Event('pointerdown');
    spyOn(event, 'preventDefault');
    spyOn(event, 'stopPropagation');
    fixture.componentInstance.onTriggerPointerDown(event);
    fixture.componentInstance.onTriggerClick(event);
    expect(event.preventDefault).toHaveBeenCalled();
    const trigger = { menuOpen: false, closeMenu() {} } as never;
    fixture.componentInstance.onMenuOpened(trigger);
    fixture.componentInstance.onMenuClosed(trigger);
  });
});
