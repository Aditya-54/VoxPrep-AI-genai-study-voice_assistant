import { FileText, Mic, Sparkles } from "lucide-react";

const BAR_HEIGHTS = [28, 46, 64, 88, 68, 100, 72, 52, 80, 40, 60, 34];

export function HeroIllustration() {
  return (
    <div className="relative flex h-[26rem] w-full max-w-md items-center justify-center">
      {/* layered glow orb */}
      <div className="absolute size-72 rounded-full bg-gradient-to-br from-primary/50 via-fuchsia-500/25 to-cyan-400/20 blur-3xl" />
      <div className="absolute size-48 rounded-full bg-primary/30 blur-2xl" />

      {/* orbit ring */}
      <div className="absolute size-80 rounded-full border border-white/10" />
      <div className="absolute size-64 rounded-full border border-white/5" />

      {/* voice waveform core */}
      <div className="relative flex items-end gap-1.5 rounded-[2rem] border border-white/10 bg-card/50 px-8 py-9 shadow-2xl shadow-primary/20 backdrop-blur-md">
        {BAR_HEIGHTS.map((h, i) => (
          <span
            key={i}
            className="w-2 rounded-full bg-gradient-to-t from-primary via-fuchsia-400 to-cyan-300"
            style={{
              height: `${h}px`,
              animation: "voice-wave 1.6s ease-in-out infinite",
              animationDelay: `${(i % 6) * 0.12}s`,
              transformOrigin: "bottom",
            }}
          />
        ))}
      </div>

      {/* floating glass chips */}
      <div
        className="absolute -top-2 left-2 flex items-center gap-1.5 rounded-full border border-white/10 bg-card/70 px-3 py-1.5 text-xs font-medium shadow-lg backdrop-blur sm:left-6"
        style={{ animation: "drift 6s ease-in-out infinite" }}
      >
        <Mic className="size-3.5 text-primary" /> Speak your answer
      </div>

      <div
        className="absolute right-0 top-16 flex items-center gap-1.5 rounded-full border border-white/10 bg-card/70 px-3 py-1.5 text-xs font-medium shadow-lg backdrop-blur sm:right-4"
        style={{ animation: "drift 7s ease-in-out infinite", animationDelay: "1.5s" }}
      >
        <FileText className="size-3.5 text-verdict-correct" /> Cited from p.5
      </div>

      <div
        className="absolute bottom-2 right-6 flex items-center gap-1.5 rounded-full border border-white/10 bg-card/70 px-3 py-1.5 text-xs font-medium shadow-lg backdrop-blur sm:bottom-6"
        style={{ animation: "drift 8s ease-in-out infinite", animationDelay: "0.6s" }}
      >
        <Sparkles className="size-3.5 text-primary" /> Grounded, not guessed
      </div>
    </div>
  );
}
