# سوقي

تطبيق Expo جوّال عربي RTL لمنصة توريد وتصنيع بين الشركات (B2B) مع لوحة إدارة وخادم Express.

## البنية الحالية

- الشاشات والمسارات في `src/app/` باستخدام Expo Router.
- جلسة المستخدم والصلاحيات محفوظة محليًا عبر AsyncStorage، مع تجديد تلقائي لرموز الوصول.
- مخطط PostgreSQL في `prisma/schema.prisma` يغطي الحسابات والمؤسسات وطلبات العروض والعروض وأوامر الشراء.
- تحقق Zod لمدخلات API على الخادم، وReact Query لجلب بيانات الواجهة.
- مدير المنصة يراجع الحسابات والمؤسسات والاعتمادات والقطاعات وسجل التدقيق من `/admin`.

## تصور منصة التصنيع B2B

توجد مواصفات معمارية مستقلة لمنصة ويب متعددة القطاعات تربط المشترين بالمصانع في [docs/b2b-manufacturing-platform.md](docs/b2b-manufacturing-platform.md). الخادم الحالي يغطي المصادقة والصلاحيات وإدارة المنصة، بينما الوثيقة تصور معماري أوسع؛ لا يوجد دفع حقيقي أو تحقق مصانع خارجي.

خطة المنتج والتنفيذ ولوحات التحكم المستقبلية موثقة في [docs/souqi-platform-development-plan.md](docs/souqi-platform-development-plan.md). يتضمن PDF تصورات مستقبلية للوحات، وليست صورًا من التطبيق الحالي. لإعادة توليد الصور والملف شغّل `node scripts/generate-platform-mockups.mjs` ثم `node scripts/generate-platform-plan-pdf.mjs`؛ يتطلب ذلك Google Chrome مثبتًا.

## التشغيل

يتطلب Node.js وnpm:

على Windows، شغّل `start-platform.bat` لتهيئة الاعتماديات عند الحاجة ثم تشغيل نسخة الويب.

أو شغّل الأوامر يدويًا:

```bash
npm install
npm run typecheck
npm run web
```

لفتح خيارات Expo الأخرى أو استخدام Expo Go، شغّل `npm start` ثم امسح رمز QR أو اختر محاكي Android مهيأ.

## النشر على Vercel

ملف `vercel.json` في جذر المشروع يضبط البناء والمسارات:

- أمر البناء: `npm run build:vercel` (يمسح كاش Metro قبل `expo export -p web` لضمان حزمة JavaScript جديدة)
- مجلد الإخراج: `dist`
- إعادة كتابة كل مسارات الواجهة إلى `index.html` حتى تعمل روابط Expo Router المباشرة مثل `/dashboard` و`/admin`.
- دوال Vercel الموجودة في مجلد `api/` تخدم مسارات `/api/*` على نفس النطاق.

يضبط `.env.production` المتغير `EXPO_PUBLIC_API_URL=https://souqi-platform.vercel.app`، لذا لا حاجة إلى `localhost` أو إعداد CORS إضافي للواجهة المنشورة.

عند ربط المشروع بـ Vercel:

1. تأكد أن `Root Directory` يشير إلى جذر المشروع الذي يحتوي على `package.json` و`app.json`.
2. اترك `Framework Preset` على `Other`؛ الإعدادات موجودة في `vercel.json`.
3. بعد تعديل `vercel.json` أو ملفات `api/`، أعد النشر (Redeploy) وليس فقط إعادة البناء من الكاش.
4. تستبعد إعادة الكتابة مسارات `api/` و`_expo/` و`assets/` حتى تصل طلبات الواجهة والدوال إلى وجهتها الصحيحة.
5. للتحقق، افتح `/api/health`؛ يجب أن يعيد JSON، وتأكد أن hash حزمة JavaScript في `index.html` تغيّر عن النسخة القديمة `entry-a5281059f316960a847686dc72aa0593.js`.

دوال `api/` تستخدم حاليًا مخزنًا في الذاكرة عبر `server/memory-api.ts`؛ لذلك يعمل التسجيل وتسجيل الدخول فورًا، لكن البيانات تُعاد تهيئتها عند إعادة النشر أو إعادة تشغيل الدالة. للإنتاج الدائم، انشر خادم Express في `server/index.ts` مع PostgreSQL، ثم وجّه `EXPO_PUBLIC_API_URL` إلى عنوانه وأضف نطاق Vercel إلى `ALLOWED_ORIGINS`.

