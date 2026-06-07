import express, { Request, Response } from 'express';
import { pool } from '../index';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// ─── Helper: ساخت آبجکت Contractor از ردیف‌های DB ────────────────────────────
function buildContractors(rows: any[]): any[] {
  const map = new Map<number, any>();
  for (const row of rows) {
    if (!map.has(row.c_id)) {
      map.set(row.c_id, {
        id: row.c_id,
        systemName: row.c_system_name,
        contName: row.c_cont_name,
        repName1: row.c_rep_name1,
        phone1: row.c_phone1,
        repName2: row.c_rep_name2,
        phone2: row.c_phone2,
        repName3: row.c_rep_name3,
        phone3: row.c_phone3,
        reqUserIds: row.c_req_user_ids || [],
        registeredByName: row.c_registered_by_name,
        registeredByDept: row.c_registered_by_dept,
        servers: [],
      });
    }
    if (row.s_id) {
      map.get(row.c_id).servers.push({
        id: row.s_id,
        ip: row.s_ip,
        vmname: row.s_vmname,
        url: row.s_url,
        type: row.s_type,
        backupOperator: row.s_backup_operator,
        backupPeriod: row.s_backup_period,
        contractorId: row.c_id,
      });
    }
  }
  return Array.from(map.values());
}

// ─── Shared SELECT ────────────────────────────────────────────────────────────
const CONTRACTOR_SELECT = `
  c.id             AS c_id,
  c.system_name    AS c_system_name,
  c.cont_name      AS c_cont_name,
  c.rep_name1      AS c_rep_name1,
  c.phone1         AS c_phone1,
  c.rep_name2      AS c_rep_name2,
  c.phone2         AS c_phone2,
  c.rep_name3      AS c_rep_name3,
  c.phone3         AS c_phone3,
  c.req_user_ids   AS c_req_user_ids,
  u.name           AS c_registered_by_name,
  u.department     AS c_registered_by_dept,
  br.id            AS s_id,
  br.ip            AS s_ip,
  br.vmname        AS s_vmname,
  br.url           AS s_url,
  br.type          AS s_type,
  br.backup_operator AS s_backup_operator,
  br.backup_period   AS s_backup_period
`;

// ─── Helper: بررسی دسترسی کاربر به سامانه ────────────────────────────────────
// کاربر دسترسی دارد اگر:
// 1. خودش ثبت‌کننده باشد (userId در req_user_ids)
// 2. در گروه {0} باشد (دسترسی کامل)
// 3. با ثبت‌کننده همگروه باشد (group_ids تقاطع داشته باشند)
async function buildAccessQuery(userId: number): Promise<{ whereClause: string; params: any[] }> {
  const userResult = await pool.query(
    'SELECT group_ids FROM req_users WHERE id = $1',
    [userId]
  );
  const userGroupIds: number[] = userResult.rows[0]?.group_ids || [];
  const isAdmin = userGroupIds.includes(0);

  if (isAdmin) {
    // دسترسی کامل — همه سامانه‌ها
    return { whereClause: '1=1', params: [] };
  }

  // دسترسی گروهی: سامانه‌هایی که ثبت‌کننده‌شان با این کاربر همگروه است
  // یا خود کاربر ثبت‌کننده است
  return {
    whereClause: `(
      c.req_user_ids @> $1::jsonb
      OR EXISTS (
        SELECT 1 FROM req_users ru
        WHERE ru.id = ANY(
          SELECT jsonb_array_elements_text(c.req_user_ids)::integer
        )
        AND ru.group_ids && $2::integer[]
      )
    )`,
    params: [JSON.stringify([userId]), userGroupIds],
  };
}

// ─── Helper: بررسی مجاز بودن ویرایش/حذف ─────────────────────────────────────
// فقط ثبت‌کننده یا کاربر با group_ids={0} می‌تواند ویرایش/حذف کند
async function canModify(userId: number, contractorId: number): Promise<boolean> {
  const userResult = await pool.query(
    'SELECT group_ids FROM req_users WHERE id = $1',
    [userId]
  );
  const userGroupIds: number[] = userResult.rows[0]?.group_ids || [];
  if (userGroupIds.includes(0)) return true;

  const ownerCheck = await pool.query(
    'SELECT id FROM contractor WHERE id = $1 AND req_user_ids @> $2::jsonb',
    [contractorId, JSON.stringify([userId])]
  );
  return ownerCheck.rows.length > 0;
}

