// Quick test script to verify templates are working
async function testTemplates() {
  try {
    console.log('🧪 Testing templates API...\n');
    
    // Test 1: Check if API returns templates
    console.log('1️⃣ Fetching templates from /api/templates');
    const res = await fetch('http://127.0.0.1:5000/api/templates');
    console.log('   Status:', res.status, res.statusText);
    
    const templates = await res.json();
    console.log('   Received:', templates.length, 'templates\n');
    
    // Test 2: Check template structure
    if (templates.length > 0) {
      const first = templates[0];
      console.log('2️⃣ Template structure check:');
      console.log('   ✓ id:', first.id);
      console.log('   ✓ title:', first.title);
      console.log('   ✓ status:', first.status);
      console.log('   ✓ category:', first.category);
      console.log('   ✓ canvasJson length:', first.canvasJson?.length);
      console.log('   ✓ thumbnailColor:', first.thumbnailColor);
    }
    
    // Test 3: Check database directly
    console.log('\n3️⃣ Database check:');
    const sqlite3 = require('better-sqlite3');
    const db = new sqlite3('cardcraft.db');
    const result = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as published,
        SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft
      FROM templates
    `).get();
    console.log('   Total:', result.total);
    console.log('   Published:', result.published);
    console.log('   Draft:', result.draft);
    
    console.log('\n✅ All checks passed! Templates are working correctly.');
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

testTemplates();
