-- Migration: Create investor_reports table and storage bucket
-- Commercial Model: ₹499 One-Time Add-On (No subscription required)

-- 1. Create investor_reports table
CREATE TABLE IF NOT EXISTS public.investor_reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    startup_id bigint NOT NULL REFERENCES public.startup_submissions(id) ON DELETE CASCADE,
    amount_inr integer NOT NULL DEFAULT 499,
    currency text NOT NULL DEFAULT 'INR',
    razorpay_order_id text NOT NULL UNIQUE,
    razorpay_payment_id text UNIQUE,
    payment_status text NOT NULL DEFAULT 'pending'
        CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
    generation_status text NOT NULL DEFAULT 'pending'
        CHECK (generation_status IN ('pending', 'generating', 'completed', 'failed')),
    report_period text NOT NULL DEFAULT '30_days',
    metrics_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
    storage_path text,
    created_at timestamptz NOT NULL DEFAULT now(),
    paid_at timestamptz,
    completed_at timestamptz,
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT investor_reports_amount_check CHECK (amount_inr = 499),
    CONSTRAINT investor_reports_currency_check CHECK (currency = 'INR')
);

-- 2. Indices for query and relationship lookups
CREATE INDEX IF NOT EXISTS idx_investor_reports_user_id 
ON public.investor_reports(user_id);

CREATE INDEX IF NOT EXISTS idx_investor_reports_startup_id 
ON public.investor_reports(startup_id);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.investor_reports ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policy: Authenticated users can only read their own reports
DROP POLICY IF EXISTS "Users can view their own investor reports" ON public.investor_reports;
CREATE POLICY "Users can view their own investor reports"
ON public.investor_reports FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 5. Dedicated Private Storage Bucket for Investor Report PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('investor-reports', 'investor-reports', false)
ON CONFLICT (id) DO NOTHING;

-- 6. Storage RLS: Authenticated users can only read report PDFs in their own folder
DROP POLICY IF EXISTS "investor_reports_authenticated_select_own" ON storage.objects;
CREATE POLICY "investor_reports_authenticated_select_own"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'investor-reports' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
