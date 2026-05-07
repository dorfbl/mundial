const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'mundial.db');

let db;

function getDb() {
  if (!db) {
    const fs = require('fs');
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
  }
  return db;
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      is_admin INTEGER DEFAULT 0,
      password_hash TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      api_id INTEGER UNIQUE,
      home_team TEXT NOT NULL,
      away_team TEXT NOT NULL,
      home_team_code TEXT,
      away_team_code TEXT,
      home_flag TEXT,
      away_flag TEXT,
      kickoff TEXT NOT NULL,
      stage TEXT NOT NULL,
      stage_key TEXT,
      group_name TEXT,
      status TEXT DEFAULT 'SCHEDULED',
      home_score INTEGER,
      away_score INTEGER,
      home_score_et INTEGER,
      away_score_et INTEGER,
      winner_et TEXT,
      is_knockout INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS bets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      match_id INTEGER NOT NULL REFERENCES matches(id),
      home_score INTEGER NOT NULL,
      away_score INTEGER NOT NULL,
      is_doubled INTEGER DEFAULT 0,
      points INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, match_id)
    );

    CREATE TABLE IF NOT EXISTS extra_time_bets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      match_id INTEGER NOT NULL REFERENCES matches(id),
      winner TEXT NOT NULL,
      points INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, match_id)
    );

    CREATE TABLE IF NOT EXISTS doubled_bets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      bet_type TEXT NOT NULL CHECK(bet_type IN ('group','knockout')),
      match_id INTEGER REFERENCES matches(id),
      used_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, bet_type)
    );

    CREATE TABLE IF NOT EXISTS champion_bets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) UNIQUE,
      team_name TEXT NOT NULL,
      team_code TEXT NOT NULL,
      team_flag TEXT,
      points INTEGER,
      locked_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

module.exports = { getDb };
