import { createHash, randomBytes, randomUUID } from 'node:crypto';

import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { ZodError } from 'zod';

import {
  PERMISSION_KEYS,
  ROLE_PERMISSION_KEYS,
  type AppRole,
} from '../src/state/permissions';
import { loginSchema, refreshTokenSchema, registerSchema } from './validation';

export type ApiRequest = {
  method?: string;
  url?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
};

export type ApiResponse = {
  setHeader(name: string, value: string): ApiResponse;
  status(code: number): ApiResponse;
  json(payload: unknown): ApiResponse;
  end(): ApiResponse;
};

type AccountType = 'BUYER' | 'SUPPLIER';

type Account = {
  id: string;
  fullName: string;
  companyName: string;
  email: string;
  passwordHash: string;
  accountType: AccountType;
  organizationId: string;
  membershipId: string;
  createdAt: string;
};

type Organization = {
  id: string;
  type: AccountType;
  legalName: string;
  displayName: string;
  countryCode: string;
  status: string;
};

type Session = {
  accountId: string;
  expiresAt: number;
  revokedAt: number | null;
};

type State = {
  accounts: Map<string, Account>;
  organizations: Map<string, Organization>;
  sessions: Map<string, Session>;
  secret: Uint8Array;
};

const refreshTokenTtlMs = 30 * 24 * 60 * 60 * 1000;

function createState(): State {
  return {
    accounts: new Map(),
    organizations: new Map(),
    sessions: new Map(),
    secret: new TextEncoder().encode(
      process.env.JWT_SECRET?.trim() || randomBytes(32).toString('hex'),
    ),
  };
}

const globalState = globalThis as typeof globalThis & {
  souqiMemoryApiState?: State;
};
const state = globalState.souqiMemoryApiState ??= createState();

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function getHeader(req: ApiRequest, name: string) {
  const value = req.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

async function readBody(req: ApiRequest): Promise<Record<string, unknown>> {
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body) as unknown;
    } catch {
      return {};
    }
  }
  return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
}

function prepare(req: ApiRequest, res: ApiResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}

function send(res: ApiResponse, status: number, payload: unknown) {
  res.status(status).json(payload);
}

function fail(res: ApiResponse, status: number, message: string, code: string) {
  send(res, status, { error: message, message, code });
}

function toClientAccount(account: Account) {
  return {
    id: account.id,
    fullName: account.fullName,
    companyName: account.companyName,
    email: account.email,
    accountType: account.accountType.toLowerCase() as 'buyer' | 'supplier',
    createdAt: account.createdAt,
  };
}

function findAccountByEmail(email: string) {
  return [...state.accounts.values()].find((account) => account.email === email);
}

async function issueSession(account: Account) {
  const token = await new SignJWT({
    accountType: account.accountType,
    isPlatformAdmin: false,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(account.id)
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(state.secret);

  const refreshToken = randomBytes(32).toString('base64url');
  state.sessions.set(hashToken(refreshToken), {
    accountId: account.id,
    expiresAt: Date.now() + refreshTokenTtlMs,
    revokedAt: null,
  });
  return { token, refreshToken };
}

async function requireAccount(req: ApiRequest): Promise<Account | null> {
  const authorization = getHeader(req, 'authorization') ?? '';
  const token = authorization.startsWith('Bearer ')
    ? authorization.slice(7).trim()
    : '';
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, state.secret);
    return payload.sub ? state.accounts.get(payload.sub) ?? null : null;
  } catch {
    return null;
  }
}

function permissionsPayload() {
  const roles = [
    { value: 'PLATFORM_ADMIN', label: 'مدير المنصة' },
    { value: 'OWNER', label: 'مالك المؤسسة' },
    { value: 'ADMIN', label: 'مدير المؤسسة' },
    { value: 'MEMBER', label: 'عضو' },
    { value: 'QUALITY', label: 'مراجع جودة' },
  ];
  return { permissions: PERMISSION_KEYS, roles };
}

function mePayload(account: Account) {
  const role: AppRole = 'OWNER';
  const organization = state.organizations.get(account.organizationId);
  const org = organization ?? {
    id: account.organizationId,
    type: account.accountType,
    legalName: account.companyName,
    displayName: account.companyName,
    countryCode: 'SA',
    status: 'ACTIVE',
  };

  return {
    account: { ...toClientAccount(account), isPlatformAdmin: false },
    role,
    permissions: ROLE_PERMISSION_KEYS[role],
    memberships: [
      {
        id: account.membershipId,
        organizationId: org.id,
        role: 'OWNER',
        status: 'ACTIVE',
        organization: org,
        permissions: ROLE_PERMISSION_KEYS.OWNER,
      },
    ],
    organizations: [{ ...org, role: 'OWNER' }],
  };
}

function genericGetPayload(route: string): unknown {
  switch (route) {
    case 'health':
      return { status: 'ok', timestamp: new Date().toISOString() };
    case 'permissions':
      return permissionsPayload();
    case 'admin/overview':
      return {
        overview: {
          accounts: state.accounts.size,
          organizations: state.organizations.size,
          quotes: 0,
          purchaseOrders: 0,
          pendingSupplierVerifications: 0,
          pendingEvents: 0,
          rfqsByStatus: {},
        },
      };
    case 'admin/accounts':
      return {
        accounts: [...state.accounts.values()].map((account) => ({
          ...toClientAccount(account),
          isPlatformAdmin: false,
          status: 'ACTIVE',
        })),
      };
    case 'admin/organizations':
      return { organizations: [...state.organizations.values()] };
    case 'admin/industries':
    case 'industries':
      return { industries: [] };
    case 'admin/audit':
    case 'admin/outbox':
      return { events: [] };
    case 'suppliers':
      return { suppliers: [] };
    case 'rfqs':
      return { rfqs: [] };
    case 'purchase-orders':
      return { purchaseOrders: [] };
    default:
      return null;
  }
}

