import { Activity } from "lucide-react";

interface FounderHealthScoreProps {
  score: number;
  grade: string;
  summary: string;
  trend?: "up" | "down" | "flat";
}

export function FounderHealthScore({ score, grade, summary, trend }: FounderHealthScoreProps) {
  // Determine color based on score
  let colorClass = "text-emerald-500";
  let bgClass = "bg-emerald-500/10";
  let borderClass = "border-emerald-500/20";
  
  if (score < 40) {
    colorClass = "text-red-500";
    bgClass = "bg-red-500/10";
    borderClass = "border-red-500/20";
  } else if (score < 70) {
    colorClass = "text-amber-500";
    bgClass = "bg-amber-500/10";
    borderClass = "border-amber-500/20";
  } else if (score < 90) {
    colorClass = "text-blue-500";
    bgClass = "bg-blue-500/10";
    borderClass = "border-blue-500/20";
  }

  return (
    <div className="flex flex-col md:flex-row items-center md:items-start gap-6 p-6 rounded-2xl border border-border bg-card shadow-sm">
      {/* Score Circle */}
      <div className="relative shrink-0 flex items-center justify-center w-24 h-24">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle 
            cx="50" cy="50" r="40" 
            className="stroke-muted fill-none" 
            strokeWidth="8"
          />
          <circle 
            cx="50" cy="50" r="40" 
            className={`fill-none ${colorClass}`} 
            stroke="currentColor"
            strokeWidth="8" 
            strokeLinecap="round"
            strokeDasharray="251.2"
            strokeDashoffset={251.2 - (251.2 * score) / 100}
            style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
          <span className="text-3xl font-extrabold tracking-tighter">{score}</span>
        </div>
      </div>
      
      {/* Grade and Summary */}
      <div className="flex flex-col justify-center flex-1 text-center md:text-left">
        <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
          <h3 className="text-xl font-bold font-syne">{grade}</h3>
          {trend && (
            <span className={`inline-flex items-center gap-1 text-[10px] uppercase font-bold px-2 py-0.5 rounded-md ${bgClass} ${colorClass}`}>
              <Activity className="w-3 h-3" />
              {trend}
            </span>
          )}
        </div>
        <p className="text-muted-foreground text-sm leading-relaxed max-w-lg">
          {summary}
        </p>
      </div>
    </div>
  );
}
