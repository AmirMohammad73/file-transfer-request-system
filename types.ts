export enum Role {
  REQUESTER = 'REQUESTER',
  /** فقط مجاز به ثبت درخواست ویدئو کنفرانس */
  V_REQUESTER = 'V_REQUESTER',
  GROUP_LEAD = 'GROUP_LEAD',
  DEPUTY = 'DEPUTY',
  NETWORK_HEAD = 'NETWORK_HEAD',
  NETWORK_ADMIN = 'NETWORK_ADMIN',
  NETWORK_USB_ADMIN = 'NETWORK_USB_ADMIN',
  /** تأییدکنندهٔ درخواست ویدئو کنفرانس */
  VC_ACCEPTER = 'VC_ACCEPTER',
}

export enum Status {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED', // وضعیت جدید برای درخواست‌های لغو شده
}

export enum RequestType {
  FILE_TRANSFER = 'FILE_TRANSFER',
  BACKUP = 'BACKUP',
  VDI = 'VDI_OPEN',
  TAPE = 'TAPE',
  USB_PORT = 'USB_PORT',
  APP_INSTALL = 'APP_INSTALL',
  /** مطابق نام enum در PostgreSQL */
  VIDEO_CONFRENCE = 'VIDEO_CONFRENCE',
  SERVER_RESTART = 'SERVER_RESTART',
}

export interface FileDetail {
  id: string;
  fileName: string;
  fileContent: string;
  sourceIP: string;
  sourceFilePath: string;
  destinationIP: string;
  destinationFilePath: string;
  fileFormat: string;
  recipient: string;
  letterNumber?: string;
  fileFields: string;
}

export interface BackupDetail {
  id: string;
  serverIP: string;
  backupMethod: 'FULL' | 'INCREMENTAL';
  storagePath?: string;
  schedule: string;
  retentionPeriod: string;
}

export interface VDIDetail {
  id: string;
  transferMediaType?: string;
  fileOrFolderName?: string;
  sourceAddress?: string;
  destinationAddress?: string;
  serverOrSystemName: string;
}

export interface TapeDetail {
  id: string;
  serverIP: string;
  fileName: string;
  filePath: string;
}

export interface USBPortDetail {
  id: string;
  serverIP: string;
  duration: string; // مدت زمان (مثلا "4 ساعت")
}

export interface AppInstallDetail {
  id: string;
  serverIP: string;
  appNameOrLink: string;
}

export interface VideoConferenceDetail {
  id: string;
  /** میلادی YYYY-MM-DD (همان قرارداد PersianDatePicker) */
  scheduledDate: string;
  startTime: string;
  endTime: string;
  participantCount: string;
}

export interface ServerRestartDetail {
  id: string;
  serverIP: string;
  /** ساعت ۲۴ساعته HH:mm؛ در حالت فوری خالی است */
  restartTime: string;
  isUrgent: boolean;
  /** توضیحات؛ الزامی، حداکثر ۱۰۰ کاراکتر */
  description: string;
}

export interface Approval {
  approverRole: Role;
  approverName: string;
  status: Status.APPROVED | Status.REJECTED | Status.COMPLETED;
  date: string;
  rejectionReason?: string;
  approvalNote?: string; // توضیحات اختیاری هنگام تایید
  /** شماره اتاق؛ برای تأیید ویدئو کنفرانس */
  conferenceRoom?: string;
  isFromPreviousVersion?: boolean; // برای نشان دادن تاییدهای نسخه قبلی
}

export interface Request {
  id: string;
  requesterName: string;
  department: string;
  requestType: RequestType;
  files?: FileDetail[];
  backups?: BackupDetail[];
  vdis?: VDIDetail[];
  tapes?: TapeDetail[];
  usbPorts?: USBPortDetail[];
  appInstalls?: AppInstallDetail[];
  videoConferences?: VideoConferenceDetail[];
  serverRestarts?: ServerRestartDetail[];
  status: Status;
  approvalHistory: Approval[];
  currentApprover: Role | null;
  createdAt: string;
  requesterGroupId?: number;
  rejectionReason?: string;
  isRevised?: boolean; // آیا این درخواست اصلاح شده است؟
  revisionCount?: number; // تعداد دفعات اصلاح
  previousVersions?: Approval[][]; // تاریخچه تاییدهای نسخه‌های قبلی
  requesterId?: number; // ID کاربر درخواست‌دهنده
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