import express, { Request, Response } from 'express';
import { pool } from '../index';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Helper function to determine approval hierarchy based on request type
function getApprovalHierarchy(requestType: string): string[] {
  if (requestType === 'BACKUP') {
    return ['GROUP_LEAD', 'NETWORK_HEAD', 'NETWORK_ADMIN'];
  } else if (requestType === 'VDI_OPEN') {
    return ['DEPUTY', 'NETWORK_HEAD', 'NETWORK_ADMIN'];
  } else {
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
        r.rejection_reason,
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
      
      const approvalHistoryData = typeof row.approval_history === 'string'
        ? JSON.parse(row.approval_history)
        : (Array.isArray(row.approval_history) ? row.approval_history : []);

      const baseRequest: any = {
        id: row.id,
        requesterName: row.requester_name,
        department: row.department,
        requestType: row.request_type,
        status: row.status,
        currentApprover: row.current_approver,
        approvalHistory: approvalHistoryData,
        rejectionReason: row.rejection_reason,
        createdAt: row.created_at,
        requesterGroupId: row.requester_group_ids && row.requester_group_ids.length > 0 ? row.requester_group_ids[0] : null,
      };

      if (row.request_type === 'FILE_TRANSFER') {
        baseRequest.files = filesData;
      } else if (row.request_type === 'BACKUP') {
        baseRequest.backups = filesData;
      } else if (row.request_type === 'VDI' || row.request_type === 'VDI_OPEN') {
        baseRequest.vdis = filesData;
      }

      return baseRequest;
    });

    res.json(requests);
  } catch (error: any) {
    console.error('Get requests error:', error);
    res.status(500).json({ error: 'خطا در دریافت درخواست‌ها' });
  }
});


// این کد جایگزین endpoint فعلی /history می‌شود
// در فایل server/routes/requests.ts

