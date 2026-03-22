/**
 * Generates the bookmarklet JavaScript code that runs on mahakim.ma
 * 
 * When the lawyer clicks this bookmark while on a mahakim.ma case page,
 * it extracts all case data from the DOM and sends it to our webhook.
 */

const WEBHOOK_URL = `https://kebtjgedbwqrdqdjoqze.supabase.co/functions/v1/bookmarklet-receiver`;

export function generateBookmarkletCode(): string {
  const code = `
(function(){
  try{
    var h=location.hostname;
    if(h.indexOf('mahakim.ma')===-1){
      alert('⚠️ يجب فتح بوابة محاكم أولاً!\\nافتح mahakim.ma وابحث عن ملفك ثم اضغط الزر مرة أخرى');
      return;
    }

    var overlay=document.createElement('div');
    overlay.id='_lmb_overlay';
    overlay.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:99999;display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif;direction:rtl';
    overlay.innerHTML='<div style="background:white;border-radius:16px;padding:40px;text-align:center;max-width:420px;box-shadow:0 25px 50px rgba(0,0,0,0.3)"><div style="font-size:32px;margin-bottom:16px">⏳</div><div style="font-size:18px;font-weight:bold;color:#1a1a2e">جاري جلب البيانات...</div><div id="_lmb_status" style="font-size:13px;color:#666;margin-top:10px">تحليل الصفحة...</div></div>';
    document.body.appendChild(overlay);

    var statusEl;
    function setStatus(t){statusEl=document.getElementById('_lmb_status');if(statusEl)statusEl.textContent=t;}

    function waitForContent(cb,maxWait){
      var start=Date.now();
      var check=function(){
        var tables=document.querySelectorAll('table');
        var hasData=false;
        for(var i=0;i<tables.length;i++){
          if(tables[i].querySelectorAll('tr').length>1){hasData=true;break;}
        }
        if(hasData || Date.now()-start>maxWait){
          cb();
        } else {
          setStatus('في انتظار تحميل البيانات...');
          setTimeout(check,500);
        }
      };
      check();
    }

    waitForContent(function(){
      setStatus('استخراج بيانات الملف...');

      var caseInfo={};
      var allLabels={};
      var labelMap={
        'القاضي':'judge','القاضي المقرر':'judge','القاضي المكلف':'judge','قاضي التحقيق':'judge',
        'الهيئة':'department','الشعبة':'department','القسم':'department','الغرفة':'department',
        'الحالة':'status','حالة الملف':'status','الوضعية':'status',
        'المحكمة':'court','الموضوع':'subject',
        'نوع القضية':'caseType','طبيعة القضية':'caseType',
        'تاريخ التسجيل':'registrationDate','تاريخ الإيداع':'registrationDate'
      };

      var allEls=document.querySelectorAll('td,th,span,label,div,p,li,dt,dd,strong,b');
      for(var i=0;i<allEls.length;i++){
        var el=allEls[i];
        var txt=(el.textContent||'').trim();
        if(txt.length<2||txt.length>300) continue;

        var parts=txt.split(/[:：]/);
        if(parts.length>=2){
          var lbl=parts[0].trim();
          var val=parts.slice(1).join(':').trim();
          if(lbl&&val&&val.length>1&&lbl.length<50){
            allLabels[lbl]=val;
            for(var key in labelMap){
              if(lbl.indexOf(key)!==-1){
                caseInfo[labelMap[key]]=val;
              }
            }
          }
        }

        if(!caseInfo.judge){
          var next=el.nextElementSibling;
          if(next){
            var eTxt=(el.textContent||'').trim();
            var nTxt=(next.textContent||'').trim();
            for(var key2 in labelMap){
              if(eTxt.indexOf(key2)!==-1&&nTxt.length>1&&nTxt.length<100){
                caseInfo[labelMap[key2]]=nTxt;
                allLabels[key2]=nTxt;
              }
            }
          }
        }
      }

      setStatus('استخراج الإجراءات...');

      var procedures=[];
      var tables=document.querySelectorAll('table');
      var dateRe=/\\d{1,2}[\\/\\-]\\d{1,2}[\\/\\-]\\d{2,4}|\\d{4}[\\/\\-]\\d{1,2}[\\/\\-]\\d{1,2}/;

      for(var t=0;t<tables.length;t++){
        var rows=tables[t].querySelectorAll('tr');
        if(rows.length<2) continue;

        var headerCells=rows[0].querySelectorAll('th,td');
        var colMap={date:-1,type:-1,decision:-1,nextDate:-1};
        for(var h2=0;h2<headerCells.length;h2++){
          var ht=(headerCells[h2].textContent||'').trim().toLowerCase();
          if(ht.indexOf('تاريخ')!==-1&&ht.indexOf('المقبل')===-1&&colMap.date===-1) colMap.date=h2;
          else if(ht.indexOf('إجراء')!==-1||ht.indexOf('نوع')!==-1||ht.indexOf('عملية')!==-1) colMap.type=h2;
          else if(ht.indexOf('قرار')!==-1||ht.indexOf('منطوق')!==-1||ht.indexOf('حكم')!==-1) colMap.decision=h2;
          else if(ht.indexOf('مقبل')!==-1||ht.indexOf('القادم')!==-1||ht.indexOf('التالي')!==-1) colMap.nextDate=h2;
        }

        for(var r=1;r<rows.length;r++){
          var cells=rows[r].querySelectorAll('td');
          if(cells.length<2) continue;
          var cellTexts=[];
          for(var c=0;c<cells.length;c++){
            cellTexts.push((cells[c].textContent||'').trim());
          }

          var proc={action_date:null,action_type:'',decision:null,next_session_date:null};

          if(colMap.date>=0&&colMap.date<cellTexts.length) proc.action_date=cellTexts[colMap.date];
          if(colMap.type>=0&&colMap.type<cellTexts.length) proc.action_type=cellTexts[colMap.type];
          if(colMap.decision>=0&&colMap.decision<cellTexts.length) proc.decision=cellTexts[colMap.decision];
          if(colMap.nextDate>=0&&colMap.nextDate<cellTexts.length) proc.next_session_date=cellTexts[colMap.nextDate];

          if(!proc.action_date&&!proc.action_type){
            var dc=0;
            for(var ci=0;ci<cellTexts.length;ci++){
              var cell=cellTexts[ci];
              if(dateRe.test(cell)){
                if(dc===0) proc.action_date=cell;
                else proc.next_session_date=cell;
                dc++;
              } else if(!proc.action_type&&cell.length>2){
                proc.action_type=cell;
              } else if(proc.action_type&&!proc.decision&&cell.length>1){
                proc.decision=cell;
              }
            }
          }

          if(proc.action_type||proc.action_date){
            procedures.push(proc);
          }
        }
      }

      setStatus('البحث عن رقم الملف...');

      var caseNumber='';
      var cnPatterns=[
        /(\\d{1,6})\\s*\\/\\s*(\\d{4})\\s*\\/\\s*(\\d{4})/,
        /(\\d{1,6})\\s*\\/\\s*(\\d{2,4})\\s*\\/\\s*(\\d{2,4})/
      ];
      var bodyText=document.body.textContent||'';

      for(var p=0;p<cnPatterns.length;p++){
        var cnMatch=bodyText.match(cnPatterns[p]);
        if(cnMatch){caseNumber=cnMatch[0].replace(/\\s/g,'');break;}
      }

      if(!caseNumber){
        var hashMatch=location.hash.match(/(\\d{1,6})[\\/](\\d{2,4})[\\/](\\d{2,4})/);
        if(hashMatch) caseNumber=hashMatch[1]+'/'+hashMatch[2]+'/'+hashMatch[3];
      }
      if(!caseNumber){
        var urlMatch=location.href.match(/(\\d{1,6})[\\/](\\d{2,4})[\\/](\\d{2,4})/);
        if(urlMatch) caseNumber=urlMatch[1]+'/'+urlMatch[2]+'/'+urlMatch[3];
      }

      if(!caseNumber){
        var inp=document.querySelectorAll('input[type=text],input:not([type])');
        for(var ii=0;ii<inp.length;ii++){
          var iv=(inp[ii].value||'').trim();
          if(iv.match(cnPatterns[0])){caseNumber=iv.replace(/\\s/g,'');break;}
        }
      }

      if(!caseNumber){
        caseNumber=prompt('أدخل رقم الملف (مثال: 10/1401/2025):');
        if(!caseNumber){
          document.getElementById('_lmb_overlay').remove();
          return;
        }
      }

      setStatus('إرسال البيانات... ('+procedures.length+' إجراء)');

      var payload={
        caseNumber:caseNumber.trim(),
        caseInfo:caseInfo,
        procedures:procedures,
        allLabels:allLabels,
        rawText:bodyText.substring(0,10000)
      };

      var xhr=new XMLHttpRequest();
      xhr.open('POST','${WEBHOOK_URL}',true);
      xhr.setRequestHeader('Content-Type','application/json');
      xhr.onload=function(){
        var el=document.getElementById('_lmb_overlay');
        if(xhr.status>=200&&xhr.status<300){
          try{var res=JSON.parse(xhr.responseText);}catch(e){var res={message:'تم الإرسال'};}
          el.innerHTML='<div style="background:white;border-radius:16px;padding:40px;text-align:center;max-width:420px;box-shadow:0 25px 50px rgba(0,0,0,0.3);direction:rtl"><div style="font-size:48px;margin-bottom:16px">✅</div><div style="font-size:18px;font-weight:bold;color:#059669">'+(res.message||'تم بنجاح!')+'</div><div style="font-size:13px;color:#666;margin-top:12px">رقم الملف: <b>'+caseNumber+'</b></div><div style="font-size:13px;color:#666;margin-top:4px">الإجراءات المستخرجة: <b>'+procedures.length+'</b></div><div style="font-size:13px;color:#888;margin-top:12px">يمكنك العودة لتطبيقك الآن</div><button onclick="this.closest(\\'#_lmb_overlay\\').remove()" style="margin-top:20px;padding:10px 32px;border-radius:10px;border:none;background:#059669;color:white;font-size:15px;font-weight:bold;cursor:pointer">إغلاق</button></div>';
        } else {
          try{var err=JSON.parse(xhr.responseText);}catch(e){var err={error:'خطأ غير متوقع'};}
          el.innerHTML='<div style="background:white;border-radius:16px;padding:40px;text-align:center;max-width:420px;box-shadow:0 25px 50px rgba(0,0,0,0.3);direction:rtl"><div style="font-size:48px;margin-bottom:16px">❌</div><div style="font-size:18px;font-weight:bold;color:#dc2626">'+(err.error||'خطأ')+'</div>'+(err.hint?'<div style="font-size:13px;color:#888;margin-top:8px">'+err.hint+'</div>':'')+'<button onclick="this.closest(\\'#_lmb_overlay\\').remove()" style="margin-top:20px;padding:10px 32px;border-radius:10px;border:none;background:#666;color:white;font-size:15px;cursor:pointer">إغلاق</button></div>';
        }
      };
      xhr.onerror=function(){
        var el=document.getElementById('_lmb_overlay');
        el.innerHTML='<div style="background:white;border-radius:16px;padding:40px;text-align:center;direction:rtl"><div style="font-size:48px">❌</div><div style="color:#dc2626;margin-top:12px;font-weight:bold">تعذر الاتصال بالخادم</div><div style="font-size:13px;color:#888;margin-top:8px">تأكد من اتصالك بالإنترنت</div><button onclick="this.closest(\\'#_lmb_overlay\\').remove()" style="margin-top:20px;padding:10px 32px;border-radius:10px;border:none;background:#666;color:white;cursor:pointer">إغلاق</button></div>';
      };
      xhr.send(JSON.stringify(payload));
    },15000);

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
