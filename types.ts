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

export enum RequestType {
  FILE_TRANSFER = 'FILE_TRANSFER',  // فرم درخواست فایل از/به سرور
  BACKUP = 'BACKUP',                // فرم درخواست تهیه Backup
  VDI = 'VDI',                      // فرم درخواست باز کردن VDI
}

export interface FileDetail {
  id: string;
  fileName: string;
  fileContent: string;
  sourceIP: string;           // آدرس IP مبدا
  sourceFilePath: string;      // مسیر فایل مبدا
  destinationIP: string;       // آدرس IP مقصد
  destinationFilePath: string; // مسیر فایل مقصد
  fileFormat: string;
  recipient: string;
  letterNumber?: string;
  fileFields: string;
}

export interface BackupDetail {
  id: string;
  serverIP: string;           // IP سرور
  backupMethod: 'FULL' | 'INCREMENTAL';  // نحوه بکاپ گیری
  storagePath?: string;        // مسیر نگهداری
  schedule: string;            // زمان بندی
  retentionPeriod: string;     // مدت زمان نگهداری
}

export interface VDIDetail {
  id: string;
  transferMediaType?: string;  // نوع مدیای انتقال DATA (اختیاری)
  fileOrFolderName?: string;   // نام فایل یا فولدر (اختیاری)
  sourceAddress?: string;      // آدرس مبدا (اختیاری)
  destinationAddress?: string; // آدرس مقصد (اختیاری)
  serverOrSystemName: string;  // نام سرور/ سامانه (اجباری)
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
  requestType: RequestType;    // نوع درخواست
  files?: FileDetail[];        // برای FILE_TRANSFER
  backups?: BackupDetail[];    // برای BACKUP
  vdis?: VDIDetail[];          // برای VDI
  status: Status;
  approvalHistory: Approval[];
  currentApprover: Role | null;
  createdAt: string;
  requesterGroupId?: number;
}

export interface User {
  id: number;
  name: string;
  username: string;
  password?: string;
  role: Role;
  department: string;
  groupIds?: number[];
}