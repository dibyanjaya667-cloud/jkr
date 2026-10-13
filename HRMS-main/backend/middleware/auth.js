const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  try {
    const headerToken = req.headers.authorization?.split(' ')[1];
    const queryToken = typeof req.query?.token === 'string' ? req.query.token : undefined;
    const token = headerToken || queryToken;

    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    // Normalize common user id access patterns across routes
    req.userId = decoded.userId;
    if (req.user && req.user.userId && !req.user.id) {
      req.user.id = req.user.userId;
    }
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

module.exports = authMiddleware;
