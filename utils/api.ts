import { User, Request, FileDetail, BackupDetail, VDIDetail, RequestType } from '../types';

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

  create: async (data: { type: RequestType; files?: FileDetail[]; backups?: BackupDetail[]; vdis?: VDIDetail[] }): Promise<Request> => {
    return apiCall<Request>('/requests', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  approve: async (id: string): Promise<Request> => {
    return apiCall<Request>(`/requests/${id}/approve`, {
      method: 'PUT',
    });
  },

  reject: async (id: string): Promise<Request> => {
    return apiCall<Request>(`/requests/${id}/reject`, {
      method: 'PUT',
    });
  },

  updateLetterNumber: async (requestId: string, fileId: string, letterNumber: string): Promise<{ id: string; files: FileDetail[] }> => {
    return apiCall<{ id: string; files: FileDetail[] }>(`/requests/${requestId}/files/${fileId}/letter-number`, {
      method: 'PUT',
      body: JSON.stringify({ letterNumber }),
    });
  },
};