import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-key",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify admin key
    const adminKey = req.headers.get("x-admin-key");
    const expectedKey = Deno.env.get("ADMIN_PROXY_KEY");
    
    if (!expectedKey || adminKey !== expectedKey) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const { action, params } = body;

    let result: unknown;

    switch (action) {
      // ── قراءة بيانات من أي جدول ──
      case "select": {
        const { table, filters, limit, order } = params;
        let query = supabaseAdmin.from(table).select(params.select || "*");
        if (filters) {
          for (const [col, val] of Object.entries(filters)) {
            query = query.eq(col, val);
          }
        }
        if (order) query = query.order(order.column, { ascending: order.ascending ?? false });
        if (limit) query = query.limit(limit);
        const { data, error } = await query;
        if (error) throw error;
        result = data;
        break;
      }

      // ── إدراج صفوف ──
      case "insert": {
        const { table, rows } = params;
        const { data, error } = await supabaseAdmin.from(table).insert(rows).select();
        if (error) throw error;
        result = data;
        break;
      }

      // ── تحديث صفوف ──
      case "update": {
        const { table, values, filters } = params;
        let query = supabaseAdmin.from(table).update(values);
        for (const [col, val] of Object.entries(filters as Record<string, unknown>)) {
          query = query.eq(col, val);
        }
        const { data, error } = await query.select();
        if (error) throw error;
        result = data;
        break;
      }

      // ── حذف صفوف ──
      case "delete": {
        const { table, filters } = params;
        let query = supabaseAdmin.from(table).delete();
        for (const [col, val] of Object.entries(filters as Record<string, unknown>)) {
          query = query.eq(col, val);
        }
        const { data, error } = await query.select();
        if (error) throw error;
        result = data;
        break;
      }

      // ── استدعاء دالة RPC ──
      case "rpc": {
        const { fn, args } = params;
        const { data, error } = await supabaseAdmin.rpc(fn, args || {});
        if (error) throw error;
        result = data;
        break;
      }

      // ── إنشاء مستخدم ──
      case "create_user": {
        const { email, password, user_metadata } = params;
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata,
        });
        if (error) throw error;
        result = data;
        break;
      }

      // ── قائمة المستخدمين ──
      case "list_users": {
        const { data, error } = await supabaseAdmin.auth.admin.listUsers();
        if (error) throw error;
        result = data.users.map((u) => ({
          id: u.id,
          email: u.email,
          created_at: u.created_at,
          user_metadata: u.user_metadata,
        }));
        break;
      }

      // ── حالة النظام ──
      case "health": {
        const { count: casesCount } = await supabaseAdmin.from("cases").select("*", { count: "exact", head: true });
        const { count: clientsCount } = await supabaseAdmin.from("clients").select("*", { count: "exact", head: true });
        const { count: usersCount } = await supabaseAdmin.from("profiles").select("*", { count: "exact", head: true });
        result = {
          status: "ok",
          timestamp: new Date().toISOString(),
          counts: { cases: casesCount, clients: clientsCount, users: usersCount },
        };
        break;
      }

      default:
        return new Response(JSON.stringify({
          error: `Unknown action: ${action}`,
          available: ["select", "insert", "update", "delete", "rpc", "create_user", "list_users", "health"],
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
