#!/usr/bin/env python3
"""
سكريبت جلب مواعيد الجلسات من بوابة محاكم (mahakim.ma) ومزامنتها مع النظام.

المتطلبات:
    pip install selenium webdriver-manager supabase python-dotenv

الاستخدام:
    # جلب جلسات ملف واحد
    python sync_mahakim.py --case-number "1/1611/2026" --court "المحكمة الابتدائية بالرباط"

    # جلب جلسات كل الملفات النشطة
    python sync_mahakim.py --all

    # وضع المعاينة (بدون حفظ)
    python sync_mahakim.py --all --dry-run
"""

import argparse
import json
import os
import sys
import time
from datetime import datetime

try:
    from selenium import webdriver
    from selenium.webdriver.chrome.service import Service
    from selenium.webdriver.chrome.options import Options
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait, Select
    from selenium.webdriver.support import expected_conditions as EC
    from webdriver_manager.chrome import ChromeDriverManager
except ImportError:
    print("❌ يرجى تثبيت المكتبات المطلوبة:")
    print("   pip install selenium webdriver-manager")
    sys.exit(1)

try:
    from supabase import create_client
except ImportError:
    print("❌ يرجى تثبيت مكتبة Supabase:")
    print("   pip install supabase")
    sys.exit(1)

from dotenv import load_dotenv
load_dotenv()

# ─── إعدادات Supabase ─────────────────────────────────────────────
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://kebtjgedbwqrdqdjoqze.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

if not SUPABASE_KEY:
    print("❌ SUPABASE_SERVICE_ROLE_KEY غير محدد في .env")
    sys.exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# ─── إعداد المتصفح ────────────────────────────────────────────────
MAHAKIM_URL = "https://www.mahakim.ma/#/suivi/dossier-suivi"


def create_driver(headless=True):
    """إنشاء متصفح Chrome."""
    options = Options()
    if headless:
        options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--window-size=1920,1080")
    options.add_argument("--lang=ar")
    
    service = Service(ChromeDriverManager().install())
    return webdriver.Chrome(service=service, options=options)


def parse_case_number(case_number: str):
    """
    تحليل رقم الملف إلى مكوناته.
    الصيغة المتوقعة: رقم/رمز/سنة  مثل: 1/1611/2026
    """
    parts = case_number.strip().split("/")
    if len(parts) == 3:
        return {
            "numero": parts[0].strip(),
            "code": parts[1].strip(),
            "annee": parts[2].strip(),
        }
    elif len(parts) == 2:
        return {
            "numero": parts[0].strip(),
            "code": "",
            "annee": parts[1].strip(),
        }
    else:
        return {"numero": case_number.strip(), "code": "", "annee": ""}


