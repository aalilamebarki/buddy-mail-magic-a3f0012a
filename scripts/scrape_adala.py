"""
سكريبت جلب الوثائق القانونية من بوابة عدالة (resources/1 إلى resources/1070)
يجلب الصفحات → يستخرج روابط PDF → يحمل الملفات → يصنف بالذكاء الاصطناعي → يرفع لـ Supabase

المتطلبات:
  pip install -r requirements.txt

الاستخدام:
  # جلب صفحة واحدة للاختبار
  python scripts/scrape_adala.py --test

  # جلب من صفحة 1 إلى 1070
  python scripts/scrape_adala.py --start 1 --end 1070

  # جلب دفعة من 10 صفحات بداية من صفحة 50
  python scripts/scrape_adala.py --start 50 --end 60

متغيرات البيئة:
  SUPABASE_URL=https://kebtjgedbwqrdqdjoqze.supabase.co
  SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
  LOVABLE_API_KEY=your_lovable_api_key (اختياري - للتصنيف بالذكاء الاصطناعي)
"""

import os
import re
import sys
import json
import time
import hashlib
import argparse
import requests
from urllib.parse import unquote, quote
from datetime import datetime

# ============ الإعدادات ============
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://kebtjgedbwqrdqdjoqze.supabase.co")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
LOVABLE_API_KEY = os.getenv("LOVABLE_API_KEY", "")
BUCKET_NAME = "legal-pdfs"
DELAY_BETWEEN_PAGES = 2
DELAY_BETWEEN_PDFS = 1

HEADERS = {
    "apikey": SUPABASE_SERVICE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}

SESSION = requests.Session()
SESSION.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ar,fr;q=0.9,en;q=0.8",
})


def fetch_resource_page(page_id: int) -> list[dict]:
    """جلب صفحة resources وإستخراج روابط PDF مع عناوينها"""
    url = f"https://adala.justice.gov.ma/resources/{page_id}"
    try:
        resp = SESSION.get(url, timeout=30)
        if resp.status_code != 200:
            print(f"  ⚠️ HTTP {resp.status_code} للصفحة {page_id}")
            return []
    except Exception as e:
        print(f"  ❌ خطأ في جلب الصفحة {page_id}: {str(e)[:80]}")
        return []

    html = resp.text
    laws = []
    seen_urls = set()

    # Pattern 1: <a href="...pdf or /api/uploads/...">text</a>
    link_pattern = re.compile(
        r'<a[^>]+href=["\']([^"\']*(?:\.pdf|/api/uploads/)[^"\']*)["\'][^>]*>([\s\S]*?)</a>',
        re.IGNORECASE,
    )
    for match in link_pattern.finditer(html):
        pdf_url = match.group(1).split("#")[0].strip()
        if not pdf_url.startswith("http"):
            pdf_url = f"https://adala.justice.gov.ma{'' if pdf_url.startswith('/') else '/'}{pdf_url}"

        if pdf_url in seen_urls:
            continue
        seen_urls.add(pdf_url)

        link_text = re.sub(r"<[^>]*>", "", match.group(2)).strip()
        link_text = re.sub(r"\s+", " ", link_text)

        # Get context: text before the link
        pos = match.start()
        context_html = html[max(0, pos - 500):pos]
        context = re.sub(r"<[^>]*>", " ", context_html)
        context = re.sub(r"\s+", " ", context).strip()[-200:]

        laws.append({
            "title": link_text or extract_title_from_url(pdf_url),
            "pdf_url": pdf_url,
            "context": context,
            "page_id": page_id,
        })

    # Pattern 2: standalone upload URLs not caught by pattern 1
    uploads_pattern = re.compile(
        r'href=["\']?(https?://adala\.justice\.gov\.ma/api/uploads/[^"\'\s#>]+)',
        re.IGNORECASE,
    )
    for match in uploads_pattern.finditer(html):
        pdf_url = match.group(1).strip()
        if pdf_url in seen_urls:
            continue
        seen_urls.add(pdf_url)
        laws.append({
            "title": extract_title_from_url(pdf_url),
            "pdf_url": pdf_url,
            "context": "",
            "page_id": page_id,
        })

    return laws


