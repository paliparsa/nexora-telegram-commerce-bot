# Security Notes — v0.6

این نسخه برای رفع موارد امنیتی شناسایی‌شده در v0.5 است.

## اصلاح‌شده

1. Webhook forgery → `WEBHOOK_SECRET` اجباری و fail-closed.
2. Double-spend / stock race → خرید با D1 batch + guard constraint اتمیک.
3. Discount race → redemption اتمیک و unique برای هر Order.
4. Admin brute force → D1-backed login throttling؛ 5 تلاش در پنجره 15 دقیقه‌ای، block موقت 30 دقیقه‌ای.
5. Setup secret leakage → Setup فقط POST؛ GET فقط فرم امن.
6. Stock plaintext → AES-GCM application-level encryption.
7. Invoice IDOR → QR/check به Telegram owner محدود شده.
8. Predictable IDs → CSPRNG.
9. Payment replay/time → unique tx hash + timestamp/confirmation check.
10. Multiple wallet scanning → group by network + destination.
11. Admin sessions → opaque random tokens در D1، انقضا 12h، revoke در logout.
12. CSRF / clickjacking → CSRF token + SameSite + CSP + frame denial.
13. Admin input validation → Wallet/Join URL/Card/Discount/Product limits.
14. Health fingerprinting → فقط `{\"ok\":true}`.
15. Refund consistency → refund + ledger credit در transaction batch.

## STOCK_ENCRYPTION_KEY

این Secret کلید اصلی رمزنگاری inventory است. مقدار واقعی هرگز در GitHub ذخیره نشود. کد با SHA-256 از Secret یک AES-256 key مشتق می‌کند و برای هر Stock یک IV تصادفی 96-bit تولید می‌کند؛ ciphertext با prefix `enc:v1:` در D1 ذخیره می‌شود.

## محدودیت مهم

این نسخه Rate Limit را در خود D1 انجام می‌دهد. برای پنل بسیار حساس، Cloudflare Access/WAF یک لایه دفاعی اضافه و توصیه‌شده است، ولی برای اجرای v0.6 اجباری نیست.
