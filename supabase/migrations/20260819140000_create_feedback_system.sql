-- 20260819140000_create_feedback_system.sql
-- Production-grade user feedback & admin reply system

-- 1. Create feedback table
CREATE TABLE IF NOT EXISTS public.feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user_email TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('bug', 'feature', 'ui_ux', 'general')),
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create feedback_replies table
CREATE TABLE IF NOT EXISTS public.feedback_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feedback_id UUID NOT NULL REFERENCES public.feedback(id) ON DELETE CASCADE,
    author_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    author_email TEXT NOT NULL,
    is_admin BOOLEAN NOT NULL DEFAULT false,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Create indexes for high-performance lookups & timeline rendering
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON public.feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON public.feedback(status);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON public.feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_replies_feedback_id ON public.feedback_replies(feedback_id, created_at ASC);

-- 4. Enable Row Level Security
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_replies ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for feedback table
-- Users can view only their own feedback submissions
CREATE POLICY "Users can view own feedback"
    ON public.feedback
    FOR SELECT
    USING (auth.uid() = user_id);

-- Authenticated users can insert feedback for their own user_id
CREATE POLICY "Users can insert own feedback"
    ON public.feedback
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- 6. RLS Policies for feedback_replies table
-- Users can view replies attached to feedback they authored
CREATE POLICY "Users can view replies for own feedback"
    ON public.feedback_replies
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.feedback
            WHERE public.feedback.id = public.feedback_replies.feedback_id
              AND public.feedback.user_id = auth.uid()
        )
    );
