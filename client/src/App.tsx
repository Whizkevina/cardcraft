import { Switch, Route, Router, useLocation } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { CookieBanner } from "./components/CookieBanner";
import { ThemeProvider } from "./components/ThemeProvider";
import { AuthProvider } from "./components/AuthProvider";
import { useEffect, useRef, useState } from "react";

import Landing from "./pages/Landing";
import Gallery from "./pages/Gallery";
import Editor from "./pages/Editor";
import Projects from "./pages/Projects";
import AuthPage from "./pages/AuthPage";
import AdminPage from "./pages/AdminPage";
import BulkGenerate from "./pages/BulkGenerate";
import PricingPage from "./pages/PricingPage";
import PaymentsPage from "./pages/PaymentsPage";
import AccountSettings from "./pages/AccountSettings";
import ForgotPassword from "./pages/ForgotPassword";
import LegalPage from "./pages/LegalPage";
import SharePage from "./pages/SharePage";
import NotFound from "./pages/not-found";

// ─── Page fade-in transition wrapper ─────────────────────────────────────────
function PageTransition({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [visible, setVisible] = useState(false);
  const prevLoc = useRef("");

  useEffect(() => {
    if (location !== prevLoc.current) {
      prevLoc.current = location;
      setVisible(false);
      const t = requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
      return () => cancelAnimationFrame(t);
    }
  }, [location]);

  // On mount make visible immediately
  useEffect(() => { setVisible(true); }, []);

  return (
    <div style={{
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(6px)",
      transition: "opacity 0.18s ease, transform 0.18s ease",
    }}>
      {children}
    </div>
  );
}

export default function App() {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "123456789-placeholder.apps.googleusercontent.com";
  
  return (
    <QueryClientProvider client={queryClient}>
      <GoogleOAuthProvider clientId={clientId}>
        <ThemeProvider>
          <AuthProvider>
            <Router hook={useHashLocation}>
              <PageTransition>
                <Switch>
                  <Route path="/" component={Landing} />
                  <Route path="/templates" component={Gallery} />
                  <Route path="/editor" component={Editor} />
                  <Route path="/editor/t/:templateId" component={Editor} />
                  <Route path="/editor/p/:projectId" component={Editor} />
                  <Route path="/projects" component={Projects} />
                  <Route path="/bulk" component={BulkGenerate} />
                  <Route path="/pricing" component={PricingPage} />
                  <Route path="/payments" component={PaymentsPage} />
                  <Route path="/settings" component={AccountSettings} />
                  <Route path="/forgot-password" component={ForgotPassword} />
                  <Route path="/reset-password" component={ForgotPassword} />
                  <Route path="/terms" component={LegalPage} />
                  <Route path="/privacy" component={LegalPage} />
                  <Route path="/auth" component={AuthPage} />
                  <Route path="/admin" component={AdminPage} />
                  <Route path="/share/:id" component={SharePage} />
                  <Route component={NotFound} />
                </Switch>
              </PageTransition>
            </Router>
            <Toaster />
            <CookieBanner />
          </AuthProvider>
        </ThemeProvider>
      </GoogleOAuthProvider>
    </QueryClientProvider>
  );
}
