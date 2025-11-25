import express, { Request, Response } from 'express';
import { pool } from '../index';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Get all requests (filtered based on user role)
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    // Get current user with group_ids
    const userResult = await pool.query(
      'SELECT role, name, group_ids FROM req_users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'کاربر یافت نشد' });
    }

    const user = userResult.rows[0];
    const userGroupIds = user.group_ids || [];

    let query = `
      SELECT 
        r.id,
        r.requester_id,
        r.requester_name,
        r.department,
        r.files,
        r.status,
        r.current_approver,
        r.approval_history,
        r.created_at,
        u.group_ids as requester_group_ids
      FROM requests r
      LEFT JOIN req_users u ON r.requester_id = u.id
    `;

    const params: any[] = [];
    let paramCount = 0;

    // Filter based on user role
    if (user.role === 'REQUESTER') {
      // Requesters see only their own requests
      query += ` WHERE r.requester_id = $${++paramCount}`;
      params.push(userId);
    } else {
      // Approvers see requests pending for their role
      query += ` WHERE r.status = 'PENDING' AND r.current_approver = $${++paramCount}`;
      params.push(user.role);
      
      // Filter by group_ids
      // If user has group 0, they can see all requests
      if (!userGroupIds.includes(0)) {
        if (userGroupIds.length > 0) {
          // Check if requester's group_ids overlap with approver's group_ids
          query += ` AND (
            u.group_ids && $${++paramCount}::integer[] OR 
            u.group_ids IS NULL OR 
            array_length(u.group_ids, 1) IS NULL
          )`;
          params.push(userGroupIds);
        } else {
          // User has no groups, can't see any requests
          query += ` AND 1=0`;
        }
      }
    }

    query += ` ORDER BY r.created_at DESC`;

    const result = await pool.query(query, params);

    const requests = result.rows.map((row) => {
      // Parse JSONB fields if they are strings
      const filesData = typeof row.files === 'string' 
        ? JSON.parse(row.files) 
        : (Array.isArray(row.files) ? row.files : []);
      
      const approvalHistoryData = typeof row.approval_history === 'string'
        ? JSON.parse(row.approval_history)
        : (Array.isArray(row.approval_history) ? row.approval_history : []);

      return {
        id: row.id,
        requesterName: row.requester_name,
        department: row.department,
        files: filesData,
        status: row.status,
        currentApprover: row.current_approver,
        approvalHistory: approvalHistoryData,
        createdAt: row.created_at,
        requesterGroupId: row.requester_group_ids && row.requester_group_ids.length > 0 ? row.requester_group_ids[0] : null,
      };
    });

    res.json(requests);
  } catch (error: any) {
    console.error('Get requests error:', error);
    console.error('Error details:', error);
    res.status(500).json({ error: 'خطا در دریافت درخواست‌ها' });
  }
});

// Get request history (all requests user is involved in)
router.get('/history', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    // Get current user
    const userResult = await pool.query(
      'SELECT role, name FROM req_users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'کاربر یافت نشد' });
    }

    const user = userResult.rows[0];

    // Get requests where user is requester or in approval history
    const result = await pool.query(
      `SELECT 
        r.id,
        r.requester_id,
        r.requester_name,
        r.department,
        r.files,
        r.status,
        r.current_approver,
        r.approval_history,
        r.created_at,
        u.group_ids as requester_group_ids
      FROM requests r
      LEFT JOIN req_users u ON r.requester_id = u.id
      WHERE r.requester_id = $1 
         OR EXISTS (
           SELECT 1 FROM jsonb_array_elements(r.approval_history) AS elem
           WHERE elem->>'approverName' = $2
         )
      ORDER BY r.created_at DESC`,
      [userId, user.name]
    );

    const requests = result.rows.map((row) => {
      // Parse JSONB fields if they are strings
      const filesData = typeof row.files === 'string' 
        ? JSON.parse(row.files) 
        : (Array.isArray(row.files) ? row.files : []);
      
      const approvalHistoryData = typeof row.approval_history === 'string'
        ? JSON.parse(row.approval_history)
        : (Array.isArray(row.approval_history) ? row.approval_history : []);

      return {
        id: row.id,
        requesterName: row.requester_name,
        department: row.department,
        files: filesData,
        status: row.status,
        currentApprover: row.current_approver,
        approvalHistory: approvalHistoryData,
        createdAt: row.created_at,
        requesterGroupId: row.requester_group_ids && row.requester_group_ids.length > 0 ? row.requester_group_ids[0] : null,
      };
    });

    res.json(requests);
  } catch (error: any) {
    console.error('Get history error:', error);
    console.error('Error details:', error);
    res.status(500).json({ error: 'خطا در دریافت تاریخچه' });
  }
});

