# تصنيف تعارضات `window.*` — المرحلة 1أ (2026-08-15)

مصدر البيانات: `/tmp/window-dup-report.txt` (144 اسم مشترك عبر أكثر من ملف)، بعد حذف الـ 53 ملف Stub في المرحلة 1ب.

**المنهجية:** لكل اسم، فحصت كل ملف من ملفاته هل يحتوي **تعريفاً محلياً حقيقياً** للاسم (`function NAME(...)`, `var NAME=function...`, `window.NAME=function...`) أو مجرد **إعادة تصدير** لاسم معرّف مسبقاً في نفس الملف (`window.NAME=NAME;` — نمط `publishLegacy`/الجسر القديم).

## النتيجة

| الفئة | العدد | الإجراء |
|---|---:|---|
| **شرعي متعمّد** — تعريف حقيقي واحد فقط، والباقي إعادة تصدير أو استدعاء | 131 | لا تُمس |
| **تعارض حقيقي** — تعريفان محليان حقيقيان أو أكثر لنفس اسم `window.*` | 13 | يحتاج تتبّع حي قبل أي حذف (المرحلة التالية) |

### الـ 13 حالة تعارض حقيقي (تحتاج تتبّع حي، لم يُحذف منها شيء بعد)

الفائز النظري = آخر ملف بترتيب التحميل في `main.js` (لا نضمن هذا فعلياً بدون تتبع حي — بعض هذي الدوال تُستدعى مشروطة بالدور/الصفحة، فالتعريف "الخاسر" نظرياً قد يكون هو الفعّال في مسار معيّن):

| الاسم | الملفات المعرّفة | الفائز النظري (آخر تحميل) |
|---|---|---|
| `MASTER_EFFECTIVE` | 49, 51 | 51-asdhealth-canonical-r6-32-20260727.js |
| `ccSavePharmacyResponse` | 52, 80 | 80-controlled-pharmacy-ui-redesign.js |
| `crashCloseReport` | 49, 80 | 80-controlled-pharmacy-ui-redesign.js |
| `ctlSetView` | 40, 80 | 80-controlled-pharmacy-ui-redesign.js |
| `ctlTabs` | 40, 80 | 80-controlled-pharmacy-ui-redesign.js |
| `fsR17MigrateMedicationIdentity` | 03, 40 | 40-v16-clean-optimized-script.js |
| `persistTransientUiState` | 31, 49 | 49-asdh-final-persistence-actions-20260725.js |
| `r17CrashExecuteBulk` | 49, 50 | 50-r617-integrated-operations.js |
| `refreshRequestCountLimitWarning` | 38, 49 | 49-asdh-final-persistence-actions-20260725.js |
| `renderControlled` | 40, 80 | 80-controlled-pharmacy-ui-redesign.js |
| `renderCrashOperations` | 50, 59 | 59-r664-security-complete-runtime.js |
| `restorePageTransientUi` | 31, 49 | 49-asdh-final-persistence-actions-20260725.js |
| `showPg` | 38, 65 | 65-r675-saas-subscriptions-runtime.js |

## تحديث بعد التتبّع الحي (2026-08-15، المتابعة)

`MASTER_EFFECTIVE` **أُزيلت من القائمة** — تبيّن أنها متغيّر حالة مشترك (`globalThis.MASTER_EFFECTIVE`) يُقرأ ويُكتب من ~15 ملف بالتصميم (نفس نمط `window.CU`)، مو تعريفي دالة متضاربين. خطأ في التصنيف الآلي الأول.

الـ12 المتبقية انقسمت فعليًا لثلاث مجموعات مختلفة تمامًا بعد التتبّع الحي:

### أ) wrapper-فوق-wrapper فعلي — **تم الحل** ✅

هذي مو "كود ميت" — كانت طبقات wrapper شغالة فعليًا بالتسلسل عند كل استدعاء، تخالف قاعدة "لا طبقة فوق طبقة". حُلّت بنفس منهجية `startApp` (مالك واحد + سجل امتدادات before/after)، وتحقّقت حيًا كل حالة بعد التوحيد:

