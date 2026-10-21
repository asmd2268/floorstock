/* Where each controlled medicine sits in the storage cells.

   A medicine may be placed in more than one cell (a few packs on one shelf, the
   rest in the safe). Each cell then carries a "duplicate" mark that names the
   OTHER cells holding the same medicine, so a count is never made on one shelf
   while the same medicine sits unseen on another. */

export function storageLocations(data) {
  const map = {};
  ((data && data.units) || []).forEach((unit) => {
    (unit.rows || []).forEach((row) => {
      (row.cells || []).forEach((cell) => {
        if (!cell || !cell.medId) return;
        const id = String(cell.medId);
        (map[id] = map[id] || []).push({ unitId: String(unit.id), unitName: unit.name, code: cell.code });
      });
    });
  });
  return map;
}

/* The other cells that hold the same medicine as the cell (unitId, code). A cell
   in the same unit is named by its code; a cell in another unit by "unit code". */
export function otherCells(locations, medId, unitId, code) {
  return ((locations && locations[String(medId)]) || [])
    .filter((place) => !(place.unitId === String(unitId) && place.code === code))
    .map((place) => (place.unitId === String(unitId) ? place.code : `${place.unitName} ${place.code}`));
}

/* Cells whose medicine is no longer in custody: a medId that matches nothing. */
export function staleCells(data, knownIds) {
  const known = new Set(Array.from(knownIds, String));
  const stale = [];
  ((data && data.units) || []).forEach((unit) => {
    (unit.rows || []).forEach((row, rowIndex) => {
      (row.cells || []).forEach((cell, cellIndex) => {
        if (cell && cell.medId && !known.has(String(cell.medId))) stale.push({ unitId: String(unit.id), rowIndex, cellIndex, code: cell.code });
      });
    });
  });
  return stale;
}

export function duplicateMark(others, esc, className) {
  return others.length
    ? `<div class="${className}">⧉ Duplicate · also in / مكرر أيضًا في: <b>${others.map(esc).join('، ')}</b></div>`
    : '';
}

/* Empties the stale cells of one unit and says how many there were. */
export function clearStaleCells(data, unitId, knownIds) {
  const stale = staleCells(data, knownIds).filter((cell) => cell.unitId === String(unitId));
  const unit = ((data && data.units) || []).find((item) => String(item.id) === String(unitId));
  stale.forEach((cell) => { unit.rows[cell.rowIndex].cells[cell.cellIndex].medId = ''; });
  return stale.length;
}
