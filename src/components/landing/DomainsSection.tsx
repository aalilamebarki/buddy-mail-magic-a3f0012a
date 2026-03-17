import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, HeartHandshake, Siren, ScrollText, Handshake, Landmark, Globe } from 'lucide-react';
import AnimatedSection from './AnimatedSection';

const legalDomains = [
  { icon: HeartHandshake, title: 'قانون الأسرة', description: 'الزواج، الطلاق، الحضانة، النفقة، والإرث وفق مدونة الأسرة', color: 'from-blue-500/10 to-blue-600/5', iconColor: 'text-blue-600', articles: 45 },
  { icon: Siren, title: 'القانون الجنائي', description: 'الجرائم والعقوبات، حقوق المتهم، الإجراءات القضائية', color: 'from-red-500/10 to-red-600/5', iconColor: 'text-red-600', articles: 38 },
  { icon: ScrollText, title: 'القانون المدني', description: 'العقود، الالتزامات، المسؤولية المدنية، والتعويضات', color: 'from-emerald-500/10 to-emerald-600/5', iconColor: 'text-emerald-600', articles: 52 },
  { icon: Handshake, title: 'قانون الأعمال', description: 'تأسيس الشركات، النزاعات التجارية، والملكية الفكرية', color: 'from-amber-500/10 to-amber-600/5', iconColor: 'text-amber-600', articles: 31 },
  { icon: Landmark, title: 'القانون العقاري', description: 'الملكية، التحفيظ العقاري، وعقود البيع والشراء', color: 'from-violet-500/10 to-violet-600/5', iconColor: 'text-violet-600', articles: 28 },
  { icon: Globe, title: 'القانون الإداري', description: 'الصفقات العمومية، المنازعات الإدارية، وحقوق الموظف', color: 'from-cyan-500/10 to-cyan-600/5', iconColor: 'text-cyan-600', articles: 22 },
];

const DomainsSection = () => (
  <AnimatedSection className="py-20 md:py-28">
    <div className="container mx-auto px-4">
      <div className="text-center mb-14 space-y-4">
        <Badge variant="outline" className="rounded-full px-4 py-1 text-xs">المواضيع</Badge>
        <h2 className="text-3xl md:text-4xl font-bold text-foreground">
          نكتب في كل ما يهمّك قانونياً
        </h2>
        <p className="text-muted-foreground max-w-xl mx-auto">
          محتوى مُحدّث باستمرار يغطي أهم فروع القانون المغربي بأسلوب واضح ومباشر
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
        {legalDomains.map((domain, i) => (
          <motion.div key={i} whileHover={{ y: -4, scale: 1.01 }} transition={{ type: 'spring', stiffness: 300 }}>
            <Link to="/blog" className="block h-full">
              <div className={`relative h-full rounded-2xl border border-border/50 bg-gradient-to-br ${domain.color} p-6 md:p-7 hover:border-border transition-all group overflow-hidden`}>
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-l from-transparent via-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className={`h-11 w-11 rounded-xl bg-background/80 border border-border/50 flex items-center justify-center ${domain.iconColor}`}>
                      <domain.icon className="h-5 w-5" />
                    </div>
                    <span className="text-xs text-muted-foreground bg-background/60 px-2.5 py-1 rounded-full">{domain.articles} مقال</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground text-base mb-1.5">{domain.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{domain.description}</p>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                    <span>تصفّح المقالات</span>
                    <ArrowLeft className="h-3 w-3" />
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

export default DomainsSection;
