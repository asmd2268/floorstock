export function stateValueEqual(a, b) {
  if (a === b) return true;
  try { return JSON.stringify(a) === JSON.stringify(b); } catch { return false; }
}

export function fsStateRestEncode(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return { nullValue: null };
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(fsStateRestEncode) } };
  if (typeof value === 'object') {
    const fields = {};
    Object.keys(value).forEach((key) => { if (value[key] !== undefined) fields[key] = fsStateRestEncode(value[key]); });
    return { mapValue: { fields } };
  }
  return { stringValue: String(value) };
}

Object.assign(globalThis, { stateValueEqual, fsStateRestEncode });
