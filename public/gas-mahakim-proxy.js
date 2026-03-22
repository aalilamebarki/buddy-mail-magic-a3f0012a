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

// ──── الـ API الحقيقي لبوابة محاكم (ASP.NET Web Service) ────
var API_BASE = 'https://www.mahakim.ma/Ar/Services/SuiviAffaires_new/JFunctions/fn.aspx';

/**
 * معالج طلبات POST
 */
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var action = body.action || 'search';
    
    if (action === 'ping') {
      return jsonResponse({ status: 'ok', message: 'Mahakim GAS Bridge v2.0', timestamp: new Date().toISOString() });
    }
    
    if (action === 'diagnose') {
      return handleDiagnose();
    }
    
    if (action === 'search') {
      return handleSearch(body);
    }
    
    if (action === 'getCourts') {
      return handleGetCourts(body);
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
  var params = e ? (e.parameter || {}) : {};
  var action = params.action || 'ping';
  
  if (action === 'ping') {
    return jsonResponse({ status: 'ok', message: 'Mahakim GAS Bridge v2.0', timestamp: new Date().toISOString() });
  }
  
  if (action === 'diagnose') {
    return handleDiagnose();
  }
  
  return jsonResponse({ status: 'ok', message: 'Mahakim GAS Bridge v2.0 — Use POST for search', timestamp: new Date().toISOString() });
}

// ═══════════════════════════════════════════════════════════════
// التشخيص — فحص الوصول لبوابة محاكم
// ═══════════════════════════════════════════════════════════════

function handleDiagnose() {
  var results = {};
  
  // فحص 1: هل يمكن الوصول للموقع؟
  try {
    var r1 = UrlFetchApp.fetch('https://www.mahakim.ma/', {
      muteHttpExceptions: true,
      followRedirects: true,
      validateHttpsCertificates: false
    });
    results.mainPage = { status: r1.getResponseCode(), size: r1.getContentText().length, contentType: r1.getHeaders()['Content-Type'] || '' };
  } catch (err) {
    results.mainPage = { error: err.message };
  }
  
  // فحص 2: هل يمكن الوصول للـ API؟
  try {
    var r2 = UrlFetchApp.fetch(API_BASE + '/getCA', {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ typeJuridiction: 'CA' }),
      muteHttpExceptions: true,
      followRedirects: true,
      validateHttpsCertificates: false
    });
    var txt = r2.getContentText();
    results.apiGetCA = { status: r2.getResponseCode(), size: txt.length, preview: txt.substring(0, 500) };
  } catch (err) {
    results.apiGetCA = { error: err.message };
  }
  
  return jsonResponse({ status: 'ok', diagnose: results, timestamp: new Date().toISOString() });
}

// ═══════════════════════════════════════════════════════════════
// جلب قائمة المحاكم
// ═══════════════════════════════════════════════════════════════

function handleGetCourts(body) {
  var courtType = body.courtType || 'CA';
  try {
    var response = UrlFetchApp.fetch(API_BASE + '/getCA', {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ typeJuridiction: courtType }),
      muteHttpExceptions: true,
      followRedirects: true,
      validateHttpsCertificates: false
    });
    
    var data = JSON.parse(response.getContentText());
    return jsonResponse({ status: 'success', courts: data.d || data, raw: response.getContentText().substring(0, 1000) });
  } catch (err) {
    return jsonResponse({ status: 'error', error: err.message });
  }
}

// ═══════════════════════════════════════════════════════════════
// البحث عن ملف — الوظيفة الأساسية
// ═══════════════════════════════════════════════════════════════

