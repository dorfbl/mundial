import { format, parseISO, isAfter, isBefore, addMinutes } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { he } from 'date-fns/locale';

const ISRAEL_TZ = 'Asia/Jerusalem';

export function formatKickoff(utcDate) {
  const utc = parseISO(utcDate);
  const israelTime = toZonedTime(utc, ISRAEL_TZ);
  return format(israelTime, "EEEE, d בMMM · HH:mm", { locale: he });
}

export function formatTime(utcDate) {
  const utc = parseISO(utcDate);
  const israelTime = toZonedTime(utc, ISRAEL_TZ);
  return format(israelTime, "HH:mm");
}

export function formatDate(utcDate) {
  const utc = parseISO(utcDate);
  const israelTime = toZonedTime(utc, ISRAEL_TZ);
  return format(israelTime, "d בMMM", { locale: he });
}

export function isBettingOpen(match) {
  const kickoff = parseISO(match.kickoff);
  const cutoff = addMinutes(kickoff, -5);
  return isAfter(cutoff, new Date());
}

export function isLive(match) {
  return match.status === 'IN_PLAY' || match.status === 'PAUSED';
}

export function isFinished(match) {
  return match.status === 'FINISHED' || match.status === 'AWARDED';
}

export function getStatusLabel(match) {
  if (match.status === 'IN_PLAY') return 'משחק חי';
  if (match.status === 'PAUSED') return 'הפסקה';
  if (isFinished(match)) return 'הסתיים';
  return formatTime(match.kickoff);
}

export function scoreStr(h, a) {
  if (h == null || a == null) return '-';
  return `${h}–${a}`;
}

export function getPointsColor(pts) {
  if (pts === 3) return 'var(--gold)';
  if (pts === 2) return 'var(--green)';
  if (pts === 1) return 'var(--blue)';
  return 'var(--text3)';
}

export function groupMatchesByStageAndGroup(matches) {
  const groups = {};
  for (const m of matches) {
    const key = m.group_name || m.stage;
    if (!groups[key]) groups[key] = [];
    groups[key].push(m);
  }
  return groups;
}
