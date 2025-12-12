import React, { useState } from 'react';
import { Request, User, Role, RequestType } from '../types';
import ApprovalStatus from './ApprovalStatus';
import { CheckCircleIcon, XCircleIcon } from './icons';
import ConfirmDialog from './ConfirmDialog';

interface RequestListProps {
  requests: Request[];
  currentUser: User;
  onApprove: (id: string) => void;
  onReject: (id: string, rejectionReason: string) => void;
}

const RequestList: React.FC<RequestListProps> = ({ requests, currentUser, onApprove, onReject }) => {
  const [expandedRequest, setExpandedRequest] = useState<string | null>(null);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  
  // State برای track کردن فایل‌هایی که توضیحات بیشترشان باز شده
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

  const toggleRequest = (requestId: string) => {
    if (expandedRequest === requestId) {
      setExpandedRequest(null);
    } else {
      setExpandedRequest(requestId);
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

  const handleApproveClick = (requestId: string) => {
    setSelectedRequestId(requestId);
    setShowApproveDialog(true);
  };

  const handleRejectClick = (requestId: string) => {
    setSelectedRequestId(requestId);
    setShowRejectDialog(true);
  };

  const handleApproveConfirm = () => {
    if (selectedRequestId) {
      setShowApproveDialog(false);
      onApprove(selectedRequestId);
      setSelectedRequestId(null);
    }
  };

  const handleRejectConfirm = (rejectionReason?: string) => {
    if (selectedRequestId && rejectionReason) {
      setShowRejectDialog(false);
      onReject(selectedRequestId, rejectionReason);
      setSelectedRequestId(null);
    }
  };

  const selectedRequest = requests.find(r => r.id === selectedRequestId);

  return (
    <>
      <ConfirmDialog
        isOpen={showApproveDialog}
        title="تایید درخواست"
        message={`آیا از ${currentUser.role === Role.NETWORK_ADMIN ? 'انجام و تکمیل' : 'تایید'} درخواست #${selectedRequest?.id.split('-')[1]} مطمئن هستید؟`}
        confirmText={currentUser.role === Role.NETWORK_ADMIN ? 'بله، انجام شد' : 'بله، تایید کن'}
        cancelText="انصراف"
        onConfirm={handleApproveConfirm}
        onCancel={() => {
          setShowApproveDialog(false);
          setSelectedRequestId(null);
        }}
        type="approve"
      />
      <ConfirmDialog
        isOpen={showRejectDialog}
        title="رد درخواست"
        message={`آیا از رد درخواست #${selectedRequest?.id.split('-')[1]} مطمئن هستید؟`}
        confirmText="بله، رد کن"
        cancelText="انصراف"
        onConfirm={handleRejectConfirm}
        onCancel={() => {
          setShowRejectDialog(false);
          setSelectedRequestId(null);
        }}
        type="reject"
      />
      <div>
        <h2 className="text-2xl font-bold text-center text-[#2c3e50] mb-6">درخواست‌های در انتظار بررسی</h2>
        {requests.length > 0 ? (
          <div className="space-y-3">
            {requests.map((request, index) => {
              const isExpanded = expandedRequest === request.id;
              const isFileTransfer = request.requestType === RequestType.FILE_TRANSFER;
              const isBackup = request.requestType === RequestType.BACKUP;
              const isVDI = request.requestType === RequestType.VDI || request.requestType === 'VDI_OPEN';
              
              return (
                <div key={request.id} className={`bg-white border-2 rounded-lg shadow-sm transition-all ${
                  isExpanded ? 'border-[#3498db]' : 'border-gray-200'
                } ${index % 2 === 0 ? 'bg-blue-50' : 'bg-green-50'}`}>
                  {/* Header - Always Visible */}
                  <div 
                    className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => toggleRequest(request.id)}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="font-bold text-lg text-[#2c3e50]">
                          #{request.id.split('-')[1]}
                        </div>
                        <span className={`text-xs px-2 py-1 rounded font-semibold ${
                          isFileTransfer ? 'bg-blue-100 text-blue-800' : 
                          isVDI ? 'bg-purple-100 text-purple-800' : 
                          'bg-green-100 text-green-800'
                        }`}>
                          {isFileTransfer ? 'فایل' : isVDI ? 'VDI' : 'Backup'}
                        </span>
                        {/* من اینجام - اضافه کردن واحد مربوطه */}
                        <div className="text-gray-700 flex flex-col md:flex-row md:items-center md:gap-4">
                          <div>
                            <span className="font-semibold">{request.requesterName}</span>
                          </div>
                          <div className="text-sm text-gray-500 mt-1 md:mt-0">
                            <span className="font-medium text-gray-600"></span>{' '}
                            <span className="bg-gray-100 px-2 py-1 rounded text-xs">
                              {request.department || 'تعیین نشده'}
                            </span>
                          </div>
                        </div>
                        <div className="text-sm text-gray-500">
                          {new Date(request.createdAt).toLocaleDateString('fa-IR')}
                        </div>
                      </div>
                      <button 
                        className="text-[#3498db] hover:text-[#2980b9] font-semibold px-4 py-2 rounded-md hover:bg-blue-50 transition-all focus:outline-none focus:ring-2 focus:ring-[#3498db] focus:ring-offset-2"
                        aria-label={isExpanded ? 'بستن جزئیات' : 'نمایش جزئیات'}
                        aria-expanded={isExpanded}
                      >
                        {isExpanded ? 'بستن ▼' : 'بیشتر ▶'}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="border-t border-gray-200 bg-white">
                      <div className="p-5">
                        {/* Action Buttons */}
                        <div className="flex gap-3 justify-end mb-4 pb-4 border-b border-dashed border-gray-300">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRejectClick(request.id);
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-[#e74c3c] text-white rounded-md hover:bg-[#c0392b] transition-all focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 cursor-pointer font-medium shadow-sm hover:shadow-md"
                            aria-label="رد درخواست"
                          >
                            <XCircleIcon className="w-5 h-5" />
                            <span>رد درخواست</span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleApproveClick(request.id);
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-[#2ecc71] text-white rounded-md hover:bg-[#27ae60] transition-all focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 cursor-pointer font-medium shadow-sm hover:shadow-md"
                            aria-label={currentUser.role === Role.NETWORK_ADMIN ? 'انجام و تکمیل درخواست' : 'تایید درخواست'}
                          >
                            <CheckCircleIcon className="w-5 h-5" />
                            <span>{currentUser.role === Role.NETWORK_ADMIN ? 'انجام و تکمیل' : 'تایید درخواست'}</span>
                          </button>
                        </div>

                        {/* File/Backup/VDI Details */}
                        <div className="space-y-4">
                          {isFileTransfer && request.files && request.files.map((file, fileIndex) => {
                            const isFileExpanded = expandedFiles.has(file.id);
                            
                            return (
                              <div key={file.id} className="p-3 bg-blue-50 rounded-md border border-blue-100">
                                <div className="font-bold text-gray-700 mb-2">فایل {fileIndex + 1}</div>
                                
                                {/* فیلدهای اصلی - همیشه نمایش داده می‌شوند */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm mb-3">
                                  <div className="md:col-span-2"><strong className="text-gray-500">نام فایل:</strong> {file.fileName}</div>
                                  <div><strong className="text-gray-500">آدرس IP مبدا:</strong> {file.sourceIP}</div>
                                  <div><strong className="text-gray-500">مسیر فایل مبدا:</strong> {file.sourceFilePath}</div>
                                  <div><strong className="text-gray-500">آدرس IP مقصد:</strong> {file.destinationIP}</div>
                                  <div><strong className="text-gray-500">مسیر فایل مقصد:</strong> {file.destinationFilePath}</div>
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
                                  <div className="mt-3 pt-3 border-t border-blue-200">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                                      <div className="md:col-span-2"><strong className="text-gray-500">محتوای فایل:</strong> {file.fileContent}</div>
                                      <div><strong className="text-gray-500">فرمت فایل:</strong> {file.fileFormat}</div>
                                      <div><strong className="text-gray-500">شخص/سازمان گیرنده:</strong> {file.recipient}</div>
                                      <div><strong className="text-gray-500">شماره نامه:</strong> {file.letterNumber || '—'}</div>
                                      <div className="md:col-span-2"><strong className="text-gray-500">فیلدهای فایل:</strong> <span className="text-gray-700">{file.fileFields || '—'}</span></div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {isBackup && request.backups && request.backups.map((backup, backupIndex) => (
                            <div key={backup.id} className="p-3 bg-green-50 rounded-md border border-green-100">
                              <div className="font-bold text-gray-700 mb-2">Backup {backupIndex + 1}</div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                                <div><strong className="text-gray-500">IP سرور:</strong> {backup.serverIP}</div>
                                <div><strong className="text-gray-500">نحوه بکاپ گیری:</strong> {backup.backupMethod === 'FULL' ? 'کامل' : 'تغییرات'}</div>
                                <div className="md:col-span-2"><strong className="text-gray-500">مسیر نگهداری:</strong> {backup.storagePath || '—'}</div>
                                <div><strong className="text-gray-500">زمان بندی:</strong> {backup.schedule}</div>
                                <div><strong className="text-gray-500">مدت زمان نگهداری:</strong> {backup.retentionPeriod}</div>
                              </div>
                            </div>
                          ))}

                          {isVDI && request.vdis && request.vdis.map((vdi, vdiIndex) => (
                            <div key={vdi.id} className="p-3 bg-purple-50 rounded-md border border-purple-100">
                              <div className="font-bold text-gray-700 mb-2">VDI {vdiIndex + 1}</div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                                <div><strong className="text-gray-500">نوع مدیای انتقال DATA:</strong> {vdi.transferMediaType || '—'}</div>
                                <div><strong className="text-gray-500">نام فایل یا فولدر:</strong> {vdi.fileOrFolderName || '—'}</div>
                                <div><strong className="text-gray-500">آدرس مبدا:</strong> {vdi.sourceAddress || '—'}</div>
                                <div><strong className="text-gray-500">آدرس مقصد:</strong> {vdi.destinationAddress || '—'}</div>
                                <div className="md:col-span-2"><strong className="text-gray-500">نام سرور/ سامانه:</strong> {vdi.serverOrSystemName}</div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Approval Status */}
                        <ApprovalStatus request={request} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16 px-6 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg border-2 border-dashed border-gray-300">
            <div className="text-6xl mb-4">📭</div>
            <p className="text-gray-600 font-medium text-lg">در حال حاضر هیچ درخواستی برای بررسی شما وجود ندارد.</p>
          </div>
        )}
      </div>
    </>
  );
};

export default RequestList;