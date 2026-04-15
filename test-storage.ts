import 'dotenv/config';
import { storage, initDb } from './server/storage.ts';

async function test() {
  try {
    console.log('[TEST] Initializing database...');
    await initDb();
    
    console.log('[TEST] Getting template count...');
    const count = await storage.getTemplatesCount();
    console.log('[TEST] Current template count:', count);

    if (count === 0) {
      console.log('[TEST] No templates. Trying to insert one...');
      const result = await storage.createTemplate({
        title: 'Test Template',
        category: 'birthday',
        status: 'published',
        canvas_json: '{"test": true}',
        thumbnail_color: '#FF0000',
        is_pro: false,
      });
      console.log('[TEST] Inserted:', result);

      const newCount = await storage.getTemplatesCount();
      console.log('[TEST] New template count:', newCount);
    }
  } catch (e) {
    console.error('[TEST] Error:', e.message);
    console.error(e);
  }
  process.exit(0);
}

test();
