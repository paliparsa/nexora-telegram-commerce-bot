# Nexora Commerce Bot — v0.5

یک ربات فروش محصولات دیجیتال فارسی برای تلگرام که روی **Cloudflare Workers + D1** اجرا می‌شود و برای فروشگاه، کیف اعتبار، پرداخت کریپتویی خودکار، کارت‌به‌کارت دستی، Referral، تیکت پشتیبانی و مدیریت کامل ساخته شده است.

> نام مستقل این پروژه **Nexora Commerce Bot** است.

## امکانات اصلی

- رابط فارسی با Inline Keyboard
- جوین اجباری چند کانال یا گروه
- مدیریت کانال‌های جوین اجباری از داخل تلگرام
- کیف Credit و Ledger کامل
- خرید اعتبار با بسته‌های آماده یا مبلغ دلخواه
- پرداخت خودکار **USDT BEP20** با Blockchain API
- پرداخت خودکار **USDT TRC20** با Blockchain API
- پرداخت خودکار **TON Native**
- نرخ خودکار TON/USD با CoinGecko + حالت دستی جایگزین
- پرداخت کارت‌به‌کارت با ارسال رسید و تأیید دستی ادمین
- مبلغ یکتای Invoice برای Match بهتر پرداخت‌ها
- اسکن خودکار تراکنش‌ها با Cron هر دقیقه
- دکمه بررسی فوری «پرداخت کردم»
- QR و Copy Address / Amount
- فروشگاه دسته‌بندی‌شده
- Stock Pool و تحویل خودکار محصولات
- کد تخفیف درصدی و مبلغ ثابت
- Refund سفارش به Credit
- Referral و پاداش اعتبار
- تاریخچه سفارش و پرداخت
- تیکت پشتیبانی با متن، عکس و فایل
- Broadcast صف‌دار
- Audit Log ادمین
- پنل مدیریت تلگرامی
- **پنل مدیریت تحت وب**
- جستجوی کاربران و اصلاح دستی موجودی
- ویرایش کامل محصولات از Web Admin
- ثبت هزینه تمام‌شده محصول و محاسبه سود
- داشبورد فروش، هزینه و سود برای امروز / ۷ روز / ۳۰ روز / کل
- Webhook Secret Token
- Setup Secret مستقل برای ثبت Webhook

---

# معماری

```text
Telegram
   ↓
Cloudflare Worker
   ├── Telegram Webhook
   ├── Shop / Stock / Discount Engine
   ├── Credit Ledger
   ├── Payment Engine
   │    ├── Etherscan V2 → USDT BEP20
   │    ├── TronGrid → USDT TRC20
   │    └── TonAPI → TON transactions
   ├── CoinGecko → TON/USD rate
   ├── Card Receipt Manual Review
   ├── Referral Engine
   ├── Support Tickets
   ├── Telegram Admin Panel
   └── Web Admin Panel
          ↓
         D1
```

ربات برای دریافت پول به **Private Key یا Seed Phrase نیاز ندارد**. فقط آدرس عمومی Wallet را ذخیره می‌کند و تراکنش‌های عمومی Blockchain را بررسی می‌کند.

> **هیچ‌وقت Seed Phrase یا Private Key خودت را داخل Worker، D1، Secret، GitHub یا سورس قرار نده.**

---

# نصب پیشنهادی: کاملاً ابری و بدون Node.js روی سیستم

نسخه v0.5 برای این سناریو آماده شده است:

```text
GitHub → Cloudflare Workers Builds → Worker + D1
```

یعنی لازم نیست Node.js، npm یا Wrangler را روی کامپیوتر خودت نصب کنی. Cloudflare مستقیماً Repo را Build و Deploy می‌کند. Git integration رسمی Cloudflare با هر Push روی branch اصلی دوباره Deploy می‌کند.

## مرحله 1 — ساخت Bot

در `@BotFather` یک Bot بساز و `BOT_TOKEN` را نگه دار. Telegram ID ادمین را هم داشته باش.

## مرحله 2 — آپلود پروژه در GitHub

1. یک Repo جدید بساز؛ پیشنهاد: `nexora-telegram-commerce-bot`.
2. فایل‌های همین پروژه را در ریشه Repo آپلود کن.
3. `package.json` و `wrangler.jsonc` باید در ریشه Repo باشند.
4. Commit کن.

## مرحله 3 — اتصال GitHub به Cloudflare

Cloudflare Dashboard → **Workers & Pages → Create application → Import a repository**.

Repo را انتخاب کن و تنظیمات Build را این‌طور بگذار:

```text
Production branch: main
Root directory: /
Build command: [خالی]
Deploy command: npm run deploy:cloudflare
```

سپس **Save and Deploy** را بزن.

`wrangler.jsonc` در این نسخه عمداً D1 را فقط با binding `DB` تعریف کرده تا Wrangler جدید بتواند D1 را هنگام Deploy به‌صورت خودکار provision کند. اسکریپت `deploy:cloudflare` نیز بعد از Deploy، migrationهای دیتابیس را روی D1 Remote اعمال می‌کند.

