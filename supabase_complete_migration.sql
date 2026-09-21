-- ============================================================
-- TheAgriDoctor - Complete Database Migration with Row Level Security (RLS)
-- Run this entire script in Supabase SQL Editor
-- (Supabase Dashboard > SQL Editor > New Query > Paste & Run)
-- ============================================================

-- ============================================================
-- 1. USERS TABLE (Extends auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  phone TEXT,
  state TEXT,
  district TEXT,
  preferred_language TEXT,
  alert_preferences JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 2. FARMS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.farms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  total_area_acres NUMERIC,
  lat NUMERIC,
  lng NUMERIC,
  soil_type TEXT,
  water_source TEXT,
  agro_polygon_id TEXT,
  polygon_geojson JSONB,
  polygon_area_ha NUMERIC,
  polygon_radius_m INTEGER DEFAULT 300,
  last_scan_at TIMESTAMP WITH TIME ZONE,
  latest_monitor_snapshot JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 3. CROP CYCLES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.crop_cycles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  farm_id UUID REFERENCES public.farms(id) ON DELETE CASCADE NOT NULL,
  crop_name TEXT NOT NULL,
  variety TEXT,
  sown_date DATE,
  expected_harvest_date DATE,
  growth_stage TEXT DEFAULT 'seedling' CHECK (growth_stage IN ('seedling', 'vegetative', 'flowering', 'fruiting', 'harvest', 'harvested')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'harvested', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 4. DIAGNOSES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.diagnoses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  crop_type TEXT NOT NULL,
  image_urls TEXT[] NOT NULL DEFAULT '{}',
  disease_name TEXT,
  confidence_pct NUMERIC,
  severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  full_report_json JSONB,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 5. CHAT SESSIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.chat_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL DEFAULT 'New Conversation',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 6. CHAT MESSAGES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.chat_sessions(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 7. COMMUNITY POSTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.community_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  crop_tag TEXT,
  tags TEXT[] DEFAULT '{}',
  image_urls TEXT[] DEFAULT '{}',
  upvotes INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 8. COMMUNITY REPLIES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.community_replies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES public.community_posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  is_ai BOOLEAN NOT NULL DEFAULT FALSE,
  content TEXT NOT NULL,
  upvotes INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 9. NOTIFICATIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('info', 'warning', 'alert', 'success')),
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 10. CROP TASKS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.crop_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  crop_cycle_id UUID REFERENCES public.crop_cycles(id) ON DELETE CASCADE NOT NULL,
  task_name TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  completed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- INDEXES FOR QUERY OPTIMIZATION
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_farms_user_id ON public.farms(user_id);
CREATE INDEX IF NOT EXISTS idx_diagnoses_user_id ON public.diagnoses(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON public.chat_sessions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON public.chat_messages(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_community_posts_created ON public.community_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_replies_post ON public.community_replies(post_id, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crop_tasks_crop_cycle ON public.crop_tasks(crop_cycle_id, due_date);

-- ============================================================
-- DATABASE TRIGGER FOR AUTO USER PROFILE CREATION
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, full_name, created_at)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', now())
  ON CONFLICT (id) DO UPDATE 
    SET full_name = COALESCE(EXCLUDED.full_name, users.full_name);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ============================================================
-- STORAGE BUCKET: diagnosis-images
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'diagnosis-images', 
  'diagnosis-images', 
  false,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies
DROP POLICY IF EXISTS "Authenticated users can upload diagnosis images" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own diagnosis images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own diagnosis images" ON storage.objects;

CREATE POLICY "Authenticated users can upload diagnosis images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'diagnosis-images' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view own diagnosis images"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'diagnosis-images' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own diagnosis images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'diagnosis-images' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

-- 1. users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view profiles" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;

CREATE POLICY "Users can view profiles" ON public.users
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own profile" ON public.users
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE TO authenticated USING (auth.uid() = id);

-- 2. farms
ALTER TABLE public.farms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own farms" ON public.farms;

CREATE POLICY "Users can manage own farms" ON public.farms
  FOR ALL TO authenticated 
  USING (auth.uid() = user_id) 
  WITH CHECK (auth.uid() = user_id);

-- 3. crop_cycles
ALTER TABLE public.crop_cycles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own crop cycles" ON public.crop_cycles;

CREATE POLICY "Users can manage own crop cycles" ON public.crop_cycles
  FOR ALL TO authenticated 
  USING (farm_id IN (SELECT id FROM public.farms WHERE user_id = auth.uid()))
  WITH CHECK (farm_id IN (SELECT id FROM public.farms WHERE user_id = auth.uid()));

-- 4. diagnoses
ALTER TABLE public.diagnoses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own diagnoses" ON public.diagnoses;

CREATE POLICY "Users can manage own diagnoses" ON public.diagnoses
  FOR ALL TO authenticated 
  USING (auth.uid() = user_id) 
  WITH CHECK (auth.uid() = user_id);

-- 5. chat_sessions
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own chat sessions" ON public.chat_sessions;

CREATE POLICY "Users can manage own chat sessions" ON public.chat_sessions
  FOR ALL TO authenticated 
  USING (auth.uid() = user_id) 
  WITH CHECK (auth.uid() = user_id);

-- 6. chat_messages
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own chat messages" ON public.chat_messages;

CREATE POLICY "Users can manage own chat messages" ON public.chat_messages
  FOR ALL TO authenticated 
  USING (session_id IN (SELECT id FROM public.chat_sessions WHERE user_id = auth.uid()))
  WITH CHECK (session_id IN (SELECT id FROM public.chat_sessions WHERE user_id = auth.uid()));

-- 7. community_posts
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone authenticated can view posts" ON public.community_posts;
DROP POLICY IF EXISTS "Users can insert own posts" ON public.community_posts;
DROP POLICY IF EXISTS "Users can update own posts" ON public.community_posts;
DROP POLICY IF EXISTS "Users can delete own posts" ON public.community_posts;

CREATE POLICY "Anyone authenticated can view posts" ON public.community_posts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own posts" ON public.community_posts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own posts" ON public.community_posts
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own posts" ON public.community_posts
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 8. community_replies
ALTER TABLE public.community_replies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone authenticated can view replies" ON public.community_replies;
DROP POLICY IF EXISTS "Authenticated users can insert replies" ON public.community_replies;
DROP POLICY IF EXISTS "Users can update own replies" ON public.community_replies;
DROP POLICY IF EXISTS "Users can delete own replies" ON public.community_replies;

CREATE POLICY "Anyone authenticated can view replies" ON public.community_replies
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert replies" ON public.community_replies
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR is_ai = true);
CREATE POLICY "Users can update own replies" ON public.community_replies
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own replies" ON public.community_replies
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 9. notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own notifications" ON public.notifications;

CREATE POLICY "Users can manage own notifications" ON public.notifications
  FOR ALL TO authenticated 
  USING (auth.uid() = user_id) 
  WITH CHECK (auth.uid() = user_id);

-- 10. crop_tasks
ALTER TABLE public.crop_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own crop tasks" ON public.crop_tasks;

CREATE POLICY "Users can manage own crop tasks" ON public.crop_tasks
  FOR ALL TO authenticated 
  USING (crop_cycle_id IN (
    SELECT cc.id FROM public.crop_cycles cc 
    JOIN public.farms f ON cc.farm_id = f.id 
    WHERE f.user_id = auth.uid()
  ))
  WITH CHECK (crop_cycle_id IN (
    SELECT cc.id FROM public.crop_cycles cc 
    JOIN public.farms f ON cc.farm_id = f.id 
    WHERE f.user_id = auth.uid()
  ));

-- ============================================================
-- VERIFICATION QUERY
-- ============================================================
SELECT 
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  (SELECT COUNT(*) FROM pg_policy p WHERE p.polrelid = c.oid) AS policy_count
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' 
  AND c.relkind = 'r'
ORDER BY c.relname;