// Create new request
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { files } = req.body;

    console.log('Received request to create:', { userId, filesCount: files?.length });

    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'حداقل یک فایل الزامی است' });
    }

    // Get current user with group_id
    const userResult = await pool.query(
      'SELECT name, department, group_ids FROM req_users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'کاربر یافت نشد' });
    }

    const user = userResult.rows[0];

    // Generate request ID
    const countResult = await pool.query('SELECT COUNT(*) as count FROM requests');
    const count = parseInt(countResult.rows[0].count) + 1;
    const requestId = `req-${String(count).padStart(3, '0')}`;

    // Insert new request - pg automatically converts objects to JSONB
    // Note: requester_group_id is not stored, we'll get it from JOIN when needed
    const insertResult = await pool.query(
      `INSERT INTO requests (
        id, requester_id, requester_name, department, files, 
        status, current_approver, approval_history
      ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8::jsonb)
      RETURNING *`,
      [
        requestId,
        userId,
        user.name,
        user.department,
        JSON.stringify(files), // Convert to JSON string for JSONB
        'PENDING',
        'GROUP_LEAD', // First approver in hierarchy
        '[]', // Empty JSON array as string
      ]
    );

    const row = insertResult.rows[0];
    
    // Parse JSONB fields if they are strings
    const filesData = typeof row.files === 'string' 
      ? JSON.parse(row.files) 
      : (Array.isArray(row.files) ? row.files : []);
    
    const approvalHistoryData = typeof row.approval_history === 'string'
      ? JSON.parse(row.approval_history)
      : (Array.isArray(row.approval_history) ? row.approval_history : []);

    // Get requester's group_ids from user table
    const requesterUserResult = await pool.query(
      'SELECT group_ids FROM req_users WHERE id = $1',
      [row.requester_id]
    );
    const requesterGroupIds = requesterUserResult.rows[0]?.group_ids || [];
    const requesterGroupId = requesterGroupIds.length > 0 ? requesterGroupIds[0] : null;

    const request = {
      id: row.id,
      requesterName: row.requester_name,
      department: row.department,
      files: filesData,
      status: row.status,
      currentApprover: row.current_approver,
      approvalHistory: approvalHistoryData,
      createdAt: row.created_at,
      requesterGroupId: requesterGroupId,
    };

    res.status(201).json(request);
  } catch (error: any) {
    console.error('Create request error:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
    });
    res.status(500).json({ 
      error: 'خطا در ایجاد درخواست',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Approve request
router.put('/:id/approve', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const requestId = req.params.id;

    // Get current user with group_ids
    const userResult = await pool.query(
      'SELECT role, name, group_ids FROM req_users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'کاربر یافت نشد' });
    }

    const user = userResult.rows[0];
    const userGroupIds = user.group_ids || [];

    // Get request with requester's group_ids
    const requestResult = await pool.query(
      `SELECT r.*, u.group_ids as requester_group_ids
       FROM requests r
       LEFT JOIN req_users u ON r.requester_id = u.id
       WHERE r.id = $1`,
      [requestId]
    );

    if (requestResult.rows.length === 0) {
      return res.status(404).json({ error: 'درخواست یافت نشد' });
    }

    const request = requestResult.rows[0];

    if (request.status !== 'PENDING' || request.current_approver !== user.role) {
      return res.status(400).json({ error: 'این درخواست قابل تایید نیست' });
    }

    // Check group permissions (if user doesn't have group 0, check group overlap)
    if (!userGroupIds.includes(0)) {
      const requesterGroupIds = request.requester_group_ids || [];
      if (requesterGroupIds.length > 0) {
        // Check if there's any overlap between user's groups and requester's groups
        const hasOverlap = requesterGroupIds.some((gid: number) => userGroupIds.includes(gid));
        if (!hasOverlap) {
          return res.status(403).json({ error: 'شما اجازه تایید این درخواست را ندارید' });
        }
      }
    }

    // Parse approval_history if it's a string (JSONB from database)
    let approvalHistory: any[] = [];
    if (request.approval_history) {
      if (typeof request.approval_history === 'string') {
        approvalHistory = JSON.parse(request.approval_history);
      } else if (Array.isArray(request.approval_history)) {
        approvalHistory = request.approval_history;
      }
    }

    const isLastApprover = user.role === 'NETWORK_ADMIN';
    const newApproval = {
      approverRole: user.role,
      approverName: user.name,
      status: isLastApprover ? 'COMPLETED' : 'APPROVED',
      date: new Date().toISOString(),
    };

    approvalHistory.push(newApproval);

    // Determine next approver or complete
    const roleHierarchy = ['GROUP_LEAD', 'DEPUTY', 'NETWORK_HEAD', 'NETWORK_ADMIN'];
    const currentIndex = roleHierarchy.indexOf(user.role);
    const isLast = currentIndex === roleHierarchy.length - 1;

    const updateResult = await pool.query(
      `UPDATE requests 
       SET status = $1, 
           current_approver = $2, 
           approval_history = $3::jsonb
       WHERE id = $4
       RETURNING *`,
      [
        isLast ? 'COMPLETED' : 'PENDING',
        isLast ? null : roleHierarchy[currentIndex + 1],
        JSON.stringify(approvalHistory), // Convert to JSON string for JSONB
        requestId,
      ]
    );

    const updatedRequest = updateResult.rows[0];
    
    // Parse JSONB fields if they are strings
    const filesData = typeof updatedRequest.files === 'string' 
      ? JSON.parse(updatedRequest.files) 
      : (Array.isArray(updatedRequest.files) ? updatedRequest.files : []);
    
    const approvalHistoryData = typeof updatedRequest.approval_history === 'string'
      ? JSON.parse(updatedRequest.approval_history)
      : (Array.isArray(updatedRequest.approval_history) ? updatedRequest.approval_history : []);

    res.json({
      id: updatedRequest.id,
      requesterName: updatedRequest.requester_name,
      department: updatedRequest.department,
      files: filesData,
      status: updatedRequest.status,
      currentApprover: updatedRequest.current_approver,
      approvalHistory: approvalHistoryData,
      createdAt: updatedRequest.created_at,
    });
  } catch (error: any) {
    console.error('Approve request error:', error);
    res.status(500).json({ error: 'خطا در تایید درخواست' });
  }
});

