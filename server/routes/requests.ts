import express, { Request, Response } from 'express';
import { pool } from '../index';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Helper function to determine approval hierarchy based on request type
function getApprovalHierarchy(requestType: string): string[] {
  if (requestType === 'VIDEO_CONFRENCE') {
    return ['VC_ACCEPTER'];
  }
  if (requestType === 'BACKUP') {
    return ['GROUP_LEAD', 'NETWORK_HEAD', 'NETWORK_ADMIN'];
  } else if (requestType === 'VDI_OPEN') {
    return ['DEPUTY', 'NETWORK_HEAD', 'NETWORK_ADMIN'];
  } else if (requestType === 'USB_PORT') {
    return ['GROUP_LEAD', 'DEPUTY', 'NETWORK_HEAD', 'NETWORK_USB_ADMIN'];
  } else if (requestType === 'TAPE' || requestType === 'APP_INSTALL') {
    return ['GROUP_LEAD', 'DEPUTY', 'NETWORK_HEAD', 'NETWORK_ADMIN'];
  } else {
    return ['GROUP_LEAD', 'DEPUTY', 'NETWORK_HEAD', 'NETWORK_ADMIN'];
  }
}

// Get all requests (filtered based on user role) - NOT CANCELLED
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
        r.is_revised,
        r.revision_count,
        r.previous_versions,
        u.group_ids as requester_group_ids
      FROM requests r
      LEFT JOIN req_users u ON r.requester_id = u.id
      WHERE r.status != 'CANCELLED'
    `;

    const params: any[] = [];
    let paramCount = 0;

    if (user.role === 'REQUESTER' || user.role === 'V_REQUESTER') {
      query += ` AND r.requester_id = $${++paramCount}`;
      params.push(userId);
    } else {
      query += ` AND r.status = 'PENDING' AND r.current_approver = $${++paramCount}`;
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

      const previousVersionsData = row.previous_versions 
        ? (typeof row.previous_versions === 'string' ? JSON.parse(row.previous_versions) : row.previous_versions)
        : [];

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
        requesterId: row.requester_id,
        isRevised: row.is_revised || false,
        revisionCount: row.revision_count || 0,
        previousVersions: previousVersionsData,
      };

      if (row.request_type === 'FILE_TRANSFER') {
        baseRequest.files = filesData;
      } else if (row.request_type === 'BACKUP') {
        baseRequest.backups = filesData;
      } else if (row.request_type === 'VDI' || row.request_type === 'VDI_OPEN') {
        baseRequest.vdis = filesData;
      } else if (row.request_type === 'TAPE') {
        baseRequest.tapes = filesData;
      } else if (row.request_type === 'USB_PORT') {
        baseRequest.usbPorts = filesData;
      } else if (row.request_type === 'APP_INSTALL') {
        baseRequest.appInstalls = filesData;
      } else if (row.request_type === 'SERVER_RESTART') {
        baseRequest.serverRestarts = filesData;
      } else if (row.request_type === 'VIDEO_CONFRENCE') {
        baseRequest.videoConferences = filesData;
      }

      return baseRequest;
    });

    res.json(requests);
  } catch (error: any) {
    console.error('Get requests error:', error);
    res.status(500).json({ error: 'خطا در دریافت درخواست‌ها' });
  }
});

// Get rejected requests for requester
router.get('/rejected', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    const userResult = await pool.query(
      'SELECT role FROM req_users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'کاربر یافت نشد' });
    }

    const user = userResult.rows[0];

    if (user.role !== 'REQUESTER' && user.role !== 'V_REQUESTER') {
      return res.status(403).json({ error: 'فقط کاربران درخواست‌دهنده می‌توانند درخواست‌های رد شده را ببینند' });
    }

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
        r.rejection_reason,
        r.created_at,
        r.is_revised,
        r.revision_count,
        r.previous_versions,
        u.group_ids as requester_group_ids
      FROM requests r
      LEFT JOIN req_users u ON r.requester_id = u.id
      WHERE r.requester_id = $1 AND r.status = 'REJECTED'
      ORDER BY r.created_at DESC`,
      [userId]
    );

    const requests = result.rows.map((row) => {
      const filesData = typeof row.files === 'string' 
        ? JSON.parse(row.files) 
        : (Array.isArray(row.files) ? row.files : null);
      
      const approvalHistoryData = typeof row.approval_history === 'string'
        ? JSON.parse(row.approval_history)
        : (Array.isArray(row.approval_history) ? row.approval_history : []);

      const previousVersionsData = row.previous_versions 
        ? (typeof row.previous_versions === 'string' ? JSON.parse(row.previous_versions) : row.previous_versions)
        : [];

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
        requesterId: row.requester_id,
        isRevised: row.is_revised || false,
        revisionCount: row.revision_count || 0,
        previousVersions: previousVersionsData,
      };

      if (row.request_type === 'FILE_TRANSFER') {
        baseRequest.files = filesData;
      } else if (row.request_type === 'BACKUP') {
        baseRequest.backups = filesData;
      } else if (row.request_type === 'VDI' || row.request_type === 'VDI_OPEN') {
        baseRequest.vdis = filesData;
      } else if (row.request_type === 'TAPE') {
        baseRequest.tapes = filesData;
      } else if (row.request_type === 'USB_PORT') {
        baseRequest.usbPorts = filesData;
      } else if (row.request_type === 'APP_INSTALL') {
        baseRequest.appInstalls = filesData;
      } else if (row.request_type === 'SERVER_RESTART') {
        baseRequest.serverRestarts = filesData;
      } else if (row.request_type === 'VIDEO_CONFRENCE') {
        baseRequest.videoConferences = filesData;
      }

      return baseRequest;
    });

    res.json(requests);
  } catch (error: any) {
    console.error('Get rejected requests error:', error);
    res.status(500).json({ error: 'خطا در دریافت درخواست‌های رد شده' });
  }
});

