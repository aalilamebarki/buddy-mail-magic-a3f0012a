import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, RefreshCw, ExternalLink, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { SyncJob } from '@/hooks/useMahakimSync';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

/* ══════════════════════════════════════════════════════════════════
   Moroccan Appeal Courts & their First-Instance Courts mapping
   ══════════════════════════════════════════════════════════════════ */

export interface AppealCourt {
  label: string;
  /** Text to match in the Mahakim portal dropdown */
  portalLabel: string;
  firstInstanceCourts: { label: string; portalLabel: string }[];
}

export const APPEAL_COURTS: AppealCourt[] = [
  {
    label: 'محكمة الاستئناف بالرباط',
    portalLabel: 'الرباط',
    firstInstanceCourts: [
      { label: 'المحكمة الابتدائية بالرباط', portalLabel: 'الرباط' },
      { label: 'المحكمة الابتدائية بسلا', portalLabel: 'سلا' },
      { label: 'المحكمة الابتدائية بتمارة', portalLabel: 'تمارة' },
      { label: 'المحكمة الابتدائية بالخميسات', portalLabel: 'الخميسات' },
    ],
  },
  {
    label: 'محكمة الاستئناف بالدار البيضاء',
    portalLabel: 'الدار البيضاء',
    firstInstanceCourts: [
      { label: 'المحكمة الابتدائية بالدار البيضاء', portalLabel: 'الدار البيضاء' },
      { label: 'المحكمة الابتدائية عين السبع', portalLabel: 'عين السبع' },
      { label: 'المحكمة الابتدائية بن مسيك', portalLabel: 'بن مسيك' },
      { label: 'المحكمة الابتدائية بالمحمدية', portalLabel: 'المحمدية' },
      { label: 'المحكمة الابتدائية ببرشيد', portalLabel: 'برشيد' },
    ],
  },
  {
    label: 'محكمة الاستئناف بفاس',
    portalLabel: 'فاس',
    firstInstanceCourts: [
      { label: 'المحكمة الابتدائية بفاس', portalLabel: 'فاس' },
      { label: 'المحكمة الابتدائية بصفرو', portalLabel: 'صفرو' },
      { label: 'المحكمة الابتدائية ببولمان', portalLabel: 'بولمان' },
      { label: 'المحكمة الابتدائية بمولاي يعقوب', portalLabel: 'مولاي يعقوب' },
    ],
  },
  {
    label: 'محكمة الاستئناف بمراكش',
    portalLabel: 'مراكش',
    firstInstanceCourts: [
      { label: 'المحكمة الابتدائية بمراكش', portalLabel: 'مراكش' },
      { label: 'المحكمة الابتدائية بابن جرير', portalLabel: 'ابن جرير' },
      { label: 'المحكمة الابتدائية بقلعة السراغنة', portalLabel: 'قلعة السراغنة' },
      { label: 'المحكمة الابتدائية بالصويرة', portalLabel: 'الصويرة' },
      { label: 'المحكمة الابتدائية بالحوز', portalLabel: 'الحوز' },
    ],
  },
  {
    label: 'محكمة الاستئناف بمكناس',
    portalLabel: 'مكناس',
    firstInstanceCourts: [
      { label: 'المحكمة الابتدائية بمكناس', portalLabel: 'مكناس' },
      { label: 'المحكمة الابتدائية بإفران', portalLabel: 'إفران' },
      { label: 'المحكمة الابتدائية بالحاجب', portalLabel: 'الحاجب' },
      { label: 'المحكمة الابتدائية بأزرو', portalLabel: 'أزرو' },
    ],
  },
  {
    label: 'محكمة الاستئناف بطنجة',
    portalLabel: 'طنجة',
    firstInstanceCourts: [
      { label: 'المحكمة الابتدائية بطنجة', portalLabel: 'طنجة' },
      { label: 'المحكمة الابتدائية بأصيلة', portalLabel: 'أصيلة' },
      { label: 'المحكمة الابتدائية بالعرائش', portalLabel: 'العرائش' },
      { label: 'المحكمة الابتدائية بالقصر الكبير', portalLabel: 'القصر الكبير' },
    ],
  },
  {
    label: 'محكمة الاستئناف بوجدة',
    portalLabel: 'وجدة',
    firstInstanceCourts: [
      { label: 'المحكمة الابتدائية بوجدة', portalLabel: 'وجدة' },
      { label: 'المحكمة الابتدائية ببركان', portalLabel: 'بركان' },
      { label: 'المحكمة الابتدائية بجرادة', portalLabel: 'جرادة' },
      { label: 'المحكمة الابتدائية بفجيج', portalLabel: 'فجيج' },
      { label: 'المحكمة الابتدائية بتاوريرت', portalLabel: 'تاوريرت' },
    ],
  },
  {
    label: 'محكمة الاستئناف بأكادير',
    portalLabel: 'أكادير',
    firstInstanceCourts: [
      { label: 'المحكمة الابتدائية بأكادير', portalLabel: 'أكادير' },
      { label: 'المحكمة الابتدائية بإنزكان', portalLabel: 'إنزكان' },
      { label: 'المحكمة الابتدائية بتارودانت', portalLabel: 'تارودانت' },
      { label: 'المحكمة الابتدائية بتيزنيت', portalLabel: 'تيزنيت' },
    ],
  },
  {
    label: 'محكمة الاستئناف بالقنيطرة',
    portalLabel: 'القنيطرة',
    firstInstanceCourts: [
      { label: 'المحكمة الابتدائية بالقنيطرة', portalLabel: 'القنيطرة' },
      { label: 'المحكمة الابتدائية بسيدي قاسم', portalLabel: 'سيدي قاسم' },
      { label: 'المحكمة الابتدائية بسيدي سليمان', portalLabel: 'سيدي سليمان' },
      { label: 'المحكمة الابتدائية بسوق أربعاء الغرب', portalLabel: 'سوق أربعاء الغرب' },
    ],
  },
  {
    label: 'محكمة الاستئناف بتطوان',
    portalLabel: 'تطوان',
    firstInstanceCourts: [
      { label: 'المحكمة الابتدائية بتطوان', portalLabel: 'تطوان' },
      { label: 'المحكمة الابتدائية بشفشاون', portalLabel: 'شفشاون' },
      { label: 'المحكمة الابتدائية بالمضيق', portalLabel: 'المضيق' },
    ],
  },
  {
    label: 'محكمة الاستئناف بسطات',
    portalLabel: 'سطات',
    firstInstanceCourts: [
      { label: 'المحكمة الابتدائية بسطات', portalLabel: 'سطات' },
      { label: 'المحكمة الابتدائية ببنسليمان', portalLabel: 'بنسليمان' },
    ],
  },
  {
    label: 'محكمة الاستئناف ببني ملال',
    portalLabel: 'بني ملال',
    firstInstanceCourts: [
      { label: 'المحكمة الابتدائية ببني ملال', portalLabel: 'بني ملال' },
      { label: 'المحكمة الابتدائية بأزيلال', portalLabel: 'أزيلال' },
      { label: 'المحكمة الابتدائية بالفقيه بن صالح', portalLabel: 'الفقيه بن صالح' },
    ],
  },
  {
    label: 'محكمة الاستئناف بالجديدة',
    portalLabel: 'الجديدة',
    firstInstanceCourts: [
      { label: 'المحكمة الابتدائية بالجديدة', portalLabel: 'الجديدة' },
      { label: 'المحكمة الابتدائية بسيدي بنور', portalLabel: 'سيدي بنور' },
    ],
  },
  {
    label: 'محكمة الاستئناف بخريبكة',
    portalLabel: 'خريبكة',
    firstInstanceCourts: [
      { label: 'المحكمة الابتدائية بخريبكة', portalLabel: 'خريبكة' },
      { label: 'المحكمة الابتدائية بوادي زم', portalLabel: 'وادي زم' },
    ],
  },
  {
    label: 'محكمة الاستئناف بتازة',
    portalLabel: 'تازة',
    firstInstanceCourts: [
      { label: 'المحكمة الابتدائية بتازة', portalLabel: 'تازة' },
      { label: 'المحكمة الابتدائية بجرسيف', portalLabel: 'جرسيف' },
    ],
  },
  {
    label: 'محكمة الاستئناف بالناظور',
    portalLabel: 'الناظور',
    firstInstanceCourts: [
      { label: 'المحكمة الابتدائية بالناظور', portalLabel: 'الناظور' },
      { label: 'المحكمة الابتدائية بالدريوش', portalLabel: 'الدريوش' },
    ],
  },
  {
    label: 'محكمة الاستئناف بالحسيمة',
    portalLabel: 'الحسيمة',
    firstInstanceCourts: [
      { label: 'المحكمة الابتدائية بالحسيمة', portalLabel: 'الحسيمة' },
    ],
  },
  {
    label: 'محكمة الاستئناف بآسفي',
    portalLabel: 'آسفي',
    firstInstanceCourts: [
      { label: 'المحكمة الابتدائية بآسفي', portalLabel: 'آسفي' },
      { label: 'المحكمة الابتدائية باليوسفية', portalLabel: 'اليوسفية' },
    ],
  },
  {
    label: 'محكمة الاستئناف بالراشيدية',
    portalLabel: 'الراشيدية',
    firstInstanceCourts: [
      { label: 'المحكمة الابتدائية بالراشيدية', portalLabel: 'الراشيدية' },
      { label: 'المحكمة الابتدائية بميدلت', portalLabel: 'ميدلت' },
    ],
  },
  {
    label: 'محكمة الاستئناف بورزازات',
    portalLabel: 'ورزازات',
    firstInstanceCourts: [
      { label: 'المحكمة الابتدائية بورزازات', portalLabel: 'ورزازات' },
      { label: 'المحكمة الابتدائية بزاكورة', portalLabel: 'زاكورة' },
      { label: 'المحكمة الابتدائية بتنغير', portalLabel: 'تنغير' },
    ],
  },
  {
    label: 'محكمة الاستئناف بالعيون',
    portalLabel: 'العيون',
    firstInstanceCourts: [
      { label: 'المحكمة الابتدائية بالعيون', portalLabel: 'العيون' },
      { label: 'المحكمة الابتدائية بالسمارة', portalLabel: 'السمارة' },
      { label: 'المحكمة الابتدائية بالداخلة', portalLabel: 'الداخلة' },
    ],
  },
  {
    label: 'محكمة الاستئناف بكلميم',
    portalLabel: 'كلميم',
    firstInstanceCourts: [
      { label: 'المحكمة الابتدائية بكلميم', portalLabel: 'كلميم' },
      { label: 'المحكمة الابتدائية بطانطان', portalLabel: 'طانطان' },
    ],
  },
  // محاكم تجارية
  {
    label: 'محكمة الاستئناف التجارية بالدار البيضاء',
    portalLabel: 'التجارية بالدار البيضاء',
    firstInstanceCourts: [
      { label: 'المحكمة التجارية بالدار البيضاء', portalLabel: 'الدار البيضاء' },
    ],
  },
  {
    label: 'محكمة الاستئناف التجارية بفاس',
    portalLabel: 'التجارية بفاس',
    firstInstanceCourts: [
      { label: 'المحكمة التجارية بفاس', portalLabel: 'فاس' },
    ],
  },
  {
    label: 'محكمة الاستئناف التجارية بمراكش',
    portalLabel: 'التجارية بمراكش',
    firstInstanceCourts: [
      { label: 'المحكمة التجارية بمراكش', portalLabel: 'مراكش' },
    ],
  },
  // محاكم إدارية
  {
    label: 'محكمة الاستئناف الإدارية بالرباط',
    portalLabel: 'الإدارية بالرباط',
    firstInstanceCourts: [
      { label: 'المحكمة الإدارية بالرباط', portalLabel: 'الرباط' },
    ],
  },
  {
    label: 'محكمة الاستئناف الإدارية بمراكش',
    portalLabel: 'الإدارية بمراكش',
    firstInstanceCourts: [
      { label: 'المحكمة الإدارية بمراكش', portalLabel: 'مراكش' },
    ],
  },
];

