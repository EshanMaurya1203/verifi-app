import type { DashboardInsights } from "@/lib/dashboard/founder-insights-presenter";
import { FounderHealthScore } from "./FounderHealthScore";
import { RecommendationList } from "./RecommendationList";
import { CheckCircle2, AlertCircle } from "lucide-react";

interface FounderInsightsCardProps {
  insights: DashboardInsights;
}

export function FounderInsightsCard({ insights }: FounderInsightsCardProps) {
  const { 
    healthScore, 
    healthGrade, 
    summary, 
    strengths, 
    improvements, 
    primaryRecommendation, 
    secondaryRecommendations 
  } = insights;

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <div className="flex items-center justify-between">
        <h2 className="font-syne text-xl sm:text-2xl font-extrabold tracking-[-0.5px]">
          Founder Insights
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          <FounderHealthScore 
            score={healthScore}
            grade={healthGrade}
            summary={summary}
          />
          
          <RecommendationList 
            primaryRecommendation={primaryRecommendation}
            secondaryRecommendations={secondaryRecommendations}
          />
        </div>
        
        <div className="lg:col-span-1">
          <div className="rounded-2xl border border-border bg-card shadow-sm p-5 sm:p-6 space-y-5 sm:space-y-6">
            
            {/* Strengths */}
            {strengths.length > 0 && (
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Strengths
                </h3>
                <ul className="space-y-2">
                  {strengths.map(strength => (
                    <li key={strength.id} className="text-sm text-foreground flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                      <span>{strength.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {strengths.length > 0 && improvements.length > 0 && (
              <div className="h-px bg-border" />
            )}

            {/* Improvements */}
            {improvements.length > 0 && (
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                  Needs Improvement
                </h3>
                <ul className="space-y-2">
                  {improvements.map(improvement => (
                    <li key={improvement.id} className="text-sm text-foreground flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                      <span>{improvement.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {strengths.length === 0 && improvements.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-4">
                No insights available yet.
              </div>
            )}
            
          </div>
        </div>
      </div>
    </div>
  );
}
