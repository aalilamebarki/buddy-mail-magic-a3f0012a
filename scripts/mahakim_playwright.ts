#!/usr/bin/env npx tsx
/**
 * سكريبت جلب بيانات الملفات من بوابة محاكم باستخدام Playwright (Node.js/TypeScript)
 * يعمل في أي بيئة تدعم Node.js + Playwright
 *
 * الاستخدام:
 *   npx tsx scripts/mahakim_playwright.ts --numero 1 --code 1101 --annee 2025
 *   npx tsx scripts/mahakim_playwright.ts --numero 15 --code 1201 --annee 2026 --primary-court "المحكمة الابتدائية بالرماني"
 *   npx tsx scripts/mahakim_playwright.ts --process-pending
 *
 * المتطلبات:
 *   npm install playwright playwright-extra puppeteer-extra-plugin-stealth
 */

import { chromium, type Browser, type Page } from 'playwright';
import { existsSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';

// ── تكوين ──
const WEBHOOK_URL =
  process.env.WEBHOOK_URL ||
  'https://kebtjgedbwqrdqdjoqze.supabase.co/functions/v1/mahakim-webhook';
const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  'https://kebtjgedbwqrdqdjoqze.supabase.co';
const SUPABASE_KEY =
  process.env.SUPABASE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtlYnRqZ2VkYndxcmRxZGpvcXplIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0NTEwOTAsImV4cCI6MjA4OTAyNzA5MH0.ugsWCQHTjhGW1Re1QUfpCM64u5CT66wnGQ4GfmHi9PU';
const CHROMIUM_PATH = process.env.CHROMIUM_PATH || '';

// ── أنواع ──
interface CaseInfo {
  court?: string;
  file_number?: string;
  case_type?: string;
  national_number?: string;
  department?: string;
  judge?: string;
  registration_date?: string;
  subject?: string;
  last_decision?: string;
  last_decision_date?: string;
  status?: string;
  [key: string]: string | undefined;
}

interface Procedure {
  action_date: string | null;
  action_type: string;
  decision: string | null;
  next_session_date: string | null;
}

interface Party {
  name: string;
  type: 'plaintiff' | 'defendant' | 'intervening';
}

interface ScrapeResult {
  success: boolean;
  caseInfo: CaseInfo;
  procedures: Procedure[];
  parties: Party[];
  nextSessionDate: string | null;
  error: string | null;
}

// ── البحث عن Chromium ──
function findChromium(): string {
  if (CHROMIUM_PATH && existsSync(CHROMIUM_PATH)) return CHROMIUM_PATH;

  const candidates = [
    '/nix/var/nix/profiles/sandbox/bin/chromium',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
  ];

  for (const path of candidates) {
    if (existsSync(path)) return path;
  }

  // Try which
  try {
    return execSync('which chromium || which chromium-browser || which google-chrome', {
      encoding: 'utf-8',
    }).trim().split('\n')[0];
  } catch {
    return '';
  }
}

// ── تحويل التاريخ ──
function parseDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const clean = dateStr.trim().split(' ')[0];
  const match = clean.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (match) return `${match[3]}-${match[2]}-${match[1]}`;
  return clean;
}

