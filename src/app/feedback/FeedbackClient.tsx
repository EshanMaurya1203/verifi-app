"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { toast } from "sonner";
import {
  MessageSquare,
  Bug,
  Lightbulb,
  Palette,
  Send,
  Loader2,
  CheckCircle2,
  Clock,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
} from "lucide-react";

type FeedbackCategory = "bug" | "feature" | "ui_ux" | "general";
type FeedbackStatus = "open" | "in_progress" | "resolved";

interface ReplyItem {
  id: string;
  author_user_id: string;
  author_email: string;
  is_admin: boolean;
  body: string;
  created_at: string;
}

interface FeedbackItem {
  id: string;
  category: FeedbackCategory;
  message: string;
  status: FeedbackStatus;
  created_at: string;
  updated_at: string;
  feedback_replies: ReplyItem[];
}

const CATEGORIES: {
  id: FeedbackCategory;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    id: "bug",
    label: "Bug / Problem",
    description: "Something is broken or behaving unexpectedly.",
    icon: Bug,
  },
  {
    id: "feature",
    label: "Feature Suggestion",
    description: "An idea for a new capability or metric.",
    icon: Lightbulb,
  },
  {
    id: "ui_ux",
    label: "UI / UX Feedback",
    description: "Suggestions to improve layout, aesthetics, or clarity.",
    icon: Palette,
  },
  {
    id: "general",
    label: "General Feedback",
    description: "Thoughts, questions, or general impressions.",
    icon: MessageSquare,
  },
];

