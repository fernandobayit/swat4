const API_BASE = typeof window !== 'undefined'
    ? '/api'
    : (process.env.API_URL || 'http://backend:8000') + '/api';

interface ApiOptions {
    method?: string;
    body?: any;
    headers?: Record<string, string>;
}

class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
        super(message);
        this.status = status;
        this.name = 'ApiError';
    }
}

function getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('swat4_token');
}

export function setToken(token: string): void {
    localStorage.setItem('swat4_token', token);
}

export function removeToken(): void {
    localStorage.removeItem('swat4_token');
}

export function isAuthenticated(): boolean {
    return !!getToken();
}

async function apiRequest<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
    const { method = 'GET', body, headers = {} } = options;

    const token = getToken();
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    if (body && !headers['Content-Type'] && !(body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
        method,
        headers,
        body: body instanceof FormData ? body : (body ? JSON.stringify(body) : undefined),
    });

    if (response.status === 401) {
        removeToken();
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
            window.location.href = '/login';
        }
        throw new ApiError('Unauthorized', 401);
    }

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(errorData.detail || 'Request failed', response.status);
    }

    return response.json();
}

// ── Auth ─────────────────────────────────────────
export const auth = {
    login: (username: string, password: string) =>
        apiRequest<{ access_token: string; user: any }>('/auth/login', {
            method: 'POST',
            body: { username, password },
        }),
};

// ── Users ────────────────────────────────────────
export const users = {
    list: (ou?: string) =>
        apiRequest<any[]>(`/users${ou ? `?ou=${encodeURIComponent(ou)}` : ''}`),
    get: (username: string) =>
        apiRequest<any>(`/users/${username}`),
    create: (data: any) =>
        apiRequest<any>('/users', { method: 'POST', body: data }),
    update: (username: string, data: any) =>
        apiRequest<any>(`/users/${username}`, { method: 'PUT', body: data }),
    delete: (username: string) =>
        apiRequest<any>(`/users/${username}`, { method: 'DELETE' }),
};

// ── Groups ───────────────────────────────────────
export const groups = {
    list: (ou?: string) =>
        apiRequest<any[]>(`/groups${ou ? `?ou=${encodeURIComponent(ou)}` : ''}`),
    get: (name: string) =>
        apiRequest<any>(`/groups/${name}`),
    create: (data: any) =>
        apiRequest<any>('/groups', { method: 'POST', body: data }),
    update: (name: string, data: any) =>
        apiRequest<any>(`/groups/${name}`, { method: 'PUT', body: data }),
    delete: (name: string) =>
        apiRequest<any>(`/groups/${name}`, { method: 'DELETE' }),
    addMembers: (name: string, members: string[]) =>
        apiRequest<any>(`/groups/${name}/members`, { method: 'POST', body: { members } }),
    removeMembers: (name: string, members: string[]) =>
        apiRequest<any>(`/groups/${name}/members`, { method: 'DELETE', body: { members } }),
};


// ── Shares ───────────────────────────────────────
export const shares = {
    list: () => apiRequest<any[]>('/shares'),
    get: (name: string) =>
        apiRequest<any>(`/shares/${name}`),
    create: (data: any) =>
        apiRequest<any>('/shares', { method: 'POST', body: data }),
    update: (name: string, data: any) =>
        apiRequest<any>(`/shares/${name}`, { method: 'PUT', body: data }),
    delete: (name: string) =>
        apiRequest<any>(`/shares/${name}`, { method: 'DELETE' }),
};

// ── OUs ──────────────────────────────────────────
export const ous = {
    tree: () => apiRequest<any[]>('/ous'),
    create: (data: any) =>
        apiRequest<any>('/ous', { method: 'POST', body: data }),
    delete: (ouDn: string) =>
        apiRequest<any>(`/ous?ou_dn=${encodeURIComponent(ouDn)}`, { method: 'DELETE' }),
};

// ── Logs ─────────────────────────────────────────
export const logs = {
    files: () => apiRequest<string[]>('/logs/files'),
    read: (filename: string, lines?: number, level?: string, search?: string) => {
        const params = new URLSearchParams();
        if (lines) params.set('lines', String(lines));
        if (level) params.set('level', level);
        if (search) params.set('search', search);
        const qs = params.toString();
        return apiRequest<any>(`/logs/${filename}${qs ? `?${qs}` : ''}`);
    },
};
// ── DNS ──────────────────────────────────────────
export const dns = {
    listZones: () => apiRequest<any[]>('/dns'),
    createZone: (name: string) =>
        apiRequest<any>('/dns', { method: 'POST', body: { name } }),
    deleteZone: (zoneName: string) =>
        apiRequest<any>(`/dns/${zoneName}`, { method: 'DELETE' }),
    listRecords: (zoneName: string) =>
        apiRequest<any[]>(`/dns/${zoneName}/records`),
    addRecord: (zoneName: string, data: any) =>
        apiRequest<any>(`/dns/${zoneName}/records`, { method: 'POST', body: data }),
    updateRecord: (zoneName: string, name: string, type: string, recordData: any) =>
        apiRequest<any>(`/dns/${zoneName}/records?name=${encodeURIComponent(name)}&type=${encodeURIComponent(type)}`, { method: 'PUT', body: recordData }),
    deleteRecord: (zoneName: string, name: string, type: string, data: string) =>
        apiRequest<any>(`/dns/${zoneName}/records?name=${encodeURIComponent(name)}&type=${encodeURIComponent(type)}&data=${encodeURIComponent(data)}`, { method: 'DELETE' }),
};

// ── Activities ───────────────────────────────────
export const activities = {
    list: (limit: number = 100, offset: number = 0) =>
        apiRequest<any[]>(`/activities?limit=${limit}&offset=${offset}`),
};

// ── Domain ───────────────────────────────────────
export const domain = {
    getPasswordPolicy: () =>
        apiRequest<any>('/domain/password-policy'),
    updatePasswordPolicy: (data: any) =>
        apiRequest<any>('/domain/password-policy', { method: 'PUT', body: data }),
};

// ── Roles & Profiles ─────────────────────────────
export const roles = {
    getSettings: (roleName: string) =>
        apiRequest<any>(`/roles/${encodeURIComponent(roleName)}/settings`),
    updateSettings: (roleName: string, data: any) =>
        apiRequest<any>(`/roles/${encodeURIComponent(roleName)}/settings`, { method: 'PUT', body: data }),
};

// ── Bulk Operations ──────────────────────────────
export const bulk = {
    users: (file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        return apiRequest<any>('/bulk/users', { method: 'POST', body: formData });
    },
    groups: (file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        return apiRequest<any>('/bulk/groups', { method: 'POST', body: formData });
    }
};

export { ApiError };
