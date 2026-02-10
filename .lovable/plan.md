
# خطة نسخ مشروع Outlook Genie

## ملخص
نسخ مشروع نظام إدارة مكتب المحاماة المغربي من مستودع GitHub إلى هذا المشروع على مراحل.

## المرحلة 1: البنية الأساسية
- تحديث `src/index.css` بألوان المشروع الأصلي، خط IBM Plex Sans Arabic، اتجاه RTL، وأنماط TipTap Editor
- إنشاء `src/integrations/supabase/client.ts` (يستخدم نفس متغيرات البيئة الموجودة)
- إنشاء `src/hooks/useAuth.tsx` مع AuthProvider وAuthContext (يدعم 5 أدوار: director, partner, clerk, content_writer, client)
- إنشاء `src/hooks/usePageTracking.ts`
- إنشاء `src/components/ProtectedRoute.tsx`

## المرحلة 2: الصفحات العامة
- إنشاء `src/pages/Index.tsx` - الصفحة الرئيسية مع عرض الميزات والأدوات العامة والنشرة البريدية
- إنشاء `src/pages/Auth.tsx` - تسجيل الدخول وإنشاء الحساب
- إنشاء `src/pages/Blog.tsx` و `src/pages/BlogArticle.tsx`
- إنشاء `src/pages/LegalFeeCalculator.tsx` - حاسبة الرسوم القضائية
- إنشاء `src/pages/CaseTracker.tsx` - تتبع القضايا
- إنشاء `src/pages/AIConsultation.tsx` - الاستشارة الذكية

## المرحلة 3: لوحة التحكم
- إنشاء `src/components/DashboardSidebar.tsx` و `src/components/RoleGuard.tsx`
- إنشاء `src/pages/Dashboard.tsx` مع المسارات الفرعية
- إنشاء صفحات لوحة التحكم: DashboardHome, Cases, Clients, Articles, Finance, Analytics, Settings, Profile, UserManagement, Newsletter, Reports, SeoSettings, AuditLog, ClientDashboard

## المرحلة 4: المكونات والهوكس المساعدة
- إنشاء `src/hooks/useArticles.ts`
- إنشاء مكونات المقالات والمدونة والمالية ولوحة التحكم
- تحديث `src/App.tsx` بجميع المسارات والـ Providers (HelmetProvider, AuthProvider)

## ملاحظات مهمة
- **قاعدة البيانات**: نسخ الكود لا ينسخ جداول Supabase. ستحتاج إلى إنشاء الجداول (user_roles, profiles, إلخ) بشكل منفصل
- **كل مرحلة تحتاج 2-3 رسائل** تقريباً بسبب حجم الملفات
- سيتم البدء بالمرحلة 1 فوراً عند الموافقة

---

## التفاصيل التقنية

### الملفات المطلوب إنشاؤها (حسب الأولوية)

**المرحلة 1 (5 ملفات)**:
1. `src/index.css` - تحديث (ألوان، خطوط، RTL، TipTap styles)
2. `src/integrations/supabase/client.ts` - عميل Supabase
3. `src/hooks/useAuth.tsx` - مصادقة + أدوار
4. `src/hooks/usePageTracking.ts` - تتبع الصفحات
5. `src/components/ProtectedRoute.tsx` - حماية المسارات

**المرحلة 2 (7 ملفات)**:
6-12. الصفحات العامة (Index, Auth, Blog, BlogArticle, LegalFeeCalculator, CaseTracker, AIConsultation)

**المرحلة 3 (16+ ملف)**:
13+. Dashboard, DashboardSidebar, RoleGuard, وجميع صفحات لوحة التحكم

**المرحلة 4 (5+ ملفات)**:
الهوكس والمكونات المساعدة + تحديث App.tsx النهائي

### المتغيرات البيئية
المشروع يستخدم نفس متغيرات Supabase الموجودة حالياً (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`)
