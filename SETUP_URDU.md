# AQK Library Online System — آسان اردو ہدایات

## اہم بات
یہ ZIP آپ کے GitHub/Cloudflare Pages پروجیکٹ کے لیے نئی فائلیں ہے۔ صرف ZIP ڈاؤن لوڈ کرنے سے موجودہ لائیو ویب سائٹ خود تبدیل نہیں ہوگی۔ پہلے اپنی GitHub repository کا backup بنائیں۔

## مرحلہ 1: D1 Database بنائیں
1. Cloudflare میں Login کریں۔
2. **Storage & databases → D1 SQL Database** کھولیں۔
3. `aqk-library-db` نام کا Database بنائیں۔
4. Database کا Console کھولیں۔
5. اس ZIP میں `migrations/0001_initial.sql` فائل کھولیں، اس کا پورا SQL متن Copy کریں، D1 Console میں Paste کریں اور Run کریں۔
6. Query کامیاب ہو تو پانچ ابتدائی Library records اور ضروری Tables بن جائیں گے۔

## مرحلہ 2: Database کو Pages ویب سائٹ کے ساتھ جوڑیں
1. **Workers & Pages** کھولیں۔
2. اپنا موجودہ `library-management-eic` Pages پروجیکٹ کھولیں۔
3. **Settings → Functions → D1 database bindings** میں جائیں۔
4. Binding بنائیں: Variable name لازماً `DB` رکھیں، اور Database میں `aqk-library-db` منتخب کریں۔
5. Save کریں۔

## مرحلہ 3: Setup Secret بنائیں
1. اسی Pages پروجیکٹ میں **Settings → Variables and Secrets** کھولیں۔
2. `AQK_SETUP_KEY` نام کا encrypted/secret variable بنائیں۔
3. اس میں اپنا لمبا random secret رکھیں۔ یہ کسی کو نہ بھیجیں، GitHub میں نہ لکھیں، اور `public` فولڈر میں نہ رکھیں۔
4. Save کریں اور نئی deployment کروائیں۔

## مرحلہ 4: GitHub میں نئی فائلیں ڈالیں
1. اس ZIP کو کمپیوٹر میں Download کرکے **Extract All** کریں۔
2. اپنی GitHub repository `adiiaqk602-droid/library-management` کھولیں۔ پہلے repository کا backup ضرور بنائیں۔
3. نئی فائلیں repository میں اسی ترتیب سے Upload/Replace کریں: `public`، `functions`، `migrations` اور README فائلیں۔ `functions` فولڈر کو `public` کے اندر نہ رکھیں؛ یہ repository کے Root میں ہونا چاہیے۔
4. Commit changes کریں۔ Cloudflare Pages کو نئی deployment شروع کرنی چاہیے۔
5. Pages کی Build settings میں output directory `public` ہو؛ اس سادہ HTML/Functions پروجیکٹ کے لیے build command درکار نہیں۔

## مرحلہ 5: پہلا Super Admin بنائیں
1. نئی deployment مکمل ہونے کے بعد اپنی ویب سائٹ کھولیں۔
2. اگر D1 binding اور SQL درست ہیں تو `Initial Super Admin Setup` فارم نظر آئے گا۔
3. `AQK_SETUP_KEY` میں وہی secret لکھیں جو Cloudflare میں رکھا تھا۔ پھر Admin کا نام، Email اور کم از کم 12 حروف کا مضبوط Password لکھیں۔
4. Super Admin بننے کے بعد Login کریں۔ پہلا Admin بنانے والا Setup راستہ خود بند ہو جاتا ہے۔

## مرحلہ 6: پانچ Librarian اکاؤنٹس
Super Admin کے طور پر Login کریں، `Librarian Accounts` میں جائیں، ہر Library کے لیے الگ Librarian بنائیں اور مضبوط الگ Password دیں۔ ہر Librarian کو صرف اپنی Library کا ڈیٹا نظر آنا چاہیے۔ اسے دوسرے اکاؤنٹ سے بھی Test کریں۔

## اگر Error آئے
- `/api/health` کھولیں؛ `ok: true` اور `database: true` آنا چاہیے۔
- `D1 binding DB is missing` آئے تو مرحلہ 2 دوبارہ دیکھیں۔
- `AQK_SETUP_KEY` not configured آئے تو مرحلہ 3 اور redeploy چیک کریں۔
- `API route not found` یا پرانی Supabase والی اسکرین آئے تو GitHub Commit اور Cloudflare deployment status چیک کریں۔

## حفاظت
پہلے test records سے تمام کام چیک کریں۔ اصل کتابوں/طلبہ کا ڈیٹا داخل کرنے سے پہلے backup بنائیں۔ Password یا setup secret کسی کے ساتھ Share نہ کریں۔
