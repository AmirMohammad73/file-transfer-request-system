import React, { useState, useEffect } from 'react';
import { Contractor, BackupServer, Role } from '../types';
import { backupResourcesAPI } from '../utils/api';
import { useToastContext } from './ToastContainer';
import ConfirmDialog from './ConfirmDialog';
import { useAuth } from '../auth/AuthContext';

interface SystemManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const emptyContractorForm = {
  systemName: '', contName: '',
  repName1: '', phone1: '',
  repName2: '', phone2: '',
  repName3: '', phone3: '',
};

const emptyServerForm = {
  ip: '', url: '', type: '', backupOperator: '', backupPeriod: '',
};

const SystemManagementModal: React.FC<SystemManagementModalProps> = ({ isOpen, onClose }) => {
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(false);
  const [contractorForm, setContractorForm] = useState({ ...emptyContractorForm });
  const [editingContractorId, setEditingContractorId] = useState<number | null>(null);
  const [savingContractor, setSavingContractor] = useState(false);
  const [repCount, setRepCount] = useState(1); // تعداد نمایندگان نمایش داده شده
  const [serverForms, setServerForms] = useState<{ [cId: number]: typeof emptyServerForm & { editingServerId?: number } }>({});
  const [savingServer, setSavingServer] = useState<number | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ type: 'contractor' | 'server'; id: number; label: string } | null>(null);
  const { showToast } = useToastContext();
  const { user } = useAuth();
  const isNetworkHead = user?.role === Role.NETWORK_HEAD;
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [expandedContractorId, setExpandedContractorId] = useState<number | null>(null);
  const [showAddServerForm, setShowAddServerForm] = useState<Set<number>>(new Set());

  useEffect(() => { if (isOpen) fetchContractors(); }, [isOpen]);

  const fetchContractors = async () => {
    try {
      setLoading(true);
      setContractors(await backupResourcesAPI.getAllContractors());
    } catch (e: any) {
      showToast(e.message || 'خطا در دریافت شناسنامه سامانه‌ها', 'error');
    } finally { setLoading(false); }
  };

  const handleCI = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setContractorForm(p => ({ ...p, [name]: value }));
  };

  const resetCForm = () => { setContractorForm({ ...emptyContractorForm }); setEditingContractorId(null); setRepCount(1); };

  const handleEditContractor = (c: Contractor) => {
    setEditingContractorId(c.id!);
    setContractorForm({
      systemName: c.systemName || '', contName: c.contName || '',
      repName1: c.repName1 || '', phone1: c.phone1 || '',
      repName2: c.repName2 || '', phone2: c.phone2 || '',
      repName3: c.repName3 || '', phone3: c.phone3 || '',
    });
    // تعداد نمایندگان موجود را تنظیم کن
    const count = c.repName3 ? 3 : c.repName2 ? 2 : 1;
    setRepCount(count);
    document.getElementById('contractor-form-top')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSaveContractor = async () => {
    if (!contractorForm.systemName.trim()) { showToast('نام سامانه اجباری است', 'warning'); return; }
    if (!contractorForm.repName1.trim()) { showToast('حداقل یک نماینده اجباری است', 'warning'); return; }
    if (!contractorForm.phone1.trim()) { showToast('شماره تماس نماینده اول اجباری است', 'warning'); return; }
    try {
      setSavingContractor(true);
      if (editingContractorId !== null) {
        const updated = await backupResourcesAPI.updateContractor(editingContractorId, contractorForm);
        setContractors(p => p.map(c => c.id === editingContractorId ? { ...updated, servers: c.servers } : c));
        showToast('شناسنامه سامانه به‌روزرسانی شد', 'success');
      } else {
        const created = await backupResourcesAPI.createContractor(contractorForm);
        setContractors(p => [created, ...p]);
        showToast('شناسنامه سامانه اضافه شد', 'success');
      }
      resetCForm();
    } catch (e: any) { showToast(e.message || 'خطا در ذخیره', 'error'); }
    finally { setSavingContractor(false); }
  };

  const getSF = (cId: number) => serverForms[cId] || { ...emptyServerForm };

  const handleSI = (cId: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setServerForms(p => ({ ...p, [cId]: { ...getSF(cId), [name]: value } }));
  };

  const resetSForm = (cId: number) => setServerForms(p => ({ ...p, [cId]: { ...emptyServerForm } }));

  const handleEditServer = (cId: number, s: BackupServer) => {
    setShowAddServerForm(p => new Set(p).add(cId));
    setServerForms(p => ({
      ...p,
      [cId]: { ip: s.ip, url: s.url || '', type: s.type || '',
        backupOperator: s.backupOperator || '', backupPeriod: s.backupPeriod || '',
        editingServerId: s.id },
    }));
  };

  const handleSaveServer = async (cId: number) => {
    const form = getSF(cId);
    if (!form.ip.trim()) { showToast('آدرس IP اجباری است', 'warning'); return; }
    try {
      setSavingServer(cId);
      const eid = (form as any).editingServerId;
      const payload = { ip: form.ip, url: form.url, type: form.type, backupOperator: form.backupOperator, backupPeriod: form.backupPeriod };
      if (eid) {
        const u = await backupResourcesAPI.updateServer(eid, payload);
        setContractors(p => p.map(c => c.id === cId ? { ...c, servers: (c.servers||[]).map(s => s.id === eid ? u : s) } : c));
        showToast('سرور به‌روزرسانی شد', 'success');
      } else {
        const cr = await backupResourcesAPI.addServer(cId, payload);
        setContractors(p => p.map(c => c.id === cId ? { ...c, servers: [...(c.servers||[]), cr] } : c));
        showToast('سرور اضافه شد', 'success');
      }
      resetSForm(cId);
      setShowAddServerForm(p => { const next = new Set(p); next.delete(cId); return next; });
    } catch (e: any) { showToast(e.message || 'خطا در ذخیره سرور', 'error'); }
    finally { setSavingServer(null); }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteDialog) return;
    try {
      if (deleteDialog.type === 'contractor') {
        await backupResourcesAPI.deleteContractor(deleteDialog.id);
        setContractors(p => p.filter(c => c.id !== deleteDialog.id));
        showToast('سامانه حذف شد', 'success');
      } else {
        await backupResourcesAPI.deleteServer(deleteDialog.id);
        setContractors(p => p.map(c => ({ ...c, servers: (c.servers||[]).filter(s => s.id !== deleteDialog.id) })));
        showToast('سرور حذف شد', 'success');
      }
    } catch (e: any) { showToast(e.message || 'خطا در حذف', 'error'); }
    finally { setDeleteDialog(null); }
  };

  const toggleContractor = (id: number) => {
    setExpandedContractorId((prev) => {
      if (prev === id) {
        setShowAddServerForm((forms) => {
          const next = new Set(forms);
          next.delete(id);
          return next;
        });
        return null;
      }
      return id;
    });
  };

  const toggleAddServerForm = (cId: number) => {
    setShowAddServerForm((prev) => {
      const next = new Set(prev);
      if (next.has(cId)) {
        next.delete(cId);
        resetSForm(cId);
      } else {
        next.add(cId);
        resetSForm(cId);
      }
      return next;
    });
  };

  if (!isOpen) return null;

  // ── تابع تولید PDF با window.print ──────────────────────────────────────────
  const handlePdfExport = async () => {
    try {
      setGeneratingPdf(true);
      const data = await backupResourcesAPI.getPdfReport();

      // ساخت HTML جدول
      let rows = '';
      for (const contractor of data) {
        const servers = contractor.servers || [];
        const rowCount = Math.max(servers.length, 1);

        for (let i = 0; i < rowCount; i++) {
          const server = servers[i];
          const isFirst = i === 0;
          rows += `<tr>`;

          if (isFirst) {
            rows += `
              <td rowspan="${rowCount}" class="border px-2 py-1 align-top font-bold">${contractor.systemName || '—'}</td>
              <td rowspan="${rowCount}" class="border px-2 py-1 align-top">${contractor.contName || '—'}</td>
              <td rowspan="${rowCount}" class="border px-2 py-1 align-top text-xs">
                ${contractor.repName1 ? `${contractor.repName1}<br/>${contractor.phone1 || ''}` : '—'}
                ${contractor.repName2 ? `<br/>${contractor.repName2}<br/>${contractor.phone2 || ''}` : ''}
                ${contractor.repName3 ? `<br/>${contractor.repName3}<br/>${contractor.phone3 || ''}` : ''}
              </td>
              <td rowspan="${rowCount}" class="border px-2 py-1 align-top text-xs">${contractor.registeredBy || '—'}${contractor.registeredByDept ? `<br/>(${contractor.registeredByDept})` : ''}</td>
            `;
          }

          if (server) {
            rows += `
              <td class="border px-2 py-1 font-mono text-xs">${server.ip || '—'}</td>
              <td class="border px-2 py-1 text-xs">${server.vmname || '—'}</td>
              <td class="border px-2 py-1 text-xs">${server.type || '—'}</td>
              <td class="border px-2 py-1 text-xs">${server.backupOperator || '—'}</td>
              <td class="border px-2 py-1 text-xs">${server.backupPeriod || '—'}</td>
              <td class="border px-2 py-1 text-xs">${(server.users || []).join('، ') || '—'}</td>
            `;
          } else {
            rows += `<td class="border px-2 py-1" colspan="6"></td>`;
          }

          rows += `</tr>`;
        }
      }

      const html = `<!DOCTYPE html>
<html dir="rtl" lang="fa">
<head>
  <meta charset="UTF-8"/>
  <title>گزارش شناسنامه سامانه‌ها</title>
  <style>
    @page { size: A4 landscape; margin: 1cm; }
    body { font-family: Tahoma, Arial, sans-serif; font-size: 11px; direction: rtl; }
    h2 { text-align: center; margin-bottom: 8px; font-size: 14px; }
    p.date { text-align: center; font-size: 10px; color: #555; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #2c3e50; color: white; padding: 6px 4px; font-size: 11px; border: 1px solid #ccc; }
    td { border: 1px solid #ccc; padding: 4px; vertical-align: top; }
    tr:nth-child(even) { background: #f9f9f9; }
    .border { border: 1px solid #ccc; }
    .px-2 { padding-left: 8px; padding-right: 8px; }
    .py-1 { padding-top: 4px; padding-bottom: 4px; }
    .align-top { vertical-align: top; }
    .font-bold { font-weight: bold; }
    .font-mono { font-family: monospace; }
    .text-xs { font-size: 10px; }
  </style>
</head>
<body>
  <h2>گزارش شناسنامه سامانه‌ها</h2>
  <p class="date">تاریخ تهیه: ${new Date().toLocaleDateString('fa-IR')}</p>
  <table>
    <thead>
      <tr>
        <th>نام سامانه</th>
        <th>پیمانکار</th>
        <th>نمایندگان و تماس</th>
        <th>نام کارشناس</th>
        <th>IP سرور</th>
        <th>VMname</th>
        <th>نوع کاربری</th>
        <th>اوپراتور بکاپ</th>
        <th>دوره بکاپ</th>
        <th>کاربران استفاده‌کننده</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;

      const printWindow = window.open('', '_blank', 'width=1200,height=800');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
        }, 500);
      }
    } catch (e: any) {
      showToast(e.message || 'خطا در تهیه گزارش PDF', 'error');
    } finally {
      setGeneratingPdf(false);
    }
  };

  // ── تابع خروجی اکسل (CSV) ────────────────────────────────────────────────────
  const handleExcelExport = async () => {
    try {
      setGeneratingPdf(true);
      const data = await backupResourcesAPI.getPdfReport();

      // ستون‌های هدر
      const headers = [
        'نام سامانه',
        'پیمانکار',
        'نماینده ۱',
        'تماس ۱',
        'نماینده ۲',
        'تماس ۲',
        'نماینده ۳',
        'تماس ۳',
        'نام کارشناس',
        'IP سرور',
        'VMname',
        'نوع کاربری',
        'اوپراتور بکاپ',
        'دوره بکاپ',
        'کاربران استفاده‌کننده',
      ];

      const escapeCell = (val: string) => {
        const s = String(val ?? '');
        if (s.includes(',') || s.includes('"') || s.includes('\n')) {
          return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
      };

      const rows: string[] = [];
      // BOM برای نمایش درست فارسی در Excel
      rows.push('\uFEFF' + headers.map(escapeCell).join(','));

      for (const contractor of data) {
        const servers = contractor.servers || [];
        if (servers.length === 0) {
          rows.push([
            contractor.systemName || '',
            contractor.contName || '',
            contractor.repName1 || '',
            contractor.phone1 || '',
            contractor.repName2 || '',
            contractor.phone2 || '',
            contractor.repName3 || '',
            contractor.phone3 || '',
            contractor.registeredBy || '',
            '', '', '', '', '', '',
          ].map(escapeCell).join(','));
        } else {
          for (const server of servers) {
            rows.push([
              contractor.systemName || '',
              contractor.contName || '',
              contractor.repName1 || '',
              contractor.phone1 || '',
              contractor.repName2 || '',
              contractor.phone2 || '',
              contractor.repName3 || '',
              contractor.phone3 || '',
              contractor.registeredBy ? (contractor.registeredByDept ? `${contractor.registeredBy} — ${contractor.registeredByDept}` : contractor.registeredBy) : '',
              server.ip || '',
              server.vmname || '',
              server.type || '',
              server.backupOperator || '',
              server.backupPeriod || '',
              (server.users || []).join(' / '),
            ].map(escapeCell).join(','));
          }
        }
      }

      const csvContent = rows.join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `شناسنامه-سامانه‌ها-${new Date().toLocaleDateString('fa-IR').replace(/\//g, '-')}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast('فایل اکسل با موفقیت دانلود شد', 'success');
    } catch (e: any) {
      showToast(e.message || 'خطا در تهیه فایل اکسل', 'error');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const inp = (name: string, value: string, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void, placeholder: string, label: string, required = false) => (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input type="text" name={name} value={value} onChange={onChange} placeholder={placeholder}
        className="w-full p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#16a085] focus:border-[#16a085] transition-all text-sm" />
    </div>
  );

  const sInp = (name: string, cId: number, placeholder: string, label: string, required = false) => (
    <div>
      <label className="block text-xs font-semibold text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input type="text" name={name} value={(getSF(cId) as any)[name] || ''} onChange={e => handleSI(cId, e)}
        placeholder={placeholder}
        className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-orange-400 focus:border-orange-400" />
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4 backdrop-blur-sm"
      onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="server-id-modal-title">
      <ConfirmDialog isOpen={!!deleteDialog}
        title={deleteDialog?.type === 'contractor' ? 'حذف شناسنامه سامانه' : 'حذف سرور'}
        message={`آیا از حذف "${deleteDialog?.label}" مطمئن هستید؟`}
        confirmText="بله، حذف کن" cancelText="انصراف"
        onConfirm={handleDeleteConfirm} onCancel={() => setDeleteDialog(null)} type="delete" />

      <div className="bg-white rounded-lg shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col animate-slide-down" onClick={e => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-[#16a085] to-[#1abc9c] text-white p-4 rounded-t-lg flex justify-between items-center flex-shrink-0">
          <h2 id="server-id-modal-title" className="text-xl font-bold">شناسنامه سامانه‌ها</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePdfExport}
              disabled={generatingPdf}
              className="bg-white text-[#16a085] px-4 py-1.5 rounded-md text-sm font-semibold hover:bg-gray-100 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-white"
              aria-label="خروجی PDF"
            >
              {generatingPdf ? (
                <><div className="spinner w-4 h-4 border-[#16a085]"></div><span>در حال تهیه...</span></>
              ) : (
                <><span>📄</span><span>خروجی PDF</span></>
              )}
            </button>
            <button
              onClick={handleExcelExport}
              disabled={true}
              title="به‌زودی"
              className="bg-white text-[#27ae60] px-4 py-1.5 rounded-md text-sm font-semibold opacity-50 cursor-not-allowed flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-white"
              aria-label="خروجی اکسل"
            >
              <span>📊</span><span>خروجی اکسل</span>
            </button>
            <button onClick={onClose} className="text-2xl cursor-pointer hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-white rounded" aria-label="بستن">&times;</button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* ══ فرم سامانه ══ */}
          <div id="contractor-form-top" className="bg-blue-50 p-5 rounded-lg border border-blue-200">
            <h3 className="text-base font-bold text-blue-800 mb-4">
              {editingContractorId !== null ? '✏️ ویرایش شناسنامه سامانه' : '➕ اصلاح سامانه'}
            </h3>

            {/* ردیف اول: ۴ فیلد اصلی */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {inp('systemName', contractorForm.systemName, handleCI, 'نام سامانه', 'سامانه', true)}
              {inp('contName', contractorForm.contName, handleCI, 'نام شرکت پیمانکار', 'پیمانکار')}
              {inp('repName1', contractorForm.repName1, handleCI, 'نام نماینده', 'نماینده', true)}
              {inp('phone1', contractorForm.phone1, handleCI, 'شماره تماس', 'شماره تماس', true)}
            </div>

            {/* نمایندگان اضافی */}
            {repCount >= 2 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 pt-3 border-t border-blue-200">
                {inp('repName2', contractorForm.repName2 || '', handleCI, 'نام نماینده دوم', 'نماینده ۲')}
                {inp('phone2', contractorForm.phone2 || '', handleCI, 'شماره تماس', 'شماره تماس ۲')}
              </div>
            )}
            {repCount >= 3 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 pt-3 border-t border-blue-200">
                {inp('repName3', contractorForm.repName3 || '', handleCI, 'نام نماینده سوم', 'نماینده ۳')}
                {inp('phone3', contractorForm.phone3 || '', handleCI, 'شماره تماس', 'شماره تماس ۳')}
              </div>
            )}

            {/* دکمه افزودن نماینده */}
            {repCount < 3 && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setRepCount(c => Math.min(c + 1, 3))}
                  className="text-xs text-blue-600 hover:text-blue-800 font-semibold cursor-pointer flex items-center gap-1 transition-colors"
                >
                  <span className="text-base leading-none">+</span>
                  افزودن نماینده جدید
                </button>
              </div>
            )}

            <div className="mt-4 flex justify-end gap-3">
              {editingContractorId !== null && (
                <button onClick={resetCForm} className="px-4 py-2 bg-gray-400 text-white rounded-md hover:bg-gray-500 text-sm font-semibold cursor-pointer">انصراف</button>
              )}
              <button onClick={handleSaveContractor} disabled={savingContractor}
                className="px-5 py-2 bg-[#16a085] text-white rounded-md hover:bg-[#138d75] text-sm font-semibold cursor-pointer disabled:opacity-50 flex items-center gap-2">
                {savingContractor && <div className="spinner w-4 h-4"></div>}
                {editingContractorId !== null ? 'ذخیره تغییرات' : 'افزودن سامانه'}
              </button>
            </div>
          </div>

          {/* ══ لیست سامانه‌ها ══ */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16"><div className="spinner mb-4"></div><p className="text-gray-500">در حال بارگذاری...</p></div>
          ) : contractors.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 bg-gray-50 rounded-lg border border-gray-200">
              <div className="text-6xl mb-4">🖥️</div>
              <p className="text-gray-500 font-medium text-lg">هیچ شناسنامه‌ای ثبت نشده است</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100 border-b-2 border-gray-300">
                    <th className="p-3 text-right font-bold text-gray-700 min-w-[180px]">سامانه</th>
                    <th className="p-3 text-right font-bold text-gray-700">پیمانکار</th>
                    <th className="p-3 text-right font-bold text-gray-700">تعداد سرور</th>
                    <th className="p-3 text-right font-bold text-gray-700">نماینده</th>
                    <th className="p-3 text-right font-bold text-gray-700">جزئیات</th>
                  </tr>
                </thead>
                <tbody>
                  {contractors.map((contractor, index) => {
                    const isExpanded = expandedContractorId === contractor.id;
                    const serverCount = (contractor.servers || []).length;
                    const isAddServerFormVisible = showAddServerForm.has(contractor.id!);
                    const isEditingServer = !!(serverForms[contractor.id!] as any)?.editingServerId;

                    return (
                      <React.Fragment key={contractor.id}>
                        <tr
                          className={`border-b border-gray-200 hover:bg-gray-100 cursor-pointer transition-colors ${index % 2 === 0 ? 'bg-teal-50' : 'bg-green-50'} ${editingContractorId === contractor.id ? 'ring-2 ring-[#16a085] ring-inset' : ''}`}
                          onClick={() => toggleContractor(contractor.id!)}
                        >
                          <td className="p-3 text-gray-800 font-semibold">{contractor.systemName}</td>
                          <td className="p-3 text-gray-700">{contractor.contName || '—'}</td>
                          <td className="p-3 text-gray-700">{serverCount}</td>
                          <td className="p-3 text-gray-600">{contractor.repName1 || '—'}{contractor.phone1 ? ` — ${contractor.phone1}` : ''}</td>
                          <td className="p-3">
                            <button
                              type="button"
                              className="text-[#16a085] hover:text-[#138d75] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#16a085] focus:ring-offset-2 rounded px-2 py-1"
                              aria-expanded={isExpanded}
                              onClick={(e) => { e.stopPropagation(); toggleContractor(contractor.id!); }}
                            >
                              {isExpanded ? 'کمتر ▼' : 'بیشتر ▶'}
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={5} className="p-4 bg-gray-50">
                              <div className="space-y-4">
                                <div className="flex justify-end gap-2 pb-3 border-b border-dashed border-gray-300">
                                  <button
                                    type="button"
                                    onClick={() => handleEditContractor(contractor)}
                                    className="bg-[#3498db] text-white px-3 py-1.5 rounded text-xs font-semibold hover:bg-[#2980b9] cursor-pointer"
                                  >
                                    ویرایش سامانه
                                  </button>
                                  {isNetworkHead && (
                                    <button
                                      type="button"
                                      onClick={() => setDeleteDialog({ type: 'contractor', id: contractor.id!, label: contractor.systemName })}
                                      className="bg-red-500 text-white px-3 py-1.5 rounded text-xs font-semibold hover:bg-red-600 cursor-pointer"
                                    >
                                      حذف سامانه
                                    </button>
                                  )}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600">
                                  {contractor.registeredByName && <div>کارشناس: <strong>{contractor.registeredByName}</strong>{contractor.registeredByDept ? ` — ${contractor.registeredByDept}` : ''}</div>}
                                  {contractor.repName1 && <div>نماینده ۱: <strong>{contractor.repName1}</strong> — {contractor.phone1}</div>}
                                  {contractor.repName2 && <div>نماینده ۲: <strong>{contractor.repName2}</strong> — {contractor.phone2}</div>}
                                  {contractor.repName3 && <div>نماینده ۳: <strong>{contractor.repName3}</strong> — {contractor.phone3}</div>}
                                </div>

                                {/* لیست سرورها */}
                                <div>
                                  {serverCount === 0 ? (
                                    <p className="text-sm text-gray-500 italic">هیچ سروری ثبت نشده است.</p>
                                  ) : (
                                    <div className="overflow-x-auto">
                                      <table className="w-full border-collapse text-sm">
                                        <thead>
                                          <tr className="bg-gray-100 border-b-2 border-gray-300">
                                            {['IP', 'URL', 'نوع کاربری', 'اوپراتور', 'دوره بکاپ', 'عملیات'].map(h => (
                                              <th key={h} className="p-2 text-right font-bold text-gray-700 whitespace-nowrap">{h}</th>
                                            ))}
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {(contractor.servers || []).map((s, i) => (
                                            <tr key={s.id} className={`border-b border-gray-200 hover:bg-gray-50 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                                              <td className="p-2 font-mono text-gray-800">{s.ip}</td>
                                              <td className="p-2 text-gray-700 max-w-[120px] truncate">
                                                {s.url ? <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-[#16a085] hover:underline" title={s.url}>{s.url}</a> : '—'}
                                              </td>
                                              <td className="p-2 text-gray-700">{s.type || '—'}</td>
                                              <td className="p-2 text-gray-700">{s.backupOperator || '—'}</td>
                                              <td className="p-2 text-gray-700">{s.backupPeriod || '—'}</td>
                                              <td className="p-2 text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                  <button type="button" onClick={() => handleEditServer(contractor.id!, s)} className="bg-[#3498db] text-white px-2 py-1 rounded text-xs font-semibold hover:bg-[#2980b9] cursor-pointer">ویرایش</button>
                                                  {isNetworkHead && (
                                                    <button type="button" onClick={() => setDeleteDialog({ type: 'server', id: s.id!, label: s.ip })} className="bg-red-500 text-white px-2 py-1 rounded text-xs font-semibold hover:bg-red-600 cursor-pointer">حذف</button>
                                                  )}
                                                </div>
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => toggleAddServerForm(contractor.id!)}
                                    className="mt-3 text-[#3498db] hover:text-[#2980b9] font-semibold text-sm flex items-center gap-1 transition-colors"
                                  >
                                    <span className="text-base leading-none">{isAddServerFormVisible ? '▲' : '+'}</span>
                                    <span>{isAddServerFormVisible ? 'بستن فرم افزودن سرور' : 'افزودن سرور جدید'}</span>
                                  </button>
                                </div>

                                {/* فرم افزودن/ویرایش سرور */}
                                {isAddServerFormVisible && (
                                  <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                                    <h4 className="text-sm font-bold text-orange-800 mb-3">
                                      {isEditingServer ? '✏️ ویرایش سرور' : '➕ افزودن سرور'}
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                      {sInp('ip', contractor.id!, '192.168.1.100', 'آدرس IP', true)}
                                      {sInp('url', contractor.id!, 'https://...', 'URL')}
                                      {sInp('type', contractor.id!, 'بکاپ، دیتابیس، SQL، وب...', 'نوع کاربری سرور')}
                                      {sInp('backupOperator', contractor.id!, 'نام اوپراتور', 'اوپراتور بکاپ')}
                                      {sInp('backupPeriod', contractor.id!, 'روزانه، هفتگی...', 'دوره‌های بکاپ')}
                                    </div>
                                    <div className="mt-3 flex justify-end gap-2">
                                      <button
                                        type="button"
                                        onClick={() => toggleAddServerForm(contractor.id!)}
                                        className="px-3 py-1.5 bg-gray-400 text-white rounded text-xs font-semibold cursor-pointer hover:bg-gray-500"
                                      >
                                        انصراف
                                      </button>
                                      <button type="button" onClick={() => handleSaveServer(contractor.id!)} disabled={savingServer === contractor.id}
                                        className="px-4 py-1.5 bg-orange-500 text-white rounded text-xs font-semibold cursor-pointer hover:bg-orange-600 disabled:opacity-50 flex items-center gap-1">
                                        {savingServer === contractor.id && <div className="spinner w-3 h-3"></div>}
                                        {isEditingServer ? 'ذخیره تغییرات' : 'افزودن سرور'}
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SystemManagementModal;
