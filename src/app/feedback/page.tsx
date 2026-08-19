import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { FeedbackClient } from "./FeedbackClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Give Feedback | Verifii",
  description: "Share your thoughts, suggestions, and bug reports with the Verifii team.",
};

export const dynamic = "force-dynamic";

export default async function FeedbackPage() {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/login?next=/feedback");
  }

  return <FeedbackClient userEmail={user.email || ""} />;
}