def extract_title_from_url(url: str) -> str:
    """استخراج عنوان من رابط PDF"""
    try:
        filename = url.split("/")[-1]
        try:
            filename = unquote(filename)
        except Exception:
            pass
        cleaned = re.sub(r"-\d{10,15}\.pdf$", "", filename, flags=re.IGNORECASE)
        cleaned = re.sub(r"\.pdf$", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\s*\(\d+\)\s*$", "", cleaned)
        cleaned = cleaned.replace("-", " ").replace("_", " ").strip()
        return cleaned or "نص قانوني"
    except Exception:
        return "نص قانوني"


def classify_with_ai(title: str, context: str) -> dict:
    """تصنيف الوثيقة باستخدام الذكاء الاصطناعي"""
    if not LOVABLE_API_KEY:
        return fallback_classify(title)

    try:
        text = (context + "\n" + title if len(context) > len(title) else title)[:2000]

        resp = requests.post(
            "https://ai.gateway.lovable.dev/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {LOVABLE_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "google/gemini-2.5-flash-lite",
                "messages": [{
                    "role": "user",
                    "content": f"""أنت خبير في القانون المغربي. حلل النص التالي واستخرج المعلومات:

النص: {text}

أجب بـ JSON فقط:
{{
  "doc_type": "dahir|law|organic_law|decree|circular|decision|convention",
  "category": "التصنيف",
  "reference_number": "رقم النص أو null",
  "year_issued": null,
  "issuing_authority": "الجهة المصدرة أو null",
  "subject": "ملخص قصير"
}}"""
                }],
                "temperature": 0.1,
            },
            timeout=30,
        )

        if resp.status_code != 200:
            return fallback_classify(title)

        content = resp.json().get("choices", [{}])[0].get("message", {}).get("content", "")
        json_match = re.search(r"\{[\s\S]*\}", content)
        if not json_match:
            return fallback_classify(title)
        return json.loads(json_match.group())
    except Exception as e:
        print(f"    ⚠️ خطأ AI: {str(e)[:50]}")
        return fallback_classify(title)


def fallback_classify(title: str) -> dict:
    """تصنيف احتياطي بدون ذكاء اصطناعي"""
    doc_type = "law"
    if re.search(r"ظهير", title):
        doc_type = "dahir"
    elif re.search(r"قانون\s*تنظيمي", title):
        doc_type = "organic_law"
    elif re.search(r"مرسوم", title):
        doc_type = "decree"
    elif re.search(r"دورية|منشور", title):
        doc_type = "circular"
    elif re.search(r"قرار", title):
        doc_type = "decision"
    elif re.search(r"اتفاقية|معاهدة", title):
        doc_type = "convention"

    category = "أخرى"
    cats = [
        (r"كراء", "قانون الكراء"),
        (r"الأسرة|الزواج|الطلاق|الحضانة|النفقة", "مدونة الأسرة"),
        (r"العقار|التحفيظ", "القانون العقاري"),
        (r"الشغل|العمل|الأجير", "قانون الشغل"),
        (r"التجاري|الشركة|التجارة", "القانون التجاري"),
        (r"الجنائي|العقوبات|الجناية", "القانون الجنائي"),
        (r"الإداري", "القانون الإداري"),
        (r"المسطرة المدنية", "المسطرة المدنية"),
        (r"المسطرة الجنائية", "المسطرة الجنائية"),
        (r"الضريب|المالية|الجمارك", "القانون المالي والضريبي"),
        (r"المحاماة|المحامي", "مهنة المحاماة"),
    ]
    for pattern, value in cats:
        if re.search(pattern, title):
            category = value
            break

    ref_match = re.search(r"رقم\s+([\d\.]+[-–]?[\d\.]*)", title)
    year_match = re.search(r"(20\d{2}|19\d{2})", title)

    return {
        "doc_type": doc_type,
        "category": category,
        "reference_number": ref_match.group(1) if ref_match else None,
        "year_issued": int(year_match.group(1)) if year_match else None,
        "issuing_authority": None,
        "subject": None,
    }


def check_duplicate(pdf_url: str) -> bool:
    """التحقق من وجود الوثيقة مسبقاً"""
    resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/legal_documents",
        headers=HEADERS,
        params={"select": "id", "pdf_url": f"eq.{pdf_url}", "limit": 1},
    )
    return resp.status_code == 200 and len(resp.json()) > 0


