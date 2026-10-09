const { refreshMaxAgeSec } = require("./tokens");

const REFRESH_COOKIE = "learnr_rt";
const COOKIE_PATH = "/api/auth";

const isProd = () => process.env.NODE_ENV === "production";

const cookieBase = () => ({
  httpOnly: true,
  secure: isProd(),
  sameSite: process.env.COOKIE_SAMESITE || "lax",
  path: COOKIE_PATH,
});

/** Set the refresh-token cookie. Never expose the token in response bodies. */
const setRefreshCookie = (res, token) => {
  res.cookie(REFRESH_COOKIE, token, {
    ...cookieBase(),
    maxAge: refreshMaxAgeSec() * 1000,
  });
};

/** Clear the refresh cookie with matching path/attributes. */
const clearRefreshCookie = (res) => {
  res.clearCookie(REFRESH_COOKIE, { ...cookieBase() });
};

const setShortCookie = (res, name, value, maxAgeMs) => {
  res.cookie(name, value, { ...cookieBase(), maxAge: maxAgeMs });
};

const clearShortCookie = (res, name) => {
  res.clearCookie(name, { ...cookieBase() });
};

module.exports = {
  REFRESH_COOKIE,
  COOKIE_PATH,
  setRefreshCookie,
  clearRefreshCookie,
  setShortCookie,
  clearShortCookie,
};
