import Link from "next/link";
import {
  ArrowRight,
  History,
  Mic,
  Quote,
  Target,
} from "lucide-react";

import { MarketingNav } from "@/components/marketing/MarketingNav";
import { HeroIllustration } from "@/components/marketing/HeroIllustration";
import { Starfield } from "@/components/marketing/Starfield";
import { FeatureCard } from "@/components/marketing/FeatureCard";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const FEATURES = [
  {
    icon: Quote,
    title: "Grounded, Cited Answers",
    description:
      "Every question and research answer is generated from your own uploaded notes and slides — with the exact source and page cited, never invented.",
  },
  {
    icon: Mic,
    title: "Spoken Viva Mode",
    description:
      "Answer out loud. Local speech recognition transcribes your response, and a proctor follow-up asks for clarification if your answer is too vague.",
  },
  {
    icon: Target,
    title: "Smart Question Selection",
    description:
      "Questions are weighted toward the pages you're weakest on, and the model is steered away from repeating questions it already asked you.",
  },
  {
    icon: History,
    title: "Full Session History",
    description:
      "Every research conversation and study session is saved and resumable — pick up a chat or quiz thread exactly where you left off.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <MarketingNav />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden bg-[#050509]">
          <Starfield count={70} />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10"
            style={{
              background:
                "radial-gradient(55% 45% at 50% 100%, color-mix(in oklch, var(--primary) 45%, transparent) 0%, transparent 70%), " +
                "radial-gradient(35% 30% at 85% 10%, color-mix(in oklch, var(--primary) 18%, transparent) 0%, transparent 70%)",
            }}
          />
          <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-6 pt-20 pb-28 lg:grid-cols-2 lg:pt-28">
            <div>
              <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-6xl">
                Study Smarter.
                <br />
                <span className="text-primary">Answer Out Loud.</span>
              </h1>

              <p className="mt-6 max-w-md text-lg leading-relaxed text-white/60">
                VoxPrep AI turns your PDFs, slides, and notes into a voice-driven exam
                prep partner — grounded questions, spoken vivas, and a research
                assistant that always cites its source.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link href="/dashboard" className={cn(buttonVariants({ size: "lg" }), "gap-2")}>
                  Start Studying <ArrowRight className="size-4" />
                </Link>
                <a
                  href="#features"
                  className={cn(buttonVariants({ variant: "outline", size: "lg" }), "border-white/15 text-white hover:bg-white/10")}
                >
                  See how it works
                </a>
              </div>

              <p className="mt-10 text-xs uppercase tracking-wide text-white/40">
                Built on Groq &middot; ChromaDB &middot; faster-whisper &middot; FastAPI
              </p>
            </div>

            <div className="flex justify-center lg:justify-end">
              <HeroIllustration />
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="border-t border-white/5 bg-muted/20 py-24">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Everything you need to actually retain it
              </h2>
              <p className="mt-3 text-muted-foreground">
                Not another chatbot wrapper — a study loop built around your own material.
              </p>
            </div>

            <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2">
              {FEATURES.map((f) => (
                <FeatureCard key={f.title} icon={f.icon} title={f.title} description={f.description} />
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="py-24">
          <div className="mx-auto max-w-4xl px-6 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Three steps. No fluff.</h2>
            <div className="mt-12 grid grid-cols-1 gap-8 text-left sm:grid-cols-3">
              {[
                { step: "01", title: "Upload your notes", desc: "PDF, DOCX, or PPTX — chunked and embedded automatically." },
                { step: "02", title: "Study or ask", desc: "Take a voice/text quiz, or ask the research assistant a question." },
                { step: "03", title: "Track your progress", desc: "Weak topics get prioritized automatically in your next session." },
              ].map((s) => (
                <div key={s.step}>
                  <span className="font-mono text-sm text-primary">{s.step}</span>
                  <h3 className="mt-2 font-semibold">{s.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="border-t border-white/5 py-24">
          <div className="mx-auto max-w-3xl px-6 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Ready to study smarter?</h2>
            <p className="mt-3 text-muted-foreground">
              Open the app, upload your first document, and generate your first grounded question.
            </p>
            <Link href="/dashboard" className={cn(buttonVariants({ size: "lg" }), "mt-8 gap-2")}>
              Open VoxPrep AI <ArrowRight className="size-4" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/5 py-8 text-center text-xs text-muted-foreground">
        VoxPrep AI &middot; A local-first, voice-driven RAG study assistant.
      </footer>
    </div>
  );
}
