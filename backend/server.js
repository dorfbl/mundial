require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const cron = require('node-cron');
const { getDb } = require('./db');
const { fetchMatches, fetchLiveMatches, mapMatch } = require('./footballApi');
const { calculateBetPoints, calculateEtPoints } = require('./scoring');
const { generateToken, authMiddleware, adminMiddleware } = require('./auth');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

// ─── SYNC MATCHES FROM API ───────────────────────────────────────────────────
async function syncMatches() {
  console.log('Syncing matches from football-data.org...');
  const matches = await fetchMatches();
  const db = getDb();
  
  const upsert = db.prepare(`
    INSERT INTO matches (api_id, home_team, away_team, home_team_code, away_team_code, home_flag, away_flag, kickoff, stage, group_name, status, home_score, away_score, home_score_et, away_score_et, winner_et, is_knockout, updated_at)
    VALUES (@api_id, @home_team, @away_team, @home_team_code, @away_team_code, @home_flag, @away_flag, @kickoff, @stage, @group_name, @status, @home_score, @away_score, @home_score_et, @away_score_et, @winner_et, @is_knockout, datetime('now'))
    ON CONFLICT(api_id) DO UPDATE SET
      home_team=excluded.home_team,
      away_team=excluded.away_team,
      home_team_code=excluded.home_team_code,
      away_team_code=excluded.away_team_code,
      home_flag=excluded.home_flag,
      away_flag=excluded.away_flag,
      kickoff=excluded.kickoff,
      stage=excluded.stage,
      group_name=excluded.group_name,
      status=excluded.status,
      home_score=excluded.home_score,
      away_score=excluded.away_score,
      home_score_et=excluded.home_score_et,
      away_score_et=excluded.away_score_et,
      winner_et=excluded.winner_et,
      is_knockout=excluded.is_knockout,
      updated_at=datetime('now')
  `);

  const syncAll = db.transaction((matches) => {
    for (const m of matches) upsert.run(mapMatch(m));
  });
  
  syncAll(matches);
  console.log(`Synced ${matches.length} matches`);
  
  // Recalculate points for finished matches
  recalculateAllPoints();
}

async function syncLive() {
  const matches = await fetchLiveMatches();
  if (!matches.length) return;
  const db = getDb();
  
  for (const m of matches) {
    const mapped = mapMatch(m);
    db.prepare(`UPDATE matches SET status=?, home_score=?, away_score=?, updated_at=datetime('now') WHERE api_id=?`)
      .run(mapped.status, mapped.home_score, mapped.away_score, mapped.api_id);
  }
  recalculateAllPoints();
}

function recalculateAllPoints() {
  const db = getDb();
  const finishedMatches = db.prepare(`SELECT * FROM matches WHERE status IN ('FINISHED','AWARDED') AND home_score IS NOT NULL`).all();
  
  for (const match of finishedMatches) {
    const bets = db.prepare(`SELECT * FROM bets WHERE match_id=?`).all(match.id);
    for (const bet of bets) {
      const pts = calculateBetPoints(bet.home_score, bet.away_score, match.home_score, match.away_score, bet.is_doubled === 1);
      db.prepare(`UPDATE bets SET points=? WHERE id=?`).run(pts, bet.id);
    }
    
    // ET bets
    if (match.winner_et && match.winner_et !== 'DRAW') {
      const etBets = db.prepare(`SELECT * FROM extra_time_bets WHERE match_id=?`).all(match.id);
      for (const eb of etBets) {
        const pts = calculateEtPoints(eb.winner, match.winner_et);
        db.prepare(`UPDATE extra_time_bets SET points=? WHERE id=?`).run(pts, eb.id);
      }
    }
  }
}

// ─── AUTH ROUTES ─────────────────────────────────────────────────────────────
app.post('/api/auth/login', (req, res) => {
  const { username } = req.body;
  if (!username?.trim()) return res.status(400).json({ error: 'נדרש שם משתמש' });
  
  const db = getDb();
  let user = db.prepare(`SELECT * FROM users WHERE username=?`).get(username.trim().toLowerCase());
  
  if (!user) {
    // Auto-create user on first login (no password needed for friends)
    const result = db.prepare(`INSERT INTO users (username, display_name) VALUES (?,?)`).run(
      username.trim().toLowerCase(), username.trim()
    );
    user = db.prepare(`SELECT * FROM users WHERE id=?`).get(result.lastInsertRowid);
  }
  
  const token = generateToken(user);
  res.json({ token, user: { id: user.id, username: user.username, display_name: user.display_name, is_admin: user.is_admin } });
});

