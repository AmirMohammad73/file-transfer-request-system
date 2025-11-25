import { Request, Response, NextFunction } from 'express';
import { pool } from '../index';

export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.cookies?.userId;
    const sessionTime = req.cookies?.sessionTime;

    if (!userId) {
      return res.status(401).json({ error: 'لطفا ابتدا وارد شوید' });
    }

    // Check if session has expired (8 hours)
    if (sessionTime) {
      const sessionStartTime = parseInt(sessionTime);
      const currentTime = Date.now();
      const sessionDuration = 8 * 60 * 60 * 1000; // 8 hours in milliseconds

      if (currentTime - sessionStartTime > sessionDuration) {
        res.clearCookie('userId');
        res.clearCookie('sessionTime');
        return res.status(401).json({ error: 'جلسه شما منقضی شده است. لطفاً دوباره وارد شوید' });
      }
    }

    // Verify user exists
    const result = await pool.query('SELECT id FROM req_users WHERE id = $1', [userId]);

    if (result.rows.length === 0) {
      res.clearCookie('userId');
      res.clearCookie('sessionTime');
      return res.status(401).json({ error: 'کاربر معتبر نیست' });
    }

    (req as any).userId = parseInt(userId);
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ error: 'خطا در احراز هویت' });
  }
};

