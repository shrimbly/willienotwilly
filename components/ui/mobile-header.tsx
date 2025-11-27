"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type Anchor = {
  href: string;
  label: string;
  level: number;
};

interface MobileHeaderProps {
  anchors: Anchor[];
}

export function MobileHeader({ anchors }: MobileHeaderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [isScrolled, setIsScrolled] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const lastScrollY = useRef(0);

  useEffect(() => {
    function handleScroll() {
      const currentScrollY = window.scrollY;
      const scrollingDown = currentScrollY > lastScrollY.current;
      const scrollDelta = Math.abs(currentScrollY - lastScrollY.current);

      // Only react to meaningful scroll movements
      if (scrollDelta > 5) {
        // Show header when scrolling up or near top
        if (!scrollingDown || currentScrollY < 100) {
          setIsVisible(true);
        } else if (scrollingDown && currentScrollY > 100) {
          // Hide when scrolling down and past threshold
          setIsVisible(false);
          setIsOpen(false); // Close dropdown when hiding
        }
        lastScrollY.current = currentScrollY;
      }

      setIsScrolled(currentScrollY > 20);
    }

    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  function handleAnchorClick() {
    setIsOpen(false);
  }

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 lg:hidden",
        "transition-all duration-300 ease-out",
        isVisible ? "translate-y-0" : "-translate-y-full",
        isScrolled
          ? "bg-background/95 backdrop-blur-md border-b border-border/50 shadow-sm"
          : "bg-background/80 backdrop-blur-sm"
      )}
    >
      <div className="container mx-auto px-4">
        <div className="flex h-14 items-center justify-between">
          <Link
            href="/"
            className="text-lg font-semibold hover:text-primary transition"
          >
            Willie Falloon
          </Link>

          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-all",
                "text-muted-foreground hover:text-foreground",
                "hover:bg-muted/50",
                isOpen && "bg-muted/50 text-foreground"
              )}
              aria-expanded={isOpen}
              aria-haspopup="true"
            >
              <span>Jump ahead</span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform duration-200",
                  isOpen && "rotate-180"
                )}
              />
            </button>

            <div
              className={cn(
                "absolute right-0 top-full mt-2 w-64 origin-top-right",
                "rounded-xl border border-border/60 bg-popover/95 backdrop-blur-md",
                "shadow-lg shadow-black/5",
                "transition-all duration-200 ease-out",
                isOpen
                  ? "opacity-100 scale-100 translate-y-0"
                  : "opacity-0 scale-95 -translate-y-2 pointer-events-none"
              )}
            >
              <nav className="p-2 max-h-[60vh] overflow-y-auto">
                {anchors.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={handleAnchorClick}
                    className={cn(
                      "block rounded-lg px-3 py-2 text-sm transition-colors",
                      "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                      item.level === 3 && "pl-6 text-[13px]",
                      item.level === 4 && "pl-9 text-[12px]"
                    )}
                  >
                    {item.label}
                  </a>
                ))}
              </nav>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
