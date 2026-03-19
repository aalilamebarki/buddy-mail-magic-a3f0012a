import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const MAHAKIM_SEARCH_URL = "https://www.mahakim.ma/#/suivi/dossier-suivi";

/**
 * Build Firecrawl actions to fill the mahakim.ma Angular form and extract results.
 */
function buildSearchActions(numero: string, mark: string, annee: string, appealCourt?: string) {
  const actions: Record<string, unknown>[] = [
    { type: "wait", milliseconds: 4000 },
    { type: "click", selector: "input[placeholder*='رقم'], input[type='number']:first-of-type, .p-inputtext:first-of-type" },
    { type: "write", text: numero, selector: "input[placeholder*='رقم'], input[type='number']:first-of-type, .p-inputtext:first-of-type" },
    { type: "click", selector: "input[placeholder*='رمز'], input[type='number']:nth-of-type(2), .p-inputtext:nth-of-type(2)" },
    { type: "write", text: mark, selector: "input[placeholder*='رمز'], input[type='number']:nth-of-type(2), .p-inputtext:nth-of-type(2)" },
    { type: "click", selector: "input[placeholder*='سنة'], input[type='number']:nth-of-type(3), .p-inputtext:nth-of-type(3)" },
    { type: "write", text: annee, selector: "input[placeholder*='سنة'], input[type='number']:nth-of-type(3), .p-inputtext:nth-of-type(3)" },
  ];

  if (appealCourt) {
    actions.push(
      { type: "click", selector: "p-dropdown:first-of-type .p-dropdown, .p-dropdown:first-of-type" },
      { type: "wait", milliseconds: 1000 },
      { type: "executeJavascript", script: `
        const items = document.querySelectorAll('.p-dropdown-item, .p-dropdown-items li');
        for (const item of items) {
          if (item.textContent.includes('${appealCourt}')) { item.click(); break; }
        }
      `},
      { type: "wait", milliseconds: 500 },
    );
  }

  actions.push(
    { type: "click", selector: "button[type='submit'], button.p-button, .btn-search, button[label*='بحث']" },
    { type: "wait", milliseconds: 5000 },
    { type: "screenshot" },
  );

  return actions;
}

/**
 * Parse scraped HTML/markdown to extract case info and sessions.
 */
