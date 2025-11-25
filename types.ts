
export enum Role {
  REQUESTER = 'REQUESTER',
  GROUP_LEAD = 'GROUP_LEAD',
  DEPUTY = 'DEPUTY',
  NETWORK_HEAD = 'NETWORK_HEAD',
  NETWORK_ADMIN = 'NETWORK_ADMIN',
}

export enum Status {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  COMPLETED = 'COMPLETED',
}

export interface FileDetail {
  id: string;
  fileName: string;
  fileContent: string;
  fileFormat: string;
  recipient: string; // شخص/سازمان گیرنده
  letterNumber?: string; // شماره نامه ارسال فایل (اختیاری)
  fileFields: string; // فیلدهای فایل (می‌تواند JSON string یا متن ساده باشد)
}

export interface Approval {
  approverRole: Role;
  approverName: string;
  status: Status.APPROVED | Status.REJECTED | Status.COMPLETED;
  date: string;
}

export interface Request {
  id: string;
  requesterName: string;
  department: string;
  files: FileDetail[];
  status: Status;
  approvalHistory: Approval[];
  currentApprover: Role | null;
  createdAt: string;
  requesterGroupId?: number; // شناسه گروه درخواست کننده
}

export interface User {
  id: number;
  name: string;
  username: string;
  password?: string;
  role: Role;
  department: string;
  groupIds?: number[]; // آرایه شناسه‌های گروه
}
