#!/usr/bin/env python3
"""
═══════════════════════════════════════════════════════════════════
Mahakim.ma Scraper — Playwright + Stealth + WARP Proxy
═══════════════════════════════════════════════════════════════════

المتطلبات:
  pip install playwright playwright-stealth
  playwright install chromium

تشغيل WARP proxy:
  warp-cli connect
  # يعمل على socks5://127.0.0.1:4000 افتراضياً

الاستخدام:
  python mahakim_scraper.py --numero 123 --code 1401 --annee 2024 --court "الدار البيضاء"
  python mahakim_scraper.py --batch cases.json
"""

import asyncio
import json
import random
import sys
import argparse
import logging
from datetime import datetime
from typing import Optional

from playwright.async_api import async_playwright, Page, Browser

# ── إعدادات ──────────────────────────────────────────────────────

MAHAKIM_URL = "https://www.mahakim.ma/Ar/SuiviDossiers"
PROXY_SERVER = "socks5://127.0.0.1:4000"  # Cloudflare WARP
TIMEOUT_MS = 60000  # 60 ثانية
MAX_RETRIES = 3

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("mahakim")


# ── دوال مساعدة ──────────────────────────────────────────────────

async def human_delay(min_s=0.5, max_s=2.0):
    """تأخير عشوائي لمحاكاة السلوك البشري"""
    await asyncio.sleep(random.uniform(min_s, max_s))


async def human_type(page: Page, selector: str, text: str):
    """كتابة نص حرفاً حرفاً بسرعة بشرية"""
    await page.click(selector)
    await human_delay(0.2, 0.5)
    for char in text:
        await page.keyboard.type(char, delay=random.randint(50, 150))
    await human_delay(0.3, 0.8)


async def wait_for_angular(page: Page, timeout=30000):
    """انتظار Angular حتى ينتهي من التحميل"""
    try:
        await page.wait_for_function(
            """() => {
                const ng = window.getAllAngularTestabilities 
                    ? window.getAllAngularTestabilities() 
                    : [];
                return ng.length === 0 || ng.every(t => t.isStable());
            }""",
            timeout=timeout,
        )
        log.info("✅ Angular stable")
    except Exception:
        log.warning("⚠️ Angular stability check timed out — continuing anyway")
        await page.wait_for_load_state("networkidle", timeout=10000)


# ── المتصفح ──────────────────────────────────────────────────────

async def create_browser(use_proxy=True) -> tuple:
    """إنشاء متصفح Playwright مع Stealth و Proxy"""
    pw = await async_playwright().start()

    launch_opts = {
        "headless": True,
        "args": [
            "--disable-blink-features=AutomationControlled",
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--disable-web-security",
            "--lang=ar",
        ],
    }

    if use_proxy:
        launch_opts["proxy"] = {"server": PROXY_SERVER}
        log.info(f"🔌 Using proxy: {PROXY_SERVER}")

    browser = await pw.chromium.launch(**launch_opts)

    context = await browser.new_context(
        viewport={"width": 1366, "height": 768},
        locale="ar-MA",
        timezone_id="Africa/Casablanca",
        user_agent=(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        ),
    )

    # Stealth: إخفاء webdriver
    await context.add_init_script("""
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        window.chrome = { runtime: {} };
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
        Object.defineProperty(navigator, 'languages', { get: () => ['ar', 'fr', 'en'] });
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) =>
            parameters.name === 'notifications'
                ? Promise.resolve({ state: Notification.permission })
                : originalQuery(parameters);
    """)

    page = await context.new_page()
    return pw, browser, page


# ── Selectors — هذه مبنية على تحليل DOM لموقع mahakim.ma ────────

# الموقع Angular SPA — الحقول تظهر بعد تحميل الـ Component
SELECTORS = {
    # حقول البحث الرئيسية
    "numero_input": [
        "input[formcontrolname='numero']",
        "input[name='numero']",
        "input[placeholder*='رقم']",
        "#numero",
        "input.numero-input",
        "mat-form-field input:first-of-type",
    ],
    "code_input": [
        "input[formcontrolname='mark']",
        "input[formcontrolname='code']",
        "input[name='mark']",
        "select[formcontrolname='mark']",
        "#mark",
        "mat-select[formcontrolname='mark']",
    ],
    "annee_input": [
        "input[formcontrolname='annee']",
        "input[name='annee']",
        "input[placeholder*='سنة']",
        "#annee",
        "select[formcontrolname='annee']",
    ],
    "court_select": [
        "select[formcontrolname='juridiction']",
        "mat-select[formcontrolname='juridiction']",
        "select[formcontrolname='court']",
        "#juridiction",
    ],
    "search_button": [
        "button[type='submit']",
        "button.btn-search",
        "button.search-btn",
        "button:has-text('بحث')",
        "button:has-text('Search')",
        "button:has-text('Rechercher')",
        "input[type='submit']",
    ],
    # منطقة النتائج
    "results_container": [
        ".results-container",
        ".search-results",
        "table.results",
        "mat-table",
        ".mat-table",
        "table",
        ".dossier-details",
        "app-result",
        ".result-component",
    ],
    "results_rows": [
        "table tbody tr",
        "mat-row",
        ".mat-row",
        "tr.result-row",
        ".result-item",
    ],
    "no_results": [
        ".no-results",
        ".empty-state",
        ":text('لا توجد نتائج')",
        ":text('لم يتم العثور')",
        ":text('Aucun résultat')",
    ],
}


