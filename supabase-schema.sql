-- ============================================================
-- DayGuide – Supabase Database Schema
-- Vollständige Datenbankstruktur mit RLS-Policies
-- ============================================================

-- ─── Extension für UUID ──────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── PROFILES ────────────────────────────────────────────────
-- Nutzerprofile (z. B. verschiedene Kinder pro Elternkonto)
CREATE TABLE public.profiles (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  avatar_url  TEXT,
  pin_hash    TEXT,                -- gehashte 4-stellige PIN
  settings    JSONB DEFAULT '{}'::jsonb,  -- profilspezifische Einstellungen
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "profiles_delete_own" ON public.profiles
  FOR DELETE USING (auth.uid() = user_id);


-- ─── SCHEDULES ───────────────────────────────────────────────
-- Tagespläne, die Profilen zugeordnet sind
CREATE TABLE public.schedules (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name          TEXT NOT NULL DEFAULT 'Mein Tagesplan',
  days_of_week  INT[] DEFAULT '{1,2,3,4,5}',  -- 0=So, 1=Mo ... 6=Sa
  is_active     BOOLEAN DEFAULT true,
  is_template   BOOLEAN DEFAULT false,         -- als Vorlage gespeichert
  template_name TEXT,                          -- Name der Vorlage
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_schedules_profile_id ON public.schedules(profile_id);

-- RLS (über Profile-Join)
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "schedules_select_own" ON public.schedules
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = schedules.profile_id
        AND profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "schedules_insert_own" ON public.schedules
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = schedules.profile_id
        AND profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "schedules_update_own" ON public.schedules
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = schedules.profile_id
        AND profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "schedules_delete_own" ON public.schedules
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = schedules.profile_id
        AND profiles.user_id = auth.uid()
    )
  );


-- ─── TASKS ───────────────────────────────────────────────────
-- Einzelne Aufgaben innerhalb eines Tagesplans
CREATE TABLE public.tasks (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  schedule_id         UUID NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  start_time          TIME NOT NULL,
  duration_minutes    INT NOT NULL DEFAULT 10 CHECK (duration_minutes > 0 AND duration_minutes <= 480),
  sort_order          INT NOT NULL DEFAULT 0,
  
  -- Medien
  image_url           TEXT,           -- Bild/Piktogramm-URL (Supabase Storage)
  video_url           TEXT,           -- Video-URL
  audio_url           TEXT,           -- Audio-URL
  tts_text            TEXT,           -- Text für Sprachsynthese
  
  -- Piktogramm aus integrierter Bibliothek
  pictogram_key       TEXT,           -- z. B. 'teeth', 'dress', 'breakfast'
  icon_emoji          TEXT,           -- Emoji-Fallback
  
  -- Darstellung
  color               TEXT DEFAULT '#B3E5FC',
  
  -- Erinnerungen
  reminder_type       TEXT NOT NULL DEFAULT 'alarm'
                      CHECK (reminder_type IN ('alarm', 'silent')),
  enable_mid_reminders BOOLEAN DEFAULT false,
  mid_reminder_text   TEXT,
  
  -- Erweiterte Einstellungen
  extension_minutes   INT DEFAULT 5,  -- Wie viele Minuten bei "Noch Zeit"
  
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tasks_schedule_id ON public.tasks(schedule_id);
CREATE INDEX idx_tasks_sort_order ON public.tasks(schedule_id, sort_order);

-- RLS (über Schedules → Profiles Join)
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasks_select_own" ON public.tasks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.schedules
      JOIN public.profiles ON profiles.id = schedules.profile_id
      WHERE schedules.id = tasks.schedule_id
        AND profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "tasks_insert_own" ON public.tasks
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.schedules
      JOIN public.profiles ON profiles.id = schedules.profile_id
      WHERE schedules.id = tasks.schedule_id
        AND profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "tasks_update_own" ON public.tasks
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.schedules
      JOIN public.profiles ON profiles.id = schedules.profile_id
      WHERE schedules.id = tasks.schedule_id
        AND profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "tasks_delete_own" ON public.tasks
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.schedules
      JOIN public.profiles ON profiles.id = schedules.profile_id
      WHERE schedules.id = tasks.schedule_id
        AND profiles.user_id = auth.uid()
    )
  );


