
import React, { useState, useEffect } from 'react';
import { Request } from '../types';
import { STATUS_STYLES } from '../constants';
import ApprovalStatus from './ApprovalStatus';
import { requestsAPI } from '../utils/api';
import { useAuth } from '../auth/AuthContext';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  requests?: Request[]; // Optional now, will fetch if not provided
}

const HistoryModal: React.FC<HistoryModalProps> = ({ isOpen, onClose, requests: initialRequests }) => {
  const [requests, setRequests] = useState<Request[]>(initialRequests || []);
  const [loading, setLoading] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null); // Only one row can be expanded
  const { user } = useAuth();
  const [editingLetterNumber, setEditingLetterNumber] = useState<{ requestId: string; fileId: string } | null>(null);
  const [letterNumberValue, setLetterNumberValue] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
    }
  }, [isOpen]);

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

  const toggleRow = (requestId: string) => {
    // If clicking the same row, close it. Otherwise, open the new one and close the previous
    if (expandedRow === requestId) {
      setExpandedRow(null);
    } else {
      setExpandedRow(requestId);
    }
  };

  const handleEditLetterNumber = (requestId: string, fileId: string, currentValue?: string) => {
    setEditingLetterNumber({ requestId, fileId });
    setLetterNumberValue(currentValue || '');
  };

  const handleSaveLetterNumber = async (requestId: string, fileId: string) => {
    if (!letterNumberValue.trim()) {
      alert('لطفاً شماره نامه را وارد کنید');
      return;
    }

    try {
      const result = await requestsAPI.updateLetterNumber(requestId, fileId, letterNumberValue);
      // Update the request in local state
      setRequests(prev => prev.map(req => 
        req.id === requestId 
          ? { ...req, files: result.files }
          : req
      ));
      setEditingLetterNumber(null);
      setLetterNumberValue('');
    } catch (error: any) {
      alert(error.message || 'خطا در به‌روزرسانی شماره نامه');
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-7xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="bg-[#3498db] text-white p-4 rounded-t-lg flex justify-between items-center">
          <h2 className="text-xl font-bold">تاریخچه درخواست‌ها</h2>
          <button onClick={onClose} className="text-2xl cursor-pointer hover:opacity-80">&times;</button>
        </div>
        <div className="p-6 overflow-y-auto">
          {loading ? (
            <p className="text-center text-gray-500 py-10">در حال بارگذاری...</p>
          ) : requests.length === 0 ? (
            <p className="text-center text-gray-500 py-10">هیچ رکوردی در تاریخچه شما یافت نشد.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100 border-b-2 border-gray-300">
                    <th className="p-3 text-right font-bold text-gray-700">شماره درخواست</th>
                    <th className="p-3 text-right font-bold text-gray-700">نام درخواست کننده</th>
                    <th className="p-3 text-right font-bold text-gray-700">تاریخ درخواست</th>
                    <th className="p-3 text-right font-bold text-gray-700">وضعیت</th>
                    <th className="p-3 text-right font-bold text-gray-700">جزئیات</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((request, index) => (
                    <React.Fragment key={request.id}>
                      <tr 
                        className={`border-b border-gray-200 hover:bg-gray-100 cursor-pointer transition-colors ${
                          index % 2 === 0 ? 'bg-blue-50' : 'bg-green-50'
                        }`}
                        onClick={() => toggleRow(request.id)}
                      >
                        <td className="p-3 text-gray-800 font-semibold">#{request.id.split('-')[1]}</td>
                        <td className="p-3 text-gray-700">{request.requesterName}</td>
                        <td className="p-3 text-gray-600">{new Date(request.createdAt).toLocaleDateString('fa-IR')}</td>
                        <td className="p-3">
                          <span className={`px-3 py-1 text-sm font-semibold rounded-full ${STATUS_STYLES[request.status].bg} ${STATUS_STYLES[request.status].color}`}>
                            {STATUS_STYLES[request.status].text}
                          </span>
                        </td>
                        <td className="p-3">
                          <button className="text-[#3498db] hover:text-[#2980b9] font-semibold">
                            {expandedRow === request.id ? 'کمتر ▼' : 'بیشتر ▶'}
                          </button>
                        </td>
                      </tr>
                      {expandedRow === request.id && (
                        <tr>
                          <td colSpan={5} className="p-4 bg-gray-50">
                            <div className="space-y-4">
                              <div className="space-y-3">
                                {request.files.map((file, index) => {
                                  const fileBgClass = index % 2 === 0
                                    ? 'bg-blue-50 border-blue-200'
                                    : 'bg-green-50 border-green-200';
                                  return (
                                  <div key={file.id} className={`${fileBgClass} p-4 rounded border`}>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                                      <div><strong className="text-gray-600">نام فایل:</strong> {file.fileName}</div>
                                      <div className="lg:col-span-2"><strong className="text-gray-600">محتوای فایل:</strong> {file.fileContent}</div>
                                      <div><strong className="text-gray-600">فرمت فایل:</strong> {file.fileFormat}</div>
                                      <div className="lg:col-span-2"><strong className="text-gray-600">شخص/سازمان گیرنده:</strong> {file.recipient}</div>
                                      <div className="lg:col-span-3">
                                        <strong className="text-gray-600">شماره نامه:</strong>{' '}
                                        {editingLetterNumber?.requestId === request.id && editingLetterNumber?.fileId === file.id ? (
                                          <div className="inline-flex items-center gap-2 mt-1">
                                            <input
                                              type="text"
                                              value={letterNumberValue}
                                              onChange={(e) => setLetterNumberValue(e.target.value)}
                                              className="px-2 py-1 border border-gray-300 rounded text-sm"
                                              placeholder="شماره نامه را وارد کنید"
                                              autoFocus
                                            />
                                            <button
                                              onClick={() => handleSaveLetterNumber(request.id, file.id)}
                                              className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600 cursor-pointer"
                                            >
                                              ذخیره
                                            </button>
                                            <button
                                              onClick={handleCancelEdit}
                                              className="px-3 py-1 bg-gray-400 text-white rounded text-sm hover:bg-gray-500 cursor-pointer"
                                            >
                                              انصراف
                                            </button>
                                          </div>
                                        ) : (
                                          <span className="text-gray-700">
                                            {file.letterNumber || '—'}
                                            {isRequester(request) && !file.letterNumber && (
                                              <button
                                                onClick={() => handleEditLetterNumber(request.id, file.id)}
                                                className="mr-2 px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 cursor-pointer"
                                              >
                                                افزودن شماره نامه
                                              </button>
                                            )}
                                          </span>
                                        )}
                                      </div>
                                      <div className="lg:col-span-3"><strong className="text-gray-600">فیلدهای فایل:</strong> {file.fileFields || '—'}</div>
                                    </div>
                                  </div>
                                )})}
                              </div>
                              <ApprovalStatus request={request} />
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="p-4 border-t bg-gray-50 rounded-b-lg text-left">
          <button onClick={onClose} className="bg-gray-500 text-white px-6 py-2 rounded-md hover:bg-gray-600 transition cursor-pointer">بستن</button>
        </div>
      </div>
    </div>
  );
};

export default HistoryModal;
