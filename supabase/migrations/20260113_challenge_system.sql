-- Challenge System Schema
-- Phase 5A: Challenge Infrastructure

-- ============================================================================
-- 1. CHALLENGES TABLE
-- ============================================================================
-- Stores challenge definitions
create table if not exists public.challenges (
  id text primary key,
  type text not null check (type in ('pattern', 'indicator', 'entry_exit', 'risk', 'psychology', 'case_study')),
  level integer not null check (level between 1 and 5),
  title text not null,
  description text not null,
  config jsonb not null,  -- Challenge-specific configuration
  points integer not null check (points > 0),
  time_limit integer check (time_limit is null or time_limit > 0),  -- seconds, null = no limit
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Indexes for efficient queries
create index if not exists challenges_type_idx on public.challenges(type);
create index if not exists challenges_level_idx on public.challenges(level);
create index if not exists challenges_type_level_idx on public.challenges(type, level);

-- ============================================================================
-- 2. CHALLENGE ATTEMPTS TABLE
-- ============================================================================
-- Tracks user attempts at challenges
create table if not exists public.challenge_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  challenge_id text references public.challenges(id) on delete cascade not null,
  started_at timestamp with time zone default now(),
  completed_at timestamp with time zone,
  success boolean,
  score integer check (score is null or score >= 0),
  time_taken integer check (time_taken is null or time_taken >= 0),  -- seconds
  attempt_data jsonb,  -- User's answers, decisions, etc.
  feedback_viewed boolean default false,
  created_at timestamp with time zone default now()
);

-- Indexes
create index if not exists challenge_attempts_user_idx on public.challenge_attempts(user_id);
create index if not exists challenge_attempts_challenge_idx on public.challenge_attempts(challenge_id);
create index if not exists challenge_attempts_user_challenge_idx on public.challenge_attempts(user_id, challenge_id);
create index if not exists challenge_attempts_created_idx on public.challenge_attempts(created_at desc);

-- ============================================================================
-- 3. USER CHALLENGE STATS TABLE
-- ============================================================================
-- Aggregated user statistics and progress
create table if not exists public.user_challenge_stats (
  user_id uuid references auth.users(id) on delete cascade primary key,
  total_xp integer default 0 check (total_xp >= 0),
  current_level integer default 1 check (current_level between 1 and 5),
  challenges_completed integer default 0 check (challenges_completed >= 0),
  challenges_failed integer default 0 check (challenges_failed >= 0),
  current_streak integer default 0 check (current_streak >= 0),
  longest_streak integer default 0 check (longest_streak >= 0),
  last_completed_at timestamp with time zone,
  achievements jsonb default '[]'::jsonb,
  updated_at timestamp with time zone default now()
);

-- ============================================================================
-- 4. ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Challenges: Public read access (everyone can view challenges)
alter table public.challenges enable row level security;

create policy "Challenges are viewable by everyone"
  on public.challenges for select
  using (true);

-- Challenge Attempts: Users can only access their own attempts
alter table public.challenge_attempts enable row level security;

create policy "Users can view own attempts"
  on public.challenge_attempts for select
  using (auth.uid() = user_id);

create policy "Users can insert own attempts"
  on public.challenge_attempts for insert
  with check (auth.uid() = user_id);

create policy "Users can update own attempts"
  on public.challenge_attempts for update
  using (auth.uid() = user_id);

-- User Challenge Stats: Users can only access their own stats
alter table public.user_challenge_stats enable row level security;

create policy "Users can view own stats"
  on public.user_challenge_stats for select
  using (auth.uid() = user_id);

create policy "Users can insert own stats"
  on public.user_challenge_stats for insert
  with check (auth.uid() = user_id);

create policy "Users can update own stats"
  on public.user_challenge_stats for update
  using (auth.uid() = user_id);

-- ============================================================================
-- 5. FUNCTIONS
-- ============================================================================

