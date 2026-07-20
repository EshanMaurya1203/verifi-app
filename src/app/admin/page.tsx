import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { isAdmin } from "@/lib/isAdmin";
import { AdminClient } from "./AdminClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin Dashboard",
};

export default async function AdminPage() {
  const user = await getAuthenticatedUser();
  
  if (!user || !isAdmin(user.email)) {
    redirect("/");
  }

  return <AdminClient />;
}