async function handleRegister(req: ApiRequest, res: ApiResponse) {
  try {
    const input = registerSchema.parse(await readBody(req));
    if (findAccountByEmail(input.email)) {
      fail(res, 409, 'البريد الإلكتروني مستخدم بالفعل', 'EMAIL_ALREADY_EXISTS');
      return;
    }

    const id = randomUUID();
    const organizationId = randomUUID();
    const account: Account = {
      id,
      fullName: input.fullName,
      companyName: input.companyName,
      email: input.email,
      passwordHash: await bcrypt.hash(input.password, 12),
      accountType: input.accountType,
      organizationId,
      membershipId: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    const organization: Organization = {
      id: organizationId,
      type: input.accountType,
      legalName: input.companyName,
      displayName: input.companyName,
      countryCode: 'SA',
      status: 'ACTIVE',
    };

    state.accounts.set(id, account);
    state.organizations.set(organizationId, organization);
    const session = await issueSession(account);
    send(res, 201, {
      ...session,
      account: toClientAccount(account),
      organization,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      const message = error.issues[0]?.message ?? 'بيانات الطلب غير صالحة';
      fail(res, 400, message, 'VALIDATION_ERROR');
      return;
    }
    fail(res, 500, 'حدث خطأ غير متوقع', 'INTERNAL_ERROR');
  }
}

async function handleLogin(req: ApiRequest, res: ApiResponse) {
  try {
    const input = loginSchema.parse(await readBody(req));
    const account = findAccountByEmail(input.email.trim().toLowerCase());
    if (!account || !(await bcrypt.compare(input.password, account.passwordHash))) {
      fail(res, 401, 'بيانات الدخول غير صالحة', 'INVALID_CREDENTIALS');
      return;
    }

    const session = await issueSession(account);
    send(res, 200, { ...session, account: toClientAccount(account) });
  } catch (error) {
    if (error instanceof ZodError) {
      fail(res, 400, 'بيانات الدخول غير صالحة', 'VALIDATION_ERROR');
      return;
    }
    fail(res, 500, 'حدث خطأ غير متوقع', 'INTERNAL_ERROR');
  }
}

async function handleRefresh(req: ApiRequest, res: ApiResponse) {
  try {
    const input = refreshTokenSchema.parse(await readBody(req));
    const tokenHash = hashToken(input.refreshToken);
    const stored = state.sessions.get(tokenHash);
    if (!stored || stored.revokedAt || stored.expiresAt <= Date.now()) {
      fail(res, 401, 'جلسة غير صالحة أو منتهية', 'UNAUTHORIZED');
      return;
    }

    const account = state.accounts.get(stored.accountId);
    if (!account) {
      fail(res, 401, 'الحساب غير موجود', 'UNAUTHORIZED');
      return;
    }

    stored.revokedAt = Date.now();
    const session = await issueSession(account);
    send(res, 200, { ...session, account: toClientAccount(account) });
  } catch {
    fail(res, 400, 'بيانات الجلسة غير صالحة', 'VALIDATION_ERROR');
  }
}

async function handleLogout(req: ApiRequest, res: ApiResponse) {
  try {
    const input = refreshTokenSchema.parse(await readBody(req));
    const stored = state.sessions.get(hashToken(input.refreshToken));
    if (stored && !stored.revokedAt) {
      stored.revokedAt = Date.now();
    }
    send(res, 200, { ok: true });
  } catch {
    fail(res, 400, 'بيانات الجلسة غير صالحة', 'VALIDATION_ERROR');
  }
}

async function handleMe(req: ApiRequest, res: ApiResponse) {
  const account = await requireAccount(req);
  if (!account) {
    fail(res, 401, 'غير مصرح بالوصول', 'UNAUTHORIZED');
    return;
  }
  send(res, 200, mePayload(account));
}

export async function handleMemoryRequest(
  route: string,
  req: ApiRequest,
  res: ApiResponse,
) {
  if (prepare(req, res)) return;

  const method = (req.method ?? 'GET').toUpperCase();

  if (method === 'POST') {
    switch (route) {
      case 'auth/register':
        await handleRegister(req, res);
        return;
      case 'auth/login':
        await handleLogin(req, res);
        return;
      case 'auth/refresh':
        await handleRefresh(req, res);
        return;
      case 'auth/logout':
        await handleLogout(req, res);
        return;
      default:
        fail(res, 404, 'المسار غير موجود', 'NOT_FOUND');
        return;
    }
  }

  if (method === 'GET') {
    if (route === 'auth/me') {
      await handleMe(req, res);
      return;
    }
    const payload = genericGetPayload(route);
    if (payload) {
      send(res, 200, payload);
      return;
    }
  }

  fail(res, 404, 'المسار غير موجود', 'NOT_FOUND');
}