function handleSearch(body) {
  var numero = body.numero || '';
  var code = body.code || '';
  var annee = body.annee || '';
  var appealCourt = body.appealCourt || '';
  var primaryCourt = body.primaryCourt || body.firstInstanceCourt || '';
  
  if (!numero || !code || !annee) {
    return jsonResponse({ status: 'error', error: 'Missing required fields: numero, code, annee' });
  }
  
  var logs = [];
  logs.push('Search: ' + numero + '/' + code + '/' + annee);
  
  // الخطوة 1: جلب قائمة محاكم الاستئناف لتحديد الـ ID
  var courtId = resolveCourtId(appealCourt, logs);
  
  // الخطوة 2: محاولة البحث عبر endpoints ASP.NET المحتملة
  var searchEndpoints = [
    'SearchAffaire',
    'searchAffaire', 
    'GetDossier',
    'getDossier',
    'SearchDossier',
    'searchDossier',
    'RechercherDossier',
    'rechercherDossier',
    'SuiviDossier',
    'suiviDossier',
    'GetAffaire',
    'getAffaire',
    'ChercherDossier',
    'GetSuiviAffaire',
    'RechercheAffaire',
    'getDetailsAffaire',
    'GetDetailsAffaire',
    'GetListAffaire',
    'getListAffaire',
    'Recherche',
    'recherche',
  ];
  
  // بناء payloads مختلفة
  var payloads = buildSearchPayloads(numero, code, annee, courtId, appealCourt);
  
  for (var i = 0; i < searchEndpoints.length; i++) {
    var endpoint = searchEndpoints[i];
    
    for (var j = 0; j < payloads.length; j++) {
      try {
        var url = API_BASE + '/' + endpoint;
        logs.push('Try: /' + endpoint + ' payload#' + j);
        
        var response = UrlFetchApp.fetch(url, {
          method: 'post',
          contentType: 'application/json',
          payload: JSON.stringify(payloads[j]),
          muteHttpExceptions: true,
          followRedirects: true,
          validateHttpsCertificates: false
        });
        
        var statusCode = response.getResponseCode();
        var contentText = response.getContentText();
        var contentType = response.getHeaders()['Content-Type'] || '';
        
        logs.push('  status=' + statusCode + ' size=' + contentText.length);
        
        // نجاح: 200 مع JSON
        if (statusCode === 200 && contentType.indexOf('json') >= 0) {
          var data = JSON.parse(contentText);
          var parsed = parseSearchResult(data, logs);
          if (parsed.hasData) {
            logs.push('SUCCESS via /' + endpoint);
            return jsonResponse({
              status: 'success',
              source: 'aspnet_api',
              endpoint: endpoint,
              caseInfo: parsed.caseInfo,
              procedures: parsed.procedures,
              nextSessionDate: parsed.nextSessionDate,
              logs: logs
            });
          }
          logs.push('  JSON but no useful data: ' + contentText.substring(0, 200));
        }
        
        // 500 مع رسالة خطأ = endpoint موجود لكن payload خاطئ
        if (statusCode === 500 && contentType.indexOf('json') >= 0) {
          var errData = JSON.parse(contentText);
          var errMsg = errData.Message || errData.ExceptionMessage || '';
          if (errMsg) {
            logs.push('  FOUND endpoint /' + endpoint + ' (500 error): ' + errMsg.substring(0, 150));
            // نحفظ اسم الـ endpoint الصحيح ونحاول payloads مختلفة
          }
        }
        
        // لا نحتاج تجربة payloads أخرى لـ 404
        if (statusCode === 404) {
          logs.push('  404 — skip');
          break;
        }
        
      } catch (err) {
        logs.push('  Error: ' + (err.message || '').substring(0, 80));
        break; // timeout or network error — skip this endpoint
      }
    }
  }
  
  // الخطوة 3: محاولة البحث عبر صفحة الويب المباشرة (ASP.NET page)
  var pageResult = tryPageBasedSearch(numero, code, annee, appealCourt, primaryCourt, courtId, logs);
  if (pageResult && pageResult.hasData) {
    return jsonResponse({
      status: 'success',
      source: 'page_scrape',
      caseInfo: pageResult.caseInfo,
      procedures: pageResult.procedures,
      nextSessionDate: pageResult.nextSessionDate,
      logs: logs
    });
  }
  
  // لم يُعثر على بيانات
  logs.push('All methods exhausted');
  return jsonResponse({
    status: 'no_data',
    reason: 'api_endpoints_not_found',
    error: 'تم فحص ' + searchEndpoints.length + ' endpoint ولم يُعثر على واحد يعمل للبحث عن الملفات',
    logs: logs,
    courtIdResolved: courtId
  });
}

// ═══════════════════════════════════════════════════════════════
// تحديد ID المحكمة
// ═══════════════════════════════════════════════════════════════