-- ─── MEDIA LIBRARY ───────────────────────────────────────────
-- Zentrale Medienbibliothek für alle Uploads
CREATE TABLE public.media_library (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name   TEXT NOT NULL,
  file_url    TEXT NOT NULL,
  file_type   TEXT NOT NULL CHECK (file_type IN ('image', 'video', 'audio', 'pictogram')),
  file_size   BIGINT,                    -- Dateigröße in Bytes
  mime_type   TEXT,
  tags        TEXT[] DEFAULT '{}',
  folder      TEXT,                       -- optionale Ordnerstruktur
  duration_seconds INT,                   -- für Audio/Video
  thumbnail_url TEXT,                     -- Vorschaubild für Videos
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_media_user_id ON public.media_library(user_id);
CREATE INDEX idx_media_file_type ON public.media_library(file_type);
CREATE INDEX idx_media_tags ON public.media_library USING GIN(tags);

-- RLS
ALTER TABLE public.media_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "media_select_own" ON public.media_library
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "media_insert_own" ON public.media_library
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "media_update_own" ON public.media_library
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "media_delete_own" ON public.media_library
  FOR DELETE USING (auth.uid() = user_id);


-- ─── TASK COMPLETIONS ────────────────────────────────────────
-- Protokoll der erledigten Aufgaben (Belohnungssystem / Statistik)
CREATE TABLE public.task_completions (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id                UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  profile_id             UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  schedule_id            UUID REFERENCES public.schedules(id) ON DELETE SET NULL,
  completed_at           TIMESTAMPTZ DEFAULT now(),
  completion_date        DATE DEFAULT CURRENT_DATE,  -- für tägliche Abfragen
  needed_extension       BOOLEAN DEFAULT false,
  extension_count        INT DEFAULT 0,              -- wie oft verlängert
  completion_time_seconds INT,                       -- tatsächliche Dauer
  used_help              BOOLEAN DEFAULT false,       -- "Hilfe"-Button gedrückt
  auto_completed         BOOLEAN DEFAULT false        -- automatisch weitergeschaltet
);

CREATE INDEX idx_completions_profile_date ON public.task_completions(profile_id, completion_date);
CREATE INDEX idx_completions_task_id ON public.task_completions(task_id);

-- RLS
ALTER TABLE public.task_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "completions_select_own" ON public.task_completions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = task_completions.profile_id
        AND profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "completions_insert_own" ON public.task_completions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = task_completions.profile_id
        AND profiles.user_id = auth.uid()
    )
  );


-- ─── STICKER COLLECTION ─────────────────────────────────────
-- Gesammelte Sticker pro Profil
CREATE TABLE public.sticker_collection (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sticker     TEXT NOT NULL,                  -- Emoji oder URL
  earned_at   TIMESTAMPTZ DEFAULT now(),
  earned_date DATE DEFAULT CURRENT_DATE,
  task_name   TEXT                            -- welche Aufgabe den Sticker gab
);

CREATE INDEX idx_stickers_profile ON public.sticker_collection(profile_id);

ALTER TABLE public.sticker_collection ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stickers_select_own" ON public.sticker_collection
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = sticker_collection.profile_id
        AND profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "stickers_insert_own" ON public.sticker_collection
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = sticker_collection.profile_id
        AND profiles.user_id = auth.uid()
    )
  );


