-- جدول ردیابی فایل‌های آپلود شده برای انتقال بین سرورهای یک سامانه
CREATE TABLE IF NOT EXISTS file_uploads (
  id SERIAL PRIMARY KEY,
  request_id VARCHAR(50) NOT NULL,
  file_id VARCHAR(50) NOT NULL,
  original_filename VARCHAR(500) NOT NULL,
  stored_filename VARCHAR(500) NOT NULL,
  file_size BIGINT NOT NULL,
  uploader_id INTEGER NOT NULL,
  destination_ip INET NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  downloaded_at TIMESTAMP WITH TIME ZONE,
  is_downloaded BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ایندکس برای جستجوی سریع
CREATE INDEX IF NOT EXISTS idx_file_uploads_request_id ON file_uploads(request_id);
CREATE INDEX IF NOT EXISTS idx_file_uploads_expires_at ON file_uploads(expires_at);
CREATE INDEX IF NOT EXISTS idx_file_uploads_is_downloaded ON file_uploads(is_downloaded);
CREATE INDEX IF NOT EXISTS idx_file_uploads_uploader_id ON file_uploads(uploader_id);
