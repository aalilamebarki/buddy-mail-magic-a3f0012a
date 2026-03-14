import { motion, useMotionValue, useTransform, useSpring } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Scale, Briefcase } from 'lucide-react';
import { useRef } from 'react';
import teamPhoto1 from '@/assets/team-1.png';
import teamPhoto2 from '@/assets/team-2.png';
import teamPhoto3 from '@/assets/team-3.png';

const team = [
  {
    img: teamPhoto1,
    name: 'المؤسّس',
    role: 'كاتب المحتوى القانوني',
    desc: 'متخصص في صياغة المحتوى القانوني وتبسيطه للقارئ العادي.',
    expertise: ['القانون المدني', 'قانون الأسرة', 'القانون الجنائي'],
    accent: 'from-primary/40 to-legal-navy/40',
    ringColor: 'ring-primary/20',
  },
  {
    img: teamPhoto3,
    name: 'المحررة',
    role: 'التحرير والمراجعة',
    desc: 'مسؤولة عن جودة المحتوى والتدقيق اللغوي والقانوني.',
    expertise: ['التحرير القانوني', 'التدقيق اللغوي', 'إدارة المحتوى'],
    accent: 'from-legal-gold/40 to-legal-burgundy/40',
    ringColor: 'ring-legal-gold/20',
  },
  {
    img: teamPhoto2,
    name: 'الشريك',
    role: 'المستشار والمراجع',
    desc: 'مراجعة المحتوى القانوني وضمان دقة المعلومات والمراجع.',
    expertise: ['القانون التجاري', 'القانون العقاري', 'المنازعات الإدارية'],
    accent: 'from-legal-emerald/40 to-primary/40',
    ringColor: 'ring-legal-emerald/20',
  },
];

const TeamCard = ({ member, index }: { member: typeof team[0]; index: number }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const rotateX = useSpring(useTransform(y, [-150, 150], [6, -6]), { stiffness: 300, damping: 30 });
  const rotateY = useSpring(useTransform(x, [-150, 150], [-6, 6]), { stiffness: 300, damping: 30 });

  const handleMouse = (e: React.MouseEvent) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    x.set(e.clientX - rect.left - rect.width / 2);
    y.set(e.clientY - rect.top - rect.height / 2);
  };

  const handleLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.18, duration: 0.6 }}
      onMouseMove={handleMouse}
      onMouseLeave={handleLeave}
      style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
      className="group perspective-1000"
    >
      <div className="relative rounded-[1.75rem] overflow-hidden bg-card border border-border/20 shadow-lg hover:shadow-2xl hover:shadow-primary/5 transition-shadow duration-700">
        {/* Accent top line */}
        <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-l ${member.accent} opacity-60 group-hover:opacity-100 transition-opacity`} />

        {/* Portrait area */}
        <div className="relative h-[340px] sm:h-[380px] overflow-hidden">
          {/* Rim-light glow effect */}
          <div className={`absolute -inset-4 bg-gradient-to-br ${member.accent} blur-3xl opacity-0 group-hover:opacity-30 transition-opacity duration-700 z-0`} />

          {/* Image with mask + professional filters */}
          <img
            src={member.img}
            alt={member.name}
            loading="lazy"
            className="relative z-10 w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-[1.04]"
            style={{
              maskImage: 'linear-gradient(to bottom, black 65%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to bottom, black 65%, transparent 100%)',
              filter: 'brightness(1.02) contrast(1.06) saturate(0.9)',
            }}
          />

          {/* Studio lighting rim effect */}
          <div
            className="absolute inset-0 z-20 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            style={{
              background: 'linear-gradient(135deg, transparent 40%, hsl(var(--primary) / 0.08) 60%, transparent 80%)',
            }}
          />

          {/* Glassmorphism name badge */}
          <div className="absolute bottom-0 left-0 right-0 z-30 p-5">
            <div className="bg-card/60 dark:bg-card/40 backdrop-blur-xl border border-border/20 rounded-2xl px-5 py-4 shadow-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-foreground tracking-tight">{member.name}</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Briefcase className="h-3 w-3 text-primary" />
                    <p className="text-xs font-semibold text-primary">{member.role}</p>
                  </div>
                </div>
                <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${member.accent} flex items-center justify-center ring-2 ${member.ringColor}`}>
                  <Scale className="h-4 w-4 text-primary-foreground" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 pt-3 space-y-3">
          <p className="text-sm text-muted-foreground leading-relaxed">{member.desc}</p>
          <div className="flex flex-wrap gap-1.5">
            {member.expertise.map((e, j) => (
              <span
                key={j}
                className="text-[10px] bg-muted text-muted-foreground px-3 py-1 rounded-full font-medium border border-border/30"
              >
                {e}
              </span>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

interface TeamSectionProps {
  variant?: 'full' | 'compact';
}

const TeamSection = ({ variant = 'full' }: TeamSectionProps) => (
  <section className={`py-20 md:py-28 ${variant === 'full' ? 'bg-muted/30' : ''} relative overflow-hidden`}>
    {/* Ambient background */}
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/[0.02] blur-[120px] pointer-events-none" />

    <div className="container mx-auto px-4 relative z-10">
      <div className="text-center mb-14 space-y-4">
        <Badge variant="outline" className="rounded-full px-4 py-1.5 text-xs gap-1.5">
          <CheckCircle className="h-3 w-3" /> خبراء موثّقون
        </Badge>
        <h2 className="text-3xl md:text-4xl font-bold text-foreground">
          الفريق وراء <span className="bg-gradient-to-l from-primary to-legal-navy bg-clip-text text-transparent">المحتوى</span>
        </h2>
        <p className="text-muted-foreground text-sm max-w-lg mx-auto leading-relaxed">
          فريق متخصص يجمع بين الخبرة القانونية والشغف بالتبسيط
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 max-w-5xl mx-auto">
        {team.map((member, i) => (
          <TeamCard key={i} member={member} index={i} />
        ))}
      </div>
    </div>
  </section>
);

export default TeamSection;