-- ─── APP SETTINGS ────────────────────────────────────────────
-- Globale Benutzereinstellungen
CREATE TABLE public.app_settings (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pin_code            TEXT,                  -- gehashte PIN
  language            TEXT DEFAULT 'de-DE',
  tts_rate            REAL DEFAULT 0.9,
  tts_voice           TEXT,
  extension_minutes   INT DEFAULT 5,
  auto_advance_delay  INT DEFAULT 30,       -- Sekunden bevor auto-weiter
  show_digital_clock  BOOLEAN DEFAULT true,
  vibration_enabled   BOOLEAN DEFAULT true,
  sound_enabled       BOOLEAN DEFAULT true,
  theme               TEXT DEFAULT 'default',
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "settings_select_own" ON public.app_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "settings_upsert_own" ON public.app_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "settings_update_own" ON public.app_settings
  FOR UPDATE USING (auth.uid() = user_id);


-- ─── FUNCTIONS ───────────────────────────────────────────────

-- Automatisch updated_at setzen
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_profiles_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER tr_schedules_updated
  BEFORE UPDATE ON public.schedules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER tr_tasks_updated
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER tr_settings_updated
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- Hilfsfunktion: Tagesplan für heute abrufen
CREATE OR REPLACE FUNCTION public.get_todays_schedule(p_profile_id UUID)
RETURNS TABLE (
  task_id UUID,
  task_name TEXT,
  start_time TIME,
  duration_minutes INT,
  sort_order INT,
  image_url TEXT,
  video_url TEXT,
  audio_url TEXT,
  tts_text TEXT,
  pictogram_key TEXT,
  icon_emoji TEXT,
  color TEXT,
  reminder_type TEXT,
  enable_mid_reminders BOOLEAN,
  mid_reminder_text TEXT,
  is_completed BOOLEAN
) AS $$
DECLARE
  v_dow INT;
BEGIN
  -- PostgreSQL: 0=Sonntag, 1=Montag ... 6=Samstag
  v_dow := EXTRACT(DOW FROM CURRENT_DATE)::INT;
  
  RETURN QUERY
  SELECT
    t.id AS task_id,
    t.name AS task_name,
    t.start_time,
    t.duration_minutes,
    t.sort_order,
    t.image_url,
    t.video_url,
    t.audio_url,
    t.tts_text,
    t.pictogram_key,
    t.icon_emoji,
    t.color,
    t.reminder_type,
    t.enable_mid_reminders,
    t.mid_reminder_text,
    (EXISTS (
      SELECT 1 FROM public.task_completions tc
      WHERE tc.task_id = t.id
        AND tc.profile_id = p_profile_id
        AND tc.completion_date = CURRENT_DATE
    )) AS is_completed
  FROM public.tasks t
  JOIN public.schedules s ON s.id = t.schedule_id
  WHERE s.profile_id = p_profile_id
    AND s.is_active = true
    AND v_dow = ANY(s.days_of_week)
  ORDER BY t.sort_order ASC, t.start_time ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Hilfsfunktion: Tagesstatistik abrufen
CREATE OR REPLACE FUNCTION public.get_daily_stats(
  p_profile_id UUID,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'date', p_date,
    'total_tasks', (
      SELECT COUNT(*) FROM public.task_completions
      WHERE profile_id = p_profile_id AND completion_date = p_date
    ),
    'needed_extensions', (
      SELECT COUNT(*) FROM public.task_completions
      WHERE profile_id = p_profile_id AND completion_date = p_date AND needed_extension = true
    ),
    'used_help', (
      SELECT COUNT(*) FROM public.task_completions
      WHERE profile_id = p_profile_id AND completion_date = p_date AND used_help = true
    ),
    'stickers_earned', (
      SELECT COUNT(*) FROM public.sticker_collection
      WHERE profile_id = p_profile_id AND earned_date = p_date
    ),
    'avg_completion_seconds', (
      SELECT ROUND(AVG(completion_time_seconds))
      FROM public.task_completions
      WHERE profile_id = p_profile_id AND completion_date = p_date
    )
  ) INTO v_result;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─── STORAGE BUCKETS ─────────────────────────────────────────
-- (Über Supabase Dashboard oder API erstellen)

-- Bucket: media
-- - Öffentlich: Nein (nur authentifizierte Benutzer)
-- - Max Dateigröße: 50 MB
-- - Erlaubte MIME-Types: image/*, video/*, audio/*

-- Storage Policies (SQL):
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'media',
  'media',
  false,
  52428800,  -- 50 MB
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
        'video/mp4', 'video/webm', 'video/quicktime',
        'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/mp4']
);

-- Storage RLS Policies
CREATE POLICY "media_upload_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "media_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "media_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Bucket: avatars (für Profilbilder)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,  -- öffentlich für einfache Anzeige
  5242880,  -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
);

CREATE POLICY "avatars_upload_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "avatars_select_public" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'avatars');


-- ─── SEED DATA: Vorgefertigte Piktogramme ────────────────────
-- Diese werden als System-Einträge ohne user_id gespeichert
-- (Alternative: als JSON in der App oder als separater public Bucket)

CREATE TABLE public.system_pictograms (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key         TEXT UNIQUE NOT NULL,
  name_de     TEXT NOT NULL,
  name_en     TEXT,
  emoji       TEXT NOT NULL,
  category    TEXT NOT NULL,
  image_url   TEXT,           -- optional: SVG/PNG in Storage
  sort_order  INT DEFAULT 0
);

-- Keine RLS nötig – öffentlich lesbar
ALTER TABLE public.system_pictograms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pictograms_select_all" ON public.system_pictograms
  FOR SELECT TO authenticated USING (true);

-- Seed-Daten
INSERT INTO public.system_pictograms (key, name_de, name_en, emoji, category, sort_order) VALUES
  ('wake_up',     'Aufstehen',      'Wake up',       '🌅', 'morgen',    1),
  ('teeth',       'Zähneputzen',    'Brush teeth',   '🪥', 'hygiene',   2),
  ('wash_face',   'Gesicht waschen','Wash face',     '🧼', 'hygiene',   3),
  ('shower',      'Duschen',        'Shower',        '🚿', 'hygiene',   4),
  ('dress',       'Anziehen',       'Get dressed',   '👕', 'morgen',    5),
  ('breakfast',   'Frühstücken',    'Breakfast',     '🥣', 'essen',     6),
  ('lunch',       'Mittagessen',    'Lunch',         '🍽️', 'essen',     7),
  ('dinner',      'Abendessen',     'Dinner',        '🍛', 'essen',     8),
  ('snack',       'Snack',          'Snack',         '🍎', 'essen',     9),
  ('drink',       'Trinken',        'Drink',         '🥤', 'essen',    10),
  ('school',      'Schule',         'School',        '🏫', 'lernen',   11),
  ('homework',    'Hausaufgaben',   'Homework',      '📚', 'lernen',   12),
  ('read',        'Lesen',          'Read',          '📖', 'lernen',   13),
  ('play',        'Spielen',        'Play',          '🎮', 'freizeit', 14),
  ('play_outside','Draußen spielen','Play outside',  '🌳', 'freizeit', 15),
  ('sport',       'Sport',          'Sport',         '⚽', 'freizeit', 16),
  ('swim',        'Schwimmen',      'Swim',          '🏊', 'freizeit', 17),
  ('bike',        'Fahrradfahren',  'Cycling',       '🚲', 'freizeit', 18),
  ('music',       'Musik',          'Music',         '🎵', 'freizeit', 19),
  ('art',         'Malen/Basteln',  'Art/Crafts',    '🎨', 'freizeit', 20),
  ('tv',          'Fernsehen',      'Watch TV',      '📺', 'freizeit', 21),
  ('walk',        'Spaziergang',    'Walk',          '🚶', 'freizeit', 22),
  ('bath',        'Baden',          'Bath',          '🛁', 'abend',    23),
  ('pajamas',     'Schlafanzug',    'Pajamas',       '👔', 'abend',    24),
  ('story',       'Geschichte',     'Story time',    '📕', 'abend',    25),
  ('sleep',       'Schlafen',       'Sleep',         '🌙', 'abend',    26),
  ('medicine',    'Medizin',        'Medicine',      '💊', 'gesundheit', 27),
  ('doctor',      'Arzt',           'Doctor',        '🏥', 'gesundheit', 28),
  ('therapy',     'Therapie',       'Therapy',       '🧩', 'gesundheit', 29),
  ('grocery',     'Einkaufen',      'Grocery',       '🛒', 'alltag',   30),
  ('cook',        'Kochen',         'Cook',          '👨‍🍳', 'alltag',   31),
  ('clean',       'Aufräumen',      'Clean up',      '🧹', 'alltag',   32),
  ('shoes',       'Schuhe anziehen','Put on shoes',  '👟', 'morgen',   33),
  ('jacket',      'Jacke anziehen', 'Put on jacket', '🧥', 'morgen',   34),
  ('bus',         'Bus fahren',     'Take the bus',  '🚌', 'transport', 35),
  ('car',         'Auto fahren',    'Car ride',      '🚗', 'transport', 36),
  ('wait',        'Warten',         'Wait',          '⏳', 'alltag',   37),
  ('quiet',       'Ruhezeit',       'Quiet time',    '🤫', 'alltag',   38),
  ('pet',         'Haustier',       'Pet',           '🐶', 'alltag',   39),
  ('friends',     'Freunde treffen','Meet friends',  '👫', 'freizeit', 40);
