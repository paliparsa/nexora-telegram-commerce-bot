PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS delivery_template_presets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  template_text TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO delivery_template_presets(name, template_text, description) VALUES
('لینک فعال‌سازی', '🎉 سفارش شما آماده است.\n\n🔗 لینک فعال‌سازی:\n{stock_value}\n\nلطفاً لینک را طبق توضیحات محصول استفاده کنید.', 'قالب آماده برای لینک'),
('اکانت / ورود', '🎉 اطلاعات ورود شما آماده است.\n\n👤 اطلاعات اکانت:\n{stock_value}\n\n⚠️ در اولین فرصت اطلاعات امنیتی را طبق توضیحات محصول بررسی کنید.', 'قالب آماده برای اطلاعات ورود'),
('کد / لایسنس', '🎉 سفارش شما آماده است.\n\n🔑 کد تحویل:\n{stock_value}\n\nاین کد را نزد خود نگه دارید.', 'قالب آماده برای کد یا لایسنس');
