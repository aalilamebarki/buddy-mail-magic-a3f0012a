import { useState, useMemo, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, RefreshCw, ExternalLink, CheckCircle2, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { SyncJob } from '@/hooks/useMahakimSync';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import {
  COURT_HIERARCHY,
  filterAppellateByCode,
  detectCourtsFromName,
  validateHierarchy,
  parseCaseNumber,
  getCategoryFromCode,
  type CourtCategory,
} from '@/lib/court-mapping';

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

const categoryLabels: Record<CourtCategory, string> = {
  civil: 'مدني / جنائي / أسري',
  commercial: 'تجاري',
  administrative: 'إداري',
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

  // Parse case number into 3 parts
  const parsed = useMemo(() => parseCaseNumber(caseNumber), [caseNumber]);

  // Override fields for sync dialog
  const [numero, setNumero] = useState('');
  const [code, setCode] = useState('');
  const [annee, setAnnee] = useState('');
  const [selectedAppealIdx, setSelectedAppealIdx] = useState<string>('');
  const [selectedPrimaryIdx, setSelectedPrimaryIdx] = useState<string>('');

  // Derived: filtered appellate courts based on code
  const codeCategory = useMemo(() => getCategoryFromCode(code), [code]);
  const filteredAppellate = useMemo(() => {
    if (code.length === 4) return filterAppellateByCode(code);
    return COURT_HIERARCHY;
  }, [code]);

  // Selected appellate court object
  const selectedAppeal = selectedAppealIdx !== '' ? COURT_HIERARCHY[parseInt(selectedAppealIdx)] : null;

  // Hierarchy mismatch validation
  const hierarchyError = useMemo(() => {
    if (code.length !== 4 || selectedAppealIdx === '') return null;
    return validateHierarchy(code, parseInt(selectedAppealIdx));
  }, [code, selectedAppealIdx]);

  // Whether to show primary court dropdown
  const showPrimary = selectedAppeal && selectedAppeal.primaryCourts.length > 0 &&
    (courtLevel === 'ابتدائية' || courtLevel === 'تجارية' || courtLevel === 'إدارية' || !courtLevel);

  const handleOpenDialog = () => {
    setNumero(parsed.numero);
    setCode(parsed.code);
    setAnnee(parsed.annee);

    // Auto-detect from court name
    const detected = detectCourtsFromName(courtName);
    if (detected.appealIdx >= 0) {
      setSelectedAppealIdx(String(detected.appealIdx));
      setSelectedPrimaryIdx(detected.primaryIdx >= 0 ? String(detected.primaryIdx) : '');
    } else {
      setSelectedAppealIdx('');
      setSelectedPrimaryIdx('');
    }
    setDialogOpen(true);
  };

  // When code changes and has 4 digits, auto-filter and reset appeal if mismatched
  useEffect(() => {
    if (code.length === 4 && selectedAppealIdx !== '') {
      const err = validateHierarchy(code, parseInt(selectedAppealIdx));
      if (err) {
        setSelectedAppealIdx('');
        setSelectedPrimaryIdx('');
      }
    }
  }, [code]);

  const isFormValid = useMemo(() => {
    return numero.trim() !== '' &&
      code.length === 4 && /^\d{4}$/.test(code) &&
      annee.length === 4 && /^\d{4}$/.test(annee) &&
      selectedAppealIdx !== '' &&
      !hierarchyError;
  }, [numero, code, annee, selectedAppealIdx, hierarchyError]);

  const handleConfirmSync = () => {
    if (!isFormValid) return;
    const ac = COURT_HIERARCHY[parseInt(selectedAppealIdx)];
    const primaryLabel = selectedPrimaryIdx !== '' && ac
      ? ac.primaryCourts[parseInt(selectedPrimaryIdx)]?.portalLabel
      : undefined;
    onSync(ac.portalLabel, primaryLabel);
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
            <DialogTitle>مزامنة الملف من بوابة محاكم</DialogTitle>
            <DialogDescription>أدخل بيانات الملف واختر المحكمة المختصة</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* 3-field case number input */}
            <div className="space-y-2">
              <Label className="font-medium">رقم الملف *</Label>
              <div className="grid grid-cols-3 gap-2" dir="ltr">
                <div>
                  <Label className="text-[10px] text-muted-foreground">رقم الملف</Label>
                  <Input
                    value={numero}
                    onChange={e => setNumero(e.target.value.replace(/\D/g, ''))}
                    placeholder="مثال: 1"
                    className="text-center font-mono"
                    dir="ltr"
                    autoFocus
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">رمز الملف (4 أرقام)</Label>
                  <Input
                    value={code}
                    onChange={e => {
                      const v = e.target.value.replace(/\D/g, '').slice(0, 4);
                      setCode(v);
                    }}
                    placeholder="1401"
                    className={`text-center font-mono ${code.length > 0 && code.length !== 4 ? 'border-destructive' : ''}`}
                    dir="ltr"
                    maxLength={4}
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">سنة الملف (4 أرقام)</Label>
                  <Input
                    value={annee}
                    onChange={e => {
                      const v = e.target.value.replace(/\D/g, '').slice(0, 4);
                      setAnnee(v);
                    }}
                    placeholder="2025"
                    className={`text-center font-mono ${annee.length > 0 && annee.length !== 4 ? 'border-destructive' : ''}`}
                    dir="ltr"
                    maxLength={4}
                  />
                </div>
              </div>
              {code.length === 4 && (
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  النوع المكتشف: <Badge variant="outline" className="text-[10px] px-1.5 py-0">{categoryLabels[codeCategory]}</Badge>
                </p>
              )}
            </div>

            {/* Appellate Court */}
            <div className="space-y-2">
              <Label className="font-medium">محكمة الاستئناف *</Label>
              <Select
                value={selectedAppealIdx}
                onValueChange={(v) => { setSelectedAppealIdx(v); setSelectedPrimaryIdx(''); }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر محكمة الاستئناف..." />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {filteredAppellate.map((ac) => {
                    const globalIdx = COURT_HIERARCHY.indexOf(ac);
                    return (
                      <SelectItem key={globalIdx} value={String(globalIdx)}>
                        {ac.label}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {code.length === 4 && filteredAppellate.length < COURT_HIERARCHY.length && (
                <p className="text-[10px] text-muted-foreground">
                  تمت تصفية المحاكم حسب الرمز ({categoryLabels[codeCategory]})
                </p>
              )}
            </div>

            {/* Hierarchy Mismatch Error */}
            {hierarchyError && (
              <div className="flex items-start gap-2 p-2.5 rounded-md bg-destructive/10 border border-destructive/30">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-xs text-destructive font-medium">{hierarchyError}</p>
              </div>
            )}

            {/* Primary Court */}
            {showPrimary && selectedAppeal && (
              <div className="space-y-2">
                <Label>المحكمة الابتدائية</Label>
                <Select
                  value={selectedPrimaryIdx}
                  onValueChange={setSelectedPrimaryIdx}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر المحكمة الابتدائية..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {selectedAppeal.primaryCourts.map((pc, j) => (
                      <SelectItem key={j} value={String(j)}>{pc.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {courtName && (
                  <p className="text-[10px] text-muted-foreground">
                    المحكمة المسجلة في الملف: {courtName}
                  </p>
                )}
              </div>
            )}

            {/* Auto-detection note */}
            {detectCourtsFromName(courtName).appealIdx >= 0 && (
              <p className="text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 rounded p-2">
                تم اكتشاف المحكمة تلقائياً من بيانات الملف
              </p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button onClick={handleConfirmSync} disabled={!isFormValid} className="gap-2">
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
                إعادة المحاولة {latestJob.retry_count}/{latestJob.max_retries}
              </p>
            )}

            {latestJob.status === 'failed' && latestJob.error_message && (
              <p className="text-xs text-destructive bg-destructive/10 rounded p-2">
                {latestJob.error_message}
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