/** Try to auto-detect appeal court from case court name */
function detectAppealCourt(courtName: string | null | undefined): { appealIdx: number; firstInstanceIdx: number } {
  if (!courtName) return { appealIdx: -1, firstInstanceIdx: -1 };
  const name = courtName.trim();

  for (let i = 0; i < APPEAL_COURTS.length; i++) {
    const ac = APPEAL_COURTS[i];
    // Check if the court name matches the appeal court itself
    if (name.includes(ac.label) || name.includes(ac.portalLabel)) {
      return { appealIdx: i, firstInstanceIdx: -1 };
    }
    // Check first-instance courts
    for (let j = 0; j < ac.firstInstanceCourts.length; j++) {
      const fic = ac.firstInstanceCourts[j];
      if (name.includes(fic.label) || name.includes(fic.portalLabel)) {
        return { appealIdx: i, firstInstanceIdx: j };
      }
    }
  }
  return { appealIdx: -1, firstInstanceIdx: -1 };
}

interface MahakimSyncStatusProps {
  caseNumber: string;
  courtName?: string | null;
  courtLevel?: string | null;
  latestJob: SyncJob | null;
  syncing: boolean;
  onSync: (appealCourt: string, firstInstanceCourt?: string) => void;
  onOpenPortal: () => void;
}

const statusConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  pending: { label: 'في الانتظار', icon: <Clock className="h-3.5 w-3.5" />, color: 'text-amber-600' },
  scraping: { label: 'جاري الجلب...', icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, color: 'text-blue-600' },
  completed: { label: 'تم بنجاح', icon: <CheckCircle2 className="h-3.5 w-3.5" />, color: 'text-emerald-600' },
  failed: { label: 'فشل', icon: <XCircle className="h-3.5 w-3.5" />, color: 'text-destructive' },
};

export const MahakimSyncStatus = ({
  caseNumber,
  courtName,
  courtLevel,
  latestJob,
  syncing,
  onSync,
  onOpenPortal,
}: MahakimSyncStatusProps) => {
  const status = latestJob ? statusConfig[latestJob.status] || statusConfig.pending : null;
  const isActive = syncing || latestJob?.status === 'pending' || latestJob?.status === 'scraping';

  const [dialogOpen, setDialogOpen] = useState(false);

  // Auto-detect from case court
  const detected = useMemo(() => detectAppealCourt(courtName), [courtName]);
  const [selectedAppeal, setSelectedAppeal] = useState<string>('');
  const [selectedFirstInstance, setSelectedFirstInstance] = useState<string>('');

  const isFirstInstance = courtLevel === 'ابتدائية' || courtLevel === 'تجارية' || courtLevel === 'إدارية';

  const appealCourt = selectedAppeal ? APPEAL_COURTS[parseInt(selectedAppeal)] : null;

  const handleOpenDialog = () => {
    // Pre-select detected courts
    if (detected.appealIdx >= 0) {
      setSelectedAppeal(String(detected.appealIdx));
      if (detected.firstInstanceIdx >= 0) {
        setSelectedFirstInstance(String(detected.firstInstanceIdx));
      } else {
        setSelectedFirstInstance('');
      }
    } else {
      setSelectedAppeal('');
      setSelectedFirstInstance('');
    }
    setDialogOpen(true);
  };

  const handleConfirmSync = () => {
    if (!selectedAppeal) return;
    const ac = APPEAL_COURTS[parseInt(selectedAppeal)];
    const ficLabel = selectedFirstInstance && ac
      ? ac.firstInstanceCourts[parseInt(selectedFirstInstance)]?.portalLabel
      : undefined;
    onSync(ac.portalLabel, ficLabel);
    setDialogOpen(false);
  };

  return (
    <div className="space-y-2">
      {/* Sync Button */}
      <div className="flex gap-2">
        <Button
          variant="default"
          size="sm"
          className="flex-1 gap-2"
          disabled={isActive}
          onClick={handleOpenDialog}
        >
          {isActive ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {isActive ? 'جاري المزامنة...' : 'مزامنة من محاكم'}
        </Button>
        <Button variant="outline" size="sm" onClick={onOpenPortal} className="gap-1">
          <ExternalLink className="h-3.5 w-3.5" />
          فتح
        </Button>
      </div>

      {/* Court Selection Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>اختيار المحكمة للمزامنة</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>محكمة الاستئناف *</Label>
              <Select value={selectedAppeal} onValueChange={(v) => { setSelectedAppeal(v); setSelectedFirstInstance(''); }}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر محكمة الاستئناف..." />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {APPEAL_COURTS.map((ac, i) => (
                    <SelectItem key={i} value={String(i)}>{ac.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Show first-instance dropdown if court level is ابتدائية and appeal court has FICs */}
            {appealCourt && appealCourt.firstInstanceCourts.length > 0 && isFirstInstance && (
              <div className="space-y-2">
                <Label>المحكمة الابتدائية</Label>
                <Select value={selectedFirstInstance} onValueChange={setSelectedFirstInstance}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر المحكمة الابتدائية..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {appealCourt.firstInstanceCourts.map((fic, j) => (
                      <SelectItem key={j} value={String(j)}>{fic.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">
                  {courtName && `المحكمة المسجلة في الملف: ${courtName}`}
                </p>
              </div>
            )}

            {detected.appealIdx >= 0 && (
              <p className="text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 rounded p-2">
                تم اكتشاف المحكمة تلقائياً من بيانات الملف
              </p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button onClick={handleConfirmSync} disabled={!selectedAppeal} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              بدء المزامنة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status indicator */}
      {latestJob && status && (
        <Card className="border-dashed">
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className={`flex items-center gap-1.5 text-xs font-medium ${status.color}`}>
                {status.icon}
                {status.label}
              </div>
              {latestJob.completed_at && (
                <span className="text-[10px] text-muted-foreground">
                  {formatDistanceToNow(new Date(latestJob.completed_at), { addSuffix: true, locale: ar })}
                </span>
              )}
            </div>

            {latestJob.status === 'pending' && latestJob.retry_count > 0 && (
              <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 rounded p-2">
                إعادة المحاولة {latestJob.retry_count}/{latestJob.max_retries} — جاري المحاولة مجدداً...
              </p>
            )}

            {latestJob.status === 'failed' && latestJob.error_message && (
              <p className="text-xs text-destructive bg-destructive/10 rounded p-2">
                {latestJob.error_message}
                {latestJob.retry_count > 0 && ` (بعد ${latestJob.retry_count + 1} محاولات)`}
              </p>
            )}

            {latestJob.status === 'completed' && latestJob.result_data && (
              <div className="space-y-1.5">
                {latestJob.next_session_date && (
                  <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/30 rounded p-2">
                    <Badge variant="outline" className="text-emerald-700 border-emerald-300 text-[10px]">
                      الجلسة المقبلة
                    </Badge>
                    <span className="text-xs font-semibold" dir="ltr">
                      {new Date(latestJob.next_session_date + 'T00:00:00').toLocaleDateString('ar-MA', {
                        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                      })}
                    </span>
                  </div>
                )}
                {(() => {
                  const data = latestJob.result_data as Record<string, unknown>;
                  const fields = [
                    { key: 'court', label: 'المحكمة' },
                    { key: 'judge', label: 'القاضي' },
                    { key: 'department', label: 'الشعبة' },
                    { key: 'case_type', label: 'نوع القضية' },
                  ];
                  const rendered = fields.filter(f => data[f.key]);
                  if (rendered.length === 0) return null;
                  return (
                    <div className="grid grid-cols-2 gap-1 text-[10px]">
                      {rendered.map(f => (
                        <div key={f.key}>
                          <span className="text-muted-foreground">{f.label}: </span>
                          <span className="font-medium">{data[f.key] as string}</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <p className="text-[10px] text-muted-foreground text-center">
        رقم الملف: <span dir="ltr" className="font-mono font-bold">{caseNumber}</span>
      </p>
    </div>
  );
};
