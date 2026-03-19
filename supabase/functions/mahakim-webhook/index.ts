import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/* ── Supabase Admin ── */
function getSupabaseAdmin() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}

/* ── Verify webhook secret ── */
function verifyWebhookSecret(req: Request): boolean {
  const secret = req.headers.get('x-webhook-secret');
  const expected = Deno.env.get('MAHAKIM_WEBHOOK_SECRET');
  if (!expected) return true; // If no secret configured, allow (for initial setup)
  return secret === expected;
}

/* ── Parse extracted data from BaaS provider ── */
function normalizePayload(raw: Record<string, unknown>): {
  jobId: string;
  caseId: string;
  userId: string;
  success: boolean;
  error?: string;
  caseInfo: Record<string, string>;
  procedures: Array<Record<string, string>>;
  nextSessionDate?: string;
} {
  // Support both Apify webhook format and direct POST
  const data = (raw.resource as Record<string, unknown>) || raw;
  const results = (data.results as Record<string, unknown>) || (data as Record<string, unknown>);

  return {
    jobId: (results.jobId || raw.jobId || '') as string,
    caseId: (results.caseId || raw.caseId || '') as string,
    userId: (results.userId || raw.userId || '') as string,
    success: (results.success ?? raw.success ?? false) as boolean,
    error: (results.error || raw.error) as string | undefined,
    caseInfo: (results.caseInfo || results.case_info || {}) as Record<string, string>,
    procedures: (results.procedures || results.sessions || []) as Array<Record<string, string>>,
    nextSessionDate: (results.nextSessionDate || results.next_session_date) as string | undefined,
  };
}

/* ── Apply scraped data to database ── */
async function applyScrapedData(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  caseId: string,
  userId: string,
  caseInfo: Record<string, string>,
  procedures: Array<Record<string, string>>,
  nextSessionDateStr?: string,
): Promise<{ log: string[]; nextDateISO: string | null }> {
  const log: string[] = [];

  // 1. Update case metadata
  const caseUpdates: Record<string, unknown> = {
    last_synced_at: new Date().toISOString(),
    last_sync_result: { caseInfo, procedures, synced_via: 'court_data_bridge' },
  };
  if (caseInfo.judge) caseUpdates.mahakim_judge = caseInfo.judge;
  if (caseInfo.department) caseUpdates.mahakim_department = caseInfo.department;
  if (caseInfo.status) caseUpdates.mahakim_status = caseInfo.status;
  if (caseInfo.court) caseUpdates.court = caseInfo.court;

  await supabase.from('cases').update(caseUpdates).eq('id', caseId);
  log.push('تم تحديث بيانات الملف');

  // 2. Insert new procedures (deduplicate)
  if (procedures.length > 0) {
    const { data: existingProcs } = await supabase
      .from('case_procedures')
      .select('action_date, action_type')
      .eq('case_id', caseId)
      .eq('source', 'mahakim');

    const existingKeys = new Set(
      (existingProcs || []).map((p: any) => `${p.action_date}|${p.action_type}`)
    );

    const newProcs = procedures
      .filter(p => !existingKeys.has(`${p.action_date}|${p.action_type}`))
      .map(p => ({
        case_id: caseId,
        action_date: p.action_date || null,
        action_type: p.action_type || p.type || '',
        decision: p.decision || null,
        next_session_date: p.next_session_date || p.next_date || null,
        source: 'mahakim',
        is_manual: false,
      }));

    if (newProcs.length > 0) {
      await supabase.from('case_procedures').insert(newProcs);
      log.push(`تم إضافة ${newProcs.length} إجراء جديد`);
    }

    // 3. Resolve conflicts: court data overrides manual entries
    const { data: manualProcs } = await supabase
      .from('case_procedures')
      .select('*')
      .eq('case_id', caseId)
      .eq('is_manual', true);

    for (const manual of manualProcs || []) {
      const courtMatch = procedures.find(
        p => p.action_date === (manual as any).action_date && p.action_type !== (manual as any).action_type
      );
      if (courtMatch) {
        await supabase.from('case_procedures').update({
          action_type: courtMatch.action_type || courtMatch.type,
          decision: courtMatch.decision,
          next_session_date: courtMatch.next_session_date || courtMatch.next_date,
          source: 'mahakim',
          is_manual: false,
          conflict_log: {
            resolved_at: new Date().toISOString(),
            original_manual: { action_type: (manual as any).action_type, decision: (manual as any).decision },
            court_data: courtMatch,
            resolution: 'court_priority',
          },
        }).eq('id', (manual as any).id);
        log.push(`تعارض محلول: ${(manual as any).action_type} ← ${courtMatch.action_type}`);
      }
    }
  }

  // 4. Create next court session if found
  let nextDateISO: string | null = null;

  // Try to find next session from procedures or explicit parameter
  const nextDateSource = nextSessionDateStr || findNextSessionDate(procedures);

  if (nextDateSource) {
    // Support both DD/MM/YYYY and YYYY-MM-DD formats
    if (nextDateSource.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
      const [d, m, y] = nextDateSource.split('/');
      nextDateISO = `${y}-${m}-${d}`;
    } else if (nextDateSource.match(/^\d{4}-\d{2}-\d{2}/)) {
      nextDateISO = nextDateSource.substring(0, 10);
    }

    if (nextDateISO) {
      const { data: existingSession } = await supabase
        .from('court_sessions')
        .select('id')
        .eq('case_id', caseId)
        .eq('session_date', nextDateISO)
        .limit(1);

      if (!existingSession || existingSession.length === 0) {
        await supabase.from('court_sessions').insert({
          case_id: caseId,
          session_date: nextDateISO,
          user_id: userId,
          notes: 'تم الجلب تلقائياً من بوابة محاكم عبر Court Data Bridge',
          status: 'scheduled',
        });
        log.push(`تم إنشاء جلسة مقبلة: ${nextDateISO}`);
      }
    }
  }

  return { log, nextDateISO };
}

