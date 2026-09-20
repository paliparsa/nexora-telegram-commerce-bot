# Nexora Commerce Bot

ربات فروش محصولات دیجیتال برای Telegram، ساخته‌شده روی **Cloudflare Workers + D1**.  
تمام اجرای ربات، دیتابیس، Cron، Web Admin و اسکن پرداخت‌ها روی Cloudflare انجام می‌شود و برای اجرا به VPS یا Node.js روی سیستم شخصی نیاز نیست.

---

## امکانات

### فروشگاه و محصولات
- دسته‌بندی محصولات
- دسته‌بندی نوع تحویل
- محصول با نام، توضیحات، قیمت فروش، قیمت خرید/هزینه، گارانتی، حداقل/حداکثر خرید، ترتیب نمایش و وضعیت فعال/غیرفعال
- انتخاب تعداد دلخواه تا سقف موجودی
- Stock Pool برای لینک، اکانت، کد و محصولات دیجیتال
- تحویل خودکار، دستی یا اطلاعاتی
- قالب‌های آماده تحویل:
  - لینک فعال‌سازی
  - اکانت / ورود
  - کد / لایسنس
  - قالب شخصی
- موجودی کم و اعلان ادمین
- علاقه‌مندی‌ها
- اعلان موجودشدن محصول
- خرید مجدد
- اعلام موجودشدن محصول برای همه کاربران با دکمه خرید مستقیم

### Credit و پرداخت
- کیف پول Credit داخلی
- Ledger کامل افزایش/کاهش موجودی
- شارژ مبلغ آماده یا دلخواه
- شارژ مستقیم کسری Credit هنگام خرید
- USDT BEP20 روی BSC
- USDT TRC20 روی TRON
- TON
- کارت‌به‌کارت با تأیید دستی
- مبلغ یکتای Invoice
- QR و Copy Address / Amount / TXID
- Recheck پرداخت
- Cancel فاکتور Pending
- تشخیص Underpayment / Overpayment / Late Payment
- Confirmation check
- تأیید دستی پرداخت توسط ادمین
- Refund به Credit
- تست مستقل تمام روش‌های پرداخت
- BSC RPC-first با Etherscan به‌عنوان fallback/diagnostic
- تبدیل خودکار USDT به تومان برای کارت‌به‌کارت
- ذخیره نرخ و مبلغ تومان در لحظه ساخت فاکتور

### Provider Engine
- اتصال به تامین‌کننده خارجی با API Key
- تست اتصال و Balance
- Sync کاتالوگ
- Import محصول به فروشگاه
- همگام‌سازی قیمت و موجودی
- خرید خودکار از Provider
- تحویل خودکار نتیجه سفارش
- Poll سفارش‌های Pending
- Refund خودکار روی Failure قطعی
- هشدار کمبود Balance
- قیمت‌گذاری مستقل از قیمت Provider:
  - قیمت ثابت
  - درصد سود
  - سود ثابت
  - Margin پیش‌فرض
- Price Lock برای جلوگیری از تغییر قیمت دستی در Sync
- اطلاعات Provider، API URL، قیمت خرید و upstream order id به مشتری نمایش داده نمی‌شود

### Referral
- لینک دعوت اختصاصی
- Reward قابل تنظیم
- Trigger بر اساس عضویت معتبر یا اولین خرید
- Bronze / Silver / Gold
- ضریب پاداش برای Tierها
- کنترل Abuse و امکان غیرفعال‌کردن Referral برای کاربر

### مدیریت داخل Telegram
- تشخیص خودکار ادمین از `ADMIN_IDS`
- دکمه ورود به حالت مدیریت فقط برای ادمین
- داشبورد
- آخرین سفارش‌ها
- پرداخت‌های Pending
- جستجوی کاربر
- افزایش/کاهش Credit
- مشاهده سفارش‌های کاربر
- Ban / Unban
- Risk level
- یادداشت داخلی
- محدودیت خرید
- Blacklist
- مدیریت کامل محصول
- تغییر سریع قیمت
- افزودن سریع Stock
- مدیریت Category
- مدیریت Delivery Type
- تیکت‌های پشتیبانی
- Broadcast با Preview
- Maintenance Mode
- Feature Flags
- تست روش‌های پرداخت
- تنظیم نرخ‌ها
- Provider Manager
- Backup / Export