app.post('/api/auth/admin-login', (req, res) => {
  const { password } = req.body;
  const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'admin123';
  if (password !== ADMIN_PASS) return res.status(401).json({ error: 'סיסמה שגויה' });
  
  const db = getDb();
  let admin = db.prepare(`SELECT * FROM users WHERE username='admin'`).get();
  if (!admin) {
    const r = db.prepare(`INSERT INTO users (username, display_name, is_admin) VALUES ('admin','מנהל',1)`).run();
    admin = db.prepare(`SELECT * FROM users WHERE id=?`).get(r.lastInsertRowid);
  }
  
  res.json({ token: generateToken(admin), user: { ...admin } });
});

// ─── MATCHES ROUTES ───────────────────────────────────────────────────────────
app.get('/api/matches', authMiddleware, (req, res) => {
  const db = getDb();
  const matches = db.prepare(`SELECT * FROM matches ORDER BY kickoff ASC`).all();
  res.json(matches);
});

app.get('/api/matches/:id', authMiddleware, (req, res) => {
  const db = getDb();
  const match = db.prepare(`SELECT * FROM matches WHERE id=?`).get(req.params.id);
  if (!match) return res.status(404).json({ error: 'משחק לא נמצא' });
  res.json(match);
});

// Admin: manually update match result
app.put('/api/matches/:id/result', authMiddleware, adminMiddleware, (req, res) => {
  const { home_score, away_score, status, winner_et, home_score_et, away_score_et } = req.body;
  const db = getDb();
  db.prepare(`UPDATE matches SET home_score=?, away_score=?, status=?, winner_et=?, home_score_et=?, away_score_et=?, updated_at=datetime('now') WHERE id=?`)
    .run(home_score, away_score, status || 'FINISHED', winner_et || null, home_score_et || null, away_score_et || null, req.params.id);
  recalculateAllPoints();
  res.json({ ok: true });
});

// Admin: sync from API
app.post('/api/admin/sync', authMiddleware, adminMiddleware, async (req, res) => {
  await syncMatches();
  res.json({ ok: true });
});

// ─── BETS ROUTES ──────────────────────────────────────────────────────────────
function isBettingOpen(match) {
  const kickoff = new Date(match.kickoff);
  const now = new Date();
  const diffMs = kickoff - now;
  return diffMs > 5 * 60 * 1000; // more than 5 minutes before kickoff
}

app.get('/api/bets/my', authMiddleware, (req, res) => {
  const db = getDb();
  const bets = db.prepare(`SELECT b.*, m.home_team, m.away_team, m.kickoff, m.status as match_status 
    FROM bets b JOIN matches m ON b.match_id=m.id WHERE b.user_id=?`).all(req.user.id);
  res.json(bets);
});

app.get('/api/bets/match/:matchId', authMiddleware, (req, res) => {
  const db = getDb();
  const match = db.prepare(`SELECT * FROM matches WHERE id=?`).get(req.params.matchId);
  if (!match) return res.status(404).json({ error: 'משחק לא נמצא' });
  
  const isOpen = isBettingOpen(match);
  
  if (isOpen) {
    // Only return current user's bet
    const myBet = db.prepare(`SELECT b.*, u.display_name FROM bets b JOIN users u ON b.user_id=u.id WHERE b.match_id=? AND b.user_id=?`)
      .get(req.params.matchId, req.user.id);
    return res.json({ isOpen: true, myBet: myBet || null, allBets: null });
  } else {
    // Return all bets
    const allBets = db.prepare(`SELECT b.*, u.display_name FROM bets b JOIN users u ON b.user_id=u.id WHERE b.match_id=?`)
      .all(req.params.matchId);
    const myBet = allBets.find(b => b.user_id === req.user.id) || null;
    return res.json({ isOpen: false, myBet, allBets });
  }
});

