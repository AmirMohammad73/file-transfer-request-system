# راهنمای راه‌اندازی سیستم درخواست انتقال فایل

## پیش‌نیازها

1. **Node.js** (نسخه 18 یا بالاتر)
2. **PostgreSQL** (نسخه 12 یا بالاتر)
3. **npm** یا **yarn**

## نصب وابستگی‌ها

```bash
npm install
```

## راه‌اندازی دیتابیس

1. اطمینان حاصل کنید که PostgreSQL در حال اجرا است
2. به دیتابیس `postgres` متصل شوید
3. جداول و انواع داده را ایجاد کنید. فایل SQL زیر را در PostgreSQL اجرا کنید:

```sql
-- ایجاد نوع داده برای نقش‌ها (Enums)
CREATE TYPE user_role AS ENUM (
    'REQUESTER', 
    'GROUP_LEAD', 
    'DEPUTY', 
    'NETWORK_HEAD', 
    'NETWORK_ADMIN'
);

-- ایجاد نوع داده برای وضعیت‌ها
CREATE TYPE request_status AS ENUM (
    'PENDING', 
    'APPROVED', 
    'REJECTED', 
    'COMPLETED'
);

-- 1. جدول کاربران (Users)
CREATE TABLE req_users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    username VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role user_role NOT NULL,
    department VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. جدول درخواست‌ها (Requests)
CREATE TABLE requests (
    id VARCHAR(50) PRIMARY KEY,
    requester_id INTEGER REFERENCES req_users(id),
    requester_name VARCHAR(255) NOT NULL,
    department VARCHAR(255) NOT NULL,
    files JSONB NOT NULL DEFAULT '[]'::jsonb,
    status request_status NOT NULL DEFAULT 'PENDING',
    current_approver user_role,
    approval_history JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ایجاد ایندکس برای جستجوی سریع‌تر
CREATE INDEX idx_requests_files ON requests USING GIN (files);
```

## پیکربندی متغیرهای محیطی

فایل `.env` را در ریشه پروژه ایجاد کنید و مقادیر زیر را تنظیم کنید:

```
DB_USER=postgres
DB_PASSWORD=qwerty
DB_HOST=localhost
DB_PORT=5432
DB_NAME=postgres
PORT=5000
FRONTEND_URL=http://localhost:3000
NODE_ENV=development
```

## اجرای برنامه

### اجرای سرور بک‌اند

در یک ترمینال:

```bash
npm run server
```

سرور روی پورت 5000 اجرا می‌شود.

### اجرای فرانت‌اند

در ترمینال دیگری:

```bash
npm run dev
```

فرانت‌اند روی پورت 3000 اجرا می‌شود.

## ویژگی‌ها

- ✅ احراز هویت با استفاده از کوکی‌های امن
- ✅ هش کردن رمزهای عبور با bcrypt
- ✅ ذخیره‌سازی داده‌ها در PostgreSQL
- ✅ API RESTful برای تمام عملیات
- ✅ مدیریت جلسه کاربر با کوکی‌های HttpOnly

## ساختار پروژه

```
├── server/              # کدهای بک‌اند
│   ├── index.ts        # نقطه ورود سرور
│   ├── routes/         # مسیرهای API
│   │   ├── auth.ts     # مسیرهای احراز هویت
│   │   └── requests.ts # مسیرهای درخواست‌ها
│   └── middleware/     # میدلورها
│       └── auth.ts     # میدلور احراز هویت
├── utils/
│   └── api.ts          # سرویس API برای فرانت‌اند
├── auth/
│   └── AuthContext.tsx # Context احراز هویت
└── pages/              # صفحات اصلی برنامه
```

## نکات مهم

1. در محیط production، حتماً `NODE_ENV=production` را تنظیم کنید
2. رمزهای عبور به صورت هش شده در دیتابیس ذخیره می‌شوند
3. کوکی‌ها به صورت HttpOnly تنظیم شده‌اند برای امنیت بیشتر
4. در محیط production، باید `secure: true` برای کوکی‌ها فعال باشد (نیاز به HTTPS)

