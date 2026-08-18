-- Migration: Add partial unique index for Investor Report concurrency & race condition defense.
-- Enforces that at most ONE pending order can exist per (user_id, startup_id) across all application instances.
-- Once an order is paid, failed, or refunded, it exits this partial index, allowing future report purchases.

CREATE UNIQUE INDEX IF NOT EXISTS idx_investor_reports_pending_unique
ON public.investor_reports (user_id, startup_id)
WHERE payment_status = 'pending';
