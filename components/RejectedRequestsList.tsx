import React, { useState } from 'react';
import { Request, RequestType } from '../types';
import ApprovalStatus from './ApprovalStatus';
import { XCircleIcon } from './icons';
import ConfirmDialog from './ConfirmDialog';
import RequestForm from './RequestForm';

interface RejectedRequestsListProps {
  requests: Request[];
  onCancel: (id: string) => void;
  onRevise: (id: string, data: any) => void;
}

const RejectedRequestsList: React.FC<RejectedRequestsListProps> = ({ requests, onCancel, onRevise }) => {
  const [expandedRequest, setExpandedRequest] = useState<string | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

  const toggleRequest = (requestId: string) => {
    if (expandedRequest === requestId) {
      setExpandedRequest(null);
    } else {
      setExpandedRequest(requestId);
    }
  };

  const toggleFileDetails = (fileId: string) => {
    setExpandedFiles(prev => {
      const newSet = new Set(prev);
      newSet.add(fileId);
      return newSet;
    });
  };

  const handleCancelClick = (requestId: string) => {
    setSelectedRequestId(requestId);
    setShowCancelDialog(true);
  };

  const handleCancelConfirm = () => {
    if (selectedRequestId) {
      setShowCancelDialog(false);
      onCancel(selectedRequestId);
      setSelectedRequestId(null);
    }
  };

  const handleEditClick = (requestId: string) => {
    setEditingRequestId(requestId);
  };

  const handleEditSubmit = (data: any) => {
    if (editingRequestId) {
      onRevise(editingRequestId, data);
      setEditingRequestId(null);
    }
  };

  const handleEditCancel = () => {
    setEditingRequestId(null);
  };

  const selectedRequest = requests.find(r => r.id === selectedRequestId);
  const editingRequest = requests.find(r => r.id === editingRequestId);

  if (editingRequest) {
    // نمایش فرم ویرایش
    return (
      <div className="bg-white rounded-lg shadow-xl p-8 mb-6">
        <div className="mb-6 pb-4 border-b-2 border-[#e74c3c]">
          <h2 className="text-2xl font-bold text-[#e74c3c] text-center">
            اصلاح درخواست رد شده #{editingRequest.id.split('-')[1]}
          </h2>
          <p className="text-center text-gray-600 mt-2">
            لطفاً اطلاعات درخواست را اصلاح کرده و دوباره ارسال کنید
          </p>
        </div>

        <RequestForm 
          currentUser={{
            id: editingRequest.requesterId || 0,
            name: editingRequest.requesterName,
            department: editingRequest.department,
            role: 'REQUESTER' as any,
          }}
          onSubmit={handleEditSubmit}
          initialData={{
            ...editingRequest,
            requestType: editingRequest.requestType,
            files: editingRequest.files || [],
            backups: editingRequest.backups || [],
            vdis: editingRequest.vdis || [],
          }}
          isEditing={true}
        />

        <div className="flex justify-center mt-6">
          <button
            onClick={handleEditCancel}
            className="px-6 py-3 bg-gray-500 text-white font-bold rounded-md hover:bg-gray-600 transition-all cursor-pointer"
          >
            انصراف از ویرایش
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <ConfirmDialog
        isOpen={showCancelDialog}
        title="لغو درخواست"
        message={`آیا از لغو درخواست #${selectedRequest?.id.split('-')[1]} مطمئن هستید؟ این عملیات غیرقابل بازگشت است.`}
        confirmText="بله، لغو کن"
        cancelText="انصراف"
        onConfirm={handleCancelConfirm}
        onCancel={() => {
          setShowCancelDialog(false);
          setSelectedRequestId(null);
        }}
        type="cancel"
      />

      <div>
        <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 mb-6">
          <h2 className="text-2xl font-bold text-center text-[#e74c3c] mb-2">
            ⚠️ درخواست‌های رد شده
          </h2>
          <p className="text-center text-gray-700">
            شما {requests.length} درخواست رد شده دارید. لطفاً آن‌ها را اصلاح و دوباره ارسال کنید یا لغو کنید.
          </p>
          <p className="text-center text-red-600 font-semibold mt-2">
            تا زمانی که این درخواست‌ها را تعیین تکلیف نکنید، نمی‌توانید درخواست جدید ارسال کنید.
          </p>
        </div>

        <div className="space-y-3">
          {requests.map((request, index) => {
            const isExpanded = expandedRequest === request.id;
            const isFileTransfer = request.requestType === RequestType.FILE_TRANSFER;
            const isBackup = request.requestType === RequestType.BACKUP;
            const isVDI = request.requestType === RequestType.VDI || request.requestType === 'VDI_OPEN';
            const isTape = request.requestType === RequestType.TAPE;
            const isUSBPort = request.requestType === RequestType.USB_PORT;
            const isAppInstall = request.requestType === RequestType.APP_INSTALL;
            
            return (
              <div key={request.id} className={`bg-white border-2 rounded-lg shadow-sm transition-all ${
                isExpanded ? 'border-[#e74c3c]' : 'border-red-300'
              } bg-red-50`}>
                {/* Header */}
                <div 
                  className="p-4 cursor-pointer hover:bg-red-100 transition-colors"
                  onClick={() => toggleRequest(request.id)}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="font-bold text-lg text-[#e74c3c]">
                        #{request.id.split('-')[1]}
                      </div>
                      <span className={`text-xs px-2 py-1 rounded font-semibold ${
                        isFileTransfer ? 'bg-blue-100 text-blue-800' : 
                        isVDI ? 'bg-purple-100 text-purple-800' : 
                        isTape ? 'bg-orange-100 text-orange-800' :
                        isUSBPort ? 'bg-teal-100 text-teal-800' :
                        isAppInstall ? 'bg-purple-100 text-purple-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {isFileTransfer ? 'فایل' : isVDI ? 'VDI' : isTape ? 'Tape' : isUSBPort ? 'USB Port' : isAppInstall ? 'نصب برنامه' : 'Backup'}
                      </span>
                      <div className="text-sm text-gray-700">
                        {new Date(request.createdAt).toLocaleDateString('fa-IR')}
                      </div>
                      <div className="text-sm text-red-600 font-semibold">
                        رد شده
                      </div>
                    </div>
                    <button 
                      className="text-[#e74c3c] hover:text-[#c0392b] font-semibold px-4 py-2 rounded-md hover:bg-red-100 transition-all"
                      aria-expanded={isExpanded}
                    >
                      {isExpanded ? 'بستن ▼' : 'بیشتر ▶'}
                    </button>
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t border-red-300 bg-white">
                    <div className="p-5">
                      {/* دلیل رد */}
                      {request.rejectionReason && (
                        <div className="mb-4 p-4 bg-red-50 border-2 border-red-300 rounded-lg">
                          <div className="font-bold text-red-700 mb-2 flex items-center gap-2">
                            <XCircleIcon className="w-5 h-5" />
                            <span>دلیل رد درخواست:</span>
                          </div>
                          <p className="text-red-600 leading-relaxed">{request.rejectionReason}</p>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex gap-3 justify-end mb-4 pb-4 border-b border-dashed border-gray-300">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCancelClick(request.id);
                          }}
                          className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-all cursor-pointer font-medium shadow-sm hover:shadow-md"
                        >
                          <XCircleIcon className="w-5 h-5" />
                          <span>انصراف از درخواست</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditClick(request.id);
                          }}
                          className="flex items-center gap-2 px-4 py-2 bg-[#3498db] text-white rounded-md hover:bg-[#2980b9] transition-all cursor-pointer font-medium shadow-sm hover:shadow-md"
                        >
                          <span>✏️</span>
                          <span>اصلاح و ارسال مجدد</span>
                        </button>
                      </div>

                      {/* File/Backup/VDI Details */}
                      <div className="space-y-4">
                        {isFileTransfer && request.files && request.files.map((file, fileIndex) => {
                          const isFileExpanded = expandedFiles.has(file.id);
                          
                          return (
                            <div key={file.id} className="p-3 bg-blue-50 rounded-md border border-blue-100">
                              <div className="font-bold text-gray-700 mb-2">فایل {fileIndex + 1}</div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm mb-3">
                                <div className="md:col-span-2"><strong className="text-gray-500">نام فایل:</strong> {file.fileName}</div>
                                <div><strong className="text-gray-500">آدرس IP مبدا:</strong> {file.sourceIP}</div>
                                <div><strong className="text-gray-500">مسیر فایل مبدا:</strong> {file.sourceFilePath}</div>
                                <div><strong className="text-gray-500">آدرس IP مقصد:</strong> {file.destinationIP}</div>
                                <div><strong className="text-gray-500">مسیر فایل مقصد:</strong> {file.destinationFilePath}</div>
                              </div>
                              
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
                              
                              {isFileExpanded && (
                                <div className="mt-3 pt-3 border-t border-blue-200">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                                    <div className="md:col-span-2"><strong className="text-gray-500">محتوای فایل:</strong> {file.fileContent}</div>
                                    <div><strong className="text-gray-500">فرمت فایل:</strong> {file.fileFormat}</div>
                                    <div><strong className="text-gray-500">شخص/سازمان گیرنده:</strong> {file.recipient}</div>
                                    <div><strong className="text-gray-500">شماره نامه:</strong> {file.letterNumber || '—'}</div>
                                    <div className="md:col-span-2"><strong className="text-gray-500">فیلدهای فایل:</strong> {file.fileFields || '—'}</div>
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

                        {isTape && request.tapes && request.tapes.map((tape, tapeIndex) => (
                          <div key={tape.id} className="p-3 bg-orange-50 rounded-md border border-orange-100">
                            <div className="font-bold text-gray-700 mb-2">Tape {tapeIndex + 1}</div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                              <div><strong className="text-gray-500">IP سرور:</strong> {tape.serverIP}</div>
                              <div><strong className="text-gray-500">نام فایل:</strong> {tape.fileName}</div>
                              <div className="md:col-span-2"><strong className="text-gray-500">مسیر فایل:</strong> {tape.filePath}</div>
                            </div>
                          </div>
                        ))}

                        {isUSBPort && request.usbPorts && request.usbPorts.map((usbPort, usbIndex) => (
                          <div key={usbPort.id} className="p-3 bg-teal-50 rounded-md border border-teal-100">
                            <div className="font-bold text-gray-700 mb-2">USB Port {usbIndex + 1}</div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                              <div><strong className="text-gray-500">IP سرور:</strong> {usbPort.serverIP}</div>
                              <div><strong className="text-gray-500">مدت زمان:</strong> {usbPort.duration || '—'}</div>
                            </div>
                          </div>
                        ))}

                        {isAppInstall && request.appInstalls && request.appInstalls.map((appInstall, appIndex) => (
                          <div key={appInstall.id} className="p-3 bg-purple-50 rounded-md border border-purple-100">
                            <div className="font-bold text-gray-700 mb-2">نصب برنامه {appIndex + 1}</div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                              <div><strong className="text-gray-500">IP سرور:</strong> {appInstall.serverIP}</div>
                              <div><strong className="text-gray-500">نام برنامه یا لینک:</strong> {appInstall.appNameOrLink}</div>
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
      </div>
    </>
  );
};

export default RejectedRequestsList;