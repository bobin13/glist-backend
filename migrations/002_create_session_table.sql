-- Session store for express-session via connect-pg-simple (added for Vercel deployment).
CREATE TABLE IF NOT EXISTS public.session (
  sid VARCHAR NOT NULL COLLATE "default" PRIMARY KEY,
  sess JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL
);

CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON public.session (expire);
