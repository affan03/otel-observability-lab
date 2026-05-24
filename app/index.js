const express = require('express');
const logger = require('./logger');
const app = express();

app.use(express.json());

// Request logging middleware — logs every incoming request
app.use((req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('HTTP request', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: duration,
    });
  });

  next();
});

// Simulated in-memory "database"
const items = ['apple', 'banana', 'cherry'];

// GET /items
app.get('/items', (req, res) => {
  logger.info('Fetching all items', { count: items.length });
  res.json({ items });
});

// GET /items/:id
app.get('/items/:id', (req, res) => {
  const id = parseInt(req.params.id);

  if (isNaN(id) || id < 0 || id >= items.length) {
    logger.warn('Item not found', { requestedId: id });
    return res.status(404).json({ error: 'Item not found' });
  }

  logger.info('Item fetched', { id, item: items[id] });
  res.json({ item: items[id] });
});

// POST /items
app.post('/items', (req, res) => {
  const { name } = req.body;

  if (!name) {
    logger.warn('POST /items called without name field');
    return res.status(400).json({ error: 'Name is required' });
  }

  items.push(name);
  logger.info('Item added', { name, totalItems: items.length });
  res.status(201).json({ message: 'Item added', items });
});

// GET /slow
app.get('/slow', async (req, res) => {
  const delay = Math.floor(Math.random() * 2000) + 500;
  logger.info('Slow endpoint hit', { expectedDelayMs: delay });

  await new Promise(resolve => setTimeout(resolve, delay));

  logger.info('Slow endpoint responded', { actualDelayMs: delay });
  res.json({ message: `Responded after ${delay}ms` });
});

// GET /error
app.get('/error', (req, res) => {
  if (Math.random() > 0.5) {
    logger.error('Simulated internal error triggered', {
      endpoint: '/error',
      reason: 'random failure',
    });
    return res.status(500).json({ error: 'Random internal error' });
  }

  logger.info('Error endpoint hit but no error this time');
  res.json({ message: 'No error this time' });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = 3001;
app.listen(PORT, () => {
  logger.info(`App started`, { port: PORT });
});
