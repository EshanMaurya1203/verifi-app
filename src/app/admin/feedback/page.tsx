import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { isAdmin } from "@/lib/isAdmin";
import { AdminFeedbackClient } from "./AdminFeedbackClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Feedback Inbox | Admin",
  description: "Manage and reply to user feedback submissions.",
};

export const dynamic = "force-dynamic";

export default async function AdminFeedbackPage() {
  const user = await getAuthenticatedUser();

  if (!user || !isAdmin(user.email)) {
    redirect("/");
  }

  return <AdminFeedbackClient adminEmail={user.email || ""} />;
}