def fetch_sessions_from_mahakim(driver, case_number: str, court_name: str = None):
    """
    جلب بيانات الجلسات من mahakim.ma لملف معين.
    
    Returns:
        list[dict]: قائمة الجلسات المستخرجة
    """
    print(f"  🔍 البحث عن الملف: {case_number}")
    
    parsed = parse_case_number(case_number)
    
    driver.get(MAHAKIM_URL)
    wait = WebDriverWait(driver, 15)
    
    try:
        # انتظار تحميل الصفحة
        time.sleep(3)
        
        # إدخال رقم الملف
        numero_input = wait.until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "input[formcontrolname='numeroDossier'], input[placeholder*='رقم']"))
        )
        numero_input.clear()
        numero_input.send_keys(parsed["numero"])
        
        # إدخال رمز الملف
        if parsed["code"]:
            code_input = driver.find_element(By.CSS_SELECTOR, "input[formcontrolname='codeDossier'], input[placeholder*='رمز']")
            code_input.clear()
            code_input.send_keys(parsed["code"])
        
        # إدخال السنة
        if parsed["annee"]:
            annee_input = driver.find_element(By.CSS_SELECTOR, "input[formcontrolname='anneeDossier'], input[placeholder*='سنة']")
            annee_input.clear()
            annee_input.send_keys(parsed["annee"])
        
        time.sleep(2)
        
        # تفعيل البحث بالمحاكم الابتدائية إذا لزم الأمر
        try:
            checkbox = driver.find_element(By.CSS_SELECTOR, "input[type='checkbox']")
            if not checkbox.is_selected():
                checkbox.click()
                time.sleep(1)
        except Exception:
            pass
        
        # اختيار المحكمة إن أمكن
        if court_name:
            try:
                selects = driver.find_elements(By.CSS_SELECTOR, "select, p-dropdown")
                for sel in selects:
                    options = sel.find_elements(By.TAG_NAME, "option")
                    for opt in options:
                        if court_name in opt.text:
                            opt.click()
                            time.sleep(1)
                            break
            except Exception:
                pass
        
        # الضغط على زر البحث
        search_btn = wait.until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, "button[type='submit'], button.search-button"))
        )
        search_btn.click()
        
        # انتظار النتائج
        time.sleep(5)
        
        # استخراج بيانات الجلسات من الجدول
        sessions = []
        
        # البحث عن جداول النتائج
        tables = driver.find_elements(By.CSS_SELECTOR, "table, p-table")
        
        for table in tables:
            rows = table.find_elements(By.CSS_SELECTOR, "tbody tr")
            for row in rows:
                cells = row.find_elements(By.TAG_NAME, "td")
                if len(cells) >= 2:
                    session_info = {
                        "raw_data": [cell.text.strip() for cell in cells],
                    }
                    
                    # محاولة استخراج التاريخ
                    for cell in cells:
                        text = cell.text.strip()
                        # البحث عن تاريخ بصيغة dd/mm/yyyy أو yyyy-mm-dd
                        for fmt in ["%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y"]:
                            try:
                                date = datetime.strptime(text, fmt)
                                session_info["session_date"] = date.strftime("%Y-%m-%d")
                                break
                            except ValueError:
                                continue
                    
                    sessions.append(session_info)
        
        # إذا لم نجد جداول، نبحث عن عناصر أخرى
        if not sessions:
            # البحث عن أي عنصر يحتوي على تاريخ
            result_area = driver.find_elements(By.CSS_SELECTOR, ".result, .dossier-detail, .card-body, .p-datatable")
            for area in result_area:
                text = area.text
                if text.strip():
                    sessions.append({"raw_data": [text], "note": "محتوى غير مهيكل"})
        
        if sessions:
            print(f"  ✅ تم العثور على {len(sessions)} نتيجة")
        else:
            print(f"  ⚠️ لم يتم العثور على نتائج")
            # حفظ لقطة شاشة للتشخيص
            screenshot_path = f"mahakim_debug_{parsed['numero']}_{parsed['annee']}.png"
            driver.save_screenshot(screenshot_path)
            print(f"  📸 لقطة شاشة محفوظة: {screenshot_path}")
        
        return sessions
        
    except Exception as e:
        print(f"  ❌ خطأ أثناء البحث: {e}")
        screenshot_path = f"mahakim_error_{parsed['numero']}_{parsed['annee']}.png"
        try:
            driver.save_screenshot(screenshot_path)
            print(f"  📸 لقطة شاشة للخطأ: {screenshot_path}")
        except:
            pass
        return []


def get_active_cases():
    """جلب كل الملفات النشطة التي لديها رقم ملف."""
    result = supabase.table("cases").select(
        "id, title, case_number, court, status, client_id, clients(full_name)"
    ).neq("status", "archived").not_.is_("case_number", "null").neq("case_number", "").execute()
    
    return result.data or []


def sync_session_to_db(case_id: str, user_id: str, session_date: str, notes: str = None, dry_run: bool = False):
    """حفظ جلسة جديدة في قاعدة البيانات إذا لم تكن موجودة."""
    # التحقق من عدم وجود جلسة بنفس التاريخ
    existing = supabase.table("court_sessions").select("id").eq(
        "case_id", case_id
    ).eq("session_date", session_date).execute()
    
    if existing.data:
        print(f"    ⏭️ جلسة {session_date} موجودة مسبقاً")
        return False
    
    if dry_run:
        print(f"    🔍 [معاينة] سيتم إضافة جلسة بتاريخ {session_date}")
        return True
    
    supabase.table("court_sessions").insert({
        "case_id": case_id,
        "user_id": user_id,
        "session_date": session_date,
        "required_action": "تم الجلب من بوابة محاكم",
        "notes": notes or "تم الجلب تلقائياً من mahakim.ma",
        "status": "scheduled",
    }).execute()
    
    print(f"    ✅ تمت إضافة جلسة بتاريخ {session_date}")
    return True


