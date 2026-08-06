import { notFound } from "next/navigation";
import { Mail } from "lucide-react";
import * as React from "react";

export default function DevEmailsIndex() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <div className="flex-1 flex items-center justify-center h-full">
      <div className="text-center max-w-md p-6">
        <div className="mx-auto w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center mb-4">
          <Mail className="h-6 w-6 text-indigo-400" />
        </div>
        <h1 className="text-xl font-medium text-white mb-2">Email Design System</h1>
        <p className="text-neutral-400 text-sm">
          Select a template from the sidebar to preview how it renders. 
          These previews use realistic mock data and do not send real emails.
        </p>
      </div>
    </div>
  );
}