/* ── Find next future session date from procedures ── */
function findNextSessionDate(procedures: Array<Record<string, string>>): string | null {
  const now = new Date();
  const futureDates = procedures
    .map(p => p.next_session_date || p.next_date || '')
    .filter(d => d.match(/\d{2}\/\d{2}\/\d{4}/))
    .map(d => {
      const [day, month, year] = d.split('/');
      return { raw: d, date: new Date(`${year}-${month}-${day}`) };
    })
    .filter(d => d.date >= now)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  return futureDates.length > 0 ? futureDates[0].raw : null;
}

/* ── Main Handler ── */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify webhook authenticity
    if (!verifyWebhookSecret(req)) {
      console.error('[webhook] Invalid webhook secret');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const rawBody = await req.json();
    console.log('[webhook] Received payload keys:', Object.keys(rawBody));

    const payload = normalizePayload(rawBody);
    const supabase = getSupabaseAdmin();

    // If no jobId, try to find it from caseId
    let jobId = payload.jobId;
    if (!jobId && payload.caseId) {
      const { data: jobs } = await supabase
        .from('mahakim_sync_jobs')
        .select('id')
        .eq('case_id', payload.caseId)
        .in('status', ['pending', 'scraping'])
        .order('created_at', { ascending: false })
        .limit(1);
      if (jobs && jobs.length > 0) jobId = jobs[0].id;
    }

    // Handle failure from BaaS
    if (!payload.success) {
      console.error('[webhook] BaaS reported failure:', payload.error);

      if (jobId) {
        await supabase.from('mahakim_sync_jobs').update({
          status: 'failed',
          error_message: payload.error || 'فشل جلب البيانات من بوابة محاكم',
          updated_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        }).eq('id', jobId);
      }

      return new Response(JSON.stringify({ received: true, status: 'failure_recorded' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Process successful scrape
    const { log, nextDateISO } = await applyScrapedData(
      supabase,
      payload.caseId,
      payload.userId,
      payload.caseInfo,
      payload.procedures,
      payload.nextSessionDate,
    );

    // Update sync job as completed
    if (jobId) {
      await supabase.from('mahakim_sync_jobs').update({
        status: 'completed',
        result_data: {
          caseInfo: payload.caseInfo,
          procedures: payload.procedures,
          mapping_log: log,
          synced_via: 'court_data_bridge',
        },
        next_session_date: nextDateISO,
        updated_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      }).eq('id', jobId);
    }

    console.log(`[webhook] Successfully processed case ${payload.caseId}. Log: ${log.join(', ')}`);

    return new Response(JSON.stringify({
      received: true,
      status: 'processed',
      mapping_log: log,
      next_session_date: nextDateISO,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[webhook] Error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'خطأ في معالجة البيانات',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
