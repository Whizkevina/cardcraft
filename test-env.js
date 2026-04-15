import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
if (process.env.DATABASE_URL) {
  console.log('✅ DATABASE_URL loaded');
  console.log('URL starts:', process.env.DATABASE_URL.substring(0, 60));
} else {
  console.log('❌ DATABASE_URL NOT SET');
  console.log('Available keys:', Object.keys(process.env).filter(k => k.includes('DATABASE') || k.includes('URL')));
}
