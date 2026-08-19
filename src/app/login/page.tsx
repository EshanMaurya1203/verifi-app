import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginClient } from "./LoginClient";

export const metadata: Metadata = {
  title: "Sign In | Verifii",
  description: "Sign in to Verifii to access your startup dashboard and verified revenue metrics.",
  alternates: {
    canonical: "https://www.verifii.in/login",
  },
};

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#040406] flex items-center justify-center text-white">
          <div className="animate-pulse font-syne text-lg font-bold">Loading...</div>
        </div>
      }
    >
      <LoginClient />
    </Suspense>
  );
}
