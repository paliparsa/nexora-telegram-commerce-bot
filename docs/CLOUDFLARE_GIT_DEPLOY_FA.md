# نصب 100٪ ابری: GitHub → Cloudflare Workers

این روش هیچ Node.js، Wrangler یا ترمینالی روی کامپیوتر شما لازم ندارد.

## 1) پروژه را در GitHub آپلود کن
1. در GitHub یک Repository جدید بساز، مثلاً `nexora-telegram-commerce-bot`.
2. محتویات پروژه را در ریشه Repo آپلود کن؛ `package.json` و `wrangler.jsonc` باید مستقیم در ریشه باشند.
3. Commit کن.

## 2) Repo را به Cloudflare وصل کن
1. Cloudflare Dashboard → **Workers & Pages**.
2. **Create application** → **Import a repository**.
3. GitHub را Connect کن و Repo را انتخاب کن.
4. Production branch: `main`
5. Root directory: `/`
6. Build command: خالی
7. Deploy command:

```text
npm run deploy:cloudflare
```

8. **Save and Deploy**.

Cloudflare خودش dependencyها را در محیط Build نصب می‌کند. Wrangler پروژه داخل همان محیط اجرا می‌شود. این پروژه از قابلیت automatic resource provisioning برای D1 استفاده می‌کند، بنابراین لازم نیست از سیستم خودت `wrangler d1 create` اجرا کنی.

Deploy command ابتدا Worker را Deploy می‌کند و سپس migrationهای D1 را روی دیتابیس Remote اعمال می‌کند.

> اگر اولین Build دقیقاً در مرحله migration شکست خورد، یک بار **Retry deployment** بزن. Worker و D1 از مرحله اول ساخته شده‌اند و Retry معمولاً migration را کامل می‌کند.

## 3) Variables و Secrets را داخل Cloudflare وارد کن
بعد از اولین Deploy برو به:

**Worker → Settings → Variables and Secrets**

### Secretها
- `BOT_TOKEN`
- `WEBHOOK_SECRET`
- `SETUP_SECRET`
- `ADMIN_WEB_PASSWORD`
- `ADMIN_SESSION_SECRET`
- `ETHERSCAN_API_KEY` اگر BEP20 فعال است
- `TRONGRID_API_KEY` اگر TRC20 فعال است
- `TONAPI_API_KEY` اگر TON فعال است

### Variables معمولی
- `BOT_USERNAME` — بدون `@`
- `ADMIN_IDS` — مثال: `123456789` یا `123,456`
- `PUBLIC_BASE_URL` — مثال: `https://nexora-commerce-bot.YOURSUBDOMAIN.workers.dev`
- `USDT_BEP20_WALLET`
- `USDT_BEP20_TOKEN` — `0x55d398326f99059fF775485246999027B3197955`
- `USDT_TRC20_WALLET`
- `USDT_TRC20_TOKEN` — `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t`
- `TON_WALLET`
- `TON_USD_RATE` — اختیاری، fallback نرخ دستی
- `ETHERSCAN_CHAIN_ID` — برای BSC مقدار `56`
- `CARD_NUMBER`
- `CARD_HOLDER`
- `CREDIT_USD_PRICE` — مثال `1`
- `REFERRAL_REWARD` — مثال `0.05`
- `INVOICE_EXPIRE_MINUTES` — مثال `30`

برای غیرفعال کردن یک شبکه، Wallet همان شبکه را خالی بگذار.

بعد از Save کردن تنظیمات، از بخش Deployments یک **Redeploy** بزن.

## 4) ثبت Webhook بدون ترمینال
اگر Worker URL این است:

```text
https://nexora-commerce-bot.example.workers.dev
```

مرورگر را باز کن و برو به:

```text
https://nexora-commerce-bot.example.workers.dev/setup-webhook?secret=YOUR_SETUP_SECRET
```

اگر پاسخ Telegram شامل `"ok": true` بود، Webhook ثبت شده است.

## 5) تست سلامت

```text
https://YOUR-WORKER.workers.dev/health
```

باید `ok: true` و `version: 0.5.0` ببینی.

سپس در تلگرام `/start` را بزن.

## 6) Web Admin

```text
https://YOUR-WORKER.workers.dev/admin-web
```

رمز ورود همان `ADMIN_WEB_PASSWORD` است.

## 7) Deployهای بعدی
از این به بعد هر Commit روی branch `main`:

```text
GitHub Commit / Push
        ↓
Cloudflare Workers Builds
        ↓
Worker Deploy
        ↓
D1 migrations apply
```

بنابراین روی کامپیوتر خودت هیچ Node.js، npm یا Wrangler لازم نیست.

## نکته امنیتی
هیچ‌وقت Bot Token، API Key، رمز Admin، Seed Phrase یا Private Key را داخل GitHub قرار نده. فقط آدرس عمومی Wallet در Variables قرار می‌گیرد. Secretها فقط در Cloudflare ذخیره شوند.
