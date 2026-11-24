import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  highestRole,
  ROLE_PERMISSION_KEYS,
  type AppRole,
  type PermissionKey,
} from './permissions';
import { handleLocalWorkspaceRequest, workspaceOrganizationFor } from './localWorkspace';

const SESSION_KEY = 'souqi.auth.session.v2';

type AccountType = 'buyer' | 'supplier';

type AuthAccount = {
  id: string;
  fullName: string;
  companyName: string;
  email: string;
  accountType: AccountType;
  createdAt: string;
  isPlatformAdmin?: boolean;
};

type OrganizationSummary = {
  id: string;
  type: 'BUYER' | 'SUPPLIER';
  legalName: string;
  displayName: string;
  countryCode: string | null;
  status: string;
};

type OrganizationMembership = {
  id: string;
  organizationId: string;
  role: Exclude<AppRole, 'PLATFORM_ADMIN'>;
  status: string;
  organization: OrganizationSummary;
  permissions: PermissionKey[];
};

type AuthSession = {
  account: AuthAccount;
  token: string;
  refreshToken: string | null;
  role: AppRole;
  permissions: PermissionKey[];
  memberships: OrganizationMembership[];
};

type RegisterInput = {
  fullName: string;
  companyName: string;
  email: string;
  password: string;
  accountType: AccountType;
};

type AuthErrorCode = 'EMAIL_ALREADY_EXISTS';

type AuthError = Error & { code?: AuthErrorCode };

type ErrorPayload = {
  code?: string;
  error?: string;
  message?: string;
  details?: Record<string, string[]>;
};

type AuthContextValue = {
  account: AuthAccount | null;
  token: string | null;
  role: AppRole | null;
  isPlatformAdmin: boolean;
  memberships: OrganizationMembership[];
  permissions: PermissionKey[];
  activeOrganization: OrganizationSummary | null;
  ready: boolean;
  hasPermission: (permission: PermissionKey) => boolean;
  hasAnyPermission: (permissions: PermissionKey[]) => boolean;
  apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

type AuthResult = { account: AuthAccount; token: string; refreshToken: string };

type MeResult = {
  account: AuthAccount;
  role: AppRole;
  permissions: PermissionKey[];
  memberships: OrganizationMembership[];
};

const AuthContext = createContext<AuthContextValue | null>(null);

function apiBaseUrl() {
  const baseUrl = (process.env.EXPO_PUBLIC_API_URL ?? '').trim();
  if (!baseUrl && Platform.OS !== 'web') {
    throw new Error('إعداد عنوان الخادم غير موجود. أضف EXPO_PUBLIC_API_URL إلى ملف البيئة وأعد تشغيل التطبيق.');
  }
  return baseUrl.replace(/\/$/, '');
}

function ensureJson(response: Response) {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new Error('مسار API غير متاح في النسخة المنشورة الحالية. أعد نشر أحدث إصدار من المنصة.');
  }
}

const LOCAL_ACCOUNTS_KEY = 'souqi.auth.local-accounts.v1';

type LocalAccountRecord = AuthAccount & { passwordSalt: string; passwordHash: string };

function randomHex(bytes: number) {
  const values = new Uint8Array(bytes);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => value.toString(16).padStart(2, '0')).join('');
}

async function hashPassword(password: string, salt: string) {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('');
}

