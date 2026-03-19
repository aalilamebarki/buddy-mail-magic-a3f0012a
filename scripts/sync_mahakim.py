#!/usr/bin/env python3
"""
سكريبت جلب مواعيد الجلسات من بوابة محاكم (mahakim.ma) ومزامنتها مع النظام.

المتطلبات:
    pip install selenium webdriver-manager supabase python-dotenv

الاستخدام:
    # جلب جلسات ملف واحد (محكمة ابتدائية)
    python sync_mahakim.py --case-number "24/1401/2025" --appeal-court "الرباط" --primary-court "الرماني"

    # جلب جلسات ملف بمحكمة الاستئناف مباشرة
    python sync_mahakim.py --case-number "1/1401/2026" --appeal-court "الرباط"

    # جلب جلسات كل الملفات النشطة
    python sync_mahakim.py --all

    # وضع المعاينة (بدون حفظ)
    python sync_mahakim.py --all --dry-run

    # إظهار المتصفح للمراقبة
    python sync_mahakim.py --all --visible
"""

import argparse
import json
import os
import re
import sys
import time
from datetime import datetime

try:
    from selenium import webdriver
    from selenium.webdriver.chrome.service import Service
    from selenium.webdriver.chrome.options import Options
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.webdriver.common.keys import Keys
    from selenium.webdriver.common.action_chains import ActionChains
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

# ─── خريطة رموز أنواع المحاكم ────────────────────────────────────
# رموز الملفات التي تدل على نوع المحكمة
COMMERCIAL_CODES = []  # يمكن إضافة الرموز التجارية لاحقاً
ADMIN_CODES = []       # يمكن إضافة الرموز الإدارية لاحقاً


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
    الصيغة المتوقعة: رقم/رمز/سنة  مثل: 24/1401/2025
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


def wait_and_find(driver, css, timeout=10):
    """انتظار عنصر والعثور عليه."""
    return WebDriverWait(driver, timeout).until(
        EC.presence_of_element_located((By.CSS_SELECTOR, css))
    )


def click_element(driver, element):
    """النقر على عنصر مع التعامل مع الأخطاء."""
    try:
        element.click()
    except Exception:
        driver.execute_script("arguments[0].click();", element)


def select_dropdown_option(driver, dropdown_css, option_text, timeout=10):
    """
    اختيار خيار من PrimeNG dropdown.
    بوابة محاكم تستخدم p-dropdown وليس select عادي.
    """
    wait = WebDriverWait(driver, timeout)

    # النقر على dropdown لفتحه
    dropdown = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, dropdown_css)))
    click_element(driver, dropdown)
    time.sleep(0.5)

    # البحث عن الخيار في القائمة المنبثقة
    # PrimeNG يعرض p-dropdownitem أو li داخل .p-dropdown-panel
    items = driver.find_elements(By.CSS_SELECTOR, ".p-dropdown-panel .p-dropdown-item, .p-dropdown-panel li")

    for item in items:
        if option_text in item.text.strip():
            click_element(driver, item)
            time.sleep(0.5)
            return True

    print(f"    ⚠️ لم يتم العثور على '{option_text}' في القائمة")
    # طباعة الخيارات المتاحة للتشخيص
    available = [item.text.strip() for item in items if item.text.strip()]
    if available:
        print(f"    📋 الخيارات المتاحة: {', '.join(available[:10])}")
    return False


