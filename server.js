require('dotenv').config();
require('./db/init'); // creates tables + seeds super-admin if needed

const path = require('path');
const express = require('express');
const cors = require('cors');

const { scheduleReminders } = require('./utils/reminders');

const authRoutes = require('./routes/auth');
const customerRoutes = require('./routes/customers');
const vehicleRoutes = require('./routes/vehicles');
const tripRoutes = require('./routes/trips');
const configRoutes = require('./routes/config');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Uploaded photos (diesel/RTO/expense) served statically.
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/config', configRoutes);

// Frontend static files (login page, dashboards, etc.)
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`KPS Technology server running on port ${PORT}`);
  scheduleReminders();
});
