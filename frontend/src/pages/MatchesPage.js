import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { matchesApi, betsApi, statsApi } from '../api';
import { formatDate, formatTime, isBettingOpen, isLive, isFinished, scoreStr } from '../utils/matchHelpers';
import { useAuth } from '../AuthContext';

const STAGE_ORDER = [
  'שלב הבתים','שמינית גמר','רבע גמר','חצי גמר','משחק שלישי','גמר'
];

const ITEMS_PER_PAGE = 10;

export default function MatchesPage() {
  const [matches, setMatches] = useState([]);
  const [myBets, setMyBets] = useState({});
  const [pendingCount, setPendingCount] = useState(0);
  const [activeTab, setActiveTab] = useState('upcoming');
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

  const load = useCallback(async () => {
    try {
      const [mRes, bRes, pRes] = await Promise.all([
        matchesApi.getAll(),
        betsApi.getMy(),
        statsApi.pending(),
      ]);
      setMatches(mRes.data);
      const betsMap = {};
      for (const b of bRes.data) betsMap[b.match_id] = b;
      setMyBets(betsMap);
      setPendingCount(pRes.data.length);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);

  const now = new Date();
  const filtered = matches.filter(m => {
    if (activeTab === 'live') return isLive(m);
    if (activeTab === 'upcoming') return !isFinished(m) && !isLive(m);
    if (activeTab === 'finished') return isFinished(m);
    return true;
  });

  // Group by stage+group
  const grouped = {};
  for (const m of filtered) {
    const key = m.group_name || m.stage;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(m);
  }
  const sortedKeys = Object.keys(grouped).sort((a,b) => {
    const ai = STAGE_ORDER.indexOf(grouped[a][0]?.stage);
    const bi = STAGE_ORDER.indexOf(grouped[b][0]?.stage);
    return ai - bi;
  });

  // Pagination
  const totalPages = Math.ceil(sortedKeys.length / ITEMS_PER_PAGE);
  const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIdx = startIdx + ITEMS_PER_PAGE;
  const paginatedKeys = sortedKeys.slice(startIdx, endIdx);

  // Reset to page 1 when changing tabs
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);

  return (
    <div style={{paddingBottom: 80}}>
      <div className="page-header">
        <h1>🏆 לוח משחקים</h1>
        <div className="subtitle">מונדיאל 2026</div>
      </div>

      {pendingCount > 0 && (
        <div className="notif-banner" onClick={() => setActiveTab('upcoming')}>
          <span className="notif-icon">⚠️</span>
          <span className="notif-text">{pendingCount} משחקים ב-3 שעות הקרובות ללא הימור שלך!</span>
          <span style={{color:'var(--red)', fontSize:18}}>›</span>
        </div>
      )}

      <div className="tabs">
        {[
          {id:'upcoming', label:'קרובים'},
          {id:'live', label:'🔴 חיים'},
          {id:'finished', label:'הסתיימו'},
          {id:'all', label:'הכל'},
        ].map(t => (
          <button key={t.id} className={`tab ${activeTab===t.id?'active':''}`} onClick={() => setActiveTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {loading && <div className="empty-state"><div className="icon">⏳</div><p>טוען...</p></div>}

      {!loading && filtered.length === 0 && (
        <div className="empty-state">
          <div className="icon">🏟️</div>
          <p>אין משחקים בקטגוריה זו</p>
        </div>
      )}

      {paginatedKeys.map(key => (
        <div key={key}>
          <div className="section-header">{key}</div>
          {grouped[key].map(m => (
            <MatchCard
              key={m.id}
              match={m}
              myBet={myBets[m.id]}
              onClick={() => navigate(`/match/${m.id}`)}
            />
          ))}
        </div>
      ))}

      {totalPages > 1 && (
        <div className="pagination">
          <button
            className="pagination-btn"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            ← הקודם
          </button>
          <div className="pagination-info">
            עמוד {currentPage} מתוך {totalPages}
          </div>
          <button
            className="pagination-btn"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            הבא →
          </button>
        </div>
      )}
    </div>
  );
}

function MatchCard({ match, myBet, onClick }) {
  const open = isBettingOpen(match);
  const live = isLive(match);
  const finished = isFinished(match);

  let cardClass = 'match-card';
  if (finished || !open) {
    cardClass += ' closed';
  } else if (myBet) {
    cardClass += ' has-bet';
  } else {
    cardClass += ' no-bet';
  }

  return (
    <div className={cardClass} onClick={onClick}>
      {myBet?.is_doubled ? <div className="double-badge">✕2</div> : null}

      <div className="match-teams">
        <div className="team">
          <div className="team-flag">{match.home_flag || '🏳️'}</div>
          <div className="team-name">{match.home_team}</div>
        </div>

        <div className="match-vs">
          {live ? (
            <>
              <div className="score-display">{scoreStr(match.home_score, match.away_score)}</div>
              <div className="live-badge"><span className="live-dot"/>חי</div>
            </>
          ) : finished ? (
            <>
              <div className="score-display">{scoreStr(match.home_score, match.away_score)}</div>
              <div className="vs-text">תוצאה סופית</div>
            </>
          ) : (
            <>
              <div className="score-display" style={{fontSize:18, color:'var(--text2)'}}>נגד</div>
              <div className="vs-text">{formatTime(match.kickoff)}</div>
            </>
          )}
        </div>

        <div className="team">
          <div className="team-flag">{match.away_flag || '🏳️'}</div>
          <div className="team-name">{match.away_team}</div>
        </div>
      </div>

      <div className="match-meta">
        <span className="match-date">📅 {formatDate(match.kickoff)}</span>
        <span className="match-stage">{match.group_name || match.stage}</span>
        {myBet && open ? (
          <span className="bet-preview">✓ {myBet.home_score}–{myBet.away_score}</span>
        ) : !myBet && open ? (
          <span className="bet-missing">← הימר עכשיו</span>
        ) : myBet && finished && myBet.points != null ? (
          <span className={`points-badge points-${myBet.points}`}>{myBet.points}</span>
        ) : null}
      </div>
    </div>
  );
}
