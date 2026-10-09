const { verifyAccessToken } = require("../utils/tokens");
const AppError = require("../utils/AppError");

/**
 * Protect Middleware
 * Verifies the JWT supplied in the Authorization header.
 * On success, attaches the decoded userId to req for downstream use.
 *
 * Accepts both `sub` (new) and `userId` (legacy) claims.
 * Expected header format:
 *   Authorization: Bearer <token>
 */
const protect = (req, res, next) => {
  const authHeader = req.headers.authorization;

  // 1. Check header exists and is in the correct format
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(new AppError("No token provided. Access denied.", 401));
  }

  // 2. Extract the raw token string
  const token = authHeader.split(" ")[1];

  // 3. Verify and decode the token
  try {
    const decoded = verifyAccessToken(token);

    // 4. Attach userId to the request object for use in controllers
    req.userId = decoded.sub || decoded.userId;
    if (!req.userId) return next(new AppError("Invalid token. Access denied.", 401));

    next();
  } catch (err) {
    return next(new AppError("Invalid or expired token. Access denied.", 401));
  }
};

module.exports = { protect };
