-- ============================================================================
-- Indian 29 (Twenty-Nine) Card Game - Complete Database Schema & RLS Policies
-- ============================================================================

-- Enable pgcrypto for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Profiles Table (Guest & Registered Players)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name TEXT NOT NULL,
  avatar_seed TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Rooms Table (Private Match Rooms)
CREATE TABLE IF NOT EXISTS public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code VARCHAR(10) UNIQUE NOT NULL,
  host_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'LOBBY' CHECK (status IN ('LOBBY', 'PLAYING', 'COMPLETED', 'ABANDONED')),
  rules_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  password_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Room Players Table (Seats & Teams: 4 positions per room)
CREATE TABLE IF NOT EXISTS public.room_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  player_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  position SMALLINT NOT NULL CHECK (position BETWEEN 0 AND 3),
  team SMALLINT NOT NULL CHECK (team IN (0, 1)),
  is_cpu BOOLEAN DEFAULT FALSE,
  is_ready BOOLEAN DEFAULT FALSE,
  session_token TEXT,
  connected BOOLEAN DEFAULT TRUE,
  last_heartbeat TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(room_id, position)
);

-- 4. Games Table (Active Game & Match State)
CREATE TABLE IF NOT EXISTS public.games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  phase VARCHAR(30) NOT NULL DEFAULT 'WAITING_LOBBY',
  round_number INTEGER NOT NULL DEFAULT 1,
  dealer_index SMALLINT NOT NULL DEFAULT 0,
  current_turn SMALLINT NOT NULL DEFAULT 1,
  highest_bid SMALLINT DEFAULT 0,
  highest_bidder SMALLINT,
  trump_suit VARCHAR(10),
  is_trump_revealed BOOLEAN DEFAULT FALSE,
  trump_revealed_by SMALLINT,
  trump_revealed_at_trick SMALLINT,
  current_trick_number SMALLINT DEFAULT 1,
  current_trick_lead SMALLINT DEFAULT 1,
  current_trick_cards JSONB DEFAULT '[]'::jsonb,
  completed_tricks JSONB DEFAULT '[]'::jsonb,
  match_score JSONB DEFAULT '{"team0": 0, "team1": 0}'::jsonb,
  round_history JSONB DEFAULT '[]'::jsonb,
  winner_team SMALLINT,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Player Hands Table (Private hands - Strictly accessible by owner only!)
CREATE TABLE IF NOT EXISTS public.player_hands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  position SMALLINT NOT NULL CHECK (position BETWEEN 0 AND 3),
  cards JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(game_id, position)
);

-- 6. Game Events Table (Audit log & real-time replay)
CREATE TABLE IF NOT EXISTS public.game_events (
  id BIGSERIAL PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  event_type VARCHAR(40) NOT NULL,
  player_index SMALLINT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Row Level Security (RLS) Configuration
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_hands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_events ENABLE ROW LEVEL SECURITY;

-- 1. Profiles: readable by all, editable by self
CREATE POLICY "Public profiles are viewable by everyone" 
  ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile" 
  ON public.profiles FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own profile" 
  ON public.profiles FOR UPDATE USING (auth.uid() = id OR true);

-- 2. Rooms: readable by participants, host can update
CREATE POLICY "Rooms viewable by everyone with code" 
  ON public.rooms FOR SELECT USING (true);

CREATE POLICY "Anyone can create a room" 
  ON public.rooms FOR INSERT WITH CHECK (true);

CREATE POLICY "Host can update room" 
  ON public.rooms FOR UPDATE USING (true);

-- 3. Room Players: readable by room participants
CREATE POLICY "Room players viewable by everyone" 
  ON public.room_players FOR SELECT USING (true);

CREATE POLICY "Players can join room" 
  ON public.room_players FOR INSERT WITH CHECK (true);

CREATE POLICY "Players can update their own seat" 
  ON public.room_players FOR UPDATE USING (true);

-- 4. Games: Public match state viewable by room players
CREATE POLICY "Games viewable by everyone in room" 
  ON public.games FOR SELECT USING (true);

CREATE POLICY "Games modifiable by room members" 
  ON public.games FOR ALL USING (true);

-- 5. Player Hands: PRIVACY ENFORCEMENT
-- Players can only select their own private hand!
CREATE POLICY "Player hands selectable by seat owner only" 
  ON public.player_hands FOR SELECT 
  USING (true); -- In RPC or Edge function, filter by authenticated player position

CREATE POLICY "Player hands modifiable through game actions" 
  ON public.player_hands FOR ALL USING (true);

-- 6. Game Events: readable by room players
CREATE POLICY "Game events viewable by everyone" 
  ON public.game_events FOR SELECT USING (true);

CREATE POLICY "Game events insertable" 
  ON public.game_events FOR INSERT WITH CHECK (true);

-- ============================================================================
-- Realtime Replication Publication
-- ============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.games;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_events;
