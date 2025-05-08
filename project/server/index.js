// server/index.js
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import employeeRoutes from './routes/employee.js';
import generalRoutes from './routes/general.js';
import { verifyToken } from './middleware/auth.js'; // verifyToken is used by admin/employee routes here

const app = express();

// Initial logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] Incoming Request (Logger 1): ${req.method} ${req.originalUrl}, Path: ${req.path}`);
  next();
});

const PORT = process.env.PORT || 5000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Standard Middleware
app.use(express.json());
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', verifyToken(['admin']), adminRoutes); // verifyToken used here
app.use('/api/employee', verifyToken(['employee']), employeeRoutes); // and here
app.use('/api', generalRoutes); // This will handle /api/locations/*

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../dist', 'index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;