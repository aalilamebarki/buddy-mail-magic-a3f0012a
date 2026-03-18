import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ArrowRight, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDateShort } from '@/lib/formatters';
import type { FeeStatementRecord } from '@/hooks/useFeeStatements';
import { downloadFeeStatementPdf } from '@/lib/dynamic-pdf-downloads';

/* ── Design Tokens matching pdf-utils.ts ── */
const NAVY = '#1a2a44';
const GOLD = '#c5a059';
const TEXT_COLOR = '#1e1e1e';
const TEXT2_COLOR = '#646464';
const TEXT3_COLOR = '#969696';
const BORDER_COLOR = '#c8c8c8';
const BG_COLOR = '#f8f8f8';

/* ── Tafkeet (duplicated from pdf-utils for standalone use) ── */
const numberToArabicWords = (num: number): string => {
  if (num === 0) return 'صفر درهم';
  const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
  const teens = ['عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
  const tens = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
  const hundreds = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];
  const parts: string[] = [];
  const mil = Math.floor(num / 1000000), th = Math.floor((num % 1000000) / 1000), rem = Math.floor(num % 1000);
  if (mil > 0) { if (mil === 1) parts.push('مليون'); else if (mil === 2) parts.push('مليونان'); else parts.push(`${ones[mil]} ملايين`); }
  if (th > 0) {
    if (th === 1) parts.push('ألف'); else if (th === 2) parts.push('ألفان');
    else if (th >= 3 && th <= 10) parts.push(`${ones[th]} آلاف`);
    else {
      const tH = Math.floor(th / 100), tR = th % 100, tP: string[] = [];
      if (tH > 0) tP.push(hundreds[tH]);
      if (tR >= 10 && tR < 20) tP.push(teens[tR - 10]);
      else { const tO = tR % 10, tT = Math.floor(tR / 10); if (tO > 0) tP.push(ones[tO]); if (tT > 0) tP.push(tens[tT]); }
      parts.push(tP.join(' و') + ' ألف');
    }
  }
  if (rem > 0) {
    const rH = Math.floor(rem / 100), rR = rem % 100;
    if (rH > 0) parts.push(hundreds[rH]);
    if (rR >= 10 && rR < 20) parts.push(teens[rR - 10]);
    else {
      const rO = rR % 10, rT = Math.floor(rR / 10);
      if (rO > 0 && rT > 0) parts.push(`${ones[rO]} و${tens[rT]}`);
      else if (rO > 0) parts.push(ones[rO]);
      else if (rT > 0) parts.push(tens[rT]);
    }
  }
  return `فقط ${parts.join(' و')} درهم مغربي لا غير.`;
};

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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <Loader2 className="h-10 w-10 animate-spin" style={{ color: NAVY }} />
      </div>
    );
  }

  if (!statement) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white gap-4" dir="rtl">
        <p style={{ color: TEXT2_COLOR }}>بيان الأتعاب غير موجود</p>
        <Link to="/dashboard/billing" className="text-sm underline" style={{ color: NAVY }}>
          العودة للفوترة
        </Link>
      </div>
    );
  }

  const lh = statement.letterheads;
  const lawyerName = lh?.lawyer_name || '—';
  const city = lh?.city || '';
  const items = statement.fee_statement_items || [];
  const cases = statement.fee_statement_cases || [];
  const firstCase = cases[0]?.cases || statement.cases;
  const expensesTotal = items.reduce((s, i) => s + Number(i.amount), 0);

  // Client info rows
  const infoRows: [string, string][] = [
    ['الموكل / Client', statement.clients?.full_name || '—'],
  ];
  if (firstCase?.case_number) infoRows.push(['رقم الملف / N° Dossier', firstCase.case_number]);
  if (firstCase?.court) infoRows.push(['المحكمة / Tribunal', firstCase.court]);
  if (firstCase?.case_type) infoRows.push(['طبيعة النزاع / Nature', firstCase.case_type]);
  if (statement.clients?.cin) infoRows.push(['رقم ب.و / CIN', statement.clients.cin]);
  if (statement.power_of_attorney_date) infoRows.push(['تاريخ الوكالة / Date de procuration', statement.power_of_attorney_date]);

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4" dir="rtl">
      {/* Action bar */}
      <div className="max-w-[210mm] mx-auto mb-4 flex items-center justify-between">
        <Link to="/dashboard/billing" className="text-sm flex items-center gap-1" style={{ color: NAVY }}>
          <ArrowRight className="h-4 w-4" /> العودة للفوترة
        </Link>
        <Button
          onClick={handleDownload}
          disabled={downloading}
          className="gap-2"
          style={{ backgroundColor: NAVY }}
        >
          {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          تحميل PDF
        </Button>
      </div>

      {/* A4 Page */}
      <div
        className="max-w-[210mm] mx-auto bg-white shadow-2xl relative"
        style={{
          minHeight: '297mm',
          fontFamily: "'IBM Plex Sans Arabic', 'Amiri', serif",
        }}
      >
        {/* Double frame */}
        <div
          className="absolute inset-[10mm]"
          style={{ border: `0.8px solid ${NAVY}` }}
        />
        <div
          className="absolute"
          style={{
            top: '12mm', left: '12mm', right: '12mm', bottom: '12mm',
            border: `0.3px solid ${GOLD}`,
          }}
        />

        {/* Content area */}
        <div className="relative px-[18mm] pt-[20mm] pb-[15mm]">

          {/* ── Header ── */}
          <div className="text-center">
            <p className="text-[10px] tracking-wide" style={{ color: GOLD }}>مكتب الأستاذ</p>
            {lh?.name_fr && (
              <p className="text-[8px] mt-1" style={{ color: TEXT2_COLOR }}>Cabinet de Maître</p>
            )}

            <h1
              className="mt-3 text-[24px] leading-tight"
              style={{ color: NAVY, fontFamily: "'Amiri', serif" }}
            >
              {lawyerName}
            </h1>
            {lh?.name_fr && (
              <p className="text-[11px] mt-1" style={{ color: TEXT2_COLOR }}>{lh.name_fr}</p>
            )}

            {/* Gold decorative line */}
            <div className="mx-auto mt-4 mb-3" style={{ width: 70, height: 0.5, backgroundColor: GOLD }} />

            {/* Professional title */}
            {(lh?.title_ar || lh?.bar_name_ar) && (
              <p className="text-[10px]" style={{ color: TEXT_COLOR }}>
                {[lh?.title_ar, lh?.bar_name_ar ? `لدى ${lh.bar_name_ar}` : ''].filter(Boolean).join(' ')}
              </p>
            )}
            {(lh?.title_fr || lh?.bar_name_fr) && (
              <p className="text-[8px] mt-1" style={{ color: TEXT3_COLOR }}>
                {[lh?.title_fr, lh?.bar_name_fr ? `près ${lh.bar_name_fr}` : ''].filter(Boolean).join(' ')}
              </p>
            )}

            {/* Contact */}
            {lh?.address && (
              <p className="text-[8px] mt-2" style={{ color: TEXT2_COLOR }}>
                {lh.city ? `${lh.address}، ${lh.city}` : lh.address}
              </p>
            )}
            {(lh?.phone || lh?.email) && (
              <p className="text-[7.5px] mt-1" style={{ color: TEXT3_COLOR }}>
                {[lh?.phone ? `هاتف: ${lh.phone}` : '', lh?.email ? `بريد: ${lh.email}` : ''].filter(Boolean).join('  |  ')}
              </p>
            )}

            {/* Navy + gold separator */}
            <div className="mt-4">
              <div style={{ height: 0.6, backgroundColor: NAVY }} />
              <div className="mt-[0.8px]" style={{ height: 0.2, backgroundColor: GOLD }} />
            </div>
          </div>

          {/* ── Title ── */}
          <div className="text-center mt-6">
            <h2
              className="text-[22px]"
              style={{ color: NAVY, fontFamily: "'Amiri', serif" }}
            >
              بيان أتعاب ومصاريف
            </h2>
            <p className="text-[9px] mt-1" style={{ color: TEXT3_COLOR }}>
              Note d'honoraires et frais
            </p>
            <div className="mx-auto mt-3 mb-2" style={{ width: 50, height: 0.5, backgroundColor: GOLD }} />
            <p className="text-[8px]" style={{ color: TEXT2_COLOR }}>
              رقم المرجع: {statement.statement_number}
            </p>
          </div>

          {/* ── Client Info Table ── */}
          <div className="mt-6" style={{ border: `0.2px solid ${BORDER_COLOR}` }}>
            {infoRows.map(([label, value], i) => (
              <div
                key={i}
                className="flex items-center"
                style={{
                  backgroundColor: i % 2 === 0 ? BG_COLOR : 'white',
                  height: 36,
                  borderRight: `1.5px solid ${GOLD}`,
                }}
              >
                <div className="flex-1 px-5">
                  <p className="text-[7.5px]" style={{ color: GOLD }}>{label}</p>
                  <p className="text-[11px] font-medium" style={{ color: TEXT_COLOR }}>{value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── Services Table (per case) ── */}
          {cases.length > 0 ? cases.map((cd, ci) => {
            const caseItems = items.filter(item => item.case_id === cd.case_id || (!item.case_id && ci === 0));
            const caseExpenses = caseItems.reduce((s, i) => s + Number(i.amount), 0);

            return (
              <div key={cd.id} className="mt-6">
                {/* Multi-case header */}
                {cases.length > 1 && (
                  <div
                    className="text-center py-2 text-[9px] text-white rounded-sm mb-2"
                    style={{ backgroundColor: NAVY }}
                  >
                    ملف {ci + 1}: {cd.cases?.title || cd.cases?.case_number || '—'}
                  </div>
                )}

                {/* Table header */}
                <div
                  className="flex items-center py-2 px-4 text-[8px] text-white"
                  style={{ backgroundColor: NAVY }}
                >
                  <span className="flex-1 text-right">بيان الخدمات / Désignation</span>
                  <span className="w-32 text-left">المبلغ (درهم) / Montant</span>
                </div>

                {/* Items */}
                {caseItems.map((item, i) => (
                  <div
                    key={item.id}
                    className="flex items-start py-2 px-4 text-[9px]"
                    style={{
                      backgroundColor: i % 2 === 0 ? BG_COLOR : 'white',
                      borderRight: `1px solid ${GOLD}`,
                      borderBottom: `0.1px solid ${BORDER_COLOR}`,
                    }}
                  >
                    <span className="flex-1 text-right" style={{ color: TEXT_COLOR }}>{item.description || '—'}</span>
                    <span className="w-32 text-left" style={{ color: TEXT2_COLOR }}>{fmt(Number(item.amount))}</span>
                  </div>
                ))}

                {/* Summary rows */}
                {[
                  { label: 'الأتعاب المهنية / Honoraires', value: Number(cd.lawyer_fees), strong: false },
                  { label: 'المصاريف والرسوم / Frais et débours', value: caseExpenses, strong: false },
                  { label: 'المجموع الصافي / Sous-total HT', value: Number(cd.subtotal), strong: true },
                  ...(Number(cd.tax_rate) > 0 ? [{ label: `الضريبة / TVA (${cd.tax_rate}%)`, value: Number(cd.tax_amount), strong: false }] : []),
                  { label: 'المجموع الكلي / Total TTC', value: Number(cd.total_amount), strong: true },
                ].map((row, ri) => (
                  <div
                    key={ri}
                    className="flex items-center py-2 px-4"
                    style={{
                      backgroundColor: row.strong ? '#f0f0f5' : 'white',
                      borderTop: `0.1px solid ${BORDER_COLOR}`,
                    }}
                  >
                    <span
                      className={`flex-1 text-right ${row.strong ? 'font-bold text-[10px]' : 'text-[9px]'}`}
                      style={{ color: row.strong ? NAVY : TEXT2_COLOR }}
                    >
                      {row.label}
                    </span>
                    <span
                      className={`w-32 text-left ${row.strong ? 'font-bold text-[10px]' : 'text-[9px]'}`}
                      style={{ color: TEXT_COLOR }}
                    >
                      {fmt(row.value)}
                    </span>
                  </div>
                ))}
              </div>
            );
          }) : (
            /* Single case fallback */
            <div className="mt-6">
              <div
                className="flex items-center py-2 px-4 text-[8px] text-white"
                style={{ backgroundColor: NAVY }}
              >
                <span className="flex-1 text-right">بيان الخدمات / Désignation</span>
                <span className="w-32 text-left">المبلغ (درهم) / Montant</span>
              </div>
              {items.map((item, i) => (
                <div
                  key={item.id}
                  className="flex items-start py-2 px-4 text-[9px]"
                  style={{
                    backgroundColor: i % 2 === 0 ? BG_COLOR : 'white',
                    borderRight: `1px solid ${GOLD}`,
                    borderBottom: `0.1px solid ${BORDER_COLOR}`,
                  }}
                >
                  <span className="flex-1 text-right" style={{ color: TEXT_COLOR }}>{item.description || '—'}</span>
                  <span className="w-32 text-left" style={{ color: TEXT2_COLOR }}>{fmt(Number(item.amount))}</span>
                </div>
              ))}
            </div>
          )}

          {/* ── Grand Total Box ── */}
          <div className="mt-8">
            <div style={{ height: 0.5, backgroundColor: NAVY }} />
            <div className="mt-4">
              <div
                className="rounded-sm px-5 py-4"
                style={{ backgroundColor: NAVY }}
              >
                <p className="text-[9px]" style={{ color: GOLD }}>
                  الواجب أداؤه / Net à payer
                </p>
                <p
                  className="text-[20px] mt-1"
                  style={{ color: 'white', fontFamily: "'Amiri', serif" }}
                  dir="ltr"
                >
                  {fmt(Number(statement.total_amount))} MAD
                </p>
              </div>
            </div>

            {/* Tafkeet */}
            <p className="text-[8.5px] mt-4 text-right" style={{ color: TEXT2_COLOR }}>
              المبلغ بالحروف: &nbsp;{numberToArabicWords(Number(statement.total_amount))}
            </p>

            <div className="mt-4" style={{ height: 0.2, backgroundColor: BORDER_COLOR }} />
          </div>

          {/* ── Notes ── */}
          <div className="mt-4 text-center">
            <p className="text-[8px]" style={{ color: TEXT2_COLOR }}>
              {statement.notes || 'يتم تحديد الأتعاب وفقاً للقوانين المنظمة لمهنة المحاماة بالمغرب وللاتفاق المسبق.'}
            </p>
            <div className="mt-4" style={{ height: 0.2, backgroundColor: BORDER_COLOR }} />
          </div>

          {/* ── Date & Signature ── */}
          <div className="mt-6">
            <div className="text-right">
              <p className="text-[9px]" style={{ color: TEXT2_COLOR }}>
                حرر ب{city || '...'} في:
              </p>
              <p
                className="text-[13px] mt-2"
                style={{ color: NAVY, fontFamily: "'Amiri', serif" }}
              >
                {formatDateShort(statement.created_at)}
              </p>
            </div>

            <div className="text-center mt-8">
              <p className="text-[10px] font-medium" style={{ color: NAVY }}>التوقيع والختم</p>
              <p className="text-[7px] mt-1" style={{ color: TEXT3_COLOR }}>Signature et cachet</p>

              <div
                className="mx-auto mt-4"
                style={{
                  width: 55 * 3.78,
                  height: 25 * 3.78,
                  backgroundColor: BG_COLOR,
                  border: `0.4px solid ${GOLD}`,
                }}
              />
            </div>
          </div>

          {/* ── Footer ── */}
          <div className="absolute bottom-[12mm] left-0 right-0 text-center">
            <p className="text-[6.5px]" style={{ color: TEXT3_COLOR }}>
              وثيقة صادرة إلكترونياً — Document généré électroniquement
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeeStatementPreview;