// ─── GET /contractors ─────────────────────────────────────────────────────────
router.get('/contractors', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { whereClause, params } = await buildAccessQuery(userId);

    const result = await pool.query(
      `SELECT ${CONTRACTOR_SELECT}
       FROM contractor c
       LEFT JOIN backup_resources br ON br.contractor_id = c.id
       LEFT JOIN req_users u ON u.id = (
         SELECT jsonb_array_elements_text(c.req_user_ids)::integer LIMIT 1
       )
       WHERE ${whereClause}
       ORDER BY c.id DESC, br.id ASC`,
      params
    );
    res.json(buildContractors(result.rows));
  } catch (error: any) {
    console.error('Get contractors error:', error);
    res.status(500).json({ error: 'خطا در دریافت شناسنامه سامانه‌ها' });
  }
});

// ─── GET /dropdown ────────────────────────────────────────────────────────────
router.get('/dropdown', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { whereClause, params } = await buildAccessQuery(userId);

    const result = await pool.query(
      `SELECT ${CONTRACTOR_SELECT}
       FROM contractor c
       LEFT JOIN backup_resources br ON br.contractor_id = c.id
       LEFT JOIN req_users u ON u.id = (
         SELECT jsonb_array_elements_text(c.req_user_ids)::integer LIMIT 1
       )
       WHERE ${whereClause}
       ORDER BY c.id DESC, br.id ASC`,
      params
    );
    res.json(buildContractors(result.rows));
  } catch (error: any) {
    console.error('Get dropdown error:', error);
    res.status(500).json({ error: 'خطا در دریافت سامانه‌ها' });
  }
});

// ─── POST /contractors ────────────────────────────────────────────────────────
router.post('/contractors', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { systemName, contName, repName1, phone1, repName2, phone2, repName3, phone3 } = req.body;

    if (!systemName || !systemName.trim()) {
      return res.status(400).json({ error: 'نام سامانه اجباری است' });
    }
    if (!repName1 || !repName1.trim()) {
      return res.status(400).json({ error: 'حداقل یک نماینده اجباری است' });
    }
    if (!phone1 || !phone1.trim()) {
      return res.status(400).json({ error: 'شماره تماس نماینده اول اجباری است' });
    }

    // ── بررسی تکراری بودن نام سامانه ─────────────────────────────────────────
    const dupSystem = await pool.query(
      `SELECT id FROM contractor WHERE LOWER(system_name) = LOWER($1)`,
      [systemName.trim()]
    );
    if (dupSystem.rows.length > 0) {
      return res.status(409).json({
        error: `نام سامانه "${systemName.trim()}" قبلاً در سیستم ثبت شده است.`,
      });
    }

    const result = await pool.query(
      `INSERT INTO contractor
         (system_name, cont_name, rep_name1, phone1, rep_name2, phone2, rep_name3, phone3, req_user_ids)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
       RETURNING *`,
      [
        systemName.trim(),
        contName || null,
        repName1.trim(),
        phone1.trim(),
        repName2 || null,
        phone2 || null,
        repName3 || null,
        phone3 || null,
        JSON.stringify([userId]),
      ]
    );

    const row = result.rows[0];
    res.status(201).json({
      id: row.id,
      systemName: row.system_name,
      contName: row.cont_name,
      repName1: row.rep_name1,
      phone1: row.phone1,
      repName2: row.rep_name2,
      phone2: row.phone2,
      repName3: row.rep_name3,
      phone3: row.phone3,
      reqUserIds: row.req_user_ids || [],
      servers: [],
    });
  } catch (error: any) {
    console.error('Create contractor error:', error);
    res.status(500).json({ error: 'خطا در ایجاد شناسنامه سامانه' });
  }
});

