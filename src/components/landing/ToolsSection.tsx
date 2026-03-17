import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Brain, Scale, Gavel, ArrowLeft, Zap } from 'lucide-react';
import AnimatedSection from './AnimatedSection';

const smartTools = [
  { icon: Brain, title: 'المستشار الذكي', description: 'اطرح سؤالك واحصل على إجابة فورية مدعومة بالذكاء الاصطناعي مع مراجع قانونية', link: '/ai-consultation', badge: 'ذكي', gradient: 'from-primary to-blue-600' },
  { icon: Scale, title: 'حاسبة الرسوم', description: 'احسب تكلفة الإجراءات القضائية بدقة حسب نوع القضية والمحكمة', link: '/legal-fee-calculator', badge: 'مجاني', gradient: 'from-legal-emerald to-emerald-600' },
  { icon: Gavel, title: 'تتبع القضايا', description: 'تابع مراحل قضيتك واعرف آخر المستجدات بسهولة', link: '/case-tracker', badge: 'مباشر', gradient: 'from-legal-gold to-amber-600' },
];

const ToolsSection = () => (
  <AnimatedSection className="py-20 md:py-28 bg-muted/30">
    <div className="container mx-auto px-4">
      <div className="text-center mb-14 space-y-4">
        <Badge variant="outline" className="rounded-full px-4 py-1 text-xs">
          <Zap className="h-3 w-3 ml-1" /> أدوات مجانية
        </Badge>
        <h2 className="text-3xl md:text-4xl font-bold text-foreground">
          لا تبحث في الفراغ
        </h2>
        <p className="text-muted-foreground max-w-xl mx-auto">
          أدوات عملية صُمّمت لتبسيط كل ما هو معقد في الإجراءات القانونية
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl mx-auto">
        {smartTools.map((tool, i) => (
          <motion.div key={i} whileHover={{ y: -6 }} transition={{ type: 'spring', stiffness: 300 }}>
            <Link to={tool.link} className="block h-full">
              <div className="relative h-full rounded-2xl border border-border/50 bg-card p-6 md:p-7 hover:shadow-xl hover:shadow-primary/[0.04] transition-all group overflow-hidden">
                <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-l ${tool.gradient} opacity-60`} />
                <div className="space-y-5">
                  <div className="flex items-start justify-between">
                    <div className={`h-12 w-12 rounded-2xl bg-gradient-to-br ${tool.gradient} flex items-center justify-center text-primary-foreground`}>
                      <tool.icon className="h-6 w-6" />
                    </div>
                    <Badge className="bg-foreground/5 text-foreground border-0 text-[10px] rounded-full">{tool.badge}</Badge>
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground text-lg mb-2">{tool.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{tool.description}</p>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-primary font-medium pt-2 group-hover:gap-3 transition-all">
                    <span>جرّب الآن</span>
                    <ArrowLeft className="h-4 w-4" />
                  </div>
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  </AnimatedSection>
);

export default ToolsSection;
