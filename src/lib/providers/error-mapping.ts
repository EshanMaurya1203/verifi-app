import { ProviderError, ProviderApiErrorShape } from "./errors";

export interface ErrorMappingRule {
  match: (error: ProviderApiErrorShape | ProviderError) => boolean;
  message: string;
}

const providerMappings: Record<string, ErrorMappingRule[]> = {
  razorpay: [
    {
      match: (err) => {
        const oe = err.originalError;
        return (
          err.statusCode === 401 &&
          oe?.code === "BAD_REQUEST_ERROR" &&
          typeof oe?.description === "string" &&
          oe.description.includes("Authentication failed")
        );
      },
      message: `Live Razorpay authentication failed

Please make sure you are using LIVE Razorpay API credentials.

Common causes:
• Test Mode API keys
• Incorrect Key ID or Key Secret
• Regenerated or revoked API keys
• Live API access has not yet been enabled on your Razorpay account

Please verify your Live credentials and try again.`,
    },
  ],
  stripe: [
    // Future Stripe rules can be added here
  ],
};

/**
 * Maps technical provider errors to user-friendly messages for the UI.
 * Retains original status codes while improving clarity.
 */
export function getFriendlyErrorMessage(
  providerId: string,
  error: any
): string {
  // If it's a ProviderError or mapped ProviderApiErrorShape
  if (error && (error.name === "ProviderError" || typeof error.statusCode === "number")) {
    const rules = providerMappings[providerId] || [];
    for (const rule of rules) {
      if (rule.match(error as ProviderApiErrorShape | ProviderError)) {
        return rule.message;
      }
    }
  }

  // Fallback generic extraction
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error.message === "string") {
    return error.message;
  }

  return "Provider verification failed";
}
