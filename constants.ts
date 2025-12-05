
import { User, Role, Request, Status } from './types';

export const USERS: User[] = [
  { id: 1, name: 'محمد رضایی', username: 'requester', password: 'password123', role: Role.REQUESTER, department: 'واحد فناوری اطلاعات' },
  { id: 2, name: 'علی محمدی', username: 'grouplead', password: 'password123', role: Role.GROUP_LEAD, department: 'اداره' },
  { id: 3, name: 'رضا کریمی', username: 'deputy', password: 'password123', role: Role.DEPUTY, department: 'معاونت' },
  { id: 4, name: 'فاطمه احمدی', username: 'networkhead', password: 'password123', role: Role.NETWORK_HEAD, department: 'بخش شبکه' },
  { id: 5, name: 'حسین نظری', username: 'networkadmin', password: 'password123', role: Role.NETWORK_ADMIN, department: 'مسئول شبکه' },
];

export const ROLE_HIERARCHY: Role[] = [
  Role.GROUP_LEAD,
  Role.DEPUTY,
  Role.NETWORK_HEAD,
  Role.NETWORK_ADMIN,
];

export const ROLE_NAMES: { [key in Role]: string } = {
  [Role.REQUESTER]: 'درخواست کننده',
  [Role.GROUP_LEAD]: 'رئیس گروه',
  [Role.DEPUTY]: 'معاون',
  [Role.NETWORK_HEAD]: 'رئیس بخش شبکه',
  [Role.NETWORK_ADMIN]: 'مسئول شبکه',
};

export const STATUS_STYLES: { [key in Status]: { text: string; bg: string; color: string } } = {
    [Status.PENDING]: { text: 'در حال بررسی', bg: 'bg-yellow-100', color: 'text-yellow-800' },
    [Status.APPROVED]: { text: 'تایید شده', bg: 'bg-green-100', color: 'text-green-800' },
    [Status.REJECTED]: { text: 'رد شده', bg: 'bg-red-100', color: 'text-red-800' },
    [Status.COMPLETED]: { text: 'انجام شده', bg: 'bg-blue-100', color: 'text-blue-800' },
};

export const INITIAL_REQUESTS: Request[] = [
    {
        id: 'req-001',
        requesterName: 'محمد رضایی',
        department: 'واحد فناوری اطلاعات',
        files: [
            { id: 'file-1', fileName: 'گزارش عملکرد ماهانه', fileContent: 'گزارش عملکرد واحد فناوری اطلاعات برای ماه گذشته', fileFormat: 'PDF', recipient: 'معاونت فناوری اطلاعات', letterNumber: '1234/99/01', fileFields: 'محرمانه - نیاز به تایید مدیریت', sourceServerIP: '192.168.1.10', sourceFilePath: '/var/www/files/report.pdf', destinationServerIP: '192.168.1.20', destinationFilePath: '/var/www/files/report.pdf' }
        ],
        status: Status.PENDING,
        currentApprover: Role.DEPUTY,
        createdAt: new Date(new Date().setDate(new Date().getDate() - 3)).toISOString(),
        approvalHistory: [
            { approverRole: Role.GROUP_LEAD, approverName: 'علی محمدی', status: Status.APPROVED, date: new Date(new Date().setDate(new Date().getDate() - 2)).toISOString() }
        ]
    },
    {
        id: 'req-002',
        requesterName: 'سارا حسینی',
        department: 'واحد مالی',
        files: [
            { id: 'file-2', fileName: 'صورت حساب سه‌ماهه', fileContent: 'صورت حساب مالی سه‌ماهه اول سال', fileFormat: 'XLSX', recipient: 'مدیریت مالی', letterNumber: '5678/99/02', fileFields: 'عمومی', sourceServerIP: '192.168.1.11', sourceFilePath: '/var/www/files/account.xlsx', destinationServerIP: '192.168.1.21', destinationFilePath: '/var/www/files/account.xlsx' }
        ],
        status: Status.PENDING,
        currentApprover: Role.GROUP_LEAD,
        createdAt: new Date(new Date().setDate(new Date().getDate() - 1)).toISOString(),
        approvalHistory: []
    },
    {
        id: 'req-003',
        requesterName: 'محمد رضایی',
        department: 'واحد فناوری اطلاعات',
        files: [
            { id: 'file-3', fileName: 'پروتکل امنیتی', fileContent: 'پروتکل امنیتی شبکه داخلی', fileFormat: 'DOCX', recipient: 'بخش امنیت', letterNumber: '9012/99/03', fileFields: 'محرمانه', sourceServerIP: '192.168.1.12', sourceFilePath: '/var/www/files/security.docx', destinationServerIP: '192.168.1.22', destinationFilePath: '/var/www/files/security.docx' }
        ],
        status: Status.REJECTED,
        currentApprover: null,
        createdAt: new Date(new Date().setDate(new Date().getDate() - 5)).toISOString(),
        approvalHistory: [
            { approverRole: Role.GROUP_LEAD, approverName: 'علی محمدی', status: Status.REJECTED, date: new Date(new Date().setDate(new Date().getDate() - 4)).toISOString() }
        ]
    },
    {
        id: 'req-004',
        requesterName: 'محمد رضایی',
        department: 'واحد فناوری اطلاعات',
        files: [
            { id: 'file-4', fileName: 'برنامه توسعه', fileContent: 'برنامه توسعه سیستم جدید', fileFormat: 'PDF', recipient: 'معاونت برنامه‌ریزی', letterNumber: '3456/99/04', fileFields: 'عمومی - تایید شده', sourceServerIP: '192.168.1.13', sourceFilePath: '/var/www/files/plan.pdf', destinationServerIP: '192.168.1.23', destinationFilePath: '/var/www/files/plan.pdf' }
        ],
        status: Status.COMPLETED,
        currentApprover: null,
        createdAt: new Date(new Date().setDate(new Date().getDate() - 10)).toISOString(),
        approvalHistory: [
            { approverRole: Role.GROUP_LEAD, approverName: 'علی محمدی', status: Status.APPROVED, date: new Date(new Date().setDate(new Date().getDate() - 9)).toISOString() },
            { approverRole: Role.DEPUTY, approverName: 'رضا کریمی', status: Status.APPROVED, date: new Date(new Date().setDate(new Date().getDate() - 8)).toISOString() },
            { approverRole: Role.NETWORK_HEAD, approverName: 'فاطمه احمدی', status: Status.APPROVED, date: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString() },
            { approverRole: Role.NETWORK_ADMIN, approverName: 'حسین نظری', status: Status.COMPLETED, date: new Date(new Date().setDate(new Date().getDate() - 6)).toISOString() }
        ]
    },
];
