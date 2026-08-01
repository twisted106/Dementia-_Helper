-- ====================================================================
-- SECOND SIGHT - FULL DATABASE SETUP (SUPABASE)
-- Copy and paste everything below into your Supabase SQL Editor and click RUN.
-- ====================================================================

-- 1. Create PROFILES table (Stores faces, names, relations)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  relation text NOT NULL,
  face_descriptor float8[] NOT NULL,
  last_summary text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- If profiles was previously created with jsonb, alter it safely:
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'face_descriptor' AND data_type = 'jsonb'
  ) THEN
    ALTER TABLE public.profiles DROP COLUMN face_descriptor;
    ALTER TABLE public.profiles ADD COLUMN face_descriptor float8[] NOT NULL DEFAULT '{}';
  END IF;
END $$;

-- 2. Create MEMORIES table (Stores conversation history logs)
CREATE TABLE IF NOT EXISTS public.memories (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  person_name text,
  transcript text,
  summary text,
  confidence numeric DEFAULT 95,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;

-- 4. Set Permissive Policies for Web Client
DROP POLICY IF EXISTS "Allow public read access on profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow public insert access on profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow public update access on profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow public delete access on profiles" ON public.profiles;

CREATE POLICY "Allow public read access on profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on profiles" ON public.profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access on profiles" ON public.profiles FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access on profiles" ON public.profiles FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow public read access on memories" ON public.memories;
DROP POLICY IF EXISTS "Allow public insert access on memories" ON public.memories;
DROP POLICY IF EXISTS "Allow public update access on memories" ON public.memories;
DROP POLICY IF EXISTS "Allow public delete access on memories" ON public.memories;

CREATE POLICY "Allow public read access on memories" ON public.memories FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on memories" ON public.memories FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access on memories" ON public.memories FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access on memories" ON public.memories FOR DELETE USING (true);

-- 5. Helper function to wipe all data cleanly if needed
CREATE OR REPLACE FUNCTION clear_all_data()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  TRUNCATE TABLE public.profiles, public.memories;
$$;

-- 6. Server-Side Vector Matching Function
-- Computes Euclidean distance directly inside PostgreSQL with tight precision.
CREATE OR REPLACE FUNCTION match_face(
  query_embedding float8[],
  match_threshold float8 DEFAULT 0.50
)
RETURNS TABLE (
  id uuid,
  name text,
  relation text,
  last_summary text,
  distance float8
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    p.id,
    p.name,
    p.relation,
    p.last_summary,
    (SELECT sqrt(sum((x - y) * (x - y))) FROM unnest(p.face_descriptor, query_embedding) AS t(x, y)) AS distance
  FROM public.profiles p
  WHERE (SELECT sqrt(sum((x - y) * (x - y))) FROM unnest(p.face_descriptor, query_embedding) AS t(x, y)) < match_threshold
  ORDER BY distance ASC
  LIMIT 1;
$$;

