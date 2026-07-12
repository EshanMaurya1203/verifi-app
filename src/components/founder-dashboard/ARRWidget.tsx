"use client";

interface ARRWidgetProps {
  formattedARR: string;
}

export function ARRWidget({ formattedARR }: ARRWidgetProps) {
  return (
    <div className="rounded-xl border border-border bg-card px-5 py-5 shadow-sm">
      <h3 className="text-sm font-medium tracking-tight mb-2">Annual Run Rate</h3>
      <div className="text-2xl font-bold">{formattedARR}</div>
      <p className="text-xs text-muted-foreground mt-2">
        Based on current MRR
      </p>
    </div>
  );
}
