"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
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
  Search,
  Filter,
  ShieldCheck,
  BarChart3,
  ListFilter,
  User,
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

interface AdminFeedbackItem {
  id: string;
  user_id: string;
  user_email: string;
  category: FeedbackCategory;
  message: string;
  status: FeedbackStatus;
  created_at: string;
  updated_at: string;
  feedback_replies: ReplyItem[];
}

export function AdminFeedbackClient({ adminEmail }: { adminEmail: string }) {
  const [feedbackList, setFeedbackList] = useState<AdminFeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Selected thread & reply form state
  const [selectedItem, setSelectedItem] = useState<AdminFeedbackItem | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [replyStatus, setReplyStatus] = useState<FeedbackStatus>("resolved");
  const [isSendingReply, setIsSendingReply] = useState(false);

  const fetchFeedback = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (categoryFilter !== "all") params.set("category", categoryFilter);

      const res = await fetch(`/api/admin/feedback?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load feedback queue.");
      const data = await res.json();
      setFeedbackList(data.feedback || []);

      // If an item is currently selected, refresh its object
      if (selectedItem) {
        const updated = (data.feedback || []).find(
          (f: AdminFeedbackItem) => f.id === selectedItem.id
        );
        if (updated) setSelectedItem(updated);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to fetch admin feedback.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, categoryFilter, selectedItem]);

  useEffect(() => {
    fetchFeedback();
  }, [statusFilter, categoryFilter]);

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    if (replyBody.trim().length < 2) {
      toast.error("Please enter a reply message.");
      return;
    }

    try {
      setIsSendingReply(true);
      const res = await fetch("/api/admin/feedback/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedback_id: selectedItem.id,
          body: replyBody.trim(),
          status: replyStatus,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send reply.");

      toast.success("Reply sent and user notified via email!");
      setReplyBody("");

      // Update local state
      const updatedReplies = [...selectedItem.feedback_replies, data.reply];
      const updatedItem = {
        ...selectedItem,
        status: data.status,
        updated_at: new Date().toISOString(),
        feedback_replies: updatedReplies,
      };

      setSelectedItem(updatedItem);
      setFeedbackList((prev) =>
        prev.map((item) => (item.id === updatedItem.id ? updatedItem : item))
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to submit reply.");
    } finally {
      setIsSendingReply(false);
    }
  };

  const handleQuickStatusChange = async (feedbackId: string, nextStatus: FeedbackStatus) => {
    try {
      const res = await fetch("/api/admin/feedback", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback_id: feedbackId, status: nextStatus }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update status.");

      toast.success(`Status updated to ${nextStatus}.`);

      setFeedbackList((prev) =>
        prev.map((f) => (f.id === feedbackId ? { ...f, status: nextStatus } : f))
      );

      if (selectedItem && selectedItem.id === feedbackId) {
        setSelectedItem((prev) => (prev ? { ...prev, status: nextStatus } : null));
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update status.");
    }
  };

  const filteredItems = feedbackList.filter((item) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      item.user_email.toLowerCase().includes(query) ||
      item.message.toLowerCase().includes(query) ||
      item.category.toLowerCase().includes(query)
    );
  });

  const getCategoryIcon = (category: FeedbackCategory) => {
    switch (category) {
      case "bug":
        return <Bug className="w-4 h-4 text-rose-400" />;
      case "feature":
        return <Lightbulb className="w-4 h-4 text-amber-400" />;
      case "ui_ux":
        return <Palette className="w-4 h-4 text-purple-400" />;
      case "general":
        return <MessageSquare className="w-4 h-4 text-blue-400" />;
    }
  };

  return (
    <div className="min-h-screen bg-[#040406] text-white selection:bg-primary selection:text-[#080808]">
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 pt-28 pb-16">
        {/* Admin Navigation Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8 border-b border-white/10 pb-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary mb-2">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-widest">
                Admin Console
              </span>
            </div>
            <h1 className="font-syne text-3xl font-extrabold tracking-tight">
              Feedback Inbox
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/admin"
              className="px-4 py-2 rounded-xl bg-neutral-900 border border-white/10 text-xs font-bold uppercase tracking-wider text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors flex items-center gap-1.5"
            >
              <ListFilter className="w-3.5 h-3.5" />
              Verifications
            </Link>
            <Link
              href="/admin/feedback"
              className="px-4 py-2 rounded-xl bg-primary text-black text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5 shadow-sm shadow-primary/20"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Feedback ({feedbackList.filter((f) => f.status === "open").length} open)
            </Link>
            <Link
              href="/admin/analytics/onboarding"
              className="px-4 py-2 rounded-xl bg-neutral-900 border border-white/10 text-xs font-bold uppercase tracking-wider text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors flex items-center gap-1.5"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Analytics
            </Link>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search user or message..."
              className="w-full bg-neutral-900/60 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-primary"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-neutral-500 shrink-0" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-neutral-900/60 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-primary"
            >
              <option value="all">All Statuses</option>
              <option value="open">Open / Received</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full bg-neutral-900/60 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-primary"
            >
              <option value="all">All Categories</option>
              <option value="bug">Bug / Problem</option>
              <option value="feature">Feature Suggestion</option>
              <option value="ui_ux">UI / UX Feedback</option>
              <option value="general">General Feedback</option>
            </select>
          </div>
        </div>

        {/* Main Master-Detail Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* List Column */}
          <div className="lg:col-span-5 space-y-3">
            {loading ? (
              <div className="flex flex-col items-center justify-center p-12 rounded-3xl border border-white/5 bg-neutral-900/30">
                <Loader2 className="w-6 h-6 animate-spin text-primary mb-2" />
                <p className="text-xs text-neutral-400">Loading feedback queue...</p>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center p-10 rounded-3xl border border-white/5 bg-neutral-900/30">
                <p className="text-xs text-neutral-400">No feedback matching current filters.</p>
              </div>
            ) : (
              filteredItems.map((item) => {
                const isSelected = selectedItem?.id === item.id;
                const replyCount = item.feedback_replies?.length || 0;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSelectedItem(item);
                      setReplyStatus(item.status === "open" ? "resolved" : item.status);
                    }}
                    className={`w-full text-left p-5 rounded-2xl border transition-all ${
                      isSelected
                        ? "bg-neutral-800/90 border-primary shadow-lg"
                        : "bg-neutral-900/40 border-white/5 hover:border-white/20 hover:bg-neutral-900/80"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        {getCategoryIcon(item.category)}
                        <span className="text-xs font-bold text-neutral-200 capitalize">
                          {item.category.replace("_", " ")}
                        </span>
                      </div>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                          item.status === "resolved"
                            ? "bg-primary/10 text-primary border-primary/20"
                            : item.status === "in_progress"
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                            : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>

                    <p className="text-xs text-neutral-300 line-clamp-2 leading-relaxed mb-3">
                      {item.message}
                    </p>

                    <div className="flex items-center justify-between text-[11px] text-neutral-500 pt-2 border-t border-white/5">
                      <span className="truncate max-w-[180px] text-neutral-400">
                        {item.user_email}
                      </span>
                      <div className="flex items-center gap-3">
                        {replyCount > 0 && (
                          <span className="text-primary font-bold">
                            {replyCount} {replyCount === 1 ? "reply" : "replies"}
                          </span>
                        )}
                        <span>
                          {new Date(item.created_at).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                          })}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Detail & Reply Column */}
          <div className="lg:col-span-7">
            {selectedItem ? (
              <div className="rounded-3xl border border-white/10 bg-neutral-900/50 p-6 sm:p-8 backdrop-blur-xl space-y-6">
                {/* Header */}
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-6">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      {getCategoryIcon(selectedItem.category)}
                      <span className="text-sm font-bold text-white uppercase tracking-wider">
                        {selectedItem.category.replace("_", " ")}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-neutral-400">
                      <User className="w-3.5 h-3.5 text-neutral-500" />
                      <span className="font-semibold text-white">{selectedItem.user_email}</span>
                      <span>•</span>
                      <span>
                        {new Date(selectedItem.created_at).toLocaleString("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Status Dropdown */}
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-neutral-400 font-bold uppercase">Status:</span>
                    <select
                      value={selectedItem.status}
                      onChange={(e) =>
                        handleQuickStatusChange(selectedItem.id, e.target.value as FeedbackStatus)
                      }
                      className="bg-neutral-950 border border-white/20 rounded-xl px-3 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-primary"
                    >
                      <option value="open">Open</option>
                      <option value="in_progress">In Progress</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </div>
                </div>

                {/* Original Message Box */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">
                    Original User Feedback
                  </h4>
                  <div className="p-5 rounded-2xl bg-neutral-950/80 border border-white/5 text-sm text-neutral-200 leading-relaxed whitespace-pre-wrap">
                    {selectedItem.message}
                  </div>
                </div>

                {/* Reply History */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-3 flex items-center gap-2">
                    <span>Reply History</span>
                    <span className="px-2 py-0.5 rounded-full bg-white/10 text-[10px] text-neutral-300">
                      {selectedItem.feedback_replies?.length || 0}
                    </span>
                  </h4>

                  {selectedItem.feedback_replies?.length === 0 ? (
                    <p className="text-xs text-neutral-500 italic p-3 rounded-xl bg-neutral-950/40 border border-white/5">
                      No replies sent yet. Compose a message below to notify the user.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {selectedItem.feedback_replies.map((reply) => (
                        <div
                          key={reply.id}
                          className="p-4 rounded-2xl bg-neutral-950 border border-primary/20 space-y-1.5"
                        >
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-bold text-primary flex items-center gap-1.5">
                              <Sparkles className="w-3 h-3" />
                              {reply.author_email} (Admin)
                            </span>
                            <span className="text-neutral-500 font-mono text-[10px]">
                              {new Date(reply.created_at).toLocaleString("en-IN", {
                                dateStyle: "medium",
                                timeStyle: "short",
                              })}
                            </span>
                          </div>
                          <p className="text-xs text-neutral-200 whitespace-pre-wrap leading-relaxed">
                            {reply.body}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Reply Form */}
                <form onSubmit={handleSendReply} className="pt-4 border-t border-white/10 space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                    <Send className="w-3.5 h-3.5 text-primary" />
                    Write Reply &amp; Notify Founder
                  </h4>

                  <textarea
                    rows={4}
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    placeholder="Write a clear, personalized response to the founder..."
                    className="w-full bg-neutral-950 border border-white/10 rounded-2xl p-4 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-primary transition-all resize-y min-h-[100px]"
                    required
                  />

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-neutral-400">Set status after reply:</span>
                      <select
                        value={replyStatus}
                        onChange={(e) => setReplyStatus(e.target.value as FeedbackStatus)}
                        className="bg-neutral-950 border border-white/20 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-primary"
                      >
                        <option value="resolved">Resolved</option>
                        <option value="in_progress">In Progress</option>
                        <option value="open">Keep Open</option>
                      </select>
                    </div>

                    <button
                      type="submit"
                      disabled={isSendingReply || replyBody.trim().length < 2}
                      className="px-6 py-2.5 rounded-xl bg-primary text-black text-xs font-bold uppercase tracking-wider flex items-center gap-2 hover:bg-[#a8e630] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSendingReply ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Sending &amp; Emailing...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>Send Reply</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-16 rounded-3xl border border-white/5 bg-neutral-900/30 text-center">
                <MessageSquare className="w-12 h-12 text-neutral-600 mb-3" />
                <h3 className="font-syne text-lg font-bold text-white mb-1">Select a Submission</h3>
                <p className="text-xs text-neutral-400 max-w-xs">
                  Choose a feedback item from the list on the left to read details and send a reply.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
