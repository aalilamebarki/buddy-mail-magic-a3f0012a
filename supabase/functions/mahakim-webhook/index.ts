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

    // Insert procedures
    if (procedures?.length > 0) {
      const { data: existing } = await supabase
        .from('case_procedures')
        .select('action_date, action_type')
        .eq('case_id', caseId)
        .eq('source', 'mahakim');

      const existingKeys = new Set(
        (existing || []).map((p: any) => `${p.action_date}|${p.action_type}`)
      );

      const newProcs = procedures
        .filter((p: any) => !existingKeys.has(`${p.action_date}|${p.action_type}`))
        .map((p: any) => ({
          case_id: caseId,
          action_date: p.action_date || null,
          action_type: p.action_type || '',
          decision: p.decision || null,
          next_session_date: p.next_session_date || null,
          source: 'mahakim',
          is_manual: false,
        }));

      if (newProcs.length > 0) {
        await supabase.from('case_procedures').insert(newProcs);
      }
    }

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
