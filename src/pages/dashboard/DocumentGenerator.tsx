import { useState, useEffect, useRef, useCallback } from 'react';
import { extractAllFiles } from '@/lib/parse-files';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  FileText, Search, Download, Loader2, Save, Eye,
  FileUp, Trash2, Sparkles, Send, FolderOpen,
  ArrowRight, MessageSquare, ChevronDown, ChevronUp, User, Plus, X, UserPlus, Stamp, BookOpen, Scale, Briefcase
} from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

// ─── Types ─────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ThreadDoc {
  id: string;
  doc_type: string;
  content: string | null;
  opponent_memo: string | null;
  step_number: number | null;
  status: string;
  created_at: string;
  thread_id: string | null;
  title: string;
  client_name: string | null;
  client_id: string | null;
  opposing_party: string | null;
  court: string | null;
  case_number: string | null;
  case_id: string | null;
}

interface ClientInfo {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  cin: string | null;
}

interface CaseFile {
  id: string;
  case_number: string;
  title: string;
  client_id: string | null;
  case_type: string | null;
  court: string | null;
  court_level: string;
  opposing_party: string | null;
  opposing_party_address: string | null;
  status: string;
  description: string | null;
  created_at: string;
}

interface Letterhead {
  id: string;
  lawyer_name: string;
  template_path: string | null;
}

interface ReferenceDocument {
  id: string;
  title: string;
  doc_type: string;
  content: string;
  file_name: string | null;
  created_at: string;
}

// Constants
const COURT_LEVELS = ['ابتدائية', 'استئناف', 'نقض'] as const;
const COURT_TYPES = [
  'المحكمة الابتدائية', 'المحكمة الابتدائية التجارية', 'المحكمة الابتدائية الإدارية',
  'محكمة الاستئناف', 'محكمة الاستئناف التجارية', 'محكمة الاستئناف الإدارية',
  'محكمة النقض'
] as const;
const CASE_TYPES = ['مدني', 'جنائي', 'تجاري', 'إداري', 'أسرة', 'عقاري', 'شغل', 'جنحي'] as const;
const REF_DOC_TYPES = ['مذكرة', 'مقال', 'شكاية', 'حكم قضائي', 'إنذار', 'عقد', 'عام'] as const;

// Document type categories for conditional field requirements
const DOC_TYPE_OPTIONS = [
  // Court + case_number required
  { label: 'مذكرة جوابية', requires: 'court_and_case' },
  { label: 'مذكرة تعقيبية', requires: 'court_and_case' },
  { label: 'مقال استئنافي', requires: 'court_and_case' },
  { label: 'التدخل في الدعوى', requires: 'court_and_case' },
  { label: 'عريضة نقض', requires: 'court_and_case' },
  // Court only required
  { label: 'مقال افتتاحي', requires: 'court_only' },
  // Nothing required
  { label: 'إنذار بالإفراغ', requires: 'none' },
  { label: 'إنذار بالأداء', requires: 'none' },
  { label: 'إنذار عام', requires: 'none' },
] as const;

type DocRequirement = 'court_and_case' | 'court_only' | 'none';

const getDocRequirement = (docType: string): DocRequirement => {
  const found = DOC_TYPE_OPTIONS.find(d => d.label === docType);
  return found?.requires || 'court_and_case';
};

// All types require documents-first
const DOCS_NOT_REQUIRED_TYPES: string[] = [];

// ─── Component ──────────────────────────────────────────────────────────────

