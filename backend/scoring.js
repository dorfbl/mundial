/**
 * Calculate points for a bet
 * @param {number} betHome - Bet home score
 * @param {number} betAway - Bet away score
 * @param {number} realHome - Real home score
 * @param {number} realAway - Real away score
 * @param {boolean} isDoubled - Whether this bet is doubled
 * @returns {number} points earned
 */
function calculateBetPoints(betHome, betAway, realHome, realAway, isDoubled = false) {
  let points = 0;

  if (betHome === realHome && betAway === realAway) {
    // Exact result
    points = 3;
  } else {
    const betDiff = betHome - betAway;
    const realDiff = realHome - realAway;
    const betWinner = betHome > betAway ? 'home' : betHome < betAway ? 'away' : 'draw';
    const realWinner = realHome > realAway ? 'home' : realHome < realAway ? 'away' : 'draw';

    if (betWinner === realWinner && betDiff === realDiff) {
      // Correct winner + correct difference
      points = 2;
    } else if (betWinner === realWinner) {
      // Correct winner only
      points = 1;
    } else {
      points = 0;
    }
  }

  return isDoubled ? points * 2 : points;
}

/**
 * Calculate extra time bonus points
 * @param {string} betWinner - 'home' or 'away'
 * @param {string} realWinner - actual winner
 * @returns {number}
 */
function calculateEtPoints(betWinner, realWinner) {
  if (!realWinner || realWinner === 'DRAW') return 0;

  // Validate realWinner is one of the expected values
  if (realWinner !== 'HOME_TEAM' && realWinner !== 'AWAY_TEAM') {
    console.warn(`Unexpected realWinner value: ${realWinner}`);
    return 0;
  }

  const real = realWinner === 'HOME_TEAM' ? 'home' : 'away';
  return betWinner === real ? 1 : 0;
}

module.exports = { calculateBetPoints, calculateEtPoints };
