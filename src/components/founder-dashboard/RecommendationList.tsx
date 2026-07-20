import type { Recommendation } from "@/lib/dashboard/recommendation-engine";
import { RecommendationCard } from "./RecommendationCard";
import { CheckCircle2 } from "lucide-react";

interface RecommendationListProps {
  primaryRecommendation: Recommendation | null;
  secondaryRecommendations: Recommendation[];
}

export function RecommendationList({ primaryRecommendation, secondaryRecommendations }: RecommendationListProps) {
  const hasRecommendations = primaryRecommendation || secondaryRecommendations.length > 0;

  if (!hasRecommendations) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center rounded-xl border border-dashed border-border bg-muted/30">
        <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-4">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <h4 className="font-syne font-bold text-foreground mb-1">All caught up!</h4>
        <p className="text-sm text-muted-foreground max-w-sm">
          You&apos;ve completed all current recommendations. Keep up the great work!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Action Plan</h3>
      </div>
      
      <div className="flex flex-col gap-3">
        {primaryRecommendation && (
          <RecommendationCard recommendation={primaryRecommendation} isPrimary={true} />
        )}
        
        {secondaryRecommendations.map(rec => (
          <RecommendationCard key={rec.id} recommendation={rec} isPrimary={false} />
        ))}
      </div>
    </div>
  );
}
