import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Request, Role, Status, FileDetail, BackupDetail, VDIDetail, TapeDetail, USBPortDetail, AppInstallDetail, VideoConferenceDetail, ServerRestartDetail, RequestType } from '../types';
import { ROLE_HIERARCHY } from '../constants';
import RequestForm from '../components/RequestForm';
import RequestList from '../components/RequestList';
import RejectedRequestsList from '../components/RejectedRequestsList';
import HistoryModal from '../components/HistoryModal';
import Header from '../components/Header';
import { useAuth } from '../auth/AuthContext';
import { useNotification } from '../hooks/useNotification';
import { requestsAPI } from '../utils/api';

const MainApp: React.FC = () => {
    const { user: currentUser } = useAuth();
    const [requests, setRequests] = useState<Request[]>([]);
    const [rejectedRequests, setRejectedRequests] = useState<Request[]>([]);
    const [historyRequests, setHistoryRequests] = useState<Request[]>([]);
    const [loading, setLoading] = useState(true);
    const [isHistoryOpen, setHistoryOpen] = useState(false);
    const { showNotification } = useNotification();
    const previousPendingCountRef = useRef<number>(0);
    const previousPendingIdsRef = useRef<Set<string>>(new Set());
    const isFirstMountRef = useRef<boolean>(true);
    
    const previousCompletedIdsRef = useRef<Set<string>>(new Set());
    const previousRejectedIdsRef = useRef<Set<string>>(new Set());
    
    if (!currentUser) return null;

    const isDesktopRequester =
        currentUser.role === Role.REQUESTER || currentUser.role === Role.V_REQUESTER;

    useEffect(() => {
        const fetchRequests = async () => {
            try {
                setLoading(true);
                const fetchedRequests = await requestsAPI.getAll();
                setRequests(fetchedRequests);
                
                // اگر کاربر درخواست‌دهنده است، درخواست‌های رد شده را هم بگیر
                if (isDesktopRequester) {
                    const fetchedRejected = await requestsAPI.getRejected();
                    setRejectedRequests(fetchedRejected);
                }
            } catch (error) {
                console.error('Error fetching requests:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchRequests();

        // برای همه کاربران هر 5 دقیقه (300000 میلی‌ثانیه) چک کن
        const interval = setInterval(() => {
            fetchRequests();
        }, 300000);

        return () => clearInterval(interval);
    }, [currentUser]);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const fetchedHistory = await requestsAPI.getHistory();
                setHistoryRequests(fetchedHistory);
            } catch (error) {
                console.error('Error fetching history:', error);
            }
        };

        fetchHistory();
        
        // برای همه کاربران هر 5 دقیقه (300000 میلی‌ثانیه) چک کن
        const interval = setInterval(() => {
            fetchHistory();
        }, 300000);
        
        return () => clearInterval(interval);
    }, [currentUser]); 

    const pendingRequests = useMemo(() => {
        if (isDesktopRequester) return [];
        return requests.filter(req => req.status === Status.PENDING && req.currentApprover === currentUser.role);
    }, [requests, currentUser, isDesktopRequester]);

    const sortedHistoryRequests = useMemo(() => {
        return historyRequests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [historyRequests]);

    // Notification برای تایید کنندگان (درخواست‌های جدید)
    useEffect(() => {
        if (isDesktopRequester) return;

        const currentPendingCount = pendingRequests.length;
        const currentPendingIds = new Set(pendingRequests.map(req => req.id));

        if (isFirstMountRef.current) {
            previousPendingCountRef.current = currentPendingCount;
            previousPendingIdsRef.current = currentPendingIds;
            isFirstMountRef.current = false;
            return;
        }

        if (currentPendingCount > previousPendingCountRef.current) {
            const newRequests = pendingRequests.filter(req => !previousPendingIdsRef.current.has(req.id));
            
            if (newRequests.length > 0) {
                const request = newRequests[0];
                const requesterName = request.requesterName;
                const itemsCount = request.requestType === RequestType.FILE_TRANSFER 
                    ? request.files?.length || 0 
                    : request.requestType === RequestType.BACKUP
                    ? request.backups?.length || 0
                    : request.requestType === RequestType.VDI
                    ? request.vdis?.length || 0
                    : request.requestType === RequestType.TAPE
                    ? request.tapes?.length || 0
                    : request.requestType === RequestType.USB_PORT
                    ? request.usbPorts?.length || 0
                        : request.requestType === RequestType.VIDEO_CONFRENCE
                        ? request.videoConferences?.length || 0
                        : request.requestType === RequestType.SERVER_RESTART
                        ? request.serverRestarts?.length || 0
                        : request.appInstalls?.length || 0;
                const itemsType = request.requestType === RequestType.FILE_TRANSFER 
                    ? 'فایل' 
                    : request.requestType === RequestType.BACKUP 
                    ? 'درخواست backup' 
                    : request.requestType === RequestType.VDI
                    ? 'درخواست VDI'
                    : request.requestType === RequestType.TAPE
                    ? 'درخواست Tape'
                    : request.requestType === RequestType.USB_PORT
                    ? 'درخواست USB Port'
                    : request.requestType === RequestType.VIDEO_CONFRENCE
                    ? 'درخواست ویدئو کنفرانس'
                    : request.requestType === RequestType.SERVER_RESTART
                    ? 'ریستارت سرور'
                    : 'درخواست نصب برنامه';
                
                showNotification({
                    title: 'درخواست جدید برای بررسی',
                    body: `یک درخواست جدید از ${requesterName} با ${itemsCount} ${itemsType} برای بررسی شما ارسال شده است.`,
                    tag: `request-${request.id}`,
                }).catch(error => {
                    console.error('خطا در نمایش Notification:', error);
                });
            }
        }

        previousPendingCountRef.current = currentPendingCount;
        previousPendingIdsRef.current = currentPendingIds;
    }, [pendingRequests, currentUser.role, showNotification, isDesktopRequester]);

    // Notification برای REQUESTER / V_REQUESTER (درخواست‌های تکمیل شده)
    useEffect(() => {
        if (!isDesktopRequester) return;

        const completedRequests = historyRequests.filter(req => req.status === Status.COMPLETED);
        const currentCompletedIds = new Set(completedRequests.map(req => req.id));

        const newlyCompletedIds = Array.from(currentCompletedIds).filter(
            id => !previousCompletedIdsRef.current.has(id)
        );

        if (newlyCompletedIds.length > 0 && previousCompletedIdsRef.current.size > 0) {
            newlyCompletedIds.forEach(id => {
                const request = completedRequests.find(req => req.id === id);
                if (request) {
                    const requestType = request.requestType === RequestType.FILE_TRANSFER 
                        ? 'انتقال فایل' 
                        : request.requestType === RequestType.BACKUP 
                        ? 'تهیه Backup' 
                        : request.requestType === RequestType.VDI
                        ? 'باز کردن VDI'
                        : request.requestType === RequestType.TAPE
                        ? 'تهیه پشتیبان از Tape'
                        : request.requestType === RequestType.USB_PORT
                        ? 'باز کردن USB Port'
                        : request.requestType === RequestType.VIDEO_CONFRENCE
                        ? 'ویدئو کنفرانس'
                        : request.requestType === RequestType.SERVER_RESTART
                        ? 'ریستارت سرور'
                        : 'نصب برنامه';
                    
                    showNotification({
                        title: '✅ درخواست شما انجام شد',
                        body: request.requestType === RequestType.VIDEO_CONFRENCE
                            ? `درخواست ویدئو کنفرانس شما (#${request.id.split('-')[1]}) تأیید و تکمیل شد. شماره اتاق در بخش تاریخچه نمایش داده می‌شود.`
                            : `درخواست ${requestType} شما (#${request.id.split('-')[1]}) با موفقیت توسط مسئول شبکه انجام و تکمیل شد.`,
                        tag: `completed-${request.id}`,
                    }).catch(error => {
                        console.error('خطا در نمایش Notification:', error);
                    });
                }
            });
        }

        previousCompletedIdsRef.current = currentCompletedIds;
    }, [historyRequests, showNotification, isDesktopRequester]);

    // Notification برای درخواست‌دهندگان (درخواست‌های رد شده - جدید)
    useEffect(() => {
        if (!isDesktopRequester) return;

        const currentRejectedIds = new Set(rejectedRequests.map(req => req.id));

        const newlyRejectedIds = Array.from(currentRejectedIds).filter(
            id => !previousRejectedIdsRef.current.has(id)
        );

        if (newlyRejectedIds.length > 0 && previousRejectedIdsRef.current.size > 0) {
            newlyRejectedIds.forEach(id => {
                const request = rejectedRequests.find(req => req.id === id);
                if (request) {
                    const requestType = request.requestType === RequestType.FILE_TRANSFER 
                        ? 'انتقال فایل' 
                        : request.requestType === RequestType.BACKUP 
                        ? 'تهیه Backup' 
                        : request.requestType === RequestType.VDI
                        ? 'باز کردن VDI'
                        : request.requestType === RequestType.TAPE
                        ? 'تهیه پشتیبان از Tape'
                        : request.requestType === RequestType.USB_PORT
                        ? 'باز کردن USB Port'
                        : request.requestType === RequestType.VIDEO_CONFRENCE
                        ? 'ویدئو کنفرانس'
                        : request.requestType === RequestType.SERVER_RESTART
                        ? 'ریستارت سرور'
                        : 'نصب برنامه';
                    
                    showNotification({
                        title: '❌ درخواست شما رد شد',
                        body: `درخواست ${requestType} شما (#${request.id.split('-')[1]}) رد شده است. لطفاً آن را بررسی و اصلاح کنید.`,
                        tag: `rejected-${request.id}`,
                    }).catch(error => {
                        console.error('خطا در نمایش Notification:', error);
                    });
                }
            });
        }

        previousRejectedIdsRef.current = currentRejectedIds;
    }, [rejectedRequests, showNotification, isDesktopRequester]);

    const handleCreateRequest = async (data: { type: RequestType; files?: FileDetail[]; backups?: BackupDetail[]; vdis?: VDIDetail[]; tapes?: TapeDetail[]; usbPorts?: USBPortDetail[]; appInstalls?: AppInstallDetail[]; serverRestarts?: ServerRestartDetail[]; videoConferences?: VideoConferenceDetail[] }) => {
        try {
            const newRequest = await requestsAPI.create(data);
            setRequests(prev => [newRequest, ...prev]);
            setHistoryRequests(prev => [newRequest, ...prev]);
            alert('درخواست شما با موفقیت ثبت و برای تایید ارسال شد.');
        } catch (error: any) {
            alert(error.message || 'خطا در ایجاد درخواست');
        }
    };

    const handleApprove = async (id: string, opts?: { approvalNote?: string; conferenceRoom?: string }) => {
        try {
            const updatedRequest = await requestsAPI.approve(id, opts);
            setRequests(prev => prev.map(req => req.id === id ? updatedRequest : req));
            setHistoryRequests(prev => prev.map(req => req.id === id ? updatedRequest : req));
        } catch (error: any) {
            alert(error.message || 'خطا در تایید درخواست');
        }
    };

    const handleReject = async (id: string, rejectionReason: string) => {
        try {
            const updatedRequest = await requestsAPI.reject(id, rejectionReason);
            setRequests(prev => prev.map(req => req.id === id ? updatedRequest : req));
            setHistoryRequests(prev => prev.map(req => req.id === id ? updatedRequest : req));
            
            // اضافه کردن به لیست درخواست‌های رد شده اگر کاربر REQUESTER باشد
            if (isDesktopRequester) {
                setRejectedRequests(prev => [updatedRequest, ...prev]);
            }
        } catch (error: any) {
            alert(error.message || 'خطا در رد درخواست');
        }
    };

    const handleCancelRequest = async (id: string) => {
        try {
            const cancelledRequest = await requestsAPI.cancel(id);
            // حذف از لیست درخواست‌های رد شده
            setRejectedRequests(prev => prev.filter(req => req.id !== id));
            // به‌روزرسانی وضعیت درخواست در تاریخچه به جای حذف
            setHistoryRequests(prev => prev.map(req => 
                req.id === id ? cancelledRequest : req
            ));
            alert('درخواست با موفقیت لغو شد.');
        } catch (error: any) {
            alert(error.message || 'خطا در لغو درخواست');
        }
    };

    const handleReviseRequest = async (id: string, data: { type: RequestType; files?: FileDetail[]; backups?: BackupDetail[]; vdis?: VDIDetail[]; tapes?: TapeDetail[]; usbPorts?: USBPortDetail[]; appInstalls?: AppInstallDetail[]; serverRestarts?: ServerRestartDetail[]; videoConferences?: VideoConferenceDetail[] }) => {
        try {
            const updatedRequest = await requestsAPI.revise(id, data);
            // حذف از لیست رد شده و اضافه به pending
            setRejectedRequests(prev => prev.filter(req => req.id !== id));
            setRequests(prev => [updatedRequest, ...prev]);
            setHistoryRequests(prev => prev.map(req => req.id === id ? updatedRequest : req));
            alert('درخواست با موفقیت اصلاح و دوباره ارسال شد.');
        } catch (error: any) {
            alert(error.message || 'خطا در اصلاح درخواست');
        }
    };

    const hasRejectedRequests = rejectedRequests.length > 0;

    return (
        <div className="bg-gray-100 dark:bg-slate-900 min-h-screen pt-24 p-5 transition-colors duration-200">
            <Header onShowHistory={() => setHistoryOpen(true)} />
            <div className="max-w-7xl mx-auto">
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-8 border border-gray-200 dark:border-slate-600 transition-colors duration-200">
                    <header className="text-center mb-8 pb-4 border-b-2 border-[#3498db] dark:border-sky-500 relative">
                        <h1 className="text-3xl font-bold text-[#2c3e50] dark:text-slate-100">
                            {isDesktopRequester ? 'فرم درخواست به مرکز داده' : 'درخواست‌های در انتظار بررسی'}
                        </h1>
                    </header>
                    
                    <main>
                        {loading ? (
                            <div className="text-center py-10">
                                <div className="spinner mx-auto mb-4"></div>
                                <p className="text-gray-600 dark:text-slate-300">در حال بارگذاری...</p>
                            </div>
                        ) : isDesktopRequester ? (
                            <>
                                {hasRejectedRequests ? (
                                    <RejectedRequestsList 
                                        requests={rejectedRequests}
                                        currentUser={currentUser}
                                        onCancel={handleCancelRequest}
                                        onRevise={handleReviseRequest}
                                    />
                                ) : (
                                    <RequestForm currentUser={currentUser} onSubmit={handleCreateRequest} />
                                )}
                            </>
                        ) : (
                            <RequestList
                                requests={pendingRequests}
                                currentUser={currentUser}
                                onApprove={handleApprove}
                                onReject={handleReject}
                            />
                        )}
                    </main>
                </div>
            </div>
            <HistoryModal 
                isOpen={isHistoryOpen} 
                onClose={() => setHistoryOpen(false)} 
                onCancel={handleCancelRequest}
            />
        </div>
    );
};

export default MainApp;