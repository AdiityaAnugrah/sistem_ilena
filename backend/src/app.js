require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { sequelize } = require('./models');
const logger = require('./config/logger');

const app = express();

// Trust proxy (OpenLiteSpeed / Nginx reverse proxy)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());

const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  message: { message: 'Terlalu banyak request, coba lagi nanti.' },
});
app.use('/api/', limiter);

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/barang', require('./routes/barang'));
app.use('/api/alamat', require('./routes/alamat'));
app.use('/api/penjualan', require('./routes/penjualan'));
app.use('/api/users', require('./routes/users'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/penjualan-offline', require('./routes/penjualanOffline'));
app.use('/api/penjualan-interior', require('./routes/penjualanInterior'));
app.use('/api/dokumen', require('./routes/dokumen'));
app.use('/api/log-activity', require('./routes/logActivity'));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'OK', timestamp: new Date() }));

// 404 handler
app.use((req, res) => res.status(404).json({ message: 'Endpoint tidak ditemukan' }));

// Error handler
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(500).json({ message: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;

sequelize.authenticate()
  .then(() => {
    logger.info('Database connection established');
    return sequelize.sync({ alter: true });
  })
  .then(() => {
    logger.info('Database synced');
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });
  })
  .catch(err => {
    logger.error('Unable to connect to database:', err);
    process.exit(1);
  });

module.exports = app;
