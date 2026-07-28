# ASDHealth FloorStock R6.65 Modular Protected

هذه الحزمة مجهزة لمستودع `asmd2268/floorstock` مع الحفاظ على Cloud Functions الحالية وإضافة دعم الأدوار الجديدة.

## البنية

- `public/index.html`: ملف Firebase Hosting.
- `public/assets/`: ملفات CSS وJavaScript المقسمة.
- `index.html`: مدخل احتياطي للنشر من جذر GitHub؛ يستخدم نفس ملفات `public/assets` ولا يكرر JavaScript أو CSS.
- `functions/`: دوال إدارة المستخدمين.
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
node --check functions/index.js
```

## ملاحظات أمنية متبقية

- التطبيق ما زال يستخدم Classic Scripts مع معالجات `onclick` مضمنة للمحافظة على التوافق؛ لذلك CSP لا يزال يحتاج `'unsafe-inline'`.
- جميع المستخدمين النشطين يستطيعون قراءة مستندات `floorstock_state` لأن التطبيق الحالي يحمّل لقطة الحالة كاملة. الكتابة مقيدة حسب الدور والمفتاح، لكن فصل القراءة بدقة يحتاج ترحيل البيانات إلى مجموعات ومستندات مستقلة.
- رابط QR العام مقصود أن يعمل دون تسجيل دخول؛ البيانات المنشورة جرى تقليلها، لكن أي مستند عام معروف المعرّف يظل قابلاً للقراءة.
