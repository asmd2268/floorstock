/* Crash cart openings, over a range of years.

   What the report is really asking: which carts are opened most, how long a cart
   typically stays sealed between openings, what gets replaced when one is opened,
   and why they are being opened at all.

   A seal correction is not an opening. The Master fixing a mistyped seal number
   writes a record that looks like every other crash-cart record, and counting it
   would inflate a cart's opening count and shorten its sealed interval — the two
   figures a supervisor reads to decide whether a cart is being disturbed too
   often. It carries no replacements, so excluding it changes no other number.

   Lifted out of modules/73 unchanged in arithmetic, with its inputs as
   arguments so the rules above can be tested. */

import { round1, mean, deptLabel } from './analytics-engine.js?v=ea7b98eca6';

const OPENING = 'open';

export function isSealCorrection(report) {
  return String((report && report.operation) || OPENING) === 'seal_correction';
}

function replacementName(replacement) {
  return String(replacement.name || replacement.medName || replacement.genericName || replacement.medId || '—');
}

export function crashCartStats(reports, carts, fromYear, toYear, nameOf = deptLabel) {
  const inRange = (Array.isArray(reports) ? reports : []).filter((report) => {
    const year = new Date(report.openedAt || report.created || 0).getFullYear();
    return year >= fromYear && year <= toYear;
  });
  const openings = inRange.filter((report) => !isSealCorrection(report));
  const cartList = Array.isArray(carts) ? carts : [];

  const cartOpenings = {};
  const cartReplacements = {};
  openings.forEach((report) => {
    const cartId = String(report.cartId || '—');
    cartOpenings[cartId] = (cartOpenings[cartId] || 0) + 1;
    (cartReplacements[cartId] = cartReplacements[cartId] || []).push(
      Array.isArray(report.replacements) ? report.replacements.length : 0,
    );
  });

  /* Average days between one opening and the next. A cart opened once has no
     interval — reported as unknown rather than as zero, which would read as a
     cart being opened constantly. */
  const cartIntervalDays = {};
  cartList.forEach((cart) => {
    const cartId = String(cart.id);
    const times = openings
      .filter((report) => String(report.cartId) === cartId)
      .map((report) => new Date(report.openedAt || report.created || 0).getTime())
      .filter((time) => time > 0)
      .sort((a, b) => a - b);
    if (times.length < 2) { cartIntervalDays[cartId] = null; return; }
    const gaps = [];
    for (let i = 1; i < times.length; i++) gaps.push((times[i] - times[i - 1]) / 86400000);
    cartIntervalDays[cartId] = round1(mean(gaps));
  });

  const totalOpenings = openings.length;
  const totalReplacements = openings.reduce(
    (sum, report) => sum + (Array.isArray(report.replacements) ? report.replacements.length : 0), 0,
  );

  const cartsSorted = cartList
    .map((cart) => ({
      id: String(cart.id),
      name: cart.name || cart.id,
      dept: nameOf(cart.deptId),
      openings: cartOpenings[String(cart.id)] || 0,
      avgRepl: cartReplacements[String(cart.id)] ? round1(mean(cartReplacements[String(cart.id)])) : 0,
      intervalDays: cartIntervalDays[String(cart.id)],
    }))
    .filter((cart) => cart.openings > 0)
    .sort((a, b) => b.openings - a.openings);

  const medCounts = {};
  const deptMedCounts = {};
  openings.forEach((report) => {
    const dept = nameOf(report.deptId);
    (report.replacements || []).forEach((replacement) => {
      const name = replacementName(replacement);
      medCounts[name] = (medCounts[name] || 0) + 1;
      if (!deptMedCounts[name]) deptMedCounts[name] = {};
      deptMedCounts[name][dept] = (deptMedCounts[name][dept] || 0) + 1;
    });
  });
  const topMeds = Object.entries(medCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  /* Why the cart was opened. A routine check that consumed nothing is its own
     reason rather than a blank, because "no reason recorded" and "opened,
     nothing used" are different facts about a department. */
  const reasonCounts = {};
  openings.forEach((report) => {
    let reason = report.noConsumption
      ? 'No medications consumed / فحص روتيني بدون استهلاك'
      : String(report.reason || '—').trim();
    if (reason.length > 90) reason = reason.slice(0, 90) + '…';
    reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
  });
  const reasonBreakdown = Object.entries(reasonCounts)
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);

  return {
    totalOpenings,
    totalReplacements,
    avgReplacementsPerOpening: totalOpenings ? round1(totalReplacements / totalOpenings) : 0,
    top5: cartsSorted.slice(0, 5),
    bottom2: cartsSorted.slice(-2).reverse(),
    topMeds,
    deptMedCounts,
    cartsSorted,
    reasonBreakdown,
  };
}
