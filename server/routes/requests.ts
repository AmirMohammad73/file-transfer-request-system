import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { pool } from '../index';
import { authenticateToken } from '../middleware/auth';
import { getClientIp, ipsMatch } from '../utils/clientIp';

const router = express.Router();

const AUTO_APPROVAL_NAME = 'تایید خودکار';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── پیکربندی multer برای آپلود فایل ─────────────────────────────────────────
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // اصلاح انکودینگ نام فایل: multer/busboy به‌صورت پیش‌فرض هدر نام فایل را
    // با latin1 می‌خواند درحالی‌که مرورگر آن را با UTF-8 ارسال می‌کند؛
    // همین باعث به‌هم‌ریختن نام فایل‌های غیرانگلیسی (مثلاً فارسی) می‌شود.
    file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const requestId = req.params.id;
    const fileId = req.params.fileId;
    const ext = path.extname(file.originalname);
    const uniqueName = `${requestId}-${fileId}-${Date.now()}${ext}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 1024 * 1024 * 1024, // 1 گیگابایت
  },
  fileFilter: (_req, file, cb) => {
    // تمام فایل‌ها مجاز هستند
    cb(null, true);
  },
});

const EXPIRY_HOURS = 96; // ۹۶ ساعت

const VALID_LETTER_FOLLOWUP_SUBJECTS = [
  'NEW_SERVER',
  'CREATE_VDI',
  'VDI_ACCESS',
  'REMOVE_SERVER',
  'REMOVE_VDI_ACCESS',
  'CHANGE_RESOURCES',
  'CREATE_TUNNEL',
  // مقادیر قدیمی — برای درخواست‌های ثبت‌شده پیش از تغییر گزینه‌ها
  'ADD_SERVER',
  'ADD_VDI',
  'REMOVE_VDI',
  'INCREASE_RESOURCES',
];

function validateLetterFollowups(letterFollowups: unknown): string | null {
  if (!letterFollowups || !Array.isArray(letterFollowups) || letterFollowups.length === 0) {
    return 'حداقل یک ردیف پیگیری نامه الزامی است';
  }
  for (const item of letterFollowups) {
    if (!item.letterNumber || !String(item.letterNumber).trim()) {
      return 'شماره نامه الزامی است';
    }
    if (!item.letterSubject || !VALID_LETTER_FOLLOWUP_SUBJECTS.includes(String(item.letterSubject))) {
      return 'موضوع نامه الزامی است';
    }
  }
  return null;
}

function buildLetterFollowupAutoApprovals(): object[] {
  const now = new Date().toISOString();
  return [
    {
      approverRole: 'GROUP_LEAD',
      approverName: AUTO_APPROVAL_NAME,
      status: 'APPROVED',
      date: now,
      isAutoApproved: true,
    },
    {
      approverRole: 'DEPUTY',
      approverName: AUTO_APPROVAL_NAME,
      status: 'APPROVED',
      date: now,
      isAutoApproved: true,
    },
  ];
}

function getInitialApprovalState(requestType: string): { currentApprover: string; approvalHistory: object[] } {
  if (requestType === 'LETTER_FOLLOWUP') {
    return {
      currentApprover: 'NETWORK_HEAD',
      approvalHistory: buildLetterFollowupAutoApprovals(),
    };
  }
  const hierarchy = getApprovalHierarchy(requestType);
  return {
    currentApprover: hierarchy[0],
    approvalHistory: [],
  };
}

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

// Helper: map a DB row to a request object
function mapRowToRequest(row: any): any {
  const filesData = typeof row.files === 'string'
    ? JSON.parse(row.files)
    : (Array.isArray(row.files) ? row.files : null);

  const approvalHistoryData = typeof row.approval_history === 'string'
    ? JSON.parse(row.approval_history)
    : (Array.isArray(row.approval_history) ? row.approval_history : []);

  const previousVersionsData = row.previous_versions
    ? (typeof row.previous_versions === 'string' ? JSON.parse(row.previous_versions) : row.previous_versions)
    : [];

  // selectedServerId و selectedServerName از اولین آیتم JSONB خوانده می‌شوند
  const firstItem = Array.isArray(filesData) && filesData.length > 0 ? filesData[0] : null;
  const selectedServerId = firstItem?.selectedServerId || null;
  const selectedServerName = firstItem?.selectedServerName || null;
  // اطلاعات سامانه از ستون contractor در دیتابیس (از طریق join)
  const selectedServerContName = row.selected_server_cont_name || null;
  const selectedServerRepName = row.selected_server_rep_name || null;
  const selectedServerIP = row.selected_server_ip || null;
  const obj: any = {
    id: row.id,
    requesterName: row.requester_name,
    department: row.department,
    requestType: row.request_type,
    selectedServerId,
    selectedServerName,
    selectedServerContName,
    selectedServerRepName,
    selectedServerIP,
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
    notificationForUserId: row.notification_for_user_id || null,
    originalRequestId: row.original_request_id || null,
    isNotification: row.notification_for_user_id !== null,
  };

  if (row.request_type === 'FILE_TRANSFER') {
    obj.files = filesData;
  } else if (row.request_type === 'BACKUP') {
    obj.backups = filesData;
  } else if (row.request_type === 'VDI' || row.request_type === 'VDI_OPEN') {
    obj.vdis = filesData;
  } else if (row.request_type === 'TAPE') {
    obj.tapes = filesData;
  } else if (row.request_type === 'USB_PORT') {
    obj.usbPorts = filesData;
  } else if (row.request_type === 'APP_INSTALL') {
    obj.appInstalls = filesData;
  } else if (row.request_type === 'SERVER_RESTART') {
    obj.serverRestarts = filesData;
  } else if (row.request_type === 'VIDEO_CONFRENCE') {
    obj.videoConferences = filesData;
  } else if (row.request_type === 'LETTER_FOLLOWUP') {
    obj.letterFollowups = filesData;
  }

  return obj;
}

async function attachSelectedServerMetadata(
  selectedServerId: number | undefined | null,
  dataToStore: any[] | null
): Promise<{ data: any[] | null; selectedServerName: string | null }> {
  if (!selectedServerId || !dataToStore) {
    return { data: dataToStore, selectedServerName: null };
  }
  const serverResult = await pool.query(
    'SELECT system_name FROM contractor WHERE id = $1',
    [selectedServerId]
  );
  const selectedServerName = serverResult.rows[0]?.system_name || null;
  const data = dataToStore.map((item: any) => ({
    ...item,
    selectedServerId,
    selectedServerName,
  }));
  return { data, selectedServerName };
}

async function enrichRequestsWithServerNames(requests: any[]): Promise<any[]> {
  const idsNeedingName = [
    ...new Set(
      requests
        .filter((r) => r.selectedServerId && !r.selectedServerName)
        .map((r) => r.selectedServerId)
    ),
  ];
  if (idsNeedingName.length === 0) return requests;

  const result = await pool.query(
    'SELECT id, system_name FROM contractor WHERE id = ANY($1::int[])',
    [idsNeedingName]
  );
  const nameMap = new Map(result.rows.map((r) => [r.id, r.system_name]));

  return requests.map((r) => ({
    ...r,
    selectedServerName: r.selectedServerName || nameMap.get(r.selectedServerId) || null,
  }));
}

// Shared SELECT columns (بدون selected_server_id — داخل JSONB ذخیره می‌شود)
const REQUEST_SELECT = `
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
  r.notification_for_user_id,
  r.original_request_id,
  u.group_ids as requester_group_ids,
  -- اطلاعات سامانه از contractor (selectedServerId داخل JSONB است)
  CASE
    WHEN jsonb_array_length(r.files) > 0
     AND (r.files->0->>'selectedServerId') IS NOT NULL
    THEN (
      SELECT c.cont_name
      FROM contractor c
      WHERE c.id = (r.files->0->>'selectedServerId')::integer
      LIMIT 1
    )
    ELSE NULL
  END AS selected_server_cont_name,
  CASE
    WHEN jsonb_array_length(r.files) > 0
     AND (r.files->0->>'selectedServerId') IS NOT NULL
    THEN (
      SELECT c.rep_name1
      FROM contractor c
      WHERE c.id = (r.files->0->>'selectedServerId')::integer
      LIMIT 1
    )
    ELSE NULL
  END AS selected_server_rep_name,
  CASE
    WHEN jsonb_array_length(r.files) > 0
     AND (r.files->0->>'selectedServerId') IS NOT NULL
    THEN (
      SELECT br.ip::text
      FROM backup_resources br
      JOIN contractor c ON c.id = br.contractor_id
      WHERE c.id = (r.files->0->>'selectedServerId')::integer
      LIMIT 1
    )
    ELSE NULL
  END AS selected_server_ip
