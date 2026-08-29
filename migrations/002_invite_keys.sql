ALTER TABLE teams ADD COLUMN IF NOT EXISTS invite_key TEXT;

UPDATE teams
SET invite_key = UPPER(SUBSTR(MD5(RANDOM()::TEXT || id::TEXT), 1, 8))
WHERE invite_key IS NULL OR invite_key = '';

ALTER TABLE teams ALTER COLUMN invite_key SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS teams_invite_key_idx ON teams(invite_key);

ALTER TABLE users ADD COLUMN IF NOT EXISTS current_team_id UUID REFERENCES teams(id) ON DELETE SET NULL;