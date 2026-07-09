import { BookOpen, ShieldCheck, TrendingUp, Sparkles, Rocket } from "lucide-react";

export function LearnVerifii() {
  const cards = [
    {
      title: "Discover how verified revenue builds trust",
      description: "Learn how verified revenue increases investor confidence and accelerates due diligence.",
      icon: <Sparkles className="h-5 w-5 text-indigo-500" />,
      bg: "bg-indigo-500/10",
    },
    {
      title: "Learn how we securely verify your startup",
      description: "Understand how automated verification protects your credibility without exposing sensitive data.",
      icon: <ShieldCheck className="h-5 w-5 text-emerald-500" />,
      bg: "bg-emerald-500/10",
    },
    {
      title: "Stand out to investors and early adopters",
      description: "See why public startups receive more visibility and attract stronger investment leads.",
      icon: <TrendingUp className="h-5 w-5 text-blue-500" />,
      bg: "bg-blue-500/10",
    },
    {
      title: "Understand how your Trust Score is calculated",
      description: "Learn how connecting a payment provider instantly maximizes your algorithmic confidence tier.",
      icon: <BookOpen className="h-5 w-5 text-amber-500" />,
      bg: "bg-amber-500/10",
    },
    {
      title: "Best practices before publishing publicly",
      description: "Ensure your profile is fully optimized to convert profile views into meaningful connections.",
      icon: <Rocket className="h-5 w-5 text-rose-500" />,
      bg: "bg-rose-500/10",
    }
  ];

  return (
    <div className="mb-12">
      <h2 className="font-syne text-2xl font-bold mb-6">Learn Verifii</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card, i) => (
          <div
            key={i}
            className="flex flex-col rounded-2xl border border-border bg-card p-5 transition-all hover:border-primary/30 hover:shadow-md cursor-default"
          >
            <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-lg ${card.bg}`}>
              {card.icon}
            </div>
            <h3 className="font-syne text-base font-bold mb-1">
              {card.title}
            </h3>
            <p className="text-sm text-muted-foreground">
              {card.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
