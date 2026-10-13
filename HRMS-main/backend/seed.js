const mongoose = require('mongoose');
const Manager = require('./models/Manager');
require('dotenv').config();

const managers = [
  {
    managerId: 'MGR001',
    name: 'Ram Sharma',
    email: 'ram@company.com',
    department: 'Engineering',
  },
  {
    managerId: 'MGR002',
    name: 'Shyam Verma',
    email: 'shyam@company.com',
    department: 'HR',
  },
  {
    managerId: 'MGR003',
    name: 'Mohan Patel',
    email: 'mohan@company.com',
    department: 'Finance',
  },
];

async function seedManagers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected');

    // Clear existing managers
    await Manager.deleteMany({});
    console.log('Cleared existing managers');

    // Insert new managers
    await Manager.insertMany(managers);
    console.log('Managers seeded successfully!');
    console.log('Added:', managers.map(m => m.name).join(', '));

    mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error seeding managers:', error);
    process.exit(1);
  }
}

seedManagers();
