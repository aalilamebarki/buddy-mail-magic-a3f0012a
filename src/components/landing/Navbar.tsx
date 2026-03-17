import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Scale, ArrowLeft, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ThemeToggle from '@/components/ThemeToggle';

const navLinks = [
  { to: '/blog', label: 'المقالات' },
  { to: '/documents', label: 'الوثائق' },
  { to: '/ai-consultation', label: 'المستشار الذكي' },
  { to: '/about', label: 'من نحن' },
];

const mobileNavLinks = [
  { to: '/blog', label: 'المقالات القانونية' },
  { to: '/documents', label: 'مركز الوثائق' },
  { to: '/legal-fee-calculator', label: 'حاسبة الرسوم' },
  { to: '/ai-consultation', label: 'المستشار الذكي' },
  { to: '/about', label: 'من نحن' },
];

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
      scrolled 
        ? 'bg-background/90 backdrop-blur-xl border-b border-border shadow-sm' 
        : 'bg-transparent'
    }`}>
      <div className="container mx-auto px-4 flex items-center justify-between h-16 md:h-20">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-legal-navy to-primary flex items-center justify-center">
            <Scale className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold text-foreground">محاماة ذكية</span>
        </Link>

        <div className="hidden md:flex items-center gap-1">
          {navLinks.map(link => (
            <Link key={link.to} to={link.to}
              className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-accent">
              {link.label}
            </Link>
          ))}
          <ThemeToggle />
          <div className="w-px h-6 bg-border mx-2" />
          <Link to="/auth">
            <Button size="sm" className="rounded-full px-5 gap-2">
              ابدأ الآن
              <ArrowLeft className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>

        <button className="md:hidden p-2 rounded-lg hover:bg-accent" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="md:hidden bg-background/95 backdrop-blur-xl border-b border-border p-5 space-y-2"
        >
          {mobileNavLinks.map(link => (
            <Link key={link.to} to={link.to}
              className="block px-4 py-3 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
              onClick={() => setMobileOpen(false)}>
              {link.label}
            </Link>
          ))}
          <Link to="/auth" onClick={() => setMobileOpen(false)}>
            <Button size="sm" className="w-full mt-2 rounded-full">تسجيل الدخول</Button>
          </Link>
        </motion.div>
      )}
    </nav>
  );
};

export default Navbar;
