# ارتقا به Nexora v0.7.3 — Payment Diagnostics + BSC RPC Fallback

این نسخه migration جدید ندارد و مستقیماً روی v0.7.2 قابل جایگزینی است.

## تغییرات

- تست مستقل برای BEP20، TRC20، TON، کارت‌به‌کارت و Rate Engine.
- دکمه «تست همه روش‌ها» در پنل مدیریت تلگرام.
- تست‌های مشابه در Web Admin > Payments.
- تشخیص دقیق خطای Etherscan V2 شامل پیام واقعی provider.
- BEP20 دیگر فقط به Etherscan وابسته نیست؛ اگر Etherscan خطا بدهد، Scanner به BSC RPC fallback می‌رود.
- BSC RPC به صورت پیش‌فرض `https://bsc-dataseed.binance.org/` است و در صورت نیاز می‌توان با `BSC_RPC_URL` عوضش کرد.
- تست TRC20 اتصال واقعی TronGrid و Contract رسمی USDT را بررسی می‌کند.
- تست TON اتصال TonAPI، Wallet lookup و نرخ TON/USD را بررسی می‌کند.
- تست کارت‌به‌کارت شماره کارت و نام صاحب کارت و Feature flag را بررسی می‌کند.
- تست Rate Engine اتصال CoinGecko و Frankfurter و نرخ دستی USD/IRR را نشان می‌دهد.

## نصب

1. فایل‌های این ZIP را روی Repo فعلی جایگزین کن.
2. `wrangler.jsonc` فعلی خودت را نگه دار.
3. Commit/Push کن تا Cloudflare خودکار Deploy کند.
4. متغیر جدید `BSC_RPC_URL` اختیاری است. اگر نسازی، مقدار پیش‌فرض استفاده می‌شود.
5. بعد از Deploy از Telegram Admin برو: `تنظیمات پرداخت > تست همه روش‌ها`.
6. یا در Web Admin وارد Payments شو و روی «تست همه روش‌ها» بزن.

## نکته Etherscan

اگر Etherscan برای BSC به دلیل Plan/API Key جواب ندهد، نتیجه تست پیام واقعی Etherscan را نشان می‌دهد. در همان تست وضعیت BSC RPC fallback هم نمایش داده می‌شود. اگر RPC سبز باشد، BEP20 Scanner می‌تواند از fallback استفاده کند.