// ─── PUT /contractors/:id ─────────────────────────────────────────────────────
router.put('/contractors/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const contractorId = parseInt(req.params.id, 10);
    const { systemName, contName, repName1, phone1, repName2, phone2, repName3, phone3 } = req.body;

    if (!systemName || !systemName.trim()) {
      return res.status(400).json({ error: 'نام سامانه اجباری است' });
    }
    if (!repName1 || !repName1.trim()) {
      return res.status(400).json({ error: 'حداقل یک نماینده اجباری است' });
    }
    if (!phone1 || !phone1.trim()) {
      return res.status(400).json({ error: 'شماره تماس نماینده اول اجباری است' });
    }

    if (!(await canModify(userId, contractorId))) {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }

    const result = await pool.query(
      `UPDATE contractor
       SET system_name = $1, cont_name = $2,
           rep_name1 = $3, phone1 = $4,
           rep_name2 = $5, phone2 = $6,
           rep_name3 = $7, phone3 = $8
       WHERE id = $9
       RETURNING *`,
      [
        systemName.trim(), contName || null,
        repName1.trim(), phone1.trim(),
        repName2 || null, phone2 || null,
        repName3 || null, phone3 || null,
        contractorId,
      ]
    );

    const row = result.rows[0];
    const serversResult = await pool.query(
      'SELECT * FROM backup_resources WHERE contractor_id = $1 ORDER BY id ASC',
      [contractorId]
    );

    res.json({
      id: row.id,
      systemName: row.system_name,
      contName: row.cont_name,
      repName1: row.rep_name1,
      phone1: row.phone1,
      repName2: row.rep_name2,
      phone2: row.phone2,
      repName3: row.rep_name3,
      phone3: row.phone3,
      reqUserIds: row.req_user_ids || [],
      servers: serversResult.rows.map(s => ({
        id: s.id, ip: s.ip, vmname: s.vmname, url: s.url,
        type: s.type, backupOperator: s.backup_operator,
        backupPeriod: s.backup_period, contractorId: s.contractor_id,
      })),
    });
  } catch (error: any) {
    console.error('Update contractor error:', error);
    res.status(500).json({ error: 'خطا در ویرایش شناسنامه سامانه' });
  }
});

// ─── DELETE /contractors/:id ──────────────────────────────────────────────────
router.delete('/contractors/:id', authenticateToken, async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const userId = (req as any).userId;
    const contractorId = parseInt(req.params.id, 10);

    if (!(await canModify(userId, contractorId))) {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }

    await client.query('BEGIN');
    await client.query('DELETE FROM backup_resources WHERE contractor_id = $1', [contractorId]);
    await client.query('DELETE FROM contractor WHERE id = $1', [contractorId]);
    await client.query('COMMIT');

    res.json({ message: 'شناسنامه سامانه با موفقیت حذف شد' });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Delete contractor error:', error);
    res.status(500).json({ error: 'خطا در حذف شناسنامه سامانه' });
  } finally {
    client.release();
  }
});

