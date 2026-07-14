const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');

dotenv.config();

const seedAdmin = async () => {
    try {
        if (!mongoose.connection.readyState) {
            await mongoose.connect(process.env.MONGO_URI);
        }

        const adminExists = await User.findOne({ email: 'admin@gmail.com' });

        if (adminExists) {
            console.log('Admin user already exists');
            return adminExists;
        }

        const adminUser = new User({
            fullName: process.env.ADMIN_NAME || 'System Admin',
            email: process.env.ADMIN_EMAIL || 'admin@gmail.com',
            password: process.env.ADMIN_PASSWORD || 'admin@123', // Will be hashed by pre-save hook
            role: 'admin',
            phone: process.env.ADMIN_PHONE || '0000000000'
        });

        await adminUser.save();
        console.log('Admin user seeded successfully');
        return adminUser;
    } catch (error) {
        console.error('Error seeding admin:', error);
        throw error;
    }
};

module.exports = { seedAdmin };
