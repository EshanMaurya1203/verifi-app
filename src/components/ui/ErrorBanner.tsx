import { AlertTriangle, X } from "lucide-react";
import { useState } from "react";

interface ErrorBannerProps {
  message: string | null;
  onClose?: () => void;
  className?: string;
}

export function ErrorBanner({ message, onClose, className = "" }: ErrorBannerProps) {
  const [dismissedMessage, setDismissedMessage] = useState<string | null>(null);

  if (!message || message === dismissedMessage) return null;

  return (
    <div className={`flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-500 ${className}`}>
      <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
      <div className="flex-1 text-sm font-medium leading-relaxed">
        {message}
      </div>
      <button
        onClick={() => {
          setDismissedMessage(message);
          onClose?.();
        }}
        className="shrink-0 p-1 hover:bg-red-500/20 rounded-md transition-colors"
        aria-label="Close error message"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
