/**
 * ═══════════════════════════════════════════════════════════════════
 * Google Apps Script — Mahakim.ma Proxy Bridge (جسر محاكم)
 * ═══════════════════════════════════════════════════════════════════
 * 
 * 📋 خطوات التثبيت:
 * 1. اذهب إلى https://script.google.com
 * 2. أنشئ مشروعاً جديداً (New Project)
 * 3. انسخ هذا الكود بالكامل والصقه في المحرر
 * 4. اضغط "Deploy" → "New Deployment"
 * 5. اختر "Web app"
 * 6. Execute as: "Me" | Who has access: "Anyone"
 * 7. اضغط "Deploy" وانسخ رابط Web App URL
 * 8. ضع الرابط في إعدادات التطبيق
 * 
 * ═══════════════════════════════════════════════════════════════════
 */

/**
 * معالج طلبات POST من Edge Function
 */
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var action = body.action || 'search';
    
    if (action === 'ping') {
      return jsonResponse({ status: 'ok', message: 'GAS Bridge is alive', timestamp: new Date().toISOString() });
    }
    
    if (action === 'search') {
      return handleSearch(body);
    }
    
    return jsonResponse({ status: 'error', error: 'Unknown action: ' + action });
  } catch (err) {
    return jsonResponse({ status: 'error', error: err.message || 'Unknown error' });
  }
}

/**
 * معالج طلبات GET (للاختبار)
 */
function doGet(e) {
  return jsonResponse({
    status: 'ok',
    message: 'Mahakim GAS Bridge v1.0 — Use POST to search',
    timestamp: new Date().toISOString()
  });
}

/**
 * البحث عن ملف في بوابة محاكم
 */
function handleSearch(body) {
  var numero = body.numero || '';
  var code = body.code || '';
  var annee = body.annee || '';
  var appealCourt = body.appealCourt || '';
  var primaryCourt = body.primaryCourt || '';
  
  if (!numero || !code || !annee) {
    return jsonResponse({ status: 'error', error: 'Missing required fields: numero, code, annee' });
  }
  
  var logs = [];
  logs.push('Starting search: ' + numero + '/' + code + '/' + annee);
  
  // ═══════════════════════════════════════════
  // الطريقة 1: محاولة API المحمول المباشر
  // ═══════════════════════════════════════════
  var apiResult = tryMobileAPI(numero, code, annee, appealCourt, logs);
  if (apiResult && apiResult.hasData) {
    logs.push('✓ Mobile API succeeded');
    return jsonResponse({
      status: 'success',
      source: 'mobile_api',
      caseInfo: apiResult.caseInfo,
      procedures: apiResult.procedures,
      nextSessionDate: apiResult.nextSessionDate,
      logs: logs
    });
  }
  
  // ═══════════════════════════════════════════
  // الطريقة 2: جلب صفحة الويب وتحليل HTML
  // ═══════════════════════════════════════════
  var webResult = tryWebScrape(numero, code, annee, appealCourt, primaryCourt, logs);
  if (webResult && webResult.hasData) {
    logs.push('✓ Web scrape succeeded');
    return jsonResponse({
      status: 'success',
      source: 'web_scrape',
      caseInfo: webResult.caseInfo,
      procedures: webResult.procedures,
      nextSessionDate: webResult.nextSessionDate,
      logs: logs
    });
  }
  
  // ═══════════════════════════════════════════
  // الطريقة 3: جلب الصفحة الأساسية للتأكد من إمكانية الوصول
  // ═══════════════════════════════════════════
  var accessResult = tryBasicAccess(logs);
  
  return jsonResponse({
    status: 'no_data',
    error: 'لم يتم العثور على بيانات — قد تكون البوابة محظورة أو رقم الملف غير صحيح',
    accessCheck: accessResult,
    logs: logs
  });
}

/**
 * الطريقة 1: محاولة API المحمول
 * يحاول عدة مسارات API محتملة
 */
