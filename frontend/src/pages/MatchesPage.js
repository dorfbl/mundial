import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { matchesApi, betsApi, statsApi, teamsApi, championApi } from '../api';
import { formatDate, formatTime, isBettingOpen, isLive, isFinished, scoreStr } from '../utils/matchHelpers';
import { useAuth } from '../AuthContext';

const STAGE_ORDER = [
  'שלב הבתים','שמינית גמר','רבע גמר','חצי גמר','משחק שלישי','גמר'
];

const ITEMS_PER_PAGE = 10;

// TLA (3-letter) → ISO alpha-2 for flagcdn.com
const TLA_TO_ALPHA2 = {
  'GER':'de','BRA':'br','ARG':'ar','FRA':'fr','ESP':'es','ENG':'gb-eng',
  'POR':'pt','NED':'nl','ITA':'it','BEL':'be','CRO':'hr','URU':'uy',
  'MEX':'mx','USA':'us','CAN':'ca','JPN':'jp','KOR':'kr','AUS':'au',
  'MAR':'ma','SEN':'sn','GHA':'gh','CMR':'cm','NGA':'ng','ECU':'ec',
  'COL':'co','CHI':'cl','PER':'pe','SUI':'ch','DEN':'dk','POL':'pl',
  'SRB':'rs','WAL':'gb-wls','CZE':'cz','HUN':'hu','TUR':'tr','KSA':'sa',
  'IRN':'ir','QAT':'qa','TUN':'tn','CRC':'cr','PAN':'pa','RSA':'za',
  'EGY':'eg','ALG':'dz','SVK':'sk','SVN':'si','AUT':'at','SCO':'gb-sct',
  'UKR':'ua','SWE':'se','ROU':'ro','GRE':'gr','CIV':'ci','COD':'cd',
  'MLI':'ml','TZA':'tz','IDN':'id','THA':'th','CHN':'cn','IRQ':'iq',
  'JOR':'jo','KUW':'kw','BHR':'bh','BOL':'bo','VEN':'ve','PRY':'py',
  'HON':'hn','NZL':'nz','GTM':'gt','JAM':'jm','CUB':'cu','TTO':'tt',
  'PAR':'py','HON':'hn','NCA':'ni','SLV':'sv','VEN':'ve',
};

export function FlagImg({ code, size = 40, alt = '' }) {
  const alpha2 = TLA_TO_ALPHA2[code];
  if (!alpha2) return <span style={{ fontSize: size * 0.8, lineHeight: 1 }}>🏳️</span>;
  return (
    <img
      src={`https://flagcdn.com/w${size * 2}/${alpha2}.png`}
      srcSet={`https://flagcdn.com/w${size * 2}/${alpha2}.png 2x`}
      width={size}
      alt={alt}
      style={{ borderRadius: 3, display: 'block', objectFit: 'cover' }}
      onError={e => { e.target.style.display = 'none'; }}
    />
  );
}

