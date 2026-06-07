# Requirements Document

## Introduction

این سند الزامات قابلیت "شناسنامه سامانه‌ها" را تعریف می‌کند. این قابلیت به کاربران اجازه می‌دهد تا اطلاعات سامانه‌های مختلف را از طریق یک رابط کاربری مدیریت کنند. این قابلیت شامل یک دکمه جدید در navbar و یک مودال/دیالوگ برای مدیریت رکوردهای سامانه است. در نسخه اولیه، داده‌ها فقط در حافظه موقت (in-memory) نگهداری می‌شوند و به دیتابیس متصل نیستند.

## Glossary

- **System_Management_Button**: دکمه‌ای در navbar که مودال شناسنامه سامانه‌ها را باز می‌کند
- **System_Management_Modal**: پنجره دیالوگی که فرم و لیست سامانه‌ها را نمایش می‌دهد
- **System_Record**: یک رکورد حاوی اطلاعات یک سامانه شامل IP، URL، مالک، ناظر، رابط و پیمانکار
- **Navbar**: نوار ناوبری در بالای صفحه که دکمه‌های مختلف را نمایش می‌دهد
- **Header_Component**: کامپوننت React که navbar را رندر می‌کند
- **In_Memory_Storage**: ذخیره‌سازی موقت داده‌ها در state کامپوننت بدون اتصال به دیتابیس

## Requirements

### Requirement 1: نمایش دکمه شناسنامه سامانه‌ها

**User Story:** به عنوان یک کاربر، می‌خواهم دکمه "شناسنامه سامانه‌ها" را در navbar ببینم، تا بتوانم به قابلیت شناسنامه سامانه‌ها دسترسی داشته باشم.

#### Acceptance Criteria

1. THE Header_Component SHALL نمایش دهد System_Management_Button را در navbar در کنار دکمه تاریخچه
2. THE System_Management_Button SHALL دارای متن "شناسنامه سامانه‌ها" باشد
3. THE System_Management_Button SHALL دارای استایل مشابه با دکمه تاریخچه باشد
4. THE System_Management_Button SHALL دارای یک آیکون مناسب باشد

### Requirement 2: باز کردن مودال شناسنامه سامانه‌ها

**User Story:** به عنوان یک کاربر، می‌خواهم با کلیک بر روی دکمه "شناسنامه سامانه‌ها" یک مودال باز شود، تا بتوانم اطلاعات سامانه‌ها را مشاهده و مدیریت کنم.

#### Acceptance Criteria

1. WHEN کاربر بر روی System_Management_Button کلیک می‌کند، THE System_Management_Modal SHALL باز شود
2. THE System_Management_Modal SHALL دارای عنوان "شناسنامه سامانه‌ها" باشد
3. THE System_Management_Modal SHALL دارای دکمه بستن (×) در گوشه بالا باشد
4. WHEN کاربر بر روی دکمه بستن کلیک می‌کند، THE System_Management_Modal SHALL بسته شود
5. WHEN کاربر بر روی پس‌زمینه مودال کلیک می‌کند، THE System_Management_Modal SHALL بسته شود

### Requirement 3: نمایش فرم افزودن سامانه

**User Story:** به عنوان یک کاربر، می‌خواهم یک فرم برای افزودن سامانه جدید ببینم، تا بتوانم اطلاعات سامانه را وارد کنم.

#### Acceptance Criteria

1. THE System_Management_Modal SHALL نمایش دهد یک فرم با فیلدهای زیر:
   - IP (فیلد متنی)
   - URL (فیلد متنی)
   - مالک سامانه (فیلد متنی)
   - ناظر پروژه (فیلد متنی)
   - رابط پروژه (فیلد متنی)
   - پیمانکار پروژه (فیلد متنی)
2. THE System_Management_Modal SHALL نمایش دهد یک دکمه "افزودن سامانه" در انتهای فرم
3. THE فرم SHALL دارای برچسب‌های (labels) فارسی برای هر فیلد باشد
4. THE فیلدهای فرم SHALL دارای placeholder مناسب باشند

### Requirement 4: اعتبارسنجی فیلدهای فرم

**User Story:** به عنوان یک کاربر، می‌خواهم سیستم فیلدهای خالی را بررسی کند، تا از وارد کردن داده‌های ناقص جلوگیری شود.

#### Acceptance Criteria

1. WHEN کاربر دکمه "افزودن سامانه" را کلیک می‌کند و هر یک از فیلدها خالی است، THE System_Management_Modal SHALL نمایش دهد یک پیام خطا
2. THE پیام خطا SHALL مشخص کند کدام فیلدها خالی هستند
3. WHEN تمام فیلدها پر شده‌اند، THE System_Management_Modal SHALL اجازه دهد افزودن رکورد جدید

### Requirement 5: افزودن رکورد سامانه جدید