// ─── POST /contractors/:id/servers ───────────────────────────────────────────
router.post('/contractors/:id/servers', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const contractorId = parseInt(req.params.id, 10);
    const { ip, vmname, url, type, backupOperator, backupPeriod } = req.body;

    if (!ip || !ip.trim()) {
      return res.status(400).json({ error: 'آدرس IP اجباری است' });
    }
    const resolvedVmname = (vmname && vmname.trim()) ? vmname.trim() : ip.trim();

    if (!(await canModify(userId, contractorId))) {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }

    // ── بررسی تکراری بودن IP ──────────────────────────────────────────────────
    const dupIp = await pool.query(
      `SELECT br.id, c.system_name
       FROM backup_resources br
       JOIN contractor c ON c.id = br.contractor_id
       WHERE br.ip = $1::inet`,
      [ip.trim()]
    );
    if (dupIp.rows.length > 0) {
      const existingSystem = dupIp.rows[0].system_name || 'سامانه دیگری';
      return res.status(409).json({
        error: `آدرس IP "${ip.trim()}" قبلاً در سامانه "${existingSystem}" ثبت شده است.`,
      });
    }

    // ── بررسی تکراری بودن VMname ─────────────────────────────────────────────
    const dupVmname = await pool.query(
      `SELECT br.id, c.system_name
       FROM backup_resources br
       JOIN contractor c ON c.id = br.contractor_id
       WHERE LOWER(br.vmname) = LOWER($1)`,
      [resolvedVmname]
    );
    if (dupVmname.rows.length > 0) {
      const existingSystem = dupVmname.rows[0].system_name || 'سامانه دیگری';
      return res.status(409).json({
        error: `VMname "${resolvedVmname}" قبلاً در سامانه "${existingSystem}" ثبت شده است.`,
      });
    }

    // ── بررسی تکراری بودن system_name (نام سامانه) ───────────────────────────
    const contractorRow = await pool.query(
      'SELECT system_name FROM contractor WHERE id = $1',
      [contractorId]
    );
    const systemName = contractorRow.rows[0]?.system_name;
    if (systemName) {
      const dupSystem = await pool.query(
        `SELECT id FROM contractor WHERE LOWER(system_name) = LOWER($1) AND id != $2`,
        [systemName, contractorId]
      );
      if (dupSystem.rows.length > 0) {
        return res.status(409).json({
          error: `نام سامانه "${systemName}" قبلاً در سیستم ثبت شده است.`,
        });
      }
    }

    const result = await pool.query(
      `INSERT INTO backup_resources (ip, vmname, url, type, backup_operator, backup_period, contractor_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [ip.trim(), resolvedVmname, url || null, type || null, backupOperator || null, backupPeriod || null, contractorId]
    );

    const row = result.rows[0];
    res.status(201).json({
      id: row.id, ip: row.ip, vmname: row.vmname, url: row.url,
      type: row.type, backupOperator: row.backup_operator,
      backupPeriod: row.backup_period, contractorId: row.contractor_id,
    });
  } catch (error: any) {
    console.error('Add server error:', error);
    res.status(500).json({ error: 'خطا در افزودن سرور' });
  }
});

// ─── PUT /servers/:id ────────────────────────────────────────────────────────
router.put('/servers/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const serverId = parseInt(req.params.id, 10);
    const { ip, vmname, url, type, backupOperator, backupPeriod } = req.body;

    if (!ip || !ip.trim()) {
      return res.status(400).json({ error: 'آدرس IP اجباری است' });
    }
    const resolvedVmname = (vmname && vmname.trim()) ? vmname.trim() : ip.trim();

    // پیدا کردن contractor_id سرور
    const serverRow = await pool.query(
      'SELECT contractor_id FROM backup_resources WHERE id = $1',
      [serverId]
    );
    if (serverRow.rows.length === 0) {
      return res.status(404).json({ error: 'سرور یافت نشد' });
    }
    const contractorId = serverRow.rows[0].contractor_id;

    if (!(await canModify(userId, contractorId))) {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }

    // ── بررسی تکراری بودن IP (به جز خود رکورد) ──────────────────────────────
    const dupIp = await pool.query(
      `SELECT br.id, c.system_name
       FROM backup_resources br
       JOIN contractor c ON c.id = br.contractor_id
       WHERE br.ip = $1::inet AND br.id != $2`,
      [ip.trim(), serverId]
    );
    if (dupIp.rows.length > 0) {
      const existingSystem = dupIp.rows[0].system_name || 'سامانه دیگری';
      return res.status(409).json({
        error: `آدرس IP "${ip.trim()}" قبلاً در سامانه "${existingSystem}" ثبت شده است.`,
      });
    }

    // ── بررسی تکراری بودن VMname (به جز خود رکورد) ──────────────────────────
    const dupVmname = await pool.query(
      `SELECT br.id, c.system_name
       FROM backup_resources br
       JOIN contractor c ON c.id = br.contractor_id
       WHERE LOWER(br.vmname) = LOWER($1) AND br.id != $2`,
      [resolvedVmname, serverId]
    );
    if (dupVmname.rows.length > 0) {
      const existingSystem = dupVmname.rows[0].system_name || 'سامانه دیگری';
      return res.status(409).json({
        error: `VMname "${resolvedVmname}" قبلاً در سامانه "${existingSystem}" ثبت شده است.`,
      });
    }

    const result = await pool.query(
      `UPDATE backup_resources
       SET ip = $1, vmname = $2, url = $3, type = $4,
           backup_operator = $5, backup_period = $6
       WHERE id = $7
       RETURNING *`,
      [ip.trim(), resolvedVmname, url || null, type || null, backupOperator || null, backupPeriod || null, serverId]
    );

    const row = result.rows[0];
    res.json({
      id: row.id, ip: row.ip, vmname: row.vmname, url: row.url,
      type: row.type, backupOperator: row.backup_operator,
      backupPeriod: row.backup_period, contractorId: row.contractor_id,
    });
  } catch (error: any) {
    console.error('Update server error:', error);
    res.status(500).json({ error: 'خطا در ویرایش سرور' });
  }
});

// ─── DELETE /servers/:id ─────────────────────────────────────────────────────
router.delete('/servers/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const serverId = parseInt(req.params.id, 10);

    const serverRow = await pool.query(
      'SELECT contractor_id FROM backup_resources WHERE id = $1',
      [serverId]
    );
    if (serverRow.rows.length === 0) {
      return res.status(404).json({ error: 'سرور یافت نشد' });
    }
    const contractorId = serverRow.rows[0].contractor_id;

    if (!(await canModify(userId, contractorId))) {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }

    await pool.query('DELETE FROM backup_resources WHERE id = $1', [serverId]);
    res.json({ message: 'سرور با موفقیت حذف شد' });
  } catch (error: any) {
    console.error('Delete server error:', error);
    res.status(500).json({ error: 'خطا در حذف سرور' });
  }
});

export default router;

// ─── GET /pdf-report — داده‌های گزارش PDF ────────────────────────────────────
router.get('/pdf-report', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    // فقط NETWORK_HEAD و NETWORK_ADMIN مجاز هستند
    const userResult = await pool.query('SELECT role FROM req_users WHERE id = $1', [userId]);
    const role = userResult.rows[0]?.role;
    if (role !== 'NETWORK_HEAD' && role !== 'NETWORK_ADMIN') {
      return res.status(403).json({ error: 'فقط NETWORK_HEAD و NETWORK_ADMIN مجاز هستند' });
    }

    // همان منطق دسترسی که در /contractors استفاده می‌شود
    const { whereClause, params } = await buildAccessQuery(userId);

    // دریافت سامانه‌های قابل دسترس کاربر + نام و اداره ثبت‌کننده
    const contractorsResult = await pool.query(`
      SELECT
        c.id            AS c_id,
        c.system_name   AS c_system_name,
        c.cont_name     AS c_cont_name,
        c.rep_name1     AS c_rep_name1,
        c.phone1        AS c_phone1,
        c.rep_name2     AS c_rep_name2,
        c.phone2        AS c_phone2,
        c.rep_name3     AS c_rep_name3,
        c.phone3        AS c_phone3,
        u.name          AS c_registered_by,
        u.department    AS c_registered_by_dept,
        br.id           AS s_id,
        br.ip           AS s_ip,
        br.vmname       AS s_vmname,
        br.url          AS s_url,
        br.type         AS s_type,
        br.backup_operator AS s_backup_operator,
        br.backup_period   AS s_backup_period
      FROM contractor c
      LEFT JOIN req_users u ON u.id = (
        SELECT jsonb_array_elements_text(c.req_user_ids)::integer LIMIT 1
      )
      LEFT JOIN backup_resources br ON br.contractor_id = c.id
      WHERE ${whereClause}
      ORDER BY c.id ASC, br.id ASC
    `, params);

    // ساخت ساختار سامانه‌ها
    const contractorMap = new Map<number, any>();
    for (const row of contractorsResult.rows) {
      if (!contractorMap.has(row.c_id)) {
        contractorMap.set(row.c_id, {
          id: row.c_id,
          systemName: row.c_system_name,
          contName: row.c_cont_name,
          repName1: row.c_rep_name1, phone1: row.c_phone1,
          repName2: row.c_rep_name2, phone2: row.c_phone2,
          repName3: row.c_rep_name3, phone3: row.c_phone3,
          registeredBy: row.c_registered_by,
          registeredByDept: row.c_registered_by_dept,
          servers: [],
        });
      }
      if (row.s_id) {
        contractorMap.get(row.c_id).servers.push({
          id: row.s_id,
          ip: row.s_ip,
          vmname: row.s_vmname,
          url: row.s_url,
          type: row.s_type,
          backupOperator: row.s_backup_operator,
          backupPeriod: row.s_backup_period,
          users: [],
        });
      }
    }

    // برای هر سرور، کاربرانی که از IP آن استفاده کرده‌اند و درخواستشان COMPLETED شده را پیدا کن
    const contractors = Array.from(contractorMap.values());
    for (const contractor of contractors) {
      for (const server of contractor.servers) {
        const ip = server.ip;
        const usersResult = await pool.query(`
          SELECT DISTINCT r.requester_name
          FROM requests r
          WHERE r.status = 'COMPLETED'
            AND (
              (r.request_type = 'FILE_TRANSFER' AND EXISTS (
                SELECT 1 FROM jsonb_array_elements(r.files) f
                WHERE f->>'sourceIP' = $1
              ))
              OR
              (r.request_type IN ('BACKUP','TAPE','USB_PORT','APP_INSTALL','SERVER_RESTART') AND EXISTS (
                SELECT 1 FROM jsonb_array_elements(r.files) f
                WHERE f->>'serverIP' = $1
              ))
            )
          ORDER BY r.requester_name
        `, [ip]);

        server.users = usersResult.rows.map((r: any) => r.requester_name);
      }
    }

    res.json(contractors);
  } catch (error: any) {
    console.error('PDF report error:', error);
    res.status(500).json({ error: 'خطا در تهیه گزارش' });
  }
});
