# Nexora Commerce Bot — v0.6 Security Hardening

ربات فروش محصولات دیجیتال فارسی برای **Telegram + Cloudflare Workers + D1**. این نسخه روی v0.5 ساخته شده و مهاجرت آن **غیرتخریبی** است؛ دیتابیس، کاربران، سفارش‌ها، موجودی‌ها، تیکت‌ها و تنظیمات فعلی حفظ می‌شوند.

> این بسته برای بروزرسانی Repo فعلی طراحی شده است. فایل `wrangler.jsonc` فعلی خودت را که `database_id` واقعی D1 داخلش قرار داده‌ای نگه دار. در ZIP آپدیت عمداً `wrangler.jsonc` قرار داده نشده تا Binding دیتابیس فعلی‌ات خراب نشود.

## تغییرات امنیتی v0.6

- Webhook تلگرام **Fail-Closed** شده؛ بدون `WEBHOOK_SECRET` معتبر هیچ Update پذیرفته نمی‌شود.
- Setup Webhook دیگر Secret را در URL نمی‌گیرد؛ `/setup-webhook` یک فرم POST امن دارد.
- شناسه سفارش/فاکتور با `crypto.getRandomValues()` ساخته می‌شود و قابل حدس زدن نیست.
- QR و Check Payment فقط برای **صاحب همان Invoice** کار می‌کنند.
- Scanner پرداخت‌ها بر اساس **Network + Destination Wallet** گروه‌بندی می‌شود؛ تغییر Wallet باعث جا ماندن Invoice قدیمی نمی‌شود.
- تراکنش Crypto باید بعد از زمان ایجاد Invoice باشد و حداقل تأیید معتبر داشته باشد.
- خرید محصول، کسر Credit، رزرو Stock و مصرف Discount به شکل **Atomic** انجام می‌شود؛ خرید همزمان نمی‌تواند Stock یا Balance را دوبار خرج کند.
- Refund نیز Atomic و idempotent شده است.
- Stockهای جدید با **AES-GCM** در D1 رمز می‌شوند. Stockهای plaintext قدیمی پس از Deploy به‌صورت مرحله‌ای توسط Cron رمز می‌شوند.
- پنل وب: Rate Limit ورود، Session قابل revoke، انقضای ۱۲ ساعته، CSRF Token، CSP، `X-Frame-Options`, `no-referrer`.
- ورودی‌های حساس ادمین مثل Wallet، Join URL، Discount و Card validation شده‌اند.
- `/health` دیگر نسخه و جزئیات Deployment را افشا نمی‌کند.

## قبل از آپلود — فقط یک Secret جدید لازم است

در Cloudflare → Worker → **Settings → Variables and Secrets** یک Secret جدید بساز:

```text
STOCK_ENCRYPTION_KEY
```

مقدارش باید یک رشته تصادفی و پایدار حداقل 24 کاراکتری باشد؛ بهتر است 48 تا 64 کاراکتر باشد.

**خیلی مهم:** بعد از اینکه Stockها با این کلید رمز شدند، این Secret را حذف یا عوض نکن. عوض کردن کلید بدون عملیات Key Rotation باعث می‌شود Stockهای قبلی قابل رمزگشایی نباشند.

Secretهای اصلی Production باید حداقل این‌ها باشند:

```text
BOT_TOKEN
WEBHOOK_SECRET
SETUP_SECRET
ADMIN_WEB_PASSWORD
ADMIN_SESSION_SECRET
STOCK_ENCRYPTION_KEY
```

و بسته به شبکه‌های فعال:

```text
ETHERSCAN_API_KEY
TRONGRID_API_KEY
TONAPI_API_KEY
```

## آپدیت v0.5 → v0.6 فقط با GitHub و Cloudflare

1. از Repo فعلی GitHub یک Backup/branch بگیر.
2. **`wrangler.jsonc` فعلی را دست نزن**؛ همان فایلی که `database_name` و `database_id` واقعی D1 تو را دارد بماند.
3. محتوای ZIP آپدیت v0.6 را روی Root همان Repo آپلود و Replace کن.
4. مطمئن شو فایل جدید زیر داخل Repo آمده:

```text
migrations/0005_security_hardening.sql
```

5. در Cloudflare Secret جدید `STOCK_ENCRYPTION_KEY` را اضافه کن.
6. Commit به branch اصلی (`main`) بزن.
7. Cloudflare Workers Builds به‌صورت خودکار این دستور موجود در پروژه را اجرا می‌کند:

```text
npm run deploy:cloudflare
```

که Worker را Deploy و سپس migrationهای unapplied را روی D1 Remote اجرا می‌کند.
8. در Build log باید اجرای `0005_security_hardening.sql` بدون Error تمام شود.
9. آدرس زیر را باز کن:

```text
https://YOUR-DOMAIN/health
```