async function readLocalAccounts(): Promise<LocalAccountRecord[]> {
  const raw = await AsyncStorage.getItem(LOCAL_ACCOUNTS_KEY);
  if (!raw) return [];
  try {
    const value = JSON.parse(raw) as LocalAccountRecord[];
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

async function localRegister(input: RegisterInput): Promise<AuthResult> {
  const accounts = await readLocalAccounts();
  const email = input.email.trim().toLowerCase();
  if (accounts.some((item) => item.email.toLowerCase() === email)) {
    const error = new Error('البريد الإلكتروني مستخدم بالفعل.') as AuthError;
    error.code = 'EMAIL_ALREADY_EXISTS';
    throw error;
  }
  const salt = randomHex(16);
  const account: AuthAccount = {
    id: randomHex(16),
    fullName: input.fullName,
    companyName: input.companyName,
    email,
    accountType: input.accountType,
    createdAt: new Date().toISOString(),
  };
  accounts.push({ ...account, passwordSalt: salt, passwordHash: await hashPassword(input.password, salt) });
  await AsyncStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(accounts));
  return { account, token: randomHex(32), refreshToken: randomHex(32) };
}

async function localLogin(email: string, password: string): Promise<AuthResult> {
  const accounts = await readLocalAccounts();
  const normalized = email.trim().toLowerCase();
  const record = accounts.find((item) => item.email.toLowerCase() === normalized);
  if (!record || await hashPassword(password, record.passwordSalt) !== record.passwordHash) {
    throw new Error('بيانات الدخول غير صحيحة.');
  }
  const account: AuthAccount = {
    id: record.id,
    fullName: record.fullName,
    companyName: record.companyName,
    email: record.email,
    accountType: record.accountType,
    createdAt: record.createdAt,
    isPlatformAdmin: record.isPlatformAdmin,
  };
  return { account, token: randomHex(32), refreshToken: randomHex(32) };
}

function toAuthError(payload: ErrorPayload) {
  const validationMessage = payload.details ? Object.values(payload.details).flat()[0] : undefined;
  const authError = new Error(validationMessage ?? payload.error ?? payload.message ?? 'تعذر إكمال المصادقة.') as AuthError;
  if (payload.code === 'EMAIL_ALREADY_EXISTS') {
    authError.code = 'EMAIL_ALREADY_EXISTS';
  }
  return authError;
}

async function parseJson(response: Response) {
  try {
    return await response.json() as Record<string, unknown>;
  } catch {
    return {};
  }
}

function staticFallbackForPath(path: string): Record<string, unknown> {
  const clean = path.split('?')[0];
  if (clean === '/api/rfqs') return { rfqs: [] };
  if (clean.startsWith('/api/rfqs/')) {
    if (clean.endsWith('/quotes')) return { quotes: [] };
    return { rfq: null };
  }
  if (clean === '/api/purchase-orders') return { purchaseOrders: [] };
  if (clean.startsWith('/api/purchase-orders/')) return { purchaseOrder: null };
  if (clean === '/api/suppliers') return { suppliers: [] };
  if (clean === '/api/industries' || clean === '/api/admin/industries') return { industries: [] };
  if (clean.startsWith('/api/industries/')) return { versions: [] };
  if (clean === '/api/permissions') return { permissions: [] };
  if (clean === '/api/notifications') return { notifications: [], unreadCount: 0 };
  if (clean === '/api/supplier-invitations') return { invitations: [] };
  if (clean === '/api/admin/overview') {
    return {
      overview: {
        accounts: 0,
        organizations: 0,
        rfqsByStatus: {},
        quotes: 0,
        purchaseOrders: 0,
        pendingSupplierVerifications: 0,
        pendingEvents: 0,
      },
    };
  }
  if (clean === '/api/admin/accounts') return { accounts: [] };
  if (clean === '/api/admin/organizations') return { organizations: [] };
  if (clean.endsWith('/members')) return { members: [] };
  if (clean === '/api/admin/audit' || clean === '/api/admin/outbox') return { events: [] };
  return {};
}

async function fetchMe(token: string, account?: AuthAccount): Promise<MeResult> {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    ensureJson(response);
  } catch {
    const role: AppRole = account?.isPlatformAdmin ? 'PLATFORM_ADMIN' : 'MEMBER';
    return {
      account: account as AuthAccount,
      role,
      permissions: ROLE_PERMISSION_KEYS[role],
      memberships: [],
    };
  }

  const result = await parseJson(response);
  if (!response.ok) {
    throw toAuthError(result as ErrorPayload);
  }

  const meAccount = (result.account ?? {}) as AuthAccount;
  const fallbackRole = account?.isPlatformAdmin || meAccount.isPlatformAdmin ? 'PLATFORM_ADMIN' : 'MEMBER';
  const memberships = Array.isArray(result.memberships) ? result.memberships as OrganizationMembership[] : [];
  const role = (result.role as AppRole | undefined) ?? highestRole(memberships.map((item) => item.role)) ?? fallbackRole;
  const permissions = Array.isArray(result.permissions)
    ? result.permissions as PermissionKey[]
    : ROLE_PERMISSION_KEYS[role];

  return {
    account: { ...account, ...meAccount },
    role,
    permissions,
    memberships,
  };
}

