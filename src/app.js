require('dotenv').config();
const express = require('express');
const authRouter = require('./api/auth');
const aiRouter = require('./api/ai');
const googleAuthRouter = require('./api/google-auth');
const paymentsRouter = require('./api/payments');
const establishmentsRouter = require('./api/establishments');
const { runMigrations } = require('./utils/migrations');
const { initCron } = require('./services/cron');
const cronRouter = require('./api/cron');
const reportsRouter = require('./api/reports');

const app = express();

// Body brut requis par Stripe pour la vérification de signature — AVANT express.json()
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use(express.static('frontend'));

app.use('/api/auth', authRouter);
app.use('/api/ai', aiRouter);
app.use('/api/google', googleAuthRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/establishments', establishmentsRouter);
app.use('/api/cron', cronRouter);
app.use('/api/reports', reportsRouter);

// Error handler middleware
app.use((err, req, res, next) => {
  const isDev = process.env.NODE_ENV === 'development';
  
  // Log for developer
  console.error('[ERROR]', {
    message: err.message,
    path: req.path,
    method: req.method,
    stack: isDev ? err.stack : undefined,
  });

  // Response to client (no sensitive info)
  res.status(err.status || 500).json({
    error: isDev ? err.message : 'Internal server error',
  });
});

// Start server
const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // Exécuter les migrations avant de démarrer
    await runMigrations();

    app.listen(PORT, () => {
      console.log(`✓ LocalRank server running on port ${PORT}`);
      console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
      initCron();
    });
  } catch (error) {
    console.error('✗ Failed to start server:', error.message);
    process.exit(1);
  }
}

startServer();

module.exports = app;
