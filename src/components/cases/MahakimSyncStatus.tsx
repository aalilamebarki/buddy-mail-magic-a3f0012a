/**
 * مكون المزامنة الرئيسي مع بوابة محاكم
 * Main Mahakim sync component — المزود يُختار تلقائياً
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, ExternalLink } from 'lucide-react';
import { SyncDialog } from './mahakim/SyncDialog';
import { SyncStatusCard } from './mahakim/SyncStatusCard';
import { SyncBanners } from './mahakim/SyncBanners';
import type { MahakimSyncStatusProps } from './mahakim/types';

export type { MahakimSyncStatusProps } from './mahakim/types';

export const MahakimSyncStatus = ({
  caseNumber,
  courtName,
  latestJob,
  syncing,
  onSync,
  onOpenPortal,
}: MahakimSyncStatusProps) => {
  const isActive = syncing || latestJob?.status === 'pending' || latestJob?.status === 'scraping';
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Button
          variant="default"
          size="sm"
          className="flex-1 gap-2"
          disabled={isActive}
          onClick={() => setDialogOpen(true)}
        >
          {isActive ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {isActive ? 'جاري المزامنة...' : 'مزامنة من محاكم'}
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

      {latestJob && <SyncStatusCard job={latestJob} />}
      <SyncBanners job={latestJob} />

      <p className="text-[10px] text-muted-foreground text-center">
        رقم الملف: <span dir="ltr" className="font-mono font-bold">{caseNumber}</span>
      </p>
    </div>
  );
};
