CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS game_feedback (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id text NOT NULL CHECK (length(game_id) BETWEEN 1 AND 128),
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  feedback_tags text[] NOT NULL DEFAULT '{}'
    CHECK (cardinality(feedback_tags) <= 5 AND feedback_tags <@ ARRAY[
      'fun', 'challenging', 'easy-controls', 'great-design', 'good-for-short-sessions',
      'too-difficult', 'bugs', 'slow', 'not-for-me'
    ]::text[]),
  feedback_text text CHECK (feedback_text IS NULL OR length(feedback_text) <= 1000),
  reward_key uuid NOT NULL DEFAULT gen_random_uuid(),
  reward_awarded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, game_id)
);

ALTER TABLE game_feedback
  ADD COLUMN IF NOT EXISTS reward_key uuid NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS game_feedback_reward_key_idx
  ON game_feedback (reward_key);

CREATE INDEX IF NOT EXISTS game_feedback_game_created_idx
  ON game_feedback (game_id, created_at DESC);

CREATE TABLE IF NOT EXISTS game_interactions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id text NOT NULL CHECK (length(game_id) BETWEEN 1 AND 128),
  interaction text NOT NULL CHECK (interaction IN ('like', 'dislike')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, game_id)
);

CREATE INDEX IF NOT EXISTS game_interactions_game_idx ON game_interactions (game_id);

CREATE TABLE IF NOT EXISTS recommendation_feedback (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id text NOT NULL CHECK (length(game_id) BETWEEN 1 AND 128),
  helpful boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, game_id)
);

CREATE INDEX IF NOT EXISTS recommendation_feedback_game_idx
  ON recommendation_feedback (game_id);