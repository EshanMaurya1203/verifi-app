"use client";

import React, { useState } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface EditFounderFormProps {
  startup: any;
  slug: string;
}

export function EditFounderForm({ startup, slug }: EditFounderFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  
  const [formData, setFormData] = useState({
    startup_logo: startup.startup_logo || "",
    founder_name: startup.founder_name || "",
    founder_avatar: startup.founder_avatar || "",
    founder_bio: startup.founder_bio || "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);

    try {
      const res = await fetch(`/api/startup/${startup.id}/identity`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!res.ok) throw new Error("Failed to update identity");
      
      setSuccess(true);
      setTimeout(() => {
        router.push(`/startup/${slug}`);
        router.refresh();
      }, 1500);
      
    } catch (err) {
      console.error(err);
      alert("An error occurred while updating the profile.");
    } finally {
      setLoading(false);
    }
  };

  return (
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
            placeholder="https://example.com/logo.png"
            className="w-full bg-neutral-950 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
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
            placeholder="Jane Doe"
            className="w-full bg-neutral-950 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
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
            placeholder="https://example.com/avatar.png"
            className="w-full bg-neutral-950 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
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
            placeholder="Tell us about your journey..."
            rows={4}
            className="w-full bg-neutral-950 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors resize-none"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-3 bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-500/50 text-white rounded-xl text-sm font-bold tracking-widest uppercase transition-colors flex items-center justify-center min-w-[140px]"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            "Save Changes"
          )}
        </button>

        <button
          type="button"
          onClick={() => router.push(`/startup/${slug}`)}
          className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-sm font-bold tracking-widest uppercase transition-colors"
        >
          Cancel
        </button>

        {success && (
          <span className="flex items-center gap-2 text-emerald-400 text-sm font-bold animate-in fade-in slide-in-from-left-2">
            <CheckCircle2 className="w-5 h-5" /> Saved!
          </span>
        )}
      </div>
    </form>
  );
}
