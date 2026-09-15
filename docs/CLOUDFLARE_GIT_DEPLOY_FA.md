# Deploy از GitHub به Cloudflare — Nexora v0.6

این پروژه برای اجرای کامل روی Cloudflare Workers + D1 است. Node.js روی کامپیوتر شخصی لازم نیست؛ Node/Wrangler فقط در محیط Build خود Cloudflare اجرا می‌شوند.

## Upgrade از Repo فعلی

1. فایل `wrangler.jsonc` فعلی را نگه دار؛ این فایل باید `database_name` و `database_id` واقعی D1 فعلی‌ات را داشته باشد.
2. فایل‌های v0.6 را روی Repo آپلود/Replace کن.
3. Secret جدید `STOCK_ENCRYPTION_KEY` را در Cloudflare اضافه کن.
4. Push/Commit روی `main` باعث Build خودکار می‌شود.
5. Deploy command همان `npm run deploy:cloudflare` است.
6. در Log مطمئن شو `0005_security_hardening.sql` اعمال شده است.
7. `https://YOUR-DOMAIN/health` باید فقط `{"ok":true}` برگرداند.
8. برای تنظیم Webhook برو به `https://YOUR-DOMAIN/setup-webhook` و SETUP_SECRET را داخل فرم وارد کن.

## نکته D1

Binding پروژه باید `DB` باشد و به همان D1 فعلی وصل باشد. برای Production config، `database_name` و `database_id` واقعی را از Dashboard D1 بردار و در `wrangler.jsonc` فعلی نگه دار.

## Secrets

حداقل:

- `BOT_TOKEN`
- `WEBHOOK_SECRET`
- `SETUP_SECRET`
- `ADMIN_WEB_PASSWORD`
- `ADMIN_SESSION_SECRET`
- `STOCK_ENCRYPTION_KEY`

Secretها را داخل GitHub Commit نکن.
