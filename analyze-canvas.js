#!/usr/bin/env node
import Database from 'better-sqlite3';
import fs from 'fs';

const db = new Database('./cardcraft.db');
const template = db.prepare('SELECT * FROM templates WHERE id = 1').get();
const canvas = JSON.parse(template.canvas_json);

console.log('=== CANVAS_JSON STRUCTURE ===');
console.log('Root properties:', Object.keys(canvas));
console.log('Background color:', canvas.background);
console.log('Total objects:', canvas.objects.length);
console.log('');

console.log('Object types breakdown:');
const types = {};
canvas.objects.forEach(obj => {
  const key = obj.type || 'unknown';
  if (!types[key]) types[key] = [];
  types[key].push(obj.customType || 'default');
});

Object.entries(types).forEach(([type, subtypes]) => {
  const customTypes = [...new Set(subtypes)];
  console.log(`  ${type} (${subtypes.length} total):`);
  customTypes.forEach(ct => {
    const count = subtypes.filter(s => s === ct).length;
    console.log(`    - customType="${ct}": ${count}`);
  });
});

console.log('');
console.log('Sample objects with properties:');
canvas.objects.slice(0, 5).forEach((obj, i) => {
  console.log(`Object ${i}:`);
  console.log(`  type: ${obj.type}`);
  console.log(`  customType: ${obj.customType || 'N/A'}`);
  if (obj.text) console.log(`  text: "${obj.text.substring(0, 30)}${obj.text.length > 30 ? '...' : ''}"`);
  if (obj.fill) console.log(`  fill: ${obj.fill}`);
  if (obj.fontSize) console.log(`  fontSize: ${obj.fontSize}`);
  if (obj.fontFamily) console.log(`  fontFamily: ${obj.fontFamily}`);
  console.log('');
});

// Also save full first 2 objects as JSON for reference
const fullObjects = {
  first_object: canvas.objects[0],
  text_object_sample: canvas.objects.find(o => o.type === 'text')
};

fs.writeFileSync('./template-objects-sample.json', JSON.stringify(fullObjects, null, 2));
console.log('✓ Full object samples saved to template-objects-sample.json');
