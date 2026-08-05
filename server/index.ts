import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth';
import requestRoutes from './routes/requests';
import backupResourcesRoutes from './routes/backupResources';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// PostgreSQL connection pool
export const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'postgres',
  password: process.env.DB_PASSWORD || 'qwerty',
  port: parseInt(process.env.DB_PORT || '5432'),
});

// Test database connection
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// ایجاد پوشه uploads اگر وجود نداشت
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  // بدون این تنظیم، مرورگر هدر Content-Disposition را در پاسخ‌های cross-origin
  // از دید کد جاوااسکریپت (fetch) مخفی می‌کند و نام فایل دانلودی به مقدار
  // پیش‌فرض 'download' برمی‌گردد.
  exposedHeaders: ['Content-Disposition'],
}));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));
app.use(cookieParser());

// سرو فایل‌های آپلود شده (فقط برای دانلود داخلی)
app.use('/uploads', express.static(uploadsDir));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/backup-resources', backupResourcesRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ─── پاکسازی خودکار فایل‌های منقضی (هر ۳۰ دقیقه) ────────────────────────────
const EXPIRY_CHECK_INTERVAL = 30 * 60 * 1000; // 30 دقیقه

async function cleanupExpiredFiles() {
  try {
    // بررسی وجود جدول file_uploads
    const tableCheck = await pool.query(
      "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'file_uploads')"
    );
    if (!tableCheck.rows[0].exists) {
      return; // جدول وجود ندارد - هنوز migration اجرا نشده
    }

    const result = await pool.query(
      `DELETE FROM file_uploads 
       WHERE expires_at < NOW() AND is_downloaded = FALSE
       RETURNING stored_filename`
    );
    
    if (result.rows.length > 0) {
      console.log(`پاکسازی ${result.rows.length} فایل منقضی شده`);
      for (const row of result.rows) {
        const filePath = path.join(uploadsDir, row.stored_filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`حذف فایل: ${row.stored_filename}`);
        }
      }
    }
  } catch (error) {
    console.error('خطا در پاکسازی فایل‌های منقضی:', error);
  }
}

// اجرای پاکسازی در شروع سرور و سپس هر ۳۰ دقیقه
cleanupExpiredFiles();
setInterval(cleanupExpiredFiles, EXPIRY_CHECK_INTERVAL);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

