const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET;

function generateToken(user_id) {
  return jwt.sign({ user_id }, SECRET, { expiresIn: '7d' });
}

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).send({ message: 'Missing or invalid Authorization header' });
  }
  const token = authHeader.slice('Bearer '.length);
  try {
    const decoded = jwt.verify(token, SECRET);
    req.user_id = decoded.user_id;
    next();
  } catch (err) {
    return res.status(401).send({ message: 'Invalid or expired token' });
  }
}

module.exports = { generateToken, authenticate };
