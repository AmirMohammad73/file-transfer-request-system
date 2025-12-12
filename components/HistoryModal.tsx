import React, { useState, useEffect, useMemo } from 'react';
import { Request, RequestType } from '../types';
import { STATUS_STYLES } from '../constants';
import ApprovalStatus from './ApprovalStatus';
import { requestsAPI } from '../utils/api';
import { useAuth } from '../auth/AuthContext';
import PersianDatePicker from './PersianDatePicker';
import { useToastContext } from './ToastContainer';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  requests?: Request[];
}

const ITEMS_PER_PAGE = 10;

const HistoryModal: React.FC<HistoryModalProps> = ({ isOpen, onClose, requests: initialRequests }) => {
  const [requests, setRequests] = useState<Request[]>(initialRequests || []);
  const [loading, setLoading] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const { user } = useAuth();
  const [editingLetterNumber, setEditingLetterNumber] = useState<{ requestId: string; fileId: string } | null>(null);
  const [letterNumberValue, setLetterNumberValue] = useState('');
  
  // State برای track کردن فایل‌هایی که توضیحات بیشترشان باز شده
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

  // Filter States
  const [filterRequestType, setFilterRequestType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterIP, setFilterIP] = useState('');
  const [filterRequesterName, setFilterRequesterName] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (isOpen) { fetchHistory(); }
  }, [isOpen]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterRequestType, filterStatus, filterIP, filterRequesterName, filterDepartment, filterDateFrom, filterDateTo]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const historyRequests = await requestsAPI.getHistory();
      setRequests(historyRequests);
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
    }
  };

  // Toggle file details - فقط add می‌کنیم، هرگز remove نمی‌کنیم
  const toggleFileDetails = (fileId: string) => {
    setExpandedFiles(prev => {
      const newSet = new Set(prev);
      newSet.add(fileId);
      return newSet;
    });
  };

  const filteredRequests = useMemo(() => {
    return requests.filter(request => {
      if (filterRequestType && request.requestType !== filterRequestType) { return false; }
      if (filterStatus && request.status !== filterStatus) { return false; }
      
      if (filterIP) {
        let hasMatchingIP = false;
        if (request.requestType === RequestType.FILE_TRANSFER && request.files) {
          hasMatchingIP = request.files.some(file =>
            file.sourceIP?.includes(filterIP) || file.destinationIP?.includes(filterIP)
          );
        }
        if (!hasMatchingIP) { return false; }
      }
      
      if (filterRequesterName && !request.requesterName.includes(filterRequesterName)) { return false; }
      if (filterDepartment && !(request as any).department?.includes(filterDepartment)) { return false; }
      
      if (filterDateFrom || filterDateTo) {
        const requestDate = new Date(request.createdAt);
        if (filterDateFrom) {
          const fromDate = new Date(filterDateFrom);
          fromDate.setHours(0, 0, 0, 0);
          if (requestDate < fromDate) { return false; }
        }
        if (filterDateTo) {
          const toDate = new Date(filterDateTo);
          toDate.setHours(23, 59, 59, 999);
          if (requestDate > toDate) { return false; }
        }
      }
      return true;
    });
  }, [requests, filterRequestType, filterStatus, filterIP, filterRequesterName, filterDepartment, filterDateFrom, filterDateTo]);

  const totalPages = Math.ceil(filteredRequests.length / ITEMS_PER_PAGE);
  const paginatedRequests = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredRequests.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredRequests, currentPage]);

  const clearFilters = () => {
    setFilterRequestType('');
    setFilterStatus('');
    setFilterIP('');
    setFilterRequesterName('');
    setFilterDepartment('');
    setFilterDateFrom('');
    setFilterDateTo('');
  };

  const toggleRow = (requestId: string) => {
    if (expandedRow === requestId) { setExpandedRow(null); } else { setExpandedRow(requestId); }
  };

  const handleEditLetterNumber = (requestId: string, fileId: string, currentValue?: string) => {
    setEditingLetterNumber({ requestId, fileId });
    setLetterNumberValue(currentValue || '');
  };

  const { showToast } = useToastContext();

  const handleSaveLetterNumber = async (requestId: string, fileId: string) => {
    if (!letterNumberValue.trim()) { showToast('لطفاً شماره نامه را وارد کنید', 'warning'); return; }
    try {
      const result = await requestsAPI.updateLetterNumber(requestId, fileId, letterNumberValue);
      setRequests(prev => prev.map(req => req.id === requestId ? { ...req, files: result.files } : req));
      setEditingLetterNumber(null);
      setLetterNumberValue('');
      showToast('شماره نامه با موفقیت به‌روزرسانی شد', 'success');
    } catch (error: any) {
      showToast(error.message || 'خطا در به‌روزرسانی شماره نامه', 'error');
    }
  };

  const handleCancelEdit = () => {
    setEditingLetterNumber(null);
    setLetterNumberValue('');
  };

  if (!isOpen) return null;

  const isRequester = (request: Request) => {
    return user && request.requesterName === user.name;
  };

  const hasActiveFilters = filterRequestType || filterStatus || filterIP || filterRequesterName || filterDepartment || filterDateFrom || filterDateTo;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4 backdrop-blur-sm" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="history-modal-title">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-7xl max-h-[90vh] flex flex-col animate-slide-down" onClick={e => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-[#3498db] to-[#2980b9] text-white p-4 rounded-t-lg flex justify-between items-center">
          <h2 id="history-modal-title" className="text-xl font-bold">تاریخچه درخواست‌ها</h2>
          <button onClick={onClose} className="text-2xl cursor-pointer hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#3498db] rounded" aria-label="بستن"> &times; </button>
        </div>
        
        {/* Filters Section */}
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">نوع درخواست</label>
              <select value={filterRequestType} onChange={(e) => setFilterRequestType(e.target.value)} className="w-full p-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-[#3498db] focus:border-[#3498db]">
                <option value="">همه</option>
                <option value="FILE_TRANSFER">فایل</option>
                <option value="VDI_OPEN">VDI</option>
                <option value="BACKUP">Backup</option>
              </select>
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">وضعیت</label>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-full p-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-[#3498db] focus:border-[#3498db]">
                <option value="">همه</option>
                <option value="PENDING">در حال بررسی</option>
                <option value="APPROVED">تایید شده</option>
                <option value="REJECTED">رد شده</option>
                <option value="COMPLETED">انجام شده</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">IP (مبدا یا مقصد)</label>
              <input type="text" value={filterIP} onChange={(e) => setFilterIP(e.target.value)} placeholder="مثال: 192.168" className="w-full p-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-[#3498db] focus:border-[#3498db]" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">نام درخواست کننده</label>
              <input type="text" value={filterRequesterName} onChange={(e) => setFilterRequesterName(e.target.value)} placeholder="جستجو..." className="w-full p-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-[#3498db] focus:border-[#3498db]" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">واحد مربوطه</label>
              <input type="text" value={filterDepartment} onChange={(e) => setFilterDepartment(e.target.value)} placeholder="نام واحد..." className="w-full p-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-[#3498db] focus:border-[#3498db]" />
            </div>

            <div className="relative">
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-semibold text-gray-700">از تاریخ</label>
                {filterDateFrom && (
                  <button onClick={() => setFilterDateFrom('')} className="text-xs text-red-500 hover:text-red-700 cursor-pointer">
                    حذف ×
                  </button>
                )}
              </div>
              <PersianDatePicker value={filterDateFrom} onChange={(value) => setFilterDateFrom(value)} label="" placeholder="انتخاب تاریخ" />
            </div>

            <div className="relative">
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-semibold text-gray-700">تا تاریخ</label>
                {filterDateTo && (
                  <button onClick={() => setFilterDateTo('')} className="text-xs text-red-500 hover:text-red-700 cursor-pointer">
                    حذف ×
                  </button>
                )}
              </div>
              <PersianDatePicker value={filterDateTo} onChange={(value) => setFilterDateTo(value)} label="" placeholder="انتخاب تاریخ" />
            </div>
          </div>

          <div className="flex gap-2 mt-3">
            {hasActiveFilters && (
              <button onClick={clearFilters} className="px-4 py-2 bg-gray-500 text-white text-sm rounded-md hover:bg-gray-600 transition-colors cursor-pointer">
                پاک کردن فیلتر
              </button>
            )}
            <div className="text-sm text-gray-600 flex items-center">
              {hasActiveFilters && (
                <span> نمایش {filteredRequests.length} از {requests.length} درخواست </span>
              )}
            </div>
          </div>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="spinner mb-4"></div>
              <p className="text-gray-500 font-medium">در حال بارگذاری...</p>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="text-6xl mb-4">📋</div>
              <p className="text-gray-500 font-medium text-lg">
                {hasActiveFilters ? 'هیچ رکوردی با فیلترهای اعمال شده یافت نشد.' : 'هیچ رکوردی در تاریخچه شما یافت نشد.'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col h-full">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100 border-b-2 border-gray-300">
                      <th className="p-3 text-right font-bold text-gray-700">شماره درخواست</th>
                      <th className="p-3 text-right font-bold text-gray-700">نوع درخواست</th>
                      <th className="p-3 text-right font-bold text-gray-700">نام درخواست کننده</th>
                      <th className="p-3 text-right font-bold text-gray-700">واحد مربوطه</th>
                      <th className="p-3 text-right font-bold text-gray-700">تاریخ درخواست</th>
                      <th className="p-3 text-right font-bold text-gray-700">وضعیت</th>
                      <th className="p-3 text-right font-bold text-gray-700">جزئیات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRequests.map((request, index) => {
                      const isFileTransfer = request.requestType === RequestType.FILE_TRANSFER;
                      const isBackup = request.requestType === RequestType.BACKUP;
                      const isVDI = request.requestType === RequestType.VDI || request.requestType === 'VDI_OPEN';
                      
                      return (
                        <React.Fragment key={request.id}>
                          <tr className={`border-b border-gray-200 hover:bg-gray-100 cursor-pointer transition-colors ${index % 2 === 0 ? 'bg-blue-50' : 'bg-green-50'}`} onClick={() => toggleRow(request.id)}>
                            <td className="p-3 text-gray-800 font-semibold">#{request.id.split('-')[1]}</td>
                            <td className="p-3">
                              <span className={`px-2 py-1 text-xs font-semibold rounded ${isFileTransfer ? 'bg-blue-100 text-blue-800' : isVDI ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'}`}>
                                {isFileTransfer ? 'فایل' : isVDI ? 'VDI' : 'Backup'}
                              </span>
                            </td>
                            <td className="p-3 text-gray-700">{request.requesterName}</td>
                            <td className="p-3 text-gray-700">{(request as any).department || '—'}</td>
                            <td className="p-3 text-gray-600">{new Date(request.createdAt).toLocaleDateString('fa-IR')}</td>
                            <td className="p-3">
                              <span className={`px-3 py-1 text-sm font-semibold rounded-full ${STATUS_STYLES[request.status].bg} ${STATUS_STYLES[request.status].color}`}>
                                {STATUS_STYLES[request.status].text}
                              </span>
                            </td>
                            <td className="p-3">
                              <button className="text-[#3498db] hover:text-[#2980b9] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#3498db] focus:ring-offset-2 rounded px-2 py-1" aria-label={expandedRow === request.id ? 'بستن جزئیات' : 'نمایش جزئیات'} aria-expanded={expandedRow === request.id}>
                                {expandedRow === request.id ? 'کمتر ▼' : 'بیشتر ▶'}
                              </button>
                            </td>
                          </tr>
                          {expandedRow === request.id && (
                            <tr>
                              <td colSpan={7} className="p-4 bg-gray-50">
                                <div className="space-y-4">
                                  {isFileTransfer && request.files && (
                                    <div className="space-y-3">
                                      {request.files.map((file, fileIndex) => {
                                        const fileBgClass = fileIndex % 2 === 0 ? 'bg-blue-50 border-blue-200' : 'bg-green-50 border-green-200';
                                        const isFileExpanded = expandedFiles.has(file.id);
                                        
                                        return (
                                          <div key={file.id} className={`${fileBgClass} p-4 rounded border`}>
                                            {/* فیلدهای اصلی - همیشه نمایش داده می‌شوند */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm mb-3">
                                              <div className="md:col-span-2"><strong className="text-gray-600">نام فایل:</strong> {file.fileName}</div>
                                              <div><strong className="text-gray-600">آدرس IP مبدا:</strong> {file.sourceIP}</div>
                                              <div><strong className="text-gray-600">مسیر فایل مبدا:</strong> {file.sourceFilePath}</div>
                                              <div><strong className="text-gray-600">آدرس IP مقصد:</strong> {file.destinationIP}</div>
                                              <div><strong className="text-gray-600">مسیر فایل مقصد:</strong> {file.destinationFilePath}</div>
                                            </div>
                                            
                                            {/* دکمه توضیحات بیشتر - فقط اگر باز نشده باشد */}
                                            {!isFileExpanded && (
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  toggleFileDetails(file.id);
                                                }}
                                                className="text-[#3498db] hover:text-[#2980b9] font-semibold text-sm flex items-center gap-1 transition-colors"
                                              >
                                                <span>توضیحات بیشتر</span>
                                                <span>▼</span>
                                              </button>
                                            )}
                                            
                                            {/* فیلدهای اضافی - فقط بعد از کلیک نمایش داده می‌شوند */}
                                            {isFileExpanded && (
                                              <div className="mt-3 pt-3 border-t border-gray-300">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                                  <div className="md:col-span-2"><strong className="text-gray-600">محتوای فایل:</strong> {file.fileContent}</div>
                                                  <div><strong className="text-gray-600">فرمت فایل:</strong> {file.fileFormat}</div>
                                                  <div><strong className="text-gray-600">شخص/سازمان گیرنده:</strong> {file.recipient}</div>
                                                  <div className="md:col-span-2">
                                                    <strong className="text-gray-600">شماره نامه:</strong>{' '}
                                                    {editingLetterNumber?.requestId === request.id && editingLetterNumber?.fileId === file.id ? (
                                                      <div className="inline-flex items-center gap-2 mt-1">
                                                        <input type="text" value={letterNumberValue} onChange={(e) => setLetterNumberValue(e.target.value)} className="px-2 py-1 border border-gray-300 rounded text-sm" placeholder="شماره نامه را وارد کنید" autoFocus />
                                                        <button onClick={() => handleSaveLetterNumber(request.id, file.id)} className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600 cursor-pointer"> ذخیره </button>
                                                        <button onClick={handleCancelEdit} className="px-3 py-1 bg-gray-400 text-white rounded text-sm hover:bg-gray-500 cursor-pointer"> انصراف </button>
                                                      </div>
                                                    ) : (
                                                      <span className="text-gray-700">
                                                        {file.letterNumber || '—'}
                                                        {isRequester(request) && !file.letterNumber && (
                                                          <button onClick={() => handleEditLetterNumber(request.id, file.id)} className="mr-2 px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 cursor-pointer"> افزودن شماره نامه </button>
                                                        )}
                                                      </span>
                                                    )}
                                                  </div>
                                                  <div className="md:col-span-2"><strong className="text-gray-600">فیلدهای فایل:</strong> {file.fileFields || '—'}</div>
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                  
                                  {isBackup && request.backups && (
                                    <div className="space-y-3">
                                      {request.backups.map((backup, backupIndex) => {
                                        const backupBgClass = backupIndex % 2 === 0 ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200';
                                        return (
                                          <div key={backup.id} className={`${backupBgClass} p-4 rounded border`}>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                              <div><strong className="text-gray-600">IP سرور:</strong> {backup.serverIP}</div>
                                              <div><strong className="text-gray-600">نحوه بکاپ گیری:</strong> {backup.backupMethod === 'FULL' ? 'کامل' : 'تغییرات'}</div>
                                              <div className="md:col-span-2"><strong className="text-gray-600">مسیر نگهداری:</strong> {backup.storagePath || '—'}</div>
                                              <div><strong className="text-gray-600">زمان بندی:</strong> {backup.schedule}</div>
                                              <div><strong className="text-gray-600">مدت زمان نگهداری:</strong> {backup.retentionPeriod}</div>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                  
                                  {isVDI && request.vdis && (
                                    <div className="space-y-3">
                                      {request.vdis.map((vdi, vdiIndex) => {
                                        const vdiBgClass = vdiIndex % 2 === 0 ? 'bg-purple-50 border-purple-200' : 'bg-indigo-50 border-indigo-200';
                                        return (
                                          <div key={vdi.id} className={`${vdiBgClass} p-4 rounded border`}>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                              <div><strong className="text-gray-600">نوع مدیای انتقال DATA:</strong> {vdi.transferMediaType || '—'}</div>
                                              <div><strong className="text-gray-600">نام فایل یا فولدر:</strong> {vdi.fileOrFolderName || '—'}</div>
                                              <div><strong className="text-gray-600">آدرس مبدا:</strong> {vdi.sourceAddress || '—'}</div>
                                              <div><strong className="text-gray-600">آدرس مقصد:</strong> {vdi.destinationAddress || '—'}</div>
                                              <div className="md:col-span-2"><strong className="text-gray-600">نام سرور/ سامانه:</strong> {vdi.serverOrSystemName}</div>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                  
                                  <ApprovalStatus request={request} />
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

              {totalPages > 1 && (
                <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-200 px-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    قبلی
                  </button>
                  <span className="text-sm text-gray-700">
                    صفحه <span className="font-medium">{currentPage}</span> از <span className="font-medium">{totalPages}</span>
                  </span>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    بعدی
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="p-4 border-t bg-gray-50 rounded-b-lg flex justify-end">
          <button onClick={onClose} className="bg-gray-500 text-white px-6 py-2 rounded-md hover:bg-gray-600 transition-all focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 cursor-pointer font-medium" aria-label="بستن"> بستن </button>
        </div>
      </div>
    </div>
  );
};

export default HistoryModal;