def fetch_sessions_from_mahakim(driver, case_number: str, appeal_court: str = None, primary_court: str = None):
    """
    جلب بيانات الجلسات من mahakim.ma لملف معين.

    المسار:
    1. إدخال رقم الملف (3 حقول: رقم + رمز 4 أرقام + سنة)
    2. اختيار محكمة الاستئناف (إجباري)
    3. إذا محكمة ابتدائية: تفعيل checkbox + اختيار المحكمة الابتدائية
    4. الضغط على بحث
    5. استخراج بطاقة الملف وجدول الإجراءات

    Returns:
        dict: بيانات الملف والجلسات
    """
    print(f"  🔍 البحث عن الملف: {case_number}")

    parsed = parse_case_number(case_number)
    if not parsed["numero"] or not parsed["code"] or not parsed["annee"]:
        print(f"  ❌ رقم الملف غير مكتمل. الصيغة المطلوبة: رقم/رمز/سنة")
        return {"sessions": [], "case_info": {}}

    if len(parsed["code"]) != 4:
        print(f"  ⚠️ رمز الملف يجب أن يكون 4 أرقام (الحالي: {parsed['code']})")

    driver.get(MAHAKIM_URL)
    wait = WebDriverWait(driver, 15)

    try:
        # ── 1. انتظار تحميل النموذج ──────────────────────────────
        time.sleep(3)

        # البحث عن حقول الإدخال الثلاثة
        # بوابة محاكم تعرض 3 حقول منفصلة: رقم الملف، الرمز، السنة
        inputs = driver.find_elements(By.CSS_SELECTOR, "input.p-inputtext, input[pinputtext]")

        if len(inputs) < 3:
            # محاولة بديلة: البحث عن حقل واحد للرقم الكامل
            full_input = driver.find_elements(By.CSS_SELECTOR, "input[formcontrolname], input[type='text']")
            if full_input:
                full_input[0].clear()
                full_input[0].send_keys(f"{parsed['numero']}/{parsed['code']}/{parsed['annee']}")
                time.sleep(1)
            else:
                print("  ❌ لم يتم العثور على حقول الإدخال")
                return {"sessions": [], "case_info": {}}
        else:
            # إدخال رقم الملف في الحقل الأول
            inputs[0].clear()
            inputs[0].send_keys(parsed["numero"])

            # إدخال رمز الملف في الحقل الثاني
            inputs[1].clear()
            inputs[1].send_keys(parsed["code"])

            # إدخال السنة في الحقل الثالث
            inputs[2].clear()
            inputs[2].send_keys(parsed["annee"])

        time.sleep(2)  # انتظار تحميل قائمة المحاكم أوتوماتيكياً

        # ── 2. اختيار محكمة الاستئناف (إجباري) ────────────────────
        if appeal_court:
            # البحث عن أول p-dropdown (محاكم الاستئناف)
            dropdowns = driver.find_elements(By.CSS_SELECTOR, "p-dropdown")
            if dropdowns:
                click_element(driver, dropdowns[0])
                time.sleep(0.5)
                items = driver.find_elements(By.CSS_SELECTOR, ".p-dropdown-panel .p-dropdown-item, .p-dropdown-panel li, .p-dropdown-items li")
                found = False
                for item in items:
                    if appeal_court in item.text.strip():
                        click_element(driver, item)
                        found = True
                        time.sleep(1)
                        break
                if not found:
                    available = [item.text.strip() for item in items if item.text.strip()]
                    print(f"  ⚠️ محكمة الاستئناف '{appeal_court}' غير موجودة")
                    print(f"  📋 المتاح: {', '.join(available[:15])}")
            else:
                print("  ⚠️ لم يتم العثور على قائمة محاكم الاستئناف")

        # ── 3. المحكمة الابتدائية (اختياري) ────────────────────────
        if primary_court:
            # تفعيل checkbox "هل تريد البحث بالمحاكم الابتدائية"
            try:
                # PrimeNG checkbox
                checkboxes = driver.find_elements(By.CSS_SELECTOR, "p-checkbox, .p-checkbox, input[type='checkbox']")
                for cb in checkboxes:
                    try:
                        # النقر على checkbox أو label المرتبط
                        parent = cb.find_element(By.XPATH, "./..")
                        if "ابتدائي" in parent.text or not cb.is_selected():
                            click_element(driver, cb)
                            time.sleep(1)
                            break
                    except Exception:
                        click_element(driver, cb)
                        time.sleep(1)
                        break
            except Exception as e:
                print(f"  ⚠️ لم يتم العثور على checkbox الابتدائية: {e}")

            time.sleep(1)

            # اختيار المحكمة الابتدائية من dropdown الثاني
            dropdowns = driver.find_elements(By.CSS_SELECTOR, "p-dropdown")
            if len(dropdowns) >= 2:
                click_element(driver, dropdowns[-1])  # آخر dropdown
                time.sleep(0.5)
                items = driver.find_elements(By.CSS_SELECTOR, ".p-dropdown-panel .p-dropdown-item, .p-dropdown-panel li, .p-dropdown-items li")
                found = False
                for item in items:
                    if primary_court in item.text.strip():
                        click_element(driver, item)
                        found = True
                        time.sleep(1)
                        break
                if not found:
                    available = [item.text.strip() for item in items if item.text.strip()]
                    print(f"  ⚠️ المحكمة الابتدائية '{primary_court}' غير موجودة")
                    print(f"  📋 المتاح: {', '.join(available[:15])}")

        # ── 4. الضغط على بحث ───────────────────────────────────────
        search_buttons = driver.find_elements(By.CSS_SELECTOR, "button.p-button, button[type='submit']")
        search_clicked = False
        for btn in search_buttons:
            btn_text = btn.text.strip()
            if "بحث" in btn_text or "عرض" in btn_text:
                click_element(driver, btn)
                search_clicked = True
                break
        if not search_clicked and search_buttons:
            click_element(driver, search_buttons[-1])

        # ── 5. انتظار واستخراج النتائج ─────────────────────────────
        time.sleep(5)

        result = {"sessions": [], "case_info": {}}

        # استخراج بطاقة الملف
        case_info = extract_case_info(driver)
        result["case_info"] = case_info

        # استخراج جدول الإجراءات (لائحة الإجراءات)
        sessions = extract_procedures_table(driver)
        result["sessions"] = sessions

        if sessions:
            print(f"  ✅ تم العثور على {len(sessions)} إجراء")
            # طباعة آخر إجراء والجلسة المقبلة
            future_sessions = [s for s in sessions if s.get("next_date") and s["next_date"] >= datetime.now().strftime("%Y-%m-%d")]
            if future_sessions:
                latest = future_sessions[-1]
                print(f"  📅 الجلسة المقبلة: {latest.get('next_date', '—')}")
        else:
            print(f"  ⚠️ لم يتم العثور على إجراءات")
            screenshot_path = f"mahakim_debug_{parsed['numero']}_{parsed['code']}_{parsed['annee']}.png"
            driver.save_screenshot(screenshot_path)
            print(f"  📸 لقطة شاشة: {screenshot_path}")

        return result

    except Exception as e:
        print(f"  ❌ خطأ أثناء البحث: {e}")
        screenshot_path = f"mahakim_error_{parsed['numero']}_{parsed['annee']}.png"
        try:
            driver.save_screenshot(screenshot_path)
            print(f"  📸 لقطة شاشة: {screenshot_path}")
        except Exception:
            pass
        return {"sessions": [], "case_info": {}}


