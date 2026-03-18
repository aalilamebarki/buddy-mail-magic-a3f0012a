import type { FeeStatementItemRecord, FeeStatementRecord } from '@/hooks/useFeeStatements';
import type { InvoiceRecord } from '@/hooks/useInvoices';
import { formatDateArabic } from '@/lib/formatters';
import { generateFeeStatementPDF } from '@/lib/generate-fee-statement-pdf';
import { generateInvoicePDF } from '@/lib/generate-invoice-pdf';

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const previewBlob = (blob: Blob) => {
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  // Don't revoke immediately — the new tab needs time to load
  setTimeout(() => URL.revokeObjectURL(url), 60000);
};

const mapLetterhead = (letterhead?: {
  lawyer_name: string;
  name_fr?: string | null;
  title_ar?: string | null;
  title_fr?: string | null;
  bar_name_ar?: string | null;
  bar_name_fr?: string | null;
  address?: string | null;
  city?: string | null;
  phone?: string | null;
  email?: string | null;
} | null) => {
  if (!letterhead) return undefined;

  return {
    lawyerName: letterhead.lawyer_name,
    nameFr: letterhead.name_fr || undefined,
    titleAr: letterhead.title_ar || undefined,
    titleFr: letterhead.title_fr || undefined,
    barNameAr: letterhead.bar_name_ar || undefined,
    barNameFr: letterhead.bar_name_fr || undefined,
    address: letterhead.address || undefined,
    city: letterhead.city || undefined,
    phone: letterhead.phone || undefined,
    email: letterhead.email || undefined,
  };
};

export const downloadInvoicePdf = async (invoice: InvoiceRecord) => {
  const pdfBlob = await generateInvoicePDF({
    invoiceNumber: invoice.invoice_number,
    signatureUuid: invoice.signature_uuid,
    clientName: invoice.clients?.full_name || 'غير محدد',
    caseName: invoice.cases?.title || undefined,
    caseNumber: invoice.cases?.case_number || undefined,
    caseType: invoice.cases?.case_type || undefined,
    amount: Number(invoice.amount || 0),
    description: invoice.description || undefined,
    paymentMethod: invoice.payment_method || 'cash',
    date: formatDateArabic(invoice.created_at, { year: 'numeric', month: 'long', day: 'numeric' }),
    lawyerName: invoice.letterheads?.lawyer_name || 'مكتب المحاماة',
    letterhead: mapLetterhead(invoice.letterheads),
  });

  downloadBlob(pdfBlob, `${invoice.invoice_number}.pdf`);
};

const getStatementItemsForCase = (
  items: FeeStatementItemRecord[] | undefined,
  caseId: string | null,
  fallbackToAll = false,
) => {
  const sourceItems = items || [];

  if (fallbackToAll) {
    return sourceItems.filter(item => !item.case_id || item.case_id === caseId);
  }

  return sourceItems.filter(item => item.case_id === caseId);
};

export const downloadFeeStatementPdf = async (statement: FeeStatementRecord) => {
  const caseDetails = statement.fee_statement_cases && statement.fee_statement_cases.length > 0
    ? statement.fee_statement_cases.map(statementCase => {
        const caseItems = getStatementItemsForCase(statement.fee_statement_items, statementCase.case_id);
        const normalizedItems = caseItems.map(item => ({
          description: item.description,
          amount: Number(item.amount || 0),
        }));

        return {
          caseTitle: statementCase.cases?.title || '',
          caseNumber: statementCase.cases?.case_number || '',
          court: statementCase.cases?.court || undefined,
          caseType: statementCase.cases?.case_type || undefined,
          items: normalizedItems,
          lawyerFees: Number(statementCase.lawyer_fees || 0),
          expensesTotal: normalizedItems.reduce((sum, item) => sum + item.amount, 0),
          subtotal: Number(statementCase.subtotal || 0),
          taxRate: Number(statementCase.tax_rate || 0),
          taxAmount: Number(statementCase.tax_amount || 0),
          totalAmount: Number(statementCase.total_amount || 0),
        };
      })
    : [{
        caseTitle: statement.cases?.title || '',
        caseNumber: statement.cases?.case_number || '',
        court: statement.cases?.court || undefined,
        caseType: statement.cases?.case_type || undefined,
        items: getStatementItemsForCase(statement.fee_statement_items, statement.case_id, true).map(item => ({
          description: item.description,
          amount: Number(item.amount || 0),
        })),
        lawyerFees: Number(statement.lawyer_fees || 0),
        expensesTotal: getStatementItemsForCase(statement.fee_statement_items, statement.case_id, true).reduce(
          (sum, item) => sum + Number(item.amount || 0),
          0,
        ),
        subtotal: Number(statement.subtotal || 0),
        taxRate: Number(statement.tax_rate || 0),
        taxAmount: Number(statement.tax_amount || 0),
        totalAmount: Number(statement.total_amount || 0),
      }];

  const pdfBlob = await generateFeeStatementPDF({
    statementNumber: statement.statement_number,
    signatureUuid: statement.signature_uuid,
    clientName: statement.clients?.full_name || '—',
    clientCin: statement.clients?.cin || undefined,
    clientPhone: statement.clients?.phone || undefined,
    powerOfAttorneyDate: statement.power_of_attorney_date
      ? formatDateArabic(statement.power_of_attorney_date, { year: 'numeric', month: 'long', day: 'numeric' })
      : undefined,
    taxRate: Number(statement.tax_rate || 0),
    grandSubtotal: Number(statement.subtotal || 0),
    grandTaxAmount: Number(statement.tax_amount || 0),
    grandTotal: Number(statement.total_amount || 0),
    caseDetails,
    notes: statement.notes || undefined,
    date: formatDateArabic(statement.created_at, { year: 'numeric', month: 'long', day: 'numeric' }),
    lawyerName: statement.letterheads?.lawyer_name || 'مكتب المحاماة',
    letterhead: mapLetterhead(statement.letterheads),
  });

  downloadBlob(pdfBlob, `${statement.statement_number}.pdf`);
};
