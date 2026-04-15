import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve('.env.local') });

import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!);

async function check() {
  try {
    const [result] = await sql`SELECT COUNT(*) as count FROM templates`;
    console.log('✅ PostgreSQL Templates:', result.count);
    
    const [users] = await sql`SELECT COUNT(*) as count FROM users`;
    console.log('✅ PostgreSQL Users:', users.count);
    
    const [sessions] = await sql`SELECT COUNT(*) as count FROM session`;
    console.log('✅ PostgreSQL Sessions:', sessions.count);
  } catch (e: any) {
    console.error('❌ Error:', e.message);
  } finally {
    await sql.end();
  }
}

check();