| الاسم | الطبقات قبل | الحل |
|---|---|---|
| `persistTransientUiState` | 31 (أصل) ← 49 (wrapper) | مالك 31 + `__persistTransientUiExtensions` |
| `restorePageTransientUi` | 31 (أصل) ← 49 (wrapper) | مالك 31 + `__restorePageTransientUiExtensions` |
| `refreshRequestCountLimitWarning` | 38 (أصل) ← 49 (wrapper) | مالك 38 + `__refreshRequestCountLimitWarningBeforeExtensions`/`...Extensions` |
| `refreshRequestScheduleMessage` (اكتُشفت أثناء العمل، نفس النمط) | 42 (أصل) ← 49 (wrapper) | مالك 42 + `__refreshRequestScheduleMessageExtensions` |
| `r17CrashExecuteBulk` | 50 (أصل) ← 49 (wrapper) | مالك 50 + `__r17CrashExecuteBulkBeforeExtensions`/`...Extensions` |
| `renderCrashOperations` | 50 (أصل) ← 52 (`wrapCrashRender`) ← 59 (wrapper مباشر) — **3 طبقات** | مالك 50 (`renderCrashOperationsCore` + wrapper رفيع) + `__renderCrashOperationsAfterExtensions` |
| `renderCrashCarts` (اكتُشفت أثناء العمل عبر `wrapCrashRender`، لم تكن بالقائمة الأصلية لأن `window[name]=wrapped` الديناميكي ما يطابقه الفحص الثابت) | 44 (أصل) ← 52 (`wrapCrashRender`) | مالك 44 + `__renderCrashCartsAfterExtensions` (داخل `after()` الموجودة أصلاً) |
| `showPg` | 38 (أصل) ← 52 (`wrapCrashRender`) ← 65 (`wrapNavigation`) — **3 طبقات، آخرها قادر على حجب التنقّل بالكامل** | مالك 38 (`showPgCore` + wrapper رفيع بسجلّي guards قبل وafter بعد) |

`wrapCrashRender` في module 52 كانت آلية عامة تكرّر نفسها لثلاثة أسماء (`renderCrashCarts`, `renderCrashOperations`, `showPg`) — استُبدلت بثلاث دفعات إلى السجلات الجديدة مباشرة.

**تحقّق مباشرة عبر المتصفح لكل حالة:** الـ before/after hooks تُطلق بالترتيب الصحيح، الحارس (`__showPgGuards`) يوقف التنقّل ويمنع تشغيل after-hooks عند الحجب (تطابق تام مع سلوك الـ3 طبقات القديمة)، ولا تكرار تسجيل رغم `setInterval` كل 1200ms (حارس `navigationWrapped` محفوظ). `npm run verify` و`test:ui` (82/82) ناجحين بعد كل تعديل.

**إصلاح جانبي أثناء العمل:** wrapper `crashCloseReport` في module 49 كان مؤكّد ميتًا بترتيب التحميل (تحقيق سابق `TRACE_COMPENSATION_NOTICE_DUP.md`) — حُذف نهائيًا بدل تركه كـ"كود ميت موسوم".

### ب) "آخر ملف يفوز، تعريف واحد ميت فعلاً"

| الاسم | الملفات | الحالة |
|---|---|---|
| `ccSavePharmacyResponse` | 52 (ميت)، 80 (فعلي) | **حُذف** ✅ — 52 كان يلتقط `_orig=window.ccSavePharmacyResponse` قبل أي تعريف (undefined وقتها)، و80 يستبدلها كليًا بدون `_orig.apply` — تأكيد حي أن الحذف آمن. |
| `crashCloseReport` | 49 (ميت)، 80 (فعلي) | **حُذف مسبقًا** ✅ (ضمن commit d5af4d1) |
| `renderControlled` | 40، 80 | **لم يُحذف — كان خطأ** ⚠️ محاولة حذف نسخة 40 كسرت التطبيق: 80 لا يستبدلها، بل تلتقطها كـ`_orig` وتستدعيها فعليًا (`_orig.apply(this,arguments)`). نسخة 40 هي المنطق الحقيقي؛ 80 مجرد طبقة إضافات فوقها (analytics view + stat cards). أُعيدت فورًا، اكتشفها اختبار `ui-actions-regression.test.js`. |
| `ctlTabs` | 40، 80 | **لم يُحذف — كان خطأ** ⚠️ 80 يستبدلها فعلاً بالكامل، لكن روتين الترقيع في 80 (`tryPatch`) يفحص `if(!window.ctlTabs||!window.renderControlled)` كبوابة جاهزية قبل ما يشتغل — حذف نسخة 40 عطّل البوابة للأبد فما صار أي ترقيع من 80 يشتغل إطلاقًا (لا `ctlTabs` الحقيقية ولا `renderControlled` المغلّفة). أُعيدت فورًا. |

**درس مهم:** الفحص الآلي (تحديد "تعريف حقيقي" عبر regex) لا يكفي لتحديد "الخاسر الميت بأمان" — لازم تتبّع حي **بعد** كل حذف مقترح، لأن نمط `_orig=window.X; ...; _orig.apply(...)` (التفاف حقيقي) ونمط "بوابة جاهزية تنتظر وجود X" كلاهما غير مرئي لفحص نصي بسيط، وكلاهما يكسر التطبيق بصمت لو حُذف الطرف الخاطئ.

### ج) يحتاج قرار المستخدم — **لم يُحسم بعد**

| الاسم | الملاحظة |
|---|---|
| `fsR17MigrateMedicationIdentity` | وحدة 03 فيها منطق ترحيل حقيقي، ووحدة 40 تكتبه فوقها بدالة معطّلة نهائيًا (`return {status:'disabled-on-login'}`). هل تعطيل متعمّد (الترحيل خلص مرة وحدة) أم خطأ؟ |
| `ctlSetView` | وحدة 80 تفوز، لكن فقدت استدعاء `normalizeViewC(v)` الموجود بنسخة 40. هل التطبيع مهم؟ |
