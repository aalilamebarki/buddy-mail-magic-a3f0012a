import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Blog from "./pages/Blog";
import BlogArticle from "./pages/BlogArticle";
import LegalFeeCalculator from "./pages/LegalFeeCalculator";
import CaseTracker from "./pages/CaseTracker";
import AIConsultation from "./pages/AIConsultation";
import About from "./pages/About";
import DocumentCenter from "./pages/DocumentCenter";
import DocumentDetail from "./pages/DocumentDetail";
import Dashboard from "./pages/Dashboard";
import DashboardHome from "./pages/dashboard/DashboardHome";
import Cases from "./pages/dashboard/Cases";
import Clients from "./pages/dashboard/Clients";
import Articles from "./pages/dashboard/Articles";
import Finance from "./pages/dashboard/Finance";
import Analytics from "./pages/dashboard/Analytics";
import SettingsPage from "./pages/dashboard/Settings";
import Profile from "./pages/dashboard/Profile";
import UserManagement from "./pages/dashboard/UserManagement";
import Newsletter from "./pages/dashboard/Newsletter";
import Reports from "./pages/dashboard/Reports";
import SeoSettings from "./pages/dashboard/SeoSettings";
import AuditLog from "./pages/dashboard/AuditLog";
import ClientDashboard from "./pages/dashboard/ClientDashboard";
import KnowledgeBase from "./pages/dashboard/KnowledgeBase";
import DocumentGenerator from "./pages/dashboard/DocumentGenerator";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
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
                  <Route path="clients" element={<Clients />} />
                  <Route path="articles" element={<Articles />} />
                  <Route path="finance" element={<Finance />} />
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
                </Route>

                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
