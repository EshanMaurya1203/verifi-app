import { Suspense } from "react";
import type { Metadata } from "next";
import { SignupClient } from "./SignupClient";

export const metadata: Metadata = {
  title: "Create Account | Verifii",
  description: "Sign up for Verifii to verify your startup revenue and earn a public trust badge.",
  alternates: {
    canonical: "https://www.verifii.in/signup",
  },
};

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#040406] flex items-center justify-center text-white">
          <div className="animate-pulse font-syne text-lg font-bold">Loading...</div>
        </div>
      }
    >
      <SignupClient />
    </Suspense>
  );
}
