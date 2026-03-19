const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const MAHAKIM_SEARCH_URL = "https://www.mahakim.ma/#/suivi/dossier-suivi";

/**
 * Build Firecrawl actions sequence to fill the mahakim.ma Angular form and extract results.
 * 
 * Flow:
 * 1. Wait for Angular app to load
 * 2. Fill case number fields (numero, mark/code, annee)
 * 3. Select appeal court from PrimeNG dropdown
 * 4. Optionally toggle primary court checkbox and select
 * 5. Click search button
 * 6. Wait for results
 */
function buildSearchActions(
  numero: string, 
  mark: string, 
  annee: string, 
  appealCourt?: string,
  primaryCourt?: string
) {
  const actions: Record<string, unknown>[] = [
    // Wait for Angular app to fully load
    { type: "wait", milliseconds: 4000 },

    // Fill the 3 case number fields
    // Field 1: Case number (رقم الملف)
    { type: "click", selector: "input[placeholder*='رقم'], input[type='number']:first-of-type, .p-inputtext:first-of-type" },
    { type: "write", text: numero, selector: "input[placeholder*='رقم'], input[type='number']:first-of-type, .p-inputtext:first-of-type" },

    // Field 2: Code/Mark (الرمز)
    { type: "click", selector: "input[placeholder*='رمز'], input[type='number']:nth-of-type(2), .p-inputtext:nth-of-type(2)" },
    { type: "write", text: mark, selector: "input[placeholder*='رمز'], input[type='number']:nth-of-type(2), .p-inputtext:nth-of-type(2)" },

    // Field 3: Year (السنة)
    { type: "click", selector: "input[placeholder*='سنة'], input[type='number']:nth-of-type(3), .p-inputtext:nth-of-type(3)" },
    { type: "write", text: annee, selector: "input[placeholder*='سنة'], input[type='number']:nth-of-type(3), .p-inputtext:nth-of-type(3)" },
  ];

  // Select appeal court if specified
  if (appealCourt) {
    actions.push(
      // Click the first PrimeNG dropdown (appeal court)
      { type: "click", selector: "p-dropdown:first-of-type .p-dropdown, .p-dropdown:first-of-type" },
      { type: "wait", milliseconds: 1000 },
      // Try to find and click the matching court option
      { type: "executeJavascript", script: `
        const items = document.querySelectorAll('.p-dropdown-item, .p-dropdown-items li');
        for (const item of items) {
          if (item.textContent.includes('${appealCourt}')) {
            item.click();
            break;
          }
        }
      `},
      { type: "wait", milliseconds: 500 },
    );
  }

  // If primary court specified, toggle checkbox and select
  if (primaryCourt) {
    actions.push(
      // Click the primary court checkbox/toggle
      { type: "click", selector: "p-checkbox .p-checkbox-box, .p-checkbox:first-of-type, input[type='checkbox']" },
      { type: "wait", milliseconds: 1000 },
      // Click second dropdown (primary court)
      { type: "click", selector: "p-dropdown:nth-of-type(2) .p-dropdown, .p-dropdown:nth-of-type(2)" },
      { type: "wait", milliseconds: 1000 },
      { type: "executeJavascript", script: `
        const items = document.querySelectorAll('.p-dropdown-item, .p-dropdown-items li');
        for (const item of items) {
          if (item.textContent.includes('${primaryCourt}')) {
            item.click();
            break;
          }
        }
      `},
      { type: "wait", milliseconds: 500 },
    );
  }

  // Click search button
  actions.push(
    { type: "click", selector: "button[type='submit'], button.p-button, .btn-search, button[label*='بحث']" },
    // Wait for results to load
    { type: "wait", milliseconds: 5000 },
    // Take screenshot for debugging
    { type: "screenshot" },
  );

  return actions;
}

/**
 * Parse the scraped HTML/markdown to extract case info and sessions
 */
function parseResults(markdown?: string, html?: string) {
  const result: Record<string, unknown> = {};

  const content = markdown || html || '';
  
  if (!content || content.length < 100) {
    return { error: 'لم يتم العثور على نتائج', raw_length: content.length };
  }

  // Extract case card info from markdown
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
    if (match) {
      result[key] = match[1].trim();
    }
  }

  // Extract sessions/procedures table
  const sessions: Record<string, string>[] = [];
  
  // Try to find table rows in markdown (| col1 | col2 | pattern)
  const tableRows = content.match(/\|[^|\n]+\|[^|\n]+\|[^|\n]*\|?[^|\n]*\|?/g);
  if (tableRows && tableRows.length > 2) {
    // Skip header and separator rows
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
    // Find the next upcoming session
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, numero, mark, annee, appealCourt, primaryCourt } = await req.json();

    const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
    if (!FIRECRAWL_API_KEY) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Firecrawl غير مهيأ. يرجى ربط Firecrawl connector.' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Action: Search for a case/dossier using Firecrawl actions
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

      console.log(`Searching dossier via Firecrawl: ${numero}/${mark}/${annee}`);

      const actions = buildSearchActions(numero, mark, annee, appealCourt, primaryCourt);

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
          actions,
        }),
      });

      const scrapeData = await scrapeRes.json();

      if (!scrapeRes.ok) {
        console.error('Firecrawl error:', JSON.stringify(scrapeData));
        return new Response(JSON.stringify({
          success: false,
          error: `خطأ في Firecrawl: ${scrapeData.error || scrapeRes.status}`,
        }), {
          status: scrapeRes.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const markdown = scrapeData.data?.markdown || scrapeData.markdown;
      const html = scrapeData.data?.html || scrapeData.html;
      const screenshots = scrapeData.data?.actions?.screenshots;

      const parsed = parseResults(markdown, html);

      return new Response(JSON.stringify({
        success: true,
        data: parsed,
        screenshots: screenshots?.length ? `${screenshots.length} screenshot(s) captured` : null,
        source: 'firecrawl-actions',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Action: Get available courts by scraping the page
    if (action === 'getCourts') {
      console.log('Fetching courts list via Firecrawl...');

      const scrapeRes = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: MAHAKIM_SEARCH_URL,
          formats: ['html'],
          waitFor: 5000,
          actions: [
            { type: "wait", milliseconds: 4000 },
            // Open the appeal court dropdown to load options
            { type: "click", selector: "p-dropdown:first-of-type .p-dropdown, .p-dropdown:first-of-type" },
            { type: "wait", milliseconds: 2000 },
            { type: "screenshot" },
          ],
        }),
      });

      const scrapeData = await scrapeRes.json();
      
      if (!scrapeRes.ok) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'لم نتمكن من جلب قائمة المحاكم',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Extract dropdown options from HTML
      const html = scrapeData.data?.html || scrapeData.html || '';
      const courts: string[] = [];
      const optionRegex = /<li[^>]*class="[^"]*p-dropdown-item[^"]*"[^>]*>(.*?)<\/li>/gi;
      let match;
      while ((match = optionRegex.exec(html)) !== null) {
        const text = match[1].replace(/<[^>]*>/g, '').trim();
        if (text && text !== '--') {
          courts.push(text);
        }
      }

      return new Response(JSON.stringify({ 
        success: true, 
        data: courts,
        source: 'firecrawl-actions',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ 
      success: false, 
      error: 'إجراء غير معروف. الإجراءات المتاحة: getCourts, searchDossier' 
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
