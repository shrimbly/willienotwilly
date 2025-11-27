import { Linkedin } from "lucide-react";
import { XIcon } from "@/components/ui/x-icon";

interface SiteFooterProps {
  variant?: "fixed" | "static";
}

export function SiteFooter({ variant = "fixed" }: SiteFooterProps) {
  return (
    <footer
      className={
        variant === "fixed"
          ? "fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-sm border-t border-border/50"
          : "mt-12 border-t border-border/50 bg-background/95"
      }
    >
      <div className="container mx-auto px-4 py-4 sm:py-5">
        <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span className="font-mono text-xs sm:text-sm">
            Willie Falloon — Auckland, NZ
          </span>
          <div className="flex items-center gap-4">
            <a
              href="https://x.com/ReflctWillie"
              className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Personal projects on X"
            >
              <XIcon className="h-4 w-4" />
              <span className="text-xs sm:text-sm">Projects</span>
            </a>
            <a
              href="https://www.linkedin.com/in/willie-falloon-961a8a68/"
              className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Day job on LinkedIn"
            >
              <Linkedin className="h-4 w-4" />
              <span className="text-xs sm:text-sm">Day job</span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

