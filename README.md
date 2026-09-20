# Nexora Commerce Bot v0.9.0

> v0.8.0: Telegram Control & UX — مدیریت کامل‌تر داخل تلگرام، ویرایش تک‌فیلدی محصولات، دسته‌بندی نوع تحویل، ابزارهای سریع ادمین، حساب کاربر، علاقه‌مندی، اعلان موجودی، جزئیات سفارش/پرداخت و Backup. راهنمای ارتقا: `UPGRADE_V080_FA.md`.

# Nexora Commerce Bot — v0.7 Operations Suite

نسخه v0.7 روی v0.6.2 ساخته شده و برای **آپدیت مستقیم Repo فعلی GitHub → Cloudflare Workers** طراحی شده است. دیتابیس فعلی حذف نمی‌شود و migration جدید `0006_operations_suite.sql` فقط قابلیت‌های جدید را اضافه می‌کند. فایل `wrangler.jsonc` عمداً در بسته آپدیت نیست تا `database_id` واقعی D1 شما دست نخورد.

## امکانات جدید v0.7

- Referral پیشرفته: Trigger قابل انتخاب بین عضویت معتبر و اولین خرید، Tierهای Bronze/Silver/Gold و ضریب پاداش.
- مانیتورینگ پرداخت: تشخیص late payment، underpayment، overpayment، confirmation count و بررسی دستی توسط ادمین.
- Rate Engine مرکزی برای `TON/USD`، `USD/TRY` و `USD/IRR` با Auto/Manual.
- Risk/Ban: Ban/Unban، Risk level، یادداشت داخلی، سقف خرید، خاموش‌کردن Referral و Blacklist برای username / wallet / TXID.
- اعلان ادمین برای سفارش جدید، پرداخت کریپتو، موجودی کم و ایراد پرداخت.
- Backup/Export امن از پنل وب برای Users، Orders، Ledger، Payments، Settings و Full Backup.
- Maintenance Mode.
- Feature Flags برای Shop، Crypto، Card-to-card، Referral، Support و Broadcast.
- تشخیص خودکار ادمین با `ADMIN_IDS` و نمایش دکمه **ورود به حالت مدیریت** در منوی خود ادمین.
- رفع `403 Forbidden` روی **Refresh Rate** پنل وب: تزریق CSRF اصلاح شده و بررسی Origin شکننده حذف شده؛ محافظت همچنان با Session + SameSite + CSRF معتبر انجام می‌شود.
- Deploy امن‌تر: migration **قبل از** deploy اجرا می‌شود تا کد جدید قبل از آماده شدن Schema بالا نیاید. `--keep-vars` نیز حفظ شده است.

## Upgrade from v0.6.2 (GitHub → Cloudflare)

1. ZIP v0.7 را روی Root Repo فعلی Upload/Replace کن.
2. `wrangler.jsonc` فعلی را نگه دار؛ این ZIP آن را ندارد.
3. Commit به `main` بزن.
4. Cloudflare Build دستور `npm run deploy:cloudflare` را اجرا می‌کند. در v0.7 این دستور ابتدا migration را روی D1 اعمال می‌کند و بعد Worker را با `--keep-vars` Deploy می‌کند.
5. در Build log باید `0006_operations_suite.sql` موفق باشد و بعد `wrangler deploy --keep-vars` اجرا شود.
6. بات را با `/start` تست کن. اگر Telegram ID شما داخل `ADMIN_IDS` باشد، پایین منو دکمه `🛠 ورود به حالت مدیریت` ظاهر می‌شود.
7. پنل وب را باز کن و در تب «پرداخت و نرخ» دکمه Refresh را تست کن؛ دیگر نباید `forbidden` بگیری.
8. تب‌های جدید «عملیات» و «Backup» را هم تست کن.

### Secret یا Variable جدید لازم است؟

خیر. v0.7 برای قابلیت‌های جدید Variable اجباری جدیدی ندارد و تنظیمات جدید داخل `bot_settings` در D1 ذخیره می‌شوند. Secretهای v0.6 مثل `STOCK_ENCRYPTION_KEY` را تغییر نده.

---

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


## اصلاحات v0.6.2

Deploy گیت/کلادفلر حالا با `wrangler deploy --keep-vars` انجام می‌شود تا Variableهای Plaintext که از Dashboard ساخته‌ای پاک نشوند. همچنین خطای اشتباه `origin mismatch` در فرم تنظیم Webhook روی Custom Domain رفع شده است.