app.post('/api/bets', authMiddleware, (req, res) => {
  const { match_id, home_score, away_score } = req.body;
  if (home_score === null || home_score === undefined || away_score === null || away_score === undefined) {
    return res.status(400).json({ error: 'נדרשת תוצאה' });
  }

  // Validate scores are non-negative integers
  const homeScoreNum = Number(home_score);
  const awayScoreNum = Number(away_score);
  if (!Number.isInteger(homeScoreNum) || !Number.isInteger(awayScoreNum) || homeScoreNum < 0 || awayScoreNum < 0) {
    return res.status(400).json({ error: 'התוצאה חייבת להיות מספרים שלמים לא שליליים' });
  }

  const db = getDb();
  const match = db.prepare(`SELECT * FROM matches WHERE id=?`).get(match_id);
  if (!match) return res.status(404).json({ error: 'משחק לא נמצא' });
  if (!isBettingOpen(match)) return res.status(400).json({ error: 'ההימור נסגר 5 דקות לפני המשחק' });
  
  const upsertBet = db.transaction((userId, matchId, homeScore, awayScore) => {
    const existing = db.prepare(`SELECT * FROM bets WHERE user_id=? AND match_id=?`).get(userId, matchId);

    if (existing) {
      db.prepare(`UPDATE bets SET home_score=?, away_score=?, updated_at=datetime('now') WHERE id=?`)
        .run(homeScore, awayScore, existing.id);
    } else {
      db.prepare(`INSERT INTO bets (user_id, match_id, home_score, away_score) VALUES (?,?,?,?)`)
        .run(userId, matchId, homeScore, awayScore);
    }
  });

  upsertBet(req.user.id, match_id, homeScoreNum, awayScoreNum);
  res.json({ ok: true });
});

// Double bet
app.post('/api/bets/double', authMiddleware, (req, res) => {
  const { match_id } = req.body;
  const db = getDb();
  const match = db.prepare(`SELECT * FROM matches WHERE id=?`).get(match_id);
  if (!match) return res.status(404).json({ error: 'משחק לא נמצא' });
  if (!isBettingOpen(match)) return res.status(400).json({ error: 'ההימור נסגר' });
  
  const betType = match.is_knockout ? 'knockout' : 'group';
  const alreadyUsed = db.prepare(`SELECT * FROM doubled_bets WHERE user_id=? AND bet_type=?`).get(req.user.id, betType);
  if (alreadyUsed) return res.status(400).json({ error: `כבר השתמשת בהכפלה ב${betType === 'group' ? 'שלב הבתים' : 'פלייאוף'}` });
  
  const myBet = db.prepare(`SELECT * FROM bets WHERE user_id=? AND match_id=?`).get(req.user.id, match_id);
  if (!myBet) return res.status(400).json({ error: 'יש להזין הימור קודם' });
  
  db.prepare(`INSERT INTO doubled_bets (user_id, bet_type, match_id) VALUES (?,?,?)`).run(req.user.id, betType, match_id);
  db.prepare(`UPDATE bets SET is_doubled=1 WHERE user_id=? AND match_id=?`).run(req.user.id, match_id);
  
  res.json({ ok: true });
});

// ET bets
app.post('/api/bets/extra-time', authMiddleware, (req, res) => {
  const { match_id, winner } = req.body;
  const db = getDb();
  const match = db.prepare(`SELECT * FROM matches WHERE id=?`).get(match_id);
  if (!match) return res.status(404).json({ error: 'משחק לא נמצא' });
  
  // ET window: only when match is IN_PLAY and regular time score is a draw
  if (match.status !== 'IN_PLAY' && match.status !== 'PAUSED') {
    return res.status(400).json({ error: 'חלון הארכה לא פתוח' });
  }
  if (match.home_score !== match.away_score) {
    return res.status(400).json({ error: 'אין תיקו, אין הימור הארכה' });
  }
  
  const existing = db.prepare(`SELECT * FROM extra_time_bets WHERE user_id=? AND match_id=?`).get(req.user.id, match_id);
  if (existing) return res.status(400).json({ error: 'כבר הימרת על הארכה' });
  
  db.prepare(`INSERT INTO extra_time_bets (user_id, match_id, winner) VALUES (?,?,?)`).run(req.user.id, match_id, winner);
  res.json({ ok: true });
});

