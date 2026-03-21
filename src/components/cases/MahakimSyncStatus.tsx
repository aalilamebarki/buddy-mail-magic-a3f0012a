/**
 * مكون المزامنة الرئيسي مع بوابة محاكم
 * Main Mahakim sync component — يدعم المزامنة الذكية (نسخ/لصق) والمزامنة التلقائية
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, ExternalLink, ClipboardPaste } from 'lucide-react';
import { SyncDialog } from './mahakim/SyncDialog';
import { SyncStatusCard } from './mahakim/SyncStatusCard';
import { SyncBanners } from './mahakim/SyncBanners';
import { SmartSyncAssistant } from './mahakim/SmartSyncAssistant';
import type { MahakimSyncStatusProps } from './mahakim/types';

export type { MahakimSyncStatusProps } from './mahakim/types';

export const MahakimSyncStatus = ({
  caseNumber,
  courtName,
  latestJob,
  syncing,
  onSync,
  onOpenPortal,
  caseId,
  onSyncComplete,
}: MahakimSyncStatusProps) => {
  const isActive = syncing || latestJob?.status === 'pending' || latestJob?.status === 'scraping';
  const [dialogOpen, setDialogOpen] = useState(false);
  const [smartSyncOpen, setSmartSyncOpen] = useState(false);

  return (
    <div className="space-y-2">
      {/* الزر الرئيسي: المزامنة الذكية (مجانية) */}
      <Button
        variant="default"
        size="sm"
        className="w-full gap-2"
        onClick={() => setSmartSyncOpen(true)}
      >
        <ClipboardPaste className="h-4 w-4" />
        مزامنة ذكية (مجانية)
      </Button>

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 gap-2"
          disabled={isActive}
          onClick={() => setDialogOpen(true)}
        >
          {isActive ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {isActive ? 'جاري المزامنة...' : 'مزامنة تلقائية'}
        </Button>
        <Button variant="outline" size="sm" onClick={onOpenPortal} className="gap-1">
          <ExternalLink className="h-3.5 w-3.5" />
          فتح
        </Button>
      </div>

      <SyncDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialCaseNumber={caseNumber}
        courtName={courtName}
        latestJob={latestJob}
        onConfirm={onSync}
      />

      {caseId && (
        <SmartSyncAssistant
          open={smartSyncOpen}
          onOpenChange={setSmartSyncOpen}
          caseId={caseId}
          caseNumber={caseNumber}
          onSyncComplete={onSyncComplete || (() => {})}
        />
      )}

      {latestJob && <SyncStatusCard job={latestJob} />}
      <SyncBanners job={latestJob} />

      <p className="text-[10px] text-muted-foreground text-center">
        رقم الملف: <span dir="ltr" className="font-mono font-bold">{caseNumber}</span>
      </p>
    </div>
  );
};
