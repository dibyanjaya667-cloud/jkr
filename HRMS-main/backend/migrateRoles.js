const mongoose = require('mongoose')
const User = require('./models/User')

// MongoDB Connection - use your connection string
const MONGO_URI = process.env.MONGODB_URI || 'mongodb+srv://dibyanjayapanda25_db_user:9bmOyqUKeHnjsYM2@cluster0.flfpwgp.mongodb.net/?appName=Cluster0'

async function migrateRoles() {
  try {
    await mongoose.connect(MONGO_URI)
    console.log('Connected to MongoDB')

    // Count users with old 'user' role
    const oldRoleCount = await User.countDocuments({ role: 'user' })
    console.log(`Found ${oldRoleCount} users with old 'user' role`)

    if (oldRoleCount > 0) {
      // Update all 'user' roles to 'employee'
      const result = await User.updateMany(
        { role: 'user' },
        { $set: { role: 'employee' } }
      )
      console.log(`✅ Updated ${result.modifiedCount} users from 'user' to 'employee' role`)
    } else {
      console.log('No users need migration')
    }

    // Show role distribution
    const roleCounts = await User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ])
    
    console.log('\n📊 Current Role Distribution:')
    roleCounts.forEach(r => {
      console.log(`   ${r._id}: ${r.count}`)
    })

    await mongoose.connection.close()
    console.log('\nDatabase connection closed')
  } catch (error) {
    console.error('Error migrating roles:', error)
    process.exit(1)
  }
}

migrateRoles()