const DocumentGenerator = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  // Data
  const [clients, setClients] = useState<ClientInfo[]>([]);
  const [cases, setCases] = useState<CaseFile[]>([]);
  const [allDocs, setAllDocs] = useState<ThreadDoc[]>([]);
  const [loading, setLoading] = useState(true);

  // View: main → case_select → new_case → chat
  const [view, setView] = useState<'main' | 'case_select' | 'new_case' | 'chat'>('main');

  // Selection
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedClient, setSelectedClient] = useState<ClientInfo | null>(null);
  const [selectedCase, setSelectedCase] = useState<CaseFile | null>(null);
  const [activeDocType, setActiveDocType] = useState('');

  // Client search
  const [clientSearch, setClientSearch] = useState('');
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [newClient, setNewClient] = useState({ full_name: '', cin: '', address: '', phone: '', email: '' });
  const clientSearchRef = useRef<HTMLDivElement>(null);

  // New case form
  const [newCase, setNewCase] = useState({
    title: '', case_type: '',
    opposing_party: '', opposing_party_address: '', description: '',
  });

  // Chat-phase doc config (selected in chat view before writing)
  const [chatDocConfig, setChatDocConfig] = useState({
    doc_type: '', court: '', court_level: 'ابتدائية', case_number: '',
  });

  // Chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isParsing, setIsParsing] = useState(false);

  // Letterheads
  const [letterheads, setLetterheads] = useState<Letterhead[]>([]);
  const [selectedLetterheadId, setSelectedLetterheadId] = useState('');
  const [letterheadSearch, setLetterheadSearch] = useState('');
  const [showLetterheadSuggestions, setShowLetterheadSuggestions] = useState(false);
  const letterheadSearchRef = useRef<HTMLDivElement>(null);

  // Reference documents
  const [referenceDocs, setReferenceDocs] = useState<ReferenceDocument[]>([]);
  const [showRefDocs, setShowRefDocs] = useState(false);
  const [isUploadingRef, setIsUploadingRef] = useState(false);
  const [refDocFilter, setRefDocFilter] = useState<string>('الكل');

  // Archive
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedThread, setExpandedThread] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<ThreadDoc | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // ─── Load data ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [clientsRes, casesRes, docsRes, lhRes, refDocsRes] = await Promise.all([
        supabase.from('clients').select('id, full_name, email, phone, address, cin'),
        supabase.from('cases').select('*').order('created_at', { ascending: false }),
        supabase.from('generated_documents')
          .select('id, doc_type, content, opponent_memo, step_number, status, created_at, thread_id, title, client_name, client_id, opposing_party, court, case_number, case_id')
          .order('created_at', { ascending: true }),
        supabase.from('letterheads').select('id, lawyer_name, template_path') as any,
        supabase.from('reference_documents').select('*').order('created_at', { ascending: false }) as any,
      ]);
      if (clientsRes.data) setClients(clientsRes.data as ClientInfo[]);
      if (casesRes.data) setCases(casesRes.data as CaseFile[]);
      if (docsRes.data) setAllDocs(docsRes.data as ThreadDoc[]);
      if (lhRes.data) setLetterheads(lhRes.data as Letterhead[]);
      if (refDocsRes.data) setReferenceDocs(refDocsRes.data as ReferenceDocument[]);
      setLoading(false);
    };
    load();
  }, [user]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    const c = selectedClientId ? clients.find(x => x.id === selectedClientId) || null : null;
    setSelectedClient(c);
  }, [selectedClientId, clients]);

  // Click outside to close suggestions
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (clientSearchRef.current && !clientSearchRef.current.contains(e.target as Node)) {
        setShowClientSuggestions(false);
      }
      if (letterheadSearchRef.current && !letterheadSearchRef.current.contains(e.target as Node)) {
        setShowLetterheadSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Filtered data
  const filteredLetterheads = letterheadSearch.trim()
    ? letterheads.filter(lh => lh.lawyer_name.includes(letterheadSearch))
    : letterheads;

  const selectedLetterhead = selectedLetterheadId ? letterheads.find(lh => lh.id === selectedLetterheadId) || null : null;

  const filteredClients = clientSearch.trim()
    ? clients.filter(c =>
        c.full_name.includes(clientSearch) ||
        (c.cin && c.cin.includes(clientSearch))
      )
    : [];

  const clientHasNoMatch = clientSearch.trim().length > 0 && filteredClients.length === 0;

  // Cases for selected client
  const clientCases = selectedClient
    ? cases.filter(c => c.client_id === selectedClient.id)
    : [];

  // Documents for selected case
  const caseDocs = selectedCase
    ? allDocs.filter(d => d.case_id === selectedCase.id).sort((a, b) => (a.step_number || 1) - (b.step_number || 1))
    : [];

  const filteredRefDocs = refDocFilter === 'الكل' ? referenceDocs : referenceDocs.filter(d => d.doc_type === refDocFilter);

  // ─── Client Actions ───────────────────────────────────────────────────

  const selectClient = (client: ClientInfo) => {
    setSelectedClientId(client.id);
    setClientSearch(client.full_name);
    setShowClientSuggestions(false);
    setView('case_select');
  };

  const clearClient = () => {
    setSelectedClientId('');
    setSelectedClient(null);
    setSelectedCase(null);
    setClientSearch('');
    setView('main');
  };

  const createNewClient = async () => {
    if (!user || !newClient.full_name.trim()) return;
    try {
      const { data, error } = await supabase.from('clients').insert({
        full_name: newClient.full_name.trim(),
        cin: newClient.cin.trim() || null,
        address: newClient.address.trim() || null,
        phone: newClient.phone.trim() || null,
        email: newClient.email.trim() || null,
        user_id: user.id,
      } as any).select().single();
      if (error) throw error;
      const created = data as ClientInfo;
      setClients(prev => [...prev, created]);
      setSelectedClientId(created.id);
      setClientSearch(created.full_name);
      setShowNewClientForm(false);
      setNewClient({ full_name: '', cin: '', address: '', phone: '', email: '' });
      setView('case_select');
      toast({ title: 'تم إنشاء الموكل ✅' });
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' });
    }
  };

  // ─── Case Actions ─────────────────────────────────────────────────────

  const openCase = (caseFile: CaseFile) => {
    setSelectedCase(caseFile);
    setActiveDocType('');
    setChatDocConfig({ doc_type: '', court: caseFile.court || '', court_level: caseFile.court_level || 'ابتدائية', case_number: caseFile.case_number || '' });
    setChatMessages([]);
    setView('chat');
  };

  const deleteCase = async (caseId: string) => {
    try {
      const { error } = await supabase.from('cases').delete().eq('id', caseId);
      if (error) throw error;
      setCases(prev => prev.filter(c => c.id !== caseId));
      setAllDocs(prev => prev.filter(d => d.case_id !== caseId));
      toast({ title: 'تم حذف الملف وجميع مستنداته ✅' });
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' });
    }
  };

  const createCase = async () => {
    if (!user || !selectedClient || !newCase.opposing_party.trim()) return;
    try {
      const caseNumber = `${Date.now()}`;
      const { data, error } = await supabase.from('cases').insert({
        case_number: caseNumber,
        title: newCase.title.trim() || `${selectedClient.full_name} ضد ${newCase.opposing_party.trim()}`,
        client_id: selectedClient.id,
        case_type: newCase.case_type || null,
        court: null,
        court_level: 'ابتدائية',
        opposing_party: newCase.opposing_party.trim(),
        opposing_party_address: newCase.opposing_party_address.trim() || null,
        description: newCase.description.trim() || null,
        assigned_to: user.id,
      } as any).select().single();
      if (error) throw error;
      const created = data as CaseFile;
      setCases(prev => [created, ...prev]);
      setSelectedCase(created);
      setActiveDocType('');
      setChatDocConfig({ doc_type: '', court: '', court_level: 'ابتدائية', case_number: '' });
      setNewCase({ title: '', case_type: '', opposing_party: '', opposing_party_address: '', description: '' });
      setChatMessages([]);
      setView('chat');
      toast({ title: 'تم إنشاء الملف ✅' });
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' });
    }
  };

  // ─── Add opponent memo ────────────────────────────────────────────────

  const addOpponentMemo = async (files: File[]) => {
    if (!user || !selectedCase || files.length === 0) return;
    setIsParsing(true);
    try {
      const parsed = await extractAllFiles(files);
      const memoContent = parsed.map(p => p.text).join('\n\n');
      const step = caseDocs.length + 1;
      const parentId = caseDocs.length > 0 ? caseDocs[caseDocs.length - 1].id : null;

      const { data, error } = await supabase.from('generated_documents').insert({
        user_id: user.id,
        client_id: selectedClient?.id || null,
        case_id: selectedCase.id,
        doc_type: 'مذكرة الخصم',
        title: `مذكرة الخصم - الخطوة ${step}`,
        content: null,
        opponent_memo: memoContent,
        court: selectedCase.court || null,
        case_number: selectedCase.case_number || null,
        opposing_party: selectedCase.opposing_party || null,
        client_name: selectedClient?.full_name || null,
        status: 'final',
        thread_id: selectedCase.id,
        parent_id: parentId,
        step_number: step,
        metadata: {},
      } as any).select().single();
      if (error) throw error;

      // Upload files as attachments
      if (data) {
        for (const file of files) {
          const path = `${user.id}/${data.id}/${file.name}`;
          const { error: upErr } = await supabase.storage.from('document-attachments').upload(path, file);
          if (!upErr) {
            await supabase.from('document_attachments').insert({
              document_id: data.id, file_name: file.name, file_path: path, file_type: file.type,
            } as any);
          }
        }
      }

      const newDoc = data as ThreadDoc;
      setAllDocs(prev => [...prev, newDoc]);
      toast({ title: 'تم حفظ مذكرة الخصم بالأرشيف ✅' });
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' });
    } finally {
      setIsParsing(false);
    }
  };

  // ─── Reference Documents ──────────────────────────────────────────────

  const uploadReferenceDoc = async (files: File[]) => {
    if (!user || files.length === 0) return;
    setIsUploadingRef(true);
    try {
      const parsed = await extractAllFiles(files);
      for (const p of parsed) {
        if (!p.text.trim()) continue;
        const docType = p.name.includes('مذكرة') ? 'مذكرة' :
          p.name.includes('مقال') ? 'مقال' :
          p.name.includes('شكاية') ? 'شكاية' :
          p.name.includes('حكم') || p.name.includes('قرار') ? 'حكم قضائي' : 'عام';
        
        const { data, error } = await supabase.from('reference_documents').insert({
          user_id: user.id,
          title: p.name.replace(/\.[^.]+$/, ''),
          doc_type: docType,
          content: p.text.slice(0, 10000),
          file_name: p.name,
        } as any).select().single();
        if (error) throw error;
        if (data) setReferenceDocs(prev => [data as ReferenceDocument, ...prev]);
      }
      toast({ title: `تم رفع ${parsed.length} نموذج مرجعي ✅` });
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' });
    } finally {
      setIsUploadingRef(false);
    }
  };

  const deleteReferenceDoc = async (id: string) => {
    const { error } = await supabase.from('reference_documents').delete().eq('id', id) as any;
    if (!error) setReferenceDocs(prev => prev.filter(d => d.id !== id));
  };

  const updateRefDocType = async (id: string, newType: string) => {
    const { error } = await supabase.from('reference_documents').update({ doc_type: newType }).eq('id', id) as any;
    if (!error) setReferenceDocs(prev => prev.map(d => d.id === id ? { ...d, doc_type: newType } : d));
  };

  // ─── Chat / Send Message ──────────────────────────────────────────────

  const sendMessage = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isStreaming || !selectedCase) return;

    setInputText('');
    setIsStreaming(true);

    let attachmentTexts: { name: string; text: string }[] = [];
    if (attachments.length > 0) {
      setIsParsing(true);
      try {
        attachmentTexts = await extractAllFiles(attachments);
      } catch (e) {
        console.error('Error parsing files:', e);
      }
      setIsParsing(false);
    }

    let fullUserContent = text;
    if (attachmentTexts.length > 0) {
      fullUserContent += '\n\n📎 الملفات المرفقة:\n';
      for (const att of attachmentTexts) {
        fullUserContent += `\n--- [${att.name}] ---\n${att.text}\n`;
      }
    }

    const userMsg: ChatMessage = { role: 'user', content: fullUserContent };
    const displayMsg: ChatMessage = { 
      role: 'user', 
      content: text + (attachments.length > 0 ? `\n\n📎 ${attachments.map(f => f.name).join('، ')}` : '')
    };
    const newMessages = [...chatMessages, userMsg];
    setChatMessages(prev => [...prev, displayMsg]);
    setAttachments([]);

    const threadContext = {
      clientName: selectedClient?.full_name || '',
      clientAddress: selectedClient?.address || '',
      clientCIN: selectedClient?.cin || '',
      clientPhone: selectedClient?.phone || '',
      opposingParty: selectedCase.opposing_party || '',
      opposingPartyAddress: (selectedCase as any).opposing_party_address || '',
      court: chatDocConfig.court || selectedCase.court || '',
      courtLevel: chatDocConfig.court_level || selectedCase.court_level || '',
      caseNumber: chatDocConfig.case_number || selectedCase.case_number || '',
      caseType: selectedCase.case_type || '',
      requestedDocType: activeDocType || chatDocConfig.doc_type || '',
      previousDocs: caseDocs.map(d => ({
        step: d.step_number,
        docType: d.doc_type,
        content: d.content?.slice(0, 2000),
        opponentMemo: d.opponent_memo,
      })),
      styleReference: allDocs
        .filter(d => d.status === 'final' && d.content)
        .slice(-3)
        .map(d => d.content?.slice(0, 800)),
      referenceDocuments: referenceDocs.slice(0, 5).map(rd => ({
        title: rd.title,
        docType: rd.doc_type,
        content: rd.content.slice(0, 3000),
      })),
    };

    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-legal-doc`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ messages: newMessages, threadContext }),
        }
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'خطأ' }));
        throw new Error(err.error || 'خطأ في التوليد');
      }

      const reader = resp.body?.getReader();
      if (!reader) throw new Error('No stream');
      const decoder = new TextDecoder();
      let buffer = '';
      let assistantText = '';

      setChatMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;
          const json = line.slice(6).trim();
          if (json === '[DONE]') break;
          try {
            const parsed = JSON.parse(json);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantText += content;
              setChatMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: 'assistant', content: assistantText };
                return updated;
              });
            }
          } catch { /* partial */ }
        }
      }
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' });
      setChatMessages(prev => prev.filter(m => m.content !== ''));
    } finally {
      setIsStreaming(false);
    }
  }, [inputText, chatMessages, selectedCase, selectedClient, isStreaming, toast, allDocs, caseDocs, referenceDocs, attachments, activeDocType]);

  // ─── Save Document ────────────────────────────────────────────────────

  const saveDocument = async (content: string, docType: string) => {
    if (!user || !selectedCase) return;
    const step = caseDocs.length + 1;
    const parentId = caseDocs.length > 0 ? caseDocs[caseDocs.length - 1].id : null;

    try {
      const { data, error } = await supabase.from('generated_documents').insert({
        user_id: user.id,
        client_id: selectedClient?.id || null,
        case_id: selectedCase.id,
        doc_type: docType,
        title: `${docType} - ${selectedClient?.full_name || 'مستند'}`,
        content,
        court: selectedCase.court || null,
        case_number: selectedCase.case_number || null,
        opposing_party: selectedCase.opposing_party || null,
        client_name: selectedClient?.full_name || null,
        status: 'final',
        thread_id: selectedCase.id,
        parent_id: parentId,
        step_number: step,
        metadata: {},
      } as any).select().single();

      if (error) throw error;
      const newDoc = data as ThreadDoc;
      setAllDocs(prev => [...prev, newDoc]);
      toast({ title: 'تم حفظ المستند ✅' });
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' });
    }
  };

  // ─── Export Word ──────────────────────────────────────────────────────

  const exportWord = async (content: string, title: string) => {
    const lh = selectedLetterhead;

    if (!lh) {
      toast({ title: 'يرجى اختيار ترويسة أولاً قبل تحميل المستند', variant: 'destructive' });
      return;
    }

    if (!lh.template_path) {
      toast({ title: 'لا يوجد ملف قالب مرفق بهذه الترويسة', variant: 'destructive' });
      return;
    }

    try {
      const { data: fileData, error: dlErr } = await supabase.storage
        .from('letterhead-templates')
        .download(lh.template_path);
      if (dlErr || !fileData) throw dlErr || new Error('تعذر تحميل القالب');

      const ext = lh.template_path.split('.').pop()?.toLowerCase();

      if (ext === 'docx') {
        const { injectIntoTemplate } = await import('@/lib/docx-template-engine');

        const blob = await injectIntoTemplate(fileData, {
          content,
          clientName: selectedCase?.client_name || '',
          caseName: title,
          court: selectedCase?.court || '',
          caseNumber: selectedCase?.case_number || '',
          lawyerName: lh.lawyer_name,
        });

        saveAs(blob, `${title}_${new Date().toISOString().slice(0, 10)}.docx`);
      } else {
        toast({ title: 'صيغة غير مدعومة. يرجى استخدام ملف .docx', variant: 'destructive' });
      }
    } catch (e: any) {
      console.error('Export error:', e);
      toast({ title: 'خطأ في التصدير', description: e.message, variant: 'destructive' });
    }
  };

  const detectDocType = (content: string): string => {
    if (content.includes('مقال افتتاحي') || (content.includes('المدعي') && content.includes('المدعى عليه'))) return 'مقال افتتاحي';
    if (content.includes('مذكرة جوابية')) return 'مذكرة جوابية';
    if (content.includes('تعقيب') || content.includes('تعقيبية')) return 'مذكرة تعقيبية';
    if (content.includes('استئناف')) return 'مقال بالاستئناف';
    if (content.includes('نقض')) return 'مقال بالنقض';
    if (content.includes('إنذار')) return 'إنذار';
    if (content.includes('شكاية')) return 'شكاية';
    return 'مستند قانوني';
  };

  // ─── Render ───────────────────────────────────────────────────────────

  if (loading) {
    return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  // ═══════════════════════ CHAT VIEW ═══════════════════════════════════

  if (view === 'chat' && selectedCase) {
    return (
      <div className="flex flex-col h-[calc(100vh-6rem)]">
        {/* Header */}
        <div className="flex items-center gap-3 pb-3 border-b border-border">
          <Button variant="ghost" size="sm" onClick={() => { setView('case_select'); setSelectedCase(null); }}>
            <ArrowRight className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-bold text-foreground text-sm truncate">
                {selectedClient?.full_name} ضد {selectedCase.opposing_party}
              </h2>
              {caseDocs.length > 0 && (
                <Badge variant="outline" className="text-xs">{caseDocs.length} مستند</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {selectedCase.court_level} • {selectedCase.court || ''} • ملف: <span dir="ltr">{selectedCase.case_number}</span>
              {selectedCase.case_type && ` • ${selectedCase.case_type}`}
            </p>
          </div>
          {/* Letterhead selector */}
          <div className="relative shrink-0" ref={letterheadSearchRef}>
            <Button
              variant={selectedLetterhead ? 'default' : 'outline'}
              size="sm"
              className="gap-1.5 text-xs h-8"
              onClick={() => setShowLetterheadSuggestions(!showLetterheadSuggestions)}
            >
              <Stamp className="h-3 w-3" />
              {selectedLetterhead ? selectedLetterhead.lawyer_name : 'ترويسة'}
            </Button>
            {showLetterheadSuggestions && (
              <div className="absolute left-0 top-full mt-1 z-50 w-56 border border-border rounded-lg bg-popover shadow-lg overflow-hidden">
                <div className="p-2 border-b border-border">
                  <Input
                    placeholder="ابحث عن ترويسة..."
                    value={letterheadSearch}
                    onChange={e => setLetterheadSearch(e.target.value)}
                    className="h-7 text-xs"
                    autoFocus
                  />
                </div>
                <div className="max-h-[200px] overflow-y-auto">
                  {selectedLetterheadId && (
                    <button
                      onClick={() => { setSelectedLetterheadId(''); setLetterheadSearch(''); setShowLetterheadSuggestions(false); }}
                      className="w-full text-right px-3 py-2 text-xs text-destructive hover:bg-accent transition-colors border-b border-border"
                    >
                      ❌ بدون ترويسة
                    </button>
                  )}
                  {filteredLetterheads.map(lh => (
                    <button
                      key={lh.id}
                      onClick={() => { setSelectedLetterheadId(lh.id); setLetterheadSearch(''); setShowLetterheadSuggestions(false); }}
                      className={`w-full text-right px-3 py-2 text-xs hover:bg-accent transition-colors border-b border-border last:border-0 ${lh.id === selectedLetterheadId ? 'bg-primary/10 text-primary font-medium' : 'text-foreground'}`}
                    >
                      {lh.lawyer_name}
                    </button>
                  ))}
                  {filteredLetterheads.length === 0 && (
                    <div className="px-3 py-4 text-center text-xs text-muted-foreground">لا توجد ترويسات</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Case documents archive */}
        {caseDocs.length > 0 && (
          <div className="border-b border-border">
            <button
              onClick={() => setExpandedThread(expandedThread ? null : 'current')}
              className="w-full flex items-center justify-between py-2 px-3 text-sm text-muted-foreground hover:text-foreground"
            >
              <span className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4" />
                أرشيف الملف ({caseDocs.length})
              </span>
              {expandedThread ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {expandedThread && (
              <div className="px-3 pb-3 space-y-1.5 max-h-[250px] overflow-y-auto">
                {caseDocs.map((doc, i) => {
                  const isOpponentMemo = doc.doc_type === 'مذكرة الخصم';
                  return (
                    <div key={doc.id} className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs ${isOpponentMemo ? 'bg-destructive/10 border border-destructive/20' : 'bg-muted/50'}`}>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold shrink-0 text-[10px] ${isOpponentMemo ? 'bg-destructive/20 text-destructive' : 'bg-primary/10 text-primary'}`}>
                          {doc.step_number || i + 1}
                        </span>
                        <span className="font-medium text-foreground truncate">{doc.doc_type}</span>
                        {isOpponentMemo && <span>📨</span>}
                        <span className="text-muted-foreground text-[10px]">{new Date(doc.created_at).toLocaleDateString('ar-MA')}</span>
                      </div>
                      <div className="flex gap-0.5 shrink-0">
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setPreviewDoc(doc)}>
                          <Eye className="h-3 w-3" />
                        </Button>
                        {doc.content && (
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => exportWord(doc.content || '', doc.doc_type)}>
                            <Download className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {/* Add opponent memo */}
                <label className="flex items-center justify-center gap-2 border border-dashed border-destructive/40 rounded-lg px-3 py-2.5 text-xs text-destructive hover:bg-destructive/5 cursor-pointer transition-colors">
                  <FileUp className="h-3.5 w-3.5" />
                  <span className="font-medium">إضافة رد الخصم (PDF/Word)</span>
                  <input type="file" multiple accept=".pdf,.docx,.txt" className="hidden"
                    onChange={e => { if (e.target.files) addOpponentMemo(Array.from(e.target.files)); e.target.value = ''; }} />
                </label>
              </div>
            )}
          </div>
        )}

        {/* Doc type config panel - shown when no doc type selected yet */}
        {!activeDocType && (
          <div className="border-b border-border px-3 py-4 space-y-3">
            <div className="text-center space-y-1">
              <p className="text-sm font-semibold text-foreground">اختر نوع المستند</p>
              <p className="text-xs text-muted-foreground">حدد نوع المستند ثم أكمل البيانات المطلوبة</p>
            </div>

            <div className="flex flex-wrap gap-1.5 justify-center">
              {DOC_TYPE_OPTIONS.map(dt => (
                <button
                  key={dt.label}
                  onClick={() => setChatDocConfig(prev => ({ ...prev, doc_type: dt.label }))}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors border ${
                    chatDocConfig.doc_type === dt.label
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-foreground border-border hover:bg-accent'
                  }`}
                >
                  {dt.label}
                </button>
              ))}
            </div>

            {/* Court level */}
            {chatDocConfig.doc_type && getDocRequirement(chatDocConfig.doc_type) !== 'none' && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">درجة المحكمة *</label>
                <div className="flex gap-2">
                  {COURT_LEVELS.map(level => (
                    <button
                      key={level}
                      onClick={() => setChatDocConfig(prev => ({ ...prev, court_level: level }))}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors border ${
                        chatDocConfig.court_level === level
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background text-foreground border-border hover:bg-accent'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Court name */}
            {chatDocConfig.doc_type && getDocRequirement(chatDocConfig.doc_type) !== 'none' && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">المحكمة المختصة *</label>
                <Select value={chatDocConfig.court} onValueChange={v => setChatDocConfig(prev => ({ ...prev, court: v }))}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="اختر المحكمة" /></SelectTrigger>
                  <SelectContent>
                    {COURT_TYPES.map(ct => (
                      <SelectItem key={ct} value={ct}>{ct}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Case number */}
            {chatDocConfig.doc_type && getDocRequirement(chatDocConfig.doc_type) === 'court_and_case' && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">رقم الملف</label>
                <Input
                  placeholder="رقم الملف بالمحكمة"
                  value={chatDocConfig.case_number}
                  onChange={e => setChatDocConfig(prev => ({ ...prev, case_number: e.target.value }))}
                  className="h-9 text-xs"
                />
              </div>
            )}

            {chatDocConfig.doc_type && (
              <Button
                onClick={() => {
                  setActiveDocType(chatDocConfig.doc_type);
                  // Update case with court info if provided
                  if (selectedCase && (chatDocConfig.court || chatDocConfig.case_number)) {
                    supabase.from('cases').update({
                      court: chatDocConfig.court || selectedCase.court,
                      court_level: chatDocConfig.court_level || selectedCase.court_level,
                      case_number: chatDocConfig.case_number || selectedCase.case_number,
                    }).eq('id', selectedCase.id).then(() => {
                      setSelectedCase(prev => prev ? {
                        ...prev,
                        court: chatDocConfig.court || prev.court,
                        court_level: chatDocConfig.court_level || prev.court_level,
                        case_number: chatDocConfig.case_number || prev.case_number,
                      } : prev);
                    });
                  }
                }}
                disabled={
                  (getDocRequirement(chatDocConfig.doc_type) !== 'none' && !chatDocConfig.court)
                }
                className="w-full gap-2" size="sm"
              >
                <Sparkles className="h-3.5 w-3.5" /> متابعة
              </Button>
            )}
          </div>
        )}

        {/* Required: upload case documents before AI can generate */}
        {activeDocType && caseDocs.length === 0 && !DOCS_NOT_REQUIRED_TYPES.includes(activeDocType) && (
          <div className="border-b border-border px-3 py-4 space-y-3">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
                <FileUp className="h-6 w-6 text-primary" />
              </div>
              <p className="text-sm font-semibold text-foreground">أضف وثائق الملف أولاً</p>
              <p className="text-xs text-muted-foreground">يجب رفع الوثائق والمستندات التي سيبني عليها الذكاء الاصطناعي (مذكرة الخصم، أحكام، عقود، محاضر...)</p>
            </div>
            <label className="flex items-center justify-center gap-2 border-2 border-dashed border-primary/40 rounded-xl px-4 py-4 text-sm text-primary hover:bg-primary/5 cursor-pointer transition-colors font-medium">
              <FileUp className="h-4 w-4" />
              <span>رفع وثائق الملف (PDF / Word / صور)</span>
              <input type="file" multiple accept=".pdf,.docx,.txt,.jpg,.jpeg,.png" className="hidden"
                onChange={e => { if (e.target.files) addOpponentMemo(Array.from(e.target.files)); e.target.value = ''; }} />
            </label>
          </div>
        )}

        {/* Messages */}
        <ScrollArea className="flex-1 py-3">
          <div className="space-y-3 px-1">
            {chatMessages.length === 0 && activeDocType && (caseDocs.length > 0 || DOCS_NOT_REQUIRED_TYPES.includes(activeDocType)) && (
              <div className="text-center py-8 space-y-3">
                <Sparkles className="h-10 w-10 text-primary/20 mx-auto" />
                <p className="text-sm font-medium text-foreground">اكتب ما تريد وسأصوغه لك</p>
                <p className="text-xs text-muted-foreground">{activeDocType ? `نوع المستند: ${activeDocType}` : `الملف يحتوي على ${caseDocs.length} وثيقة`}</p>
                <div className="flex flex-wrap gap-1.5 justify-center max-w-sm mx-auto">
                  {[
                    'مقال افتتاحي بسبب عدم أداء الكراء',
                    'إنذار بالإفراغ',
                    'الخصم رد بمذكرة، عقّب عليها',
                    'شكاية إلى وكيل الملك',
                    'مقال استئنافي ضد الحكم',
                  ].map((s, i) => (
                    <button
                      key={i}
                      onClick={() => setInputText(s)}
                      className="text-xs bg-muted hover:bg-accent text-foreground px-2.5 py-1.5 rounded-md transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-[92%] rounded-2xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-tl-sm'
                    : 'bg-muted text-foreground rounded-tr-sm'
                }`}>
                  {msg.role === 'assistant' ? (
                    <div className="space-y-2">
                      <div dir="rtl" className="whitespace-pre-wrap leading-7 text-sm"
                        style={{ fontFamily: "'Traditional Arabic', 'Amiri', serif" }}>
                        {msg.content || (
                          <span className="flex items-center gap-2 text-muted-foreground text-xs">
                            <Loader2 className="h-3 w-3 animate-spin" /> جاري الصياغة...
                          </span>
                        )}
                      </div>
                      {msg.content && !isStreaming && (
                        <div className="flex gap-1.5 pt-2 border-t border-border/40">
                          <Button size="sm" variant="ghost" className="text-xs h-7 gap-1"
                            onClick={() => saveDocument(msg.content, detectDocType(msg.content))}>
                            <Save className="h-3 w-3" /> حفظ
                          </Button>
                          <Button size="sm" variant="ghost" className="text-xs h-7 gap-1"
                            onClick={() => exportWord(msg.content, detectDocType(msg.content))}>
                            <Download className="h-3 w-3" /> Word
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
        </ScrollArea>

        {/* Attachments */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-1 px-2 py-1.5 border-t border-border">
            {isParsing && (
              <Badge variant="outline" className="gap-1 text-xs text-primary">
                <Loader2 className="h-2.5 w-2.5 animate-spin" /> جاري قراءة الملفات...
              </Badge>
            )}
            {attachments.map((f, i) => (
              <Badge key={i} variant="secondary" className="gap-1 text-xs">
                📄 {f.name}
                <button onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))}><Trash2 className="h-2.5 w-2.5" /></button>
              </Badge>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="border-t border-border pt-2">
          {!activeDocType ? (
            <div className="text-center py-3">
              <p className="text-xs text-muted-foreground">⬆️ اختر نوع المستند أولاً</p>
            </div>
          ) : caseDocs.length === 0 && !DOCS_NOT_REQUIRED_TYPES.includes(activeDocType) ? (
            <div className="text-center py-3">
              <p className="text-xs text-muted-foreground">⬆️ أضف وثائق الملف أعلاه لتتمكن من بدء الصياغة</p>
            </div>
          ) : (
            <div className="flex gap-2 items-end">
              <div className="flex-1 relative">
                <Textarea
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder="اكتب ما تريد... أرفق ملفات PDF/Word..."
                  className="min-h-[44px] max-h-[120px] resize-none pr-3 pl-12 text-sm"
                  rows={1}
                  disabled={isStreaming || isParsing}
                />
                <label className="absolute left-3 bottom-3 cursor-pointer text-muted-foreground hover:text-foreground">
                  <FileUp className="h-4 w-4" />
                  <input type="file" multiple accept=".pdf,.docx,.txt,.jpg,.jpeg,.png" className="hidden"
                    onChange={e => { if (e.target.files) setAttachments(prev => [...prev, ...Array.from(e.target.files!)]); }} />
                </label>
              </div>
              <Button onClick={sendMessage} disabled={!inputText.trim() || isStreaming || isParsing} size="icon" className="h-[44px] w-[44px] shrink-0">
                {isStreaming || isParsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          )}
        </div>

        {/* Preview Dialog */}
        <Dialog open={!!previewDoc} onOpenChange={() => setPreviewDoc(null)}>
          <DialogContent className="max-w-3xl max-h-[80vh]">
            <DialogHeader><DialogTitle>{previewDoc?.doc_type}</DialogTitle></DialogHeader>
            <ScrollArea className="h-[60vh]">
              {previewDoc?.content && (
                <div dir="rtl" className="whitespace-pre-wrap leading-8 p-4" style={{ fontFamily: "'Traditional Arabic', 'Amiri', serif" }}>
                  {previewDoc.content}
                </div>
              )}
              {previewDoc?.opponent_memo && (
                <div className="p-4 space-y-2">
                  <Badge variant="destructive" className="text-xs">📨 مذكرة الخصم</Badge>
                  <div dir="rtl" className="whitespace-pre-wrap leading-7 text-sm bg-destructive/5 p-4 rounded-lg border border-destructive/20">
                    {previewDoc.opponent_memo}
                  </div>
                </div>
              )}
            </ScrollArea>
            {previewDoc?.content && (
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => previewDoc && exportWord(previewDoc.content || '', previewDoc.doc_type)}>
                  <Download className="h-4 w-4 ml-2" /> Word
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ═══════════════════════ NEW CASE FORM ═══════════════════════════════

  if (view === 'new_case' && selectedClient) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setView('case_select')}>
            <ArrowRight className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-lg font-bold text-foreground">ملف جديد</h1>
            <p className="text-xs text-muted-foreground">الموكل: {selectedClient.full_name}</p>
          </div>
        </div>

        <Card>
          <CardContent className="pt-5 space-y-4">
            {/* Opposing party - Required */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">المدعى عليه / الخصم *</label>
              <Input
                placeholder="اسم الخصم الكامل"
                value={newCase.opposing_party}
                onChange={e => setNewCase(prev => ({ ...prev, opposing_party: e.target.value }))}
                className="h-10"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">عنوان الخصم</label>
              <Input
                placeholder="عنوان الخصم"
                value={newCase.opposing_party_address}
                onChange={e => setNewCase(prev => ({ ...prev, opposing_party_address: e.target.value }))}
                className="h-10"
              />
            </div>

            {/* Case type */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">نوع الدعوى</label>
              <div className="flex flex-wrap gap-1.5">
                {CASE_TYPES.map(ct => (
                  <button
                    key={ct}
                    onClick={() => setNewCase(prev => ({ ...prev, case_type: prev.case_type === ct ? '' : ct }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                      newCase.case_type === ct
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background text-foreground border-border hover:bg-accent'
                    }`}
                  >
                    {ct}
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">عنوان الملف</label>
              <Input
                placeholder="يُملأ تلقائياً"
                value={newCase.title}
                onChange={e => setNewCase(prev => ({ ...prev, title: e.target.value }))}
                className="h-10"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">ملاحظات</label>
              <Textarea
                placeholder="ملاحظات عن القضية (اختياري)"
                value={newCase.description}
                onChange={e => setNewCase(prev => ({ ...prev, description: e.target.value }))}
                className="min-h-[60px]"
              />
            </div>

            <Button
              onClick={createCase}
              disabled={!newCase.opposing_party.trim()}
              className="w-full gap-2" size="lg"
            >
              <Plus className="h-4 w-4" /> إنشاء الملف والبدء
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ═══════════════════════ CASE SELECT VIEW ════════════════════════════

  if (view === 'case_select' && selectedClient) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={clearClient}>
            <ArrowRight className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              {selectedClient.full_name}
            </h1>
            <p className="text-xs text-muted-foreground">
              {selectedClient.cin && `CIN: ${selectedClient.cin} • `}
              {selectedClient.address || ''}
            </p>
          </div>
        </div>

        {/* Client's cases */}
        {clientCases.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <Briefcase className="h-3.5 w-3.5 text-primary" />
              ملفات {selectedClient.full_name} ({clientCases.length})
            </h3>
            <div className="space-y-2">
              {clientCases.map(caseFile => {
                const docsCount = allDocs.filter(d => d.case_id === caseFile.id).length;
                return (
                  <Card
                    key={caseFile.id}
                    className="hover:border-primary/40 transition-colors"
                  >
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1 cursor-pointer" onClick={() => openCase(caseFile)}>
                          <div className="flex items-center gap-2 mb-0.5">
                            <Scale className="h-3.5 w-3.5 text-primary shrink-0" />
                            <span className="font-medium text-foreground text-sm truncate">
                              ضد {caseFile.opposing_party || '—'}
                            </span>
                            {docsCount > 0 && (
                              <Badge variant="outline" className="text-[10px] shrink-0">{docsCount} مستند</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap mt-0.5">
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{caseFile.court_level}</Badge>
                            {caseFile.court && <span>{caseFile.court}</span>}
                            {caseFile.case_type && <span>• {caseFile.case_type}</span>}
                            {caseFile.case_number && <span>• ملف: <span dir="ltr">{caseFile.case_number}</span></span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button size="sm" variant="outline" className="gap-1 text-xs h-7" onClick={() => openCase(caseFile)}>
                            <MessageSquare className="h-3 w-3" /> فتح
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>حذف الملف</AlertDialogTitle>
                                <AlertDialogDescription>
                                  سيتم حذف هذا الملف وجميع المستندات المرتبطة به ({docsCount} مستند). هل أنت متأكد؟
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteCase(caseFile.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                  حذف
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* New case button */}
        <Button
          onClick={() => setView('new_case')}
          className="gap-2 w-full"
          variant={clientCases.length > 0 ? 'outline' : 'default'}
          size="lg"
        >
          <Plus className="h-4 w-4" /> ملف جديد لـ {selectedClient.full_name}
        </Button>
      </div>
    );
  }

  // ═══════════════════════ MAIN VIEW ═══════════════════════════════════

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          مولّد المستندات القانونية
        </h1>
        <p className="text-muted-foreground text-xs mt-1">اختر موكلاً ثم أنشئ أو افتح ملفاً لبدء الصياغة</p>
      </div>

      {/* Client search */}
      <Card>
        <CardContent className="pt-5 space-y-4">
          <div className="space-y-2" ref={clientSearchRef}>
            <label className="text-sm font-medium text-foreground flex items-center gap-1">
              <User className="h-3.5 w-3.5 text-primary" /> الموكل
            </label>
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={clientSearch}
                onChange={e => {
                  setClientSearch(e.target.value);
                  setShowClientSuggestions(true);
                }}
                onFocus={() => clientSearch.trim() && setShowClientSuggestions(true)}
                placeholder="اكتب اسم الموكل أو رقم CIN..."
                className="pr-9 h-10"
              />
            </div>

            {/* Autocomplete */}
            {showClientSuggestions && clientSearch.trim() && (
              <div className="border border-border rounded-lg bg-popover shadow-lg overflow-hidden">
                {filteredClients.length > 0 && (
                  <div className="max-h-[200px] overflow-y-auto">
                    {filteredClients.map(c => (
                      <button
                        key={c.id}
                        onClick={() => selectClient(c)}
                        className="w-full text-right px-4 py-2.5 hover:bg-accent transition-colors border-b border-border last:border-0"
                      >
                        <div className="font-medium text-foreground text-sm">{c.full_name}</div>
                        <div className="text-xs text-muted-foreground flex gap-3 mt-0.5">
                          {c.cin && <span>🪪 {c.cin}</span>}
                          {c.phone && <span>📞 {c.phone}</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {clientHasNoMatch && (
                  <button
                    onClick={() => {
                      setShowNewClientForm(true);
                      setShowClientSuggestions(false);
                      setNewClient(prev => ({ ...prev, full_name: clientSearch.trim() }));
                    }}
                    className="w-full text-right px-4 py-3 hover:bg-accent transition-colors flex items-center gap-2 text-primary"
                  >
                    <UserPlus className="h-4 w-4 shrink-0" />
                    <span className="text-sm font-medium">إنشاء موكل جديد: "{clientSearch.trim()}"</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* New client form */}
          {showNewClientForm && (
            <div className="border border-primary/20 rounded-lg bg-primary/5 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                  <UserPlus className="h-4 w-4 text-primary" /> موكل جديد
                </h3>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setShowNewClientForm(false)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Input placeholder="الاسم الكامل *" value={newClient.full_name}
                  onChange={e => setNewClient(prev => ({ ...prev, full_name: e.target.value }))} className="h-9 text-sm" />
                <Input placeholder="CIN" value={newClient.cin}
                  onChange={e => setNewClient(prev => ({ ...prev, cin: e.target.value }))} className="h-9 text-sm" />
                <Input placeholder="العنوان" value={newClient.address}
                  onChange={e => setNewClient(prev => ({ ...prev, address: e.target.value }))} className="h-9 text-sm" />
                <Input placeholder="الهاتف" value={newClient.phone}
                  onChange={e => setNewClient(prev => ({ ...prev, phone: e.target.value }))} className="h-9 text-sm" />
              </div>
              <Button onClick={createNewClient} disabled={!newClient.full_name.trim()} size="sm" className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> إنشاء الموكل
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reference Documents */}
      <Card>
        <CardContent className="pt-4">
          <button
            onClick={() => setShowRefDocs(!showRefDocs)}
            className="w-full flex items-center justify-between text-sm font-bold text-foreground"
          >
            <span className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              النماذج المرجعية ({referenceDocs.length})
            </span>
            {showRefDocs ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          <p className="text-[11px] text-muted-foreground mt-1">ارفع مذكرات ومقالات وأحكام قضائية ليتعلم منها الذكاء الاصطناعي أسلوبك</p>
          
          {showRefDocs && (
            <div className="mt-3 space-y-2">
              <label className="flex items-center justify-center gap-2 border border-dashed border-primary/40 rounded-lg px-3 py-3 text-xs text-primary hover:bg-primary/5 cursor-pointer transition-colors">
                {isUploadingRef ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileUp className="h-3.5 w-3.5" />}
                <span className="font-medium">رفع نماذج (PDF / Word / نص)</span>
                <input type="file" multiple accept=".pdf,.docx,.txt" className="hidden"
                  disabled={isUploadingRef}
                  onChange={e => { if (e.target.files) uploadReferenceDoc(Array.from(e.target.files)); e.target.value = ''; }} />
              </label>

              {referenceDocs.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {['الكل', ...REF_DOC_TYPES].map(type => {
                    const count = type === 'الكل' ? referenceDocs.length : referenceDocs.filter(d => d.doc_type === type).length;
                    if (type !== 'الكل' && count === 0) return null;
                    return (
                      <button
                        key={type}
                        onClick={() => setRefDocFilter(type)}
                        className={`text-[10px] px-2 py-1 rounded-md transition-colors ${
                          refDocFilter === type
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground hover:bg-accent'
                        }`}
                      >
                        {type} ({count})
                      </button>
                    );
                  })}
                </div>
              )}
              
              {filteredRefDocs.length > 0 && (
                <div className="space-y-1 max-h-[250px] overflow-y-auto">
                  {filteredRefDocs.map(rd => (
                    <div key={rd.id} className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2 text-xs">
                      <div className="min-w-0 flex-1">
                        <span className="font-medium text-foreground truncate block">{rd.title}</span>
                        <span className="text-muted-foreground text-[10px]">
                          {rd.content.length > 100 ? `${Math.round(rd.content.length / 1000)}k حرف` : `${rd.content.length} حرف`}
                        </span>
                      </div>
                      <Select value={rd.doc_type} onValueChange={(v) => updateRefDocType(rd.id, v)}>
                        <SelectTrigger className="h-6 w-[90px] text-[10px] px-1.5 border-border/50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {REF_DOC_TYPES.map(t => (
                            <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 shrink-0 text-destructive hover:text-destructive" onClick={() => deleteReferenceDoc(rd.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {referenceDocs.length > 0 && filteredRefDocs.length === 0 && (
                <p className="text-center text-[11px] text-muted-foreground py-3">لا توجد نماذج من هذا النوع</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* All cases archive */}
      <div>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-primary" /> جميع الملفات
          </h2>
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="بحث..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pr-9 h-8 text-sm"
            />
          </div>
        </div>

        {(() => {
          const filteredCases = cases.filter(c =>
            !searchQuery ||
            (c.opposing_party && c.opposing_party.includes(searchQuery)) ||
            c.case_number.includes(searchQuery) ||
            (c.court && c.court.includes(searchQuery))
          );

          if (filteredCases.length === 0) {
            return (
              <Card>
                <CardContent className="py-10 text-center text-muted-foreground text-sm">
                  <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-20" />
                  لا توجد ملفات محفوظة
                </CardContent>
              </Card>
            );
          }

          return (
            <div className="space-y-2">
              {filteredCases.map(caseFile => {
                const client = clients.find(c => c.id === caseFile.client_id);
                const docsCount = allDocs.filter(d => d.case_id === caseFile.id).length;
                return (
                  <Card key={caseFile.id} className="hover:border-primary/30 transition-colors cursor-pointer"
                    onClick={() => {
                      if (client) {
                        setSelectedClientId(client.id);
                        setClientSearch(client.full_name);
                      }
                      openCase(caseFile);
                    }}>
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-medium text-foreground text-sm truncate">
                              {client?.full_name || '—'} ضد {caseFile.opposing_party || '—'}
                            </span>
                            {docsCount > 0 && <Badge variant="outline" className="text-[10px] shrink-0">{docsCount}</Badge>}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{caseFile.court_level}</Badge>
                            {caseFile.court && <span>{caseFile.court}</span>}
                            {caseFile.case_type && <span>• {caseFile.case_type}</span>}
                            {caseFile.case_number && <span>• ملف: <span dir="ltr">{caseFile.case_number}</span></span>}
                          </div>
                        </div>
                        <Button size="sm" variant="outline" className="gap-1 shrink-0 text-xs h-7">
                          <MessageSquare className="h-3 w-3" /> فتح
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          );
        })()}
      </div>
    </div>
  );
};

export default DocumentGenerator;
