# راهنمای آپدیت Nexora به v0.7

این بسته **Overlay Update** است. آن را روی Repo فعلی v0.6.2 بریز و `wrangler.jsonc` فعلی‌ات را نگه دار.

## مرحله‌به‌مرحله

1. در GitHub از Repo فعلی یک branch یا backup بگیر.
2. محتویات ZIP v0.7 را در Root Repo آپلود و Replace کن.
3. بررسی کن `migrations/0006_operations_suite.sql` اضافه شده باشد.
4. فایل `wrangler.jsonc` خودت، مخصوصاً `database_id`، را تغییر نده.
5. Commit کن.
6. Cloudflare Build باید این ترتیب را اجرا کند:

```text
wrangler d1 migrations apply DB --remote
wrangler deploy --keep-vars
```

این ترتیب عمدی است: ابتدا Schema جدید ساخته می‌شود و سپس کد v0.7 بالا می‌آید.

7. بعد از Deploy، `/health` باید `{"ok":true}` برگرداند.
8. در Telegram `/start` بزن. اگر ID شما در `ADMIN_IDS` است، دکمه «🛠 ورود به حالت مدیریت» می‌بینی.
9. در Admin Mode این بخش‌ها را تست کن: قابلیت‌ها، Referral، ریسک و Ban، Blacklist، Rate Engine و Maintenance.
10. پنل وب `/admin-web` را باز کن. در «پرداخت و نرخ» روی Refresh بزن. باگ Forbidden مربوط به CSRF در v0.7 اصلاح شده است.
11. در تب Backup یک خروجی `Full Backup` بگیر و نگه دار.

## رفتار پرداخت‌های غیرعادی

- پرداخت دقیق و با Confirmation کافی: خودکار تأیید می‌شود.
- پرداخت بعد از Expire: `late_payment` و بررسی دستی.
- مبلغ نزدیک ولی کمتر: `underpayment` و بررسی دستی.
- مبلغ نزدیک ولی بیشتر: `overpayment` و بررسی دستی.
- TXID یا source wallet در Blacklist: اعتبار خودکار داده نمی‌شود و ادمین Alert می‌گیرد.

برای موارد Manual Review، ادمین از داخل Telegram می‌تواند «تأیید و شارژ» یا «رد» کند.

## نکته درباره Variableها

`--keep-vars` همچنان فعال است؛ Variableهایی که در Cloudflare Dashboard تنظیم کرده‌ای با Deploy بعدی نباید پاک شوند.
