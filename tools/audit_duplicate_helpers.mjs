import { readFile } from 'node:fs/promises';
import { readdir } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('public/assets/js');
const files = [];
async function walk(dir){
  for(const entry of await readdir(dir,{withFileTypes:true})){
    const p=path.join(dir,entry.name);
    if(entry.isDirectory()) await walk(p);
    else if(p.endsWith('.js')) files.push(p);
  }
}
await walk(root);
const duplicates=[];
for(const file of files){
  const text=await readFile(file,'utf8');
  if(file.endsWith('/core/dom-utils.js')) continue;
  for(const pattern of [/\bfunction\s+E\s*\(/g,/\bfunction\s+esc\s*\(/g]){
    const count=[...text.matchAll(pattern)].length;
    if(count) duplicates.push({file:path.relative(process.cwd(),file),count,kind:pattern.source.includes('E')?'E':'esc'});
  }
}
console.log(`Duplicate helper audit: ${duplicates.length} files still define local E/esc helpers.`);
for(const row of duplicates) console.log(`- ${row.kind}: ${row.file} (${row.count})`);
console.log('Canonical replacements: public/assets/js/core/dom-utils.js (fsE, fsEsc).');
if(process.argv.includes('--strict') && duplicates.length) process.exitCode=1;