## v0.7.3 — Payment diagnostics

پنل پرداخت اکنون تست مستقل و تست یکجای BEP20، TRC20، TON، کارت‌به‌کارت و Rate Engine دارد. BEP20 ابتدا BSC RPC را استفاده می‌کند و Etherscan فقط fallback/diagnostic است. تست BEP20 همچنین وجود Contract، `symbol()` و `decimals()` را مستقیماً روی زنجیره بررسی می‌کند. متغیر اختیاری `BSC_RPC_URL` برای تغییر RPC قابل استفاده است.


## امکانات جدید v0.8.0

### مدیریت ادمین داخل تلگرام
- داشبورد خلاصه با سفارش امروز، Pending Payments، تیکت باز، موجودی کم و زمان آخرین اسکن.
- آخرین سفارش‌ها، پرداخت‌های Pending، بررسی مجدد و تأیید دستی پرداخت.
- جستجوی کاربر با Telegram ID / username / نام، مشاهده پروفایل، سفارش‌ها و افزایش/کاهش سریع Credit.
- ارسال مجدد تحویل سفارش و ثبت تحویل دستی برای محصولات Manual.
- افزودن استوک سریع با اعلان خودکار به کاربرانی که منتظر موجودی بودند.
- Backup مستقیم CSV از کاربران، سفارش‌ها، Ledger و محصولات.
- Broadcast متن/عکس/فایل با Preview قبل از قرار گرفتن در صف.

### Product Manager
- ویرایش جداگانه نام، توضیحات، قیمت فروش، هزینه، دسته‌بندی، نوع تحویل، گارانتی، فرمت تحویل، حداقل/حداکثر خرید، حد هشدار موجودی، ترتیب نمایش و وضعیت فعال/غیرفعال.
- دسته‌بندی‌های فروشگاه قابل ساخت و ویرایش.
- Delivery Type Manager با حالت‌های `stock`، `manual` و `info` و قالب تحویل قابل تنظیم.

### تجربه کاربر
- صفحه «حساب من»، گردش Credit، سفارش‌ها و پرداخت‌ها.
- جزئیات سفارش، نمایش مجدد تحویل و خرید دوباره.
- جزئیات پرداخت، زمان باقی‌مانده فاکتور، Recheck، Cancel، Copy TXID و Explorer.
- علاقه‌مندی‌ها و «وقتی موجود شد خبرم کن».
- نمایش نوع تحویل و گارانتی قبل از خرید.
- FAQ داخلی.

> هیچ Variable یا Secret جدیدی برای v0.8 لازم نیست. فقط migration `0007_telegram_control_ux.sql` باید توسط Deploy فعلی اجرا شود.


### v0.8 polish additions
- Admin-editable FAQ from Telegram.
- Delivery types support editable ETA text and delivery templates.
- Users can copy crypto destination/amount/TXID, recheck/cancel invoices, and resend completed digital delivery.
- Quick top-up presets: $5 / $10 / $25 / $50.


## v0.8.1

- Official Wallex `USDTTMN` market rate for card-to-card invoices.
- Card invoices persist the Toman amount and FX snapshot.
- Exact credit-deficit top-up from checkout.
- Manual product quantity up to available stock.
- Delivery template presets plus custom templates.
- Product availability broadcast with direct-buy button.
- Migration: `0008_checkout_fx_templates_broadcast.sql`. No new secret is required.

## v0.9.0 — Provider Engine

Nexora can now sync and import products from a private upstream reseller API, apply local pricing rules, create upstream orders, poll pending orders, auto-deliver returned digital goods, refund deterministic failures, and alert admins on low provider balance. The upstream URL and API key are not hardcoded and must be stored as Cloudflare Secrets:

```text
NEXORA_PROVIDER_API_URL=<PRIVATE_BASE_URL>
NEXORA_PROVIDER_API_KEY=<PRIVATE_API_KEY>
```

Supported local pricing modes: provider default markup, per-product percentage markup, fixed profit, and fixed selling price. Customer-facing messages do not expose provider URLs, upstream order IDs, source costs, or raw upstream errors.

Migration: `migrations/0009_provider_engine.sql`. See `UPGRADE_V090_FA.md` for the Persian deployment guide.

Security note: an operator who controls the Cloudflare runtime cannot be cryptographically prevented from discovering an upstream destination. If the upstream must also be hidden from installers/operators, place it behind a private relay you control.
