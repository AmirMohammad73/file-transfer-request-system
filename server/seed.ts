import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'postgres',
  password: process.env.DB_PASSWORD || 'qwerty',
  port: parseInt(process.env.DB_PORT || '5432'),
});

const users = [
  {
    name: 'آقای خواجوی',
    username: '09123456789',
    password: 'password123',
    role: 'VC_ACCEPTER',
    department: 'اداره امنیت شبکه و زیرساخت'
  },
];

async function seed() {
  try {
    console.log('شروع seed کردن کاربران...\n');

    // ایجاد کاربران جدید
    for (const user of users) {
      // Hash کردن پسورد
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(user.password, saltRounds);

      // وارد کردن کاربر در دیتابیس
      const result = await pool.query(
        `INSERT INTO req_users (name, username, password, role, department) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING id, name, username, role, department`,
        [user.name, user.username, hashedPassword, user.role, user.department]
      );

      const insertedUser = result.rows[0];
      console.log(`✅ کاربر ایجاد شد:`);
      console.log(`   نام: ${insertedUser.name}`);
      console.log(`   نام کاربری: ${insertedUser.username}`);
      console.log(`   نقش: ${insertedUser.role}`);
      console.log(`   پسورد: ${user.password} (hash شده در دیتابیس)`);
      console.log('');
    }

    console.log('✅ تمام کاربران با موفقیت ایجاد شدند!\n');
    console.log('📋 اطلاعات ورود:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    users.forEach(user => {
      console.log(`نام کاربری: ${user.username} | پسورد: ${user.password}`);
    });
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error: any) {
    console.error('❌ خطا در seed کردن:', error.message);
    if (error.code === '23505') {
      console.error('⚠️  یکی از نام‌های کاربری قبلاً وجود دارد. لطفاً ابتدا آنها را حذف کنید.');
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();

