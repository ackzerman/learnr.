/**
 * dateHelpers.js
 * Utility functions for date formatting and streak calculations.
 * All dates are handled as plain YYYY-MM-DD strings to avoid
 * timezone drift that would occur when using Date objects directly.
 */

// ─── Get Today's Date String ──────────────────────────────────────────────────

/**
 * Returns today's date as a YYYY-MM-DD string in local time.
 * Using local time keeps dates consistent with the user's timezone.
 *
 * @returns {string}  e.g. "2024-07-15"
 */
const getTodayString = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// ─── Get Yesterday's Date String ─────────────────────────────────────────────

/**
 * Returns yesterday's date as a YYYY-MM-DD string in local time.
 *
 * @returns {string}  e.g. "2024-07-14"
 */
const getYesterdayString = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// ─── Convert Date → YYYY-MM-DD String ────────────────────────────────────────

/**
 * Normalises any Date object or ISO string into a YYYY-MM-DD string in local time.
 *
 * @param   {Date|string} date
 * @returns {string}
 */
const toDateString = (date) => {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// ─── Calculate New Streak ─────────────────────────────────────────────────────

/**
 * Determines the updated streak count based on the user's last active date.
 *
 * Rules:
 *   - Same day as today    → no change (already counted)
 *   - Yesterday            → continue streak (increment by 1)
 *   - Any other date / null → reset to 1 (streak broken)
 *
 * @param   {Date|string|null} lastActiveDate  — stored on the User document
 * @param   {number}           currentStreak   — current streak value
 * @returns {{ newStreak: number, shouldUpdate: boolean }}
 *            shouldUpdate = false when the user already logged activity today
 */
const calculateStreak = (lastActiveDate, currentStreak) => {
  const today     = getTodayString();
  const yesterday = getYesterdayString();

  // No last active date means this is the user's very first activity
  if (!lastActiveDate) {
    return { newStreak: 1, shouldUpdate: true };
  }

  const lastDate = toDateString(lastActiveDate);

  if (lastDate === today) {
    // Already active today — don't double-count
    return { newStreak: currentStreak, shouldUpdate: false };
  }

  if (lastDate === yesterday) {
    // Consecutive day — extend the streak
    return { newStreak: currentStreak + 1, shouldUpdate: true };
  }

  // Gap of 2+ days — streak is broken, restart at 1
  return { newStreak: 1, shouldUpdate: true };
};

module.exports = { getTodayString, getYesterdayString, toDateString, calculateStreak, getMondayString };

// ─── Get Monday of Current Week ───────────────────────────────────────────────

/**
 * Returns the Monday of the current week as a YYYY-MM-DD string in local time.
 * If today is Monday, returns today. Otherwise walks back to the most recent Monday.
 *
 * @returns {string}  e.g. "2024-07-15"
 */
function getMondayString() {
  const d = new Date();
  const dayOfWeek = d.getDay(); // 0 = Sun, 1 = Mon, ...
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // days since Monday
  d.setDate(d.getDate() - diff);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
