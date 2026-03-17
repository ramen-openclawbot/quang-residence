-- =============================================
-- ZenHome Chat Inbox — Phase 2 Migration
-- Run in Supabase SQL Editor when ready to persist messages
-- =============================================

-- Chat messages (one inbox per user)
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'agent')),
  content TEXT,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'ocr_result', 'transaction_created', 'action_prompt')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Users can only see their own messages
DROP POLICY IF EXISTS "chat_select_own" ON public.chat_messages;
CREATE POLICY "chat_select_own" ON public.chat_messages
  FOR SELECT USING (user_id = auth.uid());

-- Users can only insert their own messages
DROP POLICY IF EXISTS "chat_insert_own" ON public.chat_messages;
CREATE POLICY "chat_insert_own" ON public.chat_messages
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Service role can insert agent messages (via API)
-- (supabaseAdmin bypasses RLS, so no extra policy needed)

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chat_messages_user ON public.chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON public.chat_messages(created_at);
