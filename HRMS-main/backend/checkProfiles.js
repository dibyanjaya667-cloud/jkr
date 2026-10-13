const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/hrms').then(async () => {
  const User = require('./models/User');
  
  const counts = await User.aggregate([
    { $group: { _id: '$profileStatus', count: { $sum: 1 } } }
  ]);
  console.log('Profile Status Counts:', counts);
  
  const pending = await User.find({ profileStatus: 'pending' })
    .select('name email profileStatus profileSubmittedAt')
    .limit(5);
  console.log('Pending profiles:', pending);
  
  const draft = await User.find({ profileStatus: 'draft' })
    .select('name email profileStatus')
    .limit(5);
  console.log('Draft profiles:', draft);
  
  mongoose.disconnect();
});
