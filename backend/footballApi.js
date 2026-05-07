const axios = require('axios');

const API_KEY = process.env.FOOTBALL_API_KEY;
const BASE_URL = 'https://api.football-data.org/v4';

const TEAM_NAMES_HE = {
  'Germany': 'גרמניה', 'Brazil': 'ברזיל', 'Argentina': 'ארגנטינה',
  'France': 'צרפת', 'Spain': 'ספרד', 'England': 'אנגליה',
  'Portugal': 'פורטוגל', 'Netherlands': 'הולנד', 'Italy': 'איטליה',
  'Belgium': 'בלגיה', 'Croatia': 'קרואטיה', 'Uruguay': 'אורוגוואי',
  'Mexico': 'מקסיקו', 'USA': 'ארצות הברית', 'United States': 'ארצות הברית',
  'Canada': 'קנדה', 'Japan': 'יפן', 'South Korea': 'קוריאה הדרומית',
  'Australia': 'אוסטרליה', 'Morocco': 'מרוקו', 'Senegal': 'סנגל',
  'Ghana': 'גאנה', 'Cameroon': 'קמרון', 'Nigeria': 'ניגריה',
  'Ecuador': 'אקוודור', 'Colombia': 'קולומביה', 'Chile': 'צ\'ילה',
  'Peru': 'פרו', 'Switzerland': 'שווייץ', 'Denmark': 'דנמרק',
  'Poland': 'פולין', 'Serbia': 'סרביה', 'Wales': 'ויילס',
  'Czechia': 'צ\'כיה', 'Hungary': 'הונגריה', 'Turkey': 'טורקיה',
  'Saudi Arabia': 'ערב הסעודית', 'Iran': 'איראן', 'Qatar': 'קטאר',
  'Tunisia': 'תוניסיה', 'Costa Rica': 'קוסטה ריקה', 'Panama': 'פנמה',
  'Honduras': 'הונדורס', 'Bolivia': 'בוליביה', 'Venezuela': 'ונצואלה',
  'Paraguay': 'פרגוואי', 'South Africa': 'דרום אפריקה', 'Egypt': 'מצרים',
  'Algeria': 'אלג\'יריה', 'Slovakia': 'סלובקיה', 'Slovenia': 'סלובניה',
  'Austria': 'אוסטריה', 'Scotland': 'סקוטלנד', 'Ukraine': 'אוקראינה',
  'Sweden': 'שוודיה', 'Romania': 'רומניה', 'Greece': 'יוון',
  'New Zealand': 'ניו זילנד', 'Ivory Coast': 'חוף השנהב',
  'DR Congo': 'קונגו', 'Mali': 'מאלי', 'Tanzania': 'טנזניה',
  'Indonesia': 'אינדונזיה', 'Thailand': 'תאילנד', 'China PR': 'סין',
  'Iraq': 'עיראק', 'Jordan': 'ירדן', 'Kuwait': 'כוויית',
  'Bahrain': 'בחריין', 'Cuba': 'קובה', 'Guatemala': 'גואטמלה',
  'Jamaica': 'ג\'מייקה', 'Trinidad and Tobago': 'טרינידד וטובגו',
};

const STAGE_NAMES_HE = {
  'GROUP_STAGE': 'שלב הבתים',
  'LAST_16': 'שמינית גמר',
  'QUARTER_FINALS': 'רבע גמר',
  'SEMI_FINALS': 'חצי גמר',
  'THIRD_PLACE': 'משחק שלישי',
  'FINAL': 'גמר',
};

function translateTeam(name) {
  return TEAM_NAMES_HE[name] || name;
}

function translateStage(stage) {
  return STAGE_NAMES_HE[stage] || stage;
}

async function fetchMatches() {
  try {
    const res = await axios.get(`${BASE_URL}/competitions/WC/matches?season=2026`, {
      headers: { 'X-Auth-Token': API_KEY },
      timeout: 10000,
    });
    return res.data.matches || [];
  } catch (err) {
    console.error('API fetch error:', err.message);
    if (err.stack) console.error('Stack trace:', err.stack);
    if (err.response) {
      console.error('API response status:', err.response.status);
      console.error('API response data:', err.response.data);
    }
    return [];
  }
}

