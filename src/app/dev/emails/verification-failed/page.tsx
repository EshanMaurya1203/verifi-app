import * as React from "react";
import { render } from "@react-email/render";
import VerificationFailedEmail, { defaultSubject } from "@/emails/VerificationFailed";
import { mockVerificationFailedProps } from "@/emails/mocks/verificationFailed";

export default async function VerificationFailedPreviewPage() {
  const html = await render(<VerificationFailedEmail {...mockVerificationFailedProps} />);
  
  return (
    <div className="flex flex-col h-full">
      <div className="bg-neutral-900 border-b border-neutral-800 p-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium text-neutral-400">Template</h2>
          <p className="text-base text-white font-semibold">Verification Failed</p>
        </div>
        <div className="text-right">
          <h2 className="text-sm font-medium text-neutral-400">Subject</h2>
          <p className="text-base text-white font-mono text-sm bg-neutral-950 px-3 py-1 rounded-md border border-neutral-800">
            {defaultSubject}
          </p>
        </div>
      </div>
      <div className="flex-1 overflow-hidden bg-[#0a0a0a]">
        <iframe
          srcDoc={html}
          title="Email Preview"
          className="w-full h-full border-0"
        />
      </div>
    </div>
  );
}
