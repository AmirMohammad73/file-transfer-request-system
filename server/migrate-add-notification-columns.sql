-- اضافه کردن ستون‌های مربوط به اطلاع‌رسانی برای کاربران همگروه
ALTER TABLE requests
ADD COLUMN IF NOT EXISTS notification_for_user_id UUID REFERENCES req_users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS original_request_id VARCHAR(50) REFERENCES requests(id) ON DELETE CASCADE;

-- ایجاد ایندکس برای بهبود عملکرد کوئری‌های تاریخچه
CREATE INDEX IF NOT EXISTS idx_requests_notification_user ON requests(notification_for_user_id);
CREATE INDEX IF NOT EXISTS idx_requests_original_request ON requests(original_request_id);