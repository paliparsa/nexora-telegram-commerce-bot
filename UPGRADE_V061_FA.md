# ارتقا به v0.6.1

این نسخه مشکل `403 Forbidden` در صفحه `/setup-webhook` هنگام استفاده از Custom Domain را رفع می‌کند.

## علت
در v0.6.0 بررسی امنیتی Origin فقط `req.url` را مجاز می‌دانست. در بعضی مسیرهای Cloudflare/Git integration، فرم از Custom Domain باز می‌شد اما Worker درخواست را با Origin دیگری می‌دید و POST را به اشتباه رد می‌کرد.

## اصلاح
اکنون هر دو Origin زیر معتبرند:
- Origin واقعی همان درخواست
- Origin تعریف‌شده در `PUBLIC_BASE_URL`

بنابراین اگر `PUBLIC_BASE_URL=https://nexora.asgharpay.tr` باشد، فرم روی همین دامنه بدون شکستن حفاظت Origin کار می‌کند.

## آپدیت
فایل‌های این ZIP را روی Repo فعلی جایگزین/Overlay کن و Commit بزن. Migration جدیدی ندارد. بعد از Deploy:

1. `https://nexora.asgharpay.tr/setup-webhook` را باز کن.
2. `SETUP_SECRET` را در فرم وارد کن.
3. باید پاسخ Telegram با `ok: true` بگیری.

اگر هنوز 403 دیدی، متن کامل پاسخ جدید را بفرست؛ حالا خطا مشخصاً `forbidden: origin mismatch` خواهد بود و می‌توانیم Origin واقعی را تشخیص بدهیم.
