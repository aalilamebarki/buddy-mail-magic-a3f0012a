#!/usr/bin/env python3
"""
سكريبت جلب بيانات الملفات من بوابة محاكم باستخدام Playwright
يعمل في أي بيئة تدعم Python + Playwright (Lovable sandbox, Replit, VPS, Docker)

الاستخدام:
  python mahakim_playwright.py --numero 1 --code 1101 --annee 2025 --court "محكمة الاستئناف بالرباط"
  python mahakim_playwright.py --job-id UUID --case-id UUID  # يجلب البيانات من DB ويرسل النتائج للـ webhook

المتطلبات:
  pip install playwright playwright-stealth httpx
  playwright install chromium
"""

import asyncio
import json
import sys
import re
import os
import argparse
from datetime import datetime
from typing import Optional

# ── تكوين ──
WEBHOOK_URL = os.environ.get(
    "WEBHOOK_URL",
    "https://kebtjgedbwqrdqdjoqze.supabase.co/functions/v1/mahakim-webhook"
)
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://kebtjgedbwqrdqdjoqze.supabase.co")
SUPABASE_KEY = os.environ.get(
    "SUPABASE_KEY",
    os.environ.get("SUPABASE_ANON_KEY", "")
)
CHROMIUM_PATH = os.environ.get("CHROMIUM_PATH", "")


async def find_chromium() -> str:
    """البحث عن مسار Chromium المتاح"""
    if CHROMIUM_PATH:
        return CHROMIUM_PATH

    # Try common paths
    candidates = [
        "/usr/bin/chromium",
        "/usr/bin/chromium-browser",
        "/usr/bin/google-chrome",
        "/usr/bin/google-chrome-stable",
    ]

    # Check nix store
    import glob
    nix_paths = glob.glob("/nix/store/*/bin/chromium")
    candidates.extend(nix_paths)

    for path in candidates:
        if os.path.isfile(path) and os.access(path, os.X_OK):
            return path

    # Fallback: let playwright find it
    return ""


