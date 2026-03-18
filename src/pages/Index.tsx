import { lazy, Suspense } from 'react';
import { Helmet } from 'react-helmet-async';
import Navbar from '@/components/landing/Navbar';
import HeroSection from '@/components/landing/HeroSection';

// Lazy load below-the-fold sections
const LiveTicker = lazy(() => import('@/components/landing/LiveTicker'));
const StatsStrip = lazy(() => import('@/components/landing/StatsStrip'));
const BentoGrid = lazy(() => import('@/components/landing/BentoGrid'));
const DomainsSection = lazy(() => import('@/components/landing/DomainsSection'));
const ToolsSection = lazy(() => import('@/components/landing/ToolsSection'));
const QuotesCarousel = lazy(() => import('@/components/landing/QuotesCarousel'));
const TrustSection = lazy(() => import('@/components/landing/TrustSection'));
const CTASection = lazy(() => import('@/components/landing/CTASection'));
const Footer = lazy(() => import('@/components/landing/Footer'));
const TeamSectionComponent = lazy(() => import('@/components/TeamSection'));

const Index = () => (
  <>
    <Helmet>
      <title>محاماة ذكية - محتوى قانوني مغربي بمعايير عالمية</title>
      <meta name="description" content="مقالات قانونية معمّقة، أدوات ذكية، واستشارات مدعومة بالذكاء الاصطناعي لفهم القانون المغربي بوضوح." />
    </Helmet>
    <div className="min-h-screen flex flex-col bg-background" dir="rtl">
      <Navbar />
      <main className="flex-1">
        <HeroSection />
        <Suspense fallback={null}>
          <LiveTicker />
          <StatsStrip />
          <BentoGrid />
          <DomainsSection />
          <ToolsSection />
          <TeamSectionComponent variant="compact" />
          <QuotesCarousel />
          <TrustSection />
          <CTASection />
        </Suspense>
      </main>
      <Suspense fallback={null}>
        <Footer />
      </Suspense>
    </div>
  </>
);

export default Index;