export function FeedbackClient({ userEmail }: { userEmail: string }) {
  const [activeTab, setActiveTab] = useState<"submit" | "history">("submit");
  const [category, setCategory] = useState<FeedbackCategory>("feature");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedFeedbackId, setSubmittedFeedbackId] = useState<string | null>(null);

  // History state
  const [feedbackList, setFeedbackList] = useState<FeedbackItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [expandedThreadId, setExpandedThreadId] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    try {
      setIsLoadingHistory(true);
      const res = await fetch("/api/feedback");
      if (!res.ok) throw new Error("Failed to load feedback history.");
      const data = await res.json();
      setFeedbackList(data.feedback || []);
    } catch (err: any) {
      console.error("[Feedback] Fetch error:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (message.trim().length < 10) {
      toast.error("Please enter at least 10 characters of feedback.");
      return;
    }

    if (message.length > 3000) {
      toast.error("Feedback message cannot exceed 3,000 characters.");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, message: message.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit feedback.");
      }

      toast.success("Thank you! Your feedback has been sent to the Verifii team.");
      setSubmittedFeedbackId(data.feedback?.id || null);
      setMessage("");
      fetchHistory();
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: FeedbackStatus) => {
    switch (status) {
      case "open":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Clock className="w-3 h-3" />
            Received
          </span>
        );
      case "in_progress":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Sparkles className="w-3 h-3" />
            In Review
          </span>
        );
      case "resolved":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
            <CheckCircle2 className="w-3 h-3" />
            Resolved
          </span>
        );
    }
  };

  const getCategoryLabel = (cat: FeedbackCategory) => {
    return CATEGORIES.find((c) => c.id === cat)?.label || cat;
  };

  return (
    <div className="min-h-screen bg-[#040406] text-white selection:bg-primary selection:text-[#080808]">
      <Navbar />

      <main className="mx-auto max-w-4xl px-4 pt-28 pb-16">
        {/* Header Title */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] mb-3">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span className="text-[11px] font-bold uppercase tracking-widest text-neutral-300">
              Community &amp; Product
            </span>
          </div>
          <h1 className="font-syne text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            Help Shape Verifii
          </h1>
          <p className="text-sm text-neutral-400 mt-2 max-w-xl leading-relaxed">
            Every submission is directly reviewed by the Verifii founding team. We personally reply
            to all bug reports, suggestions, and founder feedback.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-2 p-1.5 rounded-2xl bg-neutral-900/60 border border-white/5 w-fit mb-8 backdrop-blur-md">
          <button
            type="button"
            onClick={() => {
              setActiveTab("submit");
              setSubmittedFeedbackId(null);
            }}
            className={`px-5 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "submit"
                ? "bg-primary text-black shadow-md shadow-primary/20"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            Submit Feedback
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`px-5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === "history"
                ? "bg-primary text-black shadow-md shadow-primary/20"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <span>My Submissions</span>
            {feedbackList.length > 0 && (
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                  activeTab === "history"
                    ? "bg-black/20 text-black"
                    : "bg-white/10 text-neutral-300"
                }`}
              >
                {feedbackList.length}
              </span>
            )}
          </button>
        </div>

        {/* Tab 1: Submit Form */}
        {activeTab === "submit" && (
          <div className="bg-neutral-900/40 border border-white/5 rounded-3xl p-6 sm:p-8 backdrop-blur-xl relative overflow-hidden shadow-2xl">
            {/* Ambient Background Glow */}
            <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-primary/5 blur-3xl pointer-events-none" />

            {submittedFeedbackId ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-3xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center mx-auto mb-5 shadow-inner">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h2 className="font-syne text-2xl font-bold mb-2">Feedback Received!</h2>
                <p className="text-sm text-neutral-400 max-w-md mx-auto mb-6 leading-relaxed">
                  We have received your submission and notified our team. You will receive an email notification when a reply is posted.
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSubmittedFeedbackId(null);
                      setMessage("");
                    }}
                    className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-bold uppercase tracking-wider transition-colors"
                  >
                    Submit Another Idea
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("history");
                      setSubmittedFeedbackId(null);
                    }}
                    className="px-5 py-2.5 rounded-xl bg-primary text-black text-xs font-bold uppercase tracking-wider transition-all hover:bg-[#a8e630]"
                  >
                    View in Submissions
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
                {/* Category Picker */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-300 mb-3">
                    Select Category
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {CATEGORIES.map((cat) => {
                      const Icon = cat.icon;
                      const isSelected = category === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setCategory(cat.id)}
                          className={`p-4 rounded-2xl border text-left transition-all flex items-start gap-3 ${
                            isSelected
                              ? "bg-primary/10 border-primary shadow-sm"
                              : "bg-neutral-950/60 border-white/5 hover:border-white/20 hover:bg-white/[0.02]"
                          }`}
                        >
                          <div
                            className={`p-2 rounded-xl shrink-0 ${
                              isSelected
                                ? "bg-primary text-black"
                                : "bg-white/5 text-neutral-400"
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-sm font-bold text-white mb-0.5">
                              {cat.label}
                            </div>
                            <div className="text-xs text-neutral-400 leading-snug">
                              {cat.description}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Message Textarea */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label
                      htmlFor="feedback-message"
                      className="block text-xs font-bold uppercase tracking-wider text-neutral-300"
                    >
                      Your Message
                    </label>
                    <span
                      className={`text-[11px] font-mono ${
                        message.length > 2800
                          ? "text-rose-400 font-bold"
                          : message.length >= 10
                          ? "text-neutral-400"
                          : "text-neutral-500"
                      }`}
                    >
                      {message.length} / 3000
                    </span>
                  </div>
                  <textarea
                    id="feedback-message"
                    rows={6}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Describe the issue, requested feature, or feedback in detail..."
                    className="w-full bg-neutral-950/80 border border-white/10 rounded-2xl p-4 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-y min-h-[140px]"
                    required
                  />
                  <p className="text-[11px] text-neutral-500 mt-2">
                    Submitting as <span className="text-neutral-300">{userEmail}</span>. The team will reply to this thread and notify your inbox.
                  </p>
                </div>

                {/* Submit Button */}
                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting || message.trim().length < 10}
                    className="px-7 py-3 rounded-xl bg-primary text-black hover:bg-[#a8e630] transition-all text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-primary/10 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-black" />
                        <span>Submitting...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Send Feedback</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Tab 2: Feedback History */}
        {activeTab === "history" && (
          <div className="space-y-4">
            {isLoadingHistory ? (
              <div className="flex flex-col items-center justify-center p-12 rounded-3xl border border-white/5 bg-neutral-900/30">
                <Loader2 className="w-6 h-6 animate-spin text-primary mb-3" />
                <p className="text-xs text-neutral-400">Loading your feedback submissions...</p>
              </div>
            ) : feedbackList.length === 0 ? (
              <div className="text-center p-12 rounded-3xl border border-white/5 bg-neutral-900/30">
                <MessageSquare className="w-10 h-10 text-neutral-600 mx-auto mb-3" />
                <h3 className="font-syne text-lg font-bold text-white mb-1">No Submissions Yet</h3>
                <p className="text-xs text-neutral-400 max-w-sm mx-auto mb-6">
                  You haven&apos;t submitted any feedback yet. Share an idea or report a problem to get started.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab("submit")}
                  className="px-5 py-2.5 rounded-xl bg-primary text-black text-xs font-bold uppercase tracking-wider"
                >
                  Write Feedback
                </button>
              </div>
            ) : (
              feedbackList.map((item) => {
                const isExpanded = expandedThreadId === item.id;
                const replies = item.feedback_replies || [];
                const hasReplies = replies.length > 0;

                return (
                  <div
                    key={item.id}
                    className="rounded-3xl border border-white/5 bg-neutral-900/40 p-6 backdrop-blur-xl transition-all hover:border-white/10"
                  >
                    {/* Top Row: Category, Status, Date */}
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold px-3 py-1 rounded-full bg-white/5 text-neutral-200 border border-white/5">
                          {getCategoryLabel(item.category)}
                        </span>
                        {getStatusBadge(item.status)}
                      </div>
                      <span className="text-[11px] text-neutral-500 font-mono">
                        {new Date(item.created_at).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>

                    {/* Original Message */}
                    <p className="text-sm text-neutral-200 leading-relaxed whitespace-pre-wrap mb-4">
                      {item.message}
                    </p>

                    {/* Replies Thread Section */}
                    {hasReplies ? (
                      <div className="mt-4 pt-4 border-t border-white/5">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedThreadId(isExpanded ? null : item.id)
                          }
                          className="flex items-center justify-between w-full text-xs font-bold text-primary hover:underline py-1"
                        >
                          <span className="flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-primary" />
                            {replies.length} {replies.length === 1 ? "Reply" : "Replies"} from Verifii Team
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>

                        {isExpanded && (
                          <div className="mt-3 space-y-3 pl-2 sm:pl-4 border-l-2 border-primary/30">
                            {replies.map((reply) => (
                              <div
                                key={reply.id}
                                className="p-4 rounded-2xl bg-neutral-950/80 border border-white/5 space-y-1.5"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[11px] font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                                    <Sparkles className="w-3 h-3" />
                                    Verifii Team Response
                                  </span>
                                  <span className="text-[10px] text-neutral-500 font-mono">
                                    {new Date(reply.created_at).toLocaleString("en-IN", {
                                      dateStyle: "medium",
                                      timeStyle: "short",
                                    })}
                                  </span>
                                </div>
                                <p className="text-xs text-neutral-300 leading-relaxed whitespace-pre-wrap">
                                  {reply.body}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-neutral-500">
                        <span>Awaiting review by founding team</span>
                        <span>We usually respond within 24 hours</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </main>
    </div>
  );
}
