const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');

dotenv.config();

async function listUsers() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB");

        const users = await User.find({}, 'fullName email role');
        console.log("USERS IN DB:");
        console.log(JSON.stringify(users, null, 2));

        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

listUsers();