def check_page_scraped(page_id: int) -> bool:
    """التحقق من أن الصفحة تم جلبها مسبقاً"""
    resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/legal_documents",
        headers=HEADERS,
        params={"select": "id", "resource_page_id": f"eq.{page_id}", "limit": 1},
    )
    return resp.status_code == 200 and len(resp.json()) > 0


def download_pdf(url: str) -> bytes | None:
    """تحميل ملف PDF"""
    try:
        encoded = quote(unquote(url), safe=":/?&=#")
        resp = SESSION.get(encoded, timeout=60)
        if resp.status_code == 200 and len(resp.content) > 100:
            return resp.content
        print(f"    ⚠️ HTTP {resp.status_code} | حجم: {len(resp.content)} bytes")
        return None
    except Exception as e:
        print(f"    ❌ خطأ تحميل: {str(e)[:60]}")
        return None


def upload_to_storage(file_data: bytes, file_path: str) -> bool:
    """رفع ملف إلى Supabase Storage"""
    upload_url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET_NAME}/{quote(file_path, safe='/')}"
    resp = requests.post(
        upload_url,
        headers={
            "apikey": SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
            "Content-Type": "application/pdf",
            "x-upsert": "true",
        },
        data=file_data,
    )
    return resp.status_code in (200, 201)


def insert_document(law: dict, cls: dict, pdf_path: str | None, file_size: int) -> str | None:
    """إدراج وثيقة في قاعدة البيانات"""
    content = "\n".join(filter(None, [
        law["title"],
        f"الموضوع: {cls.get('subject')}" if cls.get("subject") else "",
        f"التصنيف: {cls.get('category', 'أخرى')}",
        f"النوع: {cls.get('doc_type', 'law')}",
        f"الرقم المرجعي: {cls.get('reference_number')}" if cls.get("reference_number") else "",
        f"الجهة المصدرة: {cls.get('issuing_authority')}" if cls.get("issuing_authority") else "",
        "المصدر: بوابة عدالة",
    ]))

    metadata = {
        "scraped": True,
        "scraped_at": datetime.utcnow().isoformat(),
        "source_site": "adala",
        "is_pdf": True,
        "has_local_pdf": pdf_path is not None and pdf_path not in ("fetch_failed", "upload_failed"),
    }
    if file_size > 0:
        metadata["file_size_bytes"] = file_size

    doc = {
        "title": law["title"][:500],
        "content": content,
        "source": f"https://adala.justice.gov.ma/resources/{law['page_id']}",
        "pdf_url": law["pdf_url"],
        "doc_type": cls.get("doc_type", "law"),
        "category": cls.get("category", "أخرى"),
        "reference_number": cls.get("reference_number"),
        "year_issued": cls.get("year_issued"),
        "issuing_authority": cls.get("issuing_authority"),
        "subject": cls.get("subject"),
        "resource_page_id": law["page_id"],
        "local_pdf_path": pdf_path,
        "ai_classification": cls,
        "metadata": metadata,
    }

    resp = requests.post(
        f"{SUPABASE_URL}/rest/v1/legal_documents",
        headers=HEADERS,
        json=doc,
    )

    if resp.status_code in (200, 201):
        data = resp.json()
        if isinstance(data, list) and data:
            return data[0].get("id")
        return None
    else:
        print(f"    ⚠️ خطأ إدراج: {resp.status_code} - {resp.text[:80]}")
        return None


def process_law(law: dict, index: int, total: int) -> dict:
    """معالجة قانون واحد"""
    print(f"  📄 [{index}/{total}] {law['title'][:60]}...")

    # Check duplicate
    if check_duplicate(law["pdf_url"]):
        print(f"    🔄 موجود مسبقاً")
        return {"status": "duplicate"}

    # Classify
    cls = classify_with_ai(law["title"], law["context"])
    print(f"    📋 {cls.get('doc_type', '?')} | {cls.get('category', '?')}")

    # Download PDF
    pdf_data = download_pdf(law["pdf_url"])
    pdf_path = None
    file_size = 0

    if pdf_data:
        file_size = len(pdf_data)
        # Use hash of URL as filename for safety
        url_hash = hashlib.md5(law["pdf_url"].encode()).hexdigest()[:12]
        doc_type = cls.get("doc_type", "law")
        storage_path = f"{doc_type}/{url_hash}.pdf"

        if upload_to_storage(pdf_data, storage_path):
            pdf_path = storage_path
            print(f"    ✅ PDF محفوظ ({file_size / 1024:.1f} KB)")
        else:
            pdf_path = "upload_failed"
            print(f"    ⚠️ فشل رفع PDF")
    else:
        pdf_path = "fetch_failed"
        print(f"    ⚠️ فشل تحميل PDF")

    # Insert to DB
    doc_id = insert_document(law, cls, pdf_path, file_size)

    if doc_id:
        # Update with correct path using doc_id
        if pdf_data and pdf_path and pdf_path not in ("fetch_failed", "upload_failed"):
            final_path = f"{cls.get('doc_type', 'law')}/{doc_id}.pdf"
            # Re-upload with doc_id as name
            upload_to_storage(pdf_data, final_path)
            requests.patch(
                f"{SUPABASE_URL}/rest/v1/legal_documents",
                headers={**HEADERS, "Prefer": "return=minimal"},
                params={"id": f"eq.{doc_id}"},
                json={"local_pdf_path": final_path},
            )
        print(f"    ✅ تم الحفظ في قاعدة البيانات")
        return {"status": "saved", "doc_id": doc_id, "size": file_size}
    else:
        print(f"    ❌ فشل الحفظ")
        return {"status": "error"}