async function rotateTokens(refreshToken: string): Promise<AuthResult> {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    throw new Error('تعذر تجديد الجلسة. تحقق من اتصالك بالخادم.');
  }

  ensureJson(response);
  const result = await parseJson(response);
  if (!response.ok || !result.token || !result.refreshToken || !result.account) {
    throw toAuthError(result as ErrorPayload);
  }
  return result as unknown as AuthResult;
}

function parseStoredSession(raw: string): AuthSession | null {
  try {
    const value = JSON.parse(raw) as AuthSession;
    if (!value?.token || !value.account) return null;
    const role = value.role ?? highestRole(value.memberships?.map((item) => item.role) ?? []) ?? 'MEMBER';
    return {
      ...value,
      refreshToken: value.refreshToken ?? null,
      role,
      permissions: value.permissions ?? ROLE_PERMISSION_KEYS[role],
      memberships: value.memberships ?? [],
    };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [ready, setReady] = useState(false);

  const persist = useCallback(async (next: AuthSession) => {
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(next));
    setSession(next);
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(SESSION_KEY);
        const stored = raw ? parseStoredSession(raw) : null;
        if (!stored) {
          if (raw) await AsyncStorage.removeItem(SESSION_KEY);
          return;
        }
        if (!active) return;
        setSession(stored);
        try {
          const fresh = await fetchMe(stored.token, stored.account);
          if (active) await persist({ ...fresh, token: stored.token, refreshToken: stored.refreshToken });
        } catch {
          try {
            if (!stored.refreshToken) throw new Error('No refresh token');
            const rotated = await rotateTokens(stored.refreshToken);
            const fresh = await fetchMe(rotated.token, rotated.account);
            if (active) await persist({ ...fresh, token: rotated.token, refreshToken: rotated.refreshToken });
          } catch {
            if (active) setSession(stored);
          }
        }
      } finally {
        if (active) setReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [persist]);

  const requestAuth = useCallback(async (path: string, body: unknown) => {
    let response: Response;
    try {
      response = await fetch(`${apiBaseUrl()}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      ensureJson(response);
    } catch {
      if (Platform.OS !== 'web') {
        throw new Error('تعذر الاتصال بالخادم. تأكد من تشغيل API وإمكانية الوصول إلى عنوانه.');
      }
      const payload = body as RegisterInput & { email: string; password: string };
      const authResult = path.includes('register')
        ? await localRegister(payload)
        : await localLogin(payload.email, payload.password);
      const me = await fetchMe(authResult.token, authResult.account);
      await persist({ ...me, token: authResult.token, refreshToken: authResult.refreshToken });
      return;
    }

    const result = await parseJson(response);
    if (!response.ok) {
      throw toAuthError(result as ErrorPayload);
    }
    if (!result.token || !result.refreshToken || !result.account) {
      throw new Error('استجابة المصادقة غير مكتملة من الخادم.');
    }

    const authResult = result as unknown as AuthResult;
    const me = await fetchMe(authResult.token, authResult.account);
    await persist({ ...me, token: authResult.token, refreshToken: authResult.refreshToken });
  }, [persist]);

  const login = useCallback(async (email: string, password: string) => {
    await requestAuth('/api/auth/login', { email, password });
  }, [requestAuth]);

  const register = useCallback(async (input: RegisterInput) => {
    await requestAuth('/api/auth/register', input);
  }, [requestAuth]);

  const logout = useCallback(async () => {
    const refreshToken = session?.refreshToken;
    if (refreshToken) {
      try {
        await fetch(`${apiBaseUrl()}/api/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
      } catch {
        void 0;
      }
    }
    await AsyncStorage.removeItem(SESSION_KEY);
    setSession(null);
  }, [session]);

  const refresh = useCallback(async () => {
    if (!session?.token) return;
    if (session.refreshToken) {
      const rotated = await rotateTokens(session.refreshToken);
      const me = await fetchMe(rotated.token, rotated.account);
      await persist({ ...me, token: rotated.token, refreshToken: rotated.refreshToken });
      return;
    }
    const fresh = await fetchMe(session.token, session.account);
    await persist({ ...fresh, token: session.token, refreshToken: null });
  }, [persist, session]);

  const hasPermission = useCallback((permission: PermissionKey) => {
    return session?.permissions.includes(permission) ?? false;
  }, [session?.permissions]);

  const hasAnyPermission = useCallback((permissions: PermissionKey[]) => {
    return permissions.some((permission) => hasPermission(permission));
  }, [hasPermission]);

  const apiFetch = useCallback(async <T,>(path: string, init?: RequestInit): Promise<T> => {
    const send = async (token: string) => fetch(`${apiBaseUrl()}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...init?.headers,
      },
    });

    if (!session?.token) {
      throw new Error('مطلوب تسجيل الدخول.');
    }

    const method = (init?.method ?? 'GET').toUpperCase();
    const canFallback = Platform.OS === 'web';
    try {
      let response = await send(session.token);
      if (response.status === 401 && session.refreshToken) {
        const rotated = await rotateTokens(session.refreshToken);
        const me = await fetchMe(rotated.token, rotated.account);
        await persist({ ...me, token: rotated.token, refreshToken: rotated.refreshToken });
        response = await send(rotated.token);
      }

      ensureJson(response);
      const payload = await parseJson(response);
      if (!response.ok) {
        throw toAuthError(payload as ErrorPayload);
      }
      return payload as T;
    } catch (error) {
      if (canFallback) {
        try {
          const local = await handleLocalWorkspaceRequest(session.account, path, init);
          if (local) return local as T;
        } catch {
          void 0;
        }
        if (method === 'GET') {
          return staticFallbackForPath(path) as T;
        }
      }
      throw error;
    }
  }, [persist, session]);

  const value = useMemo<AuthContextValue>(() => ({
    account: session?.account ?? null,
    token: session?.token ?? null,
    role: session?.role ?? null,
    isPlatformAdmin: Boolean(session?.account.isPlatformAdmin || session?.role === 'PLATFORM_ADMIN'),
    memberships: session?.memberships ?? [],
    permissions: session?.permissions ?? [],
    activeOrganization: session?.memberships[0]?.organization
      ?? (session?.account ? workspaceOrganizationFor(session.account) : null),
    ready,
    hasPermission,
    hasAnyPermission,
    apiFetch,
    login,
    register,
    logout,
    refresh,
  }), [session, ready, hasPermission, hasAnyPermission, apiFetch, login, register, logout, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }
  return context;
}

export function isEmailAlreadyExistsError(error: unknown): error is AuthError {
  return error instanceof Error && 'code' in error && error.code === 'EMAIL_ALREADY_EXISTS';
}

export type {
  AccountType,
  AuthAccount,
  AuthError,
  AuthSession,
  OrganizationMembership,
  OrganizationSummary,
  PermissionKey,
  RegisterInput,
  AppRole,
};