function tryMobileAPI(numero, code, annee, appealCourt, logs) {
  var baseUrl = 'https://www.mahakim.ma';
  
  // قائمة المسارات المحتملة للـ API
  var apiPaths = [
    '/api/suivi/dossier',
    '/api/suivi/search',
    '/api/dossier/search',
    '/api/affaire/search',
    '/api/v1/suivi/dossier',
    '/api/suivi/dossier-suivi',
    '/suivi/api/search',
  ];
  
  var headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    'Accept-Language': 'ar,fr;q=0.9',
    'Referer': 'https://www.mahakim.ma/',
    'Origin': 'https://www.mahakim.ma',
  };
  
  var payloads = [
    { numero: numero, mark: code, annee: annee },
    { numero: numero, code: code, annee: annee },
    { numero: numero, mark: code, annee: annee, tribunal: appealCourt },
  ];
  
  for (var p = 0; p < apiPaths.length; p++) {
    for (var b = 0; b < payloads.length; b++) {
      try {
        var url = baseUrl + apiPaths[p];
        logs.push('Trying API: ' + apiPaths[p]);
        
        var response = UrlFetchApp.fetch(url, {
          method: 'post',
          headers: headers,
          payload: JSON.stringify(payloads[b]),
          muteHttpExceptions: true,
          followRedirects: true,
          validateHttpsCertificates: true,
        });
        
        var statusCode = response.getResponseCode();
        var contentType = response.getHeaders()['Content-Type'] || '';
        logs.push('  → Status: ' + statusCode + ' | Type: ' + contentType);
        
        if (statusCode === 200 && contentType.indexOf('json') >= 0) {
          var data = JSON.parse(response.getContentText());
          var parsed = parseAPIResponse(data);
          if (parsed.hasData) {
            return parsed;
          }
          logs.push('  → JSON received but no useful data');
        }
      } catch (err) {
        logs.push('  → Error: ' + (err.message || '').substring(0, 100));
      }
    }
    // Avoid hammering — only try first 3 API paths with POST
    if (p >= 2) break;
  }
  
  // أيضاً نحاول GET مع query params
  var getUrls = [
    baseUrl + '/api/suivi/dossier?numero=' + numero + '&mark=' + code + '&annee=' + annee,
    baseUrl + '/api/suivi/search?numero=' + numero + '&code=' + code + '&annee=' + annee,
  ];
  
  for (var g = 0; g < getUrls.length; g++) {
    try {
      logs.push('Trying GET: ' + getUrls[g].replace(baseUrl, ''));
      var resp = UrlFetchApp.fetch(getUrls[g], {
        method: 'get',
        headers: headers,
        muteHttpExceptions: true,
        followRedirects: true,
      });
      
      var sc = resp.getResponseCode();
      logs.push('  → Status: ' + sc);
      
      if (sc === 200) {
        var ct = resp.getHeaders()['Content-Type'] || '';
        if (ct.indexOf('json') >= 0) {
          var jd = JSON.parse(resp.getContentText());
          var pr = parseAPIResponse(jd);
          if (pr.hasData) return pr;
        }
      }
    } catch (err) {
      logs.push('  → Error: ' + (err.message || '').substring(0, 80));
    }
  }
  
  return null;
}

/**
 * الطريقة 2: جلب صفحة HTML وتحليلها
 */