def main():
    parser = argparse.ArgumentParser(description="جلب الوثائق القانونية من بوابة عدالة")
    parser.add_argument("--start", type=int, default=1, help="صفحة البداية")
    parser.add_argument("--end", type=int, default=1070, help="صفحة النهاية")
    parser.add_argument("--test", action="store_true", help="اختبار صفحة واحدة فقط (resources/1)")
    args = parser.parse_args()

    if args.test:
        args.start = 1
        args.end = 1

    print("=" * 60)
    print("🏛️  جلب الوثائق القانونية من بوابة عدالة")
    print("=" * 60)

    if not SUPABASE_SERVICE_KEY:
        print("\n❌ يرجى تعيين SUPABASE_SERVICE_ROLE_KEY!")
        print("   export SUPABASE_SERVICE_ROLE_KEY='your_key'")
        sys.exit(1)

    if LOVABLE_API_KEY:
        print("🤖 التصنيف بالذكاء الاصطناعي: مفعّل")
    else:
        print("📋 التصنيف بالذكاء الاصطناعي: غير مفعّل (تصنيف احتياطي)")
        print("   لتفعيله: export LOVABLE_API_KEY='your_key'")

    print(f"\n📄 الصفحات: {args.start} → {args.end}")
    print("-" * 60)

    total_saved = 0
    total_failed = 0
    total_skipped = 0
    total_duplicate = 0
    total_size = 0

    for page_id in range(args.start, args.end + 1):
        print(f"\n{'='*40}")
        print(f"📄 صفحة {page_id}/{args.end}")
        print(f"{'='*40}")

        # Check if already scraped
        if check_page_scraped(page_id):
            print(f"  ⏭️ تم جلبها مسبقاً")
            total_skipped += 1
            continue

        # Fetch page and extract laws
        laws = fetch_resource_page(page_id)
        if not laws:
            print(f"  📭 لا توجد وثائق")
            total_skipped += 1
            continue

        print(f"  📋 وجدت {len(laws)} وثيقة")

        for i, law in enumerate(laws, 1):
            result = process_law(law, i, len(laws))
            if result["status"] == "saved":
                total_saved += 1
                total_size += result.get("size", 0)
            elif result["status"] == "duplicate":
                total_duplicate += 1
            else:
                total_failed += 1

            time.sleep(DELAY_BETWEEN_PDFS)

        time.sleep(DELAY_BETWEEN_PAGES)

        # Progress report every 10 pages
        if page_id % 10 == 0:
            print(f"\n📊 تقرير: {total_saved} محفوظ | {total_duplicate} مكرر | {total_failed} فشل | {total_skipped} تخطي")
            print(f"   الحجم: {total_size / (1024 * 1024):.1f} MB")

    # Final report
    print("\n" + "=" * 60)
    print("📊 التقرير النهائي")
    print("=" * 60)
    print(f"  ✅ محفوظ: {total_saved}")
    print(f"  🔄 مكرر: {total_duplicate}")
    print(f"  ❌ فشل: {total_failed}")
    print(f"  ⏭️ تخطي: {total_skipped}")
    print(f"  📦 الحجم: {total_size / (1024 * 1024):.1f} MB")
    print("=" * 60)


if __name__ == "__main__":
    main()