function resolveCourtId(appealCourtName, logs) {
  if (!appealCourtName) return null;
  
  try {
    var response = UrlFetchApp.fetch(API_BASE + '/getCA', {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ typeJuridiction: 'CA' }),
      muteHttpExceptions: true,
      followRedirects: true,
      validateHttpsCertificates: false
    });
    
    if (response.getResponseCode() === 200) {
      var data = JSON.parse(response.getContentText());
      var courts = data.d || data;
      
      if (courts && courts.length) {
        logs.push('Got ' + courts.length + ' appeal courts from API');
        
        for (var i = 0; i < courts.length; i++) {
          var courtName = courts[i].nomJuridiction || courts[i].name || '';
          if (courtName.indexOf(appealCourtName) >= 0 || appealCourtName.indexOf(courtName) >= 0) {
            var id = courts[i].idJuridiction || courts[i].id;
            logs.push('Matched court: "' + courtName + '" → id=' + id);
            return id;
          }
        }
        
        // نحاول مطابقة جزئية
        for (var i = 0; i < courts.length; i++) {
          var courtName = courts[i].nomJuridiction || courts[i].name || '';
          var normalizedInput = appealCourtName.replace(/محكمة|الاستئناف|استئناف|ب/g, '').trim();
          var normalizedCourt = courtName.replace(/محكمة|الاستئناف|استئناف|ب/g, '').trim();
          if (normalizedCourt.indexOf(normalizedInput) >= 0 || normalizedInput.indexOf(normalizedCourt) >= 0) {
            var id = courts[i].idJuridiction || courts[i].id;
            logs.push('Partial match: "' + courtName + '" → id=' + id);
            return id;
          }
        }
        
        logs.push('No court matched "' + appealCourtName + '". Available: ' + courts.map(function(c) { return c.nomJuridiction || ''; }).join(', '));
      }
    } else {
      logs.push('getCA failed: status=' + response.getResponseCode());
    }
  } catch (err) {
    logs.push('getCA error: ' + err.message);
  }
  
  return null;
}

// ═══════════════════════════════════════════════════════════════
// بناء payloads مختلفة للبحث
// ═══════════════════════════════════════════════════════════════

function buildSearchPayloads(numero, code, annee, courtId, appealCourt) {
  var payloads = [];
  
  // Payload 1: الأكثر شيوعاً
  payloads.push({ numero: numero, mark: code, annee: annee });
  
  // Payload 2: مع ID المحكمة
  if (courtId) {
    payloads.push({ numero: numero, mark: code, annee: annee, idJuridiction: courtId });
    payloads.push({ numero: numero, mark: code, annee: annee, IdJuridiction: courtId });
    payloads.push({ NumeroDossier: numero, TypeDossier: code, AnneeDossier: annee, IdJuridiction: courtId });
  }
  
  // Payload 3: بمفاتيح بديلة
  payloads.push({ NumeroDossier: numero, TypeDossier: code, AnneeDossier: annee });
  payloads.push({ numeroDossier: numero, typeDossier: code, anneeDossier: annee });
  
  return payloads;
}

// ═══════════════════════════════════════════════════════════════
// تحليل نتيجة البحث
// ═══════════════════════════════════════════════════════════════

function parseSearchResult(data, logs) {
  var result = { hasData: false, caseInfo: {}, procedures: [], nextSessionDate: null };
  
  // ASP.NET يغلف النتيجة في .d
  var payload = data.d || data;
  
  if (!payload) return result;
  
  // إذا كان مصفوفة
  if (Array.isArray(payload) && payload.length > 0) {
    result.hasData = true;
    result.procedures = payload.map(function(item) {
      return {
        date: item.dateAudience || item.dateJugement || item.date || null,
        action: item.typeAffaire || item.decision || item.observation || item.action || '',
        decision: item.decision || item.resultat || '',
        nextDate: item.prochaineAudience || item.nextDate || null
      };
    });
    
    // استخراج الجلسة المقبلة
    var now = new Date();
    for (var i = 0; i < result.procedures.length; i++) {
      var nextDate = result.procedures[i].nextDate || result.procedures[i].date;
      if (nextDate) {
        var d = new Date(nextDate);
        if (d > now && (!result.nextSessionDate || d < new Date(result.nextSessionDate))) {
          result.nextSessionDate = nextDate;
        }
      }
    }
    
    logs.push('Parsed ' + result.procedures.length + ' procedures');
    return result;
  }
  
  // إذا كان كائناً
  if (typeof payload === 'object' && !Array.isArray(payload)) {
    var keys = Object.keys(payload);
    if (keys.length > 0) {
      result.hasData = true;
      result.caseInfo = payload;
      logs.push('Got object with keys: ' + keys.join(', '));
    }
  }
  
  return result;
}

// ═══════════════════════════════════════════════════════════════
// البحث عبر صفحات الويب المباشرة
// ═══════════════════════════════════════════════════════════════

