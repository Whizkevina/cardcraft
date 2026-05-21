import { Eye, X } from "lucide-react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useAuth } from "./AuthProvider";

export function ImpersonationBanner() {
  const { impersonating, exitImpersonation } = useAuth();
  const qc = useQueryClient();

  if (!impersonating) return null;

  return (
    <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm">
      <p className="flex items-center gap-2 text-amber-200">
        <Eye size={16} />
        <span>
          Support view — read-only as <strong>{impersonating.userName}</strong>
        </span>
      </p>
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" variant="outline" className="h-8 text-xs" asChild>
          <Link href="/projects">My Cards</Link>
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-8 text-xs gap-1"
          onClick={async () => {
            await exitImpersonation();
            qc.invalidateQueries({ queryKey: ["/api/projects"] });
            qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
          }}
        >
          <X size={12} /> Exit view
        </Button>
      </div>
    </div>
  );
}