// Get request history - نمایش کامل درخواست‌های گروهی با پشتیبانی از NETWORK_HEAD و NETWORK_ADMIN
router.get('/history', authenticateToken, async (req: Request, res: Response) => {
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
    const userName = user.name;
    const userRole = user.role;

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
        r.rejection_reason,
        r.created_at,
        u.group_ids as requester_group_ids
      FROM requests r
      LEFT JOIN req_users u ON r.requester_id = u.id
      WHERE (
    `;

    const conditions: string[] = [];
    const params: any[] = [];
    let paramCount = 0;

    // ===============================================
    // شرط 1: درخواست‌های خود کاربر (اگر REQUESTER است)
    // ===============================================
    conditions.push(`r.requester_id = $${++paramCount}`);
    params.push(userId);

    // ===============================================
    // شرط 2: درخواست‌هایی که این کاربر شخصاً در آنها عمل کرده
    // ===============================================
    conditions.push(`
      EXISTS (
        SELECT 1 FROM jsonb_array_elements(r.approval_history) AS elem
        WHERE elem->>'approverName' = $${++paramCount}
      )
    `);
    params.push(userName);

    // ===============================================
    // شرط 3: درخواست‌های گروهی
    // ===============================================
    
    if (userRole !== 'REQUESTER') {
      // برای NETWORK_HEAD و NETWORK_ADMIN: فقط Role چک می‌شود
      if (userRole === 'NETWORK_HEAD' || userRole === 'NETWORK_ADMIN') {
        conditions.push(`
          EXISTS (
            SELECT 1 FROM jsonb_array_elements(r.approval_history) AS elem
            WHERE elem->>'approverRole' = $${++paramCount}
          )
        `);
        params.push(userRole);
      } 
      // برای سایر نقش‌ها: هم گروه و هم Role چک می‌شود
      else if (userGroupIds.length > 0 && !userGroupIds.includes(0)) {
        conditions.push(`
          (
            -- requester در یکی از گروه‌های مشترک با این کاربر است
            u.group_ids && $${++paramCount}::integer[]
            AND
            -- و درخواست توسط کسی با همان Role این کاربر پردازش شده
            EXISTS (
              SELECT 1 FROM jsonb_array_elements(r.approval_history) AS elem
              WHERE elem->>'approverRole' = $${++paramCount}
            )
          )
        `);
        params.push(userGroupIds, userRole);
      }
    }

    query += conditions.join(' OR ');
    query += `
      )
      ORDER BY r.created_at DESC
    `;

    console.log('=== History Query Debug ===');
    console.log('User:', userName, '| Role:', userRole, '| Groups:', userGroupIds);
    console.log('Query:', query);
    console.log('Params:', params);
    console.log('===========================');

    const result = await pool.query(query, params);

    const requests = result.rows.map((row) => {
      const filesData = typeof row.files === 'string' 
        ? JSON.parse(row.files) 
        : (Array.isArray(row.files) ? row.files : null);
      
      const approvalHistoryData = typeof row.approval_history === 'string'
        ? JSON.parse(row.approval_history)
        : (Array.isArray(row.approval_history) ? row.approval_history : []);

      const result: any = {
        id: row.id,
        requesterName: row.requester_name,
        department: row.department,
        requestType: row.request_type,
        status: row.status,
        currentApprover: row.current_approver,
        approvalHistory: approvalHistoryData,
        rejectionReason: row.rejection_reason,
        createdAt: row.created_at,
        requesterGroupId: row.requester_group_ids && row.requester_group_ids.length > 0 ? row.requester_group_ids[0] : null,
      };

      if (row.request_type === 'FILE_TRANSFER') {
        result.files = filesData;
      } else if (row.request_type === 'BACKUP') {
        result.backups = filesData;
      } else if (row.request_type === 'VDI' || row.request_type === 'VDI_OPEN') {
        result.vdis = filesData;
      }

      return result;
    });

    console.log(`Found ${requests.length} requests for user ${userName}`);

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

    if (!type) {
      return res.status(400).json({ error: 'نوع درخواست الزامی است' });
    }

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

    // ============================================================
    // تولید ID صحیح - بر اساس بزرگترین ID موجود
    // ============================================================
    
    const maxIdResult = await pool.query(`
      SELECT id FROM requests 
      WHERE id ~ '^req-[0-9]+$'
      ORDER BY 
        CAST(SUBSTRING(id FROM 5) AS INTEGER) DESC
      LIMIT 1
    `);

    let nextNumber = 1;

    if (maxIdResult.rows.length > 0) {
      const maxId = maxIdResult.rows[0].id;
      const currentNumber = parseInt(maxId.split('-')[1]);
      nextNumber = currentNumber + 1;
    }

    const requestId = `req-${String(nextNumber).padStart(3, '0')}`;

    console.log(`=== Creating new request ===`);
    console.log(`User: ${user.name}`);
    console.log(`Type: ${type}`);
    console.log(`Generated ID: ${requestId}`);
    console.log(`===========================`);

    // ============================================================
    // ادامه منطق insert
    // ============================================================

    const hierarchy = getApprovalHierarchy(type);
    const firstApprover = hierarchy[0];

    const insertResult = await pool.query(
      `INSERT INTO requests (
        id, requester_id, requester_name, department, request_type, files,
        status, current_approver, approval_history, rejection_reason
      ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9::jsonb, $10)
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
        null,
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
      rejectionReason: row.rejection_reason,
      createdAt: row.created_at,
      requesterGroupId: requesterGroupId,
    };

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
    
    // بررسی خطای ID تکراری
    if (error.code === '23505') {
      return res.status(409).json({ 
        error: 'شماره درخواست تکراری است. لطفاً دوباره تلاش کنید.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
    
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
      rejectionReason: updatedRequest.rejection_reason,
      createdAt: updatedRequest.created_at,
    };

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
    const { rejectionReason } = req.body;

    // اعتبارسنجی دلیل رد
    if (!rejectionReason || typeof rejectionReason !== 'string' || rejectionReason.trim() === '') {
      return res.status(400).json({ error: 'دلیل رد درخواست الزامی است' });
    }

    if (rejectionReason.trim().length > 500) {
      return res.status(400).json({ error: 'دلیل رد درخواست نباید بیشتر از 500 کاراکتر باشد' });
    }

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
      rejectionReason: rejectionReason.trim(),
    };

    approvalHistory.push(newApproval);

    const updateResult = await pool.query(
      `UPDATE requests 
       SET status = $1, 
           current_approver = $2, 
           approval_history = $3::jsonb,
           rejection_reason = $4
       WHERE id = $5
       RETURNING *`,
      ['REJECTED', null, JSON.stringify(approvalHistory), rejectionReason.trim(), requestId]
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
      rejectionReason: updatedRequest.rejection_reason,
      createdAt: updatedRequest.created_at,
    };

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