async function fetchLiveMatches() {
  try {
    const res = await axios.get(`${BASE_URL}/competitions/WC/matches?status=IN_PLAY,PAUSED`, {
      headers: { 'X-Auth-Token': API_KEY },
      timeout: 10000,
    });
    return res.data.matches || [];
  } catch (err) {
    console.error('API live fetch error:', err.message);
    if (err.stack) console.error('Stack trace:', err.stack);
    if (err.response) {
      console.error('API response status:', err.response.status);
      console.error('API response data:', err.response.data);
    }
    return [];
  }
}

function mapMatch(m) {
  const homeEn = m.homeTeam?.name || m.homeTeam?.shortName || '?';
  const awayEn = m.awayTeam?.name || m.awayTeam?.shortName || '?';
  const isKnockout = !['GROUP_STAGE'].includes(m.stage);
  
  return {
    api_id: m.id,
    home_team: translateTeam(homeEn),
    away_team: translateTeam(awayEn),
    home_team_code: m.homeTeam?.tla || homeEn.substring(0, 3).toUpperCase(),
    away_team_code: m.awayTeam?.tla || awayEn.substring(0, 3).toUpperCase(),
    home_flag: getFlagEmoji(m.homeTeam?.tla),
    away_flag: getFlagEmoji(m.awayTeam?.tla),
    kickoff: m.utcDate,
    stage: translateStage(m.stage),
    stage_key: m.stage,
    group_name: m.group ? m.group.replace('GROUP_', 'קבוצה ') : null,
    status: m.status,
    home_score: m.score?.fullTime?.home ?? null,
    away_score: m.score?.fullTime?.away ?? null,
    home_score_et: m.score?.extraTime?.home ?? null,
    away_score_et: m.score?.extraTime?.away ?? null,
    winner_et: m.score?.winner || null,
    is_knockout: isKnockout ? 1 : 0,
  };
}

function getFlagEmoji(tla) {
  const flags = {
    'GER': '🇩🇪', 'BRA': '🇧🇷', 'ARG': '🇦🇷', 'FRA': '🇫🇷',
    'ESP': '🇪🇸', 'ENG': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'POR': '🇵🇹', 'NED': '🇳🇱',
    'ITA': '🇮🇹', 'BEL': '🇧🇪', 'CRO': '🇭🇷', 'URU': '🇺🇾',
    'MEX': '🇲🇽', 'USA': '🇺🇸', 'CAN': '🇨🇦', 'JPN': '🇯🇵',
    'KOR': '🇰🇷', 'AUS': '🇦🇺', 'MAR': '🇲🇦', 'SEN': '🇸🇳',
    'GHA': '🇬🇭', 'CMR': '🇨🇲', 'NGA': '🇳🇬', 'ECU': '🇪🇨',
    'COL': '🇨🇴', 'CHI': '🇨🇱', 'PER': '🇵🇪', 'SUI': '🇨🇭',
    'DEN': '🇩🇰', 'POL': '🇵🇱', 'SRB': '🇷🇸', 'WAL': '🏴󠁧󠁢󠁷󠁬󠁳󠁿',
    'CZE': '🇨🇿', 'HUN': '🇭🇺', 'TUR': '🇹🇷', 'KSA': '🇸🇦',
    'IRN': '🇮🇷', 'QAT': '🇶🇦', 'TUN': '🇹🇳', 'CRC': '🇨🇷',
    'PAN': '🇵🇦', 'RSA': '🇿🇦', 'EGY': '🇪🇬', 'ALG': '🇩🇿',
    'SVK': '🇸🇰', 'SVN': '🇸🇮', 'AUT': '🇦🇹', 'SCO': '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
    'UKR': '🇺🇦', 'SWE': '🇸🇪', 'ROU': '🇷🇴', 'GRE': '🇬🇷',
    'CIV': '🇨🇮', 'COD': '🇨🇩', 'MLI': '🇲🇱', 'TZA': '🇹🇿',
    'IDN': '🇮🇩', 'THA': '🇹🇭', 'CHN': '🇨🇳', 'IRQ': '🇮🇶',
    'JOR': '🇯🇴', 'KUW': '🇰🇼', 'BHR': '🇧🇭',
  };
  return flags[tla] || '🏳️';
}

module.exports = { fetchMatches, fetchLiveMatches, mapMatch, translateTeam, translateStage };