// Get request history - فیلتر می‌کنیم که CANCELLED نباشد
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

    const conditions: string[] = [];
    const params: any[] = [];
    let paramCount = 0;

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
        r.is_revised,
        r.revision_count,
        r.previous_versions,
        u.group_ids as requester_group_ids
      FROM requests r
      LEFT JOIN req_users u ON r.requester_id = u.id
      WHERE (
        -- اگر کاربر requester است، درخواست‌های CANCELLED را هم نشان بده
        (r.status != 'CANCELLED' OR (r.status = 'CANCELLED' AND r.requester_id = $${++paramCount}))
      ) AND (
    `;
    params.push(userId);

    conditions.push(`r.requester_id = $${++paramCount}`);
    params.push(userId);

    conditions.push(`
      EXISTS (
        SELECT 1 FROM jsonb_array_elements(r.approval_history) AS elem
        WHERE elem->>'approverName' = $${++paramCount}
      )
    `);
    params.push(userName);

    if (userRole !== 'REQUESTER' && userRole !== 'V_REQUESTER') {
      if (userRole === 'NETWORK_HEAD' || userRole === 'NETWORK_ADMIN' || userRole === 'NETWORK_USB_ADMIN' || userRole === 'VC_ACCEPTER') {
        conditions.push(`
          EXISTS (
            SELECT 1 FROM jsonb_array_elements(r.approval_history) AS elem
            WHERE elem->>'approverRole' = $${++paramCount}
          )
        `);
        params.push(userRole);
      } else if (userGroupIds.length > 0 && !userGroupIds.includes(0)) {
        conditions.push(`
          (
            u.group_ids && $${++paramCount}::integer[]
            AND
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

    const result = await pool.query(query, params);

    const requests = result.rows.map((row) => {
      const filesData = typeof row.files === 'string' 
        ? JSON.parse(row.files) 
        : (Array.isArray(row.files) ? row.files : null);
      
      const approvalHistoryData = typeof row.approval_history === 'string'
        ? JSON.parse(row.approval_history)
        : (Array.isArray(row.approval_history) ? row.approval_history : []);

      const previousVersionsData = row.previous_versions 
        ? (typeof row.previous_versions === 'string' ? JSON.parse(row.previous_versions) : row.previous_versions)
        : [];

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
        requesterId: row.requester_id,
        isRevised: row.is_revised || false,
        revisionCount: row.revision_count || 0,
        previousVersions: previousVersionsData,
      };

      if (row.request_type === 'FILE_TRANSFER') {
        result.files = filesData;
      } else if (row.request_type === 'BACKUP') {
        result.backups = filesData;
      } else if (row.request_type === 'VDI' || row.request_type === 'VDI_OPEN') {
        result.vdis = filesData;
      } else if (row.request_type === 'TAPE') {
        result.tapes = filesData;
      } else if (row.request_type === 'USB_PORT') {
        result.usbPorts = filesData;
      } else if (row.request_type === 'APP_INSTALL') {
        result.appInstalls = filesData;
      } else if (row.request_type === 'SERVER_RESTART') {
        result.serverRestarts = filesData;
      } else if (row.request_type === 'VIDEO_CONFRENCE') {
        result.videoConferences = filesData;
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
    const { type, files, backups, vdis, tapes, usbPorts, appInstalls, serverRestarts, videoConferences } = req.body;

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
    } else if (type === 'TAPE') {
      if (!tapes || !Array.isArray(tapes) || tapes.length === 0) {
        return res.status(400).json({ error: 'حداقل یک مشخصات Tape الزامی است' });
      }
      dataToStore = tapes;
    } else if (type === 'USB_PORT') {
      if (!usbPorts || !Array.isArray(usbPorts) || usbPorts.length === 0) {
        return res.status(400).json({ error: 'حداقل یک مشخصات USB Port الزامی است' });
      }
      dataToStore = usbPorts;
    } else if (type === 'APP_INSTALL') {
      if (!appInstalls || !Array.isArray(appInstalls) || appInstalls.length === 0) {
        return res.status(400).json({ error: 'حداقل یک مشخصات نصب برنامه الزامی است' });
      }
      dataToStore = appInstalls;
    } else if (type === 'SERVER_RESTART') {
      if (!serverRestarts || !Array.isArray(serverRestarts) || serverRestarts.length === 0) {
        return res.status(400).json({ error: 'حداقل یک مشخصات ریستارت سرور الزامی است' });
      }
      for (const item of serverRestarts) {
        if (!item.serverIP || !String(item.serverIP).trim()) {
          return res.status(400).json({ error: 'IP سرور الزامی است' });
        }
        if (!item.isUrgent && (!item.restartTime || !String(item.restartTime).trim())) {
          return res.status(400).json({ error: 'ساعت ریستارت الزامی است مگر اینکه گزینه فوری انتخاب شده باشد' });
        }
      }
      dataToStore = serverRestarts;
    } else if (type === 'VIDEO_CONFRENCE') {
      if (!videoConferences || !Array.isArray(videoConferences) || videoConferences.length === 0) {
        return res.status(400).json({ error: 'حداقل یک ردیف ویدئو کنفرانس الزامی است' });
      }
      dataToStore = videoConferences;
    }

    const userResult = await pool.query(
      'SELECT name, department, group_ids, role FROM req_users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'کاربر یافت نشد' });
    }

    const user = userResult.rows[0];

    if (user.role === 'V_REQUESTER' && type !== 'VIDEO_CONFRENCE') {
      return res.status(403).json({ error: 'فقط درخواست ویدئو کنفرانس برای این نقش مجاز است' });
    }

    if (user.role === 'VC_ACCEPTER') {
      return res.status(403).json({ error: 'این نقش نمی‌تواند درخواست جدید ثبت کند' });
    }

    // بررسی اینکه آیا کاربر درخواست رد شده دارد؟
    if (user.role === 'REQUESTER' || user.role === 'V_REQUESTER') {
      const rejectedCheck = await pool.query(
        'SELECT COUNT(*) as count FROM requests WHERE requester_id = $1 AND status = $2',
        [userId, 'REJECTED']
      );

      if (parseInt(rejectedCheck.rows[0].count) > 0) {
        return res.status(400).json({ 
          error: 'شما درخواست‌های رد شده دارید که باید ابتدا آن‌ها را تعیین تکلیف کنید'
        });
      }
    }

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

    const hierarchy = getApprovalHierarchy(type);
    const firstApprover = hierarchy[0];

    const insertResult = await pool.query(
      `INSERT INTO requests (
        id, requester_id, requester_name, department, request_type, files,
        status, current_approver, approval_history, rejection_reason,
        is_revised, revision_count, previous_versions
      ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9::jsonb, $10, $11, $12, $13::jsonb)
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
        false,
        0,
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
      rejectionReason: row.rejection_reason,
      createdAt: row.created_at,
      requesterGroupId: requesterGroupId,
      requesterId: row.requester_id,
      isRevised: row.is_revised || false,
      revisionCount: row.revision_count || 0,
      previousVersions: [],
    };

    if (row.request_type === 'FILE_TRANSFER') {
      request.files = filesData;
    } else if (row.request_type === 'BACKUP') {
      request.backups = filesData;
    } else if (row.request_type === 'VDI' || row.request_type === 'VDI_OPEN') {
      request.vdis = filesData;
    } else if (row.request_type === 'TAPE') {
      request.tapes = filesData;
    } else if (row.request_type === 'USB_PORT') {
      request.usbPorts = filesData;
    } else if (row.request_type === 'APP_INSTALL') {
      request.appInstalls = filesData;
    } else if (row.request_type === 'SERVER_RESTART') {
      request.serverRestarts = filesData;
    } else if (row.request_type === 'VIDEO_CONFRENCE') {
      request.videoConferences = filesData;
    }

    res.status(201).json(request);
  } catch (error: any) {
    console.error('Create request error:', error);
    
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

// Cancel request - فقط توسط requester
router.put('/:id/cancel', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const requestId = req.params.id;

    const requestResult = await pool.query(
      'SELECT * FROM requests WHERE id = $1',
      [requestId]
    );

    if (requestResult.rows.length === 0) {
      return res.status(404).json({ error: 'درخواست یافت نشد' });
    }

    const request = requestResult.rows[0];

    // فقط requester می‌تواند درخواست را لغو کند
    if (request.requester_id !== userId) {
      return res.status(403).json({ error: 'فقط درخواست‌دهنده می‌تواند درخواست را لغو کند' });
    }

    // اگر درخواست COMPLETED شده باشد، نمی‌توان لغو کرد
    if (request.status === 'COMPLETED') {
      return res.status(400).json({ error: 'درخواست تکمیل شده قابل لغو نیست' });
    }

    // اگر قبلاً لغو شده باشد
    if (request.status === 'CANCELLED') {
      return res.status(400).json({ error: 'این درخواست قبلاً لغو شده است' });
    }

    const updateResult = await pool.query(
      `UPDATE requests 
       SET status = 'CANCELLED', 
           current_approver = NULL
       WHERE id = $1
       RETURNING *`,
      [requestId]
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
      requesterId: updatedRequest.requester_id,
    };

    if (updatedRequest.request_type === 'FILE_TRANSFER') {
      result.files = filesData;
    } else if (updatedRequest.request_type === 'BACKUP') {
      result.backups = filesData;
    } else if (updatedRequest.request_type === 'VDI' || updatedRequest.request_type === 'VDI_OPEN') {
      result.vdis = filesData;
    } else if (updatedRequest.request_type === 'TAPE') {
      result.tapes = filesData;
    } else if (updatedRequest.request_type === 'USB_PORT') {
      result.usbPorts = filesData;
    } else if (updatedRequest.request_type === 'APP_INSTALL') {
      result.appInstalls = filesData;
    } else if (updatedRequest.request_type === 'SERVER_RESTART') {
      result.serverRestarts = filesData;
    } else if (updatedRequest.request_type === 'VIDEO_CONFRENCE') {
      result.videoConferences = filesData;
    }

    res.json(result);
  } catch (error: any) {
    console.error('Cancel request error:', error);
    res.status(500).json({ error: 'خطا در لغو درخواست' });
  }
});

// Revise request - فقط توسط requester برای درخواست‌های REJECTED
router.put('/:id/revise', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const requestId = req.params.id;
    const { type, files, backups, vdis, tapes, usbPorts, appInstalls, serverRestarts, videoConferences } = req.body;

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
    } else if (type === 'TAPE') {
      if (!tapes || !Array.isArray(tapes) || tapes.length === 0) {
        return res.status(400).json({ error: 'حداقل یک مشخصات Tape الزامی است' });
      }
      dataToStore = tapes;
    } else if (type === 'USB_PORT') {
      if (!usbPorts || !Array.isArray(usbPorts) || usbPorts.length === 0) {
        return res.status(400).json({ error: 'حداقل یک مشخصات USB Port الزامی است' });
      }
      dataToStore = usbPorts;
    } else if (type === 'APP_INSTALL') {
      if (!appInstalls || !Array.isArray(appInstalls) || appInstalls.length === 0) {
        return res.status(400).json({ error: 'حداقل یک مشخصات نصب برنامه الزامی است' });
      }
      dataToStore = appInstalls;
    } else if (type === 'SERVER_RESTART') {
      if (!serverRestarts || !Array.isArray(serverRestarts) || serverRestarts.length === 0) {
        return res.status(400).json({ error: 'حداقل یک مشخصات ریستارت سرور الزامی است' });
      }
      for (const item of serverRestarts) {
        if (!item.serverIP || !String(item.serverIP).trim()) {
          return res.status(400).json({ error: 'IP سرور الزامی است' });
        }
        if (!item.isUrgent && (!item.restartTime || !String(item.restartTime).trim())) {
          return res.status(400).json({ error: 'ساعت ریستارت الزامی است مگر اینکه گزینه فوری انتخاب شده باشد' });
        }
      }
      dataToStore = serverRestarts;
    } else if (type === 'VIDEO_CONFRENCE') {
      if (!videoConferences || !Array.isArray(videoConferences) || videoConferences.length === 0) {
        return res.status(400).json({ error: 'حداقل یک ردیف ویدئو کنفرانس الزامی است' });
      }
      dataToStore = videoConferences;
    }

    const requestResult = await pool.query(
      'SELECT * FROM requests WHERE id = $1',
      [requestId]
    );

    if (requestResult.rows.length === 0) {
      return res.status(404).json({ error: 'درخواست یافت نشد' });
    }

    const request = requestResult.rows[0];

    const reviserRoleResult = await pool.query('SELECT role FROM req_users WHERE id = $1', [userId]);
    const reviserRole = reviserRoleResult.rows[0]?.role;
    if (reviserRole === 'V_REQUESTER' && type !== 'VIDEO_CONFRENCE') {
      return res.status(403).json({ error: 'فقط درخواست ویدئو کنفرانس برای این نقش مجاز است' });
    }

    // فقط requester می‌تواند درخواست را اصلاح کند
    if (request.requester_id !== userId) {
      return res.status(403).json({ error: 'فقط درخواست‌دهنده می‌تواند درخواست را اصلاح کند' });
    }

    // فقط درخواست‌های REJECTED قابل اصلاح هستند
    if (request.status !== 'REJECTED') {
      return res.status(400).json({ error: 'فقط درخواست‌های رد شده قابل اصلاح هستند' });
    }

    // ذخیره approval history فعلی در previous_versions
    let previousVersions = request.previous_versions 
      ? (typeof request.previous_versions === 'string' ? JSON.parse(request.previous_versions) : request.previous_versions)
      : [];

    const currentApprovalHistory = typeof request.approval_history === 'string'
      ? JSON.parse(request.approval_history)
      : (Array.isArray(request.approval_history) ? request.approval_history : []);

    // علامت‌گذاری approval history فعلی به عنوان نسخه قبلی
    const markedHistory = currentApprovalHistory.map((approval: any) => ({
      ...approval,
      isFromPreviousVersion: true
    }));

    previousVersions.push(markedHistory);

    // شروع مجدد فرآیند تایید
    const hierarchy = getApprovalHierarchy(type);
    const firstApprover = hierarchy[0];

    const updateResult = await pool.query(
      `UPDATE requests 
       SET files = $1::jsonb,
           status = 'PENDING',
           current_approver = $2,
           approval_history = '[]'::jsonb,
           rejection_reason = NULL,
           is_revised = TRUE,
           revision_count = revision_count + 1,
           previous_versions = $3::jsonb,
           request_type = $4
       WHERE id = $5
       RETURNING *`,
      [
        JSON.stringify(dataToStore),
        firstApprover,
        JSON.stringify(previousVersions),
        type,
        requestId
      ]
    );

    const updatedRequest = updateResult.rows[0];
    
    const filesData = updatedRequest.files ? (typeof updatedRequest.files === 'string' ? JSON.parse(updatedRequest.files) : updatedRequest.files) : null;
    const approvalHistoryData = typeof updatedRequest.approval_history === 'string'
      ? JSON.parse(updatedRequest.approval_history)
      : (Array.isArray(updatedRequest.approval_history) ? updatedRequest.approval_history : []);

    const previousVersionsData = updatedRequest.previous_versions 
      ? (typeof updatedRequest.previous_versions === 'string' ? JSON.parse(updatedRequest.previous_versions) : updatedRequest.previous_versions)
      : [];

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
      requesterId: updatedRequest.requester_id,
      isRevised: updatedRequest.is_revised || false,
      revisionCount: updatedRequest.revision_count || 0,
      previousVersions: previousVersionsData,
    };

    if (updatedRequest.request_type === 'FILE_TRANSFER') {
      result.files = filesData;
    } else if (updatedRequest.request_type === 'BACKUP') {
      result.backups = filesData;
    } else if (updatedRequest.request_type === 'VDI' || updatedRequest.request_type === 'VDI_OPEN') {
      result.vdis = filesData;
    } else if (updatedRequest.request_type === 'TAPE') {
      result.tapes = filesData;
    } else if (updatedRequest.request_type === 'USB_PORT') {
      result.usbPorts = filesData;
    } else if (updatedRequest.request_type === 'APP_INSTALL') {
      result.appInstalls = filesData;
    } else if (updatedRequest.request_type === 'SERVER_RESTART') {
      result.serverRestarts = filesData;
    } else if (updatedRequest.request_type === 'VIDEO_CONFRENCE') {
      result.videoConferences = filesData;
    }

    res.json(result);
  } catch (error: any) {
    console.error('Revise request error:', error);
    res.status(500).json({ error: 'خطا در اصلاح درخواست' });
  }
});

// Approve request
router.put('/:id/approve', authenticateToken, async (req: Request, res: Response) => {
  const { approvalNote, conferenceRoom } = req.body;
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

    const newApproval: any = {
      approverRole: user.role,
      approverName: user.name,
      status: isLast ? 'COMPLETED' : 'APPROVED',
      date: new Date().toISOString(),
    };
    
    if (request.request_type === 'VIDEO_CONFRENCE') {
      const room =
        conferenceRoom !== undefined && conferenceRoom !== null
          ? String(conferenceRoom).trim()
          : '';
      if (!room) {
        return res.status(400).json({ error: 'برای تأیید درخواست ویدئو کنفرانس، شماره اتاق الزامی است' });
      }
      newApproval.conferenceRoom = room;
    }

    if (approvalNote && approvalNote.trim()) {
      newApproval.approvalNote = approvalNote.trim();
    }

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

    const previousVersionsData = updatedRequest.previous_versions 
      ? (typeof updatedRequest.previous_versions === 'string' ? JSON.parse(updatedRequest.previous_versions) : updatedRequest.previous_versions)
      : [];

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
      requesterId: updatedRequest.requester_id,
      isRevised: updatedRequest.is_revised || false,
      revisionCount: updatedRequest.revision_count || 0,
      previousVersions: previousVersionsData,
    };

    if (updatedRequest.request_type === 'FILE_TRANSFER') {
      result.files = filesData;
    } else if (updatedRequest.request_type === 'BACKUP') {
      result.backups = filesData;
    } else if (updatedRequest.request_type === 'VDI' || updatedRequest.request_type === 'VDI_OPEN') {
      result.vdis = filesData;
    } else if (updatedRequest.request_type === 'TAPE') {
      result.tapes = filesData;
    } else if (updatedRequest.request_type === 'USB_PORT') {
      result.usbPorts = filesData;
    } else if (updatedRequest.request_type === 'APP_INSTALL') {
      result.appInstalls = filesData;
    } else if (updatedRequest.request_type === 'SERVER_RESTART') {
      result.serverRestarts = filesData;
    } else if (updatedRequest.request_type === 'VIDEO_CONFRENCE') {
      result.videoConferences = filesData;
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

    const previousVersionsData = updatedRequest.previous_versions 
      ? (typeof updatedRequest.previous_versions === 'string' ? JSON.parse(updatedRequest.previous_versions) : updatedRequest.previous_versions)
      : [];

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
      requesterId: updatedRequest.requester_id,
      isRevised: updatedRequest.is_revised || false,
      revisionCount: updatedRequest.revision_count || 0,
      previousVersions: previousVersionsData,
    };

    if (updatedRequest.request_type === 'FILE_TRANSFER') {
      result.files = filesData;
    } else if (updatedRequest.request_type === 'BACKUP') {
      result.backups = filesData;
    } else if (updatedRequest.request_type === 'VDI' || updatedRequest.request_type === 'VDI_OPEN') {
      result.vdis = filesData;
    } else if (updatedRequest.request_type === 'TAPE') {
      result.tapes = filesData;
    } else if (updatedRequest.request_type === 'USB_PORT') {
      result.usbPorts = filesData;
    } else if (updatedRequest.request_type === 'APP_INSTALL') {
      result.appInstalls = filesData;
    } else if (updatedRequest.request_type === 'SERVER_RESTART') {
      result.serverRestarts = filesData;
    } else if (updatedRequest.request_type === 'VIDEO_CONFRENCE') {
      result.videoConferences = filesData;
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