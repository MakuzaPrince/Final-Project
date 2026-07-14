const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const rideRoutes = require('./routes/rideRoutes');
const adminRoutes = require('./routes/adminRoutes');
const userRoutes = require('./routes/userRoutes');
const socketHandler = require('./sockets/socketHandler');
const { seedAdmin } = require('./seedAdmin');

dotenv.config();

connectDB().then(() => {
    seedAdmin().catch((err) => {
        console.error('Admin seeding failed:', err);
    });
}).catch(() => {
    console.error('Database connection failed; admin seed skipped.');
});

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/rides', rideRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/users', userRoutes);
app.use('/api/wallet', require('./routes/walletRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/messages', require('./routes/messageRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.set('socketio', io);

// Initialize Socket Handler
socketHandler(io);

// Basic Route
app.get('/', (req, res) => {
    res.send('Smart Transportation API is running...');
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
