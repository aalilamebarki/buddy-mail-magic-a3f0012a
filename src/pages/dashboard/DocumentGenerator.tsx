import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  FileText, Plus, Search, Download, Loader2, Save, Eye,
  FileUp, Trash2, Sparkles, Send, FolderOpen,
  ArrowRight, MessageSquare, ChevronDown, ChevronUp, User, Scale,
  Building2, MapPin
} from 'lucide-react';
import { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel } from 'docx';
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
  opposing_party: string | null;
  court: string | null;
  case_number: string | null;
}

interface CourtInfo {
  id: string;
  name: string;
  court_type: string;
  city: string;
  address: string | null;
  addressee: string;
}

interface ClientInfo {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  cin: string | null;
}

interface CaseThread {
  threadId: string;
  clientName: string;
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
  const [courts, setCourts] = useState<CourtInfo[]>([]);
  const [cases, setCases] = useState<any[]>([]);
  const [allDocs, setAllDocs] = useState<ThreadDoc[]>([]);
  const [loading, setLoading] = useState(true);

  // View: 'selector' | 'chat'
  const [view, setView] = useState<'selector' | 'chat'>('selector');

  // Phase 1: Quick selection
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedClient, setSelectedClient] = useState<ClientInfo | null>(null);
  const [selectedCourtId, setSelectedCourtId] = useState('');
  const [selectedCourt, setSelectedCourt] = useState<CourtInfo | null>(null);
  const [selectedCaseId, setSelectedCaseId] = useState('');
  const [opposingParty, setOpposingParty] = useState('');
  const [caseNumber, setCaseNumber] = useState('');
  const [currentThread, setCurrentThread] = useState<CaseThread | null>(null);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);

  // Archive
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedThread, setExpandedThread] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<ThreadDoc | null>(null);
  const [courtTypeFilter, setCourtTypeFilter] = useState('');

  const chatEndRef = useRef<HTMLDivElement>(null);

  // ─── Load data ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [clientsRes, courtsRes, casesRes, docsRes] = await Promise.all([
        supabase.from('clients').select('id, full_name, email, phone, address, cin'),
        supabase.from('courts').select('*').order('city'),
        supabase.from('cases').select('id, title, case_number, court, client_id'),
        supabase.from('generated_documents')
          .select('id, doc_type, content, opponent_memo, step_number, status, created_at, thread_id, title, client_name, opposing_party, court, case_number')
          .order('created_at', { ascending: true }),
      ]);
      if (clientsRes.data) setClients(clientsRes.data as ClientInfo[]);
      if (courtsRes.data) setCourts(courtsRes.data as CourtInfo[]);
      if (casesRes.data) setCases(casesRes.data);
      if (docsRes.data) setAllDocs(docsRes.data as ThreadDoc[]);
      setLoading(false);
    };
    load();
  }, [user]);

  // Auto scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Auto-fill from selections
  useEffect(() => {
    if (selectedClientId) {
      const c = clients.find(x => x.id === selectedClientId) || null;
      setSelectedClient(c);
    } else {
      setSelectedClient(null);
    }
  }, [selectedClientId, clients]);

  useEffect(() => {
    if (selectedCourtId) {
      const c = courts.find(x => x.id === selectedCourtId) || null;
      setSelectedCourt(c);
    } else {
      setSelectedCourt(null);
    }
  }, [selectedCourtId, courts]);

  useEffect(() => {
    if (selectedCaseId) {
      const c = cases.find(x => x.id === selectedCaseId);
      if (c) {
        setCaseNumber(c.case_number || '');
        // Try to match court
        const matchCourt = courts.find(ct => ct.name === c.court);
        if (matchCourt) setSelectedCourtId(matchCourt.id);
      }
    }
  }, [selectedCaseId, cases, courts]);

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
        threadId,
        clientName: first.client_name || '',
        opposingParty: first.opposing_party || '',
        court: first.court || '',
        caseNumber: first.case_number || '',
        docs: sorted,
        lastDate: sorted[sorted.length - 1].created_at,
      };
    }).sort((a, b) => new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime());
  })();

  const filteredThreads = threadGroups.filter(t => {
    if (searchQuery && !(
      t.clientName.includes(searchQuery) ||
      t.opposingParty.includes(searchQuery) ||
      t.caseNumber.includes(searchQuery)
    )) return false;
    if (selectedClientId) {
      const clientName = clients.find(c => c.id === selectedClientId)?.full_name || '';
      if (t.clientName !== clientName) return false;
    }
    return true;
  });

  // Court type groups
  const courtTypes = [...new Set(courts.map(c => c.court_type))];
  const filteredCourts = courtTypeFilter
    ? courts.filter(c => c.court_type === courtTypeFilter)
    : courts;

  // ─── Open / Start thread ──────────────────────────────────────────────

  const openThread = (thread: CaseThread) => {
    setCurrentThread(thread);
    setChatMessages([]);
    // Try to match client
    const matchClient = clients.find(c => c.full_name === thread.clientName);
    if (matchClient) setSelectedClientId(matchClient.id);
    // Try to match court
    const matchCourt = courts.find(c => c.name === thread.court);
    if (matchCourt) setSelectedCourtId(matchCourt.id);
    setOpposingParty(thread.opposingParty);
    setCaseNumber(thread.caseNumber);
    setView('chat');
  };

  const startNewThread = () => {
    if (!selectedClient) {
      toast({ title: 'يرجى اختيار الموكل', variant: 'destructive' });
      return;
    }

    setCurrentThread({
      threadId: crypto.randomUUID(),
      clientName: selectedClient.full_name,
      opposingParty,
      court: selectedCourt?.name || '',
      caseNumber,
      docs: [],
      lastDate: new Date().toISOString(),
    });
    setChatMessages([]);
    setView('chat');
  };

  // ─── Stream chat ──────────────────────────────────────────────────────

  const sendMessage = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isStreaming) return;

    const userMsg: ChatMessage = { role: 'user', content: text };
    const newMessages = [...chatMessages, userMsg];
    setChatMessages(newMessages);
    setInputText('');
    setIsStreaming(true);

    // Build context with all structured data
    const threadContext = {
      clientName: currentThread?.clientName || selectedClient?.full_name || '',
      clientAddress: selectedClient?.address || '',
      clientCIN: selectedClient?.cin || '',
      clientPhone: selectedClient?.phone || '',
      opposingParty: currentThread?.opposingParty || opposingParty,
      court: selectedCourt?.name || currentThread?.court || '',
      courtAddress: selectedCourt?.address || '',
      courtAddressee: selectedCourt?.addressee || '',
      caseNumber: currentThread?.caseNumber || caseNumber,
      previousDocs: (currentThread?.docs || []).map(d => ({
        step: d.step_number,
        docType: d.doc_type,
        content: d.content?.slice(0, 2000),
        opponentMemo: d.opponent_memo,
      })),
      // Include last 3 finalized docs as style reference
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
          body: JSON.stringify({
            messages: newMessages.map(m => ({ role: m.role, content: m.content })),
            threadContext,
          }),
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
  }, [inputText, chatMessages, currentThread, selectedClient, selectedCourt, opposingParty, caseNumber, isStreaming, toast, allDocs]);

  // ─── Save document ────────────────────────────────────────────────────

  const saveDocument = async (content: string, docType: string) => {
    if (!user || !currentThread) return;

    const step = currentThread.docs.length + 1;
    const parentId = currentThread.docs.length > 0
      ? currentThread.docs[currentThread.docs.length - 1].id
      : null;

    try {
      const { data, error } = await supabase.from('generated_documents').insert({
        user_id: user.id,
        client_id: selectedClientId || null,
        case_id: selectedCaseId || null,
        doc_type: docType,
        title: `${docType} - ${currentThread.clientName || 'مستند'}`,
        content,
        court: selectedCourt?.name || currentThread.court || null,
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
              document_id: data.id,
              file_name: file.name,
              file_path: path,
              file_type: file.type,
            } as any);
          }
        }
        setAttachments([]);
      }

      const newDoc = data as ThreadDoc;
      setAllDocs(prev => [...prev, newDoc]);
      setCurrentThread(prev => prev ? { ...prev, docs: [...prev.docs, newDoc] } : prev);

      toast({ title: 'تم حفظ المستند بنجاح ✅' });
    } catch (e: any) {
      toast({ title: 'خطأ في الحفظ', description: e.message, variant: 'destructive' });
    }
  };

  // ─── Export Word ──────────────────────────────────────────────────────

  const exportWord = async (content: string, title: string) => {
    const lines = content.split('\n').filter(l => l.trim());
    const paragraphs = lines.map(line => {
      const isHeader = line.startsWith('بسم') || line.includes('إلى السيد') || line.includes('بناءً عليه') || line.includes('الوقائع') || line.includes('في الموضوع') || line.includes('لهذه الأسباب');
      return new Paragraph({
        children: [new TextRun({
          text: line, font: 'Traditional Arabic', size: isHeader ? 28 : 24,
          bold: isHeader, rightToLeft: true,
        })],
        alignment: AlignmentType.RIGHT,
        spacing: { after: 200, line: 360 },
        heading: isHeader ? HeadingLevel.HEADING_2 : undefined,
        bidirectional: true,
      });
    });
    const doc = new Document({
      sections: [{ properties: { page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } }, children: paragraphs }],
    });
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${title}_${new Date().toISOString().slice(0, 10)}.docx`);
  };

  const detectDocType = (content: string): string => {
    if (content.includes('مقال افتتاحي') || (content.includes('المدعي') && content.includes('المدعى عليه'))) return 'مقال افتتاحي';
    if (content.includes('مذكرة جوابية')) return 'مذكرة جوابية';
    if (content.includes('تعقيب') || content.includes('مذكرة تعقيبية')) return 'مذكرة تعقيبية';
    if (content.includes('استئناف')) return 'مقال بالاستئناف';
    if (content.includes('نقض')) return 'مقال بالنقض';
    if (content.includes('إنذار') && content.includes('إفراغ')) return 'إنذار بالإفراغ';
    if (content.includes('إنذار') && content.includes('أداء')) return 'إنذار بالأداء';
    return 'مستند قانوني';
  };

  // ─── Render ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // ═══════════════════════ CHAT VIEW ═══════════════════════════════════

  if (view === 'chat' && currentThread) {
    return (
      <div className="flex flex-col h-[calc(100vh-6rem)] max-h-[calc(100vh-6rem)]">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-border flex-wrap">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setView('selector')}>
              <ArrowRight className="h-4 w-4" />
            </Button>
            <div>
              <h2 className="font-bold text-foreground flex items-center gap-2 text-sm sm:text-base">
                <Scale className="h-4 w-4 text-primary" />
                {currentThread.clientName}
                {currentThread.opposingParty && (
                  <span className="text-muted-foreground font-normal text-xs sm:text-sm">ضد {currentThread.opposingParty}</span>
                )}
              </h2>
              <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                {currentThread.caseNumber && <span>ملف: {currentThread.caseNumber}</span>}
                {selectedCourt && (
                  <>
                    <span>• {selectedCourt.name}</span>
                    <span className="text-primary">← {selectedCourt.addressee}</span>
                  </>
                )}
                <Badge variant="outline" className="text-xs">{currentThread.docs.length} مستند</Badge>
              </div>
            </div>
          </div>
          {/* Client info badge */}
          {selectedClient && (
            <div className="text-xs text-muted-foreground bg-muted rounded-lg px-3 py-2 hidden sm:block">
              <div className="flex items-center gap-1"><User className="h-3 w-3" /> {selectedClient.full_name}</div>
              {selectedClient.cin && <div>CIN: {selectedClient.cin}</div>}
              {selectedClient.address && <div className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {selectedClient.address}</div>}
            </div>
          )}
        </div>

        {/* Thread archive (collapsible) */}
        {currentThread.docs.length > 0 && (
          <div className="border-b border-border">
            <button
              onClick={() => setExpandedThread(expandedThread ? null : 'current')}
              className="w-full flex items-center justify-between py-2 px-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <span className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4" />
                أرشيف المسطرة ({currentThread.docs.length} مستند)
              </span>
              {expandedThread ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {expandedThread && (
              <div className="px-3 pb-3 space-y-2 max-h-[200px] overflow-y-auto">
                {currentThread.docs.map((doc, i) => (
                  <div key={doc.id} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold shrink-0">
                        {doc.step_number || i + 1}
                      </span>
                      <span className="font-medium text-foreground truncate">{doc.doc_type}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {new Date(doc.created_at).toLocaleDateString('ar-MA')}
                      </span>
                      {doc.opponent_memo && <Badge variant="secondary" className="text-xs shrink-0">📨</Badge>}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setPreviewDoc(doc)}>
                        <Eye className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => exportWord(doc.content || '', doc.doc_type)}>
                        <Download className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Chat messages */}
        <ScrollArea className="flex-1 py-4">
          <div className="space-y-4 px-2">
            {chatMessages.length === 0 && (
              <div className="text-center py-8 sm:py-12 space-y-4">
                <Sparkles className="h-10 w-10 text-primary/30 mx-auto" />
                <div>
                  <p className="text-base font-medium text-foreground">مستعد لصياغة المستند</p>
                  <p className="text-xs text-muted-foreground mt-1">الموكل والمحكمة جاهزان. اكتب ما تريد:</p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center max-w-md mx-auto">
                  {[
                    'مقال افتتاحي بسبب عدم أداء الكراء',
                    'إنذار بالإفراغ',
                    'الخصم رد بمذكرة، أريد تعقيباً',
                    'مقال استئنافي ضد الحكم',
                  ].map((s, i) => (
                    <button
                      key={i}
                      onClick={() => setInputText(s)}
                      className="text-xs bg-muted hover:bg-accent text-foreground px-3 py-2 rounded-lg transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-[90%] sm:max-w-[85%] rounded-2xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-tl-sm'
                    : 'bg-muted text-foreground rounded-tr-sm'
                }`}>
                  {msg.role === 'assistant' ? (
                    <div className="space-y-2">
                      <div
                        dir="rtl"
                        className="whitespace-pre-wrap leading-7 sm:leading-8 text-sm"
                        style={{ fontFamily: "'Traditional Arabic', 'Amiri', serif" }}
                      >
                        {msg.content || (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" /> جاري الصياغة...
                          </div>
                        )}
                      </div>
                      {msg.content && !isStreaming && (
                        <div className="flex gap-2 pt-2 border-t border-border/50">
                          <Button
                            size="sm" variant="ghost"
                            className="text-xs h-7 gap-1"
                            onClick={() => saveDocument(msg.content, detectDocType(msg.content))}
                          >
                            <Save className="h-3 w-3" /> حفظ
                          </Button>
                          <Button
                            size="sm" variant="ghost"
                            className="text-xs h-7 gap-1"
                            onClick={() => exportWord(msg.content, detectDocType(msg.content))}
                          >
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
          <div className="flex flex-wrap gap-1 px-3 py-2 border-t border-border">
            {attachments.map((f, i) => (
              <Badge key={i} variant="secondary" className="gap-1 text-xs">
                {f.name}
                <button onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))}>
                  <Trash2 className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="border-t border-border pt-3">
          <div className="flex gap-2 items-end">
            <div className="flex-1 relative">
              <Textarea
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="اكتب طلبك... مثال: أريد مذكرة تعقيبية، الخصم ادعى أن..."
                className="min-h-[44px] max-h-[120px] resize-none pr-3 pl-12"
                rows={1}
                disabled={isStreaming}
              />
              <label className="absolute left-3 bottom-3 cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
                <FileUp className="h-5 w-5" />
                <input
                  type="file" multiple accept=".pdf,.doc,.docx" className="hidden"
                  onChange={e => { if (e.target.files) setAttachments(prev => [...prev, ...Array.from(e.target.files!)]); }}
                />
              </label>
            </div>
            <Button onClick={sendMessage} disabled={!inputText.trim() || isStreaming} size="icon" className="h-[44px] w-[44px] shrink-0">
              {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Preview Dialog */}
        <Dialog open={!!previewDoc} onOpenChange={() => setPreviewDoc(null)}>
          <DialogContent className="max-w-3xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>{previewDoc?.doc_type} - {previewDoc?.client_name}</DialogTitle>
            </DialogHeader>
            <ScrollArea className="h-[60vh]">
              {previewDoc?.opponent_memo && (
                <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3 mb-4 mx-4">
                  <p className="text-xs font-medium text-destructive mb-1">📨 مذكرة الخصم:</p>
                  <p className="text-sm whitespace-pre-wrap">{previewDoc.opponent_memo}</p>
                </div>
              )}
              <div dir="rtl" className="whitespace-pre-wrap leading-8 p-4" style={{ fontFamily: "'Traditional Arabic', 'Amiri', serif" }}>
                {previewDoc?.content}
              </div>
            </ScrollArea>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => previewDoc && exportWord(previewDoc.content || '', previewDoc.doc_type)}>
                <Download className="h-4 w-4 ml-2" /> تصدير Word
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ═══════════════════════ SELECTOR VIEW ═══════════════════════════════

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
          <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
          مولّد المستندات القانونية
        </h1>
        <p className="text-muted-foreground text-sm">حدد الموكل والمحكمة، ثم صِغ مستندك بالذكاء الاصطناعي</p>
      </div>

      {/* Phase 1: Quick Setup */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Plus className="h-5 w-5" /> إعداد المسطرة
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Client selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-1">
                <User className="h-4 w-4 text-primary" /> الموكل *
              </label>
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر الموكل..." />
                </SelectTrigger>
                <SelectContent>
                  {clients.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.full_name} {c.cin ? `(${c.cin})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* Auto-filled client info */}
              {selectedClient && (
                <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
                  {selectedClient.cin && <div>🪪 CIN: {selectedClient.cin}</div>}
                  {selectedClient.address && <div>📍 {selectedClient.address}</div>}
                  {selectedClient.phone && <div>📞 {selectedClient.phone}</div>}
                  {selectedClient.email && <div>✉️ {selectedClient.email}</div>}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">الخصم</label>
              <Input
                placeholder="اسم الخصم..."
                value={opposingParty}
                onChange={e => setOpposingParty(e.target.value)}
              />
            </div>
          </div>

          {/* Court selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground flex items-center gap-1">
              <Building2 className="h-4 w-4 text-primary" /> المحكمة
            </label>
            <div className="flex gap-2 flex-wrap mb-2">
              <Button
                size="sm" variant={!courtTypeFilter ? 'default' : 'outline'}
                onClick={() => setCourtTypeFilter('')}
                className="text-xs h-7"
              >
                الكل
              </Button>
              {courtTypes.map(t => (
                <Button
                  key={t} size="sm"
                  variant={courtTypeFilter === t ? 'default' : 'outline'}
                  onClick={() => setCourtTypeFilter(t)}
                  className="text-xs h-7"
                >
                  {t}
                </Button>
              ))}
            </div>
            <Select value={selectedCourtId} onValueChange={setSelectedCourtId}>
              <SelectTrigger>
                <SelectValue placeholder="اختر المحكمة..." />
              </SelectTrigger>
              <SelectContent>
                {filteredCourts.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Auto-filled court info */}
            {selectedCourt && (
              <div className="bg-accent/30 rounded-lg p-3 text-xs space-y-1">
                <div className="font-medium text-foreground">🏛️ {selectedCourt.addressee}</div>
                {selectedCourt.address && <div className="text-muted-foreground">📍 {selectedCourt.address}</div>}
              </div>
            )}
          </div>

          {/* Case link + number */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">ربط بقضية (اختياري)</label>
              <Select value={selectedCaseId} onValueChange={setSelectedCaseId}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر قضية..." />
                </SelectTrigger>
                <SelectContent>
                  {cases.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.case_number} - {c.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">رقم الملف</label>
              <Input
                placeholder="رقم الملف..."
                value={caseNumber}
                onChange={e => setCaseNumber(e.target.value)}
              />
            </div>
          </div>

          <Button onClick={startNewThread} className="gap-2 w-full sm:w-auto" size="lg">
            <MessageSquare className="h-4 w-4" /> ابدأ الصياغة بالذكاء الاصطناعي
          </Button>
        </CardContent>
      </Card>

      <Separator />

      {/* Archive */}
      <div>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-primary" /> أرشيف المساطر
          </h2>
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="بحث بالاسم أو رقم الملف..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pr-10 h-9"
            />
          </div>
        </div>

        {filteredThreads.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <FolderOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>لا توجد مساطر محفوظة</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredThreads.map(thread => (
              <Card
                key={thread.threadId}
                className="hover:border-primary/30 transition-colors cursor-pointer"
                onClick={() => openThread(thread)}
              >
                <CardContent className="py-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <User className="h-4 w-4 text-primary shrink-0" />
                        <span className="font-medium text-foreground">
                          {thread.clientName || 'بدون موكل'}
                          {thread.opposingParty && ` ضد ${thread.opposingParty}`}
                        </span>
                        <Badge variant="outline" className="text-xs">{thread.docs.length} مستند</Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        {thread.caseNumber && <span>ملف: {thread.caseNumber}</span>}
                        {thread.court && <span>• {thread.court}</span>}
                        <span>• {new Date(thread.lastDate).toLocaleDateString('ar-MA')}</span>
                      </div>
                      <div className="flex items-center gap-1 mt-2 flex-wrap">
                        {thread.docs.map((d, i) => (
                          <Badge key={d.id} variant="secondary" className="text-xs">
                            {(d.step_number || i + 1)}. {d.doc_type}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <Button size="sm" variant="outline" className="gap-1 shrink-0">
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
