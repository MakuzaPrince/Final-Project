# Smart Transportation Booking System - RideRwanda

A full-stack web application connecting Passengers and Drivers with automated tax computation for Rwanda Revenue Authority (RRA) compliance.

## Features

- **User Roles**: Passenger, Driver, Admin (Single).
- **Ride Booking**: Real-time booking with Leaflet Maps.
- **Automated Taxation**: 
  - First 1 km = 1500 RWF
  - 2–30 km = 600 RWF/km
  - >30 km = 500 RWF/km
  - Auto-calculates tax per ride.
- **Real-time Updates**: Socket.io for driver tracking and ride status.
- **Admin Dashboard**: Tax reports, User management, Ride monitoring.
- **Authentication**: JWT & Firebase Google Sign-In support.

## Prerequisites

- Node.js (v18+)
- MongoDB (Running locally or Cloud URI)

## Installation

### 1. Setup Backend

```bash
cd backend
npm install
```

Create a `.env` file in `backend/`:
```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/rwanda-ride-system
JWT_SECRET=your_super_secret_key
# FIREBASE_CREDENTIALS_PATH=./config/firebase-service-account.json (Optional for dev)
```

Start the Server:
```bash
npm run dev
```

### 2. Setup Frontend

```bash
cd frontend
npm install
```

Start the Client:
```bash
npm run dev
```

## Usage

1. **Register**: Create a passenger account. 
2. **Driver**: Create a separate account and select "Driver" role.
3. **Login**: Log in to both accounts in separate windows (Incognito for one).
4. **Driver Dashboard**: Toggle "Online".
5. **Passenger**: Go to "Book Ride", select points on map, and "Request Ride".
6. **Driver**: Accept the ride request.

## Tech Stack

- **Backend**: Node.js, Express, MongoDB, Socket.io
- **Frontend**: React, Vite, Tailwind CSS, Leaflet, Firebase
