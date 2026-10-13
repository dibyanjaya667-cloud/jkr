const mongoose = require('mongoose')
const User = require('./models/User')

// MongoDB Connection
const MONGO_URI = 'mongodb+srv://dibyanjayapanda25_db_user:9bmOyqUKeHnjsYM2@cluster0.flfpwgp.mongodb.net/?appName=Cluster0'

async function seedAdmin() {
  try {
    await mongoose.connect(MONGO_URI)
    console.log('Connected to MongoDB')

    const ADMIN_EMAIL = 'admin@hrms.com'
    const ADMIN_PASSWORD = 'admin123'

    // If admin already exists, reset credentials
    const existingAdmin = await User.findOne({ email: ADMIN_EMAIL })
    if (existingAdmin) {
      existingAdmin.role = 'admin'
      existingAdmin.employeeId = existingAdmin.employeeId || 'ADMIN001'
      // Set plain password; model pre-save hook will hash it
      existingAdmin.password = ADMIN_PASSWORD
      await existingAdmin.save()

      console.log('✅ Admin user updated successfully!')
      console.log(`📧 Email: ${ADMIN_EMAIL}`)
      console.log(`🔑 Password: ${ADMIN_PASSWORD}`)
      console.log('👤 Role: admin')

      await mongoose.connection.close()
      console.log('Database connection closed')
      return
    }

    // Create admin user (use plain password; model will hash it)
    const admin = new User({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      employeeId: 'ADMIN001',
      role: 'admin',
      isOnline: false,
    })

    await admin.save()
    console.log('✅ Admin user created successfully!')
    console.log(`📧 Email: ${ADMIN_EMAIL}`)
    console.log(`🔑 Password: ${ADMIN_PASSWORD}`)
    console.log('👤 Role: admin')

    await mongoose.connection.close()
    console.log('Database connection closed')
  } catch (error) {
    console.error('Error seeding admin:', error)
    process.exit(1)
  }
}

seedAdmin()
