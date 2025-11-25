
import React from 'react';
import { Request, User } from '../types';
import RequestItem from './RequestItem';

interface RequestListProps {
  requests: Request[];
  currentUser: User;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

const RequestList: React.FC<RequestListProps> = ({ requests, currentUser, onApprove, onReject }) => {
  return (
    <div>
        <h2 className="text-2xl font-bold text-center text-[#2c3e50] mb-6">درخواست‌های در انتظار بررسی</h2>
      {requests.length > 0 ? (
        requests.map(request => (
          <RequestItem
            key={request.id}
            request={request}
            currentUser={currentUser}
            onApprove={onApprove}
            onReject={onReject}
          />
        ))
      ) : (
        <div className="text-center py-10 px-6 bg-gray-50 rounded-lg">
          <p className="text-gray-600">در حال حاضر هیچ درخواستی برای بررسی شما وجود ندارد.</p>
        </div>
      )}
    </div>
  );
};

export default RequestList;
