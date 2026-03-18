import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ArrowRight, Download, Printer, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDateArabic } from '@/lib/formatters';
import type { FeeStatementRecord } from '@/hooks/useFeeStatements';
import { downloadFeeStatementPdf } from '@/lib/dynamic-pdf-downloads';
import { numberToArabicWords } from '@/lib/pdf-utils';

const fmt = (n: number) =>
  n.toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const FeeStatementPreview = () => {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [statement, setStatement] = useState<FeeStatementRecord | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const { data } = await supabase
        .from('fee_statements')
        .select('*, clients(full_name, cin, phone), cases(title, case_number, court, case_type), letterheads(lawyer_name, name_fr, title_ar, title_fr, bar_name_ar, bar_name_fr, address, city, phone, email), fee_statement_items(*), fee_statement_cases(*, cases(title, case_number, court, case_type))')
        .eq('id', id)
        .maybeSingle();
      setStatement(data as unknown as FeeStatementRecord);
      setLoading(false);
    };
    load();
  }, [id]);

  const handleDownload = async () => {
    if (!statement) return;
    setDownloading(true);
    try {
      await downloadFeeStatementPdf(statement);
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = () => window.print();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: '#f0ede6' }}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#1a2a44' }} />
          <span className="text-sm" style={{ color: '#646464' }}>جاري تحميل البيان...</span>
        </div>
      </div>
    );
  }

  if (!statement) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4" dir="rtl" style={{ background: '#f0ede6' }}>
        <FileText className="h-16 w-16 opacity-20" style={{ color: '#1a2a44' }} />
        <p className="text-lg font-medium" style={{ color: '#1a2a44' }}>بيان الأتعاب غير موجود</p>
        <Link to="/dashboard/billing" className="text-sm underline" style={{ color: '#c5a059' }}>
          العودة للفوترة
        </Link>
      </div>
    );
  }

  const lh = statement.letterheads;
  const lawyerName = lh?.lawyer_name || '—';
  const city = lh?.city || '';
  const items = statement.fee_statement_items || [];
  const statementCases = statement.fee_statement_cases || [];
  const firstCase = statementCases[0]?.cases || statement.cases;
  const date = formatDateArabic(statement.created_at, { year: 'numeric', month: 'long', day: 'numeric' });

  // Build client info rows dynamically
  const infoRows: { label: string; labelFr: string; value: string }[] = [];
  if (statement.clients?.full_name) infoRows.push({ label: 'الموكل', labelFr: 'Client', value: statement.clients.full_name });
  if (firstCase?.case_number) infoRows.push({ label: 'رقم الملف', labelFr: 'N° Dossier', value: firstCase.case_number });
  if (firstCase?.court) infoRows.push({ label: 'المحكمة', labelFr: 'Tribunal', value: firstCase.court });
  if (firstCase?.case_type) infoRows.push({ label: 'طبيعة النزاع', labelFr: 'Nature', value: firstCase.case_type });
  if (statement.clients?.cin) infoRows.push({ label: 'رقم ب.و', labelFr: 'CIN', value: statement.clients.cin });
  if (statement.power_of_attorney_date) {
    infoRows.push({
      label: 'تاريخ الوكالة',
      labelFr: 'Date de procuration',
      value: formatDateArabic(statement.power_of_attorney_date, { year: 'numeric', month: 'long', day: 'numeric' }),
    });
  }

  // Build case details
  const caseBlocks = statementCases.length > 0
    ? statementCases.map(sc => {
        const caseItems = items.filter(item => item.case_id === sc.case_id || (!item.case_id));
        const expTotal = caseItems.reduce((s, i) => s + Number(i.amount), 0);
        return { sc, caseItems, expTotal };
      })
    : [{
        sc: null,
        caseItems: items,
        expTotal: items.reduce((s, i) => s + Number(i.amount), 0),
      }];

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; margin: 0 !important; }
          .a4-page { box-shadow: none !important; margin: 0 !important; border-radius: 0 !important; }
        }
        @font-face { font-family: 'Amiri'; src: url('/fonts/Amiri-Regular.ttf') format('truetype'); }
        @font-face { font-family: 'IBM Plex Sans Arabic'; src: url('/fonts/IBMPlexSansArabic-Regular.ttf') format('truetype'); font-weight: 400; }
        @font-face { font-family: 'IBM Plex Sans Arabic'; src: url('/fonts/IBMPlexSansArabic-Bold.ttf') format('truetype'); font-weight: 700; }
      `}</style>

      <div className="min-h-screen pb-12" dir="rtl" style={{ background: 'linear-gradient(180deg, #e8e4dc 0%, #f0ede6 100%)', fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}>

        {/* ─── Floating Action Bar ─── */}
        <div className="no-print sticky top-0 z-50 backdrop-blur-md border-b" style={{ background: 'rgba(26,42,68,0.92)', borderColor: 'rgba(197,160,89,0.3)' }}>
          <div className="max-w-[220mm] mx-auto px-4 py-3 flex items-center justify-between">
            <Link to="/dashboard/billing" className="text-sm flex items-center gap-2 transition-colors hover:opacity-80" style={{ color: '#c5a059' }}>
              <ArrowRight className="h-4 w-4" /> العودة للفوترة
            </Link>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                className="gap-2 border-white/20 text-white hover:bg-white/10 hover:text-white"
              >
                <Printer className="h-4 w-4" /> طباعة
              </Button>
              <Button
                size="sm"
                onClick={handleDownload}
                disabled={downloading}
                className="gap-2"
                style={{ backgroundColor: '#c5a059', color: '#1a2a44' }}
              >
                {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                تحميل PDF
              </Button>
            </div>
          </div>
        </div>

        {/* ─── A4 Page ─── */}
        <div className="max-w-[210mm] mx-auto mt-8 px-2 sm:px-0">
          <div
            className="a4-page bg-white relative overflow-hidden"
            style={{
              minHeight: '297mm',
              boxShadow: '0 25px 60px rgba(26,42,68,0.15), 0 4px 20px rgba(0,0,0,0.08)',
            }}
          >
            {/* ── Outer frame (navy) ── */}
            <div className="absolute" style={{ inset: '8mm', border: '1px solid #1a2a44' }} />
            {/* ── Inner frame (gold) ── */}
            <div className="absolute" style={{ inset: '10mm', border: '0.5px solid #c5a059' }} />

            {/* ── Content ── */}
            <div className="relative" style={{ padding: '14mm 16mm 12mm' }}>

              {/* ══════════════ HEADER ══════════════ */}
              <header className="text-center mb-6">
                {/* Office label */}
                <div className="flex items-center justify-center gap-3 mb-1">
                  <span className="block" style={{ width: 30, height: '0.5px', background: '#c5a059' }} />
                  <span className="text-[9px] tracking-[3px] uppercase" style={{ color: '#c5a059' }}>الأستاذ</span>
                  <span className="block" style={{ width: 30, height: '0.5px', background: '#c5a059' }} />
                </div>
                {lh?.name_fr && (
                  <p className="text-[7px] tracking-[2px] uppercase mb-2" style={{ color: '#969696' }}>Cabinet de Maître</p>
                )}

                {/* Lawyer name */}
                <h1 className="text-[28px] leading-tight mb-1" style={{ color: '#1a2a44', fontFamily: "'Amiri', serif" }}>
                  {lawyerName}
                </h1>
                {lh?.name_fr && (
                  <p className="text-[12px] mb-3" style={{ color: '#646464', letterSpacing: '1px' }}>{lh.name_fr}</p>
                )}

                {/* Gold ornament */}
                <div className="flex items-center justify-center gap-2 my-3">
                  <span className="block" style={{ width: 40, height: '0.5px', background: 'linear-gradient(90deg, transparent, #c5a059)' }} />
                  <span className="block" style={{ width: 6, height: 6, border: '1px solid #c5a059', transform: 'rotate(45deg)' }} />
                  <span className="block" style={{ width: 40, height: '0.5px', background: 'linear-gradient(270deg, transparent, #c5a059)' }} />
                </div>

                {/* Professional title */}
                {(lh?.title_ar || lh?.bar_name_ar) && (
                  <p className="text-[10px] mb-1" style={{ color: '#1e1e1e' }}>
                    {[lh?.title_ar, lh?.bar_name_ar ? `لدى ${lh.bar_name_ar}` : ''].filter(Boolean).join(' ')}
                  </p>
                )}
                {(lh?.title_fr || lh?.bar_name_fr) && (
                  <p className="text-[8px]" style={{ color: '#969696' }}>
                    {[lh?.title_fr, lh?.bar_name_fr ? `près ${lh.bar_name_fr}` : ''].filter(Boolean).join(' ')}
                  </p>
                )}

                {/* Contact line */}
                {(lh?.address || lh?.phone || lh?.email) && (
                  <div className="mt-3 flex items-center justify-center gap-3 flex-wrap text-[7.5px]" style={{ color: '#969696' }}>
                    {lh?.address && <span>{lh.city ? `${lh.address}، ${lh.city}` : lh.address}</span>}
                    {lh?.phone && <><span style={{ color: '#c5a059' }}>|</span><span>هاتف: {lh.phone}</span></>}
                    {lh?.email && <><span style={{ color: '#c5a059' }}>|</span><span>{lh.email}</span></>}
                  </div>
                )}

                {/* Double separator */}
                <div className="mt-4">
                  <div style={{ height: '0.8px', background: '#1a2a44' }} />
                  <div className="mt-[1px]" style={{ height: '0.3px', background: '#c5a059' }} />
                </div>
              </header>

              {/* ══════════════ DOCUMENT TITLE ══════════════ */}
              <section className="text-center my-8">
                <h2 className="text-[24px] mb-1" style={{ color: '#1a2a44', fontFamily: "'Amiri', serif" }}>
                  بيان أتعاب ومصاريف
                </h2>
                <p className="text-[9px]" style={{ color: '#969696', letterSpacing: '2px' }}>
                  Note d'honoraires et frais
                </p>
                <div className="flex items-center justify-center gap-2 mt-4">
                  <span className="block" style={{ width: 25, height: '0.5px', background: '#c5a059' }} />
                  <span className="text-[8px] px-3 py-1 rounded-full" style={{ background: '#f8f8f8', color: '#646464', border: '0.5px solid #c8c8c8' }}>
                    {statement.statement_number}
                  </span>
                  <span className="block" style={{ width: 25, height: '0.5px', background: '#c5a059' }} />
                </div>
              </section>

              {/* ══════════════ CLIENT INFO ══════════════ */}
              <section className="mb-8">
                <div className="overflow-hidden" style={{ border: '0.5px solid #e0ddd6', borderRadius: 4 }}>
                  {infoRows.map((row, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-4 px-5"
                      style={{
                        minHeight: 38,
                        background: i % 2 === 0 ? '#fafaf8' : 'white',
                        borderBottom: i < infoRows.length - 1 ? '0.5px solid #e0ddd6' : 'none',
                        borderRight: '3px solid #c5a059',
                      }}
                    >
                      <div className="flex-shrink-0" style={{ width: 130 }}>
                        <span className="text-[8px] block" style={{ color: '#c5a059' }}>{row.label}</span>
                        <span className="text-[6.5px] block" style={{ color: '#b0b0b0' }}>{row.labelFr}</span>
                      </div>
                      <span className="text-[12px] font-medium" style={{ color: '#1e1e1e' }}>{row.value}</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* ══════════════ SERVICES TABLE (per case) ══════════════ */}
              {caseBlocks.map((block, blockIdx) => {
                const { sc, caseItems, expTotal } = block;

                const summaryRows = [
                  { label: 'الأتعاب المهنية', labelFr: 'Honoraires', value: Number(sc?.lawyer_fees ?? statement.lawyer_fees), strong: false },
                  { label: 'المصاريف والرسوم', labelFr: 'Frais et débours', value: expTotal, strong: false },
                  { label: 'المجموع الصافي', labelFr: 'Sous-total HT', value: Number(sc?.subtotal ?? statement.subtotal), strong: true },
                  ...(Number(sc?.tax_rate ?? statement.tax_rate) > 0 ? [{
                    label: `الضريبة (${sc?.tax_rate ?? statement.tax_rate}%)`,
                    labelFr: 'TVA',
                    value: Number(sc?.tax_amount ?? statement.tax_amount),
                    strong: false,
                  }] : []),
                  { label: 'المجموع الكلي', labelFr: 'Total TTC', value: Number(sc?.total_amount ?? statement.total_amount), strong: true },
                ];

                return (
                  <section key={blockIdx} className="mb-6">
                    {/* Multi-case banner */}
                    {statementCases.length > 1 && sc && (
                      <div
                        className="text-center py-2 mb-3 text-[10px] text-white"
                        style={{ background: '#1a2a44', borderRadius: 3 }}
                      >
                        ملف {blockIdx + 1}: {sc.cases?.title || sc.cases?.case_number || '—'}
                      </div>
                    )}

                    {/* Table */}
                    <div style={{ borderRadius: 4, overflow: 'hidden', border: '0.5px solid #e0ddd6' }}>
                      {/* Header */}
                      <div className="flex items-center py-3 px-5 text-[8px] text-white" style={{ background: '#1a2a44' }}>
                        <span className="flex-1 text-right">بيان الخدمات / Désignation</span>
                        <span className="text-left" style={{ width: 110 }}>المبلغ / Montant (MAD)</span>
                      </div>

                      {/* Items */}
                      {caseItems.map((item, i) => (
                        <div
                          key={item.id}
                          className="flex items-start py-3 px-5"
                          style={{
                            background: i % 2 === 0 ? '#fafaf8' : 'white',
                            borderBottom: '0.5px solid #e0ddd6',
                          }}
                        >
                          <span className="flex-1 text-right text-[10px] leading-relaxed" style={{ color: '#1e1e1e' }}>
                            {item.description || '—'}
                          </span>
                          <span className="text-left text-[10px] tabular-nums" style={{ width: 110, color: '#646464' }}>
                            {fmt(Number(item.amount))}
                          </span>
                        </div>
                      ))}

                      {/* Summary */}
                      {summaryRows.map((row, ri) => (
                        <div
                          key={ri}
                          className="flex items-center py-2.5 px-5"
                          style={{
                            background: row.strong ? '#f0eff5' : 'white',
                            borderTop: '0.5px solid #e0ddd6',
                          }}
                        >
                          <span className={`flex-1 text-right ${row.strong ? 'font-bold text-[10px]' : 'text-[9px]'}`} style={{ color: row.strong ? '#1a2a44' : '#646464' }}>
                            {row.label} <span className="text-[7px]" style={{ color: '#b0b0b0' }}>/ {row.labelFr}</span>
                          </span>
                          <span className={`text-left tabular-nums ${row.strong ? 'font-bold text-[11px]' : 'text-[10px]'}`} style={{ width: 110, color: row.strong ? '#1a2a44' : '#1e1e1e' }}>
                            {fmt(row.value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })}

              {/* ══════════════ GRAND TOTAL ══════════════ */}
              <section className="mt-8 mb-6">
                {/* Navy divider */}
                <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, #1a2a44, transparent)' }} />

                <div className="mt-5 overflow-hidden" style={{ borderRadius: 6, background: 'linear-gradient(135deg, #1a2a44, #243550)', boxShadow: '0 8px 30px rgba(26,42,68,0.2)' }}>
                  <div className="px-6 py-5 flex items-end justify-between flex-wrap gap-3">
                    <div>
                      <p className="text-[9px] mb-1" style={{ color: '#c5a059' }}>الواجب أداؤه</p>
                      <p className="text-[7px]" style={{ color: 'rgba(255,255,255,0.5)' }}>Net à payer</p>
                    </div>
                    <p className="text-[26px] leading-none" style={{ color: 'white', fontFamily: "'Amiri', serif" }} dir="ltr">
                      {fmt(Number(statement.total_amount))} <span className="text-[14px]" style={{ color: '#c5a059' }}>MAD</span>
                    </p>
                  </div>
                  {/* Tafkeet bar */}
                  <div className="px-6 py-2.5" style={{ background: 'rgba(197,160,89,0.12)', borderTop: '0.5px solid rgba(197,160,89,0.2)' }}>
                    <p className="text-[8px]" style={{ color: 'rgba(255,255,255,0.7)' }}>
                      المبلغ بالحروف: {numberToArabicWords(Number(statement.total_amount))}
                    </p>
                  </div>
                </div>
              </section>

              {/* ══════════════ NOTES ══════════════ */}
              <section className="mb-6 text-center">
                <p className="text-[8px] leading-relaxed px-6" style={{ color: '#646464' }}>
                  {statement.notes || 'يتم تحديد الأتعاب وفقاً للقوانين المنظمة لمهنة المحاماة بالمغرب وللاتفاق المسبق بين الطرفين.'}
                </p>
                <div className="mt-5" style={{ height: '0.3px', background: '#c8c8c8' }} />
              </section>

              {/* ══════════════ DATE & SIGNATURE ══════════════ */}
              <section className="mt-8">
                <div className="text-right mb-8">
                  <p className="text-[9px] mb-2" style={{ color: '#646464' }}>حرر ب{city || '...'} في:</p>
                  <p className="text-[14px]" style={{ color: '#1a2a44', fontFamily: "'Amiri', serif" }}>{date}</p>
                </div>

                <div className="text-center">
                  <p className="text-[11px] font-medium mb-1" style={{ color: '#1a2a44' }}>التوقيع والختم</p>
                  <p className="text-[7px] mb-4" style={{ color: '#969696' }}>Signature et cachet</p>
                  <div
                    className="mx-auto"
                    style={{
                      width: 180,
                      height: 80,
                      background: '#fafaf8',
                      border: '1px dashed #c5a059',
                      borderRadius: 4,
                    }}
                  />
                </div>
              </section>

              {/* ══════════════ FOOTER ══════════════ */}
              <footer className="absolute bottom-[10mm] left-[16mm] right-[16mm] text-center">
                <div className="mb-2" style={{ height: '0.3px', background: 'linear-gradient(90deg, transparent, #c5a059, transparent)' }} />
                <p className="text-[6.5px]" style={{ color: '#969696' }}>
                  وثيقة صادرة إلكترونياً — Document généré électroniquement
                </p>
              </footer>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default FeeStatementPreview;
