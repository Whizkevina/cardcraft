import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "./components/ThemeProvider";
import { AuthProvider } from "./components/AuthProvider";

import Landing from "./pages/Landing";
import Gallery from "./pages/Gallery";
import Editor from "./pages/Editor";
import Projects from "./pages/Projects";
import AuthPage from "./pages/AuthPage";
import AdminPage from "./pages/AdminPage";
import BulkGenerate from "./pages/BulkGenerate";
import PricingPage from "./pages/PricingPage";
import NotFound from "./pages/not-found";

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <Router hook={useHashLocation}>
            <Switch>
              <Route path="/" component={Landing} />
              <Route path="/templates" component={Gallery} />
              <Route path="/editor" component={Editor} />
              <Route path="/editor/t/:templateId" component={Editor} />
              <Route path="/editor/p/:projectId" component={Editor} />
              <Route path="/projects" component={Projects} />
              <Route path="/bulk" component={BulkGenerate} />
              <Route path="/pricing" component={PricingPage} />
              <Route path="/auth" component={AuthPage} />
              <Route path="/admin" component={AdminPage} />
              <Route component={NotFound} />
            </Switch>
          </Router>
          <Toaster />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
