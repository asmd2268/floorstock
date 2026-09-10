/* Reading a pasted list of medicines.

   Staff paste straight out of a spreadsheet, so the separator is a tab when the
   paste came from Excel and a comma when it came from a CSV — both are handled
   without asking which. The first line is often the spreadsheet's own header
   row, and importing "Name, MOH, Nupco" as a medicine is the mistake this
   guards against.

   Duplicates are skipped by name, case-insensitively, against BOTH the existing
   catalog and the rows already accepted from this same paste — a list pasted
   twice must not double the catalog, and a list containing the same medicine on
   two lines must not create it twice.

   Nothing is written here: the caller gets what would be imported and what was
   skipped, with a reason for each skip, so a person can see why a row did not
   arrive instead of finding it missing later. */

const HEADER_WORDS = ['name', 'medicine name', 'اسم الدواء'];

export function parseMedicineImport(raw, { existing = [], classification = 'none', newId, now = new Date().toISOString(), actor = '' } = {}) {
  const lines = String(raw || '').split('\n').map((line) => line.trim()).filter(Boolean);
  const imported = [];
  const skipped = [];
  const seen = new Set((Array.isArray(existing) ? existing : [])
    .map((med) => String((med && med.name) || '').trim().toLowerCase())
    .filter(Boolean));
  let index = 0;

  lines.forEach((line, position) => {
    const columns = line.indexOf('\t') >= 0 ? line.split('\t') : line.split(',');
    const name = String(columns[0] || '').trim();
    if (!name || (position === 0 && HEADER_WORDS.includes(name.toLowerCase()))) {
      skipped.push(`Row ${position + 1}: header/empty`);
      return;
    }
    if (seen.has(name.toLowerCase())) {
      skipped.push(`${name} (duplicate)`);
      return;
    }
    seen.add(name.toLowerCase());
    imported.push({
      id: typeof newId === 'function' ? newId() : `med_import_${index += 1}`,
      name,
      mohCode: String(columns[1] || '').trim(),
      nupcoCode: String(columns[2] || '').trim(),
      classification,
      expiry: '',
      outOfStock: false,
      qrAlert: false,
      locations: [],
      updatedAt: now,
      updatedBy: actor,
    });
  });

  return { imported, skipped };
}
