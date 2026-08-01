import {
  decodeLegacySymbolEntities,
  formatBilingualText,
  installUiTextNormalization,
} from '../core/ui-text-normalization.js';

globalThis.decodeLegacySymbolEntities = decodeLegacySymbolEntities;
globalThis.formatBilingualText = formatBilingualText;
installUiTextNormalization();
