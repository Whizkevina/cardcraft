#!/usr/bin/env node
/**
 * CardCraft Templates Diagnostic Report
 * Checks database, API, and full ent-to-end flow
 */

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const stats = fs.statSync(dbPath);
  console.log(`   ✓ File exists: ${dbPath}`);
  console.log(`   ✓ Size: ${(stats.size / 1024).toFixed(1)} KB`);
  console.log(`   ✓ Modified: ${stats.mtime.toLocaleString()}\n`);

  // 2. Connect to database
  console.log("🔌 DATABASE CONNECTION");
  const db = new Database(dbPath);
  console.log(`   ✓ Connected to SQLite\n`);

  // 3. Check templates table
  console.log("📋 TEMPLATES TABLE");
  const tableInfo = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='templates'`).get();
  if (!tableInfo) {
    console.log(`   ✗ Templates table not found!\n`);
    process.exit(1);
  }
  console.log(`   ✓ Table exists\n`);

  // 4. Get template statistics
  console.log("📊 TEMPLATE STATISTICS");
  const stats_result = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as published,
      SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft,
      COUNT(DISTINCT category) as categories
    FROM templates
  `).get();

  console.log(`   Total templates: ${stats_result.total}`);
  console.log(`   Published: ${stats_result.published} ✓`);
  console.log(`   Draft: ${stats_result.draft}`);
  console.log(`   Unique categories: ${stats_result.categories}\n`);

  // 5. List templates by status
  console.log("🏷️  TEMPLATES BY STATUS");
  const byStatus = db.prepare(`
    SELECT status, COUNT(*) as count FROM templates GROUP BY status
  `).all();
  byStatus.forEach(row => {
    console.log(`   ${row.status}: ${row.count}`);
  });
  console.log();

  // 6. List first 5 templates
  console.log("📦 SAMPLE TEMPLATES (First 5)");
  const samples = db.prepare(`
    SELECT id, title, category, status, thumbnailColor FROM templates LIMIT 5
  `).all();
  samples.forEach((t, i) => {
    console.log(`   ${i + 1}. [${t.status}] ${t.title} (${t.category}) - ${t.thumbnailColor}`);
  });
  console.log();

  // 7. Check canvas_json validity
  console.log("✓ CANVAS DATA VALIDATION");
  const invalidCanvas = db.prepare(`
    SELECT COUNT(*) as count FROM templates WHERE canvas_json IS NULL OR canvas_json = ''
  `).get();
  console.log(`   Valid canvas JSON: ${stats_result.total - invalidCanvas.count}/${stats_result.total} ✓\n`);

  //8. Check for common issues
  console.log("🔧 COMMON ISSUES CHECK");
  const issues = [];
  
  if (stats_result.published === 0) {
    issues.push("⚠️  No published templates found - users won't see any!");
  }
  if (stats_result.total === 0) {
    issues.push("⚠️  No templates in database - need to seed data");
  }
  if (invalidCanvas.count > 0) {
    issues.push(`⚠️  ${invalidCanvas.count} templates have missing canvas JSON`);
  }

  if (issues.length === 0) {
    console.log("   ✓ No issues detected!\n");
  } else {
    issues.forEach(issue => console.log(`   ${issue}`));
    console.log();
  }

  // 9. Final recommendation
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  if (stats_result.published > 0 && stats_result.total > 0 && invalidCanvas.count === 0) {
    console.log("✅ DATABASE STATUS: HEALTHY");
    console.log(`   Found ${stats_result.published} published templates ready for display`);
    console.log("   If Gallery page still shows 'No templates', the issue is on the CLIENT side:");
    console.log("   - Check React Query configuration");
    console.log("   - Verify API endpoint  returns correct HTTP status");
    console.log("   - Check browser console for JavaScript errors");
  } else {
    console.log("❌ DATABASE STATUS: NEEDS ATTENTION");
    console.log("   Run: npm run dev");
    console.log("   Then navigate to /admin and click 'Create Admin Account'");
  }
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  db.close();
} catch (err) {
  console.error("❌ Error:", err.message);
  process.exit(1);
}
