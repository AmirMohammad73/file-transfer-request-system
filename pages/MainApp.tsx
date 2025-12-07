import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Request, Role, Status, FileDetail, BackupDetail, RequestType } from '../types';
import { ROLE_HIERARCHY } from '../constants';
import RequestForm from '../components/RequestForm';
import RequestList from '../components/RequestList';
import HistoryModal from '../components/HistoryModal';
import Header from '../components/Header';
import { useAuth } from '../auth/AuthContext';
import { useNotification } from '../hooks/useNotification';
import { requestsAPI } from '../utils/api';

const MainApp: React.FC = () => {
    const { user: currentUser } = useAuth();
    const [requests, setRequests] = useState<Request[]>([]);
    const [historyRequests, setHistoryRequests] = useState<Request[]>([]);
    const [loading, setLoading] = useState(true);
    const [isHistoryOpen, setHistoryOpen] = useState(false);
    const { showNotification } = useNotification();
    const previousPendingCountRef = useRef<number>(0);
    const previousPendingIdsRef = useRef<Set<string>>(new Set());
    const isFirstMountRef = useRef<boolean>(true);
    
    if (!currentUser) return null;

    useEffect(() => {
        const fetchRequests = async () => {
            try {
                setLoading(true);
                const fetchedRequests = await requestsAPI.getAll();
                setRequests(fetchedRequests);
            } catch (error) {
                console.error('Error fetching requests:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchRequests();

        if (currentUser.role !== Role.REQUESTER) {
            const interval = setInterval(() => {
                fetchRequests();
            }, 300000);

            return () => clearInterval(interval);
        }
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
    }, [currentUser]); 

    const pendingRequests = useMemo(() => {
        if (currentUser.role === Role.REQUESTER) return [];
        return requests.filter(req => req.status === Status.PENDING && req.currentApprover === currentUser.role);
    }, [requests, currentUser]);

    const sortedHistoryRequests = useMemo(() => {
        return historyRequests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [historyRequests]);

    useEffect(() => {
        if (currentUser.role === Role.REQUESTER) return;

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
                    : request.backups?.length || 0;
                const itemsType = request.requestType === RequestType.FILE_TRANSFER ? 'فایل' : 'درخواست backup';
                
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
    }, [pendingRequests, currentUser.role, showNotification]);

    const handleCreateRequest = async (data: { type: RequestType; files?: FileDetail[]; backups?: BackupDetail[] }) => {
        try {
            const newRequest = await requestsAPI.create(data);
            setRequests(prev => [newRequest, ...prev]);
            setHistoryRequests(prev => [newRequest, ...prev]);
            alert('درخواست شما با موفقیت ثبت و برای تایید ارسال شد.');
        } catch (error: any) {
            alert(error.message || 'خطا در ایجاد درخواست');
        }
    };

    const handleApprove = async (id: string) => {
        try {
            const updatedRequest = await requestsAPI.approve(id);
            setRequests(prev => prev.map(req => req.id === id ? updatedRequest : req));
            setHistoryRequests(prev => prev.map(req => req.id === id ? updatedRequest : req));
        } catch (error: any) {
            alert(error.message || 'خطا در تایید درخواست');
        }
    };

    const handleReject = async (id: string) => {
        try {
            const updatedRequest = await requestsAPI.reject(id);
            setRequests(prev => prev.map(req => req.id === id ? updatedRequest : req));
            setHistoryRequests(prev => prev.map(req => req.id === id ? updatedRequest : req));
        } catch (error: any) {
            alert(error.message || 'خطا در رد درخواست');
        }
    };

    return (
        <div className="bg-gray-100 min-h-screen pt-24 p-5">
            <Header onShowHistory={() => setHistoryOpen(true)} />
            <div className="max-w-7xl mx-auto">
                <div className="bg-white rounded-lg shadow-xl p-8">
                    <header className="text-center mb-8 pb-4 border-b-2 border-[#3498db] relative">
                        <h1 className="text-3xl font-bold text-[#2c3e50]">فرم درخواست فایل از سرور</h1>
                    </header>
                    
                    <main>
                        {loading ? (
                            <div className="text-center py-10">
                                <p className="text-gray-600">در حال بارگذاری...</p>
                            </div>
                        ) : currentUser.role === Role.REQUESTER ? (
                            <RequestForm currentUser={currentUser} onSubmit={handleCreateRequest} />
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
            <HistoryModal isOpen={isHistoryOpen} onClose={() => setHistoryOpen(false)} />
        </div>
    );
};

export default MainApp;