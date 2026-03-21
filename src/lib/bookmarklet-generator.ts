/**
 * Generates the bookmarklet JavaScript code that runs on mahakim.ma
 * 
 * When the lawyer clicks this bookmark while on a mahakim.ma case page,
 * it extracts all case data from the DOM and sends it to our webhook.
 */

const WEBHOOK_URL = `https://kebtjgedbwqrdqdjoqze.supabase.co/functions/v1/bookmarklet-receiver`;

export function generateBookmarkletCode(): string {
  // This JS runs in the context of mahakim.ma
  const code = `
(function(){
  try{
    var h=location.hostname;
    if(h.indexOf('mahakim.ma')===-1){
      alert('⚠️ يجب فتح بوابة محاكم أولاً!\\nافتح mahakim.ma وابحث عن ملفك ثم اضغط الزر مرة أخرى');
      return;
    }

    /* Show loading indicator */
    var overlay=document.createElement('div');
    overlay.id='_lmb_overlay';
    overlay.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif';
    overlay.innerHTML='<div style="background:white;border-radius:12px;padding:32px;text-align:center;max-width:400px"><div style="font-size:24px;margin-bottom:12px">⏳</div><div style="font-size:16px;font-weight:bold;color:#333">جاري جلب البيانات...</div><div style="font-size:13px;color:#888;margin-top:8px">لا تغلق هذه الصفحة</div></div>';
    document.body.appendChild(overlay);

    /* Extract case info from labels */
    var caseInfo={};
    var allLabels={};
    var labelMap={
      'القاضي':'judge','القاضي المقرر':'judge','القاضي المكلف':'judge',
      'الهيئة':'department','الشعبة':'department','القسم':'department','الغرفة':'department',
      'الحالة':'status','حالة الملف':'status',
      'المحكمة':'court','الموضوع':'subject'
    };

    /* Scan all text nodes for label:value patterns */
    var allEls=document.querySelectorAll('td,th,span,label,div,p,li');
    for(var i=0;i<allEls.length;i++){
      var txt=(allEls[i].textContent||'').trim();
      if(txt.length>2 && txt.length<200){
        var parts=txt.split(/[:：]/);
        if(parts.length>=2){
          var lbl=parts[0].trim();
          var val=parts.slice(1).join(':').trim();
          if(lbl && val && val.length>1){
            allLabels[lbl]=val;
            for(var key in labelMap){
              if(lbl.indexOf(key)!==-1){
                caseInfo[labelMap[key]]=val;
              }
            }
          }
        }
      }
    }

    /* Extract procedures from tables */
    var procedures=[];
    var tables=document.querySelectorAll('table');
    var dateRe=/\\d{1,2}[\\/\\-]\\d{1,2}[\\/\\-]\\d{4}|\\d{4}[\\/\\-]\\d{1,2}[\\/\\-]\\d{1,2}/;
    
    for(var t=0;t<tables.length;t++){
      var rows=tables[t].querySelectorAll('tr');
      for(var r=1;r<rows.length;r++){
        var cells=rows[r].querySelectorAll('td');
        if(cells.length<2) continue;
        var cellTexts=[];
        for(var c=0;c<cells.length;c++){
          cellTexts.push((cells[c].textContent||'').trim());
        }
        var hasDate=cellTexts.some(function(c){return dateRe.test(c)});
        if(hasDate || cellTexts.length>=3){
          var proc={action_date:null,action_type:'',decision:null,next_session_date:null};
          var dc=0;
          for(var ci=0;ci<cellTexts.length;ci++){
            var cell=cellTexts[ci];
            if(dateRe.test(cell)){
              if(dc===0) proc.action_date=cell;
              else proc.next_session_date=cell;
              dc++;
            } else if(!proc.action_type && cell.length>2){
              proc.action_type=cell;
            } else if(proc.action_type && !proc.decision && cell.length>1){
              proc.decision=cell;
            }
          }
          if(proc.action_type || proc.action_date){
            procedures.push(proc);
          }
        }
      }
    }

    /* Try to extract case number from URL or page */
    var caseNumber='';
    var cnMatch=(document.body.textContent||'').match(/(\\d{1,6})\\/(\\d{4})\\/(\\d{4})/);
    if(cnMatch) caseNumber=cnMatch[0];
    
    /* Also check URL hash */
    var hashMatch=location.hash.match(/(\\d{1,6})[\\/](\\d{4})[\\/](\\d{4})/);
    if(hashMatch && !caseNumber) caseNumber=hashMatch[1]+'/'+hashMatch[2]+'/'+hashMatch[3];

    if(!caseNumber){
      caseNumber=prompt('أدخل رقم الملف (مثال: 10/1401/2025):');
      if(!caseNumber){
        document.getElementById('_lmb_overlay').remove();
        return;
      }
    }

    /* Send data to webhook */
    var payload={
      caseNumber:caseNumber,
      caseInfo:caseInfo,
      procedures:procedures,
      allLabels:allLabels,
      rawText:(document.body.textContent||'').substring(0,8000)
    };

    var xhr=new XMLHttpRequest();
    xhr.open('POST','${WEBHOOK_URL}',true);
    xhr.setRequestHeader('Content-Type','application/json');
    xhr.onload=function(){
      var el=document.getElementById('_lmb_overlay');
      if(xhr.status>=200 && xhr.status<300){
        var res=JSON.parse(xhr.responseText);
        el.innerHTML='<div style="background:white;border-radius:12px;padding:32px;text-align:center;max-width:400px"><div style="font-size:36px;margin-bottom:12px">✅</div><div style="font-size:16px;font-weight:bold;color:#333">'+(res.message||'تم بنجاح!')+'</div><div style="font-size:13px;color:#888;margin-top:12px">يمكنك العودة لتطبيقك الآن</div><button onclick="this.parentElement.parentElement.remove()" style="margin-top:16px;padding:8px 24px;border-radius:8px;border:none;background:#10b981;color:white;font-size:14px;cursor:pointer">إغلاق</button></div>';
      } else {
        var err=JSON.parse(xhr.responseText);
        el.innerHTML='<div style="background:white;border-radius:12px;padding:32px;text-align:center;max-width:400px"><div style="font-size:36px;margin-bottom:12px">❌</div><div style="font-size:16px;font-weight:bold;color:#c00">'+(err.error||'خطأ')+'</div>'+(err.hint?'<div style="font-size:13px;color:#888;margin-top:8px">'+err.hint+'</div>':'')+'<button onclick="this.parentElement.parentElement.remove()" style="margin-top:16px;padding:8px 24px;border-radius:8px;border:none;background:#666;color:white;font-size:14px;cursor:pointer">إغلاق</button></div>';
      }
    };
    xhr.onerror=function(){
      var el=document.getElementById('_lmb_overlay');
      el.innerHTML='<div style="background:white;border-radius:12px;padding:32px;text-align:center"><div style="font-size:36px">❌</div><div style="color:#c00;margin-top:8px">تعذر الاتصال بالخادم</div><button onclick="this.parentElement.parentElement.remove()" style="margin-top:16px;padding:8px 24px;border-radius:8px;border:none;background:#666;color:white;cursor:pointer">إغلاق</button></div>';
    };
    xhr.send(JSON.stringify(payload));
  }catch(e){
    alert('خطأ: '+e.message);
    var el=document.getElementById('_lmb_overlay');
    if(el) el.remove();
  }
})();
`.trim().replace(/\n\s*/g, ' ');

  return `javascript:${encodeURIComponent(code)}`;
}

export function getBookmarkletName(): string {
  return '📋 جلب من محاكم';
}