**User Story:** به عنوان یک کاربر، می‌خواهم بتوانم سامانه جدید اضافه کنم، تا اطلاعات آن در لیست نمایش داده شود.

#### Acceptance Criteria

1. WHEN کاربر تمام فیلدها را پر می‌کند و دکمه "افزودن سامانه" را کلیک می‌کند، THE System_Management_Modal SHALL ایجاد کند یک System_Record جدید
2. THE System_Record جدید SHALL ذخیره شود در In_Memory_Storage
3. THE System_Record جدید SHALL نمایش داده شود در لیست سامانه‌ها
4. WHEN رکورد جدید اضافه می‌شود، THE فرم SHALL پاک شود (reset)
5. THE System_Management_Modal SHALL نمایش دهد یک پیام موفقیت پس از افزودن رکورد

### Requirement 6: نمایش لیست سامانه‌ها

**User Story:** به عنوان یک کاربر، می‌خواهم لیست سامانه‌های اضافه شده را ببینم، تا بتوانم اطلاعات آن‌ها را مرور کنم.

#### Acceptance Criteria

1. THE System_Management_Modal SHALL نمایش دهد یک جدول یا لیست از تمام System_Records
2. THE جدول SHALL نمایش دهد ستون‌های زیر برای هر رکورد:
   - IP
   - URL
   - مالک سامانه
   - ناظر پروژه
   - رابط پروژه
   - پیمانکار پروژه
   - عملیات (دکمه حذف)
3. WHEN هیچ رکوردی وجود ندارد، THE System_Management_Modal SHALL نمایش دهد یک پیام "هیچ سامانه‌ای ثبت نشده است"
4. THE لیست سامانه‌ها SHALL به صورت scroll قابل مشاهده باشد اگر تعداد رکوردها زیاد باشد

### Requirement 7: حذف رکورد سامانه

**User Story:** به عنوان یک کاربر، می‌خواهم بتوانم سامانه‌های اضافه شده را حذف کنم، تا بتوانم رکوردهای غیرضروری را پاک کنم.

#### Acceptance Criteria

1. THE هر رکورد در لیست SHALL دارای یک دکمه "حذف" باشد
2. WHEN کاربر بر روی دکمه حذف کلیک می‌کند، THE System_Management_Modal SHALL نمایش دهد یک دیالوگ تأیید
3. WHEN کاربر حذف را تأیید می‌کند، THE System_Record SHALL حذف شود از In_Memory_Storage
4. THE رکورد حذف شده SHALL از لیست نمایشی حذف شود
5. THE System_Management_Modal SHALL نمایش دهد یک پیام موفقیت پس از حذف رکورد

### Requirement 8: سازگاری با استایل موجود

**User Story:** به عنوان یک کاربر، می‌خواهم رابط کاربری شناسنامه سامانه‌ها مشابه با سایر بخش‌های برنامه باشد، تا تجربه کاربری یکپارچه‌ای داشته باشم.

#### Acceptance Criteria

1. THE System_Management_Modal SHALL استفاده کند از Tailwind CSS classes مشابه با HistoryModal
2. THE System_Management_Modal SHALL دارای انیمیشن باز و بسته شدن مشابه با HistoryModal باشد
3. THE System_Management_Button SHALL دارای رنگ و استایل مشابه با دکمه‌های موجود در navbar باشد
4. THE فرم و جدول SHALL دارای spacing و typography مشابه با سایر کامپوننت‌ها باشند

### Requirement 9: ذخیره‌سازی موقت داده‌ها

**User Story:** به عنوان یک کاربر، می‌خواهم داده‌های وارد شده در طول استفاده از مودال حفظ شوند، تا در صورت بستن و باز کردن مجدد مودال، داده‌ها از بین نروند.

#### Acceptance Criteria

1. THE System_Records SHALL ذخیره شوند در React state کامپوننت
2. WHEN کاربر مودال را می‌بندد و دوباره باز می‌کند، THE System_Records SHALL همچنان نمایش داده شوند
3. WHEN کاربر صفحه را refresh می‌کند، THE System_Records SHALL از بین بروند (چون در In_Memory_Storage هستند)

### Requirement 10: Responsive Design

**User Story:** به عنوان یک کاربر، می‌خواهم بتوانم از قابلیت شناسنامه سامانه‌ها در دستگاه‌های مختلف استفاده کنم، تا در هر اندازه صفحه‌نمایش تجربه خوبی داشته باشم.

#### Acceptance Criteria

1. THE System_Management_Modal SHALL به درستی نمایش داده شود در دستگاه‌های موبایل، تبلت و دسکتاپ
2. THE فرم SHALL به صورت عمودی (stacked) در دستگاه‌های موبایل نمایش داده شود
3. THE جدول SHALL به صورت scroll افقی در دستگاه‌های کوچک نمایش داده شود
4. THE System_Management_Button SHALL در navbar به درستی در تمام اندازه‌های صفحه نمایش داده شود