def main():
    parser = argparse.ArgumentParser(description="مزامنة جلسات المحاكم من mahakim.ma")
    parser.add_argument("--case-number", help="رقم الملف (مثال: 1/1611/2026)")
    parser.add_argument("--court", help="اسم المحكمة")
    parser.add_argument("--case-id", help="معرف الملف في النظام (UUID)")
    parser.add_argument("--user-id", help="معرف المستخدم (UUID)")
    parser.add_argument("--all", action="store_true", help="جلب جلسات كل الملفات النشطة")
    parser.add_argument("--dry-run", action="store_true", help="معاينة فقط بدون حفظ")
    parser.add_argument("--visible", action="store_true", help="إظهار المتصفح (بدون headless)")
    
    args = parser.parse_args()
    
    if not args.case_number and not args.all:
        parser.print_help()
        print("\n❌ يرجى تحديد --case-number أو --all")
        sys.exit(1)
    
    print("=" * 60)
    print("🏛️  مزامنة جلسات بوابة محاكم (mahakim.ma)")
    print("=" * 60)
    
    driver = create_driver(headless=not args.visible)
    
    try:
        if args.all:
            cases = get_active_cases()
            print(f"\n📂 عدد الملفات النشطة: {len(cases)}")
            
            total_found = 0
            total_added = 0
            
            for i, case in enumerate(cases, 1):
                case_num = case.get("case_number", "")
                if not case_num:
                    continue
                
                client_name = case.get("clients", {}).get("full_name", "—") if case.get("clients") else "—"
                print(f"\n[{i}/{len(cases)}] 📁 {case['title']} — {client_name}")
                print(f"  رقم الملف: {case_num} | المحكمة: {case.get('court', '—')}")
                
                sessions = fetch_sessions_from_mahakim(driver, case_num, case.get("court"))
                total_found += len(sessions)
                
                for session in sessions:
                    if "session_date" in session:
                        # نحتاج user_id - نأخذه من أول جلسة موجودة أو من args
                        user_id = args.user_id
                        if not user_id:
                            existing_sessions = supabase.table("court_sessions").select("user_id").eq(
                                "case_id", case["id"]
                            ).limit(1).execute()
                            if existing_sessions.data:
                                user_id = existing_sessions.data[0]["user_id"]
                        
                        if user_id:
                            added = sync_session_to_db(
                                case["id"], user_id, session["session_date"],
                                dry_run=args.dry_run
                            )
                            if added:
                                total_added += 1
                        else:
                            print(f"    ⚠️ لا يمكن تحديد user_id — يرجى تمرير --user-id")
                
                # تأخير بين الطلبات لتجنب الحظر
                time.sleep(3)
            
            print(f"\n{'=' * 60}")
            print(f"📊 ملخص: {total_found} نتيجة | {total_added} جلسة {'(معاينة)' if args.dry_run else 'أُضيفت'}")
            
        else:
            sessions = fetch_sessions_from_mahakim(driver, args.case_number, args.court)
            
            print(f"\n📊 النتائج ({len(sessions)}):")
            for i, s in enumerate(sessions, 1):
                print(f"  {i}. {json.dumps(s, ensure_ascii=False, indent=4)}")
            
            if args.case_id and args.user_id:
                for session in sessions:
                    if "session_date" in session:
                        sync_session_to_db(
                            args.case_id, args.user_id, session["session_date"],
                            dry_run=args.dry_run
                        )
    
    finally:
        driver.quit()
        print("\n✅ انتهى التنفيذ")


if __name__ == "__main__":
    main()
