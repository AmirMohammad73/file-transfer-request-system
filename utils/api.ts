import { User, Request, FileDetail, BackupDetail, VDIDetail, TapeDetail, USBPortDetail, AppInstallDetail, VideoConferenceDetail, ServerRestartDetail, RequestType, BackupResource, Contractor, BackupServer } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '/api' : 'http://localhost:5000/api');

async function apiCall<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'خطای سرور' }));
    throw new Error(error.error || 'خطا در ارتباط با سرور');
  }

  return response.json();
}

export const authAPI = {
  login: async (username: string, password: string): Promise<User> => {
    return apiCall<User>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },

  register: async (userData: {
    name: string;
    username: string;
    password: string;
    role: string;
    department: string;
  }): Promise<User> => {
    return apiCall<User>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },

  getCurrentUser: async (): Promise<User> => {
    return apiCall<User>('/auth/me');
  },

  logout: async (): Promise<void> => {
    await apiCall('/auth/logout', {
      method: 'POST',
    });
  },

  changePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
    await apiCall('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },
};

export const requestsAPI = {
  getAll: async (): Promise<Request[]> => {
    return apiCall<Request[]>('/requests');
  },

  getHistory: async (): Promise<Request[]> => {
    return apiCall<Request[]>('/requests/history');
  },

  getRejected: async (): Promise<Request[]> => {
    return apiCall<Request[]>('/requests/rejected');
  },

  create: async (data: { type: RequestType; files?: FileDetail[]; backups?: BackupDetail[]; vdis?: VDIDetail[]; tapes?: TapeDetail[]; usbPorts?: USBPortDetail[]; appInstalls?: AppInstallDetail[]; serverRestarts?: ServerRestartDetail[]; videoConferences?: VideoConferenceDetail[] }): Promise<Request> => {
    return apiCall<Request>('/requests', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  approve: async (id: string, opts?: { approvalNote?: string; conferenceRoom?: string }): Promise<Request> => {
    return apiCall<Request>(`/requests/${id}/approve`, {
      method: 'PUT',
      body: JSON.stringify({
        approvalNote: opts?.approvalNote || '',
        conferenceRoom: opts?.conferenceRoom,
      }),
    });
  },

  reject: async (id: string, rejectionReason: string): Promise<Request> => {
    return apiCall<Request>(`/requests/${id}/reject`, {
      method: 'PUT',
      body: JSON.stringify({ rejectionReason }),
    });
  },

  cancel: async (id: string): Promise<Request> => {
    return apiCall<Request>(`/requests/${id}/cancel`, {
      method: 'PUT',
    });
  },

  revise: async (id: string, data: { type: RequestType; files?: FileDetail[]; backups?: BackupDetail[]; vdis?: VDIDetail[]; tapes?: TapeDetail[]; usbPorts?: USBPortDetail[]; appInstalls?: AppInstallDetail[]; serverRestarts?: ServerRestartDetail[]; videoConferences?: VideoConferenceDetail[] }): Promise<Request> => {
    return apiCall<Request>(`/requests/${id}/revise`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  updateLetterNumber: async (requestId: string, fileId: string, letterNumber: string): Promise<{ id: string; files: FileDetail[] }> => {
    return apiCall<{ id: string; files: FileDetail[] }>(`/requests/${requestId}/files/${fileId}/letter-number`, {
      method: 'PUT',
      body: JSON.stringify({ letterNumber }),
    });
  },
};

// ─── Backup Resources API / شناسنامه سرورها ──────────────────────────────────

export const backupResourcesAPI = {
  // ── Contractors (سامانه‌ها) ──
  getAllContractors: async (): Promise<Contractor[]> => {
    return apiCall<Contractor[]>('/backup-resources/contractors');
  },

  createContractor: async (data: {
    systemName: string;
    contName?: string;
    repName1: string;
    phone1: string;
    repName2?: string;
    phone2?: string;
    repName3?: string;
    phone3?: string;
  }): Promise<Contractor> => {
    return apiCall<Contractor>('/backup-resources/contractors', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateContractor: async (id: number, data: {
    systemName: string;
    contName?: string;
    repName1: string;
    phone1: string;
    repName2?: string;
    phone2?: string;
    repName3?: string;
    phone3?: string;
  }): Promise<Contractor> => {
    return apiCall<Contractor>(`/backup-resources/contractors/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  deleteContractor: async (id: number): Promise<void> => {
    await apiCall(`/backup-resources/contractors/${id}`, { method: 'DELETE' });
  },

  // ── Servers (سرورها) ──
  addServer: async (contractorId: number, data: {
    ip: string;
    vmname?: string;
    url?: string;
    type?: string;
    backupOperator?: string;
    backupPeriod?: string;
  }): Promise<BackupServer> => {
    return apiCall<BackupServer>(`/backup-resources/contractors/${contractorId}/servers`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateServer: async (serverId: number, data: {
    ip: string;
    vmname?: string;
    url?: string;
    type?: string;
    backupOperator?: string;
    backupPeriod?: string;
  }): Promise<BackupServer> => {
    return apiCall<BackupServer>(`/backup-resources/servers/${serverId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  deleteServer: async (serverId: number): Promise<void> => {
    await apiCall(`/backup-resources/servers/${serverId}`, { method: 'DELETE' });
  },

  // ── Dropdown (برای فرم درخواست) ──
  getAllForDropdown: async (): Promise<Contractor[]> => {
    return apiCall<Contractor[]>('/backup-resources/dropdown');
  },

  // ── Legacy (برای سازگاری با کد قبلی) ──
  getAll: async (): Promise<Contractor[]> => {
    return apiCall<Contractor[]>('/backup-resources/contractors');
  },

  // ── PDF Report ──
  getPdfReport: async (): Promise<any[]> => {
    return apiCall<any[]>('/backup-resources/pdf-report');
  },
};