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
  /** پیگیری نامه ارسال‌شده از سامانه دیگر */
  LETTER_FOLLOWUP = 'LETTER_FOLLOWUP',
}

export interface UploadedFileInfo {
  uploadId: number;
  originalFilename: string;
  storedFilename: string;
  fileSize: number;
  uploadedAt: string;
  expiresAt: string;
  isDownloaded: boolean;
}

export interface FileDetail {
  id: string;
  /** برای انتقال داخلی به‌صورت خودکار از نام فایل بارگذاری‌شده پر می‌شود */
  fileName: string;
  fileContent: string;
  sourceIP: string;
  /** فقط برای انتقال عادی (غیرداخلی) الزامی است */
  sourceFilePath?: string;
  destinationIP: string;
  /** فقط برای انتقال عادی (غیرداخلی) الزامی است */
  destinationFilePath?: string;
  /** برای انتقال داخلی به‌صورت خودکار از فایل بارگذاری‌شده استخراج می‌شود */
  fileFormat?: string;
  recipient: string;
  letterNumber?: string;
  fileFields: string;
  uploadedFile?: UploadedFileInfo;
  /** آیا این رکورد انتقال داخلی (بین سرورهای یک سامانه) است */
  isInternalTransfer?: boolean;
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
  portNumber?: string;
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

export enum LetterFollowupSubject {
  NEW_SERVER = 'NEW_SERVER',
  CREATE_VDI = 'CREATE_VDI',
  VDI_ACCESS = 'VDI_ACCESS',
  REMOVE_SERVER = 'REMOVE_SERVER',
  REMOVE_VDI_ACCESS = 'REMOVE_VDI_ACCESS',
  CHANGE_RESOURCES = 'CHANGE_RESOURCES',
  CREATE_TUNNEL = 'CREATE_TUNNEL',
}

export interface LetterFollowupDetail {
  id: string;
  letterNumber: string;
  letterSubject: LetterFollowupSubject | '';
  description?: string;
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
  /** تأیید خودکار (رئیس واحد / مدیرکل برای پیگیری نامه) */
  isAutoApproved?: boolean;
}

export interface Request {
  id: string;
  requesterName: string;
  department: string;
  requestType: RequestType;
  selectedServerId?: number;
  selectedServerName?: string; // از فیلد JSONB خوانده می‌شود (داخل files/backups/...)
  files?: FileDetail[];
  backups?: BackupDetail[];
  vdis?: VDIDetail[];
  tapes?: TapeDetail[];
  usbPorts?: USBPortDetail[];
  appInstalls?: AppInstallDetail[];
  videoConferences?: VideoConferenceDetail[];
  serverRestarts?: ServerRestartDetail[];
  letterFollowups?: LetterFollowupDetail[];
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

// ─── Backup Resources / شناسنامه سرورها ──────────────────────────────────────

export interface Contractor {
  id?: number;
  systemName: string;
  contName?: string;
  repName1?: string;
  phone1?: string;
  repName2?: string;
  phone2?: string;
  repName3?: string;
  phone3?: string;
  reqUserIds?: number[];
  registeredByName?: string;
  registeredByDept?: string;
  servers?: BackupServer[];
}

export interface BackupServer {
  id?: number;
  ip: string;           // اجباری
  vmname?: string;      // نام VM (اجباری)
  dns?: string;         // آدرس DNS (جدید)
  relatedDepartments?: string; // ادارات مرتبط (جدید)
  url?: string;
  type?: string;        // نوع کاربری سرور (بکاپ، دیتابیس، sql و...)
  backupOperator?: string;
  backupPeriod?: string;
  contractorId?: number;
}

// برای سازگاری با کد قبلی — نگه داشته می‌شود
export interface BackupResource {
  id?: number;
  ip: string;
  systemName?: string;
  vmname?: string;
  dns?: string;         // آدرس DNS (جدید)
  relatedDepartments?: string; // ادارات مرتبط (جدید)
  url?: string;
  type?: string;
  backupOperator?: string;
  backupPeriod?: string;
  contractorId?: number;
  reqUserIds?: number[];
  contractor?: Contractor | null;
}