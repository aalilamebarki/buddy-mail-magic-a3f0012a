import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Globe, ClipboardPaste, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { parseMahakimContent, type ParsedMahakimData } from '@/lib/parse-mahakim-text';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface BrowserFetchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  caseNumber: string;
  onSuccess: () => void;
}

export function BrowserFetchDialog({ open, onOpenChange, caseId, caseNumber, onSuccess }: BrowserFetchDialogProps) {
  const { user } = useAuth();
  const [pastedText, setPastedText] = useState('');
  const [parsed, setParsed] = useState<ParsedMahakimData | null>(null);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<'paste' | 'preview' | 'done'>('paste');

  const handleParse = () => {
    if (!pastedText.trim()) {
      toast.error('الرجاء لصق المحتوى أولاً');
      return;
    }
    const result = parseMahakimContent(pastedText);
    setParsed(result);
    setStep('preview');
  };

  const handleSave = async () => {
    if (!parsed || !user) return;
    setSaving(true);

    try {
      const { caseInfo, procedures } = parsed;

      // 1. Update case metadata
      const caseUpdate: Record<string, unknown> = {
        last_synced_at: new Date().toISOString(),
        last_sync_result: {
          caseInfo,
          procedures,
          _provider: 'browser',
          _timestamp: new Date().toISOString(),
          rawText: parsed.rawText.substring(0, 5000),
        },
      };
      if (caseInfo.judge) caseUpdate.mahakim_judge = caseInfo.judge;
      if (caseInfo.department) caseUpdate.mahakim_department = caseInfo.department;
      if (caseInfo.status) caseUpdate.mahakim_status = caseInfo.status;
      if (caseInfo.court) caseUpdate.court = caseInfo.court;

      await supabase.from('cases').update(caseUpdate).eq('id', caseId);

      // 2. Insert procedures (deduplicated)
      if (procedures.length > 0) {
        const { data: existing } = await supabase
          .from('case_procedures')
          .select('action_date, action_type')
          .eq('case_id', caseId)
          .eq('source', 'mahakim');

        const existingKeys = new Set(
          (existing || []).map(p => `${p.action_date}|${p.action_type}`)
        );

        const newProcs = procedures
          .filter(p => !existingKeys.has(`${p.action_date}|${p.action_type}`))
          .map(p => ({
            case_id: caseId,
            action_date: p.action_date || null,
            action_type: p.action_type || '',
            decision: p.decision || null,
            next_session_date: p.next_session_date || null,
            source: 'mahakim' as const,
            is_manual: false,
          }));

        if (newProcs.length > 0) {
          await supabase.from('case_procedures').insert(newProcs);
        }
      }

      // 3. Extract future sessions
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const dateRegex = /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})|(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/;
      const futureSessionDates = new Set<string>();

      for (const proc of procedures) {
        for (const field of [proc.next_session_date, proc.action_date]) {
          if (!field) continue;
          const match = field.match(dateRegex);
          if (!match) continue;
          let dateKey: string;
          if (match[4]) {
            dateKey = `${match[4]}-${match[5].padStart(2, '0')}-${match[6].padStart(2, '0')}`;
          } else {
            dateKey = `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
          }
          const d = new Date(`${dateKey}T00:00:00`);
          if (!isNaN(d.getTime()) && d >= now) {
            futureSessionDates.add(dateKey);
          }
        }
      }

      if (futureSessionDates.size > 0) {
        const { data: existingSessions } = await supabase
          .from('court_sessions')
          .select('session_date')
          .eq('case_id', caseId);

        const existingDates = new Set((existingSessions || []).map(s => s.session_date));
        const newSessions = [...futureSessionDates]
          .filter(d => !existingDates.has(d))
          .map(d => ({
            case_id: caseId,
            session_date: d,
            user_id: user.id,
            required_action: '',
            notes: 'تم الجلب من المتصفح',
            status: 'scheduled',
          }));

        if (newSessions.length > 0) {
          await supabase.from('court_sessions').insert(newSessions);
        }
      }

      toast.success(`تم استيراد ${procedures.length} إجراء${futureSessionDates.size > 0 ? ` و ${futureSessionDates.size} جلسة` : ''} بنجاح ✅`);
      setStep('done');
      onSuccess();
    } catch (err) {
      console.error('Save error:', err);
      toast.error('خطأ في حفظ البيانات');
    }
    setSaving(false);
  };

  const handleClose = () => {
    setPastedText('');
    setParsed(null);
    setStep('paste');
    onOpenChange(false);
  };

  const portalUrl = `https://www.mahakim.ma/e-services/ejustice/#/dossier`;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            جلب من المتصفح
          </DialogTitle>
          <DialogDescription>
            استخرج بيانات الملف مباشرة من بوابة محاكم عبر متصفحك
          </DialogDescription>
        </DialogHeader>

        {step === 'paste' && (
          <div className="space-y-4">
            {/* Instructions */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-3 text-sm">
              <p className="font-semibold">الخطوات:</p>
              <ol className="space-y-2 list-decimal list-inside">
                <li>
                  افتح{' '}
                  <a href={portalUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline font-medium">
                    بوابة محاكم
                  </a>{' '}
                  في نافذة جديدة
                </li>
                <li>ابحث عن ملفك برقم <span className="font-mono text-primary" dir="ltr">{caseNumber}</span></li>
                <li>
                  بعد ظهور البيانات، حدد كل المحتوى{' '}
                  <kbd className="px-1.5 py-0.5 rounded bg-muted border text-xs">Ctrl+A</kbd>{' '}
                  ثم انسخه{' '}
                  <kbd className="px-1.5 py-0.5 rounded bg-muted border text-xs">Ctrl+C</kbd>
                </li>
                <li>ألصق المحتوى في الحقل أدناه</li>
              </ol>
            </div>

            <Textarea
              value={pastedText}
              onChange={e => setPastedText(e.target.value)}
              placeholder="ألصق محتوى صفحة بوابة محاكم هنا..."
              rows={10}
              className="font-mono text-xs leading-relaxed"
              dir="rtl"
            />

            <div className="flex justify-between items-center">
              <Button variant="outline" size="sm" asChild>
                <a href={portalUrl} target="_blank" rel="noopener noreferrer">
                  <Globe className="h-4 w-4 ml-1" />
                  فتح البوابة
                </a>
              </Button>
              <Button onClick={handleParse} disabled={!pastedText.trim()}>
                <ClipboardPaste className="h-4 w-4 ml-1" />
                تحليل المحتوى
              </Button>
            </div>
          </div>
        )}

        {step === 'preview' && parsed && (
          <div className="space-y-4">
            {/* Case Info Preview */}
            <div className="space-y-2">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                بيانات الملف المستخرجة
                {Object.keys(parsed.caseInfo).length > 0 ? (
                  <Badge variant="default" className="text-xs"><CheckCircle2 className="h-3 w-3 ml-1" />{Object.keys(parsed.caseInfo).length} حقل</Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs"><AlertCircle className="h-3 w-3 ml-1" />لم يتم العثور على بيانات</Badge>
                )}
              </h4>
              {Object.entries(parsed.caseInfo).length > 0 && (
                <div className="bg-muted/30 rounded p-3 space-y-1 text-sm">
                  {parsed.caseInfo.judge && <div className="flex justify-between"><span className="text-muted-foreground">القاضي:</span><span>{parsed.caseInfo.judge}</span></div>}
                  {parsed.caseInfo.department && <div className="flex justify-between"><span className="text-muted-foreground">الشعبة:</span><span>{parsed.caseInfo.department}</span></div>}
                  {parsed.caseInfo.status && <div className="flex justify-between"><span className="text-muted-foreground">الحالة:</span><span>{parsed.caseInfo.status}</span></div>}
                  {parsed.caseInfo.court && <div className="flex justify-between"><span className="text-muted-foreground">المحكمة:</span><span>{parsed.caseInfo.court}</span></div>}
                  {parsed.caseInfo.subject && <div className="flex justify-between"><span className="text-muted-foreground">الموضوع:</span><span>{parsed.caseInfo.subject}</span></div>}
                </div>
              )}
            </div>

            {/* Procedures Preview */}
            <div className="space-y-2">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                الإجراءات المستخرجة
                <Badge variant={parsed.procedures.length > 0 ? 'default' : 'secondary'} className="text-xs">
                  {parsed.procedures.length} إجراء
                </Badge>
              </h4>
              {parsed.procedures.length > 0 ? (
                <div className="max-h-48 overflow-auto rounded border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="text-right p-2">التاريخ</th>
                        <th className="text-right p-2">الإجراء</th>
                        <th className="text-right p-2">القرار</th>
                        <th className="text-right p-2">الجلسة المقبلة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.procedures.map((p, i) => (
                        <tr key={i} className="border-t">
                          <td className="p-2 whitespace-nowrap">{p.action_date || '—'}</td>
                          <td className="p-2">{p.action_type || '—'}</td>
                          <td className="p-2 text-muted-foreground">{p.decision || '—'}</td>
                          <td className="p-2">{p.next_session_date || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-4 text-sm text-muted-foreground bg-muted/30 rounded">
                  <AlertCircle className="h-5 w-5 mx-auto mb-1 text-amber-500" />
                  لم يتم استخراج إجراءات. تأكد من نسخ الصفحة الصحيحة.
                </div>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setStep('paste')}>
                رجوع
              </Button>
              <Button onClick={handleSave} disabled={saving || (parsed.procedures.length === 0 && Object.keys(parsed.caseInfo).length === 0)}>
                {saving ? <><Loader2 className="h-4 w-4 ml-1 animate-spin" />جاري الحفظ...</> : 'حفظ البيانات'}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'done' && (
          <div className="text-center py-8 space-y-3">
            <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-500" />
            <p className="font-semibold">تم استيراد البيانات بنجاح</p>
            <p className="text-sm text-muted-foreground">
              تم تحديث بيانات الملف والإجراءات
            </p>
            <Button onClick={handleClose}>إغلاق</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
