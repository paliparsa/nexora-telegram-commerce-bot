# ارتقا Nexora به v0.7.1 — BEP20 Hardened Scanner

این آپدیت migration جدید ندارد و `wrangler.jsonc` را تغییر نمی‌دهد. بنابراین Database ID فعلی تو دست‌نخورده می‌ماند.

## چه چیزی تغییر کرده؟

- اسکن BEP20 فقط روی BNB Smart Chain Mainnet با Chain ID `56` انجام می‌شود.
- فقط قرارداد USDT زیر پذیرفته می‌شود:

```text
0x55d398326f99059fF775485246999027B3197955
```

- نتیجه API دوباره از نظر `contractAddress`، آدرس مقصد، block number و خطای تراکنش بررسی می‌شود.
- حداقل confirmation پیش‌فرض BEP20 از 3 به 5 افزایش یافته است.
- تراکنش قبل از زمان ساخت Invoice پذیرفته نمی‌شود.
- BEP20 به‌صورت پیش‌فرض در **Test Mode** قرار دارد.
- در Test Mode فقط ادمین گزینه BEP20 را می‌بیند؛ تراکنش واقعی شناسایی می‌شود ولی Credit خودکار اضافه نمی‌شود.
- بعد از تست موفق، ادمین می‌تواند BEP20 را از داخل Telegram Admin یا Web Admin روی Live بگذارد.
- اگر Contract، Chain ID، Wallet یا API Key اشتباه باشد، BEP20 اصلاً آماده/نمایش داده نمی‌شود.
- Salt مبلغ Invoice از `crypto.getRandomValues()` استفاده می‌کند.

## متغیرهای Cloudflare

این مقادیر را بررسی کن:

```text
ETHERSCAN_CHAIN_ID=56
USDT_BEP20_TOKEN=0x55d398326f99059fF775485246999027B3197955
USDT_BEP20_WALLET=0xYOUR_BSC_WALLET
ETHERSCAN_API_KEY=YOUR_ETHERSCAN_API_KEY
```

`USDT_BEP20_TOKEN` اگر وارد نشده باشد، v0.7.1 به‌صورت داخلی همین Contract را استفاده می‌کند. اگر مقدار متفاوتی وارد شود، BEP20 به دلیل whitelist آماده نمی‌شود.

## روش تست امن

1. فایل‌های این ZIP را روی Repo فعلی Replace کن و Commit بزن.
2. صبر کن Cloudflare Build کامل شود.
3. وارد بات با اکانت ادمین شو.
4. برو به `🛠 مدیریت → 💳 تنظیمات پرداخت`.
5. روی `🔎 بررسی تنظیم BEP20` بزن؛ همه موارد باید OK باشند.
6. مطمئن شو وضعیت BEP20 روی `🧪 تست` است.
7. از اکانت ادمین یک Invoice کوچک BEP20 بساز.
8. مبلغ دقیق Invoice را با USDT روی BSC به Wallet خودت بفرست.
9. بعد از حداقل 5 confirmation، Scanner باید پیام `تست BEP20 موفق بود` را به ادمین بدهد، ولی Credit را اضافه نکند.
10. بعد از اطمینان، در تنظیمات پرداخت روی `BEP20: تست` بزن تا حالت واقعی فعال شود.
11. از این لحظه BEP20 برای کاربران عادی هم نمایش داده می‌شود و پرداخت صحیح به‌صورت خودکار Credit می‌شود.

## اگر Ready = NO بود

- Wallet: باید `0x` + 40 کاراکتر hex باشد.
- Contract: باید دقیقاً Contract whitelist بالا باشد.
- Chain: باید `56` باشد.
- API key: باید `ETHERSCAN_API_KEY` در Cloudflare موجود باشد.
- Feature: BEP20 باید در پنل روشن باشد.

## نکته مهم

Private key یا seed phrase کیف پول را هیچ‌وقت داخل Worker، GitHub یا Cloudflare وارد نکن. Scanner فقط تراکنش‌های عمومی بلاکچین را می‌خواند.