// Reject request
router.put('/:id/reject', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const requestId = req.params.id;

    // Get current user with group_ids
    const userResult = await pool.query(
      'SELECT role, name, group_ids FROM req_users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'کاربر یافت نشد' });
    }

    const user = userResult.rows[0];
    const userGroupIds = user.group_ids || [];

    // Get request with requester's group_ids
    const requestResult = await pool.query(
      `SELECT r.*, u.group_ids as requester_group_ids
       FROM requests r
       LEFT JOIN req_users u ON r.requester_id = u.id
       WHERE r.id = $1`,
      [requestId]
    );

    if (requestResult.rows.length === 0) {
      return res.status(404).json({ error: 'درخواست یافت نشد' });
    }

    const request = requestResult.rows[0];

    if (request.status !== 'PENDING' || request.current_approver !== user.role) {
      return res.status(400).json({ error: 'این درخواست قابل رد نیست' });
    }

    // Check group permissions (if user doesn't have group 0, check group overlap)
    if (!userGroupIds.includes(0)) {
      const requesterGroupIds = request.requester_group_ids || [];
      if (requesterGroupIds.length > 0) {
        // Check if there's any overlap between user's groups and requester's groups
        const hasOverlap = requesterGroupIds.some((gid: number) => userGroupIds.includes(gid));
        if (!hasOverlap) {
          return res.status(403).json({ error: 'شما اجازه رد این درخواست را ندارید' });
        }
      }
    }

    // Parse approval_history if it's a string (JSONB from database)
    let approvalHistory: any[] = [];
    if (request.approval_history) {
      if (typeof request.approval_history === 'string') {
        approvalHistory = JSON.parse(request.approval_history);
      } else if (Array.isArray(request.approval_history)) {
        approvalHistory = request.approval_history;
      }
    }

    const newApproval = {
      approverRole: user.role,
      approverName: user.name,
      status: 'REJECTED',
      date: new Date().toISOString(),
    };

    approvalHistory.push(newApproval);

    const updateResult = await pool.query(
      `UPDATE requests 
       SET status = $1, 
           current_approver = $2, 
           approval_history = $3::jsonb
       WHERE id = $4
       RETURNING *`,
      ['REJECTED', null, JSON.stringify(approvalHistory), requestId] // Convert to JSON string for JSONB
    );

    const updatedRequest = updateResult.rows[0];
    
    // Parse JSONB fields if they are strings
    const filesData = typeof updatedRequest.files === 'string' 
      ? JSON.parse(updatedRequest.files) 
      : (Array.isArray(updatedRequest.files) ? updatedRequest.files : []);
    
    const approvalHistoryData = typeof updatedRequest.approval_history === 'string'
      ? JSON.parse(updatedRequest.approval_history)
      : (Array.isArray(updatedRequest.approval_history) ? updatedRequest.approval_history : []);

    res.json({
      id: updatedRequest.id,
      requesterName: updatedRequest.requester_name,
      department: updatedRequest.department,
      files: filesData,
      status: updatedRequest.status,
      currentApprover: updatedRequest.current_approver,
      approvalHistory: approvalHistoryData,
      createdAt: updatedRequest.created_at,
    });
  } catch (error: any) {
    console.error('Reject request error:', error);
    res.status(500).json({ error: 'خطا در رد درخواست' });
  }
});