function parseResults(markdown?: string, html?: string) {
  const result: Record<string, unknown> = {};
  const content = markdown || html || '';

  if (!content || content.length < 100) {
    return { error: 'لم يتم العثور على نتائج', raw_length: content.length };
  }

  const fieldPatterns: Record<string, RegExp> = {
    court: /المحكمة[:\s]*([^\n|]+)/,
    national_number: /الرقم الوطني[:\s]*([^\n|]+)/,
    case_type: /نوع القضية[:\s]*([^\n|]+)/,
    department: /الشعبة[:\s]*([^\n|]+)/,
    judge: /القاضي المقرر[:\s]*([^\n|]+)/,
    subject: /الموضوع[:\s]*([^\n|]+)/,
    registration_date: /تاريخ التسجيل[:\s]*([^\n|]+)/,
    latest_judgment: /آخر حكم[:\s]*([^\n|]+)/,
  };

  for (const [key, pattern] of Object.entries(fieldPatterns)) {
    const match = content.match(pattern);
    if (match) result[key] = match[1].trim();
  }

  const sessions: Record<string, string>[] = [];
  const tableRows = content.match(/\|[^|\n]+\|[^|\n]+\|[^|\n]*\|?[^|\n]*\|?/g);
  if (tableRows && tableRows.length > 2) {
    const dataRows = tableRows.slice(2);
    for (const row of dataRows) {
      const cells = row.split('|').map(c => c.trim()).filter(c => c && c !== '---');
      if (cells.length >= 3) {
        sessions.push({
          action_date: cells[0] || '',
          action_type: cells[1] || '',
          decision: cells[2] || '',
          next_session_date: cells[3] || '',
        });
      }
    }
  }

  if (sessions.length > 0) {
    result.sessions = sessions;
    const now = new Date();
    const futureSessions = sessions
      .filter(s => s.next_session_date && s.next_session_date.match(/\d{2}\/\d{2}\/\d{4}/))
      .map(s => {
        const [d, m, y] = s.next_session_date.split('/');
        return { ...s, date: new Date(`${y}-${m}-${d}`) };
      })
      .filter(s => s.date >= now)
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    if (futureSessions.length > 0) {
      result.next_session_date = futureSessions[0].next_session_date;
    }
  }

  result.raw_content_length = content.length;
  return result;
}

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action } = body;

    // ── ACTION: submitSyncJob ──
    // Creates a sync job record and fires Firecrawl async scrape
    if (action === 'submitSyncJob') {
      const { jobId, caseId, userId, caseNumber, appealCourt } = body;

      if (!jobId || !caseId || !caseNumber) {
        return new Response(JSON.stringify({ success: false, error: 'بيانات ناقصة' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
      if (!FIRECRAWL_API_KEY) {
        return new Response(JSON.stringify({ success: false, error: 'Firecrawl غير مهيأ' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const supabaseAdmin = getSupabaseAdmin();

      // Update job to 'scraping'
      await supabaseAdmin.from('mahakim_sync_jobs').update({
        status: 'scraping',
        updated_at: new Date().toISOString(),
      }).eq('id', jobId);

      // Parse case number
      const parts = caseNumber.split('/');
      const numero = parts[0] || '';
      const mark = parts[1] || '';
      const annee = parts[2] || '';

      const actions = buildSearchActions(numero, mark, annee, appealCourt);

      // Build the webhook URL for Firecrawl to call back
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const webhookUrl = `${supabaseUrl}/functions/v1/scrape-mahakim`;

      console.log(`Submitting async scrape for job ${jobId}: ${caseNumber}`);

      // Fire Firecrawl scrape — we DON'T wait for the full result
      // Instead we use a non-blocking fetch with a short timeout
      // and handle the result in the webhook action
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s max wait

      try {
        const scrapeRes = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: MAHAKIM_SEARCH_URL,
            formats: ['markdown', 'html'],
            waitFor: 5000,
            timeout: 55000,
            actions,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const scrapeData = await scrapeRes.json();

        if (!scrapeRes.ok) {
          console.error('Firecrawl error:', JSON.stringify(scrapeData));
          await supabaseAdmin.from('mahakim_sync_jobs').update({
            status: 'failed',
            error_message: `خطأ Firecrawl: ${scrapeData.error || scrapeRes.status}`,
            updated_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
          }).eq('id', jobId);

          return new Response(JSON.stringify({ success: false, error: 'فشل الجلب من Firecrawl' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Parse results
        const markdown = scrapeData.data?.markdown || scrapeData.markdown;
        const html = scrapeData.data?.html || scrapeData.html;
        const parsed = parseResults(markdown, html);

        const hasError = parsed.error && !parsed.court;
        const nextDateStr = parsed.next_session_date as string | undefined;

        // Convert next_session_date from DD/MM/YYYY to YYYY-MM-DD
        let nextDateISO: string | null = null;
        if (nextDateStr && nextDateStr.match(/\d{2}\/\d{2}\/\d{4}/)) {
          const [d, m, y] = nextDateStr.split('/');
          nextDateISO = `${y}-${m}-${d}`;
        }

        // Update the sync job with results
        await supabaseAdmin.from('mahakim_sync_jobs').update({
          status: hasError ? 'failed' : 'completed',
          result_data: parsed,
          error_message: hasError ? (parsed.error as string) : null,
          next_session_date: nextDateISO,
          updated_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        }).eq('id', jobId);

        // Update the case with last sync info
        await supabaseAdmin.from('cases').update({
          last_synced_at: new Date().toISOString(),
          last_sync_result: parsed,
        }).eq('id', caseId);

        // If we got a next session date, auto-create a court session if not exists
        if (nextDateISO && userId) {
          const { data: existing } = await supabaseAdmin
            .from('court_sessions')
            .select('id')
            .eq('case_id', caseId)
            .eq('session_date', nextDateISO)
            .limit(1);

          if (!existing || existing.length === 0) {
            await supabaseAdmin.from('court_sessions').insert({
              case_id: caseId,
              session_date: nextDateISO,
              user_id: userId,
              notes: 'تم الجلب تلقائياً من بوابة محاكم',
              status: 'scheduled',
            });
          }
        }

        return new Response(JSON.stringify({
          success: true,
          status: hasError ? 'failed' : 'completed',
          data: parsed,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      } catch (fetchErr) {
        clearTimeout(timeoutId);

        // Timeout — mark as timed_out with a user-friendly message
        const isTimeout = fetchErr instanceof DOMException && fetchErr.name === 'AbortError';

        await supabaseAdmin.from('mahakim_sync_jobs').update({
          status: 'failed',
          error_message: isTimeout
            ? 'انتهت مهلة الاتصال ببوابة محاكم. البوابة بطيئة حالياً — يرجى المحاولة لاحقاً أو استخدام الرابط المباشر.'
            : `خطأ: ${fetchErr instanceof Error ? fetchErr.message : 'غير معروف'}`,
          updated_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        }).eq('id', jobId);

        return new Response(JSON.stringify({
          success: false,
          error: isTimeout ? 'timeout' : 'fetch_error',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // ── ACTION: getLatestSync ──
    if (action === 'getLatestSync') {
      const { caseId } = body;
      if (!caseId) {
        return new Response(JSON.stringify({ success: false, error: 'caseId مطلوب' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const supabaseAdmin = getSupabaseAdmin();
      const { data } = await supabaseAdmin
        .from('mahakim_sync_jobs')
        .select('*')
        .eq('case_id', caseId)
        .order('created_at', { ascending: false })
        .limit(1);

      return new Response(JSON.stringify({
        success: true,
        data: data?.[0] || null,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: false,
      error: 'إجراء غير معروف. الإجراءات المتاحة: submitSyncJob, getLatestSync',
    }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'خطأ غير معروف';
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
