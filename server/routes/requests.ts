import express, { Request, Response } from 'express';
import { pool } from '../index';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Helper function to determine approval hierarchy based on request type
function getApprovalHierarchy(requestType: string): string[] {
  if (requestType === 'BACKUP') {
    // For BACKUP: REQUESTER -> GROUP_LEAD -> NETWORK_HEAD -> NETWORK_ADMIN
    return ['GROUP_LEAD', 'NETWORK_HEAD', 'NETWORK_ADMIN'];
  } else if (requestType === 'VDI') {
    // For VDI: REQUESTER -> DEPUTY -> NETWORK_HEAD -> NETWORK_ADMIN
    return ['DEPUTY', 'NETWORK_HEAD', 'NETWORK_ADMIN'];
  } else {
    // For FILE_TRANSFER: REQUESTER -> GROUP_LEAD -> DEPUTY -> NETWORK_HEAD -> NETWORK_ADMIN
    return ['GROUP_LEAD', 'DEPUTY', 'NETWORK_HEAD', 'NETWORK_ADMIN'];
  }
}

// Get all requests (filtered based on user role)
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

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
        r.request_type,
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

    if (user.role === 'REQUESTER') {
      query += ` WHERE r.requester_id = $${++paramCount}`;
      params.push(userId);
    } else {
      query += ` WHERE r.status = 'PENDING' AND r.current_approver = $${++paramCount}`;
      params.push(user.role);
      
      if (!userGroupIds.includes(0)) {
        if (userGroupIds.length > 0) {
          query += ` AND (
            u.group_ids && $${++paramCount}::integer[] OR 
            u.group_ids IS NULL OR 
            array_length(u.group_ids, 1) IS NULL
          )`;
          params.push(userGroupIds);
        } else {
          query += ` AND 1=0`;
        }
      }
    }

    query += ` ORDER BY r.created_at DESC`;

    const result = await pool.query(query, params);

    const requests = result.rows.map((row) => {
      const filesData = typeof row.files === 'string' 
        ? JSON.parse(row.files) 
        : (Array.isArray(row.files) ? row.files : null);
      
      const backupsData = typeof row.backups === 'string' 
        ? JSON.parse(row.backups) 
        : (Array.isArray(row.backups) ? row.backups : null);
      
      const vdisData = typeof row.vdis === 'string' 
        ? JSON.parse(row.vdis) 
        : (Array.isArray(row.vdis) ? row.vdis : null);
      
      const approvalHistoryData = typeof row.approval_history === 'string'
        ? JSON.parse(row.approval_history)
        : (Array.isArray(row.approval_history) ? row.approval_history : []);

      return {
        id: row.id,
        requesterName: row.requester_name,
        department: row.department,
        requestType: row.request_type,
        files: filesData,
        backups: backupsData,
        vdis: vdisData,
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
    res.status(500).json({ error: 'خطا در دریافت درخواست‌ها' });
  }
});