`;

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
      SELECT ${REQUEST_SELECT}
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
    res.json(await enrichRequestsWithServerNames(result.rows.map(mapRowToRequest)));
  } catch (error: any) {
    console.error('Get requests error:', error);
    res.status(500).json({ error: 'خطا در دریافت درخواست‌ها' });
  }
});

// Get rejected requests for requester
router.get('/rejected', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    const userResult = await pool.query('SELECT role FROM req_users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'کاربر یافت نشد' });

    const user = userResult.rows[0];
    if (user.role !== 'REQUESTER' && user.role !== 'V_REQUESTER') {
      return res.status(403).json({ error: 'فقط کاربران درخواست‌دهنده می‌توانند درخواست‌های رد شده را ببینند' });
    }

    const result = await pool.query(
      `SELECT ${REQUEST_SELECT}
       FROM requests r
       LEFT JOIN req_users u ON r.requester_id = u.id
       WHERE r.requester_id = $1 AND r.status = 'REJECTED'
       ORDER BY r.created_at DESC`,
      [userId]
    );

    res.json(await enrichRequestsWithServerNames(result.rows.map(mapRowToRequest)));
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
      SELECT ${REQUEST_SELECT}
      FROM requests r
      LEFT JOIN req_users u ON r.requester_id = u.id
      WHERE (
        -- اگر کاربر requester است، درخواست‌های CANCELLED را هم نشان بده
        (r.status != 'CANCELLED' OR (r.status = 'CANCELLED' AND r.requester_id = $${++paramCount}))
      ) AND (
    `;
    params.push(userId);

    // Condition 1: کاربر درخواست‌دهنده اصلی است
    conditions.push(`r.requester_id = $${++paramCount}`);
    params.push(userId);

    // Condition 2: کاربر در لیست approval history است
    conditions.push(`
      EXISTS (
        SELECT 1 FROM jsonb_array_elements(r.approval_history) AS elem
        WHERE elem->>'approverName' = $${++paramCount}
      )
    `);
    params.push(userName);

    // Condition 3: کاربر باید از درخواست اطلاع‌رسانی شده مطلع شود
    conditions.push(`r.notification_for_user_id = $${++paramCount}`);
    params.push(userId);

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
    res.json(await enrichRequestsWithServerNames(result.rows.map(mapRowToRequest)));
  } catch (error: any) {
    console.error('Get history error:', error);
    res.status(500).json({ error: 'خطا در دریافت تاریخچه' });
  }
});

