import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BookOpen, ChevronDown, Gavel, Landmark, ScrollText, Shield } from 'lucide-react';

const HeroSection = () => {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const y = useTransform(scrollYProgress, [0, 0.5], [0, 100]);

  return (
    <section ref={ref} className="relative min-h-[100svh] flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-legal-navy/[0.03] via-background to-background" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full bg-primary/[0.04] blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] rounded-full bg-legal-gold/[0.05] blur-[100px]" />
        <div className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      <motion.div style={{ opacity, y }} className="container mx-auto px-4 relative z-10 pt-20">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Badge className="bg-legal-gold/10 text-legal-gold border-legal-gold/20 hover:bg-legal-gold/15 px-4 py-1.5 text-xs font-medium rounded-full">
              <Landmark className="h-3 w-3 ml-1.5" />
              محتوى قانوني مغربي بمعايير عالمية
            </Badge>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.7 }}
            className="text-4xl sm:text-5xl md:text-7xl font-bold leading-[1.1] text-foreground"
          >
            افهم القانون
            <br />
            <span className="bg-gradient-to-l from-primary via-legal-gold to-legal-emerald bg-clip-text text-transparent">
              قبل أن يفهمك
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed"
          >
            مقالات معمّقة، تحليلات دقيقة، وأدوات ذكية تضع المعرفة القانونية 
            المغربية في متناول الجميع — بلا تعقيد.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.65 }}
            className="flex flex-col sm:flex-row gap-3 justify-center items-center"
          >
            <Link to="/ai-consultation">
              <Button size="lg" className="rounded-full px-8 gap-2 text-base shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all">
                <Gavel className="h-4 w-4" />
                اطرح سؤالك الآن
              </Button>
            </Link>
            <Link to="/blog">
              <Button size="lg" variant="outline" className="rounded-full px-8 gap-2 text-base border-border/60">
                <BookOpen className="h-4 w-4" />
                تصفّح المقالات
              </Button>
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
            className="flex flex-wrap justify-center gap-6 pt-8 text-xs text-muted-foreground"
          >
            {[
              { icon: ScrollText, text: '+200 مقال متخصص' },
              { icon: Gavel, text: '+5,000 قارئ شهرياً' },
              { icon: Shield, text: 'مراجع رسمية موثّقة' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-1.5 opacity-70">
                <item.icon className="h-3.5 w-3.5" />
                <span>{item.text}</span>
              </div>
            ))}
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <motion.div animate={{ y: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 2 }}>
            <ChevronDown className="h-5 w-5 text-muted-foreground/50" />
          </motion.div>
        </motion.div>
      </motion.div>
    </section>
  );
};

export default HeroSection;
