import Database from 'better-sqlite3';

const db = new Database('./cardcraft.db');
const t = db.prepare('SELECT id, title, canvas_json FROM templates LIMIT 1').get();
console.log('Template found:');
console.log('- ID:', t?.id);
console.log('- Title:', t?.title);
console.log('- canvas_json type:', typeof t?.canvas_json);
console.log('- canvas_json value:', t?.canvas_json);
db.close();