async def search_mahakim(
    numero: str,
    code: str,
    annee: str,
    court_name: str = "",
    primary_court: str = "",
) -> dict:
    """البحث عن ملف في بوابة محاكم وإرجاع النتائج"""
    from playwright.async_api import async_playwright

    result = {
        "success": False,
        "caseInfo": {},
        "procedures": [],
        "parties": [],
        "nextSessionDate": None,
        "error": None,
    }

    chromium_path = await find_chromium()
    launch_args = {
        "headless": True,
        "args": ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    }
    if chromium_path:
        launch_args["executable_path"] = chromium_path

    async with async_playwright() as p:
        browser = await p.chromium.launch(**launch_args)
        page = await browser.new_page(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            )
        )

        # تطبيق stealth إذا متوفر
        try:
            from playwright_stealth import Stealth
            stealth = Stealth()
            await stealth.apply_stealth(page)
        except Exception:
            pass

        try:
            print(f"[1] البحث عن ملف: {numero}/{code}/{annee}")
            await page.goto(
                "https://www.mahakim.ma/#/suivi/dossier-suivi",
                timeout=60000,
                wait_until="domcontentloaded",
            )
            await page.wait_for_timeout(5000)

            # تعبئة الحقول
            inputs = await page.query_selector_all("input")
            if len(inputs) < 3:
                result["error"] = "لم يتم العثور على حقول البحث"
                return result

            await inputs[0].fill(numero)
            await page.wait_for_timeout(300)
            await inputs[1].fill(code)
            await page.wait_for_timeout(300)
            await inputs[2].fill(annee)
            await page.wait_for_timeout(3000)

            # اختيار محكمة الاستئناف
            dropdowns = await page.query_selector_all(".p-dropdown")
            if dropdowns:
                await dropdowns[0].click()
                await page.wait_for_timeout(1500)
                options = await page.query_selector_all(
                    ".p-dropdown-item, li.p-dropdown-item"
                )

                selected = False
                target = court_name or ""

                if target:
                    for opt in options:
                        txt = (await opt.inner_text()).strip()
                        if target in txt or txt in target:
                            await opt.click()
                            selected = True
                            print(f"[2] تم اختيار المحكمة: {txt}")
                            break

                if not selected and len(options) > 0:
                    first_text = (await options[0].inner_text()).strip()
                    await options[0].click()
                    selected = True
                    print(f"[2] تم اختيار أول محكمة: {first_text}")

                if not selected:
                    result["error"] = "لم يتم العثور على خيارات المحاكم"
                    return result

                await page.wait_for_timeout(1500)

            # اختيار المحكمة الابتدائية إذا طُلب
            if primary_court:
                # تفعيل خانة البحث بالمحاكم الابتدائية
                # PrimeNG يخفي الـ input — ننقر على النص المرافق
                cb_label = await page.query_selector(
                    "text=هل تريد البحث بالمحاكم الابتدائية"
                )
                if cb_label:
                    await cb_label.click()
                else:
                    cb_box = await page.query_selector(
                        ".p-checkbox, p-checkbox"
                    )
                    if cb_box:
                        await cb_box.click()

                await page.wait_for_timeout(2000)

                # فتح القائمة الثانية
                dropdowns2 = await page.query_selector_all(".p-dropdown")
                if len(dropdowns2) > 1:
                    await dropdowns2[1].click()
                    await page.wait_for_timeout(1500)
                    opts2 = await page.query_selector_all(
                        ".p-dropdown-item, li.p-dropdown-item"
                    )
                    for opt in opts2:
                        txt = (await opt.inner_text()).strip()
                        if primary_court in txt or txt in primary_court:
                            await opt.click()
                            print(f"[2b] محكمة ابتدائية: {txt}")
                            break
                    await page.wait_for_timeout(1000)

            # النقر على البحث
            search_btn = await page.query_selector("button:has-text('بحث')")
            if not search_btn:
                result["error"] = "لم يتم العثور على زر البحث"
                return result

            await search_btn.click()
            print("[3] تم النقر على البحث — انتظار النتائج...")
            await page.wait_for_timeout(10000)

            body = await page.inner_text("body")

            if "لا توجد أية نتيجة" in body and "بطاقة الملف" not in body:
                result["error"] = "لا توجد نتيجة للبحث بهذا الرقم والمحكمة"
                return result

            # ── استخراج بطاقة الملف ──
            info = {}
            field_map = {
                "المحكمة": "court",
                "رقم الملف بالمحكمة": "file_number",
                "نوع الملف": "case_type",
                "الرقم الوطني للملف": "national_number",
                "الشعبة": "department",
                "المستشار / القاضي المقرر": "judge",
                "تاريخ التسجيل": "registration_date",
                "الموضوع": "subject",
                "آخر حكم/قرار": "last_decision",
                "تاريخ آخر حكم / القرار": "last_decision_date",
                "الحالة": "status",
            }

            for ar_label, en_key in field_map.items():
                pattern = re.escape(ar_label) + r"\s*\n\s*(.+?)(?:\n|$)"
                match = re.search(pattern, body)
                if match:
                    val = match.group(1).strip()
                    if val and val != ar_label:
                        info[en_key] = val

            # إصلاح: حقل المحكمة يلتقط أحياناً عنوان الحقل التالي
            if info.get("court") and "الرقم" in info["court"]:
                # استخراج اسم المحكمة من النص مباشرة
                court_match = re.search(
                    r"المحكمة\s*\n\s*((?:المحكمة|محكمة)[^\n]+)", body
                )
                if court_match:
                    info["court"] = court_match.group(1).strip()
                else:
                    info.pop("court", None)

            result["caseInfo"] = info

            # ── استخراج الإجراءات ──
            tables = await page.query_selector_all("table")
            seen_procs = set()

            for tbl in tables:
                rows = await tbl.query_selector_all("tr")
                for row in rows:
                    cells = await row.query_selector_all("td")
                    if len(cells) >= 3:
                        action_date = (await cells[0].inner_text()).strip()
                        action_type = (await cells[1].inner_text()).strip()
                        decision = (
                            (await cells[2].inner_text()).strip()
                            if len(cells) > 2
                            else ""
                        )
                        next_date = (
                            (await cells[3].inner_text()).strip()
                            if len(cells) > 3
                            else ""
                        )

                        if action_date and action_type:
                            key = f"{action_date}|{action_type}"
                            if key in seen_procs:
                                continue
                            seen_procs.add(key)

                            # تنظيف التاريخ
                            clean_date = action_date.split(" ")[0] if action_date else None
                            clean_next = next_date.split(" ")[0] if next_date else None

                            # تحويل التاريخ لصيغة ISO
                            iso_date = _parse_date(clean_date)
                            iso_next = _parse_date(clean_next)

                            proc = {
                                "action_date": iso_date,
                                "action_type": action_type.replace("\n", " ").strip(),
                                "decision": decision or None,
                                "next_session_date": iso_next,
                            }
                            result["procedures"].append(proc)

                            # تحديد الجلسة المقبلة
                            if iso_next:
                                try:
                                    dt = datetime.strptime(iso_next, "%Y-%m-%d")
                                    if dt > datetime.now():
                                        if (
                                            not result["nextSessionDate"]
                                            or iso_next < result["nextSessionDate"]
                                        ):
                                            result["nextSessionDate"] = iso_next
                                except ValueError:
                                    pass

            # ── استخراج الأطراف ──
            try:
                parties_tabs = await page.query_selector_all(
                    "p-tabpanel, .p-tabview-panel"
                )
                for tab in parties_tabs:
                    tab_text = await tab.inner_text()
                    if "الأطراف" in tab_text or "المدعي" in tab_text:
                        rows = await tab.query_selector_all("tr")
                        for row in rows:
                            cells = await row.query_selector_all("td")
                            if cells:
                                name = (await cells[0].inner_text()).strip()
                                if name and len(name) > 2:
                                    party_type = "plaintiff"
                                    if len(cells) > 1:
                                        role = (await cells[1].inner_text()).strip()
                                        if "مدعى عليه" in role:
                                            party_type = "defendant"
                                    result["parties"].append(
                                        {"name": name, "type": party_type}
                                    )
            except Exception:
                pass

            result["success"] = True
            proc_count = len(result["procedures"])
            print(
                f"[4] ✅ نجح الجلب — {proc_count} إجراء، "
                f"الجلسة المقبلة: {result['nextSessionDate'] or 'لا توجد'}"
            )

        except Exception as e:
            result["error"] = str(e)
            print(f"[ERROR] {e}")
        finally:
            await browser.close()

    return result