async def find_element(page: Page, selector_list: list, description: str):
    """البحث عن عنصر باستخدام قائمة selectors بديلة"""
    for selector in selector_list:
        try:
            el = await page.query_selector(selector)
            if el:
                visible = await el.is_visible()
                if visible:
                    log.info(f"  ✅ Found {description}: {selector}")
                    return el, selector
        except Exception:
            continue
    log.warning(f"  ❌ Not found: {description}")
    return None, None


# ── البحث الرئيسي ────────────────────────────────────────────────

async def search_case(
    page: Page,
    numero: str,
    code: str,
    annee: str,
    court: str = "",
) -> dict:
    """
    البحث عن ملف في محاكم.ma
    
    المدخلات:
      numero: رقم الملف
      code: رمز الملف (مثلاً 1401)
      annee: سنة الملف
      court: اسم المحكمة (اختياري)
    
    المخرجات:
      dict مع حالة البحث والنتائج
    """
    result = {
        "status": "pending",
        "numero": numero,
        "code": code,
        "annee": annee,
        "court": court,
        "timestamp": datetime.now().isoformat(),
        "case_info": {},
        "procedures": [],
        "next_session_date": None,
        "dom_snapshot": None,
        "error": None,
    }

    try:
        # ── الخطوة 1: فتح الصفحة ──
        log.info(f"🔍 Searching: {numero}/{code}/{annee}")
        await page.goto(MAHAKIM_URL, wait_until="domcontentloaded", timeout=TIMEOUT_MS)
        await human_delay(2, 4)

        # انتظار Angular
        await wait_for_angular(page)
        await human_delay(1, 2)

        # ── الخطوة 2: التقاط DOM لتحليل الـ Selectors ──
        page_html = await page.content()
        result["dom_snapshot"] = page_html[:5000]  # أول 5000 حرف للتحليل

        # حفظ لقطة شاشة للتشخيص
        await page.screenshot(path="/tmp/mahakim_page.png", full_page=True)
        log.info("📸 Screenshot saved: /tmp/mahakim_page.png")

        # ── الخطوة 3: البحث عن حقول الإدخال ──
        num_el, num_sel = await find_element(page, SELECTORS["numero_input"], "رقم الملف")
        code_el, code_sel = await find_element(page, SELECTORS["code_input"], "رمز الملف")
        annee_el, annee_sel = await find_element(page, SELECTORS["annee_input"], "السنة")
        
        if not num_el or not annee_el:
            # إذا لم نجد الحقول، نحاول جلب كل الـ inputs
            all_inputs = await page.query_selector_all("input, select, mat-select, mat-form-field")
            input_info = []
            for inp in all_inputs[:20]:
                tag = await inp.evaluate("el => el.tagName")
                attrs = await inp.evaluate("""el => {
                    const a = {};
                    for (const attr of el.attributes) a[attr.name] = attr.value;
                    return a;
                }""")
                input_info.append({"tag": tag, "attrs": attrs})

            result["status"] = "selectors_not_found"
            result["error"] = "لم يتم العثور على حقول الإدخال"
            result["available_inputs"] = input_info
            log.error("❌ Input fields not found. Available inputs saved for analysis.")
            return result

        # ── الخطوة 4: تعبئة الحقول ──
        log.info("📝 Filling search fields...")

        # رقم الملف
        await human_type(page, num_sel, numero)

        # رمز الملف — قد يكون select أو input
        if code_el:
            tag = await code_el.evaluate("el => el.tagName.toLowerCase()")
            if tag == "select" or "mat-select" in (code_sel or ""):
                await page.select_option(code_sel, value=code)
            else:
                await human_type(page, code_sel, code)
        
        # السنة
        tag_annee = await annee_el.evaluate("el => el.tagName.toLowerCase()")
        if tag_annee == "select":
            await page.select_option(annee_sel, value=annee)
        else:
            await human_type(page, annee_sel, annee)

        # المحكمة (اختياري)
        if court:
            court_el, court_sel = await find_element(page, SELECTORS["court_select"], "المحكمة")
            if court_el:
                try:
                    await page.select_option(court_sel, label=court)
                    log.info(f"  ✅ Court selected: {court}")
                except Exception:
                    log.warning(f"  ⚠️ Could not select court: {court}")

        await human_delay(0.5, 1.5)

        # ── الخطوة 5: الضغط على زر البحث ──
        btn_el, btn_sel = await find_element(page, SELECTORS["search_button"], "زر البحث")
        if not btn_el:
            result["status"] = "search_button_not_found"
            result["error"] = "لم يتم العثور على زر البحث"
            return result

        log.info("🖱️ Clicking search...")

        # التقاط طلبات الشبكة
        api_responses = []

        async def capture_response(response):
            url = response.url
            if any(k in url.lower() for k in ["fn.aspx", "api", "search", "affaire", "dossier", "suivi"]):
                try:
                    body = await response.text()
                    api_responses.append({
                        "url": url,
                        "status": response.status,
                        "body": body[:2000],
                    })
                    log.info(f"  📡 API: {response.status} {url[:80]}")
                except Exception:
                    pass

        page.on("response", capture_response)

        await btn_el.click()
        await human_delay(1, 2)

        # ── الخطوة 6: انتظار النتائج ──
        log.info("⏳ Waiting for results...")

        # انتظار Angular + Network Idle
        await wait_for_angular(page, timeout=30000)

        # محاولة انتظار ظهور النتائج
        results_found = False
        for sel in SELECTORS["results_container"]:
            try:
                await page.wait_for_selector(sel, timeout=15000, state="visible")
                results_found = True
                log.info(f"  ✅ Results container appeared: {sel}")
                break
            except Exception:
                continue

        # تحقق من "لا توجد نتائج"
        for sel in SELECTORS["no_results"]:
            try:
                no_res = await page.query_selector(sel)
                if no_res and await no_res.is_visible():
                    result["status"] = "no_results"
                    result["error"] = "لم يتم العثور على الملف"
                    result["api_responses"] = api_responses
                    return result
            except Exception:
                continue

        await human_delay(1, 3)

        # ── الخطوة 7: استخراج البيانات ──
        log.info("📊 Extracting data...")

        # لقطة شاشة بعد البحث
        await page.screenshot(path="/tmp/mahakim_results.png", full_page=True)
        log.info("📸 Results screenshot: /tmp/mahakim_results.png")

        # استخراج بيانات الجدول
        procedures = await page.evaluate("""() => {
            const tables = document.querySelectorAll('table, mat-table, .mat-table');
            const results = [];
            
            tables.forEach(table => {
                const rows = table.querySelectorAll('tr, mat-row, .mat-row');
                const headers = [];
                
                // استخراج رؤوس الأعمدة
                const headerRow = table.querySelector('thead tr, mat-header-row, .mat-header-row, tr:first-child');
                if (headerRow) {
                    headerRow.querySelectorAll('th, mat-header-cell, .mat-header-cell, td').forEach(h => {
                        headers.push(h.textContent.trim());
                    });
                }
                
                // استخراج البيانات
                rows.forEach((row, idx) => {
                    if (idx === 0 && headers.length > 0) return; // تخطي رأس الجدول
                    const cells = row.querySelectorAll('td, mat-cell, .mat-cell');
                    if (cells.length === 0) return;
                    
                    const rowData = {};
                    cells.forEach((cell, i) => {
                        const key = headers[i] || `col_${i}`;
                        rowData[key] = cell.textContent.trim();
                    });
                    results.push(rowData);
                });
            });
            
            return results;
        }""")

        # استخراج معلومات الملف العامة
        case_info = await page.evaluate("""() => {
            const info = {};
            
            // البحث عن أي عنصر يحتوي على معلومات الملف
            const labels = document.querySelectorAll('label, .label, dt, th, .info-label, span.key');
            labels.forEach(label => {
                const text = label.textContent.trim();
                const sibling = label.nextElementSibling;
                if (sibling) {
                    info[text] = sibling.textContent.trim();
                }
            });
            
            // البحث في عناصر key-value
            const pairs = document.querySelectorAll('.detail-row, .info-row, dl > div, .field-group');
            pairs.forEach(pair => {
                const key = pair.querySelector('.key, dt, .label, strong');
                const val = pair.querySelector('.value, dd, .data, span:last-child');
                if (key && val) {
                    info[key.textContent.trim()] = val.textContent.trim();
                }
            });
            
            return info;
        }""")

        result["procedures"] = procedures
        result["case_info"] = case_info
        result["api_responses"] = api_responses
        result["status"] = "success" if (procedures or case_info) else "no_data_extracted"

        # البحث عن تاريخ الجلسة القادمة
        now = datetime.now()
        for proc in procedures:
            for key, val in proc.items():
                if val and "/" in val and len(val) > 5:
                    try:
                        parts = val.split("/")
                        if len(parts) == 3:
                            d = datetime(int(parts[2]), int(parts[1]), int(parts[0]))
                            if d > now:
                                if not result["next_session_date"] or d.isoformat() < result["next_session_date"]:
                                    result["next_session_date"] = d.strftime("%Y-%m-%d")
                    except (ValueError, IndexError):
                        pass

        log.info(f"✅ Done: {len(procedures)} procedures, next={result['next_session_date']}")
        return result

    except Exception as e:
        result["status"] = "error"
        result["error"] = str(e)
        log.error(f"❌ Error: {e}")

        try:
            await page.screenshot(path="/tmp/mahakim_error.png", full_page=True)
        except Exception:
            pass

        return result


