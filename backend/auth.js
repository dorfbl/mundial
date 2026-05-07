const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'mundial2026-secret-change-in-production';

function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, is_admin: user.is_admin },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'נדרשת התחברות' });
  
  const token = header.replace('Bearer ', '');
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'טוקן לא תקין' });
  }
}

function adminMiddleware(req, res, next) {
  if (!req.user?.is_admin) return res.status(403).json({ error: 'אין הרשאת מנהל' });
  next();
}

module.exports = { generateToken, authMiddleware, adminMiddleware };