// ── الدالة الرئيسية للبحث ──
async function searchMahakim(
  numero: string,
  code: string,
  annee: string,
  courtName = '',
  primaryCourt = '',
): Promise<ScrapeResult> {
  const result: ScrapeResult = {
    success: false,
    caseInfo: {},
    procedures: [],
    parties: [],
    nextSessionDate: null,
    error: null,
  };

  const chromiumPath = findChromium();
  const launchOptions: Parameters<typeof chromium.launch>[0] = {
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  };
  if (chromiumPath) launchOptions.executablePath = chromiumPath;

  let browser: Browser | null = null;

  try {
    browser = await chromium.launch(launchOptions);
    const page = await browser.newPage({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    console.log(`[1] البحث عن ملف: ${numero}/${code}/${annee}`);
    await page.goto('https://www.mahakim.ma/#/suivi/dossier-suivi', {
      timeout: 60000,
      waitUntil: 'domcontentloaded',
    });
    await page.waitForTimeout(5000);

    // ── تعبئة الحقول ──
    const inputs = await page.$$('input');
    if (inputs.length < 3) {
      result.error = 'لم يتم العثور على حقول البحث';
      return result;
    }

    await inputs[0].fill(numero);
    await page.waitForTimeout(300);
    await inputs[1].fill(code);
    await page.waitForTimeout(300);
    await inputs[2].fill(annee);
    await page.waitForTimeout(3000);

    // ── اختيار محكمة الاستئناف ──
    const dropdowns = await page.$$('.p-dropdown');
    if (dropdowns.length > 0) {
      await dropdowns[0].click();
      await page.waitForTimeout(1500);
      const options = await page.$$('.p-dropdown-item, li.p-dropdown-item');

      let selected = false;
      const target = courtName || '';

      if (target) {
        for (const opt of options) {
          const txt = (await opt.innerText()).trim();
          if (target.includes(txt) || txt.includes(target)) {
            await opt.click();
            selected = true;
            console.log(`[2] تم اختيار المحكمة: ${txt}`);
            break;
          }
        }
      }

      if (!selected && options.length > 0) {
        const firstText = (await options[0].innerText()).trim();
        await options[0].click();
        selected = true;
        console.log(`[2] تم اختيار أول محكمة: ${firstText}`);
      }

      if (!selected) {
        result.error = 'لم يتم العثور على خيارات المحاكم';
        return result;
      }

      await page.waitForTimeout(1500);
    }

    // ── اختيار المحكمة الابتدائية ──
    if (primaryCourt) {
      const cbLabel = await page.$('text=هل تريد البحث بالمحاكم الابتدائية');
      if (cbLabel) {
        await cbLabel.click();
      } else {
        const cbBox = await page.$('.p-checkbox, p-checkbox');
        if (cbBox) await cbBox.click();
      }
      await page.waitForTimeout(2000);

      const dropdowns2 = await page.$$('.p-dropdown');
      if (dropdowns2.length > 1) {
        await dropdowns2[1].click();
        await page.waitForTimeout(1500);
        const opts2 = await page.$$('.p-dropdown-item, li.p-dropdown-item');
        for (const opt of opts2) {
          const txt = (await opt.innerText()).trim();
          if (primaryCourt.includes(txt) || txt.includes(primaryCourt)) {
            await opt.click();
            console.log(`[2b] محكمة ابتدائية: ${txt}`);
            break;
          }
        }
        await page.waitForTimeout(1000);
      }
    }

    // ── النقر على البحث ──
    const searchBtn = await page.$("button:has-text('بحث')");
    if (!searchBtn) {
      result.error = 'لم يتم العثور على زر البحث';
      return result;
    }

    await searchBtn.click();
    console.log('[3] تم النقر على البحث — انتظار النتائج...');
    await page.waitForTimeout(10000);

    const body = await page.innerText('body');

    if (body.includes('لا توجد أية نتيجة') && !body.includes('بطاقة الملف')) {
      result.error = 'لا توجد نتيجة للبحث بهذا الرقم والمحكمة';
      return result;
    }

    // ── استخراج بطاقة الملف ──
    const fieldMap: Record<string, keyof CaseInfo> = {
      'المحكمة': 'court',
      'رقم الملف بالمحكمة': 'file_number',
      'نوع الملف': 'case_type',
      'الرقم الوطني للملف': 'national_number',
      'الشعبة': 'department',
      'المستشار / القاضي المقرر': 'judge',
      'تاريخ التسجيل': 'registration_date',
      'الموضوع': 'subject',
      'آخر حكم/قرار': 'last_decision',
      'تاريخ آخر حكم / القرار': 'last_decision_date',
      'الحالة': 'status',
    };

    const info: CaseInfo = {};
    for (const [arLabel, enKey] of Object.entries(fieldMap)) {
      const escaped = arLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(escaped + '\\s*\\n\\s*(.+?)(?:\\n|$)');
      const match = body.match(pattern);
      if (match) {
        const val = match[1].trim();
        if (val && val !== arLabel) {
          info[enKey] = val;
        }
      }
    }

    // إصلاح حقل المحكمة
    if (info.court && info.court.includes('الرقم')) {
      const courtMatch = body.match(/المحكمة\s*\n\s*((?:المحكمة|محكمة)[^\n]+)/);
      if (courtMatch) {
        info.court = courtMatch[1].trim();
      } else {
        delete info.court;
      }
    }

    result.caseInfo = info;

    // ── استخراج الإجراءات ──
    const tables = await page.$$('table');
    const seenProcs = new Set<string>();

    for (const tbl of tables) {
      const rows = await tbl.$$('tr');
      for (const row of rows) {
        const cells = await row.$$('td');
        if (cells.length >= 3) {
          const actionDate = (await cells[0].innerText()).trim();
          const actionType = (await cells[1].innerText()).trim();
          const decision = cells.length > 2 ? (await cells[2].innerText()).trim() : '';
          const nextDate = cells.length > 3 ? (await cells[3].innerText()).trim() : '';

          if (actionDate && actionType) {
            const key = `${actionDate}|${actionType}`;
            if (seenProcs.has(key)) continue;
            seenProcs.add(key);

            const isoDate = parseDate(actionDate);
            const isoNext = parseDate(nextDate);

            result.procedures.push({
              action_date: isoDate,
              action_type: actionType.replace(/\n/g, ' ').trim(),
              decision: decision || null,
              next_session_date: isoNext,
            });

            // تحديد الجلسة المقبلة
            if (isoNext) {
              const dt = new Date(isoNext);
              if (dt > new Date()) {
                if (!result.nextSessionDate || isoNext < result.nextSessionDate) {
                  result.nextSessionDate = isoNext;
                }
              }
            }
          }
        }
      }
    }

    // ── استخراج الأطراف ──
    try {
      const partyTab = await page.$('text=لائحة الأطراف');
      if (partyTab) {
        await partyTab.click();
        await page.waitForTimeout(2000);

        const allTables = await page.$$('table');
        const skipWords = new Set([
          'الاسم', 'الصفة', 'العنوان', 'تاريخ الإجراء',
          'نوع الإجراء', 'القرار', 'تاريخ الجلسة المقبلة',
          'مدعي', 'مدعى عليه', 'متدخل', 'لا توجد', 'لائحة',
        ]);

        const roleWords = new Set(['مدعي', 'مدعى عليه', 'متدخل', 'طالب', 'مطلوب ضده']);

        for (const tbl of allTables) {
          const rows = await tbl.$$('tr');
          for (const row of rows) {
            const cells = await row.$$('td');
            if (cells.length >= 2) {
              const col0 = (await cells[0].innerText()).trim();
              const col1 = (await cells[1].innerText()).trim();

              const isCol0Role = roleWords.has(col0);
              const isCol1Role = roleWords.has(col1);

              let name: string;
              let role: string;

              if (isCol0Role && col1 && !isCol1Role) {
                name = col1; role = col0;
              } else if (isCol1Role && col0 && !isCol0Role) {
                name = col0; role = col1;
              } else if (col0 && !/^\d{2}\/\d{2}\/\d{4}/.test(col0) && !skipWords.has(col0)) {
                name = col0; role = col1;
              } else {
                continue;
              }

              if (!name || name.length < 3 || /^\d{2}\/\d{2}\/\d{4}/.test(name)) continue;

              let partyType: Party['type'] = 'plaintiff';
              if (role.includes('مدعى عليه') || role.includes('مطلوب')) partyType = 'defendant';
              else if (role.includes('متدخل')) partyType = 'intervening';

              if (!result.parties.some(p => p.name === name)) {
                result.parties.push({ name, type: partyType });
              }
            }
          }
        }
      }
    } catch { /* ignore */ }

    result.success = true;
    console.log(
      `[4] ✅ نجح الجلب — ${result.procedures.length} إجراء، ` +
      `الجلسة المقبلة: ${result.nextSessionDate || 'لا توجد'}`
    );

  } catch (e: any) {
    result.error = e.message || String(e);
    console.error(`[ERROR] ${result.error}`);
  } finally {
    if (browser) await browser.close();
  }

  return result;
}

// ── إرسال النتائج للـ webhook ──
async function sendToWebhook(
  jobId: string,
  caseId: string,
  userId: string,
  result: ScrapeResult,
): Promise<boolean> {
  const payload = {
    jobId,
    caseId,
    userId,
    success: result.success,
    error: result.error,
    caseInfo: result.caseInfo,
    procedures: result.procedures,
    nextSessionDate: result.nextSessionDate,
  };

  console.log(`[5] إرسال النتائج إلى webhook (${WEBHOOK_URL})...`);
  try {
    const resp = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const text = await resp.text();
    console.log(`[6] Webhook response: ${resp.status} — ${text.slice(0, 200)}`);
    return resp.status === 200;
  } catch (e: any) {
    console.error(`[webhook error] ${e.message}`);
    return false;
  }
}

// ── جلب المهام المعلقة من DB ──
async function fetchPendingJobs(): Promise<any[]> {
  if (!SUPABASE_KEY) return [];
  const url = `${SUPABASE_URL}/rest/v1/mahakim_sync_jobs?status=eq.pending&order=created_at.asc&limit=5`;
  try {
    const resp = await fetch(url, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    });
    return resp.ok ? await resp.json() : [];
  } catch {
    return [];
  }
}

// ── جلب مهمة محددة ──
async function fetchJobFromDb(jobId: string): Promise<any | null> {
  if (!SUPABASE_KEY) return null;
  const url = `${SUPABASE_URL}/rest/v1/mahakim_sync_jobs?id=eq.${jobId}&select=*`;
  try {
    const resp = await fetch(url, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    });
    const data = await resp.json();
    return data?.[0] || null;
  } catch {
    return null;
  }
}

