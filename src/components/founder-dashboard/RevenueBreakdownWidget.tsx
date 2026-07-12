"use client";

interface RevenueBreakdownWidgetProps {
  providers: { name: string; formattedAmount: string; percentage: number; color: string }[];
  hasMultiple: boolean;
}

export function RevenueBreakdownWidget({ providers, hasMultiple }: RevenueBreakdownWidgetProps) {
  if (providers.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card px-5 py-5 shadow-sm col-span-1 sm:col-span-2 lg:col-span-1">
        <h3 className="text-sm font-medium tracking-tight mb-4">Revenue Breakdown</h3>
        <div className="text-sm text-muted-foreground">No provider data available</div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card px-5 py-5 shadow-sm col-span-1 sm:col-span-2 lg:col-span-1">
      <h3 className="text-sm font-medium tracking-tight mb-4">Revenue by Provider</h3>
      <div className="space-y-4">
        {providers.map((provider) => (
          <div key={provider.name} className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: provider.color }}
                />
                <span className="font-medium">{provider.name}</span>
              </div>
              <span className="text-muted-foreground">{provider.formattedAmount}</span>
            </div>
            {hasMultiple && (
              <div className="h-1.5 w-full bg-secondary overflow-hidden rounded-full">
                <div 
                  className="h-full rounded-full" 
                  style={{ width: `${provider.percentage}%`, backgroundColor: provider.color }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