def extract_case_info(driver):
    """
    استخراج بطاقة الملف من الصفحة.
    الحقول: المحكمة، الرقم الوطني، نوع القضية، الشعبة، القاضي المقرر، الموضوع، تاريخ التسجيل
    """
    info = {}
    try:
        # البحث عن بطاقة الملف (card أو div يحتوي على معلومات الملف)
        cards = driver.find_elements(By.CSS_SELECTOR, ".card, .p-card, .dossier-detail, .case-info, .result-card")

        for card in cards:
            text = card.text
            if not text.strip():
                continue

            # استخراج الحقول من النص
            lines = text.split("\n")
            for i, line in enumerate(lines):
                line = line.strip()
                if "المحكمة" in line and i + 1 < len(lines):
                    info["court"] = lines[i + 1].strip() if ":" not in line else line.split(":", 1)[1].strip()
                elif "الرقم الوطني" in line:
                    info["national_number"] = lines[i + 1].strip() if ":" not in line else line.split(":", 1)[1].strip()
                elif "نوع القضية" in line or "نوع الملف" in line:
                    info["case_type"] = lines[i + 1].strip() if ":" not in line else line.split(":", 1)[1].strip()
                elif "الشعبة" in line:
                    info["department"] = lines[i + 1].strip() if ":" not in line else line.split(":", 1)[1].strip()
                elif "القاضي المقرر" in line:
                    info["judge"] = lines[i + 1].strip() if ":" not in line else line.split(":", 1)[1].strip()
                elif "الموضوع" in line:
                    info["subject"] = lines[i + 1].strip() if ":" not in line else line.split(":", 1)[1].strip()
                elif "تاريخ التسجيل" in line:
                    info["registration_date"] = lines[i + 1].strip() if ":" not in line else line.split(":", 1)[1].strip()

        # محاولة بديلة: البحث عن أزواج label/value
        if not info:
            labels = driver.find_elements(By.CSS_SELECTOR, "label, .label, .field-label, dt")
            for label in labels:
                label_text = label.text.strip()
                try:
                    value_el = label.find_element(By.XPATH, "following-sibling::*[1]")
                    value = value_el.text.strip()
                    if "المحكمة" in label_text:
                        info["court"] = value
                    elif "الرقم الوطني" in label_text:
                        info["national_number"] = value
                    elif "الشعبة" in label_text:
                        info["department"] = value
                    elif "القاضي" in label_text:
                        info["judge"] = value
                    elif "الموضوع" in label_text:
                        info["subject"] = value
                except Exception:
                    pass

    except Exception as e:
        print(f"  ⚠️ خطأ في استخراج بطاقة الملف: {e}")

    return info