// ── تحليل الأوامر ──
function parseArgs(): Record<string, string | boolean> {
  const args: Record<string, string | boolean> = {};
  const argv = process.argv.slice(2);

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--process-pending') {
      args.processPending = true;
    } else if (arg === '--json') {
      args.json = true;
    } else if (arg.startsWith('--')) {
      const key = arg.replace(/^--/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      args[key] = argv[++i] || '';
    }
  }
  return args;
}

// ── الدالة الرئيسية ──
async function main() {
  const args = parseArgs();

  // وضع معالجة المهام المعلقة
  if (args.processPending) {
    const jobs = await fetchPendingJobs();
    console.log(`وجدت ${jobs.length} مهمة معلقة`);
    for (const job of jobs) {
      const parts = (job.case_number || '').split('/');
      if (parts.length < 3) continue;

      const payload = job.request_payload || {};
      const result = await searchMahakim(
        parts[0], parts[1], parts[2],
        payload.appealCourt || '',
        payload.firstInstanceCourt || '',
      );
      await sendToWebhook(job.id, job.case_id, job.user_id, result);
      await new Promise(r => setTimeout(r, 5000));
    }
    return;
  }

  // وضع جلب مهمة محددة
  if (args.jobId) {
    const job = await fetchJobFromDb(args.jobId as string);
    if (!job) {
      console.log(`لم يتم العثور على المهمة: ${args.jobId}`);
      return;
    }
    const parts = (job.case_number || '').split('/');
    if (parts.length < 3) {
      console.log(`رقم ملف غير صالح: ${job.case_number}`);
      return;
    }
    const payload = job.request_payload || {};
    const result = await searchMahakim(
      parts[0], parts[1], parts[2],
      payload.appealCourt || '',
      payload.firstInstanceCourt || '',
    );
    await sendToWebhook(args.jobId as string, job.case_id, job.user_id, result);
    return;
  }

  // وضع البحث المباشر
  const numero = (args.numero as string) || '1';
  const code = (args.code as string) || '1101';
  const annee = (args.annee as string) || '2025';
  const court = (args.court as string) || '';
  const primaryCourt = (args.primaryCourt as string) || '';

  const result = await searchMahakim(numero, code, annee, court, primaryCourt);

  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`\n${'='.repeat(60)}`);
    if (result.success) {
      const info = result.caseInfo;
      console.log(`✅ الملف: ${info.file_number || 'N/A'}`);
      console.log(`   المحكمة: ${info.court || 'N/A'}`);
      console.log(`   القاضي: ${info.judge || 'N/A'}`);
      console.log(`   الشعبة: ${info.department || 'N/A'}`);
      console.log(`   النوع: ${info.case_type || 'N/A'}`);
      console.log(`   الإجراءات: ${result.procedures.length}`);
      console.log(`   الأطراف: ${result.parties.length}`);
      console.log(`   الجلسة المقبلة: ${result.nextSessionDate || 'لا توجد'}`);
    } else {
      console.log(`❌ خطأ: ${result.error}`);
    }
  }

  // إرسال للـ webhook إذا تم توفير case_id
  if (args.caseId && result.success) {
    await sendToWebhook(
      (args.jobId as string) || '',
      args.caseId as string,
      (args.userId as string) || '',
      result,
    );
  }
}

main().catch(console.error);
