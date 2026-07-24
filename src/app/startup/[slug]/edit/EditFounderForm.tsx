"use client";

import React, { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { safeFetch } from "@/lib/safe-network";
import { toast } from "sonner";
import { z } from "zod";

interface EditFounderFormProps {
  startup: any;
  slug: string;
}

const urlSchema = z
  .string()
  .trim()
  .max(500)
  .url()
  .refine(
    (url) => {
      try {
        const parsed = new URL(url);
        return parsed.protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "Must be a valid HTTPS URL" }
  )
  .or(z.literal(""));

const identitySchema = z.object({
  founder_name: z.string().trim().min(1, "Name is required").max(120),
  founder_bio: z.string().trim().max(2000).optional().default(""),
  founder_avatar: urlSchema.optional().default(""),
  startup_logo: urlSchema.optional().default(""),
  is_public: z.boolean(),
});

export function EditFounderForm({ startup, slug }: EditFounderFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    startup_logo: startup.startup_logo || "",
    founder_name: startup.founder_name || "",
    founder_avatar: startup.founder_avatar || "",
    founder_bio: startup.founder_bio || "",
    is_public: startup.is_public ?? false,
  });

  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    setIsDirty(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    const validation = identitySchema.safeParse(formData);
    if (!validation.success) {
      setLoading(false);
      const firstError = Object.values(validation.error.flatten().fieldErrors)[0]?.[0];
      toast.error(firstError || "Invalid input");
      return;
    }

    try {
      const { ok, error } = await safeFetch<any>(`/api/startup/${startup.id}/identity`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(validation.data),
      });

      if (!ok) throw error || new Error("Failed to update identity");
      
      setIsDirty(false);
      toast.success("Changes saved successfully");
      
      setTimeout(() => {
        router.push(`/startup/${slug}`);
        router.refresh();
      }, 1500);
      
    } catch (err: any) {
      setErrorMsg(err.message || "An error occurred while updating the profile.");
      toast.error("Failed to save changes");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <ErrorBanner message={errorMsg} onClose={() => setErrorMsg(null)} className="mb-4" />
      <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-neutral-900/50 border border-white/5 p-6 rounded-3xl space-y-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-neutral-400 mb-2">
            Startup Logo URL
          </label>
          <input
            type="url"
            name="startup_logo"
            value={formData.startup_logo}
            onChange={handleChange}
            maxLength={500}
            placeholder="https://example.com/logo.png"
            className="w-full bg-neutral-950 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary transition-colors"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-neutral-400 mb-2">
            Founder Name
          </label>
          <input
            type="text"
            name="founder_name"
            value={formData.founder_name}
            onChange={handleChange}
            maxLength={120}
            placeholder="Jane Doe"
            className="w-full bg-neutral-950 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary transition-colors"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-neutral-400 mb-2">
            Founder Avatar URL
          </label>
          <input
            type="url"
            name="founder_avatar"
            value={formData.founder_avatar}
            onChange={handleChange}
            maxLength={500}
            placeholder="https://example.com/avatar.png"
            className="w-full bg-neutral-950 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary transition-colors"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-neutral-400 mb-2">
            Founder Bio
          </label>
          <textarea
            name="founder_bio"
            value={formData.founder_bio}
            onChange={handleChange}
            maxLength={2000}
            placeholder="Tell us about your journey..."
            rows={4}
            className="w-full bg-neutral-950 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary transition-colors resize-none"
          />
        </div>

        <div className="pt-4 border-t border-white/5">
          <label className="flex items-center gap-3 cursor-pointer group">
            <input
              type="checkbox"
              name="is_public"
              checked={formData.is_public}
              onChange={handleChange}
              className="w-5 h-5 rounded border-white/20 bg-neutral-950 text-primary focus:ring-primary focus:ring-offset-0 transition-all cursor-pointer"
            />
            <div>
              <span className="block text-sm font-bold text-white group-hover:text-primary transition-colors">Public Profile</span>
              <span className="block text-xs text-neutral-400 mt-0.5">When enabled, your startup profile can appear on public surfaces such as the leaderboard and search engines.</span>
            </div>
          </label>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={loading || !isDirty}
          className="px-6 py-3 bg-primary hover:bg-[#a8e630] disabled:bg-primary/50 text-primary-foreground rounded-xl text-sm font-bold tracking-widest uppercase transition-colors flex items-center justify-center min-w-[140px]"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            "Save Changes"
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            if (isDirty && !window.confirm("You have unsaved changes. Are you sure you want to discard them?")) return;
            router.push(`/startup/${slug}`);
          }}
          className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-sm font-bold tracking-widest uppercase transition-colors"
        >
          Cancel
        </button>
      </div>
      </form>
    </div>
  );
}
