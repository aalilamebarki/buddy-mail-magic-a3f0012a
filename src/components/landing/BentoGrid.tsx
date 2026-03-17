import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import {
  Sparkles, ArrowLeft, HeartHandshake, Newspaper, Gavel, Siren,
  ScrollText, Shield, TrendingUp,
} from 'lucide-react';
import AnimatedSection from './AnimatedSection';

const bentoItems = [
  { title: 'مدونة الأسرة', desc: 'أحكام الزواج والطلاق والحضانة والنفقة', icon: HeartHandshake, color: 'from-blue-500/10 to-blue-600/5', iconColor: 'text-blue-600', span: 'col-span-1 row-span-1' },
  { title: 'المستجدات التشريعية', desc: 'آخر التعديلات القانونية والظهائر الجديدة الصادرة', icon: Newspaper, color: 'from-legal-gold/10 to-legal-gold/5', iconColor: 'text-legal-gold', span: 'col-span-1 sm:col-span-2 row-span-1' },
  { title: 'القرارات القضائية', desc: 'اجتهادات محكمة النقض ومحاكم الاستئناف', icon: Gavel, color: 'from-legal-emerald/10 to-legal-emerald/5', iconColor: 'text-legal-emerald', span: 'col-span-1 sm:col-span-2 row-span-1' },
  { title: 'القانون الجنائي', desc: 'الجرائم والعقوبات وحقوق المتهم', icon: Siren, color: 'from-destructive/10 to-destructive/5', iconColor: 'text-destructive', span: 'col-span-1 row-span-1' },
  { title: 'المسطرة المدنية', desc: 'إجراءات التقاضي والطعون والتنفيذ', icon: ScrollText, color: 'from-violet-500/10 to-violet-600/5', iconColor: 'text-violet-600', span: 'col-span-1 row-span-1' },
  { title: 'الحريات العامة', desc: 'حقوق الإنسان والحريات الأساسية في الدستور', icon: Shield, color: 'from-cyan-500/10 to-cyan-600/5', iconColor: 'text-cyan-600', span: 'col-span-1 row-span-1' },
  { title: 'القانون التجاري', desc: 'تأسيس الشركات والملكية الفكرية والنزاعات', icon: TrendingUp, color: 'from-amber-500/10 to-amber-600/5', iconColor: 'text-amber-600', span: 'col-span-1 row-span-1' },
];

const BentoGrid = () => (
  <AnimatedSection className="py-20 md:py-28 bg-muted/20">
    <div className="container mx-auto px-4">
      <div className="text-center mb-14 space-y-4">
        <Badge variant="outline" className="rounded-full px-4 py-1 text-xs gap-1.5">
          <Sparkles className="h-3 w-3" /> أبرز المحتوى
        </Badge>
        <h2 className="text-3xl md:text-4xl font-bold text-foreground">
          اكتشف أهم <span className="text-primary">المواضيع</span>
        </h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-5xl mx-auto">
        {bentoItems.map((item, i) => (
          <motion.div key={i}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.06 }}
            whileHover={{ y: -3 }}
            className={item.span}
          >
            <Link to="/blog" className="block h-full">
              <div className={`relative h-full min-h-[140px] rounded-2xl border border-border/30 bg-gradient-to-br ${item.color} p-6 hover:border-border/60 transition-all duration-300 group overflow-hidden`}>
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-l from-transparent via-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="flex items-start justify-between">
                  <div className={`w-11 h-11 rounded-xl bg-card/80 border border-border/30 flex items-center justify-center ${item.iconColor}`}>
                    <item.icon className="h-5 w-5" />
                  </div>
                  <ArrowLeft className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary group-hover:-translate-x-1 transition-all" />
                </div>
                <div className="mt-4">
                  <h3 className="font-bold text-foreground text-[15px] mb-1">{item.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  </AnimatedSection>
);

export default BentoGrid;
