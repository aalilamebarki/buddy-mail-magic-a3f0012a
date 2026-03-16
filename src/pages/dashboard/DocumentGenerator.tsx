import { useState, useEffect, useRef, useCallback } from 'react';
import { extractAllFiles } from '@/lib/parse-files';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  FileText, Search, Download, Loader2, Save, Eye,
  FileUp, Trash2, Sparkles, Send, FolderOpen,
  ArrowRight, MessageSquare, ChevronDown, ChevronUp, User, Plus, X, UserPlus, Stamp
} from 'lucide-react';
import { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel, ImageRun, Header, Footer } from 'docx';
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
}

interface DocAttachment {
  id: string;
  document_id: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
}

interface ClientInfo {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  cin: string | null;
}

interface Letterhead {
  id: string;
  lawyer_name: string;
  template_path: string | null;
}

interface CaseThread {
  threadId: string;
  clientName: string;
  clientId: string | null;
  opposingParty: string;
  court: string;
  caseNumber: string;
  docs: ThreadDoc[];
  lastDate: string;
}

// ─── Component ──────────────────────────────────────────────────────────────

const DocumentGenerator = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  // Data
  const [clients, setClients] = useState<ClientInfo[]>([]);
  const [allDocs, setAllDocs] = useState<ThreadDoc[]>([]);
  const [loading, setLoading] = useState(true);

  // View
  const [view, setView] = useState<'main' | 'chat'>('main');

  // Selection
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedClient, setSelectedClient] = useState<ClientInfo | null>(null);
  const [currentThread, setCurrentThread] = useState<CaseThread | null>(null);

  // Client search
  const [clientSearch, setClientSearch] = useState('');
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [newClient, setNewClient] = useState({ full_name: '', cin: '', address: '', phone: '', email: '' });
  const clientSearchRef = useRef<HTMLDivElement>(null);

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

  // Archive
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedThread, setExpandedThread] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<ThreadDoc | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // ─── Load data ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [clientsRes, docsRes, lhRes] = await Promise.all([
        supabase.from('clients').select('id, full_name, email, phone, address, cin'),
        supabase.from('generated_documents')
          .select('id, doc_type, content, opponent_memo, step_number, status, created_at, thread_id, title, client_name, client_id, opposing_party, court, case_number')
          .order('created_at', { ascending: true }),
        supabase.from('letterheads').select('id, lawyer_name, header_image_path, footer_image_path') as any,
      ]);
      if (clientsRes.data) setClients(clientsRes.data as ClientInfo[]);
      if (docsRes.data) setAllDocs(docsRes.data as ThreadDoc[]);
      if (lhRes.data) setLetterheads(lhRes.data as Letterhead[]);
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

  // Filtered letterheads
  const filteredLetterheads = letterheadSearch.trim()
    ? letterheads.filter(lh => lh.lawyer_name.includes(letterheadSearch))
    : letterheads;

  const selectedLetterhead = selectedLetterheadId ? letterheads.find(lh => lh.id === selectedLetterheadId) || null : null;

  // Filtered clients for autocomplete
  const filteredClients = clientSearch.trim()
    ? clients.filter(c =>
        c.full_name.includes(clientSearch) ||
        (c.cin && c.cin.includes(clientSearch))
      )
    : [];

  const clientHasNoMatch = clientSearch.trim().length > 0 && filteredClients.length === 0;

  // ─── Thread grouping ──────────────────────────────────────────────────

  const threadGroups: CaseThread[] = (() => {
    const map = new Map<string, ThreadDoc[]>();
    for (const doc of allDocs) {
      const tid = doc.thread_id || doc.id;
      if (!map.has(tid)) map.set(tid, []);
      map.get(tid)!.push(doc);
    }
    return Array.from(map.entries()).map(([threadId, docs]) => {
      const sorted = docs.sort((a, b) => (a.step_number || 1) - (b.step_number || 1));
      const first = sorted[0];
      return {
        threadId, docs: sorted,
        clientName: first.client_name || '',
        clientId: first.client_id || null,
        opposingParty: first.opposing_party || '',
        court: first.court || '',
        caseNumber: first.case_number || '',
        lastDate: sorted[sorted.length - 1].created_at,
      };
    }).sort((a, b) => new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime());
  })();

  const filteredThreads = threadGroups.filter(t =>
    !searchQuery || t.clientName.includes(searchQuery) || t.opposingParty.includes(searchQuery) || t.caseNumber.includes(searchQuery)
  );

  // Get threads for selected client - match by client_id first, fallback to name
  const clientThreads: CaseThread[] = selectedClient
    ? threadGroups.filter(t => t.clientId === selectedClient.id || (!t.clientId && t.clientName === selectedClient.full_name))
    : [];

  // ─── Actions ──────────────────────────────────────────────────────────

  const openThread = (thread: CaseThread) => {
    setCurrentThread(thread);
    setChatMessages([]);
    const matchClient = clients.find(c => c.full_name === thread.clientName);
    if (matchClient) { setSelectedClientId(matchClient.id); }
    setView('chat');
  };

  const startNew = () => {
    setCurrentThread({
      threadId: crypto.randomUUID(),
      clientName: selectedClient?.full_name || '',
      clientId: selectedClient?.id || null,
      opposingParty: '', court: '', caseNumber: '',
      docs: [], lastDate: new Date().toISOString(),
    });
    setChatMessages([]);
    setView('chat');
  };

  // ─── Add opponent memo to thread ──────────────────────────────────────
  const addOpponentMemo = async (files: File[]) => {
    if (!user || !currentThread || files.length === 0) return;
    setIsParsing(true);
    try {
      const parsed = await extractAllFiles(files);
      const memoContent = parsed.map(p => p.text).join('\n\n');
      const step = currentThread.docs.length + 1;
      const parentId = currentThread.docs.length > 0 ? currentThread.docs[currentThread.docs.length - 1].id : null;

      const { data, error } = await supabase.from('generated_documents').insert({
        user_id: user.id,
        client_id: selectedClientId || null,
        doc_type: 'مذكرة الخصم',
        title: `مذكرة الخصم - الخطوة ${step}`,
        content: null,
        opponent_memo: memoContent,
        court: currentThread.court || null,
        case_number: currentThread.caseNumber || null,
        opposing_party: currentThread.opposingParty || null,
        client_name: currentThread.clientName || null,
        status: 'final',
        thread_id: currentThread.threadId,
        parent_id: parentId,
        step_number: step,
        metadata: {},
      } as any).select().single();
      if (error) throw error;

      // Upload original files as attachments
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
      setCurrentThread(prev => prev ? { ...prev, docs: [...prev.docs, newDoc] } : prev);
      toast({ title: 'تم حفظ مذكرة الخصم بالأرشيف ✅', description: 'سيعتمد عليها الذكاء الاصطناعي في الصياغة التالية' });
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' });
    } finally {
      setIsParsing(false);
    }
  };

  // Create new client
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
      toast({ title: 'تم إنشاء الموكل ✅' });
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' });
    }
  };

  const selectClient = (client: ClientInfo) => {
    setSelectedClientId(client.id);
    setClientSearch(client.full_name);
    setShowClientSuggestions(false);
  };

  const clearClient = () => {
    setSelectedClientId('');
    setSelectedClient(null);
    setClientSearch('');
  };



  const sendMessage = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isStreaming) return;

    setInputText('');
    setIsStreaming(true);

    // Parse attachments if any
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

    // Build user message with attachment content
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
      clientName: currentThread?.clientName || selectedClient?.full_name || '',
      clientAddress: selectedClient?.address || '',
      clientCIN: selectedClient?.cin || '',
      clientPhone: selectedClient?.phone || '',
      opposingParty: currentThread?.opposingParty || '',
      court: currentThread?.court || '',
      caseNumber: currentThread?.caseNumber || '',
      previousDocs: (currentThread?.docs || []).map(d => ({
        step: d.step_number,
        docType: d.doc_type,
        content: d.content?.slice(0, 2000),
        opponentMemo: d.opponent_memo,
      })),
      styleReference: allDocs
        .filter(d => d.status === 'final' && d.content)
        .slice(-3)
        .map(d => d.content?.slice(0, 800)),
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
  }, [inputText, chatMessages, currentThread, selectedClient, isStreaming, toast, allDocs]);

  // ─── Save ─────────────────────────────────────────────────────────────

  const saveDocument = async (content: string, docType: string) => {
    if (!user || !currentThread) return;
    const step = currentThread.docs.length + 1;
    const parentId = currentThread.docs.length > 0 ? currentThread.docs[currentThread.docs.length - 1].id : null;

    try {
      const { data, error } = await supabase.from('generated_documents').insert({
        user_id: user.id,
        client_id: selectedClientId || null,
        doc_type: docType,
        title: `${docType} - ${currentThread.clientName || 'مستند'}`,
        content,
        court: currentThread.court || null,
        case_number: currentThread.caseNumber || null,
        opposing_party: currentThread.opposingParty || null,
        client_name: currentThread.clientName || null,
        status: 'final',
        thread_id: currentThread.threadId,
        parent_id: parentId,
        step_number: step,
        metadata: {},
      } as any).select().single();

      if (error) throw error;

      if (data && attachments.length > 0) {
        for (const file of attachments) {
          const path = `${user.id}/${data.id}/${file.name}`;
          const { error: uploadErr } = await supabase.storage.from('document-attachments').upload(path, file);
          if (!uploadErr) {
            await supabase.from('document_attachments').insert({
              document_id: data.id, file_name: file.name, file_path: path, file_type: file.type,
            } as any);
          }
        }
        setAttachments([]);
      }

      const newDoc = data as ThreadDoc;
      setAllDocs(prev => [...prev, newDoc]);
      setCurrentThread(prev => prev ? { ...prev, docs: [...prev.docs, newDoc] } : prev);
      toast({ title: 'تم حفظ المستند ✅' });
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' });
    }
  };

  // ─── Export ───────────────────────────────────────────────────────────

  const fetchImageAsBuffer = async (path: string): Promise<ArrayBuffer> => {
    const { data } = supabase.storage.from('letterheads').getPublicUrl(path);
    const resp = await fetch(data.publicUrl);
    return resp.arrayBuffer();
  };

  const exportWord = async (content: string, title: string) => {
    const lines = content.split('\n').filter(l => l.trim());
    const paragraphs = lines.map(line => {
      const isHeader = line.startsWith('بسم') || line.includes('إلى السيد') || line.includes('بناءً عليه') || line.includes('الوقائع') || line.includes('في الموضوع') || line.includes('لهذه الأسباب');
      return new Paragraph({
        children: [new TextRun({ text: line, font: 'Traditional Arabic', size: isHeader ? 28 : 24, bold: isHeader, rightToLeft: true })],
        alignment: AlignmentType.RIGHT, spacing: { after: 200, line: 360 },
        heading: isHeader ? HeadingLevel.HEADING_2 : undefined, bidirectional: true,
      });
    });

    // Build header/footer from selected letterhead
    let headerObj: any = undefined;
    let footerObj: any = undefined;

    const lh = selectedLetterhead;
    if (lh) {
      if (lh.header_image_path) {
        try {
          const buf = await fetchImageAsBuffer(lh.header_image_path);
          headerObj = {
            default: new Header({
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new ImageRun({
                      data: buf,
                      transformation: { width: 600, height: 100 },
                      type: 'png',
                    }),
                  ],
                }),
              ],
            }),
          };
        } catch (e) { console.error('Header image error:', e); }
      }
      if (lh.footer_image_path) {
        try {
          const buf = await fetchImageAsBuffer(lh.footer_image_path);
          footerObj = {
            default: new Footer({
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new ImageRun({
                      data: buf,
                      transformation: { width: 600, height: 80 },
                      type: 'png',
                    }),
                  ],
                }),
              ],
            }),
          };
        } catch (e) { console.error('Footer image error:', e); }
      }
    }

    const doc = new Document({
      sections: [{
        properties: {
          page: {
            margin: { top: lh?.header_image_path ? 2200 : 1440, bottom: lh?.footer_image_path ? 1800 : 1440, left: 1440, right: 1440 },
          },
        },
        headers: headerObj,
        footers: footerObj,
        children: paragraphs,
      }],
    });
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${title}_${new Date().toISOString().slice(0, 10)}.docx`);
  };

  const detectDocType = (content: string): string => {
    if (content.includes('مقال افتتاحي') || (content.includes('المدعي') && content.includes('المدعى عليه'))) return 'مقال افتتاحي';
    if (content.includes('مذكرة جوابية')) return 'مذكرة جوابية';
    if (content.includes('تعقيب') || content.includes('تعقيبية')) return 'مذكرة تعقيبية';
    if (content.includes('استئناف')) return 'مقال بالاستئناف';
    if (content.includes('نقض')) return 'مقال بالنقض';
    if (content.includes('إنذار') && content.includes('إفراغ')) return 'إنذار بالإفراغ';
    if (content.includes('إنذار') && content.includes('أداء')) return 'إنذار بالأداء';
    if (content.includes('شكاية')) return 'شكاية';
    return 'مستند قانوني';
  };

  // ─── Render ───────────────────────────────────────────────────────────

  if (loading) {
    return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  // ═══════════════════════ CHAT VIEW ═══════════════════════════════════

  if (view === 'chat' && currentThread) {
    return (
      <div className="flex flex-col h-[calc(100vh-6rem)]">
        {/* Header */}
        <div className="flex items-center gap-3 pb-3 border-b border-border">
          <Button variant="ghost" size="sm" onClick={() => setView('main')}>
            <ArrowRight className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-bold text-foreground text-sm">
                {currentThread.clientName || 'مسطرة جديدة'}
              </h2>
              {currentThread.docs.length > 0 && (
                <Badge variant="outline" className="text-xs">{currentThread.docs.length} مستند</Badge>
              )}
            </div>
            {selectedClient && (
              <p className="text-xs text-muted-foreground truncate">
                {selectedClient.cin && `CIN: ${selectedClient.cin} • `}
                {selectedClient.address || ''}
              </p>
            )}
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

        {/* Thread archive */}
        {currentThread.docs.length > 0 && (
          <div className="border-b border-border">
            <button
              onClick={() => setExpandedThread(expandedThread ? null : 'current')}
              className="w-full flex items-center justify-between py-2 px-3 text-sm text-muted-foreground hover:text-foreground"
            >
              <span className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4" />
                أرشيف المسطرة ({currentThread.docs.length})
              </span>
              {expandedThread ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {expandedThread && (
              <div className="px-3 pb-3 space-y-1.5 max-h-[250px] overflow-y-auto">
                {currentThread.docs.map((doc, i) => {
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
                {/* Add opponent memo button */}
                <label className="flex items-center justify-center gap-2 border border-dashed border-destructive/40 rounded-lg px-3 py-2.5 text-xs text-destructive hover:bg-destructive/5 cursor-pointer transition-colors">
                  <FileUp className="h-3.5 w-3.5" />
                  <span className="font-medium">إضافة رد الخصم (PDF/Word)</span>
                  <input type="file" multiple accept=".pdf,.doc,.docx,.txt" className="hidden"
                    onChange={e => { if (e.target.files) addOpponentMemo(Array.from(e.target.files)); e.target.value = ''; }} />
                </label>
              </div>
            )}
          </div>
        )}

        {/* Add opponent memo when no docs yet */}
        {currentThread.docs.length === 0 && (
          <div className="border-b border-border px-3 py-2">
            <label className="flex items-center justify-center gap-2 border border-dashed border-destructive/40 rounded-lg px-3 py-2.5 text-xs text-destructive hover:bg-destructive/5 cursor-pointer transition-colors">
              <FileUp className="h-3.5 w-3.5" />
              <span className="font-medium">إضافة رد الخصم (PDF/Word)</span>
              <input type="file" multiple accept=".pdf,.doc,.docx,.txt" className="hidden"
                onChange={e => { if (e.target.files) addOpponentMemo(Array.from(e.target.files)); e.target.value = ''; }} />
            </label>
          </div>
        )}

        {/* Messages */}
        <ScrollArea className="flex-1 py-3">
          <div className="space-y-3 px-1">
            {chatMessages.length === 0 && (
              <div className="text-center py-8 space-y-3">
                <Sparkles className="h-10 w-10 text-primary/20 mx-auto" />
                <p className="text-sm font-medium text-foreground">اكتب ما تريد وسأصوغه لك</p>
                <div className="flex flex-wrap gap-1.5 justify-center max-w-sm mx-auto">
                  {[
                    'مقال افتتاحي أمام ابتدائية الرباط بسبب عدم أداء الكراء',
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
          <div className="flex gap-2 items-end">
            <div className="flex-1 relative">
              <Textarea
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder="اكتب ما تريد... أرفق ملفات PDF/Word ليقرأها الذكاء الاصطناعي..."
                className="min-h-[44px] max-h-[120px] resize-none pr-3 pl-12 text-sm"
                rows={1}
                disabled={isStreaming || isParsing}
              />
              <label className="absolute left-3 bottom-3 cursor-pointer text-muted-foreground hover:text-foreground">
                <FileUp className="h-4 w-4" />
                <input type="file" multiple accept=".pdf,.doc,.docx,.txt" className="hidden"
                  onChange={e => { if (e.target.files) setAttachments(prev => [...prev, ...Array.from(e.target.files!)]); }} />
              </label>
            </div>
            <Button onClick={sendMessage} disabled={!inputText.trim() || isStreaming || isParsing} size="icon" className="h-[44px] w-[44px] shrink-0">
              {isStreaming || isParsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Preview */}
        <Dialog open={!!previewDoc} onOpenChange={() => setPreviewDoc(null)}>
          <DialogContent className="max-w-3xl max-h-[80vh]">
            <DialogHeader><DialogTitle>{previewDoc?.doc_type} {previewDoc?.created_at && `- ${new Date(previewDoc.created_at).toLocaleDateString('ar-MA')}`}</DialogTitle></DialogHeader>
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

  // ═══════════════════════ MAIN VIEW ═══════════════════════════════════

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          مولّد المستندات القانونية
        </h1>
        <p className="text-muted-foreground text-xs mt-1">ابحث عن موكل أو أنشئ موكلاً جديداً لبدء الصياغة</p>
      </div>

      {/* Client search with autocomplete */}
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
                  if (selectedClient && e.target.value !== selectedClient.full_name) {
                    clearClient();
                  }
                }}
                onFocus={() => clientSearch.trim() && setShowClientSuggestions(true)}
                placeholder="اكتب اسم الموكل أو رقم CIN..."
                className="pr-9 pl-9 h-10"
                disabled={!!selectedClient}
              />
              {selectedClient && (
                <button
                  onClick={clearClient}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Autocomplete dropdown */}
            {showClientSuggestions && clientSearch.trim() && !selectedClient && (
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
                <Input
                  placeholder="الاسم الكامل *"
                  value={newClient.full_name}
                  onChange={e => setNewClient(prev => ({ ...prev, full_name: e.target.value }))}
                  className="h-9 text-sm"
                />
                <Input
                  placeholder="CIN"
                  value={newClient.cin}
                  onChange={e => setNewClient(prev => ({ ...prev, cin: e.target.value }))}
                  className="h-9 text-sm"
                />
                <Input
                  placeholder="العنوان"
                  value={newClient.address}
                  onChange={e => setNewClient(prev => ({ ...prev, address: e.target.value }))}
                  className="h-9 text-sm"
                />
                <Input
                  placeholder="الهاتف"
                  value={newClient.phone}
                  onChange={e => setNewClient(prev => ({ ...prev, phone: e.target.value }))}
                  className="h-9 text-sm"
                />
              </div>
              <Button onClick={createNewClient} disabled={!newClient.full_name.trim()} size="sm" className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> إنشاء وبدء الصياغة
              </Button>
            </div>
          )}

          {/* Selected client info + threads */}
          {selectedClient && (
            <div className="space-y-3">
              <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                {selectedClient.cin && <span>🪪 {selectedClient.cin}</span>}
                {selectedClient.address && <span>📍 {selectedClient.address}</span>}
                {selectedClient.phone && <span>📞 {selectedClient.phone}</span>}
                {selectedClient.email && <span>✉️ {selectedClient.email}</span>}
              </div>

              {/* Client's existing threads */}
              {clientThreads.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                    <FolderOpen className="h-3.5 w-3.5 text-primary" />
                    مساطر {selectedClient.full_name} ({clientThreads.length})
                  </h3>
                  <div className="space-y-1.5 max-h-[250px] overflow-y-auto">
                    {clientThreads.map(thread => (
                      <div
                        key={thread.threadId}
                        onClick={() => openThread(thread)}
                        className="border border-border rounded-lg px-3 py-2.5 hover:border-primary/40 hover:bg-accent/50 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="font-medium text-foreground text-sm truncate">
                                {thread.opposingParty ? `ضد ${thread.opposingParty}` : thread.caseNumber || 'مسطرة'}
                              </span>
                              <Badge variant="outline" className="text-[10px] shrink-0">{thread.docs.length} مستند</Badge>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                              {thread.caseNumber && <span>ملف: {thread.caseNumber}</span>}
                              {thread.court && <span>• {thread.court}</span>}
                              <span>• {new Date(thread.lastDate).toLocaleDateString('ar-MA')}</span>
                            </div>
                            <div className="flex gap-1 mt-1 flex-wrap">
                              {thread.docs.map((d, i) => (
                                <Badge key={d.id} variant="secondary" className="text-[10px] px-1.5 py-0">
                                  {(d.step_number || i + 1)}. {d.doc_type}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <Button size="sm" variant="outline" className="gap-1 shrink-0 text-xs h-7" onClick={(e) => { e.stopPropagation(); openThread(thread); }}>
                            <MessageSquare className="h-3 w-3" /> متابعة
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* New thread for this client */}
              <Button onClick={startNew} className="gap-2 w-full" variant={clientThreads.length > 0 ? 'outline' : 'default'} size="lg">
                <Plus className="h-4 w-4" /> مسطرة جديدة لـ {selectedClient.full_name}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Global archive */}
      <div>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-primary" /> جميع المساطر
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

        {filteredThreads.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground text-sm">
              <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-20" />
              لا توجد مساطر محفوظة
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filteredThreads.map(thread => (
              <Card key={thread.threadId} className="hover:border-primary/30 transition-colors cursor-pointer" onClick={() => openThread(thread)}>
                <CardContent className="py-3 px-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-medium text-foreground text-sm truncate">
                          {thread.clientName || 'بدون موكل'}
                          {thread.opposingParty && ` ضد ${thread.opposingParty}`}
                        </span>
                        <Badge variant="outline" className="text-[10px] shrink-0">{thread.docs.length}</Badge>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                        {thread.caseNumber && <span>ملف: {thread.caseNumber}</span>}
                        {thread.court && <span>• {thread.court}</span>}
                        <span>• {new Date(thread.lastDate).toLocaleDateString('ar-MA')}</span>
                      </div>
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {thread.docs.map((d, i) => (
                          <Badge key={d.id} variant="secondary" className="text-[10px] px-1.5 py-0">
                            {(d.step_number || i + 1)}. {d.doc_type}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <Button size="sm" variant="outline" className="gap-1 shrink-0 text-xs h-7">
                      <MessageSquare className="h-3 w-3" /> متابعة
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentGenerator;