// ─── LEADERBOARD & STATS ──────────────────────────────────────────────────────
app.get('/api/leaderboard', authMiddleware, (req, res) => {
  const db = getDb();
  
  const users = db.prepare(`
    SELECT 
      u.id, u.display_name, u.username,
      COALESCE(SUM(b.points), 0) + COALESCE(SUM(eb.points), 0) as total_points,
      COALESCE(SUM(b.points), 0) as bet_points,
      COALESCE(SUM(eb.points), 0) as et_points,
      COUNT(DISTINCT b.id) as total_bets,
      COUNT(DISTINCT CASE WHEN b.points = 3 THEN b.id END) as exact_bets,
      COUNT(DISTINCT CASE WHEN b.points > 0 THEN b.id END) as correct_bets
    FROM users u
    LEFT JOIN bets b ON b.user_id = u.id
    LEFT JOIN extra_time_bets eb ON eb.user_id = u.id
    WHERE u.username != 'admin'
    GROUP BY u.id
    ORDER BY total_points DESC, exact_bets DESC
  `).all();
  
  res.json(users);
});

app.get('/api/stats/me', authMiddleware, (req, res) => {
  const db = getDb();
  
  const stats = db.prepare(`
    SELECT 
      COUNT(DISTINCT b.id) as total_bets,
      COUNT(DISTINCT CASE WHEN b.points = 3 THEN b.id END) as exact,
      COUNT(DISTINCT CASE WHEN b.points = 2 THEN b.id END) as correct_diff,
      COUNT(DISTINCT CASE WHEN b.points = 1 THEN b.id END) as correct_winner,
      COUNT(DISTINCT CASE WHEN b.points = 0 AND m.status='FINISHED' THEN b.id END) as wrong,
      COALESCE(SUM(b.points),0) as total_points,
      COUNT(DISTINCT CASE WHEN b.is_doubled=1 THEN b.id END) as doubled_count
    FROM bets b
    JOIN matches m ON b.match_id = m.id
    WHERE b.user_id = ?
  `).get(req.user.id);
  
  const doubledBets = db.prepare(`SELECT * FROM doubled_bets WHERE user_id=?`).all(req.user.id);
  const streak = calculateStreak(req.user.id, db);
  
  res.json({ ...stats, doubledBets, streak });
});

function calculateStreak(userId, db) {
  const bets = db.prepare(`
    SELECT b.points FROM bets b 
    JOIN matches m ON b.match_id=m.id 
    WHERE b.user_id=? AND m.status='FINISHED' AND b.points IS NOT NULL
    ORDER BY m.kickoff DESC
  `).all(userId);
  
  let streak = 0;
  for (const b of bets) {
    if (b.points > 0) streak++;
    else break;
  }
  return streak;
}

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────
app.get('/api/notifications/pending', authMiddleware, (req, res) => {
  const db = getDb();
  const now = new Date();
  const in3h = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  
  const upcoming = db.prepare(`
    SELECT m.* FROM matches m
    WHERE m.kickoff > ? AND m.kickoff < ? AND m.status='SCHEDULED'
    AND m.id NOT IN (SELECT match_id FROM bets WHERE user_id=?)
  `).all(now.toISOString(), in3h.toISOString(), req.user.id);
  
  res.json(upcoming);
});

// ─── CRON JOBS ────────────────────────────────────────────────────────────────
// Sync all matches every 6 hours
cron.schedule('0 */6 * * *', async () => {
  try {
    await syncMatches();
  } catch (err) {
    console.error('Error in syncMatches cron job:', err);
  }
});
// Sync live scores every 2 minutes
cron.schedule('*/2 * * * *', async () => {
  try {
    await syncLive();
  } catch (err) {
    console.error('Error in syncLive cron job:', err);
  }
});

// ─── START ────────────────────────────────────────────────────────────────────
getDb(); // init DB
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🏆 Mundial 2026 Backend running on port ${PORT}`);
  console.log(`🌐 Server accessible at http://10.10.10.135:${PORT}/api`);
  // Initial sync
  setTimeout(syncMatches, 2000);
});