export default function MatchesPage() {
  const [matches, setMatches] = useState([]);
  const [myBets, setMyBets] = useState({});
  const [pendingCount, setPendingCount] = useState(0);
  const [activeTab, setActiveTab] = useState('upcoming');
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [championBet, setChampionBet] = useState(null);
  const [championIsOpen, setChampionIsOpen] = useState(false);
  const [showChampionModal, setShowChampionModal] = useState(false);
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [championLoading, setChampionLoading] = useState(false);
  const [championError, setChampionError] = useState('');

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

  const loadChampion = useCallback(async () => {
    try {
      const res = await championApi.get();
      setChampionBet(res.data.bet);
      setChampionIsOpen(res.data.isOpen);
    } catch (_) {}
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);
  useEffect(() => { loadChampion(); }, [loadChampion]);

  const openChampionModal = async () => {
    setChampionError('');
    setSelectedTeam(null);
    if (teams.length === 0) {
      try {
        const res = await teamsApi.getAll();
        setTeams(res.data);
      } catch (_) {}
    }
    setShowChampionModal(true);
  };

  const submitChampion = async () => {
    if (!selectedTeam) return;
    setChampionLoading(true);
    setChampionError('');
    try {
      await championApi.place({
        team_name: selectedTeam.name,
        team_code: selectedTeam.code,
        team_flag: selectedTeam.flag,
      });
      await loadChampion();
      setShowChampionModal(false);
    } catch (err) {
      setChampionError(err.response?.data?.error || 'שגיאה');
    } finally {
      setChampionLoading(false);
    }
  };

  const now = new Date();
  const filtered = matches.filter(m => {
    if (activeTab === 'live') return isLive(m);
    if (activeTab === 'upcoming') return !isFinished(m) && !isLive(m);
    if (activeTab === 'finished') return isFinished(m);
    return true;
  });

  const grouped = {};
  for (const m of filtered) {
    const key = m.group_name || m.stage;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(m);
  }
  const sortedKeys = Object.keys(grouped).sort((a, b) => {
    const ai = STAGE_ORDER.indexOf(grouped[a][0]?.stage);
    const bi = STAGE_ORDER.indexOf(grouped[b][0]?.stage);
    return ai - bi;
  });

  const totalPages = Math.ceil(sortedKeys.length / ITEMS_PER_PAGE);
  const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedKeys = sortedKeys.slice(startIdx, startIdx + ITEMS_PER_PAGE);

  useEffect(() => { setCurrentPage(1); }, [activeTab]);

  return (
    <div style={{ paddingBottom: 80 }}>
      <div className="page-header">
        <h1>🏆 לוח משחקים</h1>
        <div className="subtitle">מונדיאל 2026</div>
      </div>

      {/* Champion prediction card */}
      <ChampionCard
        bet={championBet}
        isOpen={championIsOpen}
        onPick={openChampionModal}
      />

      {pendingCount > 0 && (
        <div className="notif-banner" onClick={() => setActiveTab('upcoming')}>
          <span className="notif-icon">⚠️</span>
          <span className="notif-text">{pendingCount} משחקים ב-3 שעות הקרובות ללא הימור שלך!</span>
          <span style={{ color: 'var(--red)', fontSize: 18 }}>›</span>
        </div>
      )}

      <div className="tabs">
        {[
          { id: 'upcoming', label: 'קרובים' },
          { id: 'live', label: '🔴 חיים' },
          { id: 'finished', label: 'הסתיימו' },
          { id: 'all', label: 'הכל' },
        ].map(t => (
          <button key={t.id} className={`tab ${activeTab === t.id ? 'active' : ''}`} onClick={() => setActiveTab(t.id)}>
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
          <div className="pagination-info">עמוד {currentPage} מתוך {totalPages}</div>
          <button
            className="pagination-btn"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            הבא →
          </button>
        </div>
      )}

      {showChampionModal && (
        <ChampionModal
          teams={teams}
          selected={selectedTeam}
          onSelect={setSelectedTeam}
          onConfirm={submitChampion}
          onClose={() => setShowChampionModal(false)}
          loading={championLoading}
          error={championError}
        />
      )}
    </div>
  );
}

function ChampionCard({ bet, isOpen, onPick }) {
  if (!isOpen && !bet) return null;

  if (bet) {
    const won = bet.points === 8;
    const lost = bet.points === 0 && bet.points !== null;
    const pending = bet.points === null;
    return (
      <div className={`champion-card ${won ? 'champion-won' : lost ? 'champion-lost' : ''}`}>
        <div className="champion-card-title">🏆 ניחוש אלוף המונדיאל</div>
        <div className="champion-card-pick">
          <FlagImg code={bet.team_code} size={36} alt={bet.team_name} />
          <span className="champion-team-name">{bet.team_name}</span>
          <span className="champion-lock">🔒</span>
        </div>
        {!pending && (
          <div className={`champion-result ${won ? 'text-gold' : 'text-muted'}`}>
            {won ? `✓ ניחשת נכון! +8 נקודות` : `✗ לא הצלחת הפעם`}
          </div>
        )}
        {pending && <div className="champion-pending">הניחוש נעול — ממתין לתוצאה</div>}
      </div>
    );
  }

  return (
    <div className="champion-card champion-open" onClick={onPick}>
      <div className="champion-card-title">🏆 מי יהיה אלוף המונדיאל?</div>
      <div className="champion-card-sub">בחר עכשיו לפני תחילת הטורניר — 8 נקודות אם תנחש נכון!</div>
      <div className="champion-pick-btn">בחר קבוצה ←</div>
    </div>
  );
}

function ChampionModal({ teams, selected, onSelect, onConfirm, onClose, loading, error }) {
  const [search, setSearch] = useState('');
  const filtered = teams.filter(t => t.name.includes(search));

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal champion-modal">
        <div className="modal-handle" />
        <div className="modal-header">
          <div style={{ fontSize: 18, fontWeight: 800 }}>🏆 בחר אלוף המונדיאל</div>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 4 }}>הבחירה נעולה — לא ניתן לשנות לאחר אישור</div>
        </div>
        <div className="modal-body">
          <input
            className="input"
            placeholder="חפש קבוצה..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ marginBottom: 12 }}
          />
          {teams.length === 0 && (
            <div className="empty-state" style={{ padding: '24px 0' }}>
              <p>הקבוצות יופיעו לאחר סנכרון הנתונים מה-API</p>
            </div>
          )}
          <div className="champion-team-grid">
            {filtered.map(t => (
              <button
                key={t.code}
                className={`champion-team-item ${selected?.code === t.code ? 'selected' : ''}`}
                onClick={() => onSelect(t)}
              >
                <FlagImg code={t.code} size={32} alt={t.name} />
                <span>{t.name}</span>
              </button>
            ))}
          </div>
          {error && <div className="alert alert-error" style={{ marginTop: 12 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button className="btn btn-secondary btn-sm" onClick={onClose} style={{ flex: 1 }}>ביטול</button>
            <button
              className="btn btn-primary"
              style={{ flex: 2 }}
              disabled={!selected || loading}
              onClick={onConfirm}
            >
              {loading ? '...' : `אשר: ${selected?.name || ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MatchCard({ match, myBet, onClick }) {
  const open = isBettingOpen(match);
  const live = isLive(match);
  const finished = isFinished(match);

  let cardClass = 'match-card';
  if (finished || !open) cardClass += ' closed';
  else if (myBet) cardClass += ' has-bet';
  else cardClass += ' no-bet';

  return (
    <div className={cardClass} onClick={onClick}>
      {myBet?.is_doubled ? <div className="double-badge">✕2</div> : null}

      <div className="match-teams">
        <div className="team">
          <div className="team-flag">
            <FlagImg code={match.home_team_code} size={40} alt={match.home_team} />
          </div>
          <div className="team-name">{match.home_team}</div>
        </div>

        <div className="match-vs">
          {live ? (
            <>
              <div className="score-display">{scoreStr(match.home_score, match.away_score)}</div>
              <div className="live-badge"><span className="live-dot" />חי</div>
            </>
          ) : finished ? (
            <>
              <div className="score-display">{scoreStr(match.home_score, match.away_score)}</div>
              <div className="vs-text">תוצאה סופית</div>
            </>
          ) : (
            <>
              <div className="score-display" style={{ fontSize: 18, color: 'var(--text2)' }}>נגד</div>
              <div className="vs-text">{formatTime(match.kickoff)}</div>
            </>
          )}
        </div>

        <div className="team">
          <div className="team-flag">
            <FlagImg code={match.away_team_code} size={40} alt={match.away_team} />
          </div>
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