خروجی صحیح:

```json
{"ok":true}
```

## تنظیم Webhook در v0.6

روش قدیمی زیر دیگر استفاده نمی‌شود:

```text
/setup-webhook?secret=...
```

حالا فقط این آدرس را در مرورگر باز کن:

```text
https://YOUR-DOMAIN/setup-webhook
```

فرم باز می‌شود. مقدار `SETUP_SECRET` را داخل فرم وارد کن و Submit بزن. Secret دیگر در URL، History یا Referrer قرار نمی‌گیرد.

اگر موفق باشد Telegram پاسخ `ok: true` می‌دهد.

## تست بعد از آپدیت

این موارد را به‌ترتیب تست کن:

1. `/start` در بات.
2. جوین اجباری.
3. Balance.
4. ساخت یک فاکتور Crypto بدون پرداخت واقعی و Cancel کردن آن.
5. کارت‌به‌کارت و ارسال رسید تستی؛ ادمین باید Approval/Reject ببیند.
6. ورود به `/admin-web`.
7. پنج بار رمز اشتباه نزن؛ سیستم بعد از چند تلاش ناموفق IP را موقتاً محدود می‌کند.
8. یک Stock تستی از Telegram Admin اضافه کن؛ از این نسخه به بعد در D1 به صورت encrypted ذخیره می‌شود.
9. یک خرید کم‌ارزش تستی انجام بده و تحویل Stock را چک کن.
10. Discount و Refund را تست کن.

## رفتار Stockهای قدیمی

Stockهای قبلی حذف یا تغییر ناگهانی نمی‌شوند. Cron هر دقیقه تعداد محدودی Stock plaintext و `available` را با `STOCK_ENCRYPTION_KEY` رمز می‌کند. در طول این مهاجرت ربات همچنان می‌تواند آن‌ها را بخواند. Stockهای جدید از لحظه ثبت رمز می‌شوند.

## پنل وب ادمین

```text
https://YOUR-DOMAIN/admin-web
```

در v0.6:

- Session حداکثر 12 ساعت است.
- Logout واقعاً Session را از D1 revoke می‌کند.
- POSTهای پنل CSRF-protected هستند.
- بعد از تلاش‌های ناموفق متعدد، Login موقتاً Block می‌شود.

## پرداخت Crypto

منطق کلید خصوصی ندارد و فقط Blockchain API را می‌خواند. Seed Phrase یا Private Key را هرگز داخل Worker، GitHub یا D1 قرار نده.

Invoice matching بر اساس شبکه، مقصد، مقدار دقیق، زمان ایجاد Invoice و Transaction Hash انجام می‌شود. `tx_hash` برای Invoiceهای پرداخت‌شده unique شده تا یک تراکنش دوبار مصرف نشود.

## کارت‌به‌کارت

کارت‌به‌کارت همچنان Manual Review است:

`Invoice → Receipt → Admin Review → Approve/Reject → Credit`

Approval به‌صورت guard شده انجام می‌شود تا همان Invoice دوبار Credit نشود.

## فایل‌های مهم v0.6

```text
src/index.ts
migrations/0005_security_hardening.sql
package.json
README_FA.md
README.md
docs/SECURITY_V06_FA.md
```

فایل `wrangler.jsonc` در **بسته Upgrade** وجود ندارد؛ از Repo فعلی خودت نگهش دار تا `database_id` شخصی D1 پاک نشود.

## نکات Production

- Repo را Public نکن اگر هر Secret یا اطلاعات واقعی داخلش Commit کرده‌ای.
- Secretها فقط در Cloudflare Variables and Secrets باشند.
- `WEBHOOK_SECRET`, `SETUP_SECRET`, `ADMIN_SESSION_SECRET`, `STOCK_ENCRYPTION_KEY` همگی باید با هم متفاوت باشند.
- `ADMIN_WEB_PASSWORD` یک Password طولانی و یکتا باشد.
- برای Admin Web در مرحله بعد می‌توان Cloudflare Access را هم جلوی `/admin-web` قرار داد؛ v0.6 بدون آن هم Rate Limit و Session/CSRF دارد.

## Upgrade database

Migration جدید فقط جدول‌ها/Indexهای امنیتی را اضافه می‌کند. Migrationهای قبلی دوباره اجرا نمی‌شوند چون D1 جدول migration history دارد. اگر migration جدید خطا بدهد، Cloudflare D1 همان migration ناموفق را rollback می‌کند و migrationهای قبلی دست‌نخورده می‌مانند.

---

Version: **0.6.0**


## v0.6.2 deployment fix

Git/Cloudflare deploys now use `wrangler deploy --keep-vars`, so dashboard-configured plaintext Variables are preserved. Webhook setup also accepts valid custom-domain form submissions without the previous false `origin mismatch`.