function tryPageBasedSearch(numero, code, annee, appealCourt, primaryCourt, courtId, logs) {
  // محاولة جلب صفحة البحث القديمة (ASP.NET WebForms)
  var pages = [
    'https://www.mahakim.ma/Ar/Services/SuiviAffaires_new/default.aspx',
    'https://www.mahakim.ma/Ar/Services/SuiviAffaires/default.aspx',
    'https://www.mahakim.ma/Fr/Services/SuiviAffaires_new/default.aspx',
  ];
  
  for (var i = 0; i < pages.length; i++) {
    try {
      logs.push('Try page: ' + pages[i].replace('https://www.mahakim.ma', ''));
      var response = UrlFetchApp.fetch(pages[i], {
        muteHttpExceptions: true,
        followRedirects: true,
        validateHttpsCertificates: false
      });
      
      var status = response.getResponseCode();
      var html = response.getContentText();
      logs.push('  status=' + status + ' size=' + html.length);
      
      if (status === 200 && html.length > 500) {
        // نبحث عن __VIEWSTATE وأسماء الحقول لعمل POST-back
        var viewState = extractBetween(html, '__VIEWSTATE" value="', '"');
        var viewStateGen = extractBetween(html, '__VIEWSTATEGENERATOR" value="', '"');
        var eventValidation = extractBetween(html, '__EVENTVALIDATION" value="', '"');
        
        if (viewState) {
          logs.push('  Found ASP.NET ViewState — attempting form POST');
          var formResult = tryASPNetFormPost(pages[i], viewState, viewStateGen, eventValidation, numero, code, annee, courtId, logs);
          if (formResult && formResult.hasData) {
            return formResult;
          }
        }
        
        // نبحث عن endpoints أخرى في HTML/JS
        var apiEndpoints = extractAPIEndpoints(html, logs);
        if (apiEndpoints.length > 0) {
          logs.push('  Found ' + apiEndpoints.length + ' API endpoints in page');
        }
      }
    } catch (err) {
      logs.push('  Error: ' + (err.message || '').substring(0, 80));
    }
  }
  
  return null;
}

// ═══════════════════════════════════════════════════════════════
// محاولة POST عبر ASP.NET WebForms
// ═══════════════════════════════════════════════════════════════

function tryASPNetFormPost(pageUrl, viewState, viewStateGen, eventValidation, numero, code, annee, courtId, logs) {
  try {
    var formData = {
      '__VIEWSTATE': viewState,
      '__VIEWSTATEGENERATOR': viewStateGen || '',
      '__EVENTVALIDATION': eventValidation || '',
      'ctl00$ContentPlaceHolder1$txtNumero': numero,
      'ctl00$ContentPlaceHolder1$txtMark': code,
      'ctl00$ContentPlaceHolder1$txtAnnee': annee,
    };
    
    if (courtId) {
      formData['ctl00$ContentPlaceHolder1$ddlJuridiction'] = courtId;
    }
    
    // نبحث عن أسماء أزرار البحث المحتملة
    var searchButtons = [
      'ctl00$ContentPlaceHolder1$btnSearch',
      'ctl00$ContentPlaceHolder1$btnRechercher',
      'ctl00$ContentPlaceHolder1$BtnSearch',
      'ctl00$ContentPlaceHolder1$Button1',
    ];
    
    for (var b = 0; b < searchButtons.length; b++) {
      formData[searchButtons[b]] = 'بحث';
      
      var payload = Object.keys(formData).map(function(key) {
        return encodeURIComponent(key) + '=' + encodeURIComponent(formData[key]);
      }).join('&');
      
      logs.push('  ASP.NET POST with button: ' + searchButtons[b]);
      
      var response = UrlFetchApp.fetch(pageUrl, {
        method: 'post',
        contentType: 'application/x-www-form-urlencoded',
        payload: payload,
        muteHttpExceptions: true,
        followRedirects: true,
        validateHttpsCertificates: false
      });
      
      var html = response.getContentText();
      logs.push('  Response: status=' + response.getResponseCode() + ' size=' + html.length);
      
      // نبحث عن جدول النتائج في HTML
      var tableData = extractTableData(html, logs);
      if (tableData && tableData.hasData) {
        return tableData;
      }
      
      delete formData[searchButtons[b]];
    }
  } catch (err) {
    logs.push('  Form POST error: ' + (err.message || '').substring(0, 80));
  }
  
  return null;
}

