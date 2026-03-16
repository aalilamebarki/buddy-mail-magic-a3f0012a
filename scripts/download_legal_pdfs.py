"""
سكريبت لجلب ملفات PDF القانونية من بوابة عدالة وحفظها في Supabase Storage + قاعدة البيانات

المتطلبات:
  pip install supabase requests

الاستخدام:
  python scripts/download_legal_pdfs.py

المتغيرات المطلوبة (أنشئ ملف .env أو عدّلها مباشرة أدناه):
  SUPABASE_URL=https://kebtjgedbwqrdqdjoqze.supabase.co
  SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
"""

import os
import re
import time
import hashlib
import requests
from urllib.parse import unquote, quote
from datetime import datetime

# ============ الإعدادات ============
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://kebtjgedbwqrdqdjoqze.supabase.co")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "YOUR_SERVICE_ROLE_KEY_HERE")
LINKS_FILE = os.path.join(os.path.dirname(__file__), "..", "public", "data", "adala_pdf_links.txt")
BUCKET_NAME = "legal-pdfs"
BATCH_SIZE = 5          # عدد الملفات في كل دفعة
DELAY_BETWEEN = 1       # ثوان بين كل تحميل
MAX_RETRIES = 2         # عدد محاولات إعادة التحميل
# ====================================

# Supabase REST headers
HEADERS = {
    "apikey": SUPABASE_SERVICE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal",
}


def parse_links_file(filepath: str) -> list[str]:
    """استخراج روابط PDF من الملف النصي"""
    urls = []
    with open(filepath, "r", encoding="utf-8") as f:
        for line in f:
            match = re.search(r"الرابط:\s*(https?://[^\s]+)", line)
            if match:
                url = match.group(1).strip()
                # إزالة الهاش
                url = url.split("#")[0]
                urls.append(url)
    return urls


def get_existing_sources() -> set:
    """جلب المصادر الموجودة مسبقاً في قاعدة البيانات"""
    existing = set()
    offset = 0
    while True:
        resp = requests.get(
            f"{SUPABASE_URL}/rest/v1/legal_documents",
            headers=HEADERS,
            params={
                "select": "source",
                "source": "like.*adala.justice.gov.ma*",
                "offset": offset,
                "limit": 1000,
            },
        )
        if resp.status_code != 200:
            print(f"⚠️ خطأ في جلب البيانات الموجودة: {resp.status_code}")
            break
        data = resp.json()
        if not data:
            break
        for row in data:
            if row.get("source"):
                existing.add(row["source"])
        if len(data) < 1000:
            break
        offset += 1000
    return existing


def detect_doc_type(text: str) -> str:
    """تحديد نوع الوثيقة"""
    if re.search(r"ظهير|ظــهــيــر", text):
        return "dahir"
    if re.search(r"قانون\s*تنظيمي", text):
        return "organic_law"
    if re.search(r"مرسوم", text):
        return "decree"
    if re.search(r"دورية|منشور", text):
        return "circular"
    if re.search(r"اتفاقية|معاهدة", text):
        return "convention"
    if re.search(r"قرار\s*(وزير|رقم|مشترك)", text):
        return "decision"
    if re.search(r"قانون\s*رقم|مدونة", text):
        return "law"
    return "law"


def detect_category(text: str) -> str:
    """تحديد تصنيف الوثيقة"""
    patterns = [
        (r"كراء|المكتري|إفراغ", "قانون الكراء"),
        (r"الطلاق|النفقة|الحضانة|الزواج|الأسرة", "مدونة الأسرة"),
        (r"التحفيظ|العقار|العقاري", "القانون العقاري"),
        (r"الشغل|العمل|الأجير|المشغل", "قانون الشغل"),
        (r"التجاري|الشركة|الكمبيالة|التجارة", "القانون التجاري"),
        (r"الجنائي|الجناية|الجنحة|العقوبات", "القانون الجنائي"),
        (r"الإداري|نزع الملكية", "القانون الإداري"),
        (r"المسؤولية|التعويض|الالتزام", "القانون المدني"),
        (r"المسطرة المدنية|الدعوى", "المسطرة المدنية"),
        (r"المسطرة الجنائية", "المسطرة الجنائية"),
        (r"الضريبة|المالية|الجمارك", "القانون المالي والضريبي"),
        (r"المحاماة|المحامي", "مهنة المحاماة"),
        (r"التوثيق|الموثق", "مهنة التوثيق"),
        (r"العدالة|العدول|خطة", "خطة العدالة"),
        (r"المفوض|القضائيين", "المفوضون القضائيون"),
        (r"التنظيم القضائي|المحاكم", "التنظيم القضائي"),
        (r"السلطة القضائية", "السلطة القضائية"),
    ]
    for pattern, value in patterns:
        if re.search(pattern, text):
            return value
    return "أخرى"