def extract_procedures_table(driver):
    """
    استخراج جدول الإجراءات (لائحة الإجراءات).
    الأعمدة المتوقعة: تاريخ الإجراء، نوع الإجراء، القرار، تاريخ الجلسة المقبلة
    """
    sessions = []
    try:
        # البحث عن جداول PrimeNG أو جداول HTML عادية
        tables = driver.find_elements(By.CSS_SELECTOR, "p-table table, table.p-datatable-table, table")

        for table in tables:
            # قراءة رؤوس الأعمدة
            headers = []
            header_cells = table.find_elements(By.CSS_SELECTOR, "thead th, .p-datatable-thead th")
            headers = [th.text.strip() for th in header_cells]

            if not headers:
                continue

            # تحديد أعمدة التاريخ
            date_col_idx = None
            action_col_idx = None
            decision_col_idx = None
            next_date_col_idx = None

            for idx, h in enumerate(headers):
                h_lower = h.strip()
                if "تاريخ الإجراء" in h_lower or "تاريخ" == h_lower:
                    date_col_idx = idx
                elif "نوع الإجراء" in h_lower or "الإجراء" in h_lower:
                    action_col_idx = idx
                elif "القرار" in h_lower:
                    decision_col_idx = idx
                elif "الجلسة" in h_lower and "مقبل" in h_lower:
                    next_date_col_idx = idx
                elif "تاريخ" in h_lower and date_col_idx is not None:
                    next_date_col_idx = idx

            # قراءة الصفوف
            rows = table.find_elements(By.CSS_SELECTOR, "tbody tr, .p-datatable-tbody tr")

            for row in rows:
                cells = row.find_elements(By.TAG_NAME, "td")
                if len(cells) < 2:
                    continue

                cell_texts = [cell.text.strip() for cell in cells]

                session_data = {
                    "raw_data": cell_texts,
                }

                # استخراج الحقول المعروفة
                if date_col_idx is not None and date_col_idx < len(cell_texts):
                    session_data["action_date"] = parse_date(cell_texts[date_col_idx])

                if action_col_idx is not None and action_col_idx < len(cell_texts):
                    session_data["action_type"] = cell_texts[action_col_idx]

                if decision_col_idx is not None and decision_col_idx < len(cell_texts):
                    session_data["decision"] = cell_texts[decision_col_idx]

                if next_date_col_idx is not None and next_date_col_idx < len(cell_texts):
                    session_data["next_date"] = parse_date(cell_texts[next_date_col_idx])

                # إذا لم نحدد الأعمدة، نحاول استخراج التواريخ من كل الخلايا
                if date_col_idx is None:
                    dates_found = []
                    for text in cell_texts:
                        parsed_date = parse_date(text)
                        if parsed_date:
                            dates_found.append(parsed_date)
                    if len(dates_found) >= 1:
                        session_data["action_date"] = dates_found[0]
                    if len(dates_found) >= 2:
                        session_data["next_date"] = dates_found[-1]

                sessions.append(session_data)

        # ترتيب حسب تاريخ الإجراء
        sessions.sort(key=lambda s: s.get("action_date", ""), reverse=False)

    except Exception as e:
        print(f"  ⚠️ خطأ في استخراج جدول الإجراءات: {e}")

    return sessions


