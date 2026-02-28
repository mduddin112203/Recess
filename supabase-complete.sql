-- Recess App (partial schema for init — full schema in commit 3)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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
