ALTER TABLE public.grocery_items
ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ;
