// Shared Department Notes vocabulary. Keeping this schema outside the feature
// renderer prevents labels and status validation from being duplicated across
// department, pharmacy, and notification views.
globalThis.NOTE_TYPE_LABELS = Object.freeze({
  classification: '🏷 Classification',
  request: '➕ Add Medication',
  missing: '⚠ Missing Info',
  other: '💬 Other'
});
globalThis.NOTE_STATUS_LABELS = Object.freeze({
  open: 'open',
  urgent: 'urgent',
  resolved: 'resolved'
});

export const departmentNoteSchema = Object.freeze({
  types: globalThis.NOTE_TYPE_LABELS,
  statuses: globalThis.NOTE_STATUS_LABELS
});
