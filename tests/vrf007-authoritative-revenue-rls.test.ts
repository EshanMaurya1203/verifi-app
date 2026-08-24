import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("VRF-007 — Authoritative Revenue RLS & Privilege Boundary Test Suite", () => {
  const migrationPath = path.resolve(
    __dirname,
    "../supabase/migrations/20260825000000_harden_authoritative_revenue_rls.sql"
  );

  it("T01: VRF-007 migration file exists and is non-empty", () => {
    assert.ok(fs.existsSync(migrationPath), "Migration file must exist");
    const sql = fs.readFileSync(migrationPath, "utf8");
    assert.ok(sql.trim().length > 0, "Migration file must not be empty");
  });

  it("T02: Migration is wrapped in an atomic transaction (BEGIN / COMMIT)", () => {
    const sql = fs.readFileSync(migrationPath, "utf8");
    assert.match(sql, /^\s*BEGIN\s*;/m, "Migration must start with BEGIN;");
    assert.match(sql, /COMMIT\s*;\s*$/m, "Migration must end with COMMIT;");
  });

  it("T03: Row Level Security is explicitly enabled on public.revenue_snapshots", () => {
    const sql = fs.readFileSync(migrationPath, "utf8");
    assert.match(
      sql,
      /ALTER\s+TABLE\s+public\.revenue_snapshots\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY\s*;/i,
      "Must enable RLS on public.revenue_snapshots"
    );
  });

  it("T04: Row Level Security is explicitly enabled on public.revenue_transactions", () => {
    const sql = fs.readFileSync(migrationPath, "utf8");
    assert.match(
      sql,
      /ALTER\s+TABLE\s+public\.revenue_transactions\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY\s*;/i,
      "Must enable RLS on public.revenue_transactions"
    );
  });

  it("T05: Row Level Security is explicitly enabled on public.verification_logs", () => {
    const sql = fs.readFileSync(migrationPath, "utf8");
    assert.match(
      sql,
      /ALTER\s+TABLE\s+public\.verification_logs\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY\s*;/i,
      "Must enable RLS on public.verification_logs"
    );
  });

  it("T06: Historical permissive public policy on revenue_snapshots is dropped", () => {
    const sql = fs.readFileSync(migrationPath, "utf8");
    assert.match(
      sql,
      /DROP\s+POLICY\s+IF\s+EXISTS\s+"Service\s+role\s+can\s+manage\s+revenue_snapshots"\s+ON\s+public\.revenue_snapshots\s*;/i,
      "Must drop historical permissive policy 'Service role can manage revenue_snapshots'"
    );
  });

  it("T07: Stale/redundant policy names are safely dropped for all target tables", () => {
    const sql = fs.readFileSync(migrationPath, "utf8");
    assert.match(sql, /DROP\s+POLICY\s+IF\s+EXISTS\s+"revenue_snapshots_service_role"\s+ON\s+public\.revenue_snapshots\s*;/i);
    assert.match(sql, /DROP\s+POLICY\s+IF\s+EXISTS\s+"revenue_snapshots_deny_public"\s+ON\s+public\.revenue_snapshots\s*;/i);
    assert.match(sql, /DROP\s+POLICY\s+IF\s+EXISTS\s+"revenue_transactions_service_role"\s+ON\s+public\.revenue_transactions\s*;/i);
    assert.match(sql, /DROP\s+POLICY\s+IF\s+EXISTS\s+"revenue_transactions_deny_public"\s+ON\s+public\.revenue_transactions\s*;/i);
    assert.match(sql, /DROP\s+POLICY\s+IF\s+EXISTS\s+"verification_logs_service_role"\s+ON\s+public\.verification_logs\s*;/i);
    assert.match(sql, /DROP\s+POLICY\s+IF\s+EXISTS\s+"verification_logs_deny_public"\s+ON\s+public\.verification_logs\s*;/i);
  });

  it("T08: Table privileges are explicitly revoked from PUBLIC for all 3 authoritative tables", () => {
    const sql = fs.readFileSync(migrationPath, "utf8");
    assert.match(
      sql,
      /REVOKE\s+ALL\s+ON\s+TABLE\s+[\s\S]*?public\.revenue_snapshots[\s\S]*?public\.revenue_transactions[\s\S]*?public\.verification_logs[\s\S]*?FROM\s+PUBLIC\s*;/i,
      "Must revoke ALL on all 3 tables from PUBLIC"
    );
  });

  it("T09: Table privileges are explicitly revoked from anon for all 3 authoritative tables", () => {
    const sql = fs.readFileSync(migrationPath, "utf8");
    assert.match(
      sql,
      /REVOKE\s+ALL\s+ON\s+TABLE\s+[\s\S]*?public\.revenue_snapshots[\s\S]*?public\.revenue_transactions[\s\S]*?public\.verification_logs[\s\S]*?FROM\s+anon\s*;/i,
      "Must revoke ALL on all 3 tables from anon"
    );
  });

  it("T10: Table privileges are explicitly revoked from authenticated for all 3 authoritative tables", () => {
    const sql = fs.readFileSync(migrationPath, "utf8");
    assert.match(
      sql,
      /REVOKE\s+ALL\s+ON\s+TABLE\s+[\s\S]*?public\.revenue_snapshots[\s\S]*?public\.revenue_transactions[\s\S]*?public\.verification_logs[\s\S]*?FROM\s+authenticated\s*;/i,
      "Must revoke ALL on all 3 tables from authenticated"
    );
  });

  it("T11: Full table privileges are explicitly granted to service_role for all 3 authoritative tables", () => {
    const sql = fs.readFileSync(migrationPath, "utf8");
    assert.match(
      sql,
      /GRANT\s+ALL\s+ON\s+TABLE\s+[\s\S]*?public\.revenue_snapshots[\s\S]*?public\.revenue_transactions[\s\S]*?public\.verification_logs[\s\S]*?TO\s+service_role\s*;/i,
      "Must grant ALL on all 3 tables to service_role"
    );
  });

  it("T12: No permissive CREATE POLICY statements exist in the migration", () => {
    const sql = fs.readFileSync(migrationPath, "utf8");
    assert.ok(
      !/CREATE\s+POLICY/i.test(sql),
      "Must not create unnecessary or permissive policies in the hardening migration"
    );
  });

  it("T13: Migration does NOT perform destructive schema or data mutations", () => {
    const sql = fs.readFileSync(migrationPath, "utf8");
    assert.ok(!/DROP\s+TABLE/i.test(sql), "Must not DROP TABLE");
    assert.ok(!/TRUNCATE/i.test(sql), "Must not TRUNCATE");
    assert.ok(!/DELETE\s+FROM/i.test(sql), "Must not DELETE FROM");
    assert.ok(!/ALTER\s+TABLE\s+.*?\s+DROP\s+COLUMN/i.test(sql), "Must not DROP COLUMN");
    assert.ok(!/ALTER\s+TABLE\s+.*?\s+RENAME/i.test(sql), "Must not RENAME table or column");
  });

  it("T14: Static scan confirms all 3 authoritative tables are covered across RLS, REVOKE, and GRANT", () => {
    const sql = fs.readFileSync(migrationPath, "utf8");
    const requiredTables = [
      "public.revenue_snapshots",
      "public.revenue_transactions",
      "public.verification_logs",
    ];
    for (const tbl of requiredTables) {
      assert.ok(sql.includes(tbl), `Migration must cover table ${tbl}`);
    }
  });

  it("T15: Migration 20260823180000 explicitly casts UUID user_id::text for pattern matching", () => {
    const demoMigrationPath = path.resolve(
      __dirname,
      "../supabase/migrations/20260823180000_exclude_demo_from_public_select.sql"
    );
    assert.ok(fs.existsSync(demoMigrationPath), "20260823180000 migration must exist");
    const sql = fs.readFileSync(demoMigrationPath, "utf8");
    assert.match(
      sql,
      /user_id::text\s+NOT\s+LIKE\s+'00000000-0000-0000-0000-%'/i,
      "Must cast UUID user_id::text to prevent PostgreSQL 42883 operator error"
    );
  });
});
