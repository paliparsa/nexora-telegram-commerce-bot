# آپدیت سریع v0.6

این ZIP را روی Repo فعلی Overlay کن.

**`wrangler.jsonc` داخل ZIP نیست.** فایل فعلی Repo را نگه دار تا `database_id` واقعی D1 حذف نشود.

بعد:

1. Cloudflare → Worker → Settings → Variables and Secrets
2. یک Secret جدید با نام `STOCK_ENCRYPTION_KEY` اضافه کن (48–64 کاراکتر تصادفی توصیه می‌شود).
3. Commit/Push به `main`.
4. منتظر Build موفق Cloudflare باش.
5. Log باید migration `0005_security_hardening.sql` را اعمال کند.
6. `/health` را تست کن.
7. `/setup-webhook` را باز کن و `SETUP_SECRET` را داخل فرم وارد کن.
8. `/admin-web` و یک خرید تستی را بررسی کن.

اگر `STOCK_ENCRYPTION_KEY` تنظیم نشده باشد، تحویل فروشگاه عمداً Fail-Closed می‌شود تا Stock به صورت plaintext جدید ذخیره/تحویل نشود.
