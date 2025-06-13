import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import connectDB from './config/mongodb.js';
import userRouter from './routes/userRoutes.js';
import imageRouter from './routes/imageRoutes.js';

const app = express();

// CORS configuration for your frontend
app.use(cors({
  origin: [
    'https://genpix-frontend.vercel.app',
    'http://localhost:3000',
    'http://localhost:5173'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Connect to MongoDB
await connectDB();

// Routes
app.use('/api/user', userRouter);
app.use('/api/user', imageRouter);
app.get('/', (req, res) => res.send("API Working fine"));

// Export for Vercel serverless
export default app;

// Only listen when running locally
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}