import { NextResponse } from "next/server";
import { getClientIdentifier, checkRateLimit } from "@/lib/rate-limit";
import { supabaseServer } from "@/lib/supabase-server";
import { isAdmin } from "@/lib/isAdmin";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { encrypt, decrypt } from "@/lib/encryption";

/**
 * POST /api/admin/migrate-encryption
 *
 * Migrates legacy AES-256-CTR encrypted credentials to AES-256-GCM.
 * 
 * Security:
 *   - POST only (no GET to prevent prefetch/crawler triggers)
 *   - Authenticated via Bearer token / session cookie
 *   - Restricted to admin-allowlisted emails
 *   - Rate limited
 *   - Idempotent (skips already-migrated 3-part GCM records)
 *   - Writes audit log on completion
 */
export async function POST(req: Request) {
  // Rate limiting
  const identifier = getClientIdentifier(req);
  const { allowed } = checkRateLimit(identifier, 120000, 2);
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  // Authentication
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  // Admin authorization
  if (!isAdmin(user.email)) {
    return NextResponse.json({ error: "Forbidden — admin access required" }, { status: 403 });
  }

  try {
    // Fetch all provider connections
    const { data: connections, error: fetchError } = await supabaseServer
      .from("provider_connections")
      .select("id, api_key_encrypted, provider, startup_id");

    if (fetchError) {
      throw fetchError;
    }

    const results = {
      total: connections?.length ?? 0,
      migrated: 0,
      alreadyGcm: 0,
      errors: 0,
      errorDetails: [] as { connectionId: string; error: string }[],
    };

    for (const conn of connections || []) {
      try {
        const parts = conn.api_key_encrypted.split(":");

        if (parts.length === 3) {
          // Already AES-256-GCM format — idempotent skip
          results.alreadyGcm++;
          continue;
        }

        // Legacy format (2-part CTR or 1-part fixed-IV CTR)
        const plaintext = decrypt(conn.api_key_encrypted);
        const reEncrypted = encrypt(plaintext);

        const { error: updateError } = await supabaseServer
          .from("provider_connections")
          .update({ api_key_encrypted: reEncrypted })
          .eq("id", conn.id);

        if (updateError) {
          throw updateError;
        }

        results.migrated++;
      } catch (err) {
        console.error(`[migrate-encryption] Failed on connection ${conn.id}:`, err);
        results.errors++;
        results.errorDetails.push({
          connectionId: conn.id,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    // Audit log
    await supabaseServer.from("verification_logs").insert({
      startup_id: null,
      event: "encryption_migration_executed",
      metadata: {
        executedBy: user.email,
        total: results.total,
        migrated: results.migrated,
        alreadyGcm: results.alreadyGcm,
        errors: results.errors,
        timestamp: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      message: results.migrated > 0
        ? `Migration complete. ${results.migrated} record(s) upgraded to AES-256-GCM.`
        : "No legacy records found — all records already use AES-256-GCM.",
      results: {
        total: results.total,
        migrated: results.migrated,
        alreadyGcm: results.alreadyGcm,
        errors: results.errors,
      },
    });
  } catch (error: unknown) {
    console.error("[migrate-encryption] Migration error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Migration failed" },
      { status: 500 }
    );
  }
}