// Get request history
router.get('/history', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    const userResult = await pool.query(
      'SELECT role, name FROM req_users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'کاربر یافت نشد' });
    }

    const user = userResult.rows[0];

    const result = await pool.query(
      `SELECT 
        r.id,
        r.requester_id,
        r.requester_name,
        r.department,
        r.request_type,
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
      const filesData = typeof row.files === 'string' 
        ? JSON.parse(row.files) 
        : (Array.isArray(row.files) ? row.files : null);
      
      const approvalHistoryData = typeof row.approval_history === 'string'
        ? JSON.parse(row.approval_history)
        : (Array.isArray(row.approval_history) ? row.approval_history : []);

      // بر اساس نوع درخواست، داده‌ها را به صورت مناسب برمی‌گردانیم
      const result: any = {
        id: row.id,
        requesterName: row.requester_name,
        department: row.department,
        requestType: row.request_type,
        status: row.status,
        currentApprover: row.current_approver,
        approvalHistory: approvalHistoryData,
        createdAt: row.created_at,
        requesterGroupId: row.requester_group_ids && row.requester_group_ids.length > 0 ? row.requester_group_ids[0] : null,
      };

      // بر اساس نوع درخواست، داده‌ها را در فیلد مناسب قرار می‌دهیم
      if (row.request_type === 'FILE_TRANSFER') {
        result.files = filesData;
      } else if (row.request_type === 'BACKUP') {
        result.backups = filesData;
      } else if (row.request_type === 'VDI' || row.request_type === 'VDI_OPEN') {
        result.vdis = filesData;
      }

      return result;
    });

    res.json(requests);
  } catch (error: any) {
    console.error('Get history error:', error);
    res.status(500).json({ error: 'خطا در دریافت تاریخچه' });
  }
});

// Create new request
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { type, files, backups, vdis } = req.body;

    console.log('Received request to create:', { userId, type, filesCount: files?.length, backupsCount: backups?.length, vdisCount: vdis?.length });

    if (!type) {
      return res.status(400).json({ error: 'نوع درخواست الزامی است' });
    }

    // تعیین داده‌های مورد نیاز بر اساس نوع درخواست
    let dataToStore: any[] | null = null;
    
    if (type === 'FILE_TRANSFER') {
      if (!files || !Array.isArray(files) || files.length === 0) {
        return res.status(400).json({ error: 'حداقل یک فایل الزامی است' });
      }
      dataToStore = files;
    } else if (type === 'BACKUP') {
      if (!backups || !Array.isArray(backups) || backups.length === 0) {
        return res.status(400).json({ error: 'حداقل یک مشخصات backup الزامی است' });
      }
      dataToStore = backups;
    } else if (type === 'VDI' || type === 'VDI_OPEN') {
      if (!vdis || !Array.isArray(vdis) || vdis.length === 0) {
        return res.status(400).json({ error: 'حداقل یک مشخصات VDI الزامی است' });
      }
      dataToStore = vdis;
    }

    const userResult = await pool.query(
      'SELECT name, department, group_ids FROM req_users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'کاربر یافت نشد' });
    }

    const user = userResult.rows[0];

    const countResult = await pool.query('SELECT COUNT(*) as count FROM requests');
    const count = parseInt(countResult.rows[0].count) + 1;
    const requestId = `req-${String(count).padStart(3, '0')}`;

    // Determine first approver based on request type
    const hierarchy = getApprovalHierarchy(type);
    const firstApprover = hierarchy[0];

    const insertResult = await pool.query(
      `INSERT INTO requests (
        id, requester_id, requester_name, department, request_type, files,
        status, current_approver, approval_history
      ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9::jsonb)
      RETURNING *`,
      [
        requestId,
        userId,
        user.name,
        user.department,
        type,
        JSON.stringify(dataToStore),
        'PENDING',
        firstApprover,
        '[]',
      ]
    );

    const row = insertResult.rows[0];
    
    const filesData = row.files ? (typeof row.files === 'string' ? JSON.parse(row.files) : row.files) : null;
    const approvalHistoryData = typeof row.approval_history === 'string'
      ? JSON.parse(row.approval_history)
      : (Array.isArray(row.approval_history) ? row.approval_history : []);

    const requesterUserResult = await pool.query(
      'SELECT group_ids FROM req_users WHERE id = $1',
      [row.requester_id]
    );
    const requesterGroupIds = requesterUserResult.rows[0]?.group_ids || [];
    const requesterGroupId = requesterGroupIds.length > 0 ? requesterGroupIds[0] : null;

    const request: any = {
      id: row.id,
      requesterName: row.requester_name,
      department: row.department,
      requestType: row.request_type,
      status: row.status,
      currentApprover: row.current_approver,
      approvalHistory: approvalHistoryData,
      createdAt: row.created_at,
      requesterGroupId: requesterGroupId,
    };

    // بر اساس نوع درخواست، داده‌ها را در فیلد مناسب قرار می‌دهیم
    if (row.request_type === 'FILE_TRANSFER') {
      request.files = filesData;
    } else if (row.request_type === 'BACKUP') {
      request.backups = filesData;
    } else if (row.request_type === 'VDI' || row.request_type === 'VDI_OPEN') {
      request.vdis = filesData;
    }

    res.status(201).json(request);
  } catch (error: any) {
    console.error('Create request error:', error);
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

    const userResult = await pool.query(
      'SELECT role, name, group_ids FROM req_users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'کاربر یافت نشد' });
    }

    const user = userResult.rows[0];
    const userGroupIds = user.group_ids || [];

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

    if (!userGroupIds.includes(0)) {
      const requesterGroupIds = request.requester_group_ids || [];
      if (requesterGroupIds.length > 0) {
        const hasOverlap = requesterGroupIds.some((gid: number) => userGroupIds.includes(gid));
        if (!hasOverlap) {
          return res.status(403).json({ error: 'شما اجازه تایید این درخواست را ندارید' });
        }
      }
    }

    let approvalHistory: any[] = [];
    if (request.approval_history) {
      if (typeof request.approval_history === 'string') {
        approvalHistory = JSON.parse(request.approval_history);
      } else if (Array.isArray(request.approval_history)) {
        approvalHistory = request.approval_history;
      }
    }

    // Get approval hierarchy for this request type
    const hierarchy = getApprovalHierarchy(request.request_type);
    const currentIndex = hierarchy.indexOf(user.role);
    const isLast = currentIndex === hierarchy.length - 1;

    const newApproval = {
      approverRole: user.role,
      approverName: user.name,
      status: isLast ? 'COMPLETED' : 'APPROVED',
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
      [
        isLast ? 'COMPLETED' : 'PENDING',
        isLast ? null : hierarchy[currentIndex + 1],
        JSON.stringify(approvalHistory),
        requestId,
      ]
    );

    const updatedRequest = updateResult.rows[0];
    
    const filesData = updatedRequest.files ? (typeof updatedRequest.files === 'string' ? JSON.parse(updatedRequest.files) : updatedRequest.files) : null;
    const approvalHistoryData = typeof updatedRequest.approval_history === 'string'
      ? JSON.parse(updatedRequest.approval_history)
      : (Array.isArray(updatedRequest.approval_history) ? updatedRequest.approval_history : []);

    const result: any = {
      id: updatedRequest.id,
      requesterName: updatedRequest.requester_name,
      department: updatedRequest.department,
      requestType: updatedRequest.request_type,
      status: updatedRequest.status,
      currentApprover: updatedRequest.current_approver,
      approvalHistory: approvalHistoryData,
      createdAt: updatedRequest.created_at,
    };

    // بر اساس نوع درخواست، داده‌ها را در فیلد مناسب قرار می‌دهیم
    if (updatedRequest.request_type === 'FILE_TRANSFER') {
      result.files = filesData;
    } else if (updatedRequest.request_type === 'BACKUP') {
      result.backups = filesData;
    } else if (updatedRequest.request_type === 'VDI' || updatedRequest.request_type === 'VDI_OPEN') {
      result.vdis = filesData;
    }

    res.json(result);
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

    const userResult = await pool.query(
      'SELECT role, name, group_ids FROM req_users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'کاربر یافت نشد' });
    }

    const user = userResult.rows[0];
    const userGroupIds = user.group_ids || [];

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

    if (!userGroupIds.includes(0)) {
      const requesterGroupIds = request.requester_group_ids || [];
      if (requesterGroupIds.length > 0) {
        const hasOverlap = requesterGroupIds.some((gid: number) => userGroupIds.includes(gid));
        if (!hasOverlap) {
          return res.status(403).json({ error: 'شما اجازه رد این درخواست را ندارید' });
        }
      }
    }

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
      ['REJECTED', null, JSON.stringify(approvalHistory), requestId]
    );

    const updatedRequest = updateResult.rows[0];
    
    const filesData = updatedRequest.files ? (typeof updatedRequest.files === 'string' ? JSON.parse(updatedRequest.files) : updatedRequest.files) : null;
    const approvalHistoryData = typeof updatedRequest.approval_history === 'string'
      ? JSON.parse(updatedRequest.approval_history)
      : (Array.isArray(updatedRequest.approval_history) ? updatedRequest.approval_history : []);

    const result: any = {
      id: updatedRequest.id,
      requesterName: updatedRequest.requester_name,
      department: updatedRequest.department,
      requestType: updatedRequest.request_type,
      status: updatedRequest.status,
      currentApprover: updatedRequest.current_approver,
      approvalHistory: approvalHistoryData,
      createdAt: updatedRequest.created_at,
    };

    // بر اساس نوع درخواست، داده‌ها را در فیلد مناسب قرار می‌دهیم
    if (updatedRequest.request_type === 'FILE_TRANSFER') {
      result.files = filesData;
    } else if (updatedRequest.request_type === 'BACKUP') {
      result.backups = filesData;
    } else if (updatedRequest.request_type === 'VDI' || updatedRequest.request_type === 'VDI_OPEN') {
      result.vdis = filesData;
    }

    res.json(result);
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

    const requestResult = await pool.query(
      'SELECT * FROM requests WHERE id = $1',
      [requestId]
    );

    if (requestResult.rows.length === 0) {
      return res.status(404).json({ error: 'درخواست یافت نشد' });
    }

    const request = requestResult.rows[0];

    if (request.requester_id !== userId) {
      return res.status(403).json({ error: 'شما فقط می‌توانید شماره نامه درخواست‌های خود را ویرایش کنید' });
    }

    let files: any[] = [];
    if (typeof request.files === 'string') {
      files = JSON.parse(request.files);
    } else if (Array.isArray(request.files)) {
      files = request.files;
    }

    const fileIndex = files.findIndex((f: any) => f.id === fileId);
    if (fileIndex === -1) {
      return res.status(404).json({ error: 'فایل یافت نشد' });
    }

    if (files[fileIndex].letterNumber && files[fileIndex].letterNumber.trim() !== '') {
      return res.status(400).json({ error: 'شماره نامه قبلاً وارد شده است و قابل ویرایش نیست' });
    }

    files[fileIndex].letterNumber = letterNumber.trim();

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