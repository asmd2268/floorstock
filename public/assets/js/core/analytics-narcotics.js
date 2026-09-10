/* Controlled-medicine dispensing over one year: how much left the cupboard, to
   whom, when, and which medicines account for it.

   Only `dispense` movements count. The ledger also carries receipts, transfers
   and corrections, and counting those would make a year of careful stock-keeping
   look like a year of heavy consumption.

   Inpatient and outpatient are not two independent tallies: anything not marked
   as going to a ward is treated as leaving the pharmacy to a patient. That is
   deliberate — an untagged movement is still stock that left, and a report that
   quietly dropped it would understate the year's total.

   Lifted out of modules/73 with its inputs as arguments. The month and quarter
   breakdowns are built in one pass now instead of re-filtering the whole ledger
   sixteen times; the numbers are the same. */

const DISPENSE = 'dispense';
const TO_A_WARD = ['inpatient', 'internal'];

function unitsOf(move) { return Number(move && move.qty) || 0; }

export function narcoticStats(moves, catalog, year) {
  const dispensed = (Array.isArray(moves) ? moves : []).filter((move) => {
    if (!move || move.type !== DISPENSE) return false;
    return new Date(move.at || 0).getFullYear() === year;
  });
  const list = Array.isArray(catalog) ? catalog : [];

  const monthly = Array.from({ length: 12 }, (unused, month) => ({ month, units: 0, events: 0 }));
  const quarterly = [1, 2, 3, 4].map((q) => ({ q, units: 0, events: 0 }));
  const medTotals = {};
  const uniqueMeds = new Set();
  let totalUnits = 0;
  let inpatientUnits = 0;

  dispensed.forEach((move) => {
    const units = unitsOf(move);
    const month = new Date(move.at || 0).getMonth();
    totalUnits += units;
    if (TO_A_WARD.includes(move.dispenseType)) inpatientUnits += units;

    monthly[month].units += units;
    monthly[month].events++;
    const quarter = quarterly[Math.floor(month / 3)];
    quarter.units += units;
    quarter.events++;

    if (!move.medId) return;
    uniqueMeds.add(move.medId);
    const medicine = list.find((entry) => String(entry.id) === String(move.medId));
    /* A medicine the catalog no longer lists still has to appear — its id is
       the only name left for stock that really did leave the cupboard. */
    const name = (medicine && medicine.name) || move.medId;
    const cls = (medicine && medicine.classification) || 'narcotic';
    if (!medTotals[name]) medTotals[name] = { units: 0, events: 0, cls };
    medTotals[name].units += units;
    medTotals[name].events++;
  });

  const topMeds = Object.entries(medTotals)
    .map(([name, totals]) => ({ name, ...totals }))
    .sort((a, b) => b.units - a.units)
    .slice(0, 10);

  return {
    moves: dispensed.length,
    uniqueMeds: uniqueMeds.size,
    totalUnits,
    inpatientUnits,
    outpatientUnits: totalUnits - inpatientUnits,
    monthly,
    quarterly,
    topMeds,
    catalog: list,
  };
}
