import { Helmet } from 'react-helmet-async';
import Navbar from '@/components/landing/Navbar';
import HeroSection from '@/components/landing/HeroSection';
import LiveTicker from '@/components/landing/LiveTicker';
import StatsStrip from '@/components/landing/StatsStrip';
import BentoGrid from '@/components/landing/BentoGrid';
import DomainsSection from '@/components/landing/DomainsSection';
import ToolsSection from '@/components/landing/ToolsSection';
import QuotesCarousel from '@/components/landing/QuotesCarousel';
import TrustSection from '@/components/landing/TrustSection';
import CTASection from '@/components/landing/CTASection';
import Footer from '@/components/landing/Footer';
import TeamSectionComponent from '@/components/TeamSection';

const Index = () => (
  <>
    <Helmet>
      <title>محاماة ذكية - محتوى قانوني مغربي بمعايير عالمية</title>
      <meta name="description" content="مقالات قانونية معمّقة، أدوات ذكية، واستشارات مدعومة بالذكاء الاصطناعي لفهم القانون المغربي بوضوح." />
    </Helmet>
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1">
        <HeroSection />
        <LiveTicker />
        <StatsStrip />
        <BentoGrid />
        <DomainsSection />
        <ToolsSection />
        <TeamSectionComponent variant="compact" />
        <QuotesCarousel />
        <TrustSection />
        <CTASection />
      </main>
      <Footer />
    </div>
  </>
);

export default Index;