def extract_ref_number(text: str) -> str:
    """استخراج الرقم المرجعي"""
    match = re.search(r"رقم\s+([\d\.]+[-–]?[\d\.]*)", text)
    return match.group(1) if match else ""


def extract_title_from_url(url: str) -> str:
    """استخراج العنوان من الرابط"""
    try:
        segments = url.split("/")
        filename = segments[-1]
        try:
            filename = unquote(filename)
        except Exception:
            pass
        cleaned = re.sub(r"-\d{10,15}\.pdf$", "", filename, flags=re.IGNORECASE)
        cleaned = re.sub(r"\.pdf$", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\s*\(\d+\)\s*$", "", cleaned).strip()
        return cleaned or "نص قانوني"
    except Exception:
        return "نص قانوني"


def sanitize_filename(name: str) -> str:
    """تنظيف اسم الملف للتخزين"""
    cleaned = re.sub(r"[^\u0600-\u06FFa-zA-Z0-9\s\-_.]", "", name)
    cleaned = re.sub(r"\s+", "_", cleaned).strip("_")
    return cleaned[:80] if cleaned else "document"


def download_pdf(url: str) -> bytes | None:
    """تحميل ملف PDF من الرابط"""
    try:
        # تشفير URL بشكل صحيح
        try:
            encoded = quote(unquote(url), safe=":/?&=#")
        except Exception:
            encoded = quote(url, safe=":/?&=#")

        resp = requests.get(
            encoded,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Accept": "*/*",
            },
            timeout=60,
        )
        if resp.status_code == 200:
            return resp.content
        else:
            print(f"  ⚠️ حالة HTTP: {resp.status_code}")
            return None
    except Exception as e:
        print(f"  ❌ خطأ تحميل: {str(e)[:80]}")
        return None


def upload_to_storage(file_data: bytes, file_path: str, content_type: str = "application/pdf") -> bool:
    """رفع ملف إلى Supabase Storage"""
    upload_url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET_NAME}/{quote(file_path, safe='/')}"
    resp = requests.post(
        upload_url,
        headers={
            "apikey": SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
            "Content-Type": content_type,
            "x-upsert": "true",
        },
        data=file_data,
    )
    if resp.status_code in (200, 201):
        return True
    else:
        print(f"  ⚠️ خطأ رفع: {resp.status_code} - {resp.text[:100]}")
        return False


def insert_or_update_document(title: str, source: str, doc_type: str, category: str,
                               ref_number: str, local_pdf_path: str, file_size: int) -> bool:
    """إدراج أو تحديث الوثيقة في قاعدة البيانات"""
    # أولاً: هل الوثيقة موجودة؟
    check_resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/legal_documents",
        headers=HEADERS,
        params={"select": "id", "source": f"eq.{source}", "limit": 1},
    )

    metadata = {
        "scraped": True,
        "scraped_at": datetime.utcnow().isoformat(),
        "source_site": "adala",
        "is_pdf": True,
        "has_local_pdf": True,
        "file_size_bytes": file_size,
    }

    content = f"""{title}

نوع الوثيقة: {doc_type}
التصنيف: {category}
{('الرقم المرجعي: ' + ref_number) if ref_number else ''}
مصدر: بوابة عدالة - وزارة العدل
رابط: {source}
حالة PDF: محفوظ محلياً ✅"""

    if check_resp.status_code == 200 and check_resp.json():
        # تحديث
        doc_id = check_resp.json()[0]["id"]
        update_resp = requests.patch(
            f"{SUPABASE_URL}/rest/v1/legal_documents",
            headers={**HEADERS, "Prefer": "return=minimal"},
            params={"id": f"eq.{doc_id}"},
            json={"local_pdf_path": local_pdf_path, "metadata": metadata},
        )
        return update_resp.status_code in (200, 204)
    else:
        # إدراج جديد
        insert_resp = requests.post(
            f"{SUPABASE_URL}/rest/v1/legal_documents",
            headers={**HEADERS, "Prefer": "return=minimal"},
            json={
                "title": title[:500],
                "content": content,
                "source": source,
                "doc_type": doc_type,
                "category": category,
                "reference_number": ref_number or None,
                "local_pdf_path": local_pdf_path,
                "metadata": metadata,
            },
        )
        if insert_resp.status_code in (200, 201, 204):
            return True
        else:
            print(f"  ⚠️ خطأ إدراج: {insert_resp.status_code} - {insert_resp.text[:100]}")
            return False


def process_single_pdf(url: str, index: int, total: int) -> dict:
    """معالجة ملف PDF واحد"""
    title = extract_title_from_url(url)
    doc_type = detect_doc_type(title)
    category = detect_category(title)
    ref_number = extract_ref_number(title)

    print(f"\n📄 [{index}/{total}] {title[:60]}...")
    print(f"   النوع: {doc_type} | التصنيف: {category}")

    # تحميل PDF
    pdf_data = None
    for attempt in range(MAX_RETRIES + 1):
        pdf_data = download_pdf(url)
        if pdf_data:
            break
        if attempt < MAX_RETRIES:
            print(f"   🔄 إعادة المحاولة ({attempt + 1}/{MAX_RETRIES})...")
            time.sleep(2)

    if not pdf_data:
        print("   ❌ فشل التحميل بعد كل المحاولات")
        # حفظ في قاعدة البيانات بدون PDF
        insert_or_update_document(title, url, doc_type, category, ref_number, "fetch_failed", 0)
        return {"success": False, "title": title, "reason": "download_failed"}

    file_size = len(pdf_data)
    print(f"   ✅ تم التحميل ({file_size / 1024:.1f} KB)")

    # تحضير مسار التخزين
    safe_name = sanitize_filename(title)
    file_hash = hashlib.md5(url.encode()).hexdigest()[:8]
    storage_path = f"{doc_type}/{file_hash}_{safe_name}.pdf"

    # رفع إلى التخزين
    if not upload_to_storage(pdf_data, storage_path):
        print("   ❌ فشل الرفع إلى التخزين")
        insert_or_update_document(title, url, doc_type, category, ref_number, "upload_failed", file_size)
        return {"success": False, "title": title, "reason": "upload_failed"}

    print(f"   ✅ تم الرفع: {storage_path}")

    # حفظ في قاعدة البيانات
    if insert_or_update_document(title, url, doc_type, category, ref_number, storage_path, file_size):
        print("   ✅ تم الحفظ في قاعدة البيانات")
        return {"success": True, "title": title, "path": storage_path, "size": file_size}
    else:
        print("   ⚠️ فشل الحفظ في قاعدة البيانات")
        return {"success": False, "title": title, "reason": "db_insert_failed"}


def main():
    print("=" * 60)
    print("🏛️  سكريبت جلب الوثائق القانونية من بوابة عدالة")
    print("=" * 60)

    # التحقق من المفتاح
    if SUPABASE_SERVICE_KEY == "YOUR_SERVICE_ROLE_KEY_HERE":
        print("\n❌ يرجى تعيين SUPABASE_SERVICE_ROLE_KEY!")
        print("   يمكنك تعيينه كمتغير بيئة:")
        print('   export SUPABASE_SERVICE_ROLE_KEY="your_key_here"')
        return

    # قراءة الروابط
    print(f"\n📂 قراءة الروابط من: {LINKS_FILE}")
    all_urls = parse_links_file(LINKS_FILE)
    print(f"   إجمالي الروابط: {len(all_urls)}")

    # جلب الموجود مسبقاً
    print("\n🔍 التحقق من الوثائق الموجودة...")
    existing = get_existing_sources()
    print(f"   موجود مسبقاً: {len(existing)}")

    # تصفية الجديد
    new_urls = [u for u in all_urls if u not in existing]
    print(f"   وثائق جديدة: {len(new_urls)}")

    if not new_urls:
        print("\n✅ كل الوثائق موجودة بالفعل!")
        return

    # المعالجة
    total = len(new_urls)
    success_count = 0
    fail_count = 0
    total_size = 0

    print(f"\n🚀 بدء معالجة {total} وثيقة...")
    print(f"   حجم الدفعة: {BATCH_SIZE} | التأخير: {DELAY_BETWEEN}s")
    print("-" * 60)

    for i, url in enumerate(new_urls, 1):
        result = process_single_pdf(url, i, total)
        if result["success"]:
            success_count += 1
            total_size += result.get("size", 0)
        else:
            fail_count += 1

        # تأخير بين الملفات
        if i < total:
            time.sleep(DELAY_BETWEEN)

        # تقرير دوري كل دفعة
        if i % BATCH_SIZE == 0:
            print(f"\n📊 تقرير مؤقت: {success_count} نجاح | {fail_count} فشل | {i}/{total}")
            print(f"   الحجم الإجمالي: {total_size / (1024 * 1024):.1f} MB")
            print("-" * 60)

    # التقرير النهائي
    print("\n" + "=" * 60)
    print("📊 التقرير النهائي")
    print("=" * 60)
    print(f"   ✅ نجاح: {success_count}")
    print(f"   ❌ فشل: {fail_count}")
    print(f"   📦 الحجم الإجمالي: {total_size / (1024 * 1024):.1f} MB")
    print(f"   📁 مخزن في: {BUCKET_NAME}")
    print("=" * 60)


if __name__ == "__main__":
    main()
