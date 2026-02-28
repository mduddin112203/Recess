-- Recess App 

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing objects for clean slate
DROP VIEW IF EXISTS leaderboard_weekly;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
DROP TRIGGER IF EXISTS update_presence_updated_at ON presence;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS cleanup_expired_presence() CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS break_invitations CASCADE;
DROP TABLE IF EXISTS scheduled_breaks CASCADE;
DROP TABLE IF EXISTS break_history CASCADE;
DROP TABLE IF EXISTS user_blocks CASCADE;
DROP TABLE IF EXISTS points_log CASCADE;
DROP TABLE IF EXISTS schedule_blocks CASCADE;
DROP TABLE IF EXISTS presence CASCADE;
DROP TABLE IF EXISTS friendships CASCADE;
DROP TABLE IF EXISTS zones CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- Profiles
CREATE TABLE profiles (
  id             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name   TEXT NOT NULL DEFAULT '',
  friend_code    TEXT UNIQUE,
  campus_id      TEXT DEFAULT 'default',
  default_break_length INTEGER DEFAULT 25,
  privacy_friend_visibility  BOOLEAN DEFAULT true,
  privacy_public_zone_visibility BOOLEAN DEFAULT true,
  share_presence  BOOLEAN DEFAULT true,
  share_schedule  BOOLEAN DEFAULT true,
  avatar_url     TEXT,
  gender         TEXT,
  birthday       DATE,
  school         TEXT,
  timezone       TEXT DEFAULT 'America/New_York',
  theme_preference  TEXT DEFAULT 'system' CHECK (theme_preference IN ('system','light','dark')),
  onboarding_completed BOOLEAN DEFAULT false,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT USING (true);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can delete own profile"
  ON profiles FOR DELETE USING (auth.uid() = id);

-- Zones
CREATE TABLE zones (
  id         TEXT PRIMARY KEY,
  campus_id  TEXT NOT NULL DEFAULT 'default',
  name       TEXT NOT NULL,
  lat        DOUBLE PRECISION NOT NULL,
  lng        DOUBLE PRECISION NOT NULL,
  radius_m   INTEGER DEFAULT 50,
  type       TEXT NOT NULL DEFAULT 'campus' CHECK (type IN ('campus', 'custom')),
  icon       TEXT DEFAULT 'location-outline',
  address    TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view non-expired zones"
  ON zones FOR SELECT USING (
    type = 'campus' OR expires_at IS NULL OR expires_at > NOW()
  );

CREATE POLICY "Users can create custom zones"
  ON zones FOR INSERT WITH CHECK (
    type = 'custom' AND created_by = auth.uid()
  );

CREATE POLICY "Users can delete their own custom zones"
  ON zones FOR DELETE USING (
    type = 'custom' AND created_by = auth.uid()
  );

INSERT INTO zones (id, campus_id, name, lat, lng, radius_m, type, icon, address) VALUES
  ('library',        'default', 'Library',        40.74479, -74.02533, 100, 'campus', 'library-outline',  '1 Castle Point Terrace, Hoboken, NJ 07030'),
  ('student-center', 'default', 'Student Center', 40.74510, -74.02480,  80, 'campus', 'business-outline', '530 River St, Hoboken, NJ 07030'),
  ('gym',            'default', 'Gym',            40.74610, -74.02280, 120, 'campus', 'fitness-outline',  '800 Castle Point Terrace, Hoboken, NJ 07030'),
  ('cafe',           'default', 'Cafe',           40.74550, -74.02460,  50, 'campus', 'cafe-outline',     '618 River St, Hoboken, NJ 07030'),
  ('quad',           'default', 'Quad',           40.74540, -74.02410, 150, 'campus', 'leaf-outline',     'Stevens Institute of Technology, Hoboken, NJ 07030');

-- Friendships
CREATE TABLE friendships (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requester_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status        TEXT DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (requester_id, addressee_id)
);

CREATE INDEX idx_friendships_requester ON friendships(requester_id);
CREATE INDEX idx_friendships_addressee ON friendships(addressee_id);
CREATE INDEX idx_friendships_status    ON friendships(status);

ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own friendships"
  ON friendships FOR SELECT
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE POLICY "Users can create friendships"
  ON friendships FOR INSERT
  WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Users can update friendships they are part of"
  ON friendships FOR UPDATE
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE POLICY "Users can delete own friendships"
  ON friendships FOR DELETE
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- Presence (one row per user)
CREATE TABLE presence (
  user_id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status             TEXT DEFAULT 'free' CHECK (status IN ('busy','free','in_recess')),
  zone_id            TEXT REFERENCES zones(id) ON DELETE SET NULL,
  recess_type        TEXT CHECK (recess_type IN ('social','walk','gym','quiet','coffee','custom', NULL)),
  started_at         TIMESTAMPTZ,
  expires_at         TIMESTAMPTZ,
  share_level        TEXT DEFAULT 'friends' CHECK (share_level IN ('public','friends','private')),
  custom_title       TEXT,
  custom_description TEXT,
  activity_image_url TEXT,
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_presence_zone    ON presence(zone_id);
CREATE INDEX idx_presence_expires ON presence(expires_at);
CREATE INDEX idx_presence_status  ON presence(status);

ALTER TABLE presence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view presence based on share_level"
  ON presence FOR SELECT
  USING (
    share_level = 'public'
    OR user_id = auth.uid()
    OR (
      share_level = 'friends'
      AND EXISTS (
        SELECT 1 FROM friendships
        WHERE status = 'accepted'
        AND (
          (requester_id = auth.uid() AND addressee_id = presence.user_id)
          OR (addressee_id = auth.uid() AND requester_id = presence.user_id)
        )
      )
    )
  );

CREATE POLICY "Users can insert own presence"
  ON presence FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own presence"
  ON presence FOR UPDATE
  USING (auth.uid() = user_id);

-- Schedule blocks (one-time + recurring)
CREATE TABLE schedule_blocks (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  type        TEXT DEFAULT 'other' CHECK (type IN ('class','study','work','break','other')),
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL,
  date        DATE,
  day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6),
  end_date    DATE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_schedule_user      ON schedule_blocks(user_id);
CREATE INDEX idx_schedule_date      ON schedule_blocks(date);
CREATE INDEX idx_schedule_user_date ON schedule_blocks(user_id, date);
CREATE INDEX idx_schedule_dow       ON schedule_blocks(day_of_week);
CREATE INDEX idx_schedule_user_dow  ON schedule_blocks(user_id, day_of_week);

ALTER TABLE schedule_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own schedule"
  ON schedule_blocks FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Friends can view shared schedule"
  ON schedule_blocks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = schedule_blocks.user_id AND p.share_schedule = true
    )
    AND EXISTS (
      SELECT 1 FROM friendships f
      WHERE f.status = 'accepted'
        AND (
          (f.requester_id = auth.uid() AND f.addressee_id = schedule_blocks.user_id)
          OR (f.addressee_id = auth.uid() AND f.requester_id = schedule_blocks.user_id)
        )
    )
  );

CREATE POLICY "Users can insert own schedule"
  ON schedule_blocks FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own schedule"
  ON schedule_blocks FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own schedule"
  ON schedule_blocks FOR DELETE USING (auth.uid() = user_id);

-- Points log
CREATE TABLE points_log (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category   TEXT NOT NULL CHECK (category IN ('active','physical','social')),
  points     INTEGER NOT NULL,
  reason     TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  week_id    TEXT NOT NULL
);

CREATE INDEX idx_points_user      ON points_log(user_id);
CREATE INDEX idx_points_week      ON points_log(week_id);
CREATE INDEX idx_points_user_week ON points_log(user_id, week_id);

ALTER TABLE points_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view points"
  ON points_log FOR SELECT USING (true);

CREATE POLICY "Users can insert own points"
  ON points_log FOR INSERT WITH CHECK (auth.uid() = user_id);

-- User blocks (blocking other users)
CREATE TABLE user_blocks (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  blocker_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (blocker_id, blocked_id)
);

CREATE INDEX idx_user_blocks_blocker ON user_blocks(blocker_id);
CREATE INDEX idx_user_blocks_blocked ON user_blocks(blocked_id);

ALTER TABLE user_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own blocks"
  ON user_blocks FOR SELECT USING (auth.uid() = blocker_id);

CREATE POLICY "Users can insert own blocks"
  ON user_blocks FOR INSERT WITH CHECK (auth.uid() = blocker_id);

CREATE POLICY "Users can delete own blocks"
  ON user_blocks FOR DELETE USING (auth.uid() = blocker_id);

-- Break history (completed breaks)
CREATE TABLE break_history (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type                TEXT NOT NULL,
  zone_id             TEXT,
  zone_name           TEXT,
  started_at          TIMESTAMPTZ NOT NULL,
  ended_at            TIMESTAMPTZ NOT NULL,
  duration_minutes    INTEGER NOT NULL,
  points_awarded      INTEGER DEFAULT 0,
  custom_title        TEXT,
  activity_image_url  TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_break_history_user ON break_history(user_id);
CREATE INDEX idx_break_history_date ON break_history(started_at);

ALTER TABLE break_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own break history"
  ON break_history FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own break history"
  ON break_history FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Scheduled breaks (future planned breaks)
CREATE TABLE scheduled_breaks (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  zone_id       TEXT,
  date          DATE NOT NULL,
  start_time    TIME NOT NULL,
  duration      INTEGER NOT NULL DEFAULT 25,
  visibility    TEXT DEFAULT 'friends' CHECK (visibility IN ('public','friends','private')),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_scheduled_breaks_user ON scheduled_breaks(user_id);
CREATE INDEX idx_scheduled_breaks_date ON scheduled_breaks(date);

ALTER TABLE scheduled_breaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own scheduled breaks"
  ON scheduled_breaks FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view friends scheduled breaks"
  ON scheduled_breaks FOR SELECT USING (
    visibility = 'public'
    OR (
      visibility = 'friends'
      AND EXISTS (
        SELECT 1 FROM friendships
        WHERE status = 'accepted'
        AND (
          (requester_id = auth.uid() AND addressee_id = scheduled_breaks.user_id)
          OR (addressee_id = auth.uid() AND requester_id = scheduled_breaks.user_id)
        )
      )
    )
  );

CREATE POLICY "Users can insert own scheduled breaks"
  ON scheduled_breaks FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own scheduled breaks"
  ON scheduled_breaks FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own scheduled breaks"
  ON scheduled_breaks FOR DELETE USING (auth.uid() = user_id);

-- Break invitations
CREATE TABLE break_invitations (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  break_id      UUID NOT NULL REFERENCES scheduled_breaks(id) ON DELETE CASCADE,
  inviter_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invitee_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status        TEXT DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (break_id, invitee_id)
);

CREATE INDEX idx_break_invitations_break ON break_invitations(break_id);
CREATE INDEX idx_break_invitations_invitee ON break_invitations(invitee_id);

ALTER TABLE break_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own invitations"
  ON break_invitations FOR SELECT
  USING (auth.uid() = inviter_id OR auth.uid() = invitee_id);

CREATE POLICY "Users can create invitations"
  ON break_invitations FOR INSERT
  WITH CHECK (auth.uid() = inviter_id);

CREATE POLICY "Users can update invitations they received"
  ON break_invitations FOR UPDATE
  USING (auth.uid() = invitee_id);

-- Notifications (in-app activity feed)
CREATE TABLE notifications (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type          TEXT NOT NULL,
  title         TEXT NOT NULL,
  body          TEXT NOT NULL,
  related_user_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  related_user_name TEXT,
  related_break_id  UUID,
  is_read       BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notifications"
  ON notifications FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE USING (auth.uid() = user_id);

-- Leaderboard view
CREATE OR REPLACE VIEW leaderboard_weekly
WITH (security_invoker = true) AS
SELECT
  pl.user_id,
  p.display_name,
  pl.week_id,
  SUM(pl.points)                                                    AS total_points,
  SUM(CASE WHEN pl.category = 'active'   THEN pl.points ELSE 0 END) AS active_points,
  SUM(CASE WHEN pl.category = 'physical' THEN pl.points ELSE 0 END) AS physical_points,
  SUM(CASE WHEN pl.category = 'social'   THEN pl.points ELSE 0 END) AS social_points,
  COUNT(*)                                                           AS sessions_count
FROM points_log pl
JOIN profiles p ON pl.user_id = p.id
GROUP BY pl.user_id, p.display_name, pl.week_id;

-- Helper functions and triggers

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_presence_updated_at
  BEFORE UPDATE ON presence
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION cleanup_expired_presence()
RETURNS void AS $$
BEGIN
  UPDATE public.presence
  SET status             = 'free',
      zone_id            = NULL,
      recess_type        = NULL,
      started_at         = NULL,
      expires_at         = NULL,
      custom_title       = NULL,
      custom_description = NULL,
      activity_image_url = NULL
  WHERE expires_at < NOW() AND status = 'in_recess';
END;
$$ LANGUAGE plpgsql SET search_path = '';

-- Auto-create profile + presence on signup (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  _friend_code TEXT;
BEGIN
  _friend_code := 'RCS-' || upper(substring(md5(random()::text || NEW.id::text) FROM 1 FOR 4));

  INSERT INTO public.profiles (
    id, display_name, friend_code,
    default_break_length, privacy_friend_visibility, privacy_public_zone_visibility
  ) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    _friend_code,
    25, true, true
  )
  ON CONFLICT (id) DO UPDATE SET
    friend_code = COALESCE(profiles.friend_code, EXCLUDED.friend_code);

  INSERT INTO public.presence (user_id, status, share_level)
  VALUES (NEW.id, 'free', 'friends')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    _friend_code := 'RCS-' || upper(substring(md5(clock_timestamp()::text || NEW.id::text) FROM 1 FOR 4));
    INSERT INTO public.profiles (
      id, display_name, friend_code,
      default_break_length, privacy_friend_visibility, privacy_public_zone_visibility
    ) VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
      _friend_code,
      25, true, true
    )
    ON CONFLICT (id) DO UPDATE SET
      friend_code = COALESCE(profiles.friend_code, EXCLUDED.friend_code);

    INSERT INTO public.presence (user_id, status, share_level)
    VALUES (NEW.id, 'free', 'friends')
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill: fix existing users missing profiles or presence rows
INSERT INTO public.profiles (
  id, display_name, friend_code,
  default_break_length, privacy_friend_visibility, privacy_public_zone_visibility
)
SELECT
  au.id,
  COALESCE(au.raw_user_meta_data->>'full_name', split_part(au.email, '@', 1)),
  'RCS-' || upper(substring(md5(random()::text || au.id::text) FROM 1 FOR 4)),
  25, true, true
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

UPDATE public.profiles
SET friend_code = 'RCS-' || upper(substring(md5(random()::text || id::text) FROM 1 FOR 4))
WHERE friend_code IS NULL;

INSERT INTO public.presence (user_id, status, share_level)
SELECT au.id, 'free', 'friends'
FROM auth.users au
LEFT JOIN public.presence pr ON pr.user_id = au.id
WHERE pr.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- Realtime subscriptions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'presence'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE presence;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'points_log'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE points_log;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'friendships'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE friendships;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'break_invitations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE break_invitations;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'scheduled_breaks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE scheduled_breaks;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'schedule_blocks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE schedule_blocks;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;
END $$;

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('profile-images', 'profile-images', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('break-images', 'break-images', true) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users can upload profile images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update profile images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete profile images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view profile images" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload break images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update break images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete break images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view break images" ON storage.objects;

CREATE POLICY "Users can upload profile images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'profile-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update profile images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'profile-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete profile images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'profile-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Anyone can view profile images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'profile-images');

CREATE POLICY "Users can upload break images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'break-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update break images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'break-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete break images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'break-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Anyone can view break images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'break-images');

-- Verify all tables exist
DO $$
DECLARE
  tbl TEXT;
  tbls TEXT[] := ARRAY['profiles','zones','friendships','presence','schedule_blocks','points_log','user_blocks','break_history','scheduled_breaks','break_invitations','notifications'];
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=tbl) THEN
      RAISE EXCEPTION 'Table % was NOT created!', tbl;
    END IF;
  END LOOP;
  RAISE NOTICE 'All tables created successfully.';
END $$;