// ═══════════════════════════════════════════════════════════════
// استخراج بيانات الجدول من HTML
// ═══════════════════════════════════════════════════════════════

function extractTableData(html, logs) {
  var result = { hasData: false, caseInfo: {}, procedures: [], nextSessionDate: null };
  
  // نبحث عن جداول HTML
  var tableStart = html.indexOf('<table');
  if (tableStart < 0) {
    logs.push('  No table found in response');
    return null;
  }
  
  // نبحث عن صفوف الجدول
  var rows = [];
  var pos = tableStart;
  while (true) {
    var trStart = html.indexOf('<tr', pos);
    if (trStart < 0) break;
    var trEnd = html.indexOf('</tr>', trStart);
    if (trEnd < 0) break;
    
    var rowHtml = html.substring(trStart, trEnd + 5);
    var cells = [];
    var cellPos = 0;
    while (true) {
      var tdStart = rowHtml.indexOf('<td', cellPos);
      if (tdStart < 0) {
        tdStart = rowHtml.indexOf('<th', cellPos);
      }
      if (tdStart < 0) break;
      var contentStart = rowHtml.indexOf('>', tdStart) + 1;
      var contentEnd = rowHtml.indexOf('</', contentStart);
      if (contentEnd < 0) break;
      cells.push(stripHtml(rowHtml.substring(contentStart, contentEnd)).trim());
      cellPos = contentEnd + 1;
    }
    
    if (cells.length > 0) {
      rows.push(cells);
    }
    pos = trEnd + 5;
    
    if (rows.length > 50) break; // حماية من الحلقات اللانهائية
  }
  
  if (rows.length > 1) {
    result.hasData = true;
    logs.push('  Found table with ' + rows.length + ' rows');
    
    // الصف الأول = headers, الباقي = بيانات
    var headers = rows[0];
    for (var i = 1; i < rows.length; i++) {
      var proc = {};
      for (var j = 0; j < headers.length && j < rows[i].length; j++) {
        proc[headers[j]] = rows[i][j];
      }
      result.procedures.push(proc);
    }
    
    // استخراج الجلسة المقبلة
    var now = new Date();
    for (var i = 0; i < result.procedures.length; i++) {
      var p = result.procedures[i];
      var dateFields = Object.keys(p);
      for (var d = 0; d < dateFields.length; d++) {
        var val = p[dateFields[d]];
        if (val && val.match && val.match(/\d{2}[\/-]\d{2}[\/-]\d{4}/)) {
          var parsed = parseArabicDate(val);
          if (parsed && parsed > now) {
            if (!result.nextSessionDate || parsed < new Date(result.nextSessionDate)) {
              result.nextSessionDate = parsed.toISOString().split('T')[0];
            }
          }
        }
      }
    }
  }
  
  return result.hasData ? result : null;
}

// ═══════════════════════════════════════════════════════════════
// أدوات مساعدة
// ═══════════════════════════════════════════════════════════════

function extractBetween(str, start, end) {
  var startIdx = str.indexOf(start);
  if (startIdx < 0) return '';
  startIdx += start.length;
  var endIdx = str.indexOf(end, startIdx);
  if (endIdx < 0) return '';
  return str.substring(startIdx, endIdx);
}

function stripHtml(str) {
  return str.replace(/<[^>]*>/g, '');
}

function extractAPIEndpoints(html, logs) {
  var endpoints = [];
  var searchTerms = ['fn.aspx/', 'JFunctions/', 'ajax/', 'api/', 'WebService', '.asmx'];
  for (var i = 0; i < searchTerms.length; i++) {
    var pos = 0;
    while (true) {
      var idx = html.indexOf(searchTerms[i], pos);
      if (idx < 0) break;
      var snippet = html.substring(Math.max(0, idx - 20), Math.min(html.length, idx + 60));
      endpoints.push(snippet.replace(/[\n\r]/g, ' ').trim());
      pos = idx + 1;
      if (endpoints.length > 20) break;
    }
  }
  return endpoints;
}

function parseArabicDate(str) {
  try {
    // DD/MM/YYYY or DD-MM-YYYY
    var parts = str.split(/[\/-]/);
    if (parts.length === 3) {
      var day = parseInt(parts[0], 10);
      var month = parseInt(parts[1], 10) - 1;
      var year = parseInt(parts[2], 10);
      if (year > 2000 && month >= 0 && month < 12 && day > 0 && day <= 31) {
        return new Date(year, month, day);
      }
    }
  } catch (e) {}
  return null;
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
