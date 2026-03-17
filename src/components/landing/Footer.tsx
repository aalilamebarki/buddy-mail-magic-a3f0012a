import { Link } from 'react-router-dom';
import { Scale, Phone, Mail, MapPin } from 'lucide-react';

const Footer = () => (
  <footer className="border-t border-border bg-muted/20">
    <div className="container mx-auto px-4 py-12 md:py-16">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-12">
        <div className="md:col-span-2 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-legal-navy to-primary flex items-center justify-center">
              <Scale className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold text-foreground">محاماة ذكية</span>
          </div>
          <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
            مدوّنة قانونية مغربية تهدف لتبسيط المعرفة القانونية 
            وجعلها في متناول الجميع.
          </p>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-2">
            <MapPin className="h-3.5 w-3.5" />
            <span>الدار البيضاء، المغرب</span>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="font-semibold text-foreground text-sm">استكشف</h4>
          <div className="space-y-2.5">
            {[
              { to: '/blog', label: 'المقالات' },
              { to: '/documents', label: 'مركز الوثائق' },
              { to: '/legal-fee-calculator', label: 'حاسبة الرسوم' },
              { to: '/ai-consultation', label: 'المستشار الذكي' },
              { to: '/about', label: 'من نحن' },
            ].map(link => (
              <Link key={link.to} to={link.to} className="block text-sm text-muted-foreground hover:text-foreground transition-colors">{link.label}</Link>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="font-semibold text-foreground text-sm">تواصل</h4>
          <div className="space-y-2.5 text-sm text-muted-foreground">
            <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" /><span>+212 5XX-XXXXXX</span></div>
            <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" /><span>contact@example.com</span></div>
          </div>
        </div>
      </div>

      <div className="mt-10 pt-6 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} محاماة ذكية. جميع الحقوق محفوظة.</p>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="hover:text-foreground cursor-pointer transition-colors">سياسة الخصوصية</span>
          <span className="hover:text-foreground cursor-pointer transition-colors">الشروط والأحكام</span>
        </div>
      </div>
    </div>
  </footer>
);

export default Footer;
