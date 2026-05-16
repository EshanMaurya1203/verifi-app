import { supabaseServer } from "@/lib/supabase-server";
import { Navbar } from "@/components/layout/Navbar";
import { EditFounderForm } from "./EditFounderForm";
import { AlertTriangle } from "lucide-react";

export default async function EditStartupProfile({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  const slug = decodeURIComponent(resolvedParams.slug);

  let query = supabaseServer.from("startup_submissions").select("*");
  if (!isNaN(Number(slug))) {
    query = query.eq("id", Number(slug));
  } else {
    query = query.ilike("startup_name", slug);
  }
  
  const { data: startup, error } = await query.maybeSingle();

  if (error || !startup) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white font-sans flex flex-col items-center justify-center">
        <Navbar />
        <AlertTriangle className="w-12 h-12 text-neutral-600 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Profile Not Found</h1>
        <p className="text-neutral-400">The requested startup profile could not be located.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white font-sans">
      <Navbar />
      <main className="max-w-2xl mx-auto px-6 pt-32 pb-24">
        <div className="mb-8">
          <h1 className="text-3xl font-black uppercase tracking-tighter mb-2">Edit Identity</h1>
          <p className="text-neutral-400 text-sm">
            Update the public facing identity for {startup.startup_name}.
          </p>
        </div>
        
        <EditFounderForm startup={startup} slug={slug} />
      </main>
    </div>
  );
}
