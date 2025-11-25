import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'postgres',
  password: process.env.DB_PASSWORD || 'qwerty',
  port: parseInt(process.env.DB_PORT || '5432'),
});

async function checkDatabase() {
  try {
    console.log('بررسی وجود جداول...\n');

    // Check if users table exists
    const usersCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `);

    // Check if requests table exists
    const requestsCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'requests'
      );
    `);

    // Check if enums exist
    const roleEnumCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM pg_type 
        WHERE typname = 'user_role'
      );
    `);

    const statusEnumCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM pg_type 
        WHERE typname = 'request_status'
      );
    `);

    console.log('نتایج بررسی:');
    console.log(`- جدول users: ${usersCheck.rows[0].exists ? '✅ موجود' : '❌ موجود نیست'}`);
    console.log(`- جدول requests: ${requestsCheck.rows[0].exists ? '✅ موجود' : '❌ موجود نیست'}`);
    console.log(`- Enum user_role: ${roleEnumCheck.rows[0].exists ? '✅ موجود' : '❌ موجود نیست'}`);
    console.log(`- Enum request_status: ${statusEnumCheck.rows[0].exists ? '✅ موجود' : '❌ موجود نیست'}`);

    if (!usersCheck.rows[0].exists || !requestsCheck.rows[0].exists || 
        !roleEnumCheck.rows[0].exists || !statusEnumCheck.rows[0].exists) {
      console.log('\n⚠️  برخی از جداول یا انواع داده موجود نیستند.');
      console.log('لطفاً اسکریپت SQL در فایل SETUP.md را اجرا کنید.\n');
    } else {
      console.log('\n✅ تمام جداول و انواع داده موجود هستند.\n');
    }

  } catch (error: any) {
    console.error('❌ خطا در بررسی دیتابیس:', error.message);
  } finally {
    await pool.end();
  }
}

checkDatabase();

