# ارتقا به Nexora v0.6.2

این نسخه دو مشکل v0.6.1 را رفع می‌کند:

1. **Webhook Setup روی Custom Domain دیگر به خاطر Origin mismatch رد نمی‌شود.**
   - `/setup-webhook` همچنان فقط با `POST` و `SETUP_SECRET` معتبر کار می‌کند.
   - درخواست‌های مرورگری `cross-site` رد می‌شوند، اما same-site/custom-domain سالم پذیرفته می‌شوند.

2. **Variableهای ساخته‌شده از Dashboard هنگام Git deploy حذف نمی‌شوند.**
   - اسکریپت Deploy حالا از `wrangler deploy --keep-vars` استفاده می‌کند.
   - Secretها طبق رفتار Cloudflare در deploy حذف نمی‌شوند؛ `--keep-vars` برای حفظ Plaintext Variables داشبورد اضافه شده است.

## روش ارتقا

فایل‌های این ZIP را روی repository فعلی خودت کپی/جایگزین کن و Commit بزن.

فایل `wrangler.jsonc` داخل این upgrade قرار داده نشده تا `database_id` فعلی D1 تو دست‌نخورده بماند.

بعد از Deploy، این صفحه را باز کن:

```text
https://nexora.asgharpay.tr/setup-webhook
```

`SETUP_SECRET` را داخل فرم وارد کن. دیگر نباید `origin mismatch` دریافت کنی.

## نکته مهم Variables

Deploy command مورد انتظار در Cloudflare همان است:

```text
npm run deploy:cloudflare
```

این اسکریپت در v0.6.2 عملاً اجرا می‌کند:

```text
wrangler deploy --keep-vars && wrangler d1 migrations apply DB --remote
```

بنابراین Variableهایی که در Cloudflare Dashboard ساخته‌ای باید در Deployهای بعدی حفظ شوند.
