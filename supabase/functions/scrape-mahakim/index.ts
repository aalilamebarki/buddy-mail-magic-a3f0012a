import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/* ══════════════════════════════════════════════════════════════════
   scrape-mahakim — Orchestrator & Queue Manager
   
   Delegates actual scraping to fetch-dossier.
   Handles:
     - submitSyncJob: forwarded from DB trigger / UI
     - getLatestSync: query latest job status
     - bulkSync: enqueue all active cases
     - processQueue: process pending jobs (called by cron)
     - retryFailed: retry failed jobs with exponential backoff
   ══════════════════════════════════════════════════════════════════ */

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
    const supabase = getSupabaseAdmin();

    // ── Forward submitSyncJob to fetch-dossier ──
    if (action === 'submitSyncJob') {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

      try {
        const resp = await fetch(`${supabaseUrl}/functions/v1/fetch-dossier`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${anonKey}`,
            'apikey': anonKey,
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(120000),
        });

        const data = await resp.json();
        return new Response(JSON.stringify(data), {
          status: resp.ok ? 200 : 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (err) {
        // If fetch-dossier times out, mark job as failed
        if (body.jobId) {
          await supabase.from('mahakim_sync_jobs').update({
            status: 'failed',
            error_message: 'انتهت مهلة الاتصال بخدمة الجلب',
            completed_at: new Date().toISOString(),
          }).eq('id', body.jobId);
        }

        return new Response(JSON.stringify({
          success: false,
          error: err instanceof Error ? err.message : 'Timeout',
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // ── getLatestSync ──
    if (action === 'getLatestSync') {
      const { caseId } = body;
      const { data } = await supabase
        .from('mahakim_sync_jobs')
        .select('*')
        .eq('case_id', caseId)
        .order('created_at', { ascending: false })
        .limit(1);

      return new Response(JSON.stringify({ success: true, data: data?.[0] || null }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── bulkSync: enqueue all active cases ──
    if (action === 'bulkSync') {
      const { userId } = body;
      const { data: cases } = await supabase
        .from('cases')
        .select('id, case_number')
        .neq('case_number', '')
        .not('case_number', 'is', null)
        .eq('status', 'active');

      if (!cases || cases.length === 0) {
        return new Response(JSON.stringify({ success: true, message: 'لا توجد ملفات نشطة', processed: 0 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      let triggered = 0;
      for (const c of cases) {
        const { data: existing } = await supabase
          .from('mahakim_sync_jobs')
          .select('id')
          .eq('case_id', c.id)
          .in('status', ['pending', 'scraping'])
          .limit(1);

        if (existing && existing.length > 0) continue;

        await supabase.from('mahakim_sync_jobs').insert({
          id: crypto.randomUUID(),
          case_id: c.id,
          user_id: userId || '00000000-0000-0000-0000-000000000000',
          case_number: c.case_number!,
          status: 'pending',
          request_payload: { auto_triggered: true, bulk: true },
        });
        triggered++;
      }

      return new Response(JSON.stringify({ success: true, triggered, total: cases.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── retryFailed: retry failed jobs that haven't exceeded max retries ──
    if (action === 'retryFailed') {
      const { data: failedJobs } = await supabase
        .from('mahakim_sync_jobs')
        .select('*')
        .eq('status', 'failed')
        .lt('retry_count', 2)
        .order('created_at', { ascending: true })
        .limit(10);

      if (!failedJobs || failedJobs.length === 0) {
        return new Response(JSON.stringify({ success: true, retried: 0 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      let retried = 0;
      for (const job of failedJobs) {
        await supabase.from('mahakim_sync_jobs').update({
          status: 'pending',
          retry_count: (job.retry_count || 0) + 1,
          error_message: null,
          updated_at: new Date().toISOString(),
        }).eq('id', job.id);
        retried++;
      }

      return new Response(JSON.stringify({ success: true, retried }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── autoRefresh48h: re-sync cases where 48h passed since last sync ──
    if (action === 'autoRefresh48h') {
      const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

      const { data: staleCases } = await supabase
        .from('cases')
        .select('id, case_number, assigned_to')
        .neq('case_number', '')
        .not('case_number', 'is', null)
        .eq('status', 'active')
        .or(`last_synced_at.is.null,last_synced_at.lt.${cutoff}`);

      if (!staleCases || staleCases.length === 0) {
        return new Response(JSON.stringify({ success: true, message: 'لا توجد ملفات تحتاج تحديثاً', refreshed: 0 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      let triggered = 0;
      for (const c of staleCases) {
        // Skip if already has a pending/scraping job
        const { data: existing } = await supabase
          .from('mahakim_sync_jobs')
          .select('id')
          .eq('case_id', c.id)
          .in('status', ['pending', 'scraping'])
          .limit(1);

        if (existing && existing.length > 0) continue;

        const jobId = crypto.randomUUID();
        await supabase.from('mahakim_sync_jobs').insert({
          id: jobId,
          case_id: c.id,
          user_id: c.assigned_to || '00000000-0000-0000-0000-000000000000',
          case_number: c.case_number!,
          status: 'pending',
          request_payload: { auto_triggered: true, refresh_48h: true },
        });
        triggered++;
      }

      // Trigger queue processing if any jobs were created
      if (triggered > 0) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

        fetch(`${supabaseUrl}/functions/v1/fetch-dossier`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${anonKey}`,
            'apikey': anonKey,
          },
          body: JSON.stringify({ action: 'processQueue' }),
        }).catch(() => {});
      }

      return new Response(JSON.stringify({ success: true, refreshed: triggered, total: staleCases.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── processQueue: forward to fetch-dossier ──
    if (action === 'processQueue') {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

      const resp = await fetch(`${supabaseUrl}/functions/v1/fetch-dossier`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`,
          'apikey': anonKey,
        },
        body: JSON.stringify({ action: 'processQueue' }),
        signal: AbortSignal.timeout(120000),
      });

      const data = await resp.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: false,
      error: 'إجراء غير معروف. الإجراءات المتاحة: submitSyncJob, getLatestSync, bulkSync, processQueue, retryFailed',
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'خطأ غير معروف',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