// ─── دریافت آدرس IP فعلی کاربر (برای پرکردن خودکار مبدا در انتقال داخلی) ────
router.get('/my-ip', authenticateToken, async (req: Request, res: Response) => {
  try {
    const clientIp = getClientIp(req);
    res.json({ ip: clientIp });
  } catch (error: any) {
    console.error('Get my-ip error:', error);
    res.status(500).json({ error: 'خطا در دریافت آدرس IP' });
  }
});

// Get single request by ID
router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const requestId = req.params.id;

    const result = await pool.query(
      `SELECT ${REQUEST_SELECT}
       FROM requests r
       LEFT JOIN req_users u ON r.requester_id = u.id
       WHERE r.id = $1`,
      [requestId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'درخواست یافت نشد' });
    }

    const enriched = await enrichRequestsWithServerNames([mapRowToRequest(result.rows[0])]);
    res.json(enriched[0]);
  } catch (error: any) {
    console.error('Get request error:', error);
    res.status(500).json({ error: 'خطا در دریافت درخواست' });
  }
});

// Create new request
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { type, selectedServerId, files, backups, vdis, tapes, usbPorts, appInstalls, serverRestarts, videoConferences, letterFollowups, notifyUserIds } = req.body;

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
        if (!item.isUrgent) {
          const restartTime = String(item.restartTime || '').trim();
          if (!restartTime) {
            return res.status(400).json({ error: 'ساعت ریستارت الزامی است مگر اینکه گزینه فوری انتخاب شده باشد' });
          }
          if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(restartTime)) {
            return res.status(400).json({ error: 'ساعت ریستارت باید به صورت ۲۴ ساعته بین ۰۰:۰۰ و ۲۳:۵۹ باشد' });
          }
        }
        const description = String(item.description || '').trim();
        if (!description) {
          return res.status(400).json({ error: 'توضیحات الزامی است' });
        }
        if (description.length > 100) {
          return res.status(400).json({ error: 'توضیحات حداکثر ۱۰۰ کاراکتر مجاز است' });
        }
      }
      dataToStore = serverRestarts;
    } else if (type === 'VIDEO_CONFRENCE') {
      if (!videoConferences || !Array.isArray(videoConferences) || videoConferences.length === 0) {
        return res.status(400).json({ error: 'حداقل یک ردیف ویدئو کنفرانس الزامی است' });
      }
      dataToStore = videoConferences;
    } else if (type === 'LETTER_FOLLOWUP') {
      const letterFollowupError = validateLetterFollowups(letterFollowups);
      if (letterFollowupError) {
        return res.status(400).json({ error: letterFollowupError });
      }
      dataToStore = letterFollowups;
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

    const { currentApprover, approvalHistory } = getInitialApprovalState(type);

    // اضافه کردن selectedServerId و selectedServerName به هر آیتم در JSONB
    const { data: enrichedData, selectedServerName } = await attachSelectedServerMetadata(
      selectedServerId,
      dataToStore
    );
    dataToStore = enrichedData;

    // تعیین notification_for_user_id و original_request_id
    let notificationForUserId = null;
    let originalRequestId = null;
    
    // اگر notifyUserIds وجود دارد، اولین کاربر را به عنوان notification_for_user_id در نظر بگیر
    if (notifyUserIds && Array.isArray(notifyUserIds) && notifyUserIds.length > 0) {
      notificationForUserId = notifyUserIds[0];
      originalRequestId = requestId;
    }

    const insertResult = await pool.query(
      `INSERT INTO requests (
        id, requester_id, requester_name, department, request_type, files,
        status, current_approver, approval_history, rejection_reason,
        is_revised, revision_count, previous_versions,
        notification_for_user_id, original_request_id
      ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9::jsonb, $10, $11, $12, $13::jsonb, $14, $15)
      RETURNING *`,
      [
        requestId,
        userId,
        user.name,
        user.department,
        type,
        JSON.stringify(dataToStore),
        'PENDING',
        currentApprover,
        JSON.stringify(approvalHistory),
        null,
        false,
        0,
        '[]',
        notificationForUserId,
        originalRequestId
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
      selectedServerId: selectedServerId || null,
      selectedServerName,
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
      notificationForUserId: row.notification_for_user_id,
      originalRequestId: row.original_request_id,
      isNotification: row.notification_for_user_id !== null,
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
    } else if (row.request_type === 'LETTER_FOLLOWUP') {
      request.letterFollowups = filesData;
    }

    // حذف کد ایجاد رکوردهای کپی برای اطلاع‌رسانی
    // دیگر نیازی به ایجاد رکوردهای جداگانه برای اطلاع‌رسانی نیست

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
    } else if (updatedRequest.request_type === 'LETTER_FOLLOWUP') {
      result.letterFollowups = filesData;
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
    const { type, files, backups, vdis, tapes, usbPorts, appInstalls, serverRestarts, videoConferences, letterFollowups } = req.body;

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
        if (!item.isUrgent) {
          const restartTime = String(item.restartTime || '').trim();
          if (!restartTime) {
            return res.status(400).json({ error: 'ساعت ریستارت الزامی است مگر اینکه گزینه فوری انتخاب شده باشد' });
          }
          if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(restartTime)) {
            return res.status(400).json({ error: 'ساعت ریستارت باید به صورت ۲۴ ساعته بین ۰۰:۰۰ و ۲۳:۵۹ باشد' });
          }
        }
        const description = String(item.description || '').trim();
        if (!description) {
          return res.status(400).json({ error: 'توضیحات الزامی است' });
        }
        if (description.length > 100) {
          return res.status(400).json({ error: 'توضیحات حداکثر ۱۰۰ کاراکتر مجاز است' });
        }
      }
      dataToStore = serverRestarts;
    } else if (type === 'VIDEO_CONFRENCE') {
      if (!videoConferences || !Array.isArray(videoConferences) || videoConferences.length === 0) {
        return res.status(400).json({ error: 'حداقل یک ردیف ویدئو کنفرانس الزامی است' });
      }
      dataToStore = videoConferences;
    } else if (type === 'LETTER_FOLLOWUP') {
      const letterFollowupError = validateLetterFollowups(letterFollowups);
      if (letterFollowupError) {
        return res.status(400).json({ error: letterFollowupError });
      }
      dataToStore = letterFollowups;
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

    const { currentApprover, approvalHistory } = getInitialApprovalState(type);

    const updateResult = await pool.query(
      `UPDATE requests 
       SET files = $1::jsonb,
           status = 'PENDING',
           current_approver = $2,
           approval_history = $3::jsonb,
           rejection_reason = NULL,
           is_revised = TRUE,
           revision_count = revision_count + 1,
           previous_versions = $4::jsonb,
           request_type = $5
       WHERE id = $6
       RETURNING *`,
      [
        JSON.stringify(dataToStore),
        currentApprover,
        JSON.stringify(approvalHistory),
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
    } else if (updatedRequest.request_type === 'LETTER_FOLLOWUP') {
      result.letterFollowups = filesData;
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

    // بررسی آیا این انتقال فایل درون‌سامانه‌ای است (فایل آپلود شده + هر دو IP در یک سامانه)
    let isSameSystemFileTransfer = false;
    if (request.request_type === 'FILE_TRANSFER' && user.role === 'DEPUTY') {
      let files: any[] = [];
      if (typeof request.files === 'string') {
        files = JSON.parse(request.files);
      } else if (Array.isArray(request.files)) {
        files = request.files;
      }
      const hasUploadedFile = files.some((f: any) => f.uploadedFile && !f.uploadedFile.isDownloaded);
      if (hasUploadedFile) {
        const srcIp = files[0]?.sourceIP;
        const dstIp = files[0]?.destinationIP;
        isSameSystemFileTransfer = await areIpsInSameSystem(srcIp, dstIp);
      }
    }

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

    // اگر انتقال فایل درون‌سامانه‌ای باشد و مدیرکل/معاون تایید کرده باشد، مراحل شبکه خودکار تایید می‌شوند
    let finalStatus = isLast ? 'COMPLETED' : 'PENDING';
    let nextApprover = isLast ? null : hierarchy[currentIndex + 1];

    if (isSameSystemFileTransfer) {
      // تایید خودکار NETWORK_HEAD و NETWORK_ADMIN
      const autoApprovals = buildSameSystemAutoApprovals();
      for (const autoApproval of autoApprovals) {
        approvalHistory.push(autoApproval);
      }
      finalStatus = 'COMPLETED';
      nextApprover = null;
    }

    const updateResult = await pool.query(
      `UPDATE requests 
       SET status = $1, 
           current_approver = $2, 
           approval_history = $3::jsonb
       WHERE id = $4
       RETURNING *`,
      [
        finalStatus,
        nextApprover,
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
    } else if (updatedRequest.request_type === 'LETTER_FOLLOWUP') {
      result.letterFollowups = filesData;
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
    } else if (updatedRequest.request_type === 'LETTER_FOLLOWUP') {
      result.letterFollowups = filesData;
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

// ─── بررسی آیا هر دو IP در یک سامانه هستند ────────────────────────────────────
async function areIpsInSameSystem(ip1: string, ip2: string): Promise<boolean> {
  if (!ip1 || !ip2) return false;
  const result = await pool.query(
    `SELECT br1.contractor_id as id1, br2.contractor_id as id2
     FROM backup_resources br1, backup_resources br2
     WHERE host(br1.ip) = $1 AND host(br2.ip) = $2
     LIMIT 1`,
    [ip1, ip2]
  );
  if (result.rows.length === 0) return false;
  const { id1, id2 } = result.rows[0];
  return id1 !== null && id2 !== null && id1 === id2;
}

// ─── تایید خودکار مراحل شبکه برای انتقال درون‌سامانه‌ای ───────────────────────
function buildSameSystemAutoApprovals(): object[] {
  const now = new Date().toISOString();
  return [
    {
      approverRole: 'NETWORK_HEAD',
      approverName: AUTO_APPROVAL_NAME,
      status: 'APPROVED',
      date: now,
      isAutoApproved: true,
    },
    {
      approverRole: 'NETWORK_ADMIN',
      approverName: AUTO_APPROVAL_NAME,
      status: 'COMPLETED',
      date: now,
      isAutoApproved: true,
    },
  ];
}

// ─── آپلود فایل برای درخواست انتقال فایل ──────────────────────────────────────
router.post('/:id/upload/:fileId', authenticateToken, (req: Request, res: Response) => {
  upload.single('file')(req, res, async (err) => {
    try {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'حجم فایل نباید بیشتر از ۱ گیگابایت باشد' });
        }
        return res.status(400).json({ error: `خطا در آپلود فایل: ${err.message}` });
      }
      if (err) {
        return res.status(500).json({ error: `خطا در آپلود فایل: ${err.message}` });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'فایلی ارسال نشده است' });
      }

      const userId = (req as any).userId;
      const requestId = req.params.id;
      const fileId = req.params.fileId;

      // بررسی وجود درخواست
      const requestResult = await pool.query('SELECT * FROM requests WHERE id = $1', [requestId]);
      if (requestResult.rows.length === 0) {
        // حذف فایل آپلود شده
        fs.unlinkSync(req.file.path);
        return res.status(404).json({ error: 'درخواست یافت نشد' });
      }

      const request = requestResult.rows[0];

      // فقط درخواست‌دهنده می‌تواند فایل آپلود کند
      if (request.requester_id !== userId) {
        fs.unlinkSync(req.file.path);
        return res.status(403).json({ error: 'فقط درخواست‌دهنده می‌تواند فایل آپلود کند' });
      }

      // بررسی نوع درخواست
      if (request.request_type !== 'FILE_TRANSFER') {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: 'آپلود فایل فقط برای درخواست انتقال فایل مجاز است' });
      }

      // خواندن اطلاعات فایل‌ها از JSONB
      let files: any[] = [];
      if (typeof request.files === 'string') {
        files = JSON.parse(request.files);
      } else if (Array.isArray(request.files)) {
        files = request.files;
      }

      const fileIndex = files.findIndex((f: any) => f.id === fileId);
      if (fileIndex === -1) {
        fs.unlinkSync(req.file.path);
        return res.status(404).json({ error: 'فایل مورد نظر یافت نشد' });
      }

      const fileDetail = files[fileIndex];

      // بررسی اینکه آیا هر دو IP در یک سامانه هستند
      const sameSystem = await areIpsInSameSystem(fileDetail.sourceIP, fileDetail.destinationIP);
      if (!sameSystem) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: 'آپلود فایل فقط برای انتقال بین سرورهای یک سامانه مجاز است' });
      }

      // محاسبه زمان انقضا (۹۶ ساعت)
      const expiresAt = new Date(Date.now() + EXPIRY_HOURS * 60 * 60 * 1000);

      // ذخیره اطلاعات در دیتابیس
      const insertResult = await pool.query(
        `INSERT INTO file_uploads (request_id, file_id, original_filename, stored_filename, file_size, uploader_id, destination_ip, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          requestId,
          fileId,
          req.file.originalname,
          req.file.filename,
          req.file.size,
          userId,
          fileDetail.destinationIP,
          expiresAt.toISOString(),
        ]
      );

      const uploadRecord = insertResult.rows[0];

      // به‌روزرسانی اطلاعات فایل در JSONB درخواست
      files[fileIndex].uploadedFile = {
        uploadId: uploadRecord.id,
        originalFilename: req.file.originalname,
        storedFilename: req.file.filename,
        fileSize: req.file.size,
        uploadedAt: uploadRecord.uploaded_at,
        expiresAt: expiresAt.toISOString(),
        isDownloaded: false,
      };

      await pool.query(
        'UPDATE requests SET files = $1::jsonb WHERE id = $2',
        [JSON.stringify(files), requestId]
      );

      res.status(201).json({
        message: 'فایل با موفقیت آپلود شد',
        uploadedFile: files[fileIndex].uploadedFile,
      });
    } catch (error: any) {
      console.error('Upload file error:', error);
      // تلاش برای حذف فایل در صورت خطا
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ error: 'خطا در آپلود فایل' });
    }
  });
});

// ─── دانلود فایل آپلود شده ───────────────────────────────────────────────────
router.get('/:id/download/:fileId', authenticateToken, async (req: Request, res: Response) => {
  try {
    console.log('درخواست دانلود دریافت شد:', req.params.id, req.params.fileId);
    
    const userId = (req as any).userId;
    const requestId = req.params.id;
    const fileId = req.params.fileId;

    // بررسی وجود درخواست
    const requestResult = await pool.query('SELECT * FROM requests WHERE id = $1', [requestId]);
    if (requestResult.rows.length === 0) {
      console.log('درخواست یافت نشد:', requestId);
      return res.status(404).json({ error: 'درخواست یافت نشد' });
    }

    const request = requestResult.rows[0];
    console.log('درخواست یافت شد:', request.id, 'requester_id:', request.requester_id, 'userId:', userId);

    // فقط درخواست‌دهنده می‌تواند فایل را دانلود کند
    if (request.requester_id !== userId) {
      console.log('دسترسی غیرمجاز: کاربر درخواست‌دهنده نیست');
      return res.status(403).json({ error: 'فقط درخواست‌دهنده می‌تواند فایل را دانلود کند' });
    }

    // بررسی نوع درخواست
    if (request.request_type !== 'FILE_TRANSFER') {
      console.log('نوع درخواست اشتباه:', request.request_type);
      return res.status(400).json({ error: 'دانلود فایل فقط برای درخواست انتقال فایل مجاز است' });
    }

    // خواندن اطلاعات فایل‌ها
    let files: any[] = [];
    if (typeof request.files === 'string') {
      files = JSON.parse(request.files);
    } else if (Array.isArray(request.files)) {
      files = request.files;
    }

    const fileDetail = files.find((f: any) => f.id === fileId);
    if (!fileDetail) {
      console.log('فایل در درخواست یافت نشد:', fileId);
      return res.status(404).json({ error: 'فایل مورد نظر یافت نشد' });
    }

    console.log('فایل یافت شد:', fileDetail);

    // بررسی وجود اطلاعات آپلود
    if (!fileDetail.uploadedFile) {
      console.log('اطلاعات آپلود وجود ندارد');
      return res.status(400).json({ error: 'فایلی برای این درخواست آپلود نشده است' });
    }

    console.log('اطلاعات آپلود:', fileDetail.uploadedFile);

    // بررسی اینکه آیا قبلاً دانلود شده
    if (fileDetail.uploadedFile.isDownloaded) {
      console.log('فایل قبلاً دانلود شده است');
      return res.status(400).json({ error: 'این فایل قبلاً دانلود شده است' });
    }

    // بررسی انقضا
    const expiresAt = new Date(fileDetail.uploadedFile.expiresAt);
    const now = new Date();
    console.log('تاریخ انقضا:', expiresAt, 'زمان فعلی:', now);
    if (now > expiresAt) {
      console.log('فایل منقضی شده است');
      return res.status(400).json({ error: 'فایل منقضی شده و قابل دانلود نیست' });
    }

    // بررسی تایید مدیرکل/معاون (باید تایید شده باشد)
    let approvalHistory: any[] = [];
    if (request.approval_history) {
      if (typeof request.approval_history === 'string') {
        approvalHistory = JSON.parse(request.approval_history);
      } else if (Array.isArray(request.approval_history)) {
        approvalHistory = request.approval_history;
      }
    }

    const deputyApproved = approvalHistory.some(
      (a: any) => a.approverRole === 'DEPUTY' && (a.status === 'APPROVED' || a.status === 'COMPLETED')
    );
    console.log('آیا DEPUTY تایید کرده؟', deputyApproved, 'تاریخچه:', approvalHistory);
    if (!deputyApproved) {
      console.log('DEPUTY تایید نکرده است');
      return res.status(400).json({ error: 'فایل پس از تایید مدیرکل/معاون قابل دانلود است' });
    }

    // بررسی IP مقصد - کلاینت باید از سرور مقصد وارد شده باشد
    const clientIp = getClientIp(req);
    console.log('IP کلاینت:', clientIp, 'IP مقصد:', fileDetail.destinationIP);
    const ipMatchResult = ipsMatch(clientIp, fileDetail.destinationIP);
    console.log('آیا IP ها تطابق دارند؟', ipMatchResult);
    
    if (!ipMatchResult) {
      console.log('IP تطابق ندارد');
      return res.status(403).json({ 
        error: 'فقط از سرور مقصد می‌توانید فایل را دانلود کنید',
        destinationIP: fileDetail.destinationIP,
        clientIP: clientIp,
      });
    }

    // مسیر فایل
    const filePath = path.join(uploadsDir, fileDetail.uploadedFile.storedFilename);
    console.log('مسیر فایل:', filePath, 'وجود دارد؟', fs.existsSync(filePath));
    if (!fs.existsSync(filePath)) {
      console.log('فایل روی دیسک یافت نشد');
      return res.status(404).json({ error: 'فایل روی سرور یافت نشد' });
    }

    // علامت‌گذاری به عنوان دانلود شده قبل از ارسال فایل
    fileDetail.uploadedFile.isDownloaded = true;
    console.log('در حال بروزرسانی وضعیت دانلود در دیتابیس...');
    await pool.query(
      'UPDATE requests SET files = $1::jsonb WHERE id = $2',
      [JSON.stringify(files), requestId]
    );

    await pool.query(
      `UPDATE file_uploads SET is_downloaded = TRUE, downloaded_at = NOW() WHERE request_id = $1 AND file_id = $2`,
      [requestId, fileId]
    );

    // ارسال فایل با هدرهای مناسب
    const originalName = fileDetail.uploadedFile.originalFilename || 'file';
    console.log('نام اصلی فایل:', originalName);
    
    // تنظیم هدر Content-Disposition برای پشتیبانی از نام‌های فارسی
    const contentDisposition = `attachment; filename="${encodeURIComponent(originalName)}"`;
    console.log('Content-Disposition:', contentDisposition);
    
    // تنظیم هدرها
    res.setHeader('Content-Disposition', contentDisposition);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    
    console.log('در حال ارسال فایل...');
    // ارسال فایل
    res.sendFile(filePath, (err) => {
      if (err) {
        console.error('خطا در ارسال فایل:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'خطا در دانلود فایل' });
        }
      } else {
        console.log('فایل با موفقیت ارسال شد');
        // حذف فایل پس از ارسال کامل
        setTimeout(() => {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`حذف فایل پس از دانلود: ${fileDetail.uploadedFile.storedFilename}`);
          }
        }, 5000);
      }
    });
  } catch (error: any) {
    console.error('Download file error:', error);
    res.status(500).json({ error: 'خطا در دانلود فایل' });
  }
});

// ─── بررسی وضعیت آپلود فایل ──────────────────────────────────────────────────
router.get('/:id/upload-status/:fileId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const requestId = req.params.id;
    const fileId = req.params.fileId;

    const requestResult = await pool.query('SELECT * FROM requests WHERE id = $1', [requestId]);
    if (requestResult.rows.length === 0) {
      return res.status(404).json({ error: 'درخواست یافت نشد' });
    }

    const request = requestResult.rows[0];

    let files: any[] = [];
    if (typeof request.files === 'string') {
      files = JSON.parse(request.files);
    } else if (Array.isArray(request.files)) {
      files = request.files;
    }

    const fileDetail = files.find((f: any) => f.id === fileId);
    if (!fileDetail) {
      return res.status(404).json({ error: 'فایل مورد نظر یافت نشد' });
    }

    // بررسی آیا هر دو IP در یک سامانه هستند
    const sameSystem = await areIpsInSameSystem(fileDetail.sourceIP, fileDetail.destinationIP);

    res.json({
      hasUpload: !!fileDetail.uploadedFile,
      isSameSystem: sameSystem,
      uploadedFile: fileDetail.uploadedFile || null,
      canUpload: sameSystem && !fileDetail.uploadedFile,
    });
  } catch (error: any) {
    console.error('Get upload status error:', error);
    res.status(500).json({ error: 'خطا در بررسی وضعیت آپلود' });
  }
});

export default router;
