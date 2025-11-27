"use client";

import { useState } from "react";
import { Mail, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type SubscribeState = "idle" | "loading" | "success" | "error";

interface SubscribeButtonProps {
  className?: string;
  variant?: "compact" | "full";
}

export function SubscribeButton({ className, variant = "compact" }: SubscribeButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [state, setState] = useState<SubscribeState>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!email.trim()) return;
    
    setState("loading");
    setErrorMessage("");

    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to subscribe");
      }

      setState("success");
      setEmail("");
      
      // Close modal after success
      setTimeout(() => {
        setIsOpen(false);
        setState("idle");
      }, 2000);
    } catch (err) {
      setState("error");
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  function handleClose() {
    setIsOpen(false);
    setState("idle");
    setEmail("");
    setErrorMessage("");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={cn(
          "inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors",
          variant === "full" && "text-xs sm:text-sm",
          className
        )}
        aria-label="Subscribe to newsletter"
      >
        <Mail className="h-4 w-4" />
        {variant === "full" && <span>Subscribe</span>}
      </button>

      {/* Modal Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={handleClose}
        >
          {/* Modal Content */}
          <div
            className="relative w-full max-w-sm bg-background border border-border rounded-xl shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={handleClose}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="mb-4">
              <h2 className="text-lg font-semibold">Subscribe</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Get notified when I publish new posts.
              </p>
            </div>

            {state === "success" ? (
              <div className="py-4">
                <span className="text-sm">Successfully subscribed</span>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className={cn(
                      "w-full px-4 py-2.5 rounded-lg border bg-background text-sm",
                      "placeholder:text-muted-foreground/60",
                      "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary",
                      "transition-colors",
                      state === "error" ? "border-red-500" : "border-border"
                    )}
                    disabled={state === "loading"}
                    autoFocus
                  />
                  {state === "error" && errorMessage && (
                    <p className="text-xs text-red-500 mt-1.5">{errorMessage}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={state === "loading" || !email.trim()}
                  className={cn(
                    "w-full py-2.5 px-4 rounded-lg text-sm font-medium transition-all",
                    "bg-foreground text-background",
                    "hover:bg-foreground/90",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    "flex items-center justify-center gap-2"
                  )}
                >
                  {state === "loading" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Subscribing...</span>
                    </>
                  ) : (
                    <span>Subscribe</span>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}