# ── الدالة الرئيسية ──────────────────────────────────────────────

async def run_search(
    numero: str,
    code: str,
    annee: str,
    court: str = "",
    use_proxy: bool = True,
    retries: int = MAX_RETRIES,
) -> dict:
    """تشغيل البحث مع إعادة المحاولة"""
    
    pw, browser, page = await create_browser(use_proxy=use_proxy)
    
    try:
        for attempt in range(1, retries + 1):
            log.info(f"── Attempt {attempt}/{retries} ──")
            result = await search_case(page, numero, code, annee, court)
            
            if result["status"] in ("success", "no_results", "selectors_not_found"):
                return result
            
            if attempt < retries:
                wait = random.uniform(5, 15)
                log.info(f"⏳ Retrying in {wait:.0f}s...")
                await asyncio.sleep(wait)
                # إعادة تحميل الصفحة
                try:
                    await page.reload(wait_until="domcontentloaded", timeout=TIMEOUT_MS)
                except Exception:
                    pass
        
        return result
    finally:
        await browser.close()
        await pw.stop()


async def run_batch(cases: list, use_proxy: bool = True) -> list:
    """تشغيل بحث مجمع لقائمة ملفات"""
    results = []
    
    pw, browser, page = await create_browser(use_proxy=use_proxy)
    
    try:
        for i, case in enumerate(cases):
            log.info(f"\n{'='*50}")
            log.info(f"Case {i+1}/{len(cases)}: {case.get('numero')}/{case.get('code')}/{case.get('annee')}")
            
            result = await search_case(
                page,
                str(case.get("numero", "")),
                str(case.get("code", "")),
                str(case.get("annee", "")),
                str(case.get("court", "")),
            )
            results.append(result)
            
            # تأخير بين الطلبات
            if i < len(cases) - 1:
                wait = random.uniform(8, 20)
                log.info(f"⏳ Next case in {wait:.0f}s...")
                await asyncio.sleep(wait)
        
        return results
    finally:
        await browser.close()
        await pw.stop()


# ── CLI ──────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Mahakim.ma Case Scraper")
    parser.add_argument("--numero", help="رقم الملف")
    parser.add_argument("--code", help="رمز الملف (مثلاً 1401)")
    parser.add_argument("--annee", help="سنة الملف")
    parser.add_argument("--court", default="", help="اسم المحكمة (اختياري)")
    parser.add_argument("--batch", help="ملف JSON يحتوي على قائمة ملفات")
    parser.add_argument("--no-proxy", action="store_true", help="تعطيل البروكسي")
    parser.add_argument("--output", "-o", default="/tmp/mahakim_results.json", help="ملف المخرجات")
    
    args = parser.parse_args()
    use_proxy = not args.no_proxy
    
    if args.batch:
        with open(args.batch) as f:
            cases = json.load(f)
        results = asyncio.run(run_batch(cases, use_proxy=use_proxy))
    elif args.numero and args.code and args.annee:
        results = asyncio.run(run_search(
            args.numero, args.code, args.annee, args.court, use_proxy=use_proxy,
        ))
    else:
        parser.print_help()
        sys.exit(1)
    
    # حفظ النتائج
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    
    log.info(f"\n💾 Results saved: {args.output}")
    print(json.dumps(results, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
