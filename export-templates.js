#!/usr/bin/env node
import Database from 'better-sqlite3';
import fs from 'fs';

const db = new Database('./cardcraft.db');

// Get all templates
const allTemplates = db.prepare('SELECT * FROM templates ORDER BY id').all();

// Export summary
console.log('=== TEMPLATE EXPORT SUMMARY ===');
console.log(`Total templates: ${allTemplates.length}`);
console.log('');

// Export full template (ID 1) as JSON
const template1 = allTemplates[0];
fs.writeFileSync('./template-export-1.json', JSON.stringify(template1, null, 2));
console.log('✓ Full template (ID 1) exported to template-export-1.json');
console.log('');

// Export all without canvas_json for easier viewing
const templatesMinimal = allTemplates.map(t => ({
  id: t.id,
  title: t.title,
  category: t.category,
  status: t.status,
  thumbnail_color: t.thumbnail_color,
  is_pro: t.is_pro,
  usage_count: t.usage_count,
  created_at: t.created_at,
  canvas_json_size: t.canvas_json ? t.canvas_json.length : 0
}));

fs.writeFileSync('./all-templates-metadata.json', JSON.stringify(templatesMinimal, null, 2));
console.log('✓ All templates metadata exported to all-templates-metadata.json');
console.log('');

// Show templates by category
console.log('=== TEMPLATES BY CATEGORY ===');
const categories = {};
allTemplates.forEach(t => {
  if (!categories[t.category]) categories[t.category] = [];
  categories[t.category].push(t.title);
});

Object.keys(categories).sort().forEach(cat => {
  console.log(`${cat}: ${categories[cat].length} template(s)`);
  categories[cat].forEach(title => console.log(`  - ${title}`));
});
