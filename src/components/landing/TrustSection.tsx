import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Target, Shield, Eye, Handshake } from 'lucide-react';
import AnimatedSection from './AnimatedSection';

const reasons = [
  { icon: Target, title: 'دقة المعلومات', description: 'كل مقال مبني على نصوص قانونية رسمية واجتهادات قضائية محدّثة' },
  { icon: Shield, title: 'حماية الحقوق', description: 'نساعدك على معرفة حقوقك وكيفية الدفاع عنها بطريقة قانونية سليمة' },
  { icon: Eye, title: 'شفافية المصادر', description: 'نذكر دائماً المراجع والمصادر حتى تتحقق بنفسك من كل معلومة' },
  { icon: Handshake, title: 'أسلوب واضح', description: 'نكتب بلغة بسيطة ومباشرة بعيداً عن التعقيد والمصطلحات المبهمة' },
];

const TrustSection = () => (
  <AnimatedSection className="py-20 md:py-28">
    <div className="container mx-auto px-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
        <div className="space-y-6">
          <Badge variant="outline" className="rounded-full px-4 py-1 text-xs">لماذا محاماة ذكية</Badge>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground leading-tight">
            محتوى مختلف عن أي موقع 
            <span className="text-primary"> قانوني آخر</span>
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            لا نكتب لنملأ صفحات. كل مقال هو إجابة حقيقية لسؤال حقيقي 
            يطرحه الناس كل يوم.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {reasons.map((reason, i) => (
            <motion.div key={i} whileHover={{ scale: 1.02 }}
              className="rounded-2xl border border-border/50 bg-card p-5 space-y-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <reason.icon className="h-4 w-4 text-primary" />
              </div>
              <h3 className="font-bold text-foreground text-sm">{reason.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{reason.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  </AnimatedSection>
);

export default TrustSection;
