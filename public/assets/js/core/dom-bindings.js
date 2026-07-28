import bindings from './event-bindings.js';
import { invokeLegacy } from './legacy-registry.js';

function parseArgument(token, element, event) {
  const value = token.trim();
  if (!value) return undefined;
  if (value === 'this') return element;
  if (value === 'this.checked') return element.checked;
  if (value === 'this.value') return element.value;
  if (value === 'this.files[0]') return element.files && element.files[0];
  if (value === 'event') return event;
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  if (/^-?\d+(?:\.\d+)?$/.test(value)) return Number(value);
  if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
    return value.slice(1, -1).replace(/\\(['"\\])/g, '$1');
  }
  throw new Error(`Unsupported event argument: ${value}`);
}

function splitArguments(source) {
  const output = [];
  let quote = '';
  let start = 0;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (character === '\\') index += 1;
      else if (character === quote) quote = '';
    } else if (character === "'" || character === '"') quote = character;
    else if (character === ',') {
      output.push(source.slice(start, index));
      start = index + 1;
    }
  }
  if (source.slice(start).trim()) output.push(source.slice(start));
  return output;
}

function runCall(source, element, event) {
  const match = source.trim().match(/^([A-Za-z_$][\w$]*)\((.*)\)$/s);
  if (!match) throw new Error(`Unsupported application action: ${source}`);
  const args = splitArguments(match[2]).map((token) => parseArgument(token, element, event));
  return invokeLegacy(match[1], element, args);
}

function execute(source, element, event) {
  if (source === "document.querySelectorAll('.pchk').forEach(function(c){c.checked=true;})") {
    document.querySelectorAll('.pchk').forEach((checkbox) => { checkbox.checked = true; });
    return;
  }
  if (source === "document.querySelectorAll('.pchk').forEach(function(c){c.checked=this.checked;}.bind(this))") {
    document.querySelectorAll('.pchk').forEach((checkbox) => { checkbox.checked = element.checked; });
    return;
  }
  if (source === "document.getElementById('xlsx-file-inp').click()") {
    document.getElementById('xlsx-file-inp')?.click();
    return;
  }
  if (source === "el('logo-file-inp').click()") {
    document.getElementById('logo-file-inp')?.click();
    return;
  }
  if (source === "this.style.borderColor='var(--bd)'") {
    element.style.borderColor = 'var(--bd)';
    return;
  }
  if (source === "event.preventDefault();this.style.borderColor='var(--ac)'") {
    event.preventDefault();
    element.style.borderColor = 'var(--ac)';
    return;
  }
  const enter = source.match(/^if\(event\.key==='Enter'\)([A-Za-z_$][\w$]*\(\))$/);
  if (enter) {
    if (event.key === 'Enter') runCall(enter[1], element, event);
    return;
  }
  source.split(';').map((part) => part.trim()).filter(Boolean).forEach((call) => runCall(call, element, event));
}

export function installDomBindings(root = document) {
  bindings.forEach((binding) => {
    const element = root.querySelector(`[data-asdh-binding~="${binding.id}"]`);
    if (!element) throw new Error(`Missing bound element: ${binding.id}`);
    element.addEventListener(binding.event, (event) => execute(binding.source, element, event));
  });
  return bindings.length;
}

export const staticBindingCount = bindings.length;
