import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { motion } from 'framer-motion';

const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="relative h-9 w-9 rounded-full border border-border/40 bg-card/50 backdrop-blur-sm flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-border transition-all hover:bg-accent"
      aria-label={theme === 'dark' ? 'تبديل إلى الوضع النهاري' : 'تبديل إلى الوضع الليلي'}
    >
      <motion.div
        key={theme}
        initial={{ rotate: -90, opacity: 0 }}
        animate={{ rotate: 0, opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </motion.div>
    </button>
  );
};

export default ThemeToggle;