def _parse_date(date_str: Optional[str]) -> Optional[str]:
    """تحويل تاريخ DD/MM/YYYY إلى YYYY-MM-DD"""
    if not date_str:
        return None
    try:
        dt = datetime.strptime(date_str.strip(), "%d/%m/%Y")
        return dt.strftime("%Y-%m-%d")
    except ValueError:
        return date_str


async def send_to_webhook(
    job_id: str,
    case_id: str,
    user_id: str,
    result: dict,
):
    """إرسال النتائج إلى webhook لتحديث قاعدة البيانات"""
    import httpx

    payload = {
        "jobId": job_id,
        "caseId": case_id,
        "userId": user_id,
        "success": result["success"],
        "error": result.get("error"),
        "caseInfo": result.get("caseInfo", {}),
        "procedures": result.get("procedures", []),
        "nextSessionDate": result.get("nextSessionDate"),
    }

    print(f"[5] إرسال النتائج إلى webhook ({WEBHOOK_URL})...")
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(WEBHOOK_URL, json=payload)
        print(f"[6] Webhook response: {resp.status_code} — {resp.text[:200]}")
        return resp.status_code == 200


async def fetch_job_from_db(job_id: str) -> Optional[dict]:
    """جلب تفاصيل المهمة من قاعدة البيانات"""
    if not SUPABASE_KEY:
        return None
    import httpx

    url = f"{SUPABASE_URL}/rest/v1/mahakim_sync_jobs?id=eq.{job_id}&select=*"
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            url,
            headers={
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}",
            },
        )
        data = resp.json()
        if data and len(data) > 0:
            return data[0]
    return None


