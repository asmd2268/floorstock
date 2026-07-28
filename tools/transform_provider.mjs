import fs from 'node:fs';
import { parse } from 'acorn';

const filename = process.argv[2];
if (!filename) throw new Error('Pass a JavaScript source path.');
const source = fs.readFileSync(filename, 'utf8');
const program = parse(source, { ecmaVersion: 'latest', sourceType: 'script', allowHashBang: true });
const functions = [];
const variables = [];
const replacements = [];

for (const node of program.body) {
  if (node.type === 'ExpressionStatement'
      && node.expression.type === 'AssignmentExpression'
      && node.expression.left.type === 'MemberExpression'
      && !node.expression.left.computed
      && node.expression.left.object.type === 'Identifier'
      && node.expression.left.object.name === 'globalThis'
      && node.expression.left.property.type === 'Identifier') {
    variables.push(node.expression.left.property.name);
    continue;
  }
  if (node.type === 'FunctionDeclaration' || node.type === 'ClassDeclaration') {
    if (node.id?.name) functions.push(node.id.name);
    continue;
  }
  if (node.type !== 'VariableDeclaration') continue;
  const statements = [];
  for (const declaration of node.declarations) {
    if (declaration.id.type !== 'Identifier') throw new Error('Provider destructuring declarations are not supported.');
    const name = declaration.id.name;
    variables.push(name);
    if (declaration.init) {
      statements.push(`globalThis.${name} = ${source.slice(declaration.init.start, declaration.init.end)};`);
    } else {
      statements.push(`if (!Object.prototype.hasOwnProperty.call(globalThis, '${name}')) globalThis.${name} = undefined;`);
    }
  }
  replacements.push({ start: node.start, end: node.end, text: statements.join('\n') });
}

let transformed = source;
for (const replacement of replacements.sort((a, b) => b.start - a.start)) {
  transformed = transformed.slice(0, replacement.start) + replacement.text + transformed.slice(replacement.end);
}

process.stdout.write(JSON.stringify({
  source: transformed,
  functions: [...new Set(functions)],
  variables: [...new Set(variables)],
}));
