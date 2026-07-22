import Link from "next/link";
import { AudioLines } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it Works" },
];

export function MarketingNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-background/70 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <AudioLines className="size-4" />
          </div>
          <span className="font-semibold tracking-tight">VoxPrep AI</span>
        </Link>

        <nav className="hidden items-center gap-8 text-sm text-muted-foreground sm:flex">
          {LINKS.map((link) => (
            <a key={link.href} href={link.href} className="transition-colors hover:text-foreground">
              {link.label}
            </a>
          ))}
        </nav>

        <Link href="/dashboard" className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}>
          Open App
        </Link>
      </div>
    </header>
  );
}
