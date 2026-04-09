import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-6xl font-bold text-muted-foreground mb-4">404</p>
        <h1 className="text-xl font-semibold mb-2">Page not found</h1>
        <p className="text-muted-foreground text-sm mb-6">The page you're looking for doesn't exist.</p>
        <Link href="/">
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90">Back to Home</Button>
        </Link>
      </div>
    </div>
  );
}
