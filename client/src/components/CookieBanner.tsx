import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, Cookie } from "lucide-react";
import { Link } from "wouter";

export function CookieBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if the user has already consented or declined
    const consent = localStorage.getItem("cookie_consent");
    if (!consent) {
      setIsVisible(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem("cookie_consent", "accepted");
    setIsVisible(false);
  };

  const handleDecline = () => {
    localStorage.setItem("cookie_consent", "declined");
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6 pb-pb-safe">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card border border-border shadow-2xl rounded-xl p-4 sm:p-5 relative animate-in slide-in-from-bottom-10 fade-in duration-500">
        
        <button 
          onClick={handleDecline} 
          className="absolute top-2 right-2 p-1.5 text-muted-foreground hover:bg-secondary rounded-md"
        >
          <X size={16} />
        </button>

        <div className="flex items-start gap-3">
          <div className="p-2 bg-secondary rounded-lg hidden sm:block">
            <Cookie size={20} className="text-gold" />
          </div>
          <div>
            <h3 className="font-semibold text-sm mb-1 text-foreground">We value your privacy</h3>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">
              We use strictly necessary cookies to keep you logged in and process your designs. 
              By continuing to use CardCraft, you consent to our data processing practices under GDPR and NDPR. 
              Read our <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link> to learn more about your rights.
            </p>
          </div>
        </div>

        <div className="flex w-full sm:w-auto items-center gap-2 mt-2 sm:mt-0">
          <Button variant="outline" size="sm" onClick={handleDecline} className="flex-1 sm:flex-none text-xs h-9">
            Decline
          </Button>
          <Button size="sm" onClick={handleAccept} className="flex-1 sm:flex-none text-xs h-9 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
            Accept & Continue
          </Button>
        </div>
      </div>
    </div>
  );
}
