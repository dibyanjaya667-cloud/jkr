require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const https = require('https');
const http = require('http');
const authRoutes = require('./routes/auth');
const managerRoutes = require('./routes/manager');
const attendanceRoutes = require('./routes/attendance');
const adminRoutes = require('./routes/admin');
const leaveRoutes = require('./routes/leave');
const wfhRoutes = require('./routes/wfh');
const publicRoutes = require('./routes/public');
const teamRoutes = require('./routes/team');
const socialRoutes = require('./routes/social');
const wallRoutes = require('./routes/wall');
const notificationRoutes = require('./routes/notifications');
const storageRoutes = require('./routes/storage');
const User = require('./models/User');
const Notification = require('./models/Notification');
const { sendEmail } = require('./services/email');
const { missedPunchOutEmail } = require('./services/emailTemplates');
const { validateEnv } = require('./config/env');

const app = express();
validateEnv();

mongoose.set('bufferCommands', false);

// Keep-Alive: Self-ping every 10 minutes to prevent server from sleeping
const PING_INTERVAL = 10 * 60 * 1000; // 10 minutes in milliseconds

function keepAlive() {
  const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
  
  setInterval(() => {
    const url = `${backendUrl}/api/health`;
    const protocol = url.startsWith('https') ? https : http;
    
    protocol.get(url, (res) => {
      console.log(`[Keep-Alive] Pinged at ${new Date().toLocaleString()} - Status: ${res.statusCode}`);
    }).on('error', (err) => {
      console.log(`[Keep-Alive] Ping failed: ${err.message}`);
    });
  }, PING_INTERVAL);
  
  console.log(`[Keep-Alive] Started - Will ping every 10 minutes`);
}

let lastAutoPunchOutKey = null;
const AUTO_PUNCH_OUT_MINUTE = 59;
const AUTO_PUNCH_OUT_HOUR = 23;

const autoCloseMissingPunchOuts = async () => {
  const now = new Date();
  if (now.getHours() !== AUTO_PUNCH_OUT_HOUR || now.getMinutes() < AUTO_PUNCH_OUT_MINUTE) return;

  const dayKey = now.toDateString();
  if (lastAutoPunchOutKey === dayKey) return;
  lastAutoPunchOutKey = dayKey;

  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(now);
  dayEnd.setHours(23, 59, 59, 999);
  const cutoff = new Date(now);
  cutoff.setHours(23, 59, 0, 0);

  try {
    const users = await User.find({
      attendance: {
        $elemMatch: {
          date: { $gte: dayStart, $lte: dayEnd },
          'punchIn.time': { $exists: true },
          $or: [
            { 'punchOut.time': { $exists: false } },
            { 'punchOut.time': null },
          ],
        },
      },
    });

    for (const user of users) {
      const record = user.attendance.find((a) => {
        const d = new Date(a.date);
        return d >= dayStart && d <= dayEnd && a?.punchIn?.time && !a?.punchOut?.time;
      });

      if (!record) continue;

      record.punchOut = {
        time: cutoff,
        isSuspect: true,
        suspectReason: 'MISSING_PUNCH_OUT',
        overtimeStatus: 'none',
        overtimeMinutes: 0,
        distanceFromPunchInM: null,
        radiusM: 500,
        withinRadius: null,
        location: null,
      };

      user.isOnline = false;
      await user.save();

      await Notification.create({
        recipient: user._id,
        type: 'missed_punch',
        title: 'Punch-out Missing',
        message: 'Your punch-out was auto-closed at 11:59 PM due to missing punch-out.',
        category: 'attendance',
        data: { date: record.date },
      });

      try {
        if (user.email) {
          const { subject, html, text } = missedPunchOutEmail({
            userName: user.name || user.email?.split('@')[0],
            date: record.date,
            autoTime: cutoff,
          });
          await sendEmail({ to: user.email, subject, html, text });
        }
      } catch (mailError) {
        console.log('[Auto Punch-Out] Email failed:', mailError.message);
      }
    }
  } catch (err) {
    console.log('[Auto Punch-Out] Error:', err.message);
  }
};

// Middleware
const allowedOrigins = (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true)
    if (allowedOrigins.length === 0) return callback(null, true)
    if (allowedOrigins.includes(origin)) return callback(null, true)
    return callback(null, false)
  },
  credentials: true,
  exposedHeaders: ['Content-Disposition', 'Content-Type', 'X-Payslip-Format'],
}));
app.use(express.json({ limit: '2mb' }));
app.use(compression());

// Static assets (profile pics)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error:', err));

mongoose.connection.on('disconnected', () => {
  console.error('MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
  console.log('MongoDB reconnected');
});

// Health check must remain available when MongoDB is down for deployment monitoring.
app.get('/api/health', (req, res) => {
  const databaseConnected = mongoose.connection.readyState === mongoose.ConnectionStates.connected;
  res.status(databaseConnected ? 200 : 503).json({
    status: databaseConnected ? 'OK' : 'DEGRADED',
    database: databaseConnected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.use('/api', (req, res, next) => {
  if (mongoose.connection.readyState !== mongoose.ConnectionStates.connected) {
    return res.status(503).json({ message: 'Database is temporarily unavailable. Please try again shortly.' });
  }
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/managers', managerRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/leave', leaveRoutes);
app.use('/api/wfh', wfhRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/wall', wallRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/storage', storageRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  // Start keep-alive after server starts
  keepAlive();
  // Auto punch-out missing records at 11:59 PM
  setInterval(autoCloseMissingPunchOuts, 60 * 1000);
});