def parse_date(text: str):
    """تحويل نص تاريخ إلى صيغة yyyy-mm-dd."""
    if not text or not text.strip():
        return None
    text = text.strip()
    for fmt in ["%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y", "%Y/%m/%d"]:
        try:
            return datetime.strptime(text, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    # محاولة استخراج تاريخ من نص أطول
    match = re.search(r"(\d{2})[/\-](\d{2})[/\-](\d{4})", text)
    if match:
        try:
            return datetime.strptime(f"{match.group(1)}/{match.group(2)}/{match.group(3)}", "%d/%m/%Y").strftime("%Y-%m-%d")
        except ValueError:
            pass
    return None


def get_active_cases():
    """جلب كل الملفات النشطة التي لديها رقم ملف."""
    result = supabase.table("cases").select(
        "id, title, case_number, court, court_level, status, client_id, clients(full_name)"
    ).neq("status", "archived").not_.is_("case_number", "null").neq("case_number", "").execute()

    return result.data or []


def extract_court_info(court_name: str):
    """
    استخراج اسم محكمة الاستئناف والمحكمة الابتدائية من اسم المحكمة المخزن.
    مثال: "المحكمة الابتدائية بالرماني" → appeal: "الرباط", primary: "الرماني"
    """
    # TODO: بناء خريطة المحاكم (الابتدائية → الاستئنافية)
    # حالياً نعيد الاسم كما هو
    return {"appeal": None, "primary": None, "raw": court_name}


def sync_session_to_db(case_id: str, user_id: str, session_date: str, action_type: str = None, notes: str = None, dry_run: bool = False):
    """حفظ جلسة جديدة في قاعدة البيانات إذا لم تكن موجودة."""
    existing = supabase.table("court_sessions").select("id").eq(
        "case_id", case_id
    ).eq("session_date", session_date).execute()

    if existing.data:
        print(f"    ⏭️ جلسة {session_date} موجودة مسبقاً")
        return False

    if dry_run:
        print(f"    🔍 [معاينة] سيتم إضافة جلسة بتاريخ {session_date} ({action_type or '—'})")
        return True

    supabase.table("court_sessions").insert({
        "case_id": case_id,
        "user_id": user_id,
        "session_date": session_date,
        "required_action": action_type or "تم الجلب من بوابة محاكم",
        "notes": notes or "تم الجلب تلقائياً من mahakim.ma",
        "status": "scheduled",
    }).execute()

    print(f"    ✅ تمت إضافة جلسة بتاريخ {session_date}")
    return True


def get_next_session_date(sessions: list):
    """استخراج تاريخ الجلسة المقبلة من قائمة الإجراءات."""
    today = datetime.now().strftime("%Y-%m-%d")

    # البحث عن آخر إجراء يحتوي على تاريخ جلسة مقبلة
    for session in reversed(sessions):
        next_date = session.get("next_date")
        if next_date and next_date >= today:
            return next_date

    return None


def main():
    parser = argparse.ArgumentParser(description="مزامنة جلسات المحاكم من mahakim.ma")
    parser.add_argument("--case-number", help="رقم الملف (مثال: 24/1401/2025)")
    parser.add_argument("--appeal-court", help="اسم محكمة الاستئناف (مثال: الرباط)")
    parser.add_argument("--primary-court", help="اسم المحكمة الابتدائية (مثال: الرماني)")
    parser.add_argument("--case-id", help="معرف الملف في النظام (UUID)")
    parser.add_argument("--user-id", help="معرف المستخدم (UUID)")
    parser.add_argument("--all", action="store_true", help="جلب جلسات كل الملفات النشطة")
    parser.add_argument("--dry-run", action="store_true", help="معاينة فقط بدون حفظ")
    parser.add_argument("--visible", action="store_true", help="إظهار المتصفح (بدون headless)")
    parser.add_argument("--delay", type=int, default=3, help="تأخير بين الملفات بالثواني (افتراضي: 3)")

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
            errors = []

            for i, case in enumerate(cases, 1):
                case_num = case.get("case_number", "")
                if not case_num or "/" not in case_num:
                    continue

                client_name = case.get("clients", {}).get("full_name", "—") if case.get("clients") else "—"
                print(f"\n[{i}/{len(cases)}] 📁 {case['title']} — {client_name}")
                print(f"  رقم الملف: {case_num} | المحكمة: {case.get('court', '—')}")

                # استخراج معلومات المحكمة
                court_info = extract_court_info(case.get("court", ""))

                result = fetch_sessions_from_mahakim(
                    driver, case_num,
                    appeal_court=court_info.get("appeal") or args.appeal_court,
                    primary_court=court_info.get("primary") or args.primary_court,
                )

                sessions = result.get("sessions", [])
                total_found += len(sessions)

                # البحث عن تاريخ الجلسة المقبلة
                next_date = get_next_session_date(sessions)
                if next_date:
                    user_id = args.user_id
                    if not user_id:
                        existing_sessions = supabase.table("court_sessions").select("user_id").eq(
                            "case_id", case["id"]
                        ).limit(1).execute()
                        if existing_sessions.data:
                            user_id = existing_sessions.data[0]["user_id"]

                    if user_id:
                        added = sync_session_to_db(
                            case["id"], user_id, next_date,
                            dry_run=args.dry_run
                        )
                        if added:
                            total_added += 1
                    else:
                        print(f"    ⚠️ لا يمكن تحديد user_id — يرجى تمرير --user-id")

                # تأخير بين الطلبات لتجنب الحظر
                time.sleep(args.delay)

            print(f"\n{'=' * 60}")
            print(f"📊 ملخص: {total_found} إجراء | {total_added} جلسة {'(معاينة)' if args.dry_run else 'أُضيفت'}")
            if errors:
                print(f"❌ أخطاء: {len(errors)}")
                for err in errors:
                    print(f"  - {err}")

        else:
            result = fetch_sessions_from_mahakim(
                driver, args.case_number,
                appeal_court=args.appeal_court,
                primary_court=args.primary_court,
            )

            print(f"\n📊 بطاقة الملف:")
            for k, v in result.get("case_info", {}).items():
                print(f"  {k}: {v}")

            sessions = result.get("sessions", [])
            print(f"\n📋 الإجراءات ({len(sessions)}):")
            for i, s in enumerate(sessions, 1):
                date = s.get("action_date", "—")
                action = s.get("action_type", "—")
                decision = s.get("decision", "—")
                next_d = s.get("next_date", "—")
                print(f"  {i}. {date} | {action} | {decision} | المقبلة: {next_d}")

            next_date = get_next_session_date(sessions)
            if next_date:
                print(f"\n📅 تاريخ الجلسة المقبلة: {next_date}")

            if args.case_id and args.user_id and next_date:
                sync_session_to_db(
                    args.case_id, args.user_id, next_date,
                    dry_run=args.dry_run
                )

    finally:
        driver.quit()
        print("\n✅ انتهى التنفيذ")


if __name__ == "__main__":
    main()
