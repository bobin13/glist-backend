-- Accounts, admin accounts and shared lists.
-- Additive and idempotent: safe to run more than once.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_disabled BOOLEAN NOT NULL DEFAULT false;

-- Who crossed an item off (shown on shared lists).
ALTER TABLE public.grocery_items
  ADD COLUMN IF NOT EXISTS removed_by UUID REFERENCES public.users (id) ON DELETE SET NULL;

-- Every list creator becomes the list's owner member (older lists had no member rows).
INSERT INTO public.list_members (list_id, user_id, role, joined_at)
SELECT id, created_by, 'owner', created_at
FROM public.grocery_lists
ON CONFLICT (list_id, user_id) DO UPDATE SET role = 'owner';

-- Make sure at least one admin exists: promote the oldest account if there is none.
UPDATE public.users
SET is_admin = true, updated_at = NOW()
WHERE id = (SELECT id FROM public.users ORDER BY created_at LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM public.users WHERE is_admin);

-- "Which lists can this user see" is the most common lookup.
CREATE INDEX IF NOT EXISTS list_members_user_idx ON public.list_members (user_id);
