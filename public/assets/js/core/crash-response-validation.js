/* Whether one line of a pharmacy's answer to a crash-cart report can be saved.

   A department reports what it used from a sealed cart; the pharmacy answers
   each line with what it is putting back and from which batch. Every refusal
   below exists because the alternative leaves a cart whose recorded contents do
   not match what is in it:

   A quantity must come off a real batch. When the cart has dated batches, the
   pharmacist has to say which one — and that batch has to hold enough. Deducting
   from "somewhere" is how a cart's expiry record stops matching its contents.

   An item with NO dated batches is the exception, and it has to be: those items
   exist from before batches were recorded at all, and demanding a batch that
   cannot be named left the pharmacist unable to answer the report — the same
   dead end the batch picker was added to remove. The quantity comes off the
   item's own count, which the result checks below still bound.

   Replacements need an expiry, are never negative, and can never take the item
   past its approved standard — the cart's standard is the count the next
   inspection is checked against.

   A report whose consumption was already deducted at reporting time removes
   nothing more. Otherwise the same units come off twice and the cart reads
   short.

   Lifted out of a DOM handler in modules/80. It returns the resulting quantity
   alongside the message, so the screen can show a pharmacist the number their
   line will produce before they commit to it. */

function num(value) { const n = Number(value); return Number.isFinite(n) ? n : 0; }

const EPSILON = 1e-6;

export function crashResponseRowIssue(plan, {
  present = 0,
  standard = 0,
  alreadyDeducted = false,
  datedBatchCount = 0,
  quantityAtExpiry = 0,
} = {}) {
  const reported = num(plan && plan.reportedQty);
  const replacing = num(plan && plan.qty);
  const removing = alreadyDeducted ? 0 : num(plan && plan.removeQty);
  const result = num(present) - removing + replacing;
  const unavailable = !!(plan && plan.unavailable);

  let error = '';
  if (!unavailable && !alreadyDeducted && !(plan && plan.sourceExpiry) && reported > 0 && datedBatchCount > 0) {
    error = 'Choose the batch this quantity is deducted from. / اختر الدفعة التي تُخصم منها الكمية.';
  } else if (!unavailable && !alreadyDeducted && datedBatchCount > 0 && reported > 0 && quantityAtExpiry < reported) {
    error = 'The reported expiry no longer has enough quantity to deduct.';
  } else if (!unavailable && !alreadyDeducted && datedBatchCount > 0 && reported === 0 && removing > 0 && quantityAtExpiry < removing) {
    error = 'Selected batch does not have enough quantity. / الدفعة المحددة لا تحتوي على كمية كافية.';
  } else if (replacing < 0) {
    error = 'Replacement quantity cannot be negative.';
  } else if (!unavailable && replacing > 0 && !(plan && plan.expiry)) {
    error = 'Every replacement quantity requires an expiry date.';
  } else if (result < 0) {
    error = 'Resulting quantity cannot be negative.';
  } else if (result > num(standard) + EPSILON) {
    error = 'Result ' + result + ' exceeds standard ' + num(standard) + '.';
  }

  return { error, result, removing, replacing };
}

/* The quantity a cart item is holding now. An item marked out of stock with no
   count recorded holds none — not "as many as the standard says". */
export function itemPresent(item) {
  if (item && item.stockStatus === 'out_of_stock' && item.present == null) return 0;
  return num(item && item.present != null ? item.present : item && item.qty);
}

export function itemStandard(item) { return num(item && item.qty); }

export function dateKey(value) { return String(value || '').slice(0, 10); }

/* Only batches that carry both a date and a quantity can be deducted from. */
export function datedBatches(item) {
  return ((item && item.batches) || []).filter((batch) => dateKey(batch.expiry) && num(batch.qty) > 0);
}

export function quantityAtExpiry(item, date) {
  return datedBatches(item)
    .filter((batch) => dateKey(batch.expiry) === dateKey(date))
    .reduce((sum, batch) => sum + num(batch.qty), 0);
}
