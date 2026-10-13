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
('لینک فعال‌سازی', '🎉 سفارش شما آماده است.' || char(10) || char(10) || '🔗 لینک فعال‌سازی:' || char(10) || '{stock_value}' || char(10) || char(10) || 'لطفاً لینک را طبق توضیحات محصول استفاده کنید.', 'قالب آماده برای لینک'),
('اکانت / ورود', '🎉 اطلاعات ورود شما آماده است.' || char(10) || char(10) || '👤 اطلاعات اکانت:' || char(10) || '{stock_value}' || char(10) || char(10) || '⚠️ در اولین فرصت اطلاعات امنیتی را طبق توضیحات محصول بررسی کنید.', 'قالب آماده برای اطلاعات ورود'),
('کد / لایسنس', '🎉 سفارش شما آماده است.' || char(10) || char(10) || '🔑 کد تحویل:' || char(10) || '{stock_value}' || char(10) || char(10) || 'این کد را نزد خود نگه دارید.', 'قالب آماده برای کد یا لایسنس');