### Web Admin
- Login امن با Session
- Rate limit ورود
- CSRF protection
- مدیریت کاربران
- مدیریت محصولات
- سفارش‌ها
- پرداخت‌ها
- Rate Engine
- Provider
- Profit / Cost
- Backup
- Maintenance و Feature Flags

### امنیت
- Telegram Webhook Secret
- Setup Secret
- Session امن برای Web Admin
- Atomic purchase / stock / balance
- جلوگیری از double-spend و duplicate TX
- IDهای تصادفی امن
- AES-GCM برای Stockهای حساس
- Audit Log
- Security Headers
- Fail-closed webhook
- عدم نیاز به Seed Phrase یا Private Key

---

# نصب از صفر — فقط GitHub + Cloudflare

## 1. ساخت Bot تلگرام

در Telegram وارد `@BotFather` شو:

1. `/newbot`
2. نام بات را انتخاب کن.
3. Username بات را انتخاب کن.
4. `BOT_TOKEN` را کپی کن.

همچنین Telegram User ID عددی ادمین را برای `ADMIN_IDS` داشته باش.

---

## 2. ساخت GitHub Repository

یک Repository جدید بساز و تمام فایل‌های پروژه را در Root آن Upload کن.

ساختار اصلی باید شامل این موارد باشد:

```text
src/
migrations/
package.json
tsconfig.json
README.md
wrangler.jsonc
```

Secret یا API Key واقعی را داخل GitHub قرار نده.

---

## 3. ساخت D1

در Cloudflare:

**Storage & Databases → D1 SQL Database → Create**

نام پیشنهادی:

```text
nexora-commerce-bot-db
```

بعد از ساخت، `Database ID` را کپی کن.

---

## 4. تنظیم wrangler.jsonc

اگر فایل `wrangler.jsonc` از قبل در Repo وجود دارد، فقط `database_id` آن را با D1 واقعی خودت تطبیق بده.

