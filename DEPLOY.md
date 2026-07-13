# نشر نسخة Blaze

المشروع: `floorstock-6ac2d`

## 1) تأكد من مستخدم Master
في Firestore يجب أن يكون المستند:

`users/wFfPz93UmENhuStee7PkxAi0NOI3`

ويحتوي:

- `active: true` (Boolean)
- `email: "almftres@hotmail.com"` (String)
- `master: true` (Boolean)
- `role: "pharmacy"` (String)

ويجب أن يطابق اسم المستند UID الموجود في Firebase Authentication.

## 2) تثبيت الاعتمادات والنشر
من Terminal، داخل هذا المجلد:

```bash
firebase login
firebase use floorstock-6ac2d
cd functions
npm install
cd ..
firebase deploy --only functions,firestore:rules
```

انتظر ظهور `Deploy complete!`.

## 3) رفع ملفات الواجهة
استبدل ملفات المستودع بهذه النسخة، بما فيها مجلد `functions`، ثم ارفعها إلى GitHub.

## 4) التحقق
سجل خروجًا ثم دخولًا بحساب `almftres@hotmail.com`، واعمل تحديثًا قويًا للصفحة (`Command + Shift + R`). يجب أن يظهر أعلى الصفحة:

`Pharmacy · Master`

ومن صفحة Users تستطيع إنشاء المستخدمين. الحذف النهائي ومنح Master يظهران للـMaster فقط.
