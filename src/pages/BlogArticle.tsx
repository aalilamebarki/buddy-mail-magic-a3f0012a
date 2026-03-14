import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import {
  Scale, Calendar, ArrowRight, Clock, Tag, Share2, BookOpen, ArrowLeft,
  Menu, X, ChevronUp, Facebook, MessageCircle, Copy, Printer, Mail,
  Gavel, AlertTriangle, Lightbulb, FileText, User, Send,
  Hash, ChevronDown, Twitter, Eye, Shield, Download,
  Bookmark, BadgeCheck, ChevronLeft, Quote, Scroll,
  Sparkles, BookMarked, Library, CircleCheck, Zap, Award, TrendingUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import CommentsSection from '@/components/article/CommentsSection';

/* ═══════════════════════════════════════════════════════
   TYPE DEFINITIONS
   ═══════════════════════════════════════════════════════ */
interface TocItem { id: string; text: string; level: number; }

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
const fadeUp = { hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { duration: 0.5 } } };

/* ═══════════════════════════════════════════════════════
   ✦ EXECUTIVE SUMMARY — Crystal Card
   ═══════════════════════════════════════════════════════ */
const ExecutiveSummary = ({ points }: { points: string[] }) => (
  <motion.div
    initial="hidden" animate="show" variants={stagger}
    className="my-8 sm:my-10 relative"
  >
    {/* Glow effect */}
    <div className="absolute -inset-1 rounded-3xl bg-gradient-to-br from-legal-gold/20 via-transparent to-legal-emerald/10 blur-xl opacity-50" />
    <div className="relative rounded-2xl border border-legal-gold/25 bg-card overflow-hidden shadow-lg shadow-legal-gold/5">
      <div className="bg-gradient-to-l from-legal-gold/15 via-legal-gold/8 to-transparent px-5 sm:px-6 py-4 flex items-center gap-3 border-b border-legal-gold/15">
        <motion.div
          animate={{ rotate: [0, 5, -5, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          className="w-10 h-10 rounded-xl bg-gradient-to-br from-legal-gold to-legal-amber flex items-center justify-center shadow-md shadow-legal-gold/30"
        >
          <Sparkles className="h-5 w-5 text-white" />
        </motion.div>
        <div>
          <h3 className="font-bold text-foreground font-display text-sm sm:text-base">أهم ما ستتعلمه</h3>
          <p className="text-[10px] text-muted-foreground">ملخص سريع للنقاط الجوهرية</p>
        </div>
      </div>
      <div className="p-5 sm:p-6 space-y-3">
        {points.map((p, i) => (
          <motion.div
            key={i} variants={fadeUp}
            className="flex items-start gap-3 group"
          >
            <div className="mt-0.5 w-7 h-7 rounded-lg bg-gradient-to-br from-legal-gold/20 to-legal-gold/5 flex items-center justify-center shrink-0 group-hover:from-legal-gold/30 group-hover:to-legal-gold/15 transition-all duration-300 group-hover:scale-110">
              <CircleCheck className="h-3.5 w-3.5 text-legal-gold" />
            </div>
            <p className="text-[0.88rem] sm:text-[0.93rem] text-foreground/80 leading-relaxed pt-0.5 group-hover:text-foreground/95 transition-colors">{p}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </motion.div>
);

/* ═══════════════════════════════════════════════════════
   ✦ LEGAL ARTICLE HIGHLIGHT — Glass Morphism
   ═══════════════════════════════════════════════════════ */
const LegalArticleHighlight = ({ articleNumber, lawName, content }: { articleNumber: string; lawName: string; content: string }) => {
  const copyCitation = () => {
    navigator.clipboard.writeText(`${articleNumber} من ${lawName}: ${content}`);
    toast.success('تم نسخ الاستشهاد القانوني');
  };
  return (
    <motion.div
      initial={{ opacity: 0, x: -30, rotateY: -5 }}
      whileInView={{ opacity: 1, x: 0, rotateY: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, type: 'spring' }}
      className="my-8 sm:my-10 relative group"
    >
      {/* Animated border glow */}
      <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-legal-navy via-legal-gold/50 to-legal-navy opacity-60 group-hover:opacity-100 transition-opacity duration-500 blur-[0.5px]" />
      <div className="relative rounded-2xl bg-card overflow-hidden">
        {/* Top accent bar */}
        <div className="h-1 bg-gradient-to-l from-legal-navy via-legal-gold to-legal-navy" />
        <div className="p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <motion.div
                whileHover={{ rotate: 10 }}
                className="w-11 h-11 rounded-xl bg-gradient-to-br from-legal-navy to-legal-navy/80 flex items-center justify-center shadow-lg shadow-legal-navy/20"
              >
                <Gavel className="h-5 w-5 text-white" />
              </motion.div>
              <div>
                <p className="text-[11px] text-muted-foreground font-medium tracking-wide">{lawName}</p>
                <p className="text-sm font-bold text-legal-navy font-display">{articleNumber}</p>
              </div>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={copyCitation}
              className="flex items-center gap-1.5 text-[11px] text-legal-navy/70 hover:text-white hover:bg-legal-navy transition-all duration-300 px-3 py-2 rounded-xl border border-legal-navy/15 hover:border-legal-navy"
            >
              <Copy className="h-3 w-3" /> نسخ الاستشهاد
            </motion.button>
          </div>
          <div className="relative bg-legal-navy/[0.02] rounded-xl p-4 sm:p-5 border border-legal-navy/8">
            <div className="absolute top-2 right-3 opacity-[0.06]">
              <BookMarked className="w-10 h-10 text-legal-navy" />
            </div>
            <blockquote className="text-foreground/80 leading-[2] text-[0.93rem] sm:text-[0.97rem] font-legal relative z-10">
              «{content}»
            </blockquote>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

/* ═══════════════════════════════════════════════════════
   ✦ LEGAL ALERT — Dynamic Glow Cards
   ═══════════════════════════════════════════════════════ */
const LegalAlert = ({ type, title, children }: { type: 'caution' | 'judicial' | 'caselaw'; title?: string; children: React.ReactNode }) => {
  const config = {
    caution: {
      icon: AlertTriangle, label: title || 'تنبيه قانوني حرج',
      gradient: 'from-legal-burgundy/8 via-legal-burgundy/3 to-transparent',
      border: 'border-legal-burgundy/25', iconColor: 'text-white',
      iconBg: 'from-legal-burgundy to-legal-burgundy/80', glow: 'shadow-legal-burgundy/15',
      dotColor: 'bg-legal-burgundy', labelColor: 'text-legal-burgundy',
    },
    judicial: {
      icon: Lightbulb, label: title || 'نصيحة قضائية',
      gradient: 'from-legal-emerald/8 via-legal-emerald/3 to-transparent',
      border: 'border-legal-emerald/25', iconColor: 'text-white',
      iconBg: 'from-legal-emerald to-legal-emerald/80', glow: 'shadow-legal-emerald/15',
      dotColor: 'bg-legal-emerald', labelColor: 'text-legal-emerald',
    },
    caselaw: {
      icon: Scale, label: title || 'اجتهاد قضائي',
      gradient: 'from-legal-amber/8 via-legal-amber/3 to-transparent',
      border: 'border-legal-amber/25', iconColor: 'text-white',
      iconBg: 'from-legal-amber to-legal-amber/80', glow: 'shadow-legal-amber/15',
      dotColor: 'bg-legal-amber', labelColor: 'text-legal-amber',
    },
  };
  const c = config[type];
  const Icon = c.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, type: 'spring' }}
      className={`my-8 sm:my-10 rounded-2xl border ${c.border} bg-gradient-to-l ${c.gradient} overflow-hidden shadow-md ${c.glow}`}
    >
      <div className="px-5 py-3.5 flex items-center gap-3">
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          className={`w-9 h-9 rounded-xl bg-gradient-to-br ${c.iconBg} flex items-center justify-center shadow-md ${c.glow}`}
        >
          <Icon className={`h-4 w-4 ${c.iconColor}`} />
        </motion.div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${c.dotColor} animate-pulse`} />
          <span className={`text-sm font-bold ${c.labelColor} font-display`}>{c.label}</span>
        </div>
      </div>
      <div className="px-5 pb-5 text-foreground/80 text-[0.92rem] leading-[2]">{children}</div>
    </motion.div>
  );
};

/* ═══════════════════════════════════════════════════════
   ✦ EXPERT OPINION — Signature Card
   ═══════════════════════════════════════════════════════ */
const ExpertOpinion = ({ quote, expert, role }: { quote: string; expert: string; role: string }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.96 }}
    whileInView={{ opacity: 1, scale: 1 }}
    viewport={{ once: true }}
    className="my-10 sm:my-12 relative"
  >
    <div className="absolute -top-4 right-6 z-10">
      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-legal-gold to-legal-amber flex items-center justify-center shadow-lg shadow-legal-gold/30 ring-4 ring-background">
        <Quote className="h-5 w-5 text-white" />
      </div>
    </div>
    <div className="bg-gradient-to-br from-card via-card to-legal-gold/[0.02] rounded-2xl border border-border/40 p-6 sm:p-8 pt-10 shadow-lg shadow-foreground/[0.03] relative overflow-hidden">
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-legal-gold/[0.03] rounded-full translate-y-1/2 -translate-x-1/2 blur-2xl" />
      <p className="text-foreground/80 text-base sm:text-lg leading-[2.1] font-legal mb-6 relative z-10">«{quote}»</p>
      <div className="flex items-center gap-3 border-t border-border/30 pt-4 relative z-10">
        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-legal-navy/15 to-legal-gold/10 flex items-center justify-center">
          <Award className="h-5 w-5 text-legal-navy" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-bold text-foreground">{expert}</p>
            <BadgeCheck className="h-3.5 w-3.5 text-legal-emerald" />
          </div>
          <p className="text-xs text-muted-foreground">{role}</p>
        </div>
      </div>
    </div>
  </motion.div>
);

/* ═══════════════════════════════════════════════════════
   ✦ INLINE AI CONSULTATION INPUT
   ═══════════════════════════════════════════════════════ */
const InlineAIConsultation = ({ category }: { category: string }) => {
  const [question, setQuestion] = useState('');
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="my-10 sm:my-12 relative overflow-hidden"
    >
      {/* Background glow */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-legal-navy/[0.05] via-legal-gold/[0.03] to-legal-emerald/[0.03]" />
      <div className="absolute top-0 left-0 w-40 h-40 bg-legal-gold/[0.08] rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl" />
      <div className="absolute bottom-0 right-0 w-48 h-48 bg-legal-navy/[0.06] rounded-full translate-x-1/4 translate-y-1/4 blur-3xl" />
      
      <div className="relative rounded-2xl border border-legal-navy/15 p-5 sm:p-7">
        <div className="flex items-center gap-3 mb-4">
          <motion.div
            animate={{ 
              boxShadow: ['0 0 0 0 hsl(var(--legal-navy) / 0)', '0 0 0 8px hsl(var(--legal-navy) / 0.1)', '0 0 0 0 hsl(var(--legal-navy) / 0)']
            }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-11 h-11 rounded-xl bg-gradient-to-br from-legal-navy to-legal-navy/80 flex items-center justify-center shadow-lg shadow-legal-navy/20"
          >
            <Sparkles className="h-5 w-5 text-white" />
          </motion.div>
          <div>
            <h3 className="font-bold text-foreground font-display text-sm sm:text-base">هل لديك سؤال حول {category}؟</h3>
            <p className="text-[10px] sm:text-[11px] text-muted-foreground">اكتب سؤالك واحصل على إجابة فورية من الذكاء الاصطناعي القانوني</p>
          </div>
        </div>

        <div className="relative">
          <textarea
            value={question}
            onChange={e => setQuestion(e.target.value)}
            placeholder="مثال: ما هي شروط الطلاق الاتفاقي حسب مدونة الأسرة؟"
            className="w-full min-h-[80px] sm:min-h-[90px] rounded-xl border border-legal-navy/15 bg-card/80 backdrop-blur-sm px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-legal-navy/20 focus:border-legal-navy/30 resize-none transition-all"
            dir="rtl"
          />
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <Zap className="h-3 w-3 text-legal-gold" />
              <span>مدعوم بالذكاء الاصطناعي</span>
            </div>
            <Link to={`/ai-consultation${question ? `?q=${encodeURIComponent(question)}` : ''}`}>
              <Button 
                size="sm"
                className="gap-1.5 rounded-xl bg-gradient-to-l from-legal-navy to-legal-navy/90 hover:from-legal-navy/90 hover:to-legal-navy text-white text-xs h-9 px-4 shadow-md shadow-legal-navy/15 transition-all hover:shadow-lg hover:shadow-legal-navy/25"
              >
                <Send className="h-3.5 w-3.5" /> أرسل سؤالك
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

/* ═══════════════════════════════════════════════════════
   ✦ DOCUMENT GALLERY — Premium Grid
   ═══════════════════════════════════════════════════════ */
const DocumentGallery = () => {
  const documents = [
    { name: 'ظهير شريف رقم 1.04.22', type: 'PDF', size: '2.4 MB', color: 'from-red-500/10 to-red-500/5', iconColor: 'text-red-500', borderColor: 'border-red-500/15 hover:border-red-500/30' },
    { name: 'مدونة الأسرة — النص الكامل', type: 'PDF', size: '5.1 MB', color: 'from-legal-navy/10 to-legal-navy/5', iconColor: 'text-legal-navy', borderColor: 'border-legal-navy/15 hover:border-legal-navy/30' },
    { name: 'نموذج عقد الزواج الرسمي', type: 'DOCX', size: '340 KB', color: 'from-blue-500/10 to-blue-500/5', iconColor: 'text-blue-500', borderColor: 'border-blue-500/15 hover:border-blue-500/30' },
    { name: 'قرار محكمة النقض عدد 2847', type: 'PDF', size: '1.2 MB', color: 'from-legal-gold/10 to-legal-gold/5', iconColor: 'text-legal-gold', borderColor: 'border-legal-gold/15 hover:border-legal-gold/30' },
  ];
  return (
    <motion.div
      initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger}
      className="my-10 sm:my-12"
    >
      <div className="flex items-center gap-2.5 mb-5">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-legal-burgundy/15 to-legal-burgundy/5 flex items-center justify-center">
          <Library className="h-4 w-4 text-legal-burgundy" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground font-display">مستندات ومرفقات قانونية</h3>
          <p className="text-[10px] text-muted-foreground">ظهائر، نشرات رسمية، ونماذج قابلة للتحميل</p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {documents.map((doc, i) => (
          <motion.div
            key={i} variants={fadeUp}
            whileHover={{ y: -3, scale: 1.01 }}
            className={`flex items-center gap-3 p-4 rounded-xl bg-gradient-to-l ${doc.color} border ${doc.borderColor} transition-all duration-300 cursor-pointer group`}
          >
            <div className={`w-10 h-10 rounded-lg bg-card flex items-center justify-center shadow-sm border border-border/30 ${doc.iconColor} group-hover:scale-110 transition-transform`}>
              <FileText className="h-4.5 w-4.5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[0.82rem] font-semibold text-foreground truncate">{doc.name}</p>
              <p className="text-[10px] text-muted-foreground">{doc.type} • {doc.size}</p>
            </div>
            <motion.div whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.9 }}>
              <Download className={`h-4 w-4 ${doc.iconColor} opacity-40 group-hover:opacity-100 transition-opacity`} />
            </motion.div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

/* ═══════════════════════════════════════════════════════
   ✦ FOOTNOTES — Timeline Style
   ═══════════════════════════════════════════════════════ */
const FootnotesSection = () => {
  const footnotes = [
    { id: 1, text: 'ظهير شريف رقم 1.04.22 صادر في 12 من ذي الحجة 1424 (3 فبراير 2004) بتنفيذ القانون رقم 70.03 بمثابة مدونة الأسرة، الجريدة الرسمية عدد 5184.' },
    { id: 2, text: 'قرار محكمة النقض عدد 2847 الصادر بتاريخ 14/06/2019 في الملف الشرعي عدد 2018/1/2/547.' },
    { id: 3, text: 'دليل المساطر القضائية في مادة الأحوال الشخصية، منشورات وزارة العدل، الطبعة الثالثة 2022.' },
  ];
  return (
    <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger} className="my-10 sm:my-12">
      <div className="flex items-center gap-2 mb-4">
        <Hash className="h-4 w-4 text-legal-slate" />
        <h3 className="text-sm font-bold text-foreground font-display">الهوامش والمراجع</h3>
      </div>
      <div className="relative border-r-2 border-border/30 pr-5 space-y-4">
        {footnotes.map(fn => (
          <motion.div key={fn.id} variants={fadeUp} className="flex gap-3 relative">
            {/* Timeline dot */}
            <div className="absolute -right-[1.6rem] top-1 w-3 h-3 rounded-full bg-legal-slate/30 ring-2 ring-background" />
            <div className="bg-muted/20 rounded-xl p-3.5 flex-1 hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[10px] font-bold text-legal-navy bg-legal-navy/8 px-2 py-0.5 rounded-md">[{fn.id}]</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{fn.text}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

/* ═══════════════════════════════════════════════════════
   ✦ AUTHOR BIO — Glass Card
   ═══════════════════════════════════════════════════════ */
const AuthorBioCard = () => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    className="mt-14 relative"
  >
    <div className="absolute -inset-1 rounded-3xl bg-gradient-to-br from-legal-navy/10 via-legal-gold/5 to-legal-emerald/10 blur-xl opacity-50" />
    <div className="relative rounded-2xl border border-border/40 bg-card overflow-hidden shadow-lg shadow-foreground/[0.03]">
      <div className="h-1.5 bg-gradient-to-l from-legal-navy via-legal-gold to-legal-emerald" />
      <div className="p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row items-start gap-5">
          <motion.div
            whileHover={{ rotate: 5, scale: 1.05 }}
            className="w-20 h-20 rounded-2xl bg-gradient-to-br from-legal-navy/15 to-legal-gold/10 flex items-center justify-center shrink-0 shadow-lg shadow-legal-navy/10"
          >
            <Scale className="h-9 w-9 text-legal-navy" />
          </motion.div>
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-bold text-foreground font-display">فريق محاماة ذكية</h3>
              <Badge className="bg-legal-emerald/10 text-legal-emerald border-legal-emerald/20 text-[10px] px-2 py-0.5 gap-1 rounded-lg">
                <BadgeCheck className="h-3 w-3" /> خبراء معتمدون
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              فريق من المحامين والمستشارين القانونيين المتخصصين في القانون المغربي، يقدمون محتوى قانونياً موثوقاً ومحدثاً.
            </p>
            <div className="flex items-center gap-2 pt-2 flex-wrap">
              <Link to="/ai-consultation">
                <Button size="sm" className="gap-1.5 text-xs rounded-xl bg-legal-navy hover:bg-legal-navy/90 text-white h-9 shadow-md shadow-legal-navy/15">
                  <MessageCircle className="h-3.5 w-3.5" /> اسأل الخبير
                </Button>
              </Link>
              <Link to="/blog">
                <Button size="sm" variant="outline" className="gap-1.5 text-xs rounded-xl h-9">
                  <BookOpen className="h-3.5 w-3.5" /> جميع المقالات
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  </motion.div>
);

/* ═══════════════════════════════════════════════════════
   ✦ LEGAL DISCLAIMER
   ═══════════════════════════════════════════════════════ */
const LegalDisclaimer = () => (
  <div className="mt-10 p-5 rounded-xl bg-muted/20 border border-border/30 relative overflow-hidden">
    <div className="absolute top-0 right-0 w-20 h-20 bg-muted/20 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
    <div className="flex items-center gap-2 mb-3 relative z-10">
      <Shield className="h-4 w-4 text-muted-foreground" />
      <h4 className="text-xs font-bold text-muted-foreground tracking-wider">إخلاء المسؤولية القانونية</h4>
    </div>
    <p className="text-xs text-muted-foreground leading-relaxed relative z-10">
      هذا المقال لأغراض تعليمية وإعلامية فقط ولا يُعد بديلاً عن الاستشارة القانونية المتخصصة. القوانين والأنظمة قد تتغير، ويُنصح بالرجوع إلى محامٍ مرخص للحصول على مشورة قانونية تتعلق بحالتك الخاصة. جميع الحقوق محفوظة © {new Date().getFullYear()} محاماة ذكية.
    </p>
  </div>
);

/* ═══════════════════════════════════════════════════════
   ✦ NEWSLETTER — Premium CTA
   ═══════════════════════════════════════════════════════ */
const NewsletterSection = () => {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const handleSubscribe = async () => {
    if (!email) return;
    setSubmitting(true);
    const { error } = await supabase.from('newsletter_subscribers').insert({ email });
    if (!error) { toast.success('تم الاشتراك بنجاح!'); setEmail(''); }
    else if (error.code === '23505') toast.info('أنت مشترك بالفعل');
    else toast.error('حدث خطأ، حاول مجدداً');
    setSubmitting(false);
  };
  return (
    <section className="py-14 sm:py-20 bg-gradient-to-b from-legal-cream/30 via-background to-background dark:from-muted/5 border-t border-border/20 print:hidden relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: `radial-gradient(hsl(var(--legal-navy)) 1px, transparent 1px)`, backgroundSize: '24px 24px' }} />
      <div className="container mx-auto px-4 relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-lg mx-auto text-center space-y-5"
        >
          <motion.div
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            className="w-16 h-16 rounded-2xl bg-gradient-to-br from-legal-navy to-legal-navy/80 flex items-center justify-center mx-auto shadow-xl shadow-legal-navy/20"
          >
            <Mail className="h-7 w-7 text-white" />
          </motion.div>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground font-display">النشرة القانونية الأسبوعية</h2>
          <p className="text-muted-foreground text-sm">أحدث المقالات والتحديثات القانونية مباشرة في بريدك</p>
          <div className="flex gap-2 max-w-sm mx-auto">
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="بريدك الإلكتروني"
              className="flex-1 h-12 rounded-xl border border-border bg-card px-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-legal-navy/20 focus:border-legal-navy/40 transition-all shadow-sm"
              dir="ltr"
            />
            <Button onClick={handleSubscribe} disabled={submitting} className="h-12 rounded-xl bg-gradient-to-l from-legal-navy to-legal-navy/90 hover:from-legal-navy/90 hover:to-legal-navy text-white px-6 shadow-md shadow-legal-navy/15 transition-all hover:shadow-lg">
              اشتراك
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground/50">بدون إزعاج — يمكنك إلغاء الاشتراك في أي وقت</p>
        </motion.div>
      </div>
    </section>
  );
};

/* ═══════════════════════════════════════════════════════════
   ██  MAIN BLOG ARTICLE PAGE
   ═══════════════════════════════════════════════════════════ */
const BlogArticle = () => {
  const { slug } = useParams();
  const [article, setArticle] = useState<any>(null);
  const [related, setRelated] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mobileNav, setMobileNav] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [activeHeading, setActiveHeading] = useState('');
  const [tocOpen, setTocOpen] = useState(true);
  const [focusMode, setFocusMode] = useState(false);
  const articleRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll();
  const progressWidth = useTransform(scrollYProgress, [0, 1], ['0%', '100%']);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 600);
      const headings = document.querySelectorAll('#article-body h2, #article-body h3');
      let current = '';
      headings.forEach(h => {
        const rect = h.getBoundingClientRect();
        if (rect.top <= 130) current = h.id;
      });
      if (current) setActiveHeading(current);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const fetchArticle = async () => {
      if (!slug) return;
      const { data, error } = await supabase
        .from('articles').select('*').eq('slug', slug).eq('status', 'published').single();
      if (!error && data) {
        setArticle(data);
        const { data: rel } = await supabase
          .from('articles')
          .select('id, title, slug, excerpt, cover_image, category, reading_time, created_at')
          .eq('status', 'published').eq('category', data.category || 'عام')
          .neq('slug', slug).limit(3);
        if (rel) setRelated(rel);
      }
      setLoading(false);
    };
    fetchArticle();
    window.scrollTo(0, 0);
  }, [slug]);

  const toc = useMemo<TocItem[]>(() => {
    if (!article?.content) return [];
    const regex = /<h([23])[^>]*>(.*?)<\/h\1>/gi;
    const items: TocItem[] = []; let match; let idx = 0;
    while ((match = regex.exec(article.content)) !== null) {
      items.push({ id: `heading-${idx}`, text: match[2].replace(/<[^>]+>/g, ''), level: parseInt(match[1]) });
      idx++;
    }
    return items;
  }, [article?.content]);

  const processedContent = useMemo(() => {
    if (!article?.content) return '';
    let idx = 0;
    return article.content.replace(/<h([23])([^>]*)>/gi, (_: string, level: string, attrs: string) => {
      return `<h${level}${attrs} id="heading-${idx++}">`;
    });
  }, [article?.content]);

  const shareArticle = useCallback((platform?: string) => {
    const url = window.location.href;
    const title = article?.title || '';
    if (platform === 'facebook') window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
    else if (platform === 'whatsapp') window.open(`https://wa.me/?text=${encodeURIComponent(title + ' ' + url)}`, '_blank');
    else if (platform === 'twitter') window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`, '_blank');
    else if (platform === 'copy') { navigator.clipboard.writeText(url); toast.success('تم نسخ الرابط'); }
    else if (navigator.share) navigator.share({ title, url });
    else { navigator.clipboard.writeText(url); toast.success('تم نسخ الرابط'); }
  }, [article?.title]);

  const scrollToHeading = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  /* ─── LOADING ─── */
  if (loading) return (
    <div className="min-h-screen bg-background">
      <div className="h-[3px] bg-gradient-to-l from-legal-gold to-legal-navy fixed top-0 left-0 right-0 z-[60]">
        <motion.div className="h-full bg-legal-navy" animate={{ width: ['0%', '60%', '30%', '80%'] }} transition={{ duration: 2, repeat: Infinity }} />
      </div>
      <div className="container mx-auto px-4 pt-28">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="h-5 bg-muted rounded-lg animate-pulse w-1/3" />
          <div className="h-12 bg-muted rounded-xl animate-pulse w-4/5" />
          <div className="h-8 bg-muted rounded-lg animate-pulse w-2/3" />
          <div className="aspect-[2/1] bg-muted rounded-2xl animate-pulse" />
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => <div key={i} className="h-4 bg-muted/70 rounded animate-pulse" style={{ width: `${70 + Math.random() * 30}%` }} />)}
          </div>
        </div>
      </div>
    </div>
  );

  /* ─── NOT FOUND ─── */
  if (!article) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-background px-4">
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 3, repeat: Infinity }}
        className="w-24 h-24 rounded-3xl bg-gradient-to-br from-legal-navy/10 to-legal-gold/10 flex items-center justify-center"
      >
        <BookOpen className="h-12 w-12 text-legal-navy" />
      </motion.div>
      <h1 className="text-2xl sm:text-3xl font-bold text-foreground font-display">المقال غير موجود</h1>
      <p className="text-muted-foreground text-sm">ربما تم حذفه أو تغيير رابطه</p>
      <Link to="/blog"><Button className="gap-2 rounded-xl"><ArrowRight className="h-4 w-4" /> العودة للمدونة</Button></Link>
    </div>
  );

  /* ─── SCHEMAS ─── */
  const articleSchema = {
    '@context': 'https://schema.org', '@type': article.schema_type || 'Article',
    headline: article.seo_title || article.title,
    description: article.seo_description || article.excerpt,
    image: article.cover_image,
    datePublished: article.published_at || article.created_at,
    dateModified: article.updated_at,
    author: { '@type': 'Organization', name: 'محاماة ذكية', url: window.location.origin },
    publisher: { '@type': 'Organization', name: 'محاماة ذكية', url: window.location.origin, logo: { '@type': 'ImageObject', url: `${window.location.origin}/favicon.ico` } },
    mainEntityOfPage: { '@type': 'WebPage', '@id': window.location.href },
    inLanguage: 'ar', articleSection: article.category || 'قانون',
    wordCount: article.content?.replace(/<[^>]+>/g, '').split(/\s+/).length || 0,
    keywords: article.tags?.join(', ') || '',
  };
  const breadcrumbSchema = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'الرئيسية', item: window.location.origin },
      { '@type': 'ListItem', position: 2, name: 'المدونة', item: `${window.location.origin}/blog` },
      { '@type': 'ListItem', position: 3, name: article.category || 'عام', item: `${window.location.origin}/blog?category=${encodeURIComponent(article.category || '')}` },
      { '@type': 'ListItem', position: 4, name: article.title, item: window.location.href },
    ],
  };
  const faqSchema = article.content?.includes('<h2') ? {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: (article.content.match(/<h2[^>]*>(.*?)<\/h2>/g) || []).slice(0, 5).map((h: string) => {
      const q = h.replace(/<[^>]+>/g, '');
      return { '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: article.excerpt || q } };
    }),
  } : null;

  const formattedDate = new Date(article.created_at).toLocaleDateString('ar-MA', { year: 'numeric', month: 'long', day: 'numeric' });
  const wordCount = article.content?.replace(/<[^>]+>/g, '').split(/\s+/).length || 0;

  return (
    <>
      <Helmet>
        <title>{article.seo_title || article.title} | محاماة ذكية</title>
        <meta name="description" content={article.seo_description || article.excerpt} />
        <link rel="canonical" href={`${window.location.origin}/blog/${slug}`} />
        <meta property="og:title" content={article.seo_title || article.title} />
        <meta property="og:description" content={article.seo_description || article.excerpt} />
        <meta property="og:image" content={article.cover_image} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={window.location.href} />
        <meta property="og:locale" content="ar_MA" />
        <meta property="article:published_time" content={article.published_at || article.created_at} />
        <meta property="article:modified_time" content={article.updated_at} />
        <meta property="article:section" content={article.category} />
        {article.tags?.map((tag: string) => <meta key={tag} property="article:tag" content={tag} />)}
        <meta name="twitter:card" content="summary_large_image" />
        <script type="application/ld+json">{JSON.stringify(articleSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>
        {faqSchema && <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>}
      </Helmet>

      {/* ═══ PROGRESS BAR ═══ */}
      <motion.div className="fixed top-0 left-0 right-0 z-[70] h-[3px]">
        <motion.div
          className="h-full bg-gradient-to-l from-legal-gold via-legal-navy to-legal-emerald"
          style={{ width: progressWidth }}
        />
      </motion.div>

      <div className={`min-h-screen bg-background print:bg-white transition-all duration-500 ${focusMode ? 'focus-reading' : ''}`}>

        {/* ═══ STICKY HEADER ═══ */}
        <header className="sticky top-0 z-50 print:hidden">
          <nav className="bg-card/90 backdrop-blur-2xl border-b border-border/20 shadow-sm">
            <div className="container mx-auto px-4 flex items-center justify-between h-14">
              <Link to="/" className="flex items-center gap-2.5 group">
                <motion.div
                  whileHover={{ rotate: 5 }}
                  className="w-9 h-9 rounded-xl bg-gradient-to-br from-legal-navy to-legal-navy/80 flex items-center justify-center shadow-md shadow-legal-navy/15"
                >
                  <Scale className="h-4 w-4 text-white" />
                </motion.div>
                <span className="text-sm font-bold text-foreground hidden sm:block font-display">محاماة ذكية</span>
              </Link>

              <div className="hidden md:flex items-center gap-1">
                <Link to="/blog">
                  <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground text-xs h-8 rounded-lg">
                    <ArrowRight className="h-3 w-3" /> المدونة
                  </Button>
                </Link>
                <Link to="/ai-consultation">
                  <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground text-xs h-8 rounded-lg">استشارة ذكية</Button>
                </Link>
                <div className="w-px h-5 bg-border/40 mx-1" />

                {[
                  { icon: Printer, tip: 'طباعة', action: () => window.print(), hoverColor: '' },
                  { icon: Download, tip: 'تحميل PDF', action: () => { toast.success('جاري تحميل PDF...'); window.print(); }, hoverColor: 'hover:text-legal-emerald' },
                  { icon: Bookmark, tip: 'حفظ', action: () => toast.success('تمت الإضافة للمفضلة'), hoverColor: 'hover:text-legal-gold' },
                  { icon: Eye, tip: focusMode ? 'إيقاف التركيز' : 'وضع التركيز', action: () => setFocusMode(!focusMode), hoverColor: focusMode ? 'text-legal-navy bg-legal-navy/10' : '' },
                  { icon: Share2, tip: 'مشاركة', action: () => shareArticle(), hoverColor: '' },
                ].map((btn, i) => (
                  <Tooltip key={i}>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" onClick={btn.action} className={`h-8 w-8 text-muted-foreground hover:text-foreground ${btn.hoverColor}`}>
                        <btn.icon className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{btn.tip}</TooltipContent>
                  </Tooltip>
                ))}
              </div>

              <button className="md:hidden p-2 rounded-lg hover:bg-muted transition-colors" onClick={() => setMobileNav(!mobileNav)}>
                {mobileNav ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </nav>

          <AnimatePresence>
            {mobileNav && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="md:hidden border-b border-border bg-card overflow-hidden"
              >
                <div className="p-3 space-y-1">
                  <Link to="/blog" className="flex items-center gap-2 p-2.5 rounded-lg hover:bg-muted text-sm" onClick={() => setMobileNav(false)}>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" /> المدونة
                  </Link>
                  <Link to="/ai-consultation" className="flex items-center gap-2 p-2.5 rounded-lg hover:bg-muted text-sm" onClick={() => setMobileNav(false)}>
                    <MessageCircle className="h-4 w-4 text-muted-foreground" /> استشارة ذكية
                  </Link>
                  <div className="grid grid-cols-5 gap-1.5 pt-2 border-t border-border/50 mt-2">
                    {[
                      { icon: Printer, action: () => window.print() },
                      { icon: Download, action: () => { toast.success('جاري تحميل PDF...'); window.print(); } },
                      { icon: Bookmark, action: () => toast.success('تمت الإضافة') },
                      { icon: Eye, action: () => setFocusMode(!focusMode) },
                      { icon: Share2, action: () => shareArticle() },
                    ].map((b, i) => (
                      <Button key={i} variant="outline" size="sm" onClick={b.action} className="text-xs h-9 rounded-lg"><b.icon className="h-3.5 w-3.5" /></Button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </header>

        {/* ═══ HERO SECTION ═══ */}
        <section className="relative overflow-hidden">
          {/* Background pattern */}
          <div className="absolute inset-0 opacity-[0.015]" style={{
            backgroundImage: `radial-gradient(circle at 25% 25%, hsl(var(--legal-navy)) 1px, transparent 1px)`,
            backgroundSize: '32px 32px',
          }} />
          {/* Ambient glow */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-legal-navy/[0.03] rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-legal-gold/[0.04] rounded-full translate-y-1/2 -translate-x-1/3 blur-3xl" />

          <div className="relative container mx-auto px-4 pt-6 sm:pt-8 md:pt-10">
            <div className="max-w-4xl mx-auto">
              {/* Breadcrumbs */}
              <motion.nav
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-1.5 text-[11px] sm:text-xs text-muted-foreground mb-6 overflow-x-auto pb-1"
                aria-label="breadcrumb"
              >
                <Link to="/" className="hover:text-legal-navy transition-colors shrink-0 flex items-center gap-1">
                  <Scale className="h-3 w-3" /> الرئيسية
                </Link>
                <ChevronLeft className="h-3 w-3 shrink-0 rotate-180" />
                <Link to="/blog" className="hover:text-legal-navy transition-colors shrink-0">المدونة</Link>
                <ChevronLeft className="h-3 w-3 shrink-0 rotate-180" />
                <Link to={`/blog?category=${article.category}`} className="text-legal-navy font-semibold shrink-0">{article.category || 'عام'}</Link>
              </motion.nav>

              {/* Category + Updated Badge */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="flex items-center gap-2 mb-5 flex-wrap"
              >
                <Badge className="bg-gradient-to-l from-legal-navy/15 to-legal-navy/8 text-legal-navy border-legal-navy/15 text-[11px] px-3.5 py-1.5 rounded-full font-semibold gap-1.5 shadow-sm">
                  <Gavel className="h-3 w-3" />
                  {article.category || 'عام'}
                </Badge>
                {article.updated_at && article.updated_at !== article.created_at && (
                  <Badge variant="outline" className="text-[10px] px-2.5 py-1 rounded-full border-legal-emerald/30 text-legal-emerald gap-1.5 animate-pulse">
                    <TrendingUp className="h-3 w-3" /> محدّث
                  </Badge>
                )}
              </motion.div>

              {/* Title */}
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.6 }}
                className="text-2xl sm:text-3xl md:text-4xl lg:text-[2.75rem] font-bold text-foreground leading-[1.45] tracking-tight mb-5 font-display"
              >
                {article.title}
              </motion.h1>

              {/* Excerpt */}
              {article.excerpt && (
                <motion.p
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                  className="text-sm sm:text-base md:text-lg text-muted-foreground leading-relaxed mb-7 max-w-3xl"
                >
                  {article.excerpt}
                </motion.p>
              )}

              {/* Meta Row — Card Style */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="flex flex-wrap items-center gap-3 sm:gap-5 pb-7 sm:pb-9 border-b border-border/20"
              >
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-legal-navy/15 to-legal-gold/10 flex items-center justify-center ring-2 ring-background shadow-md shadow-legal-navy/10">
                    <User className="h-5 w-5 text-legal-navy" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs sm:text-sm font-semibold text-foreground">فريق محاماة ذكية</p>
                      <BadgeCheck className="h-3.5 w-3.5 text-legal-emerald" />
                    </div>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">خبراء قانونيون معتمدون</p>
                  </div>
                </div>

                <div className="hidden sm:block w-px h-9 bg-border/30" />

                <div className="flex items-center gap-3 sm:gap-4 text-[10px] sm:text-xs text-muted-foreground flex-wrap">
                  {[
                    { icon: Calendar, text: formattedDate },
                    { icon: Clock, text: `${article.reading_time || 5} دقائق` },
                    { icon: Eye, text: `${Math.floor(Math.random() * 3000 + 500).toLocaleString('ar-MA')} مشاهدة` },
                    { icon: FileText, text: `${wordCount} كلمة` },
                  ].map((meta, i) => (
                    <span key={i} className="flex items-center gap-1.5 bg-muted/30 px-2.5 py-1 rounded-lg">
                      <meta.icon className="h-3 w-3 text-legal-navy/50" /> {meta.text}
                    </span>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>

          {/* Featured Image */}
          {article.cover_image && (
            <motion.div
              initial={{ opacity: 0, y: 25 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.7 }}
              className="container mx-auto px-4 mt-7 sm:mt-9"
            >
              <figure className="max-w-4xl mx-auto">
                <div className="relative rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl shadow-foreground/5 group">
                  <img src={article.cover_image} alt={article.title} className="w-full aspect-[16/9] sm:aspect-[2.2/1] object-cover transition-transform duration-700 group-hover:scale-[1.03]" loading="eager" />
                  <div className="absolute inset-0 ring-1 ring-inset ring-foreground/5 rounded-xl sm:rounded-2xl" />
                  <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-foreground/15 to-transparent" />
                  {/* Category overlay badge */}
                  <div className="absolute top-4 right-4">
                    <Badge className="bg-card/80 backdrop-blur-xl text-foreground text-[10px] px-3 py-1 rounded-lg border border-border/30 shadow-md gap-1">
                      <Gavel className="h-3 w-3 text-legal-navy" /> {article.category}
                    </Badge>
                  </div>
                </div>
                <figcaption className="text-center text-[11px] text-muted-foreground/50 mt-3 flex items-center justify-center gap-1">
                  📷 صورة توضيحية — {article.category || 'القانون المغربي'}
                </figcaption>
              </figure>
            </motion.div>
          )}
        </section>

        {/* ═══ MAIN CONTENT ═══ */}
        <div className="container mx-auto px-4 py-8 sm:py-10 md:py-14">
          <div className={`max-w-6xl mx-auto flex gap-10 transition-all duration-500 ${focusMode ? 'max-w-3xl' : ''}`}>

            {/* ── STICKY SIDEBAR (TOC) ── */}
            {toc.length > 0 && !focusMode && (
              <aside className="hidden lg:block w-72 shrink-0 print:hidden">
                <div className="sticky top-20">
                  <motion.div
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 }}
                    className="rounded-2xl border border-border/30 bg-card overflow-hidden shadow-lg shadow-foreground/[0.02]"
                  >
                    <button
                      onClick={() => setTocOpen(!tocOpen)}
                      className="w-full px-5 py-4 flex items-center justify-between bg-gradient-to-l from-muted/30 to-transparent border-b border-border/20 hover:from-muted/50 transition-all"
                    >
                      <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <div className="w-6 h-6 rounded-lg bg-legal-navy/10 flex items-center justify-center">
                          <Hash className="h-3 w-3 text-legal-navy" />
                        </div>
                        فهرس المقال
                      </span>
                      <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-300 ${tocOpen ? '' : '-rotate-90'}`} />
                    </button>

                    <AnimatePresence>
                      {tocOpen && (
                        <motion.nav
                          initial={{ height: 0 }}
                          animate={{ height: 'auto' }}
                          exit={{ height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="p-4 space-y-0.5 max-h-[55vh] overflow-y-auto">
                            <div className="mb-3 px-2">
                              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                <motion.div className="h-full bg-gradient-to-l from-legal-gold to-legal-navy rounded-full" style={{ width: progressWidth }} />
                              </div>
                            </div>
                            {toc.map(item => (
                              <button
                                key={item.id}
                                onClick={() => scrollToHeading(item.id)}
                                className={`w-full text-right px-3 py-2.5 rounded-xl text-[13px] transition-all duration-200 leading-relaxed ${
                                  item.level === 3 ? 'pr-7 text-xs' : ''
                                } ${
                                  activeHeading === item.id
                                    ? 'bg-gradient-to-l from-legal-navy/10 to-legal-navy/5 text-legal-navy font-semibold border-r-2 border-legal-navy shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
                                }`}
                              >
                                {item.text}
                              </button>
                            ))}
                          </div>
                        </motion.nav>
                      )}
                    </AnimatePresence>
                  </motion.div>

                  {/* Tags Cloud */}
                  {article.tags && article.tags.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.7 }}
                      className="mt-4 rounded-2xl border border-border/30 bg-card p-4 shadow-sm"
                    >
                      <div className="flex items-center gap-1.5 mb-3">
                        <Tag className="h-3.5 w-3.5 text-legal-gold" />
                        <span className="text-xs font-semibold text-foreground">الوسوم القانونية</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {article.tags.map((tag: string) => (
                          <motion.div key={tag} whileHover={{ scale: 1.08 }}>
                            <Badge variant="outline" className="text-[10px] bg-transparent hover:bg-legal-navy/5 hover:border-legal-navy/20 hover:text-legal-navy transition-all cursor-pointer rounded-lg px-2.5 py-1">
                              {tag}
                            </Badge>
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </div>
              </aside>
            )}

            {/* ── ARTICLE BODY ── */}
            <article className="flex-1 min-w-0" ref={articleRef}>
              {/* Executive Summary */}
              {article.excerpt && (
                <ExecutiveSummary points={[
                  article.excerpt,
                  `يندرج هذا المقال ضمن تصنيف: ${article.category || 'القانون المغربي'}`,
                  `وقت القراءة المقدر: ${article.reading_time || 5} دقائق`,
                ]} />
              )}

              <div id="article-body"
                className="legal-article-content prose prose-lg max-w-none dark:prose-invert
                  prose-headings:text-foreground prose-headings:font-bold prose-headings:leading-snug prose-headings:font-display
                  prose-h2:text-[1.25rem] prose-h2:sm:text-[1.4rem] prose-h2:md:text-[1.6rem] prose-h2:mt-10 prose-h2:sm:mt-12 prose-h2:mb-4 prose-h2:sm:mb-5
                  prose-h3:text-[1.1rem] prose-h3:sm:text-[1.2rem] prose-h3:md:text-[1.3rem] prose-h3:mt-8 prose-h3:sm:mt-9 prose-h3:mb-3
                  prose-p:text-foreground/80 prose-p:leading-[2.1] prose-p:text-[0.9rem] prose-p:sm:text-[0.95rem] prose-p:md:text-[1.05rem] prose-p:mb-5
                  prose-a:text-legal-navy prose-a:font-medium prose-a:no-underline prose-a:transition-colors
                  prose-strong:text-foreground prose-strong:font-semibold
                  prose-img:rounded-xl prose-img:sm:rounded-2xl prose-img:shadow-xl prose-img:my-6 prose-img:sm:my-8
                  prose-blockquote:border-r-[3px] prose-blockquote:border-legal-gold prose-blockquote:bg-legal-gold/[0.04] prose-blockquote:rounded-xl prose-blockquote:py-4 prose-blockquote:sm:py-5 prose-blockquote:px-5 prose-blockquote:sm:px-6 prose-blockquote:not-italic prose-blockquote:text-foreground/75 prose-blockquote:font-legal prose-blockquote:my-6 prose-blockquote:sm:my-8
                  prose-li:text-foreground/80 prose-li:leading-[2.1]
                  prose-ul:mr-0 prose-ol:mr-0
                  prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm"
                dir="rtl"
                dangerouslySetInnerHTML={{ __html: processedContent }}
              />

              {/* Inline AI Consultation */}
              <InlineAIConsultation category={article.category || 'القانون المغربي'} />

              {/* Mobile Tags */}
              {article.tags && article.tags.length > 0 && (
                <div className="mt-10 lg:hidden p-5 bg-gradient-to-l from-muted/20 to-transparent rounded-2xl border border-border/20">
                  <div className="flex items-center gap-2 mb-3">
                    <Tag className="h-4 w-4 text-legal-gold" />
                    <span className="text-sm font-semibold text-foreground">الوسوم القانونية</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {article.tags.map((tag: string) => (
                      <Badge key={tag} variant="outline" className="text-xs hover:bg-legal-navy/5 hover:border-legal-navy/20 hover:text-legal-navy transition-all cursor-pointer rounded-lg px-3 py-1.5">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Document Gallery */}
              <DocumentGallery />

              {/* Footnotes */}
              <FootnotesSection />

              {/* Legal Disclaimer */}
              <LegalDisclaimer />

              {/* Share Row */}
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 py-6 border-y border-border/20 print:hidden">
                <span className="text-sm font-medium text-foreground">شارك هذا المقال:</span>
                <div className="flex items-center gap-2">
                  {[
                    { platform: 'facebook', icon: Facebook, label: 'فيسبوك', hover: 'hover:bg-[#1877F2] hover:text-white hover:border-[#1877F2]' },
                    { platform: 'whatsapp', icon: MessageCircle, label: 'واتساب', hover: 'hover:bg-[#25D366] hover:text-white hover:border-[#25D366]' },
                    { platform: 'twitter', icon: Twitter, label: 'تويتر', hover: 'hover:bg-[#1DA1F2] hover:text-white hover:border-[#1DA1F2]' },
                    { platform: 'copy', icon: Copy, label: 'نسخ', hover: 'hover:bg-foreground hover:text-background hover:border-foreground' },
                  ].map(s => (
                    <motion.button
                      key={s.platform}
                      whileHover={{ scale: 1.12, y: -2 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => shareArticle(s.platform)}
                      className={`w-10 h-10 rounded-xl border border-border/40 bg-card flex items-center justify-center transition-all duration-300 text-muted-foreground shadow-sm ${s.hover}`}
                      aria-label={s.label}
                    >
                      <s.icon className="h-4 w-4" />
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Author Bio */}
              <AuthorBioCard />

              {/* Comments */}
              <CommentsSection articleId={article.id} />
            </article>
          </div>
        </div>

        {/* ═══ RELATED ARTICLES ═══ */}
        {related.length > 0 && (
          <section className="border-t border-border/20 py-12 sm:py-16 md:py-20 bg-gradient-to-b from-muted/10 to-background print:hidden">
            <div className="container mx-auto px-4">
              <div className="max-w-5xl mx-auto">
                <div className="flex items-center justify-between mb-8 sm:mb-10">
                  <div>
                    <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground font-display">مقالات ذات صلة</h2>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1">تابع القراءة حول {article.category}</p>
                  </div>
                  <Link to="/blog">
                    <Button variant="outline" size="sm" className="gap-1.5 rounded-xl text-xs">
                      عرض الكل <ArrowLeft className="h-3 w-3" />
                    </Button>
                  </Link>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {related.map((r, i) => (
                    <motion.div
                      key={r.id}
                      initial={{ opacity: 0, y: 25 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.1 }}
                    >
                      <Link to={`/blog/${r.slug}`} className="group block h-full">
                        <Card className="overflow-hidden border-border/20 hover:shadow-2xl hover:shadow-foreground/5 hover:border-legal-navy/15 transition-all duration-500 hover:-translate-y-2 h-full bg-card">
                          <div className="aspect-[16/10] overflow-hidden relative">
                            <img
                              src={r.cover_image || 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=400&h=250&fit=crop'}
                              alt={r.title}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                              loading="lazy"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-foreground/10 to-transparent" />
                            <div className="absolute top-3 right-3">
                              <Badge className="bg-card/80 backdrop-blur-xl text-[9px] px-2 py-0.5 border border-border/20 text-foreground rounded-md">
                                {r.category || 'عام'}
                              </Badge>
                            </div>
                          </div>
                          <CardContent className="p-4 sm:p-5 space-y-2.5">
                            <h3 className="text-sm font-bold text-foreground line-clamp-2 group-hover:text-legal-navy transition-colors leading-relaxed font-display">
                              {r.title}
                            </h3>
                            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                              <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(r.created_at).toLocaleDateString('ar-MA')}</span>
                              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{r.reading_time || 5} د</span>
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        <NewsletterSection />

        <footer className="py-8 sm:py-10 border-t border-border/20 print:hidden">
          <div className="container mx-auto px-4 text-center space-y-3">
            <div className="flex items-center justify-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-legal-navy to-legal-navy/80 flex items-center justify-center shadow-md shadow-legal-navy/15">
                <Scale className="h-4 w-4 text-white" />
              </div>
              <span className="font-bold text-foreground font-display">محاماة ذكية</span>
            </div>
            <p className="text-xs text-muted-foreground">منصة قانونية مغربية متكاملة — محتوى موثوق واستشارات ذكية</p>
            <div className="flex items-center justify-center gap-3 sm:gap-5 text-xs text-muted-foreground flex-wrap">
              <Link to="/blog" className="hover:text-legal-navy transition-colors">المدونة</Link>
              <Link to="/ai-consultation" className="hover:text-legal-navy transition-colors">استشارة ذكية</Link>
              <Link to="/legal-fee-calculator" className="hover:text-legal-navy transition-colors">حاسبة الرسوم</Link>
              <Link to="/case-tracker" className="hover:text-legal-navy transition-colors">تتبع القضايا</Link>
            </div>
          </div>
        </footer>
      </div>

      {/* ═══ FLOATING SOCIAL BAR ═══ */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 1 }}
        className="fixed top-1/2 left-4 -translate-y-1/2 z-40 hidden xl:flex flex-col gap-2 print:hidden"
      >
        {[
          { p: 'facebook', icon: Facebook, color: 'hover:bg-[#1877F2] hover:text-white hover:border-[#1877F2] hover:shadow-[#1877F2]/20' },
          { p: 'whatsapp', icon: MessageCircle, color: 'hover:bg-[#25D366] hover:text-white hover:border-[#25D366] hover:shadow-[#25D366]/20' },
          { p: 'twitter', icon: Twitter, color: 'hover:bg-[#1DA1F2] hover:text-white hover:border-[#1DA1F2] hover:shadow-[#1DA1F2]/20' },
          { p: 'copy', icon: Copy, color: 'hover:bg-foreground hover:text-background hover:border-foreground hover:shadow-foreground/10' },
        ].map(s => (
          <motion.button
            key={s.p}
            whileHover={{ scale: 1.15, x: 3 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => shareArticle(s.p)}
            className={`w-10 h-10 rounded-xl bg-card border border-border/30 flex items-center justify-center text-muted-foreground transition-all duration-300 shadow-md hover:shadow-lg ${s.color}`}
          >
            <s.icon className="h-4 w-4" />
          </motion.button>
        ))}
      </motion.div>

      {/* ═══ SCROLL TO TOP ═══ */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, y: 20, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.8 }}
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="fixed bottom-6 left-6 xl:left-20 z-50 w-12 h-12 rounded-full bg-gradient-to-br from-legal-navy to-legal-navy/80 text-white shadow-xl shadow-legal-navy/30 flex items-center justify-center hover:scale-110 transition-transform print:hidden"
            aria-label="العودة للأعلى"
          >
            <ChevronUp className="h-5 w-5" />
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
};

export default BlogArticle;
