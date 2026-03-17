import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import AnimatedSection from './AnimatedSection';

const bulletins = [
  { text: 'صدور ظهير شريف رقم 1.24.57 بتنفيذ قانون المالية لسنة 2026', type: 'جديد' },
  { text: 'تعديل الفصل 49 من مدونة الأسرة المتعلق بتدبير الأموال المكتسبة', type: 'تعديل' },
  { text: 'قرار محكمة النقض: عدم جواز الطلاق الشفوي وفق المادة 79', type: 'اجتهاد' },
  { text: 'مرسوم جديد ينظم مهنة التوثيق العدلي بالمغرب', type: 'مرسوم' },
  { text: 'دورية وزارة العدل بشأن رقمنة الإجراءات القضائية', type: 'دورية' },
];

const LiveTicker = () => {
  const [current, setCurrent] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setCurrent(prev => (prev + 1) % bulletins.length), 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <AnimatedSection className="py-6 border-y border-border/30 bg-legal-navy/[0.02]">
      <div className="container mx-auto px-4">
        <div className="flex items-center gap-4">
          <div className="shrink-0 flex items-center gap-2">
            <div className="relative">
              <div className="w-2.5 h-2.5 rounded-full bg-destructive animate-pulse" />
              <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-destructive animate-ping opacity-50" />
            </div>
            <span className="text-xs font-bold text-foreground hidden sm:inline">نشرة رسمية</span>
          </div>
          <div className="flex-1 overflow-hidden relative h-7">
            <AnimatePresence mode="wait">
              <motion.div
                key={current}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -20, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0 flex items-center gap-2"
              >
                <Badge className="bg-primary/10 text-primary border-0 text-[9px] rounded-full px-2 shrink-0">{bulletins[current].type}</Badge>
                <span className="text-xs text-foreground/80 truncate">{bulletins[current].text}</span>
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => setCurrent((current - 1 + bulletins.length) % bulletins.length)}
              className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-all">
              <ChevronRight className="h-3 w-3" />
            </button>
            <button onClick={() => setCurrent((current + 1) % bulletins.length)}
              className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-all">
              <ChevronLeft className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </AnimatedSection>
  );
};

export default LiveTicker;
