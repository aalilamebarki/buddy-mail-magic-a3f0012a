import { ScrollText, Gavel, HeartHandshake, Landmark } from 'lucide-react';
import AnimatedSection from './AnimatedSection';

const stats = [
  { value: '200+', label: 'مقال منشور', icon: ScrollText },
  { value: '6', label: 'تخصصات قانونية', icon: Gavel },
  { value: '5K+', label: 'قارئ شهرياً', icon: HeartHandshake },
  { value: 'AI', label: 'مستشار ذكي', icon: Landmark },
];

const StatsStrip = () => (
  <AnimatedSection className="py-12 border-y border-border/40 bg-muted/30">
    <div className="container mx-auto px-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
        {stats.map((stat, i) => (
          <div key={i} className="text-center space-y-2">
            <div className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-primary/10 mx-auto">
              <stat.icon className="h-5 w-5 text-primary" />
            </div>
            <div className="text-2xl md:text-3xl font-bold text-foreground">{stat.value}</div>
            <div className="text-xs text-muted-foreground">{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  </AnimatedSection>
);

export default StatsStrip;
