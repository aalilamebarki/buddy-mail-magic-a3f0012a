import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Scale, Quote, ChevronLeft, ChevronRight } from 'lucide-react';
import AnimatedSection from './AnimatedSection';

const famousQuotes = [
  { text: 'الظلم في أي مكان يهدد العدالة في كل مكان.', author: 'مارتن لوثر كينغ', role: 'ناشط حقوقي أمريكي', initials: 'م', gradient: 'from-blue-600 to-indigo-700' },
  { text: 'القانون يجب أن يكون كالموت الذي لا يستثني أحداً.', author: 'مونتسكيو', role: 'فيلسوف وفقيه قانوني فرنسي', initials: 'م', gradient: 'from-amber-600 to-orange-700' },
  { text: 'حيثما يوجد حق يوجد واجب، وحيثما يوجد واجب يوجد حق.', author: 'المهاتما غاندي', role: 'محامٍ وزعيم حركة الاستقلال الهندية', initials: 'غ', gradient: 'from-emerald-600 to-teal-700' },
  { text: 'العدل أساس المُلك.', author: 'عمر بن الخطاب', role: 'ثاني الخلفاء الراشدين', initials: 'ع', gradient: 'from-green-700 to-emerald-800' },
  { text: 'لا حرية بدون قانون، ولا قانون بدون حرية.', author: 'جون لوك', role: 'فيلسوف إنجليزي، أبو الليبرالية', initials: 'ل', gradient: 'from-violet-600 to-purple-700' },
  { text: 'الحرية لا تُعطى بل تُؤخذ.', author: 'جمال عبد الناصر', role: 'رئيس مصر الأسبق', initials: 'ن', gradient: 'from-red-600 to-rose-700' },
  { text: 'القانون الذي لا يتساوى أمامه الجميع ليس قانوناً.', author: 'نيلسون مانديلا', role: 'رئيس جنوب أفريقيا ومناضل ضد التمييز', initials: 'م', gradient: 'from-yellow-600 to-amber-700' },
  { text: 'إن أردت السلام فاعمل من أجل العدالة.', author: 'البابا بولس السادس', role: 'رئيس الكنيسة الكاثوليكية', initials: 'ب', gradient: 'from-sky-600 to-blue-700' },
];

const QuotesCarousel = () => {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setActive(prev => (prev + 1) % famousQuotes.length), 6000);
    return () => clearInterval(timer);
  }, []);

  const q = famousQuotes[active];

  return (
    <AnimatedSection className="py-16 md:py-24 bg-muted/30 overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="text-center mb-8 space-y-3">
          <Badge variant="outline" className="rounded-full px-4 py-1 text-xs gap-1.5">
            <Scale className="h-3 w-3" /> أقوال خالدة
          </Badge>
          <h2 className="text-2xl md:text-3xl font-bold text-foreground">
            كلمات صنعت <span className="text-primary">العدالة</span>
          </h2>
        </div>

        <div className="max-w-2xl mx-auto relative min-h-[220px] flex items-center">
          <motion.div
            key={active}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
            className="text-center space-y-5 w-full"
          >
            <Quote className="h-8 w-8 text-legal-gold/25 mx-auto" />
            <blockquote className="text-lg sm:text-xl md:text-2xl text-foreground leading-relaxed font-semibold px-2">
              «{q.text}»
            </blockquote>
            <div className="flex items-center justify-center gap-3 pt-1">
              <div className={`h-11 w-11 rounded-full bg-gradient-to-br ${q.gradient} flex items-center justify-center text-white font-bold text-sm shadow-lg`}>
                {q.initials}
              </div>
              <div className="text-start">
                <div className="text-sm font-bold text-foreground">{q.author}</div>
                <div className="text-[11px] text-muted-foreground">{q.role}</div>
              </div>
            </div>
          </motion.div>
        </div>

        <div className="flex items-center justify-center gap-4 mt-6">
          <button onClick={() => setActive((active - 1 + famousQuotes.length) % famousQuotes.length)}
            className="h-8 w-8 rounded-full border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-border transition-all hover:bg-accent">
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="flex gap-1.5">
            {famousQuotes.map((_, i) => (
              <button key={i} onClick={() => setActive(i)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === active ? 'w-5 bg-primary' : 'w-1.5 bg-border hover:bg-muted-foreground/30'
                }`} />
            ))}
          </div>
          <button onClick={() => setActive((active + 1) % famousQuotes.length)}
            className="h-9 w-9 rounded-full border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-border transition-all hover:bg-accent">
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
      </div>
    </AnimatedSection>
  );
};

export default QuotesCarousel;
