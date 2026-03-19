const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const MAHAKIM_API_BASE = "https://www.mahakim.ma/Ar/Services/SuiviAffaires_new/JFunctions/fn.aspx";

// Helper to call mahakim.ma internal .NET WebMethod API
async function mahakimPost(method: string, body: Record<string, unknown>) {
  const res = await fetch(`${MAHAKIM_API_BASE}/${method}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Origin': 'https://www.mahakim.ma',
      'Referer': 'https://www.mahakim.ma/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
    body: JSON.stringify(body),
  });
  
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Mahakim API ${method} failed [${res.status}]: ${text.substring(0, 200)}`);
  }
  
  const data = await res.json();
  return data.d || data;
}

// Fallback: Try the new Angular app's potential API patterns
async function tryNewApiPatterns(numero: string, mark: string, annee: string, idJuridiction?: string) {
  const possibleBases = [
    "https://www.mahakim.ma/api",
    "https://www.mahakim.ma/services",
    "https://www.mahakim.ma/suivi/api",
  ];

  const possibleEndpoints = [
    "/getDossier",
    "/searchDossier",
    "/dossier/search",
    "/suivi/dossier",
  ];

  const body = {
    numero,
    mark,
    annee,
    ...(idJuridiction ? { idJuridiction } : {}),
  };

  for (const base of possibleBases) {
    for (const endpoint of possibleEndpoints) {
      try {
        const res = await fetch(`${base}${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Origin': 'https://www.mahakim.ma',
            'Referer': 'https://www.mahakim.ma/',
          },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          const data = await res.json();
          return { source: `${base}${endpoint}`, data };
        }
        await res.text(); // consume body
      } catch {
        // Try next
      }
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, numero, mark, annee, typeJuridiction, idJuridiction } = await req.json();

    // Action: Get list of courts (jurisdictions)
    if (action === 'getCourts') {
      const type = typeJuridiction || 'TPI';
      console.log(`Getting courts for type: ${type}`);
      
      try {
        const courts = await mahakimPost('getCA', { typeJuridiction: type });
        return new Response(JSON.stringify({ success: true, data: courts }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (error) {
        console.log(`Old API failed for getCourts: ${error}`);
        // Return empty array if API is unavailable
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'واجهة محاكم غير متاحة حالياً',
          api_status: 'unavailable' 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Action: Search for a case/dossier
    if (action === 'searchDossier') {
      if (!numero || !mark || !annee) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'يرجى إدخال رقم الملف ورمزه والسنة' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`Searching dossier: ${numero}/${mark}/${annee} at court ${idJuridiction || 'any'}`);

      // Try multiple API endpoint patterns
      const searchMethods = [
        // Old .NET WebMethod patterns
        { method: 'getDossier', body: { numeroDossier: numero, codeDossier: mark, anneeDossier: annee, idJuridiction: idJuridiction || '' } },
        { method: 'SearchDossier', body: { numero, mark, annee, idJuridiction: idJuridiction || '' } },
        { method: 'rechercheDossier', body: { numero, codeDossier: mark, annee, idJuridiction: idJuridiction || '' } },
        { method: 'getDossierSuivi', body: { numeroDossier: numero, codeDossier: mark, anneeDossier: annee } },
        { method: 'GetDetailsDossier', body: { numeroDossier: numero, codeDossier: mark, anneeDossier: annee, idJuridiction: idJuridiction || '' } },
        { method: 'getResultDossier', body: { numero, code: mark, annee, idJuridiction: idJuridiction || '' } },
      ];

      for (const attempt of searchMethods) {
        try {
          console.log(`Trying ${attempt.method}...`);
          const result = await mahakimPost(attempt.method, attempt.body);
          if (result) {
            console.log(`Success with ${attempt.method}!`);
            return new Response(JSON.stringify({ 
              success: true, 
              data: result,
              source: `fn.aspx/${attempt.method}`,
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        } catch (error) {
          console.log(`${attempt.method} failed: ${error}`);
        }
      }

      // Try new API patterns
      console.log('Trying new API patterns...');
      const newApiResult = await tryNewApiPatterns(numero, mark, annee, idJuridiction);
      if (newApiResult) {
        return new Response(JSON.stringify({ 
          success: true, 
          data: newApiResult.data,
          source: newApiResult.source,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // All methods failed - try Firecrawl as last resort
      const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
      if (FIRECRAWL_API_KEY) {
        console.log('Trying Firecrawl scrape...');
        try {
          const scrapeRes = await fetch('https://api.firecrawl.dev/v1/scrape', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              url: `https://www.mahakim.ma/#/suivi/dossier-suivi`,
              formats: ['html', 'markdown'],
              waitFor: 5000,
            }),
          });
          
          const scrapeData = await scrapeRes.json();
          if (scrapeRes.ok && scrapeData.success) {
            return new Response(JSON.stringify({
              success: true,
              data: {
                html: scrapeData.data?.html,
                markdown: scrapeData.data?.markdown,
                note: 'تم جلب الصفحة لكن بدون تعبئة النموذج - يرجى استخدام البحث اليدوي أو سكربت Python'
              },
              source: 'firecrawl',
              api_status: 'api_unavailable_firecrawl_fallback',
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          await scrapeRes.text();
        } catch (e) {
          console.log(`Firecrawl failed: ${e}`);
        }
      }

      // Complete failure
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'لم نتمكن من الوصول إلى واجهة محاكم. يرجى استخدام البحث المباشر على الموقع أو سكربت Python.',
        api_status: 'all_methods_failed',
        tried_methods: searchMethods.map(m => m.method),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Action: Get child jurisdictions
    if (action === 'getChildCourts') {
      try {
        const courts = await mahakimPost('getJuridiction1instance', { 
          IdJuridiction2Instance: idJuridiction 
        });
        return new Response(JSON.stringify({ success: true, data: courts }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (error) {
        console.log(`getChildCourts failed: ${error}`);
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'واجهة محاكم غير متاحة',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(JSON.stringify({ 
      success: false, 
      error: 'إجراء غير معروف. الإجراءات المتاحة: getCourts, searchDossier, getChildCourts' 
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'خطأ غير معروف';
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
