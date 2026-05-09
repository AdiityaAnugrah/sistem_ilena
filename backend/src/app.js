require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { sequelize } = require('./models');
const logger = require('./config/logger');
const socketModule = require('./socket');

// CI/CD Test - 2026-05-09

const app = express();
const server = http.createServer(app);

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

// Rate limiting — umum
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { message: 'Terlalu banyak request, coba lagi nanti.' },
});
app.use('/api/', limiter);

// Rate limiting — login lebih ketat (10x per 15 menit per IP)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'Terlalu banyak percobaan login. Coba lagi dalam 15 menit.' },
  skipSuccessfulRequests: true,
});
app.use('/api/auth/login', loginLimiter);

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
app.use('/api/public/surat', require('./routes/publicSurat'));
app.use('/api/tutorial-video', require('./routes/tutorialVideo'));
app.use('/api/log-activity', require('./routes/logActivity'));
app.use('/api/keuangan', require('./routes/keuangan'));
app.use('/api/search', require('./routes/search'));
app.use('/api/dev', require('./routes/dev'));

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

// Hapus index duplikat yang ditimbulkan oleh sync({alter:true}) berulang kali
async function cleanupDuplicateIndexes() {
  const tables = [
    'surat_jalan', 'surat_jalan_interior', 'invoice', 'invoice_interior',
    'surat_pengantar', 'surat_pengantar_sub', 'proforma_invoice',
  ];
  for (const table of tables) {
    try {
      const [rows] = await sequelize.query(
        `SELECT INDEX_NAME, COLUMN_NAME, NON_UNIQUE
         FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table
         ORDER BY INDEX_NAME`,
        { replacements: { table } }
      );
      // Group indexes by column, keep only one UNIQUE per column
      const seenUnique = {};
      for (const row of rows) {
        if (row.NON_UNIQUE === 0 && row.INDEX_NAME !== 'PRIMARY') {
          const key = row.COLUMN_NAME;
          if (!seenUnique[key]) {
            seenUnique[key] = row.INDEX_NAME; // keep first
          } else {
            // Drop duplicate
            await sequelize.query(
              `ALTER TABLE \`${table}\` DROP INDEX \`${row.INDEX_NAME}\``
            ).catch(() => {}); // ignore if already gone
          }
        }
      }
    } catch { /* table mungkin belum ada, skip */ }
  }
}

sequelize.authenticate()
  .then(() => {
    logger.info('Database connection established');
    return cleanupDuplicateIndexes();
  })
  .then(() => sequelize.sync({ alter: true }))
  .then(() => {
    logger.info('Database synced');
    socketModule.init(server, allowedOrigins);
    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });
  })
  .catch(err => {
    logger.error('Unable to connect to database:', err);
    process.exit(1);
  });

module.exports = { app, server };
