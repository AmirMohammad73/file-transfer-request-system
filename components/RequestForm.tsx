
import React, { useState } from 'react';
import { FileDetail, User } from '../types';
import { PlusCircleIcon, SendIcon, Trash2Icon } from './icons';

interface RequestFormProps {
    currentUser: User;
    onSubmit: (files: FileDetail[]) => void;
}

const RequestForm: React.FC<RequestFormProps> = ({ currentUser, onSubmit }) => {
    const [files, setFiles] = useState<FileDetail[]>([
        { id: `file-${Date.now()}`, fileName: '', fileContent: '', fileFormat: '', recipient: '', letterNumber: '', fileFields: '' }
    ]);

    const handleFileChange = (index: number, field: keyof FileDetail, value: string) => {
        const newFiles = [...files];
        newFiles[index] = { ...newFiles[index], [field]: value };
        setFiles(newFiles);
    };

    const addFile = () => {
        setFiles([
            ...files,
            { id: `file-${Date.now()}`, fileName: '', fileContent: '', fileFormat: '', recipient: '', letterNumber: '', fileFields: '' }
        ]);
    };

    const removeFile = (id: string) => {
        if (files.length > 1) {
            setFiles(files.filter(file => file.id !== id));
        } else {
            alert('حداقل باید یک رکورد وجود داشته باشد.');
        }
    };
    
    const handleSubmit = () => {
        // Simple validation (letterNumber is optional)
        for (const file of files) {
            if (!file.fileName || !file.fileContent || !file.fileFormat || !file.recipient || !file.fileFields) {
                alert('لطفاً تمام فیلدهای الزامی را برای همه رکوردها پر کنید. (شماره نامه اختیاری است)');
                return;
            }
        }
        onSubmit(files);
        // Reset form
        setFiles([{ id: `file-${Date.now()}`, fileName: '', fileContent: '', fileFormat: '', recipient: '', letterNumber: '', fileFields: '' }]);
    };

    return (
        <div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="font-semibold text-gray-700 block mb-1">نام واحد مربوطه</label>
                        <input type="text" value={currentUser.department} disabled className="w-full p-2 border border-gray-300 rounded-md bg-gray-100 text-gray-700" />
                    </div>
                     <div>
                        <label className="font-semibold text-gray-700 block mb-1">نام و نام خانوادگی کارشناس</label>
                        <input type="text" value={currentUser.name} disabled className="w-full p-2 border border-gray-300 rounded-md bg-gray-100 text-gray-700" />
                    </div>
                </div>
            </div>

            <div id="records-container" className="space-y-5">
                {files.map((file, index) => (
                    <div key={file.id} className="bg-gray-50 border border-gray-200 rounded-lg p-5 relative">
                         <div className="absolute -top-3 right-5 bg-[#3498db] text-white px-3 py-1 text-sm font-bold rounded">مشخصات فایل</div>
                         <div className="flex justify-between items-center mt-3 mb-4">
                             <div className="text-sm font-semibold text-gray-500">مشخصات فایل</div>
                             {/*
                             <button onClick={() => removeFile(file.id)} className="flex items-center gap-2 px-3 py-1 bg-[#e74c3c] text-white rounded-md hover:bg-[#c0392b] transition-colors cursor-pointer">
                                <Trash2Icon className="w-4 h-4" />
                                <span>حذف</span>
                             </button>
                             */}
                         </div>
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div>
                                <label className="font-semibold text-sm text-gray-700 block mb-1">نام فایل</label>
                                <input type="text" value={file.fileName} onChange={e => handleFileChange(index, 'fileName', e.target.value)} className="w-full p-2 border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-[#3498db]" />
                            </div>
                            <div className="lg:col-span-2">
                                <label className="font-semibold text-sm text-gray-700 block mb-1">محتوای فایل</label>
                                <input type="text" value={file.fileContent} onChange={e => handleFileChange(index, 'fileContent', e.target.value)} className="w-full p-2 border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-[#3498db]" />
                            </div>
                            <div>
                                <label className="font-semibold text-sm text-gray-700 block mb-1">فرمت فایل</label>
                                <input type="text" value={file.fileFormat} onChange={e => handleFileChange(index, 'fileFormat', e.target.value)} placeholder="مثال: PDF, DOCX, XLSX" className="w-full p-2 border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-[#3498db]" />
                            </div>
                            <div className="lg:col-span-2">
                                <label className="font-semibold text-sm text-gray-700 block mb-1">شخص/سازمان گیرنده</label>
                                <input type="text" value={file.recipient} onChange={e => handleFileChange(index, 'recipient', e.target.value)} className="w-full p-2 border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-[#3498db]" />
                            </div>
                            <div>
                                <label className="font-semibold text-sm text-gray-700 block mb-1">شماره نامه ارسال فایل</label>
                                <input type="text" value={file.letterNumber} onChange={e => handleFileChange(index, 'letterNumber', e.target.value)} className="w-full p-2 border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-[#3498db]" />
                            </div>
                            <div className="lg:col-span-3">
                                <label className="font-semibold text-sm text-gray-700 block mb-1">فیلدهای فایل</label>
                                <textarea value={file.fileFields} onChange={e => handleFileChange(index, 'fileFields', e.target.value)} rows={3} className="w-full p-2 border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-[#3498db]" placeholder="اطلاعات اضافی یا فیلدهای مربوط به فایل را وارد کنید" />
                            </div>
                         </div>
                    </div>
                ))}
            </div>

            {/*
            <div className="flex justify-center my-6">
                <button onClick={addFile} className="flex items-center gap-2 px-6 py-3 bg-[#2ecc71] text-white font-semibold rounded-md hover:bg-[#27ae60] transition-colors transform hover:-translate-y-0.5 cursor-pointer">
                    <PlusCircleIcon className="w-6 h-6" />
                    <span>افزودن رکورد جدید</span>
                </button>
            </div>
            */}
            
            <div className="flex justify-center mt-8">
                 <button onClick={handleSubmit} className="flex items-center gap-3 px-10 py-4 bg-[#3498db] text-white font-bold text-lg rounded-md hover:bg-[#2980b9] transition-colors transform hover:-translate-y-0.5 cursor-pointer">
                    <SendIcon className="w-6 h-6" />
                    <span>ارسال درخواست</span>
                </button>
            </div>
        </div>
    );
};

export default RequestForm;
