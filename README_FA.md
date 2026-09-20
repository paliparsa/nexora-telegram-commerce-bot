# Nexora Commerce Bot v0.9.0

> **v0.9.0 — Provider Engine:** همگام‌سازی کاتالوگ خارجی، Import محصول، قیمت‌گذاری شخصی، خرید و تحویل خودکار، Poll سفارش Pending، Refund خودکار در خطاهای قطعی، هشدار کمبود Balance و کنترل کامل از Telegram/Web Admin. اطلاعات اتصال Provider در UI مشتری نمایش داده نمی‌شود. راهنمای ارتقا: `UPGRADE_V090_FA.md`.

> v0.8.1: Checkout & Delivery Polish — نرخ خودکار USDT/TMN برای کارت‌به‌کارت از API رسمی بازار والکس، شارژ مستقیم کسری Credit، تعداد دلخواه تا سقف موجودی، قالب‌های آماده تحویل و Broadcast آماده موجودشدن محصول. راهنمای ارتقا: `UPGRADE_V081_FA.md`.

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

## آپدیت سریع از v0.6.2

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

Version: **0.9.0**


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
- Delivery Type Manager با حالت‌های `stock`، `manual` و `info`، قالب پیام و زمان تقریبی تحویل قابل تنظیم.
- FAQ از خود Telegram Admin قابل ویرایش است.

### تجربه کاربر
- صفحه «حساب من»، گردش Credit، سفارش‌ها و پرداخت‌ها.
- جزئیات سفارش، نمایش تحویل، ارسال مجدد تحویل و خرید دوباره.
- جزئیات پرداخت، زمان باقی‌مانده فاکتور، Recheck، Cancel، Copy آدرس/مبلغ/TXID و Explorer.
- علاقه‌مندی‌ها و «وقتی موجود شد خبرم کن».
- نمایش نوع تحویل و گارانتی قبل از خرید.
- FAQ داخلی که ادمین متنش را مستقیم از بات مدیریت می‌کند.
- شارژ سریع با مبالغ آماده $5 / $10 / $25 / $50.

> هیچ Variable یا Secret جدیدی برای v0.8 لازم نیست. فقط migration `0007_telegram_control_ux.sql` باید توسط Deploy فعلی اجرا شود.


## امکانات جدید v0.8.1

- نرخ **USDT/TMN** برای کارت‌به‌کارت از endpoint رسمی `GET https://api.wallex.ir/v1/markets` و بازار `USDTTMN` دریافت می‌شود. برای محاسبه فاکتور از `askPrice` و در نبود آن `lastPrice/bidPrice` استفاده می‌شود. منبع نرخ به کاربر نمایش داده نمی‌شود.
- مبلغ تومان و نرخ لحظه ساخت فاکتور در خود Invoice ذخیره می‌شود تا بعداً تغییر نرخ مبلغ فاکتور قبلی را عوض نکند.
- در صورت کمبود Credit، Checkout مستقیماً دکمه **شارژ کسری دقیق** و **شارژ دلخواه** نشان می‌دهد.
- کاربر می‌تواند تعداد محصول را به‌صورت دستی وارد کند. برای محصولات Stock-based سقف واقعی، موجودی لحظه‌ای محصول است.
- برای هر Delivery Type سه قالب آماده **لینک فعال‌سازی / اکانت / کد یا لایسنس** و یک گزینه **شخصی‌سازی** وجود دارد. Placeholder اصلی `{stock_value}` است.
- از صفحه هر محصول ادمین می‌تواند **اعلام موجودی** را Preview و سپس به صف Broadcast بفرستد. پیام دارای دکمه **خرید مستقیم** است.
- تست کارت‌به‌کارت و Rate Engine حالا سلامت نرخ USDT/TMN را هم بررسی می‌کند.

### Migration v0.8.1

Deploy معمول پروژه migration زیر را اجرا می‌کند:

`migrations/0008_checkout_fx_templates_broadcast.sql`

Variable یا Secret جدیدی لازم نیست. API نرخ بازار عمومی است و کلید خصوصی نیاز ندارد.

## v0.9.0 — Provider Engine

Nexora اکنون می‌تواند محصولات یک API تامین خارجی را بدون وابسته کردن UI مشتری به نام یا آدرس آن سرویس دریافت و Fulfill کند. اتصال در کد Hardcode نشده و فقط از Cloudflare Secrets خوانده می‌شود.

### راه‌اندازی
در Cloudflare → Worker → Settings → Variables and Secrets این دو مورد را به‌صورت **Secret** بساز:

```text
NEXORA_PROVIDER_API_URL=<PRIVATE_BASE_URL>
NEXORA_PROVIDER_API_KEY=<PRIVATE_API_KEY>
```

مقدار واقعی URL و API Key را داخل GitHub، README یا فایل‌های Repo قرار نده. `NEXORA_PROVIDER_API_URL` باید Base URL نسخه API باشد؛ Nexora مسیرهای `/account/info`، `/account/balance`، `/products` و `/orders` را خودش اضافه می‌کند.

بعد از Deploy:
1. Telegram Admin → فروش و محتوا → **تامین‌کننده**.
2. **تست اتصال** را بزن.
3. **Sync محصولات** را اجرا کن.
4. از کاتالوگ، محصول موردنظر را **Import** کن.
5. نام/توضیح/دسته/نوع تحویل محصول را مثل محصولات عادی Nexora شخصی‌سازی کن.
6. برای قیمت، یکی از حالت‌های پیش‌فرض Provider، درصد سود، سود ثابت یا قیمت فروش ثابت را انتخاب کن.

### قیمت‌گذاری
- **Provider default:** هزینه خرید + درصد سود پیش‌فرض تامین‌کننده در Nexora.
- **Percent:** درصد سود اختصاصی همان محصول.
- **Fixed profit:** مبلغ Credit ثابت روی هزینه خرید.
- **Fixed price:** قیمت فروش کاملاً دستی.
- اگر قیمت یک محصول Provider را از Product Manager به‌صورت دستی عوض کنی، Auto Pricing همان محصول Lock می‌شود؛ از صفحه محصول می‌توانی Lock را برداری تا دوباره قیمت Sync شود.

### Sync و Fulfillment
- Stock و قیمت مبنا با Cron و interval قابل تنظیم Sync می‌شوند.
- قبل از Checkout، محصول خارجی Refresh می‌شود تا قیمت/Stock قدیمی کمتر باعث خطا شود.
- بعد از کسر Credit، سفارش خارجی ایجاد می‌شود.
- تحویل موفق داخل سیستم تحویل خود Nexora ذخیره می‌شود و با `STOCK_ENCRYPTION_KEY` در D1 رمز می‌شود.
- سفارش‌های Pending دارای شناسه قابل پیگیری، به‌صورت دوره‌ای Poll می‌شوند.
- خطاهای قطعی سفارش باعث Refund خودکار Credit می‌شوند.
- حالت Pending بدون شناسه قابل پیگیری وارد Manual Review می‌شود تا Retry کور و سفارش تکراری رخ ندهد.
- Balance تامین‌کننده هر چند دقیقه Cache/Refresh می‌شود و پایین‌تر از Threshold برای ادمین هشدار می‌فرستد.

### عدم افشای منبع به مشتری
پیام‌ها و صفحات customer-facing نام Provider، Base URL، API Key، شناسه سفارش upstream، قیمت خرید و خطای خام upstream را نمایش نمی‌دهند. خطاهای خارجی برای مشتری به پیام‌های عمومی Nexora تبدیل می‌شوند.

> **محدودیت مهم:** اگر شخصی مالک Repo/Cloudflare account و runtime باشد، هیچ برنامه‌ای نمی‌تواند منبع upstream را از او به‌صورت رمزنگاری‌شده و تضمینی مخفی کند؛ برای مخفی‌سازی حتی از اپراتور نصب، باید API را پشت یک Relay خصوصی که کنترلش دست خودت است قرار بدهی. v0.9 منبع را از مشتری نهایی و Repo عمومی مخفی نگه می‌دارد، مشروط به اینکه URL/Key فقط Secret باشند.

### Migration
`migrations/0009_provider_engine.sql`

این migration اطلاعات قبلی را حذف نمی‌کند.


---

## کنترل دسترسی کاربران

از مسیر **مدیریت → کاربران و پشتیبانی → جوین اجباری** دو کنترل مستقل در دسترس است:

- **جوین اجباری:** کاربر باید عضو کانال‌ها/گروه‌های فعال باشد. برای بررسی قابل اتکا، بات را در آن‌ها Admin کن.
- **احراز شماره:** در صورت فعال بودن، کاربر باید شماره متصل به همان Telegram account را با دکمه `📱 ارسال شماره من` بفرستد. ربات فقط Contactی را قبول می‌کند که Telegram `user_id` آن با فرستنده برابر باشد.

هر دو قابلیت از داخل Telegram Admin قابل روشن/خاموش شدن هستند. احراز شماره به‌صورت پیش‌فرض خاموش است.