// Update letter number for a file in a request
router.put('/:id/files/:fileId/letter-number', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const requestId = req.params.id;
    const fileId = req.params.fileId;
    const { letterNumber } = req.body;

    if (!letterNumber || letterNumber.trim() === '') {
      return res.status(400).json({ error: 'شماره نامه الزامی است' });
    }

    // Get request
    const requestResult = await pool.query(
      'SELECT * FROM requests WHERE id = $1',
      [requestId]
    );

    if (requestResult.rows.length === 0) {
      return res.status(404).json({ error: 'درخواست یافت نشد' });
    }

    const request = requestResult.rows[0];

    // Check if user is the requester
    if (request.requester_id !== userId) {
      return res.status(403).json({ error: 'شما فقط می‌توانید شماره نامه درخواست‌های خود را ویرایش کنید' });
    }

    // Parse files
    let files: any[] = [];
    if (typeof request.files === 'string') {
      files = JSON.parse(request.files);
    } else if (Array.isArray(request.files)) {
      files = request.files;
    }

    // Find and update the file
    const fileIndex = files.findIndex((f: any) => f.id === fileId);
    if (fileIndex === -1) {
      return res.status(404).json({ error: 'فایل یافت نشد' });
    }

    // Check if letterNumber already exists
    if (files[fileIndex].letterNumber && files[fileIndex].letterNumber.trim() !== '') {
      return res.status(400).json({ error: 'شماره نامه قبلاً وارد شده است و قابل ویرایش نیست' });
    }

    // Update letter number
    files[fileIndex].letterNumber = letterNumber.trim();

    // Update request
    const updateResult = await pool.query(
      `UPDATE requests 
       SET files = $1::jsonb
       WHERE id = $2
       RETURNING *`,
      [JSON.stringify(files), requestId]
    );

    const updatedRequest = updateResult.rows[0];
    const updatedFilesData = typeof updatedRequest.files === 'string' 
      ? JSON.parse(updatedRequest.files) 
      : (Array.isArray(updatedRequest.files) ? updatedRequest.files : []);

    res.json({
      id: updatedRequest.id,
      files: updatedFilesData,
    });
  } catch (error: any) {
    console.error('Update letter number error:', error);
    res.status(500).json({ error: 'خطا در به‌روزرسانی شماره نامه' });
  }
});

export default router;

