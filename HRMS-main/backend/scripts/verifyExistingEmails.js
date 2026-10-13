require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const run = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is not set');
    }

    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    const result = await User.updateMany(
      { emailVerified: { $ne: true } },
      { $set: { emailVerified: true, emailOtpHash: '', emailOtpExpiresAt: null } }
    );

    console.log(`Updated ${result.modifiedCount || result.nModified || 0} users to emailVerified=true`);
  } catch (err) {
    console.error('Error verifying existing users:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

run();
