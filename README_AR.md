# ASDHealth FloorStock R6.72.1 Modular Protected

هذه الحزمة مجهزة لمستودع `asmd2268/floorstock` مع الحفاظ على Cloud Functions الحالية وإضافة دعم الأدوار الجديدة.

## البنية

- `public/index.html`: ملف Firebase Hosting.
- `public/assets/js/main.js`: مدخل ES Modules الوحيد للتطبيق.
- `public/assets/js/modules/`: وحدات الميزات المستوردة بالترتيب التشغيلي.
- `public/assets/js/core/legacy-registry.js`: جسر توافق محدود للواجهات المشتركة القديمة.
- `public/assets/js/core/dom-bindings.js`: ربط أحداث DOM دون `onclick` أو معالجات مضمنة في HTML.
- `public/assets/`: ملفات CSS وJavaScript المقسمة.
- `index.html`: مدخل احتياطي للنشر من جذر GitHub؛ يستخدم نفس ملفات `public/assets` ولا يكرر JavaScript أو CSS.
- `functions/`: دوال إدارة المستخدمين ومسار الاستلام والتسليم المؤقت لـMedication Accountability.
- `firestore.rules`: قواعد Firestore المقيدة حسب الدور والمفتاح.
- `firestore.indexes.json`: إعدادات الفهارس.
- `firebase.json`: Hosting + Firestore + Functions.

## الأدوار المدعومة عند إنشاء المستخدم

- `pharmacy`
- `pharmacy_staff`
- `inpatient_supervisor`
- `department`
- `controlled_pharmacy`
- `warehouse`
- `custodian` (يُحفظ كـ `department` مع `controlledCustodian=true`)

## النشر

```bash
firebase use floorstock-6ac2d
cd functions && npm install && cd ..
firebase deploy --only firestore:rules,firestore:indexes,functions,hosting
```

لا تنشر قبل اختبار فرع المعاينة أو نسخة احتياطية من `main`.

## تحقق سريع

```bash
python3 verify_repo.py
npm install
npm run verify:modules
node --check functions/index.js
```

## ملاحظات أمنية متبقية

- التطبيق يُحمّل من مدخل ES Module واحد ويستخدم `import`/`export`. أزيلت 214 معالجات أحداث ثابتة من HTML. بقي جسر توافق للوظائف التي تنشئ عناصر ديناميكية وتحتاج API عامة مؤقتًا.
- ما زالت سياسة الأنماط تحتاج `style-src 'unsafe-inline'` بسبب كثرة خصائص `style` المضمنة. أما سكربت التطبيق نفسه فلم يعد يعتمد على `onclick` ثابت داخل HTML.
- جميع المستخدمين النشطين يستطيعون قراءة مستندات `floorstock_state` لأن التطبيق الحالي يحمّل لقطة الحالة كاملة. الكتابة مقيدة حسب الدور والمفتاح، لكن فصل القراءة بدقة يحتاج ترحيل البيانات إلى مجموعات ومستندات مستقلة.
- رابط QR العام مقصود أن يعمل دون تسجيل دخول؛ البيانات المنشورة جرى تقليلها، لكن أي مستند عام معروف المعرّف يظل قابلاً للقراءة.


## تحديث R6.72.1

راجع `FIXES_R6.71_AR.md` لتفاصيل توحيد صلاحيات مشرف صيدلية التنويم وآلية التأكيد المزدوج عبر QR المؤقت.
