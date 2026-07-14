const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');

dotenv.config();

async function resetPassword() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB");

        const user = await User.findOne({ email: 'kevine@gmail.com' });
        if (!user) {
            console.error("User not found");
        } else {
            user.password = 'password123';
            await user.save();
            console.log("Password reset for kevine@gmail.com to 'password123'");
        }

        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

resetPassword();
