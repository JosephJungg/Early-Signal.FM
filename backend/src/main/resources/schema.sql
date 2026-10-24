CREATE TABLE IF NOT EXISTS game_state (
    id INT PRIMARY KEY CHECK (id = 1),
    game_date DATE NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(40) UNIQUE NOT NULL,
    cash NUMERIC(14,2) NOT NULL,
    is_bot BOOLEAN NOT NULL DEFAULT FALSE,
    kind VARCHAR(10) NOT NULL DEFAULT 'human',  -- human, bot, ai
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS artists (
    id BIGSERIAL PRIMARY KEY,
    ticker VARCHAR(6) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    genre VARCHAR(40) NOT NULL DEFAULT '',
    tier VARCHAR(16) NOT NULL,              -- BLUE_CHIP, MID, UNDERGROUND
    volatility DOUBLE PRECISION NOT NULL,   -- daily noise scale
    drift DOUBLE PRECISION NOT NULL,        -- baseline daily listener growth
    price NUMERIC(12,2) NOT NULL,
    prev_price NUMERIC(12,2) NOT NULL,
    listeners BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS price_history (
    artist_id BIGINT NOT NULL REFERENCES artists(id),
    game_date DATE NOT NULL,
    price NUMERIC(12,2) NOT NULL,
    listeners BIGINT NOT NULL,
    PRIMARY KEY (artist_id, game_date)
);

CREATE TABLE IF NOT EXISTS holdings (
    user_id BIGINT NOT NULL REFERENCES users(id),
    artist_id BIGINT NOT NULL REFERENCES artists(id),
    shares INT NOT NULL CHECK (shares > 0),
    avg_cost NUMERIC(12,2) NOT NULL,
    PRIMARY KEY (user_id, artist_id)
);

CREATE TABLE IF NOT EXISTS transactions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    artist_id BIGINT NOT NULL REFERENCES artists(id),
    side VARCHAR(4) NOT NULL,
    shares INT NOT NULL,
    price NUMERIC(12,2) NOT NULL,
    fee NUMERIC(12,2) NOT NULL,
    game_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events (
    id BIGSERIAL PRIMARY KEY,
    artist_id BIGINT NOT NULL REFERENCES artists(id),
    type VARCHAR(20) NOT NULL,              -- VIRAL SPIKE, PLAYLIST ADD, ... (see PriceEngine)
    message VARCHAR(200) NOT NULL,          -- served as "headline"
    impact_pct DOUBLE PRECISION NOT NULL DEFAULT 0,
    game_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Written by the Python ML job, read by the API
CREATE TABLE IF NOT EXISTS forecasts (
    artist_id BIGINT NOT NULL REFERENCES artists(id),
    forecast_date DATE NOT NULL,
    mean NUMERIC(12,2) NOT NULL,
    lower NUMERIC(12,2) NOT NULL,
    upper NUMERIC(12,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (artist_id, forecast_date)
);

-- Columns added after the first deploy, so existing databases pick them up on restart.
ALTER TABLE users ADD COLUMN IF NOT EXISTS kind VARCHAR(10) NOT NULL DEFAULT 'human';
ALTER TABLE artists ADD COLUMN IF NOT EXISTS genre VARCHAR(40) NOT NULL DEFAULT '';
ALTER TABLE events ADD COLUMN IF NOT EXISTS impact_pct DOUBLE PRECISION NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_tx_user ON transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(game_date DESC);