function tryWebScrape(numero, code, annee, appealCourt, primaryCourt, logs) {
  var url = 'https://www.mahakim.ma/';
  
  var headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.130 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'ar,fr;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Referer': 'https://www.google.com/',
    'DNT': '1',
  };
  
  try {
    logs.push('Fetching main page...');
    var response = UrlFetchApp.fetch(url, {
      method: 'get',
      headers: headers,
      muteHttpExceptions: true,
      followRedirects: true,
    });
    
    var statusCode = response.getResponseCode();
    var html = response.getContentText();
    logs.push('Main page: status=' + statusCode + ' size=' + html.length);
    
    // التحقق من حظر
    if (html.indexOf('Access Denied') >= 0 || html.indexOf('captcha') >= 0) {
      logs.push('⚠ Access denied / captcha detected');
      return null;
    }
    
    // البوابة Angular SPA — الصفحة الرئيسية لن تحتوي على بيانات
    // لكن يمكننا التقاط معلومات عن بنية الموقع
    if (statusCode === 200) {
      logs.push('✓ Main page accessible from GAS');
      
      // محاولة اكتشاف API endpoints من الكود المصدري
      var apiEndpoints = discoverAPIEndpoints(html, logs);
      
      // محاولة الوصول للـ API المكتشفة
      if (apiEndpoints.length > 0) {
        for (var i = 0; i < Math.min(apiEndpoints.length, 3); i++) {
          try {
            logs.push('Trying discovered endpoint: ' + apiEndpoints[i]);
            var apiResp = UrlFetchApp.fetch(apiEndpoints[i], {
              method: 'post',
              headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'User-Agent': headers['User-Agent'],
                'Referer': 'https://www.mahakim.ma/',
                'Origin': 'https://www.mahakim.ma',
              },
              payload: JSON.stringify({ numero: numero, mark: code, annee: annee }),
              muteHttpExceptions: true,
            });
            
            logs.push('  → Status: ' + apiResp.getResponseCode());
            if (apiResp.getResponseCode() === 200) {
              var ct = apiResp.getHeaders()['Content-Type'] || '';
              if (ct.indexOf('json') >= 0) {
                var parsed = parseAPIResponse(JSON.parse(apiResp.getContentText()));
                if (parsed.hasData) return parsed;
              }
            }
          } catch (err) {
            logs.push('  → Error: ' + (err.message || '').substring(0, 80));
          }
        }
      }
    }
    
  } catch (err) {
    logs.push('Web scrape error: ' + (err.message || '').substring(0, 100));
  }
  
  return null;
}

/**
 * اكتشاف API endpoints من كود JavaScript
 */
