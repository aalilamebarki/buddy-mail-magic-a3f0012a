/**
 * زر Bookmarklet — يولّد سكريبت JavaScript يمكن للمحامي سحبه لشريط المفضلة
 * عند تشغيله على صفحة ملف في mahakim.ma يجلب البيانات ويرسلها للنظام
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Bookmark, Copy, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface BookmarkletButtonProps {
  caseNumber: string;
}

function buildBookmarkletCode(caseNumber: string): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  // Minified bookmarklet that scrapes the current mahakim.ma page and POSTs to our edge function
  return `javascript:void((function(){
  if(!location.hostname.includes('mahakim.ma')){alert('⚠️ افتح هذا على موقع mahakim.ma أولاً');return;}
  var caseNumber='${caseNumber}';
  var endpoint='${supabaseUrl}/functions/v1/bookmarklet-receiver';
  var labels={};var rows=document.querySelectorAll('table tr, .detail-row, .info-row, div.row');
  rows.forEach(function(r){
    var cells=r.querySelectorAll('td,th,span,label,div');
    if(cells.length>=2){var k=cells[0].textContent.trim();var v=cells[1].textContent.trim();if(k&&v)labels[k]=v;}
  });
  var caseInfo={};
  var map={'القاضي':'judge','الشعبة':'department','المحكمة':'court','الحالة':'status',
    'المدعي':'plaintiff','المدعى عليه':'defendant','الجلسة المقبلة':'next_hearing'};
  for(var ar in map){for(var lbl in labels){if(lbl.includes(ar)){caseInfo[map[ar]]=labels[lbl];}}}
  var procedures=[];
  var procTables=document.querySelectorAll('table');
  procTables.forEach(function(tbl){
    var hdr=tbl.querySelector('thead,tr:first-child');
    if(!hdr||!hdr.textContent.includes('الإجراء'))return;
    tbl.querySelectorAll('tbody tr, tr:not(:first-child)').forEach(function(tr){
      var tds=tr.querySelectorAll('td');
      if(tds.length>=2){
        procedures.push({action_date:tds[0]?tds[0].textContent.trim():'',
          action_type:tds[1]?tds[1].textContent.trim():'',
          decision:tds[2]?tds[2].textContent.trim():'',
          next_session_date:tds[3]?tds[3].textContent.trim():''});
      }
    });
  });
  var body=JSON.stringify({caseNumber:caseNumber,caseInfo:caseInfo,procedures:procedures,allLabels:labels,rawText:document.body.innerText.substring(0,8000)});
  var status=document.createElement('div');
  status.style.cssText='position:fixed;top:10px;right:10px;z-index:99999;background:#1e40af;color:white;padding:12px 20px;border-radius:8px;font-family:Arial;font-size:14px;direction:rtl;box-shadow:0 4px 12px rgba(0,0,0,0.3)';
  status.textContent='⏳ جاري إرسال البيانات...';
  document.body.appendChild(status);
  fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:body})
  .then(function(r){return r.json()})
  .then(function(d){
    if(d.success){status.style.background='#059669';status.textContent='✅ '+d.message;}
    else{status.style.background='#dc2626';status.textContent='❌ '+(d.error||'خطأ');}
    setTimeout(function(){status.remove()},5000);
  })
  .catch(function(e){status.style.background='#dc2626';status.textContent='❌ خطأ في الاتصال';setTimeout(function(){status.remove()},5000);});
  })())`;
}

export const BookmarkletButton = ({ caseNumber }: BookmarkletButtonProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const bookmarkletCode = buildBookmarkletCode(caseNumber);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(bookmarkletCode);
      setCopied(true);
      toast.success('تم نسخ الكود — الصقه كعنوان URL في مفضلة جديدة');
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast.error('فشل النسخ — حاول يدوياً');
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-[10px] text-muted-foreground hover:text-foreground gap-1"
        onClick={() => setDialogOpen(true)}
      >
        <Bookmark className="h-3 w-3" />
        Bookmarklet
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bookmark className="h-5 w-5 text-primary" />
              جلب البيانات عبر Bookmarklet
            </DialogTitle>
            <DialogDescription>
              أداة مجانية تعمل من متصفحك مباشرة — لا حاجة لأي خدمة خارجية
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">كيف تستخدمها؟</h4>
              <ol className="text-xs text-muted-foreground space-y-2 list-decimal list-inside">
                <li>اسحب الزر الأزرق أدناه إلى <strong>شريط المفضلة</strong> في متصفحك</li>
                <li>افتح <a href="https://www.mahakim.ma/#/suivi/dossier-suivi" target="_blank" rel="noopener" className="text-primary underline">بوابة محاكم</a> وابحث عن ملفك</li>
                <li>عندما تظهر بيانات الملف، اضغط على المفضلة التي أضفتها</li>
                <li>ستُرسل البيانات تلقائياً وتظهر لك رسالة تأكيد ✅</li>
              </ol>
            </div>

            {/* Draggable bookmarklet link */}
            <div className="flex flex-col items-center gap-3 p-4 rounded-lg bg-muted/50 border border-border">
              <p className="text-[10px] text-muted-foreground">⬇️ اسحب هذا الزر لشريط المفضلة</p>
              <a
                href={bookmarkletCode}
                onClick={(e) => e.preventDefault()}
                draggable
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium shadow-md hover:bg-primary/90 cursor-grab active:cursor-grabbing select-none"
              >
                <Bookmark className="h-4 w-4" />
                جلب ملف {caseNumber}
              </a>
              <p className="text-[10px] text-muted-foreground">
                أو انسخ الكود يدوياً وأنشئ مفضلة جديدة بعنوان URL هذا الكود
              </p>
            </div>

            {/* Copy button */}
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2 text-xs"
              onClick={handleCopy}
            >
              {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'تم النسخ ✅' : 'نسخ كود الـ Bookmarklet'}
            </Button>

            <p className="text-[10px] text-muted-foreground bg-amber-50 dark:bg-amber-950/30 rounded p-2">
              💡 رقم الملف المضمّن: <strong dir="ltr">{caseNumber}</strong> — سيبحث تلقائياً عن هذا الملف في قاعدة البيانات
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
