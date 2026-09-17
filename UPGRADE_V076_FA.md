# ارتقا به Nexora v0.7.6 — BEP20 RPC-first + Contract Introspection

این نسخه migration جدید ندارد و روی v0.7.5 قابل جایگزینی است.

## تغییرات اصلی

- تست واقعی BEP20 دیگر شرط اجباری برای فعال‌کردن LIVE نیست. ادمین هر زمان بخواهد می‌تواند TEST/LIVE را تغییر دهد.
- اگر تست واقعی انجام نشده باشد فقط هشدار نمایش داده می‌شود.
- Scanner اصلی BEP20 اکنون ابتدا از BSC RPC استفاده می‌کند و Etherscan فقط fallback/diagnostic است.
- Contract تنظیم‌شده دیگر فقط با یک مقدار hard-code مقایسه نمی‌شود؛ آدرس `USDT_BEP20_TOKEN` دقیقاً همان whitelist مورد استفاده Scanner است.
- تست BEP20 با RPC این موارد را بررسی می‌کند:
  - `eth_chainId` = 56
  - `eth_getCode` برای وجود واقعی Contract
  - `symbol()` = USDT
  - `decimals()` معتبر
- اگر Contract با آدرس پیشنهادی پروژه فرق داشته باشد، بات آن را به‌عنوان Custom Contract هشدار می‌دهد، اما در صورت عبور از بررسی on-chain به‌صورت اجباری قفل نمی‌کند.
- محاسبه Amount در Scanner بر اساس decimals واقعی Contract انجام می‌شود.
- `eth_getLogs` برای RPCهایی که محدوده بزرگ را قبول نمی‌کنند به صورت chunked fallback اجرا می‌شود.

## نصب

فایل‌های این نسخه را روی Repo فعلی جایگزین و Commit کنید. `wrangler.jsonc` فعلی خودتان را نگه دارید.

بعد از Deploy:

1. وارد Admin شوید.
2. Financial & Payments → Payment Tests را باز کنید.
3. تست BEP20 را بزنید.
4. خط `Contract on-chain` باید وضعیت `symbol=USDT` و `decimals=...` را نشان دهد.
5. TEST/LIVE کاملاً در اختیار ادمین است.

## نکته امنیتی

بات فقط Transferهای همان Contract تنظیم‌شده در `USDT_BEP20_TOKEN` را قبول می‌کند. بررسی `symbol=USDT` به‌تنهایی اثبات رسمی بودن توکن نیست؛ اگر Custom Contract وارد می‌کنید، صحت آدرس آن همچنان مسئولیت ادمین است.