إذا ظهر `404 NOT_FOUND` مع معرّف مثل `bom1::...` فهذا يعني أن Vercel لم يجد ملف `index.html` الناتج، غالبًا بسبب ضبط مجلد إخراج خاطئ أو غياب إعادة كتابة SPA؛ تحقق من خطوات البناء في لوحة Vercel ثم أعد النشر.

## API والمصادقة وقاعدة البيانات

يوجد خادم تطوير Express في `server/index.ts`، ومخطط PostgreSQL في Prisma. حسابات منصة B2B محفوظة في `platform_accounts`. كلمات المرور تُجزّأ بـ bcrypt. رموز الوصول JWT تنتهي بعد 15 دقيقة، ورموز التحديد تُخزّن كـ hash في `refresh_tokens` وتدور لمدة 30 يومًا. الجلسة محفوظة محليًا عبر AsyncStorage، ويتم تجديد الرمز تلقائيًا عند انتهائه.

1. ثبّت Docker Desktop وابدأه، أو جهّز PostgreSQL 16. صورة Compose الحالية متوافقة.
2. انسخ `.env.example` إلى `.env` وغيّر `JWT_SECRET` إلى قيمة خاصة عشوائية لا تقل عن 32 حرفًا. كلمة مرور Compose المضمنة للتطوير المحلي فقط.
3. شغّل `npm run db:up` وانتظر جاهزية الحاوية. منفذ PostgreSQL داخل الحاوية هو `5432`، وهو معروض على المضيف بالمنفذ `5433` لتجنب التعارض مع أي PostgreSQL محلي، لذلك يجب أن يكون `DATABASE_URL` في `.env` على `127.0.0.1:5433`؛ استخدم `127.0.0.1` بدل `localhost` على Windows لتجنب محاولة IPv6.
4. شغّل `npm run db:generate` ثم `npm run db:migrate` لتطبيق الهجرات من دون إعادة ضبط أو حذف بيانات.
5. شغّل الخادم عبر `npm run api:dev` وتحقق من `http://localhost:4100/api/health`؛ المنفذ `4100` مستخدم في `API_PORT` و`EXPO_PUBLIC_API_URL` لأن `4000` قد يكون محجوزًا على Windows.
6. لإنشاء أول مدير منصة، أضف `ADMIN_EMAIL` و`ADMIN_PASSWORD` (12 حرفًا على الأقل) إلى `.env` ثم شغّل `npm run seed:admin`. لا تُبقِ كلمة مرور المدير في الإنتاج؛ غيّرها بعد أول دخول.
7. شغّل واجهة Expo Web باستخدام `npm run web`.

نقاط المصادقة: `POST /api/auth/register`، و`POST /api/auth/login`، و`POST /api/auth/refresh`، و`POST /api/auth/logout`، و`GET /api/auth/me` مع `Authorization: Bearer <token>`. يعرض `/api/auth/me` الدور والصلاحيات وعضويات المؤسسة. نقطة `GET /api/permissions` تعرض دليل الصلاحيات، ونقاط `/api/admin/*` مخصصة لمدير المنصة وتشمل الحسابات والمؤسسات والأعضاء والاعتماد والقطاعات وسجل التدقيق. افحص صحة اتصال DB من نقطة `/api/health`. التسجيل والدخول لا يبدآن قبل تطبيق الهجرات.

للتشغيل على هاتف فعلي، وجّه `EXPO_PUBLIC_API_URL` إلى عنوان LAN للحاسوب بدل `localhost`، وأضف أصل Expo إلى `ALLOWED_ORIGINS` ثم أعد تشغيل Expo. لا تستخدم القيم الافتراضية أو إعدادات التطوير في الإنتاج؛ يلزم تخزين أسرار، HTTPS، ومراجعة مدة الجلسات وصلاحيات المديرين قبل النشر العام.

تدفقات التوريد والعروض وأوامر الشراء والمراحل ما زالت تجريبية؛ الخادم يوفر المصادقة والصلاحيات وإدارة المنصة وتخزين البيانات، ولا يعني أن الدفع أو التنفيذ صار متصلًا بمزود خارجي.
