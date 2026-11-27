# أثر — ختمة قرآنية جماعية

موقع عربي RTL لتنظيم حجز أجزاء ختمة قرآنية جماعية، مع قاعدة بيانات PostgreSQL على Neon وواجهات API تعمل على Vercel. تُحدّث حالة الحجوزات تلقائيًا لدى الزوار كل 5 ثوانٍ.

## البنية
- React + Vite للواجهة.
- Vercel Serverless Functions تحت `api/`.
- Neon PostgreSQL لتخزين الحجوزات.
- لا توجد مفاتيح قاعدة بيانات في المتصفح؛ `DATABASE_URL` سرّ خادمي فقط.

## قاعدة البيانات
نفّذ محتوى `neon/schema.sql` مرة واحدة على قاعدة بيانات Neon باسم `athar`، باستخدام SQL Editor أو اتصال PostgreSQL.

## متغيرات البيئة
أضف المتغير التالي في Vercel لكل من Production وPreview وDevelopment عند الحاجة:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require
```

لا تضع قيمة `DATABASE_URL` في ملفات الواجهة أو GitHub أو أي ملف يبدأ بـ `VITE_`.

## التشغيل محليًا
```bash
npm install
cp .env.example .env.local
# أضف DATABASE_URL إلى .env.local
npm run dev
```

للتشغيل المحلي مع واجهات Vercel API استخدم Vercel CLI:
```bash
npx vercel dev
```

## النشر على Vercel
- Framework: Vite
- Build command: `npm run build`
- Output directory: `dist`
- Install command: `npm install`
- أضف `DATABASE_URL` كمتغير بيئة مشفر (Sensitive/Encrypted) ولا تعرضه للواجهة.

## GitHub
ارفع ملفات المشروع إلى مستودع خاص أو عام حسب رغبتك، مع التأكد من عدم رفع `.env.local` أو أي أسرار. اربط المستودع بمشروع Vercel لتفعيل النشر التلقائي عند كل Push.

## الأمان والحدود الحالية
- حجز الجزء محمي بقيد فريد في PostgreSQL، لذلك لا يمكن حجز الجزء نفسه مرتين بالتزامن.
- لا يمكن للمتصفح قراءة `token_hash` أو تعديل الجدول مباشرة؛ التغييرات تمر عبر API الخادم ودوال SQL.
- رمز التأكيد عشوائي ومحفوظ محليًا في متصفح صاحب الحجز. مسح بيانات المتصفح أو تغيير الجهاز يعني فقدان إمكانية تأكيد الحجز الحالي.
- الأسماء المعروضة عامة؛ يُفضّل استخدام الاسم الأول أو اسم مختصر، وعدم إدخال أرقام هواتف أو بيانات حساسة.
- لا توجد مصادقة هوية أو لوحة إشراف حاليًا؛ الموقع مبادرة تطوعية مستقلة وليس جهة رسمية أو فتوى دينية.
