

# إصلاح خطأ version.json 404

## المشكلة
ملف `useVersionCheck.ts` يحاول جلب `version.json` من مستودع GitHub غير موجود (`aalilamebarki/Laweyrewith`), مما يسبب خطأ 404 متكرر كل 5 دقائق.

## الحل
تحديث رابط VERSION_URL ليشير إلى المستودع الصحيح `aalilamebarki/buddy-mail-magic-c9b09b8a`، أو تعطيل الفحص مؤقتاً حتى يتم إنشاء الملف.

## التغييرات
1. **تحديث `src/hooks/useVersionCheck.ts`**: تغيير `VERSION_URL` إلى المستودع الصحيح
2. **إنشاء `version.json`** في جذر المشروع (اختياري) ليتم دفعه مع الكود

## تفاصيل تقنية
- الملف: `src/hooks/useVersionCheck.ts` سطر 4
- تغيير URL من `aalilamebarki/Laweyrewith` إلى `aalilamebarki/buddy-mail-magic-c9b09b8a`