> اگر اولین Deploy فقط در مرحله migration شکست خورد، یک بار Retry Deployment بزن. در اولین مرحله Worker/D1 ساخته شده‌اند و Retry معمولاً migrationها را کامل می‌کند.

## مرحله 4 — تنظیم Variables و Secrets در Cloudflare

بعد از اولین Deploy برو به **Worker → Settings → Variables and Secrets**.

### Secrets

```text
BOT_TOKEN
WEBHOOK_SECRET
SETUP_SECRET
ADMIN_WEB_PASSWORD
ADMIN_SESSION_SECRET
ETHERSCAN_API_KEY      (در صورت BEP20)
TRONGRID_API_KEY       (در صورت TRC20)
TONAPI_API_KEY         (در صورت TON)
```

### Variables

```text
BOT_USERNAME
ADMIN_IDS
PUBLIC_BASE_URL
USDT_BEP20_WALLET
USDT_BEP20_TOKEN
USDT_TRC20_WALLET
USDT_TRC20_TOKEN
TON_WALLET
TON_USD_RATE
ETHERSCAN_CHAIN_ID
CARD_NUMBER
CARD_HOLDER
CREDIT_USD_PRICE
REFERRAL_REWARD
INVOICE_EXPIRE_MINUTES
```

مقادیر پیشنهادی ثابت:

```text
USDT_BEP20_TOKEN = 0x55d398326f99059fF775485246999027B3197955
USDT_TRC20_TOKEN = TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t
ETHERSCAN_CHAIN_ID = 56
CREDIT_USD_PRICE = 1
REFERRAL_REWARD = 0.05
INVOICE_EXPIRE_MINUTES = 30
```

`PUBLIC_BASE_URL` باید URL واقعی Worker باشد، مثلاً:

```text
https://nexora-commerce-bot.YOURSUBDOMAIN.workers.dev
```

برای غیرفعال کردن یک روش Crypto، Wallet همان روش را خالی بگذار.

بعد از Save کردن Variables/Secrets یک Redeploy انجام بده.

## مرحله 5 — ثبت Webhook فقط با مرورگر

آدرس زیر را باز کن:

```text
https://YOUR-WORKER.workers.dev/setup-webhook?secret=YOUR_SETUP_SECRET
```

اگر پاسخ شامل `"ok": true` بود، Webhook تلگرام فعال است.

## مرحله 6 — تست

Health:

```text
https://YOUR-WORKER.workers.dev/health
```

Web Admin:

```text
https://YOUR-WORKER.workers.dev/admin-web
```

سپس در Telegram دستور `/start` را بزن.

## مرحله 7 — Deployهای آینده

از این به بعد فقط GitHub را تغییر بده. هر Commit روی `main` باعث Build و Deploy خودکار Cloudflare می‌شود؛ Migrationهای جدید D1 نیز همان‌جا اجرا می‌شوند.

برای راهنمای دقیق‌تر تصویری/قدم‌به‌قدم فایل زیر را ببین:

```text
docs/CLOUDFLARE_GIT_DEPLOY_FA.md
```

---

# پرداخت‌ها

## USDT BEP20
پول مستقیم به `USDT_BEP20_WALLET` می‌رود و Worker از Blockchain API برای Match تراکنش استفاده می‌کند. Private Key لازم نیست.

## USDT TRC20
آدرس شخصی TRON خودت را در `USDT_TRC20_WALLET` قرار بده. اسکن تراکنش از API انجام می‌شود.

## TON
`TON_WALLET` آدرس دریافت است. نرخ TON/USD در حالت Auto از CoinGecko بروزرسانی می‌شود و مقدار `TON_USD_RATE` فقط fallback دستی است.

## کارت‌به‌کارت
`CARD_NUMBER` و `CARD_HOLDER` را تنظیم کن. کاربر رسید می‌فرستد و ادمین داخل Telegram به‌صورت دستی تأیید یا رد می‌کند.

---

# امنیت

- Seed Phrase و Private Key هرگز وارد پروژه نمی‌شود.
- Token/API Key/رمزها را در GitHub قرار نده.
- `WEBHOOK_SECRET`، `SETUP_SECRET` و `ADMIN_SESSION_SECRET` را رشته تصادفی قوی انتخاب کن.
- برای کانال‌های Join اجباری، Bot باید در آن کانال Admin باشد تا بررسی عضویت قابل اتکا باشد.
- فایل `wrangler.jsonc` در v0.5 عمداً فاقد اطلاعات شخصی و Secret است.

---

# ساختار مهم پروژه

```text
src/index.ts                     Worker اصلی
migrations/                      D1 migrations
wrangler.jsonc                   تنظیم Worker و D1 binding
package.json                     دستورات Build/Deploy
README_FA.md                     راهنمای اصلی فارسی
docs/CLOUDFLARE_GIT_DEPLOY_FA.md راهنمای GitHub → Cloudflare
```

# ارتقا از v0.4

اگر قبلاً v0.4 را Deploy کرده‌ای، اتصال Git را روی همین Repo فعال کن و Deploy command را `npm run deploy:cloudflare` بگذار. D1 موجود باید به binding `DB` Worker وصل باشد. قبل از جایگزینی config روی پروژه Production، از D1 Backup بگیر.