-- Function to auto-create user stats on first challenge
create or replace function public.ensure_user_stats()
returns trigger as $$
begin
  insert into public.user_challenge_stats (user_id)
  values (new.user_id)
  on conflict (user_id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to auto-create stats
create trigger ensure_user_stats_trigger
  after insert on public.challenge_attempts
  for each row
  execute function public.ensure_user_stats();

-- ============================================================================
-- 6. SEED DATA (Sample Challenges)
-- ============================================================================

-- Sample Challenge 1: Basic Pattern Recognition
insert into public.challenges (id, type, level, title, description, config, points) values
(
  'pattern_001',
  'pattern',
  1,
  'Spot the Doji',
  'Identify the Doji candlestick pattern. A Doji has a very small body where the opening and closing prices are nearly equal.',
  '{
    "type": "pattern",
    "pattern": "doji",
    "tolerance_candles": 2,
    "hints": [
      "Look for a candle with a very small body",
      "Opening and closing prices should be almost the same",
      "Can have wicks on both sides"
    ],
    "explanation": "A Doji indicates market indecision. It forms when opening and closing prices are virtually equal, creating a cross or plus sign shape."
  }'::jsonb,
  100
) on conflict (id) do nothing;

-- Sample Challenge 2: Indicator Quiz
insert into public.challenges (id, type, level, title, description, config, points) values
(
  'indicator_001',
  'indicator',
  2,
  'RSI Overbought Level',
  'The RSI (Relative Strength Index) is a momentum oscillator. At what value is RSI typically considered overbought?',
  '{
    "type": "indicator",
    "options": [
      {"id": "A", "text": "Above 50", "correct": false, "feedback": "50 is the neutral level, not overbought."},
      {"id": "B", "text": "Above 70", "correct": true, "feedback": "Correct! RSI above 70 indicates overbought conditions."},
      {"id": "C", "text": "Above 80", "correct": false, "feedback": "While this is extremely overbought, the standard threshold is 70."},
      {"id": "D", "text": "Below 30", "correct": false, "feedback": "Below 30 indicates oversold, not overbought."}
    ],
    "correct_answer": "B",
    "explanation": "RSI above 70 is traditionally considered overbought, suggesting the asset may be due for a pullback. However, in strong trends, RSI can remain overbought for extended periods."
  }'::jsonb,
  150
) on conflict (id) do nothing;

-- Sample Challenge 3: Psychology Scenario
insert into public.challenges (id, type, level, title, description, config, points) values
(
  'psych_001',
  'psychology',
  2,
  'FOMO Test',
  'A stock you''ve been watching has risen 20% in the last 3 days. Everyone in your trading group is talking about it. You don''t have a position. What should you do?',
  '{
    "type": "psychology",
    "options": [
      {
        "id": "A", 
        "text": "Buy immediately before it goes higher!", 
        "correct": false,
        "feedback": "This is classic FOMO (Fear of Missing Out). Buying without analysis because you fear missing gains often leads to buying at the top."
      },
      {
        "id": "B", 
        "text": "Analyze first, then find a good entry point if it''s still attractive", 
        "correct": true,
        "feedback": "Excellent! Never chase prices. A disciplined trader always analyzes before acting, regardless of social pressure."
      },
      {
        "id": "C", 
        "text": "Short it because it must come down", 
        "correct": false,
        "feedback": "Fighting a trend without analysis is just as dangerous. Strong trends can continue longer than expected."
      },
      {
        "id": "D", 
        "text": "Follow the group, they must know something", 
        "correct": false,
        "feedback": "Herd mentality is dangerous. By the time everyone is talking about it, you''re usually late to the party."
      }
    ],
    "correct_answer": "B",
    "explanation": "FOMO is one of the most dangerous emotions in trading. Professional traders: 1) Stick to their plan, 2) Never chase prices, 3) Are comfortable missing opportunities. Remember: There will ALWAYS be another trade."
  }'::jsonb,
  150
) on conflict (id) do nothing;
