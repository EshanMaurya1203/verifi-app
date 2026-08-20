"use server";

import { cookies } from "next/headers";
import { getAuthenticatedUser } from "@/lib/auth-server";
import {
  verifyReauthProof,
  signReauthIntent,
  isValidReauthAction,
  REAUTH_PROOF_COOKIE_NAME,
} from "@/lib/reauth-proof";

/**
 * Server action to generate an HMAC-signed re-authentication intent token.
 * Ensures intent signing occurs exclusively on the server with server-side ENCRYPTION_SECRET.
 */
export async function createReauthIntentAction(action: string) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { success: false, error: "Authentication required to initiate re-authentication." };
  }

  if (!isValidReauthAction(action)) {
    return { success: false, error: "Invalid target re-authentication action." };
  }

  try {
    const intentToken = signReauthIntent(action);
    return { success: true, intentToken };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to generate security re-authentication intent." };
  }
}

/**
 * Server action to passively verify a re-authentication proof cookie for UI state rendering.
 * Does NOT delete or consume the cookie, preserving it for the subsequent destructive API call.
 */
export async function checkReauthProofAction(action: string) {
  const cookieStore = await cookies();
  const proofCookie = cookieStore.get(REAUTH_PROOF_COOKIE_NAME)?.value;

  const user = await getAuthenticatedUser();
  if (!user) {
    return { valid: false, reason: "User session expired or invalid." };
  }

  return verifyReauthProof(proofCookie, user.id, action);
}

/**
 * @deprecated Use checkReauthProofAction for passive validation; consumption occurs at the destructive API boundary.
 */
export async function consumeReauthProofAction(action: string) {
  return checkReauthProofAction(action);
}

