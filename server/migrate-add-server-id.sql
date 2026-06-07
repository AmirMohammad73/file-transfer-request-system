-- اضافه کردن ستون system_name به جدول backup_resources (ستون فراموش شده)
ALTER TABLE backup_resources
ADD COLUMN IF NOT EXISTS system_name VARCHAR(255);

-- نکته: ستون selected_server_id در جدول requests نیاز نیست.
-- اطلاعات سامانه انتخابی (selectedServerId و selectedServerName) داخل
-- ستون JSONB موجود (files) به عنوان فیلد اضافی ذخیره می‌شود.
