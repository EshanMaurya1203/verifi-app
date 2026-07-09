import Link from "next/link";
import { ArrowRight, Clock, AlertTriangle, Info, CheckCircle2 } from "lucide-react";
import type { Recommendation } from "@/lib/dashboard/recommendation-engine";

interface RecommendationCardProps {
  recommendation: Recommendation;
  isPrimary?: boolean;
}

export function RecommendationCard({ recommendation, isPrimary = false }: RecommendationCardProps) {
  const { title, description, cta, href, estimatedMinutes, severity } = recommendation;

  let Icon = Info;
  let iconClass = "text-blue-500";
  let bgClass = "bg-blue-500/10";
  
  if (severity === "critical") {
    Icon = AlertTriangle;
    iconClass = "text-red-500";
    bgClass = "bg-red-500/10";
  } else if (severity === "warning") {
    Icon = AlertTriangle;
    iconClass = "text-amber-500";
    bgClass = "bg-amber-500/10";
  } else if (severity === "info") {
    Icon = CheckCircle2;
    iconClass = "text-emerald-500";
    bgClass = "bg-emerald-500/10";
  }

  return (
    <div className={`flex flex-col sm:flex-row gap-3 p-3 rounded-xl border ${isPrimary ? 'border-primary shadow-sm bg-primary/5' : 'border-border bg-card'} items-start sm:items-center`}>
      <div className={`p-2 rounded-lg shrink-0 ${bgClass} ${iconClass}`}>
        <Icon className="w-4 h-4" />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <h4 className="font-bold text-sm text-foreground truncate">{title}</h4>
          {isPrimary && (
            <span className="inline-flex items-center rounded-full bg-primary/20 text-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
              Priority
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2 max-w-xl">
          {description}
        </p>
        <div className="flex items-center gap-1.5 mt-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          <Clock className="w-3 h-3" />
          <span>~{estimatedMinutes} min</span>
        </div>
      </div>
      
      <div className="shrink-0 w-full sm:w-auto mt-2 sm:mt-0">
        <Link 
          href={href}
          className={`inline-flex w-full sm:w-auto items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
            isPrimary 
              ? 'bg-primary text-primary-foreground hover:bg-primary/90' 
              : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
          }`}
        >
          {cta}
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
