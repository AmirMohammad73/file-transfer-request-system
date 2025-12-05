import React, { useState } from 'react';
import { FileDetail, BackupDetail, VDIDetail, User, RequestType } from '../types';
import { PlusCircleIcon, SendIcon, Trash2Icon } from './icons';
import { useToastContext } from './ToastContainer';

interface RequestFormProps {
    currentUser: User;
    onSubmit: (data: { type: RequestType; files?: FileDetail[]; backups?: BackupDetail[]; vdis?: VDIDetail[] }) => void;
}

const RequestForm: React.FC<RequestFormProps> = ({ currentUser, onSubmit }) => {
    const { showToast } = useToastContext();
    const [requestType, setRequestType] = useState<RequestType>(RequestType.FILE_TRANSFER);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // State for File Transfer form
    const [files, setFiles] = useState<FileDetail[]>([
        { id: `file-${Date.now()}`, fileName: '', fileContent: '', sourceIP: '', sourceFilePath: '', destinationIP: '', destinationFilePath: '', fileFormat: '', recipient: '', letterNumber: '', fileFields: '' }
    ]);

    // State for Backup form
    const [backups, setBackups] = useState<BackupDetail[]>([
        { id: `backup-${Date.now()}`, serverIP: '', backupMethod: 'FULL', storagePath: '', schedule: '', retentionPeriod: '' }
    ]);

    // State for VDI form
    const [vdis, setVdis] = useState<VDIDetail[]>([
        { id: `vdi-${Date.now()}`, transferMediaType: '', fileOrFolderName: '', sourceAddress: '', destinationAddress: '', serverOrSystemName: '' }
    ]);

    const handleFileChange = (index: number, field: keyof FileDetail, value: string) => {
        const newFiles = [...files];
        
        // Validate IP fields
        if (field === 'sourceIP' || field === 'destinationIP') {
            // Only allow numbers and dots
            const ipPattern = /^[0-9.]*$/;
            if (!ipPattern.test(value)) {
                return; // Don't update if invalid characters
            }
        }
        
        newFiles[index] = { ...newFiles[index], [field]: value };
        setFiles(newFiles);
    };

    const validateIP = (ip: string): boolean => {
        // Empty is invalid
        if (!ip || ip.trim() === '') return false;
        
        // Check format: should be xxx.xxx.xxx.xxx
        const parts = ip.split('.');
        if (parts.length !== 4) return false;
        
        // Each part should be a number between 0-255
        for (const part of parts) {
            const num = parseInt(part, 10);
            if (isNaN(num) || num < 0 || num > 255 || part !== num.toString()) {
                return false;
            }
        }
        
        return true;
    };

    const handleBackupChange = (index: number, field: keyof BackupDetail, value: string) => {
        const newBackups = [...backups];
        newBackups[index] = { ...newBackups[index], [field]: value };
        setBackups(newBackups);
    };

    const handleVDIChange = (index: number, field: keyof VDIDetail, value: string) => {
        const newVdis = [...vdis];
        newVdis[index] = { ...newVdis[index], [field]: value };
        setVdis(newVdis);
    };

    const addFile = () => {
        setFiles([
            ...files,
            { id: `file-${Date.now()}`, fileName: '', fileContent: '', sourceIP: '', sourceFilePath: '', destinationIP: '', destinationFilePath: '', fileFormat: '', recipient: '', letterNumber: '', fileFields: '' }
        ]);
    };

    const removeFile = (id: string) => {
        if (files.length > 1) {
            setFiles(files.filter(file => file.id !== id));
            showToast('رکورد با موفقیت حذف شد', 'success');
        } else {
            showToast('حداقل باید یک رکورد وجود داشته باشد', 'warning');
        }
    };

    const addBackup = () => {
        setBackups([
            ...backups,
            { id: `backup-${Date.now()}`, serverIP: '', backupMethod: 'FULL', storagePath: '', schedule: '', retentionPeriod: '' }
        ]);
    };

    const removeBackup = (id: string) => {
        if (backups.length > 1) {
            setBackups(backups.filter(backup => backup.id !== id));
            showToast('رکورد با موفقیت حذف شد', 'success');
        } else {
            showToast('حداقل باید یک رکورد وجود داشته باشد', 'warning');
        }
    };

    const addVdi = () => {
        setVdis([
            ...vdis,
            { id: `vdi-${Date.now()}`, transferMediaType: '', fileOrFolderName: '', sourceAddress: '', destinationAddress: '', serverOrSystemName: '' }
        ]);
    };

    const removeVdi = (id: string) => {
        if (vdis.length > 1) {
            setVdis(vdis.filter(vdi => vdi.id !== id));
            showToast('رکورد با موفقیت حذف شد', 'success');
        } else {
            showToast('حداقل باید یک رکورد وجود داشته باشد', 'warning');
        }
    };
    
    const handleSubmit = async () => {
        setIsSubmitting(true);
        
        try {
            if (requestType === RequestType.FILE_TRANSFER) {
                // Validation for File Transfer
                for (const file of files) {
                    // Check required fields (all except letterNumber)
                    if (!file.fileName || !file.fileContent || !file.sourceIP || !file.sourceFilePath || 
                        !file.destinationIP || !file.destinationFilePath || !file.fileFormat || 
                        !file.recipient || !file.fileFields) {
                        showToast('لطفاً تمام فیلدهای الزامی را برای همه رکوردها پر کنید. (فقط شماره نامه اختیاری است)', 'warning');
                        setIsSubmitting(false);
                        return;
                    }
                    
                    // Validate IP addresses
                    if (!validateIP(file.sourceIP)) {
                        showToast(`آدرس IP مبدا نامعتبر است: ${file.sourceIP}. لطفاً یک آدرس IP معتبر وارد کنید (مثال: 192.168.1.100)`, 'error');
                        setIsSubmitting(false);
                        return;
                    }
                    
                    if (!validateIP(file.destinationIP)) {
                        showToast(`آدرس IP مقصد نامعتبر است: ${file.destinationIP}. لطفاً یک آدرس IP معتبر وارد کنید (مثال: 192.168.1.100)`, 'error');
                        setIsSubmitting(false);
                        return;
                    }
                }
                onSubmit({ type: RequestType.FILE_TRANSFER, files });
            } else if (requestType === RequestType.BACKUP) {
                // Validation for Backup
                for (const backup of backups) {
                    if (!backup.serverIP || !backup.backupMethod || !backup.schedule || !backup.retentionPeriod) {
                        showToast('لطفاً تمام فیلدهای الزامی را برای همه رکوردها پر کنید. (مسیر نگهداری اختیاری است)', 'warning');
                        setIsSubmitting(false);
                        return;
                    }
                }
                onSubmit({ type: RequestType.BACKUP, backups });
            } else if (requestType === RequestType.VDI) {
                // Validation for VDI
                for (const vdi of vdis) {
                    if (!vdi.serverOrSystemName) {
                        showToast('لطفاً فیلد "نام سرور/ سامانه" را پر کنید.', 'warning');
                        setIsSubmitting(false);
                        return;
                    }
                }
                onSubmit({ type: RequestType.VDI, vdis });
            }
            
            showToast('درخواست با موفقیت ارسال شد', 'success');
            
            // Reset form
            setFiles([{ id: `file-${Date.now()}`, fileName: '', fileContent: '', sourceIP: '', sourceFilePath: '', destinationIP: '', destinationFilePath: '', fileFormat: '', recipient: '', letterNumber: '', fileFields: '' }]);
            setBackups([{ id: `backup-${Date.now()}`, serverIP: '', backupMethod: 'FULL', storagePath: '', schedule: '', retentionPeriod: '' }]);
            setVdis([{ id: `vdi-${Date.now()}`, transferMediaType: '', fileOrFolderName: '', sourceAddress: '', destinationAddress: '', serverOrSystemName: '' }]);
        } catch (error) {
            showToast('خطا در ارسال درخواست. لطفاً دوباره تلاش کنید.', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div>
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-5 mb-6 shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="font-semibold text-gray-700 block mb-2 text-sm">نام واحد مربوطه</label>
                        <input 
                            type="text" 
                            value={currentUser.department} 
                            disabled 
                            className="w-full p-2.5 border border-gray-300 rounded-md bg-gray-100 text-gray-700 cursor-not-allowed" 
                            aria-label="نام واحد مربوطه"
                        />
                    </div>
                    <div>
                        <label className="font-semibold text-gray-700 block mb-2 text-sm">نام و نام خانوادگی کارشناس</label>
                        <input 
                            type="text" 
                            value={currentUser.name} 
                            disabled 
                            className="w-full p-2.5 border border-gray-300 rounded-md bg-gray-100 text-gray-700 cursor-not-allowed" 
                            aria-label="نام و نام خانوادگی کارشناس"
                        />
                    </div>
                </div>
            </div>

            {/* Request Type Selector */}
            <div className="bg-gradient-to-r from-blue-50 to-green-50 border-2 border-blue-300 rounded-lg p-5 mb-6 shadow-md">
                <label className="font-bold text-gray-800 block mb-3 text-lg">نوع درخواست:</label>
                <select
                    value={requestType}
                    onChange={(e) => setRequestType(e.target.value as RequestType)}
                    className="w-full p-3 border-2 border-blue-400 rounded-md bg-white text-gray-800 font-semibold focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
                >
                    <option value={RequestType.FILE_TRANSFER}>فرم درخواست فایل از/به سرور (کد مدرک: NS-F-04-01)</option>
                    <option value={RequestType.BACKUP}>فرم درخواست تهیه Backup (کد مدرک: NS-F-05-01)</option>
                    <option value={RequestType.VDI}>فرم درخواست باز کردن VDI (کد مدرک: NS-F-01-01)</option>
                </select>
            </div>

            {/* File Transfer Form */}
            {requestType === RequestType.FILE_TRANSFER && (
                <div id="records-container" className="space-y-5">
                    {files.map((file, index) => (
                        <div key={file.id} className="bg-white border-2 border-gray-200 rounded-lg p-5 relative shadow-sm hover:shadow-md transition-shadow">
                            <div className="absolute -top-3 right-5 bg-[#3498db] text-white px-3 py-1 text-sm font-bold rounded shadow-md">مشخصات فایل</div>
                            <div className="flex justify-between items-center mt-3 mb-4">
                                <div className="text-sm font-semibold text-gray-500">مشخصات فایل {index + 1}</div>
                                <div className="flex gap-2">
                                    {files.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => removeFile(file.id)}
                                            className="flex items-center gap-1 px-3 py-1.5 bg-red-500 text-white text-sm rounded-md hover:bg-red-600 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                                            aria-label={`حذف رکورد ${index + 1}`}
                                        >
                                            <Trash2Icon className="w-4 h-4" />
                                            <span>حذف</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="font-semibold text-sm text-gray-700 block mb-1">
                                        نام فایل <span className="text-red-500">*</span>
                                    </label>
                                    <input 
                                        type="text" 
                                        value={file.fileName} 
                                        onChange={e => handleFileChange(index, 'fileName', e.target.value)} 
                                        className="w-full p-2.5 border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-[#3498db] focus:border-[#3498db] transition-all" 
                                        required
                                        aria-required="true"
                                    />
                                </div>
                                <div>
                                    <label className="font-semibold text-sm text-gray-700 block mb-1">
                                        محتوای فایل <span className="text-red-500">*</span>
                                    </label>
                                    <input 
                                        type="text" 
                                        value={file.fileContent} 
                                        onChange={e => handleFileChange(index, 'fileContent', e.target.value)} 
                                        className="w-full p-2 border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-[#3498db]" 
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="font-semibold text-sm text-gray-700 block mb-1">
                                        آدرس IP مبدا <span className="text-red-500">*</span>
                                    </label>
                                    <input 
                                        type="text" 
                                        value={file.sourceIP} 
                                        onChange={e => handleFileChange(index, 'sourceIP', e.target.value)} 
                                        placeholder="مثال: 192.168.1.100"
                                        className="w-full p-2 border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-[#3498db]" 
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="font-semibold text-sm text-gray-700 block mb-1">
                                        مسیر فایل مبدا <span className="text-red-500">*</span>
                                    </label>
                                    <input 
                                        type="text" 
                                        value={file.sourceFilePath} 
                                        onChange={e => handleFileChange(index, 'sourceFilePath', e.target.value)} 
                                        placeholder="مثال: /home/user/file.pdf"
                                        className="w-full p-2 border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-[#3498db]" 
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="font-semibold text-sm text-gray-700 block mb-1">
                                        آدرس IP مقصد <span className="text-red-500">*</span>
                                    </label>
                                    <input 
                                        type="text" 
                                        value={file.destinationIP} 
                                        onChange={e => handleFileChange(index, 'destinationIP', e.target.value)} 
                                        placeholder="مثال: 192.168.1.200"
                                        className="w-full p-2 border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-[#3498db]" 
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="font-semibold text-sm text-gray-700 block mb-1">
                                        مسیر فایل مقصد <span className="text-red-500">*</span>
                                    </label>
                                    <input 
                                        type="text" 
                                        value={file.destinationFilePath} 
                                        onChange={e => handleFileChange(index, 'destinationFilePath', e.target.value)} 
                                        placeholder="مثال: /var/www/uploads/file.pdf"
                                        className="w-full p-2 border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-[#3498db]" 
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="font-semibold text-sm text-gray-700 block mb-1">
                                        فرمت فایل <span className="text-red-500">*</span>
                                    </label>
                                    <input 
                                        type="text" 
                                        value={file.fileFormat} 
                                        onChange={e => handleFileChange(index, 'fileFormat', e.target.value)} 
                                        placeholder="مثال: PDF, DOCX, XLSX" 
                                        className="w-full p-2 border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-[#3498db]" 
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="font-semibold text-sm text-gray-700 block mb-1">
                                        شخص/سازمان گیرنده <span className="text-red-500">*</span>
                                    </label>
                                    <input 
                                        type="text" 
                                        value={file.recipient} 
                                        onChange={e => handleFileChange(index, 'recipient', e.target.value)} 
                                        className="w-full p-2 border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-[#3498db]" 
                                        required
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="font-semibold text-sm text-gray-700 block mb-1">
                                        شماره نامه ارسال فایل
                                    </label>
                                    <input 
                                        type="text" 
                                        value={file.letterNumber} 
                                        onChange={e => handleFileChange(index, 'letterNumber', e.target.value)} 
                                        className="w-full p-2 border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-[#3498db]" 
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="font-semibold text-sm text-gray-700 block mb-1">
                                        فیلدهای فایل <span className="text-red-500">*</span>
                                    </label>
                                    <textarea 
                                        value={file.fileFields} 
                                        onChange={e => handleFileChange(index, 'fileFields', e.target.value)} 
                                        rows={3} 
                                        className="w-full p-2 border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-[#3498db]" 
                                        placeholder="اطلاعات اضافی یا فیلدهای مربوط به فایل را وارد کنید" 
                                        required
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Backup Form */}
            {requestType === RequestType.BACKUP && (
                <div id="backup-container" className="space-y-5">
                    {backups.map((backup, index) => (
                        <div key={backup.id} className="bg-white border-2 border-gray-200 rounded-lg p-5 relative shadow-sm hover:shadow-md transition-shadow">
                            <div className="absolute -top-3 right-5 bg-[#2ecc71] text-white px-3 py-1 text-sm font-bold rounded shadow-md">مشخصات Backup</div>
                            <div className="flex justify-between items-center mt-3 mb-4">
                                <div className="text-sm font-semibold text-gray-500">مشخصات Backup {index + 1}</div>
                                <div className="flex gap-2">
                                    {backups.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => removeBackup(backup.id)}
                                            className="flex items-center gap-1 px-3 py-1.5 bg-red-500 text-white text-sm rounded-md hover:bg-red-600 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                                            aria-label={`حذف رکورد ${index + 1}`}
                                        >
                                            <Trash2Icon className="w-4 h-4" />
                                            <span>حذف</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="font-semibold text-sm text-gray-700 block mb-1">IP سرور <span className="text-red-500">*</span></label>
                                    <input 
                                        type="text" 
                                        value={backup.serverIP} 
                                        onChange={e => handleBackupChange(index, 'serverIP', e.target.value)} 
                                        placeholder="مثال: 192.168.1.100"
                                        className="w-full p-2 border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-[#2ecc71]" 
                                    />
                                </div>
                                <div>
                                    <label className="font-semibold text-sm text-gray-700 block mb-1">نحوه بکاپ گیری <span className="text-red-500">*</span></label>
                                    <select
                                        value={backup.backupMethod}
                                        onChange={e => handleBackupChange(index, 'backupMethod', e.target.value)}
                                        className="w-full p-2 border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-[#2ecc71]"
                                    >
                                        <option value="FULL">کامل</option>
                                        <option value="INCREMENTAL">تغییرات</option>
                                    </select>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="font-semibold text-sm text-gray-700 block mb-1">مسیر نگهداری (در صورت وجود)</label>
                                    <input 
                                        type="text" 
                                        value={backup.storagePath} 
                                        onChange={e => handleBackupChange(index, 'storagePath', e.target.value)} 
                                        placeholder="مثال: /backup/server1"
                                        className="w-full p-2 border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-[#2ecc71]" 
                                    />
                                </div>
                                <div>
                                    <label className="font-semibold text-sm text-gray-700 block mb-1">زمان بندی <span className="text-red-500">*</span></label>
                                    <input 
                                        type="text" 
                                        value={backup.schedule} 
                                        onChange={e => handleBackupChange(index, 'schedule', e.target.value)} 
                                        placeholder="مثال: روزانه ساعت 2 صبح"
                                        className="w-full p-2 border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-[#2ecc71]" 
                                    />
                                </div>
                                <div>
                                    <label className="font-semibold text-sm text-gray-700 block mb-1">مدت زمان نگهداری <span className="text-red-500">*</span></label>
                                    <input 
                                        type="text" 
                                        value={backup.retentionPeriod} 
                                        onChange={e => handleBackupChange(index, 'retentionPeriod', e.target.value)} 
                                        placeholder="مثال: 30 روز"
                                        className="w-full p-2 border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-[#2ecc71]" 
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                    <button
                        type="button"
                        onClick={addBackup}
                        className="flex items-center justify-center gap-2 w-full py-3 border-2 border-dashed border-[#2ecc71] rounded-lg text-[#2ecc71] font-semibold hover:bg-green-50 transition-colors focus:outline-none focus:ring-2 focus:ring-[#2ecc71] focus:ring-offset-2"
                        aria-label="افزودن رکورد جدید"
                    >
                        <PlusCircleIcon className="w-5 h-5" />
                        <span>افزودن رکورد جدید</span>
                    </button>
                </div>
            )}

            {/* VDI Form */}
            {requestType === RequestType.VDI && (
                <div id="vdi-container" className="space-y-5">
                    {vdis.map((vdi, index) => (
                        <div key={vdi.id} className="bg-white border-2 border-gray-200 rounded-lg p-5 relative shadow-sm hover:shadow-md transition-shadow">
                            <div className="absolute -top-3 right-5 bg-[#9b59b6] text-white px-3 py-1 text-sm font-bold rounded shadow-md">مشخصات VDI</div>
                            
                            <div className="flex justify-between items-center mt-3 mb-4">
                                <div className="text-sm font-semibold text-gray-500">مشخصات VDI {index + 1}</div>
                                <div className="flex gap-2">
                                    {vdis.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => removeVdi(vdi.id)}
                                            className="flex items-center gap-1 px-3 py-1.5 bg-red-500 text-white text-sm rounded-md hover:bg-red-600 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                                            aria-label={`حذف رکورد ${index + 1}`}
                                        >
                                            <Trash2Icon className="w-4 h-4" />
                                            <span>حذف</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                            
                            {/* Warning Message */}
                            <div className="mb-4 p-3 bg-yellow-50 border-r-4 border-yellow-400 rounded">
                                <p className="text-sm text-yellow-800 font-semibold">
                                    ⚠️ در صورت نیاز به انتقال فایل اطلاعات فرم را به صورت کامل پر کنید. در غیر این صورت ترتیب اثر داده نخواهد شد.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="font-semibold text-sm text-gray-700 block mb-1">نوع مدیای انتقال DATA</label>
                                    <input 
                                        type="text" 
                                        value={vdi.transferMediaType} 
                                        onChange={e => handleVDIChange(index, 'transferMediaType', e.target.value)} 
                                        placeholder="مثال: USB، Network، CD"
                                        className="w-full p-2 border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-[#9b59b6]" 
                                    />
                                </div>
                                <div>
                                    <label className="font-semibold text-sm text-gray-700 block mb-1">نام فایل یا فولدر</label>
                                    <input 
                                        type="text" 
                                        value={vdi.fileOrFolderName} 
                                        onChange={e => handleVDIChange(index, 'fileOrFolderName', e.target.value)} 
                                        placeholder="مثال: documents.zip"
                                        className="w-full p-2 border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-[#9b59b6]" 
                                    />
                                </div>
                                <div>
                                    <label className="font-semibold text-sm text-gray-700 block mb-1">آدرس مبدا</label>
                                    <input 
                                        type="text" 
                                        value={vdi.sourceAddress} 
                                        onChange={e => handleVDIChange(index, 'sourceAddress', e.target.value)} 
                                        placeholder="مثال: /home/user/files"
                                        className="w-full p-2 border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-[#9b59b6]" 
                                    />
                                </div>
                                <div>
                                    <label className="font-semibold text-sm text-gray-700 block mb-1">آدرس مقصد</label>
                                    <input 
                                        type="text" 
                                        value={vdi.destinationAddress} 
                                        onChange={e => handleVDIChange(index, 'destinationAddress', e.target.value)} 
                                        placeholder="مثال: /var/vdi/storage"
                                        className="w-full p-2 border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-[#9b59b6]" 
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="font-semibold text-sm text-gray-700 block mb-1">
                                        نام سرور/ سامانه <span className="text-red-500">*</span>
                                    </label>
                                    <input 
                                        type="text" 
                                        value={vdi.serverOrSystemName} 
                                        onChange={e => handleVDIChange(index, 'serverOrSystemName', e.target.value)} 
                                        placeholder="مثال: https://vdi.example.com یا 192.168.1.50"
                                        className="w-full p-2 border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-[#9b59b6]" 
                                        required
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                    <button
                        type="button"
                        onClick={addVdi}
                        className="flex items-center justify-center gap-2 w-full py-3 border-2 border-dashed border-[#9b59b6] rounded-lg text-[#9b59b6] font-semibold hover:bg-purple-50 transition-colors focus:outline-none focus:ring-2 focus:ring-[#9b59b6] focus:ring-offset-2"
                        aria-label="افزودن رکورد جدید"
                    >
                        <PlusCircleIcon className="w-5 h-5" />
                        <span>افزودن رکورد جدید</span>
                    </button>
                </div>
            )}
            
            <div className="flex justify-center mt-8">
                <button 
                    onClick={handleSubmit} 
                    disabled={isSubmitting}
                    className="flex items-center gap-3 px-10 py-4 bg-[#3498db] text-white font-bold text-lg rounded-md hover:bg-[#2980b9] disabled:bg-gray-400 disabled:cursor-not-allowed transition-all transform hover:-translate-y-0.5 active:translate-y-0 focus:outline-none focus:ring-2 focus:ring-[#3498db] focus:ring-offset-2"
                    aria-label="ارسال درخواست"
                >
                    {isSubmitting ? (
                        <>
                            <div className="spinner"></div>
                            <span>در حال ارسال...</span>
                        </>
                    ) : (
                        <>
                            <SendIcon className="w-6 h-6" />
                            <span>ارسال درخواست</span>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export default RequestForm;