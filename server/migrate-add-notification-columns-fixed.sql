-- اضافه کردن ستون‌های مربوط به اطلاع‌رسانی برای کاربران همگروه
-- IDها در دیتابیس integer هستند نه UUID

-- ابتدا ستون‌ها را بدون constraint اضافه می‌کنیم
ALTER TABLE requests
ADD COLUMN IF NOT EXISTS notification_for_user_id INTEGER,
ADD COLUMN IF NOT EXISTS original_request_id VARCHAR(50);

-- بعد constraintها را اضافه می‌کنیم
ALTER TABLE requests 
ADD CONSTRAINT IF NOT EXISTS fk_requests_notification_user 
FOREIGN KEY (notification_for_user_id) 
REFERENCES req_users(id) 
ON DELETE SET NULL;

ALTER TABLE requests 
ADD CONSTRAINT IF NOT EXISTS fk_requests_original_request 
FOREIGN KEY (original_request_id) 
REFERENCES requests(id) 
ON DELETE CASCADE;

-- ایجاد ایندکس برای بهبود عملکرد کوئری‌های تاریخچه
CREATE INDEX IF NOT EXISTS idx_requests_notification_user ON requests(notification_for_user_id);
CREATE INDEX IF NOT EXISTS idx_requests_original_request ON requests(original_request_id);