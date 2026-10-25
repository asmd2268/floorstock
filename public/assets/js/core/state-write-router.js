/* Decides how one state key is written, and what a failed write tells the person.

   A key is written in one of four ways, chosen in this order:
     1. by month, when its rows live in month partitions (only changed months);
     2. across numbered parts, when the value would not fit in one document (or
        already has parts), so no key has a size ceiling;
     3. as a diff against the stored document, for lists several people edit at
        once, so two people changing two rows stop overwriting each other;
     4. otherwise as one whole-value write.
   Every collaborator is passed in, so the order and the failure handling can be
   tested without Firebase. Failures are rethrown after the person is told. */

export function createStateWriter({
  partitionsAreLive,
  applyPartitionedArray,
  hasOverflowParts,
  estimateDocBytes,
  overflowSplitBytes,
  writeWithOverflow,
  putChunkInCache,
  setDocument,
  isRowMergedKey,
  saveRowsMerging,
  plainSet,
  trackSave,
  notifyFailure,
}) {
  function failing(promise, label, key) {
    return promise.catch((error) => {
      console.error(label + ' failed for key:', key, error);
      notifyFailure('Save failed — ' + String((error && error.message) || error));
      throw error;
    });
  }

  return function write(key, value) {
    if (partitionsAreLive(key)) {
      return trackSave(failing(applyPartitionedArray(key, value), 'Partitioned save', key), 'floorstock_state/' + key + ' (by month)');
    }
    if (value !== null && typeof value === 'object' && (hasOverflowParts(key) || estimateDocBytes(value) > overflowSplitBytes)) {
      const spread = writeWithOverflow(key, value, (docId, chunk) => {
        putChunkInCache(docId, chunk);
        return setDocument(docId, chunk);
      });
      return trackSave(failing(spread, 'Overflow save', key), 'floorstock_state/' + key + ' (split)');
    }
    if (Array.isArray(value) && isRowMergedKey(key)) {
      const merged = saveRowsMerging(key, value, { fallback: () => plainSet(key, value) });
      return trackSave(failing(merged, 'Merged save', key), 'floorstock_state/' + key + ' (merged)');
    }
    return plainSet(key, value);
  };
}
