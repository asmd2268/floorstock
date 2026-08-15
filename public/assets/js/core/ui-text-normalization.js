const ARABIC_RE = /[\u0600-\u06FF]/;
const LATIN_RE = /[A-Za-z]/;
const LEGACY_ENTITY_RE = /&#(?:x([0-9a-f]+)|([0-9]+));/gi;
const NOTIFICATION_SELECTOR = [
  '#toast',
  '.alert-banner',
  '.alert-banner-y',
  '.alert-banner-g',
  '[role="alert"]',
  '[aria-live]',
  '.crash-response-validation',
  '#r666-draft-notice',
  '[class*="status"]',
  '[id*="status"]',
  '[class*="message"]',
  '[id*="message"]',
  '[class*="notice"]',
  '[id*="notice"]',
  '[class*="warn"]',
  '[id*="warning"]',
  '[class*="validation"]',
  '[id*="validation"]',
].join(',');

function countMatches(value, pattern) {
  return (String(value || '').match(pattern) || []).length;
}

function classifySegment(value) {
  const text = String(value || '');
  const arabic = countMatches(text, /[\u0600-\u06FF]/g);
  const latin = countMatches(text, /[A-Za-z]/g);
  if (arabic && !latin) return 'ar';
  if (latin && !arabic) return 'en';
  if (arabic > latin) return 'ar';
  if (latin > arabic) return 'en';
  return '';
}

export function decodeLegacySymbolEntities(value) {
  return String(value == null ? '' : value).replace(
    LEGACY_ENTITY_RE,
    (match, hex, decimal) => {
      const codePoint = Number.parseInt(hex || decimal, hex ? 16 : 10);
      if (!Number.isFinite(codePoint) || codePoint < 0x2000 || codePoint > 0x10ffff) return match;
      try {
        return String.fromCodePoint(codePoint);
      } catch {
        return match;
      }
    },
  );
}

export function formatBilingualText(value) {
  const decoded = decodeLegacySymbolEntities(value);
  // Bullet-list content (e.g. a multi-item confirmation dialog) already has
  // its own line-by-line structure — the split-and-regroup logic below
  // assumes a single flat "Arabic sentence / English sentence" pair and
  // scrambles anything with multiple "/" or newlines beyond that shape.
  if (decoded.includes('•')) return decoded;
  if (!ARABIC_RE.test(decoded) || !LATIN_RE.test(decoded) || !/(?:\s+\/\s+|\n+)/.test(decoded)) return decoded;

  const parts = decoded.split(/(?:\s+\/\s+|\n+)/).map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return decoded;

  const arabic = [];
  const english = [];
  const neutral = [];
  for (const part of parts) {
    const type = classifySegment(part);
    if (type === 'ar') arabic.push(part);
    else if (type === 'en') english.push(part);
    else neutral.push(part);
  }
  if (!arabic.length || !english.length) return decoded;

  const arabicLine = arabic.join(' / ');
  const englishLine = english.join(' / ');
  const neutralSuffix = neutral.length ? ` / ${neutral.join(' / ')}` : '';
  return `${arabicLine}\n${englishLine}${neutralSuffix}`;
}

function shouldSkipTextNode(node) {
  const parent = node && node.parentElement;
  return !parent || /^(SCRIPT|STYLE|TEXTAREA|CODE|PRE)$/i.test(parent.tagName);
}

function normalizeNotificationElement(notification) {
  if (!notification || !notification.matches || !notification.matches(NOTIFICATION_SELECTOR)) return false;
  notification.style.whiteSpace = 'pre-line';
  notification.style.unicodeBidi = 'plaintext';
  if (notification.querySelector('button,a,input,select,textarea') || notification.childElementCount > 0) return false;
  const decoded = decodeLegacySymbolEntities(notification.textContent || '');
  const parts = decoded.split(/(?:\s+\/\s+|\n+)/).map((part) => part.trim()).filter(Boolean);
  if (parts.length !== 2) return false;
  const formatted = formatBilingualText(decoded);
  if (formatted === decoded) return false;
  notification.textContent = formatted;
  return true;
}

function normalizeTextNode(node) {
  if (!node || node.nodeType !== 3 || shouldSkipTextNode(node)) return;
  const decoded = decodeLegacySymbolEntities(node.nodeValue);
  const notification = node.parentElement && node.parentElement.closest(NOTIFICATION_SELECTOR);
  if (notification && normalizeNotificationElement(notification)) return;
  const next = notification ? formatBilingualText(decoded) : decoded;
  if (next !== node.nodeValue) node.nodeValue = next;
  if (notification) {
    notification.style.whiteSpace = 'pre-line';
    notification.style.unicodeBidi = 'plaintext';
  }
}

function normalizeTree(root) {
  if (!root || typeof document === 'undefined') return;
  if (root.nodeType === 3) {
    normalizeTextNode(root);
    return;
  }
  if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    normalizeTextNode(node);
    node = walker.nextNode();
  }
}

export function installUiTextNormalization() {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return null;
  const start = () => {
    normalizeTree(document.body || document.documentElement);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'characterData') normalizeTextNode(mutation.target);
        for (const node of mutation.addedNodes || []) normalizeTree(node);
      }
    });
    observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true });
    return observer;
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
    return null;
  }
  return start();
}