function discoverAPIEndpoints(html, logs) {
  var endpoints = [];
  var base = 'https://www.mahakim.ma';
  
  // البحث عن URLs في الكود المصدري
  var patterns = [
    /['"]\/api\/([^'"]+)['"]/g,
    /['"]\/suivi\/([^'"]+)['"]/g,
    /['"]\/dossier\/([^'"]+)['"]/g,
    /environment\.\w+\s*\+\s*['"]([^'"]+)['"]/g,
    /apiUrl['"]\s*:\s*['"]([^'"]+)['"]/g,
  ];
  
  for (var p = 0; p < patterns.length; p++) {
    var match;
    while ((match = patterns[p].exec(html)) !== null) {
      var path = match[1] || match[0];
      if (path.indexOf('.js') >= 0 || path.indexOf('.css') >= 0) continue;
      var fullUrl = path.indexOf('http') === 0 ? path : base + '/' + path.replace(/^\//, '');
      if (endpoints.indexOf(fullUrl) < 0) {
        endpoints.push(fullUrl);
      }
    }
  }
  
  // محاولة جلب ملفات JS الرئيسية لاكتشاف API
  var jsPatterns = html.match(/src="(main[^"]*\.js)"/g) || [];
  for (var j = 0; j < Math.min(jsPatterns.length, 2); j++) {
    try {
      var jsUrl = jsPatterns[j].replace('src="', '').replace('"', '');
      if (jsUrl.indexOf('http') !== 0) jsUrl = base + '/' + jsUrl.replace(/^\//, '');
      
      logs.push('Fetching JS bundle: ' + jsUrl.substring(jsUrl.lastIndexOf('/') + 1));
      var jsResp = UrlFetchApp.fetch(jsUrl, { muteHttpExceptions: true });
      
      if (jsResp.getResponseCode() === 200) {
        var jsCode = jsResp.getContentText();
        logs.push('  → JS size: ' + jsCode.length);
        
        // البحث عن API URLs في الكود
        var apiMatches = jsCode.match(/['"]\/api\/[^'"]{3,50}['"]/g) || [];
        var envMatches = jsCode.match(/apiUrl['"]\s*:\s*['"][^'"]+['"]/g) || [];
        var httpMatches = jsCode.match(/https?:\/\/[^'"}\s]{10,80}\/api\/[^'"}\s]+/g) || [];
        
        for (var a = 0; a < apiMatches.length; a++) {
          var ep = apiMatches[a].replace(/['"]/g, '');
          var full = base + ep;
          if (endpoints.indexOf(full) < 0) endpoints.push(full);
        }
        
        for (var h = 0; h < httpMatches.length; h++) {
          if (endpoints.indexOf(httpMatches[h]) < 0) endpoints.push(httpMatches[h]);
        }
        
        logs.push('  → Found ' + (apiMatches.length + httpMatches.length) + ' API references');
      }
    } catch (err) {
      logs.push('  → JS fetch error: ' + (err.message || '').substring(0, 50));
    }
  }
  
  logs.push('Total discovered endpoints: ' + endpoints.length);
  return endpoints;
}

/**
 * التحقق الأساسي من إمكانية الوصول
 */
function tryBasicAccess(logs) {
  var result = { accessible: false, statusCode: 0, blocked: false, htmlSize: 0 };
  
  try {
    var resp = UrlFetchApp.fetch('https://www.mahakim.ma/', {
      method: 'get',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
      },
      muteHttpExceptions: true,
      followRedirects: true,
    });
    
    result.statusCode = resp.getResponseCode();
    var html = resp.getContentText();
    result.htmlSize = html.length;
    result.accessible = result.statusCode === 200;
    result.blocked = html.indexOf('Access Denied') >= 0 || html.indexOf('blocked') >= 0;
    
    logs.push('Access check: ' + result.statusCode + ' | size=' + result.htmlSize + ' | blocked=' + result.blocked);
  } catch (err) {
    logs.push('Access check failed: ' + (err.message || '').substring(0, 80));
    result.error = (err.message || '').substring(0, 200);
  }
  
  return result;
}

/**
 * تحليل استجابة API
 */
function parseAPIResponse(data) {
  var result = {
    caseInfo: {},
    procedures: [],
    nextSessionDate: null,
    hasData: false,
  };
  
  if (!data) return result;
  
  // حالة: البيانات مباشرة
  var info = data.dossier || data.affaire || data.case || data.data || data;
  
  var fieldMap = {
    judge: ['judge', 'juge', 'magistrat', 'القاضي', 'القاضي المقرر'],
    department: ['department', 'chambre', 'الشعبة', 'section'],
    status: ['status', 'statut', 'etat', 'الحالة'],
    court: ['court', 'tribunal', 'المحكمة'],
    case_type: ['type', 'typeAffaire', 'نوع الملف'],
    subject: ['subject', 'objet', 'الموضوع'],
    registration_date: ['registrationDate', 'dateEnregistrement', 'تاريخ التسجيل'],
    plaintiff: ['plaintiff', 'demandeur', 'المدعي'],
    defendant: ['defendant', 'defendeur', 'المدعى عليه'],
  };
  
  for (var key in fieldMap) {
    var aliases = fieldMap[key];
    for (var a = 0; a < aliases.length; a++) {
      if (info[aliases[a]] && typeof info[aliases[a]] === 'string') {
        result.caseInfo[key] = info[aliases[a]];
        break;
      }
    }
  }
  
  // إجراءات
  var procs = data.procedures || data.demarches || data.timeline || data.actions || [];
  if (Array.isArray(procs)) {
    for (var i = 0; i < procs.length; i++) {
      var p = procs[i];
      result.procedures.push({
        action_date: p.action_date || p.date || p.dateAction || '',
        action_type: p.action_type || p.type || p.typeAction || p.nature || '',
        decision: p.decision || p.resultat || '',
        next_session_date: p.next_session_date || p.prochaine || p.dateProchaine || '',
      });
    }
  }
  
  // تاريخ الجلسة المقبلة
  var now = new Date();
  for (var j = 0; j < result.procedures.length; j++) {
    var nsd = result.procedures[j].next_session_date;
    if (nsd) {
      var dm = nsd.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      if (dm) {
        var dateStr = dm[3] + '-' + dm[2] + '-' + dm[1];
        var dateObj = new Date(dateStr);
        if (dateObj >= now && (!result.nextSessionDate || dateObj < new Date(result.nextSessionDate))) {
          result.nextSessionDate = dateStr;
        }
      }
    }
  }
  
  result.hasData = Object.keys(result.caseInfo).length > 0 || result.procedures.length > 0;
  return result;
}

/**
 * إرجاع JSON Response
 */
function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
