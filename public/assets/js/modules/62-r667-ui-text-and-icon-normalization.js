import {
  decodeLegacySymbolEntities,
  formatBilingualText,
  installUiTextNormalization,
} from '../core/ui-text-normalization.js?v=b7d82c5457';

globalThis.decodeLegacySymbolEntities = decodeLegacySymbolEntities;
globalThis.formatBilingualText = formatBilingualText;
installUiTextNormalization();

export {};
