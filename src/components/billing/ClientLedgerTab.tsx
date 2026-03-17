import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, TrendingUp, AlertTriangle, CheckCircle2, Receipt } from 'lucide-react';
import type { ClientLedgerEntry } from '@/hooks/useClientLedger';

interface Props {
  entries: ClientLedgerEntry[];
  globalStats: {
    totalAgreed: number;
    totalPaid: number;
    totalRemaining: number;
    collectionRate: number;
    clientsWithDebt: number;
  };
}

const ClientLedgerTab = ({ entries, globalStats }: Props) => {
  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-muted-foreground">إجمالي المستحقات</p>
                <p className="text-lg font-bold text-foreground">{globalStats.totalAgreed.toLocaleString('ar-u-nu-latn')} د</p>
              </div>
              <Users className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-muted-foreground">المحصّل</p>
                <p className="text-lg font-bold text-primary">{globalStats.totalPaid.toLocaleString('ar-u-nu-latn')} د</p>
              </div>
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-muted-foreground">المتبقي</p>
                <p className="text-lg font-bold text-destructive">{globalStats.totalRemaining.toLocaleString('ar-u-nu-latn')} د</p>
              </div>
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-muted-foreground">نسبة التحصيل</p>
                <p className="text-lg font-bold text-foreground">{globalStats.collectionRate}%</p>
              </div>
              <CheckCircle2 className="h-5 w-5 text-primary" />
            </div>
            <Progress value={globalStats.collectionRate} className="h-1.5 mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Client List */}
      {entries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>لا توجد حسابات موكلين بعد</p>
            <p className="text-xs mt-1">أنشئ بيانات أتعاب ووصولات لتظهر هنا</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {entries.map(entry => (
              <Card key={entry.clientId}>
                <CardContent className="pt-4 pb-3 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-foreground text-sm">{entry.clientName}</p>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="outline" className="text-[10px]">{entry.statementsCount} بيان</Badge>
                        <Badge variant="outline" className="text-[10px]">{entry.receiptsCount} وصل</Badge>
                      </div>
                    </div>
                    {entry.remaining > 0 ? (
                      <Badge variant="destructive" className="text-[10px]">متبقي</Badge>
                    ) : (
                      <Badge className="text-[10px] bg-primary/10 text-primary border-primary/20" variant="outline">مؤدى</Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-[10px] text-muted-foreground">المتفق عليه</p>
                      <p className="text-xs font-bold">{entry.totalAgreed.toLocaleString('ar-u-nu-latn')} د</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">المدفوع</p>
                      <p className="text-xs font-bold text-primary">{entry.totalPaid.toLocaleString('ar-u-nu-latn')} د</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">المتبقي</p>
                      <p className="text-xs font-bold text-destructive">{entry.remaining.toLocaleString('ar-u-nu-latn')} د</p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Progress value={entry.progress} className="h-2" />
                    <p className="text-[10px] text-muted-foreground text-center">{entry.progress}% مؤدى</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop table */}
          <Card className="hidden md:block">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">الموكل</TableHead>
                      <TableHead className="text-right">المتفق عليه</TableHead>
                      <TableHead className="text-right">المدفوع</TableHead>
                      <TableHead className="text-right">المتبقي</TableHead>
                      <TableHead className="text-right">التقدم</TableHead>
                      <TableHead className="text-right">بيانات</TableHead>
                      <TableHead className="text-right">وصولات</TableHead>
                      <TableHead className="text-right">الحالة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map(entry => (
                      <TableRow key={entry.clientId}>
                        <TableCell className="font-semibold">{entry.clientName}</TableCell>
                        <TableCell>{entry.totalAgreed.toLocaleString('ar-u-nu-latn')} د</TableCell>
                        <TableCell className="text-primary font-medium">{entry.totalPaid.toLocaleString('ar-u-nu-latn')} د</TableCell>
                        <TableCell className="font-bold text-destructive">{entry.remaining.toLocaleString('ar-u-nu-latn')} د</TableCell>
                        <TableCell className="min-w-[120px]">
                          <div className="flex items-center gap-2">
                            <Progress value={entry.progress} className="h-2 flex-1" />
                            <span className="text-xs text-muted-foreground w-8">{entry.progress}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">{entry.statementsCount}</TableCell>
                        <TableCell className="text-center">{entry.receiptsCount}</TableCell>
                        <TableCell>
                          {entry.remaining > 0 ? (
                            <Badge variant="destructive" className="text-[10px]">متبقي</Badge>
                          ) : entry.totalAgreed > 0 ? (
                            <Badge className="text-[10px] bg-primary/10 text-primary border-primary/20" variant="outline">
                              <CheckCircle2 className="h-3 w-3 ml-1" />
                              مؤدى
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">—</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default ClientLedgerTab;
