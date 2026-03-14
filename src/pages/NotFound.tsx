import { Link, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Scale, ArrowRight, Home, BookOpen, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error('404 Error: User attempted to access non-existent route:', location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background relative overflow-hidden px-4">
      {/* Background */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary/[0.03] blur-[100px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full bg-legal-gold/[0.04] blur-[80px]" />
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="relative z-10 text-center space-y-6 max-w-md">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-legal-navy/10 to-legal-gold/10 flex items-center justify-center mx-auto">
          <Scale className="h-10 w-10 text-legal-navy" />
        </div>
        <h1 className="text-7xl font-bold bg-gradient-to-l from-primary via-legal-gold to-legal-emerald bg-clip-text text-transparent">404</h1>
        <p className="text-xl font-bold text-foreground">الصفحة غير موجودة</p>
        <p className="text-sm text-muted-foreground">يبدو أن هذه الصفحة قد نُقلت أو حُذفت</p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
          <Link to="/">
            <Button className="rounded-full px-6 gap-2 shadow-lg shadow-primary/20">
              <Home className="h-4 w-4" /> الصفحة الرئيسية
            </Button>
          </Link>
          <Link to="/blog">
            <Button variant="outline" className="rounded-full px-6 gap-2">
              <BookOpen className="h-4 w-4" /> تصفّح المقالات
            </Button>
          </Link>
        </div>

        <div className="pt-6">
          <Link to="/ai-consultation"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors">
            <Sparkles className="h-3 w-3" /> أو اسأل المستشار الذكي
          </Link>
        </div>
      </motion.div>
    </div>
  );
};

export default NotFound;
