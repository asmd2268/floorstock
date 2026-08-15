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

**ملاحظة مهمة:** `crashCloseReport` كانت محور تحقيق سابق في هذي الجلسة (`TRACE_COMPENSATION_NOTICE_DUP.md`) — تأكد حينها أن تعريف الوحدة 49 **ميت فعلاً بترتيب التحميل** (module 49 يحمّل قبل module 80، والحارس `typeof originalClose==='function'` يفشل دائماً)، وليس تعارضاً نشطاً. يُرجّح أن نفس النمط ينطبق على بقية الأسماء المشتركة بين 49/80 و40/80 في هذي القائمة، لكن **كل حالة تحتاج تحقق منفصل** قبل الحذف — لا تُطبّق نفس الاستنتاج تلقائياً.

## الخطوة التالية (غير منفَّذة بعد)

لكل من الـ 13 اسم: تتبّع حي (`console.trace` مؤقت أو فحص عبر المتصفح لـ `window.NAME.toString()` بعد التحميل الكامل) لتأكيد الفائز الفعلي، ثم حذف التعريف الخاسر إذا تأكد أنه ميت بالكامل (لا يُستدعى مباشرة بالاسم المحلي غير `window.*` من داخل ملفه، ولا عبر `data-asdh-binding`).
