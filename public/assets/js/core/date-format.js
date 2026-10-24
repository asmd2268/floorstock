/* DD/MM/YYYY and DD/MM/YYYY, HH:MM in the Gregorian calendar.

   `date.toLocaleDateString('en-GB', {...})` builds a new formatter on every call,
   which costs around a tenth of a millisecond; the crash cart page formats a date
   for every batch it draws, so a few hundred rows made the page visibly slow. One
   formatter per shape, made on first use, gives the same text. It is made lazily
   because the Latin-digits patch wraps Intl.DateTimeFormat after this module loads. */
let dateOnly = null;
let dateTime = null;

export function formatDateGB(date) {
  if (!dateOnly) dateOnly = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return dateOnly.format(date);
}

export function formatDateTimeGB(date) {
  if (!dateTime) dateTime = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  return dateTime.format(date);
}
