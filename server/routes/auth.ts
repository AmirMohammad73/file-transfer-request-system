import express, { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../index';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Register new user
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { name, username, password, role, department } = req.body;

    console.log('Registration request received:', { name, username, role, department });

    if (!name || !username || !password || !role || !department) {
      return res.status(400).json({ error: 'تمام فیلدها الزامی هستند' });
    }

    // Validate role enum
    const validRoles = ['REQUESTER', 'GROUP_LEAD', 'DEPUTY', 'NETWORK_HEAD', 'NETWORK_ADMIN'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ 
        error: `نقش نامعتبر است. نقش‌های معتبر: ${validRoles.join(', ')}` 
      });
    }

    // Check if username already exists
    const existingUser = await pool.query(
      'SELECT id FROM req_users WHERE username = $1',
      [username]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'این نام کاربری قبلا ثبت شده است' });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Insert new user
    const result = await pool.query(
      `INSERT INTO req_users (name, username, password, role, department) 
       VALUES ($1, $2, $3, $4::user_role, $5) 
       RETURNING id, name, username, role, department, group_ids, created_at`,
      [name, username, hashedPassword, role, department]
    );

    const user = result.rows[0];

    // Set session cookie with 8 hours expiration
    res.cookie('userId', user.id.toString(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 8 * 60 * 60 * 1000, // 8 hours
    });
    
    // Also set session timestamp in cookie
    res.cookie('sessionTime', Date.now().toString(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 8 * 60 * 60 * 1000, // 8 hours
    });

    res.status(201).json({
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
      department: user.department,
      groupIds: user.group_ids || [],
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
    });

    // Handle specific PostgreSQL errors
    if (error.code === '23505') {
      return res.status(400).json({ error: 'این نام کاربری قبلا ثبت شده است' });
    }
    
    if (error.code === '23502') {
      return res.status(400).json({ error: 'یکی از فیلدهای الزامی خالی است' });
    }

    if (error.code === '22P02') {
      return res.status(400).json({ error: 'نقش وارد شده نامعتبر است' });
    }

    res.status(500).json({ 
      error: 'خطا در ثبت نام',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'نام کاربری و رمز عبور الزامی هستند' });
    }

    // Find user by username
    const result = await pool.query(
      'SELECT id, name, username, password, role, department, group_ids FROM req_users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'نام کاربری یا رمز عبور نامعتبر است' });
    }

    const user = result.rows[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'نام کاربری یا رمز عبور نامعتبر است' });
    }

    // Set session cookie with 15 hours expiration
    res.cookie('userId', user.id.toString(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 60 * 1000, // 15 hours
    });
    
    // Also set session timestamp in cookie
    res.cookie('sessionTime', Date.now().toString(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 60 * 1000, // 15 hours
    });

    res.json({
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
      department: user.department,
      groupIds: user.group_ids || [],
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'خطا در ورود به سیستم' });
  }
});

// Get current user
router.get('/me', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    const result = await pool.query(
      'SELECT id, name, username, role, department, group_ids, created_at FROM req_users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'کاربر یافت نشد' });
    }

    const user = result.rows[0];
    res.json({
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
      department: user.department,
      groupIds: user.group_ids || [],
    });
  } catch (error: any) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'خطا در دریافت اطلاعات کاربر' });
  }
});

// Change password
router.post('/change-password', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'رمز عبور فعلی و جدید الزامی هستند' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'رمز عبور جدید باید حداقل 6 کاراکتر باشد' });
    }

    // Get current user with password
    const userResult = await pool.query(
      'SELECT password FROM req_users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'کاربر یافت نشد' });
    }

    const user = userResult.rows[0];

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'رمز عبور فعلی نادرست است' });
    }

    // Hash new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await pool.query(
      'UPDATE req_users SET password = $1 WHERE id = $2',
      [hashedPassword, userId]
    );

    res.json({ message: 'رمز عبور با موفقیت تغییر یافت' });
  } catch (error: any) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'خطا در تغییر رمز عبور' });
  }
});

// Logout
router.post('/logout', (req: Request, res: Response) => {
  res.clearCookie('userId');
  res.clearCookie('sessionTime');
  res.json({ message: 'خروج موفقیت‌آمیز بود' });
});

export default router;