نمونه:

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "nexora-telegram-commerce-bot",
  "main": "src/index.ts",
  "compatibility_date": "2026-09-01",

  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "nexora-commerce-bot-db",
      "database_id": "YOUR_D1_DATABASE_ID"
    }
  ],

  "triggers": {
    "crons": ["* * * * *"]
  }
}
```

`YOUR_D1_DATABASE_ID` را با ID واقعی D1 جایگزین کن.

---

## 5. اتصال GitHub به Cloudflare Workers

در Cloudflare:

**Workers & Pages → Create → Import a repository**

Repository را انتخاب کن.

Production branch:

```text
main
```

Deploy command:

```text
npm run deploy:cloudflare
```

این دستور ابتدا Migrationهای D1 را اجرا و سپس Worker را Deploy می‌کند:

```text
wrangler d1 migrations apply DB --remote
wrangler deploy --keep-vars
```

`--keep-vars` باعث می‌شود Variableهای ساخته‌شده در Dashboard هنگام Deploy حذف نشوند.

---

# تنظیم Variables و Secrets

در:

**Worker → Settings → Variables and Secrets**

موارد زیر را وارد کن.

## Variables

### BOT_USERNAME

Username بات بدون `@`

```text
NexoraExampleBot
```

### ADMIN_IDS

Telegram ID عددی ادمین‌ها.

یک ادمین:

```text
123456789
```

چند ادمین:

```text
123456789,987654321
```

### PUBLIC_BASE_URL

دامنه واقعی Worker یا Custom Domain، بدون `/` آخر.

```text
https://bot.example.com
```

### CREDIT_USD_PRICE

قیمت هر Credit به دلار:

```text
1
```

### REFERRAL_REWARD

Reward پیش‌فرض Referral:

```text
0.05
```

### INVOICE_EXPIRE_MINUTES

مدت اعتبار Invoice:

```text
30
```

### ETHERSCAN_CHAIN_ID

برای BNB Smart Chain Mainnet:

```text
56
```

### BSC_RPC_URL

اختیاری. RPC اصلی BSC:

```text
https://bsc-dataseed.binance.org/
```

### USDT_BEP20_TOKEN

Contract مورد استفاده پروژه برای USDT روی BSC:

```text
0x55d398326f99059fF775485246999027B3197955
```

### USDT_BEP20_WALLET

آدرس Wallet دریافت USDT روی BSC:

```text
0xYOUR_BSC_WALLET
```

### USDT_TRC20_TOKEN

Contract رسمی USDT روی TRON:

```text
TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t
```

### USDT_TRC20_WALLET

آدرس TRON:

```text
TYOUR_TRON_WALLET
```

### TON_WALLET

آدرس TON:

```text
EQ...
```

### TON_USD_RATE

Fallback دستی. در حالت Auto می‌تواند صفر باشد:

```text
0
```

### CARD_NUMBER

شماره کارت برای کارت‌به‌کارت:

```text
6037-XXXX-XXXX-XXXX
```

### CARD_HOLDER

نام صاحب کارت:

```text
نام صاحب کارت
```

---

## Secrets

موارد زیر را با نوع **Secret** ذخیره کن.

### BOT_TOKEN

توکن دریافتی از BotFather.

### WEBHOOK_SECRET

یک رشته تصادفی قوی و مستقل.

### SETUP_SECRET

یک رشته تصادفی جدا برای صفحه Setup Webhook.

### ADMIN_WEB_PASSWORD

رمز ورود Web Admin.

### ADMIN_SESSION_SECRET

رشته تصادفی طولانی برای Sessionهای Web Admin.

### STOCK_ENCRYPTION_KEY

کلید پایدار و قوی برای رمزنگاری Stock.

حداقل 24 کاراکتر و ترجیحاً 48 تا 64 کاراکتر.

**بعد از ثبت Stock واقعی این کلید را تغییر نده.**

### ETHERSCAN_API_KEY

اختیاری برای BEP20. Scanner اصلی BSC از RPC استفاده می‌کند و Etherscan نقش fallback/diagnostic دارد.

### TRONGRID_API_KEY

برای اسکن TRC20.

### TONAPI_API_KEY

برای TON.

### NEXORA_PROVIDER_API_URL

Base URL مربوط به Provider.

این مقدار را فقط به‌صورت Secret نگه دار.

### NEXORA_PROVIDER_API_KEY

API Key Provider.

این مقدار را فقط به‌صورت Secret نگه دار.

---

# 6. اولین Deploy

بعد از اضافه‌کردن Variables و Secrets، یک Commit جدید به `main` بزن یا Deploy را از Cloudflare اجرا کن.

در Build Log باید:

1. dependencyها نصب شوند.
2. D1 migrations اجرا شوند.
3. Worker Deploy شود.

در پایان نباید migration یا deploy error وجود داشته باشد.

---

# 7. اتصال Domain

می‌توانی از `workers.dev` استفاده کنی، ولی برای Production بهتر است Custom Domain داشته باشی.

در:

**Worker → Settings → Domains & Routes**

مثلاً:

```text
https://bot.example.com
```

سپس `PUBLIC_BASE_URL` را دقیقاً روی همان دامنه قرار بده.

---

# 8. تنظیم Webhook تلگرام

بعد از Deploy این آدرس را باز کن:

```text
https://YOUR-DOMAIN/setup-webhook
```

مقدار `SETUP_SECRET` را در فرم وارد کن.

در صورت موفقیت Telegram باید webhook را روی این مسیر ثبت کند:

```text
https://YOUR-DOMAIN/webhook
```

---

# 9. تست سلامت

این آدرس را باز کن:

```text
https://YOUR-DOMAIN/health
```

خروجی صحیح:

```json
{"ok":true}
```

---

# 10. ورود به Web Admin

آدرس:

```text
https://YOUR-DOMAIN/admin-web
```

با مقدار `ADMIN_WEB_PASSWORD` وارد شو.

---

# تنظیم روش‌های پرداخت

## BEP20

مقادیر لازم:

```text
ETHERSCAN_CHAIN_ID=56
USDT_BEP20_TOKEN=0x55d398326f99059fF775485246999027B3197955
USDT_BEP20_WALLET=0x...
BSC_RPC_URL=https://bsc-dataseed.binance.org/
```

`ETHERSCAN_API_KEY` اختیاری ولی پیشنهادشده است.

در Telegram Admin:

**مدیریت → مالی و پرداخت → مرکز تست پرداخت → BEP20**

تست باید Wallet، Contract، Chain ID، RPC، symbol و decimals را بررسی کند.

LIVE/TEST به انتخاب ادمین است.

---

## TRC20

```text
USDT_TRC20_TOKEN=TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t
USDT_TRC20_WALLET=T...
```

Secret:

```text
TRONGRID_API_KEY
```

سپس تست TRC20 را از مرکز تست پرداخت اجرا کن.

---

## TON

```text
TON_WALLET=EQ...
TON_USD_RATE=0
```

Secret:

```text
TONAPI_API_KEY
```

در حالت Auto، Rate Engine تلاش می‌کند نرخ زنده دریافت کند و از Cache/Manual به‌عنوان fallback استفاده می‌کند.

---

## کارت‌به‌کارت

```text
CARD_NUMBER=...
CARD_HOLDER=...
```

فلو:

```text
User → Invoice → مبلغ تومان → ارسال رسید → Admin Review → Approve / Reject
```

نرخ USDT/TMN به‌صورت خودکار دریافت و هنگام ایجاد Invoice ذخیره می‌شود. منبع نرخ به مشتری نمایش داده نمی‌شود.

---

# تنظیم Provider Engine

Provider از داخل UI مشتری قابل مشاهده نیست.

برای فعال‌سازی فقط این دو Secret لازم است:

```text
NEXORA_PROVIDER_API_URL
NEXORA_PROVIDER_API_KEY
```

بعد در Telegram Admin:

**مدیریت → فروش و محتوا → تامین‌کننده**

ترتیب پیشنهادی:

1. **تست اتصال**
2. **بررسی Balance**
3. **Sync محصولات**
4. باز کردن **کاتالوگ**
5. Import محصول
6. انتخاب Category و Delivery Type
7. تنظیم قیمت
8. فعال‌کردن محصول

## Pricing Mode

برای هر محصول می‌توان یکی از حالت‌های زیر را انتخاب کرد:

```text
Provider Default
Percentage Markup
Fixed Profit
Fixed Selling Price
```

اگر قیمت را دستی Lock کنی، Sync بعدی قیمت فروش را تغییر نمی‌دهد.

---

# تنظیم فروشگاه

در Telegram Admin:

**مدیریت → فروش و محتوا**

## Category

مثال:

```text
هوش مصنوعی
VPN
تلگرام
طراحی
استریم
```

ادمین می‌تواند Category جدید بسازد، ویرایش کند و برای محصول انتخاب کند.

## Delivery Type

سه Mode اصلی:

```text
stock
manual
info
```

### stock
برای محصولاتی که مقدار تحویل از Stock Pool گرفته می‌شود.

### manual
سفارش بعد از پرداخت وارد Processing می‌شود و ادمین تحویل را ثبت می‌کند.

### info
برای تحویل اطلاعات ثابت یا دستورالعمل.

برای Delivery Type می‌توان:

- عنوان
- Emoji
- قالب پیام
- زمان تقریبی تحویل

را تنظیم کرد.

## قالب تحویل

قالب‌های آماده:

```text
Activation Link
Account Login
License Key
Custom
```

Placeholder اصلی:

```text
{stock_value}
```

در زمان تحویل با مقدار واقعی محصول جایگزین می‌شود.

---

# مدیریت محصول

از Telegram Admin می‌توان هر فیلد محصول را جداگانه تغییر داد:

- نام
- توضیحات
- قیمت فروش
- هزینه
- Category
- Delivery Type
- گارانتی
- قالب تحویل
- حداقل تعداد
- حداکثر تعداد
- Low Stock Threshold
- ترتیب نمایش
- فعال/غیرفعال
- Stock

برای محصولات Provider، قیمت دستی می‌تواند Lock شود.

---

# Broadcast

ادمین می‌تواند:

- متن
- عکس
- فایل

ارسال کند.

قبل از ارسال Preview نمایش داده می‌شود.

اعلام موجودی محصول نیز از Product Manager قابل انجام است و برای کاربر دکمه خرید مستقیم ارسال می‌شود.

---

# Referral

تنظیمات Referral داخل D1 ذخیره می‌شوند و از پنل قابل مدیریت هستند.

امکانات:

- Reward ثابت
- Trigger عضویت یا اولین خرید
- Bronze / Silver / Gold
- Multiplier
- Disable Referral برای یک کاربر

---

# پشتیبانی

کاربر می‌تواند Ticket ایجاد کند.

Ticket می‌تواند شامل:

- متن
- عکس
- فایل
- Order reference

باشد.

ادمین داخل Telegram پاسخ می‌دهد و پاسخ برای کاربر ارسال می‌شود.

---

# Feature Flags

از پنل مدیریت می‌توان قابلیت‌ها را بدون تغییر کد روشن/خاموش کرد:

- Shop
- Crypto
- Card-to-card
- Referral
- Support
- Broadcast
- Favorites
- Restock Watch
- نمایش Stock
- Provider Products

---

# Maintenance Mode

از Telegram Admin یا Web Admin می‌توان Maintenance Mode را فعال کرد.

در این حالت خرید جدید محدود می‌شود ولی مدیریت ادمین همچنان در دسترس است.

---

# Backup

از Web Admin یا Telegram Admin می‌توان Export تهیه کرد.

اطلاعات قابل خروجی:

- Users
- Orders
- Credit Ledger
- Payments
- Products
- Categories
- Referrals
- Support Tickets
- Settings
- Provider Orders

---

# نکات امنیتی مهم

- هیچ‌وقت Seed Phrase یا Private Key داخل Worker قرار نده.
- Repo را با Secret واقعی Public نکن.
- `WEBHOOK_SECRET`، `SETUP_SECRET`، `ADMIN_SESSION_SECRET` و `STOCK_ENCRYPTION_KEY` باید متفاوت باشند.
- `STOCK_ENCRYPTION_KEY` را بعد از استفاده تغییر نده.
- API Keyها فقط در Cloudflare Secrets باشند.
- `PUBLIC_BASE_URL` باید HTTPS واقعی باشد.
- برای Production از Custom Domain استفاده کن.
- قبل از فروش واقعی، تمام روش‌های پرداخت را از **مرکز تست پرداخت** بررسی کن.
- Backup دوره‌ای بگیر.

---

# مسیرهای اصلی

```text
/health
/setup-webhook
/webhook
/admin-web
```

---

# آپدیت پروژه

برای آپدیت نسخه‌های بعدی:

1. از Repo Backup یا Branch بگیر.
2. فایل‌های نسخه جدید را روی Repo فعلی Replace کن.
3. `wrangler.jsonc` دارای D1 ID واقعی را بدون دلیل جایگزین نکن.
4. Commit به `main`.
5. Cloudflare خودش Migrationهای جدید را اجرا و Worker را Deploy می‌کند.
6. Variables با `--keep-vars` حفظ می‌شوند.
7. بعد از Deploy `/health`، `/start`، Web Admin و تست پرداخت‌ها را بررسی کن.

---

## اجرای پروژه

پس از نصب صحیح:

```text
Telegram → Cloudflare Worker → D1
                         ├→ Blockchain APIs / RPC
                         ├→ Rate Providers
                         └→ Provider API
```

هیچ VPS یا سرویس اجرایی دیگری برای خود Nexora لازم نیست.