async def fetch_pending_jobs() -> list:
    """جلب المهام المعلقة من قاعدة البيانات"""
    if not SUPABASE_KEY:
        return []
    import httpx

    url = (
        f"{SUPABASE_URL}/rest/v1/mahakim_sync_jobs"
        f"?status=eq.pending&order=created_at.asc&limit=5"
    )
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            url,
            headers={
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}",
            },
        )
        return resp.json() if resp.status_code == 200 else []


async def main():
    parser = argparse.ArgumentParser(description="جلب بيانات محاكم")
    parser.add_argument("--numero", help="رقم الملف")
    parser.add_argument("--code", help="رمز الملف")
    parser.add_argument("--annee", help="السنة")
    parser.add_argument("--court", default="", help="اسم محكمة الاستئناف")
    parser.add_argument("--primary-court", default="", help="اسم المحكمة الابتدائية")
    parser.add_argument("--job-id", help="معرف المهمة من DB")
    parser.add_argument("--case-id", help="معرف القضية")
    parser.add_argument("--user-id", default="", help="معرف المستخدم")
    parser.add_argument(
        "--process-pending",
        action="store_true",
        help="معالجة جميع المهام المعلقة",
    )
    parser.add_argument("--json", action="store_true", help="إخراج JSON فقط")

    args = parser.parse_args()

    # وضع معالجة المهام المعلقة
    if args.process_pending:
        jobs = await fetch_pending_jobs()
        print(f"وجدت {len(jobs)} مهمة معلقة")
        for job in jobs:
            case_number = job.get("case_number", "")
            parts = case_number.split("/")
            if len(parts) < 3:
                continue

            payload = job.get("request_payload") or {}
            court = payload.get("appealCourt", "")
            primary = payload.get("firstInstanceCourt", "")

            result = await search_mahakim(
                parts[0], parts[1], parts[2], court, primary
            )
            await send_to_webhook(
                job["id"], job["case_id"], job["user_id"], result
            )
            await asyncio.sleep(5)  # تأخير بين المهام
        return

    # وضع جلب مهمة محددة
    if args.job_id:
        job = await fetch_job_from_db(args.job_id)
        if not job:
            print(f"لم يتم العثور على المهمة: {args.job_id}")
            return

        case_number = job.get("case_number", "")
        parts = case_number.split("/")
        if len(parts) < 3:
            print(f"رقم ملف غير صالح: {case_number}")
            return

        payload = job.get("request_payload") or {}
        court = payload.get("appealCourt", "")
        primary = payload.get("firstInstanceCourt", "")

        result = await search_mahakim(parts[0], parts[1], parts[2], court, primary)
        await send_to_webhook(
            args.job_id,
            job["case_id"],
            job["user_id"],
            result,
        )
        return

    # وضع البحث المباشر
    if not args.numero or not args.code or not args.annee:
        # بحث افتراضي للاختبار
        args.numero = args.numero or "1"
        args.code = args.code or "1101"
        args.annee = args.annee or "2025"

    result = await search_mahakim(
        args.numero, args.code, args.annee, args.court, args.primary_court
    )

    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(f"\n{'='*60}")
        if result["success"]:
            info = result["caseInfo"]
            print(f"✅ الملف: {info.get('file_number', 'N/A')}")
            print(f"   المحكمة: {info.get('court', 'N/A')}")
            print(f"   القاضي: {info.get('judge', 'N/A')}")
            print(f"   الشعبة: {info.get('department', 'N/A')}")
            print(f"   النوع: {info.get('case_type', 'N/A')}")
            print(f"   الإجراءات: {len(result['procedures'])}")
            print(f"   الجلسة المقبلة: {result['nextSessionDate'] or 'لا توجد'}")
        else:
            print(f"❌ خطأ: {result['error']}")

    # إرسال للـ webhook إذا تم توفير case_id
    if args.case_id and result["success"]:
        await send_to_webhook(
            args.job_id or "",
            args.case_id,
            args.user_id,
            result,
        )


if __name__ == "__main__":
    asyncio.run(main())
