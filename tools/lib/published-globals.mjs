/* The names a source file puts on the global object.

   There are three ways this project publishes one, and every tool that counts
   or checks globals has to know all three or it measures a subset: a direct
   `window.x =`, an `Object.assign(globalThis, { … })`, and `publishLegacy(name,
   api)`, which assigns every key of the api object. Counting only the first form
   is what once made the architecture budget report 696 globals where there were
   818; missing the third would understate it by far more.

   One implementation, used by both the budget and the unresolved-name check. */

export function walkAst(node, visit) {
  if (!node || typeof node.type !== 'string') return;
  visit(node);
  for (const key of Object.keys(node)) {
    if (key === 'type' || key === 'start' || key === 'end' || key === 'loc' || key === 'range') continue;
    const value = node[key];
    if (Array.isArray(value)) {
      for (const child of value) if (child && typeof child.type === 'string') walkAst(child, visit);
    } else if (value && typeof value.type === 'string') walkAst(value, visit);
  }
}

export function collectPublishedGlobals(program, into = new Set()) {
  const objectLiterals = new Map();
  walkAst(program, (node) => {
    if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier' && node.init?.type === 'ObjectExpression') {
      objectLiterals.set(node.id.name, node.init);
    }
  });
  const addKeys = (objectExpression) => {
    if (objectExpression?.type !== 'ObjectExpression') return;
    for (const property of objectExpression.properties) {
      if (property.type === 'SpreadElement') continue;
      if (!property.computed && property.key.type === 'Identifier') into.add(property.key.name);
      else if (property.key.type === 'Literal') into.add(String(property.key.value));
    }
  };
  walkAst(program, (node) => {
    if (node.type === 'AssignmentExpression' && node.left.type === 'MemberExpression' && !node.left.computed
      && node.left.object.type === 'Identifier'
      && (node.left.object.name === 'window' || node.left.object.name === 'globalThis')
      && node.left.property.type === 'Identifier') into.add(node.left.property.name);

    if (node.type !== 'CallExpression') return;
    const callee = node.callee;
    if (callee.type === 'MemberExpression' && callee.object.type === 'Identifier' && callee.object.name === 'Object'
      && callee.property.name === 'assign' && node.arguments[0]?.type === 'Identifier'
      && (node.arguments[0].name === 'window' || node.arguments[0].name === 'globalThis')) {
      for (const argument of node.arguments.slice(1)) addKeys(argument);
    }
    if (callee.type === 'Identifier' && callee.name === 'publishLegacy') {
      const api = node.arguments[1];
      addKeys(api?.type === 'Identifier' ? objectLiterals.get(api.name) : api);
    }
  });
  return into;
}
