import { lazy, Suspense } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import ProtectedRoute from "@/components/ProtectedRoute";

// Public pages (eager — only Index for SEO)
import Index from "./pages/Index";

// Public pages (lazy)
const Auth = lazy(() => import("./pages/Auth"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Public pages (lazy)
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Blog = lazy(() => import("./pages/Blog"));
const BlogArticle = lazy(() => import("./pages/BlogArticle"));
const LegalFeeCalculator = lazy(() => import("./pages/LegalFeeCalculator"));
const CaseTracker = lazy(() => import("./pages/CaseTracker"));
const AIConsultation = lazy(() => import("./pages/AIConsultation"));
const About = lazy(() => import("./pages/About"));
const DocumentCenter = lazy(() => import("./pages/DocumentCenter"));
const DocumentDetail = lazy(() => import("./pages/DocumentDetail"));
const VerifyInvoice = lazy(() => import("./pages/VerifyInvoice"));

// Dashboard (lazy)
const Dashboard = lazy(() => import("./pages/Dashboard"));
const DashboardHome = lazy(() => import("./pages/dashboard/DashboardHome"));
const Cases = lazy(() => import("./pages/dashboard/Cases"));
const CaseDetail = lazy(() => import("./pages/dashboard/CaseDetail"));
const CourtSessions = lazy(() => import("./pages/dashboard/CourtSessions"));
const Clients = lazy(() => import("./pages/dashboard/Clients"));
const Articles = lazy(() => import("./pages/dashboard/Articles"));

const Analytics = lazy(() => import("./pages/dashboard/Analytics"));
const SettingsPage = lazy(() => import("./pages/dashboard/Settings"));
const Profile = lazy(() => import("./pages/dashboard/Profile"));
const UserManagement = lazy(() => import("./pages/dashboard/UserManagement"));
const Newsletter = lazy(() => import("./pages/dashboard/Newsletter"));
const Reports = lazy(() => import("./pages/dashboard/Reports"));
const SeoSettings = lazy(() => import("./pages/dashboard/SeoSettings"));
const AuditLog = lazy(() => import("./pages/dashboard/AuditLog"));
const ClientDashboard = lazy(() => import("./pages/dashboard/ClientDashboard"));
const KnowledgeBase = lazy(() => import("./pages/dashboard/KnowledgeBase"));
const DocumentGenerator = lazy(() => import("./pages/dashboard/DocumentGenerator"));
const Letterheads = lazy(() => import("./pages/dashboard/Letterheads"));

const Billing = lazy(() => import("./pages/dashboard/Billing"));

const queryClient = new QueryClient();

const LazyFallback = () => (
  <div className="flex items-center justify-center min-h-[40vh]">
    <div className="text-muted-foreground text-sm">جاري التحميل...</div>
  </div>
);

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Suspense fallback={<LazyFallback />}>
                <Routes>
                  {/* Public routes */}
                  <Route path="/" element={<Index />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/blog" element={<Blog />} />
                  <Route path="/blog/:slug" element={<BlogArticle />} />
                  <Route path="/legal-fee-calculator" element={<LegalFeeCalculator />} />
                  <Route path="/case-tracker" element={<CaseTracker />} />
                  <Route path="/ai-consultation" element={<AIConsultation />} />
                  <Route path="/about" element={<About />} />
                  <Route path="/documents" element={<DocumentCenter />} />
                  <Route path="/documents/:id" element={<DocumentDetail />} />
                  <Route path="/verify/:uuid" element={<VerifyInvoice />} />

                  {/* Dashboard routes */}
                  <Route
                    path="/dashboard"
                    element={
                      <ProtectedRoute>
                        <Dashboard />
                      </ProtectedRoute>
                    }
                  >
                    <Route index element={<DashboardHome />} />
                    <Route path="cases" element={<Cases />} />
                    <Route path="cases/:id" element={<CaseDetail />} />
                    <Route path="court-sessions" element={<CourtSessions />} />
                    <Route path="clients" element={<Clients />} />
                    <Route path="articles" element={<Articles />} />
                    
                    <Route path="analytics" element={<Analytics />} />
                    <Route path="settings" element={<SettingsPage />} />
                    <Route path="profile" element={<Profile />} />
                    <Route path="users" element={<UserManagement />} />
                    <Route path="newsletter" element={<Newsletter />} />
                    <Route path="reports" element={<Reports />} />
                    <Route path="seo" element={<SeoSettings />} />
                    <Route path="audit-log" element={<AuditLog />} />
                    <Route path="client-dashboard" element={<ClientDashboard />} />
                    <Route path="knowledge-base" element={<KnowledgeBase />} />
                    <Route path="document-generator" element={<DocumentGenerator />} />
                    <Route path="letterheads" element={<Letterheads />} />
                    
                    <Route path="billing" element={<Billing />} />
                  </Route>

                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
