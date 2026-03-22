import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/* ── Auto-extract parties from scraped data ── */
async function autoExtractParties(
  supabase: ReturnType<typeof createClient>,
  caseId: string,
  caseInfo: Record<string, string>,
): Promise<number> {
  const { data: existing } = await supabase.from('case_opponents').select('id').eq('case_id', caseId).limit(1);
  if (existing && existing.length > 0) return 0;

  const { data: caseRow } = await supabase.from('cases').select('client_id').eq('id', caseId).single();
  let clientName = '';
  if (caseRow?.client_id) {
    const { data: client } = await supabase.from('clients').select('full_name').eq('id', caseRow.client_id).single();
    clientName = (client?.full_name || '').trim();
  }

  function isClientMatch(name: string): boolean {
    if (!clientName) return false;
    const n = name.trim();
    return n === clientName || clientName.includes(n) || n.includes(clientName);
  }

  const rawParties: { name: string; type: string }[] = [];
  if (caseInfo?.plaintiff) rawParties.push({ name: caseInfo.plaintiff, type: 'plaintiff' });
  if (caseInfo?.defendant) rawParties.push({ name: caseInfo.defendant, type: 'defendant' });
  if (caseInfo?.parties) rawParties.push({ name: caseInfo.parties, type: 'parties' });

  if (rawParties.length === 0) return 0;

  const institutionalPatterns = ['النيابة العامة', 'قاضي التوفيق', 'المحافظة على الأملاك العقارية', 'شركة التأمين', 'الوكيل القضائي'];
  const opponents: { case_id: string; name: string; party_type: string; sort_order: number }[] = [];
  const seen = new Set<string>();
  let sortOrder = 0;

  for (const { name: rawName, type } of rawParties) {
    for (const name of rawName.split(/[،,\n\r]+/).map((n: string) => n.trim()).filter((n: string) => n.length > 2)) {
      const key = name.replace(/\s+/g, ' ').trim();
      if (seen.has(key) || isClientMatch(key)) continue;
      seen.add(key);
      let partyType = 'opponent';
      if (type === 'intervening' || institutionalPatterns.some(p => key.includes(p))) partyType = 'intervening';
      else if (type === 'plaintiff') partyType = 'plaintiff';
      opponents.push({ case_id: caseId, name: key, party_type: partyType, sort_order: sortOrder++ });
    }
  }

  if (opponents.length === 0) return 0;
  await supabase.from('case_opponents').insert(opponents);
  return opponents.length;
}

/* ── Supabase Admin ── */
function getSupabaseAdmin() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}

/* ── Main Handler (kept for external integrations if needed) ── */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawBody = await req.json();
    console.log('[webhook] Received payload keys:', Object.keys(rawBody));

    const supabase = getSupabaseAdmin();
    const { jobId, caseId, userId, success, error, caseInfo, procedures, nextSessionDate } = rawBody;

    if (!caseId) {
      return new Response(JSON.stringify({ error: 'Missing caseId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find job if not provided
    let resolvedJobId = jobId;
    if (!resolvedJobId) {
      const { data: jobs } = await supabase
        .from('mahakim_sync_jobs')
        .select('id')
        .eq('case_id', caseId)
        .in('status', ['pending', 'scraping'])
        .order('created_at', { ascending: false })
        .limit(1);
      if (jobs && jobs.length > 0) resolvedJobId = jobs[0].id;
    }

    if (!success) {
      if (resolvedJobId) {
        await supabase.from('mahakim_sync_jobs').update({
          status: 'failed',
          error_message: error || 'فشل جلب البيانات',
          updated_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        }).eq('id', resolvedJobId);
      }
      return new Response(JSON.stringify({ received: true, status: 'failure_recorded' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update case metadata
    const caseUpdates: Record<string, unknown> = {
      last_synced_at: new Date().toISOString(),
      last_sync_result: { caseInfo, procedures },
    };
    if (caseInfo?.judge) caseUpdates.mahakim_judge = caseInfo.judge;
    if (caseInfo?.department) caseUpdates.mahakim_department = caseInfo.department;
    if (caseInfo?.status) caseUpdates.mahakim_status = caseInfo.status;
    if (caseInfo?.court) caseUpdates.court = caseInfo.court;
    await supabase.from('cases').update(caseUpdates).eq('id', caseId);

    // Delete old mahakim procedures then insert fresh data
    await supabase
      .from('case_procedures')
      .delete()
      .eq('case_id', caseId)
      .eq('source', 'mahakim')
      .eq('is_manual', false);

    if (procedures?.length > 0) {
      const newProcs = procedures.map((p: any) => ({
        case_id: caseId,
        action_date: p.action_date || null,
        action_type: p.action_type || '',
        decision: p.decision || null,
        next_session_date: p.next_session_date || null,
        source: 'mahakim',
        is_manual: false,
      }));

      await supabase.from('case_procedures').insert(newProcs);
    }

    // Auto-extract parties if none exist
    try {
      await autoExtractParties(supabase, caseId, caseInfo || {});
    } catch (_) { /* ignore */ }

    // Update job as completed
    if (resolvedJobId) {
      await supabase.from('mahakim_sync_jobs').update({
        status: 'completed',
        result_data: { caseInfo, procedures },
        updated_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      }).eq('id', resolvedJobId);
    }

    return new Response(JSON.stringify({ received: true, status: 'processed' }), {
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
