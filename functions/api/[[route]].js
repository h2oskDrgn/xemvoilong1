const PASSWORD_ITERATIONS = 120000;
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;
const BLOCKED_STORAGE_KEYS = new Set([
  'dragonfilm_auth_token',
  'dragonfilm_user',
  'dragonfilm_users',
]);

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') return emptyResponse(204);

  try {
    const route = getRoute(context);

    if (route === 'auth/register' && request.method === 'POST') return register(request, env);
    if (route === 'auth/login' && request.method === 'POST') return login(request, env);
    if (route === 'user-data' && request.method === 'GET') return getUserData(request, env);
    if (route === 'user-data' && ['POST', 'PUT'].includes(request.method)) return saveUserData(request, env);

    return json({ ok: false, error: 'Khong tim thay API.' }, 404);
  } catch (error) {
    return handleError(error);
  }
}

async function register(request, env) {
  const body = await readJson(request);
  const username = normalizeUsername(body.username);
  const password = String(body.password || '');
  const validationError = validateCredentials(username, password);

  if (validationError) return json({ ok: false, error: validationError }, 400);

  const usernameLower = username.toLowerCase();
  const existing = await supabaseRequest(env, `/dragonfilm_users?username_lower=eq.${filterValue(usernameLower)}&select=id&limit=1`);

  if (Array.isArray(existing) && existing.length) {
    return json({ ok: false, error: 'Ten tai khoan da ton tai.', code: 'USERNAME_EXISTS' }, 409);
  }

  const passwordData = await createPasswordHash(password);
  const createdRows = await supabaseRequest(env, '/dragonfilm_users', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      username,
      username_lower: usernameLower,
      ...passwordData,
    }),
  });
  const user = Array.isArray(createdRows) ? createdRows[0] : createdRows;

  await supabaseRequest(env, '/dragonfilm_user_data?on_conflict=user_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({
      user_id: user.id,
      data: {
        app: 'dragonfilm',
        type: 'cloud-data',
        version: 3,
        createdAt: new Date().toISOString(),
      },
    }),
  });

  return json({
    ok: true,
    token: await signToken(env, { sub: user.id, username: user.username }),
    user: {
      id: user.id,
      username: user.username,
    },
  }, 201);
}

async function login(request, env) {
  const body = await readJson(request);
  const username = normalizeUsername(body.username);
  const password = String(body.password || '');
  const validationError = validateCredentials(username, password);

  if (validationError) return json({ ok: false, error: validationError }, 400);

  const rows = await supabaseRequest(
    env,
    `/dragonfilm_users?username_lower=eq.${filterValue(username.toLowerCase())}&select=id,username,password_hash,password_salt,password_iterations&limit=1`
  );
  const user = Array.isArray(rows) ? rows[0] : null;

  if (!user || !(await verifyPassword(password, user))) {
    return json({ ok: false, error: 'Sai ten tai khoan hoac mat khau.', code: 'INVALID_LOGIN' }, 401);
  }

  return json({
    ok: true,
    token: await signToken(env, { sub: user.id, username: user.username }),
    user: {
      id: user.id,
      username: user.username,
    },
  });
}

async function getUserData(request, env) {
  const session = await verifyRequest(request, env);
  const rows = await supabaseRequest(
    env,
    `/dragonfilm_user_data?user_id=eq.${filterValue(session.sub)}&select=data,updated_at&limit=1`
  );
  const row = Array.isArray(rows) ? rows[0] : null;

  return json({
    ok: true,
    data: row?.data || null,
    updatedAt: row?.updated_at || null,
  });
}

async function saveUserData(request, env) {
  const session = await verifyRequest(request, env);
  const body = await readJson(request);
  const data = sanitizeDragonFilmData(body.data || body);
  const rows = await supabaseRequest(env, '/dragonfilm_user_data?on_conflict=user_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({
      user_id: session.sub,
      data,
      updated_at: new Date().toISOString(),
    }),
  });
  const row = Array.isArray(rows) ? rows[0] : rows;

  return json({
    ok: true,
    updatedAt: row?.updated_at || null,
  });
}

function getRoute(context) {
  const route = context.params?.route;
  return Array.isArray(route) ? route.join('/') : String(route || '');
}

async function readJson(request) {
  const text = await request.text();
  if (!text.trim()) return {};

  try {
    return JSON.parse(text);
  } catch {
    const error = new Error('Du lieu gui len khong hop le.');
    error.statusCode = 400;
    throw error;
  }
}

function normalizeUsername(value) {
  return String(value || '').trim();
}

function validateCredentials(username, password) {
  if (!username || !password) return 'Vui long dien day du thong tin.';
  if (username.length < 3) return 'Ten tai khoan it nhat 3 ky tu.';
  if (username.length > 32) return 'Ten tai khoan toi da 32 ky tu.';
  if (!/^[a-zA-Z0-9_.-]+$/.test(username)) {
    return 'Ten tai khoan chi duoc dung chu, so, dau cham, gach duoi hoac gach ngang.';
  }
  if (String(password).length < 4) return 'Mat khau it nhat 4 ky tu.';
  if (String(password).length > 128) return 'Mat khau toi da 128 ky tu.';
  return '';
}

async function createPasswordHash(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await derivePasswordBits(password, salt, PASSWORD_ITERATIONS);

  return {
    password_hash: bytesToBase64(new Uint8Array(bits)),
    password_salt: bytesToBase64(salt),
    password_iterations: PASSWORD_ITERATIONS,
  };
}

async function verifyPassword(password, user) {
  if (!user?.password_hash || !user?.password_salt) return false;

  const salt = base64ToBytes(user.password_salt);
  const expected = user.password_hash;
  const bits = await derivePasswordBits(password, salt, Number(user.password_iterations || PASSWORD_ITERATIONS));
  const actual = bytesToBase64(new Uint8Array(bits));

  return safeEqual(actual, expected);
}

async function derivePasswordBits(password, salt, iterations) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(String(password)),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  return crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt,
      iterations,
    },
    key,
    256
  );
}

async function signToken(env, payload) {
  const now = Math.floor(Date.now() / 1000);
  const unsigned = [
    base64UrlJson({ alg: 'HS256', typ: 'JWT' }),
    base64UrlJson({ ...payload, iat: now, exp: now + TOKEN_TTL_SECONDS }),
  ].join('.');
  const signature = await hmac(env, unsigned);

  return `${unsigned}.${signature}`;
}

async function verifyRequest(request, env) {
  const header = request.headers.get('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const parts = token.split('.');

  if (parts.length !== 3) throwUnauthorized();

  const unsigned = `${parts[0]}.${parts[1]}`;
  const expectedSignature = await hmac(env, unsigned);
  if (!safeEqual(parts[2], expectedSignature)) throwUnauthorized();

  const body = parseBase64UrlJson(parts[1]);
  if (!body?.sub || Number(body.exp || 0) < Math.floor(Date.now() / 1000)) throwUnauthorized();

  return body;
}

async function hmac(env, value) {
  const secret = getRequiredEnv(env, 'DRAGONFILM_JWT_SECRET', 'Server chua cau hinh khoa dang nhap.');
  if (secret.length < 24) {
    const error = new Error('DRAGONFILM_JWT_SECRET qua ngan.');
    error.statusCode = 500;
    error.publicMessage = 'Server chua cau hinh khoa dang nhap.';
    throw error;
  }

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));

  return bytesToBase64Url(new Uint8Array(signature));
}

async function supabaseRequest(env, path, options = {}) {
  const supabaseUrl = getRequiredEnv(env, 'SUPABASE_URL', 'Server chua cau hinh Supabase.').replace(/\/$/, '');
  const serviceRoleKey = getRequiredEnv(env, 'SUPABASE_SERVICE_ROLE_KEY', 'Server chua cau hinh Supabase.');
  const response = await fetch(`${supabaseUrl}/rest/v1${path}`, {
    ...options,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  const payload = text ? parseJson(text) : null;

  if (!response.ok) {
    const error = new Error(payload?.message || `Supabase request failed: ${response.status}`);
    error.statusCode = response.status >= 500 ? 502 : response.status;
    error.publicMessage = payload?.message || 'Khong the ket noi Supabase.';
    throw error;
  }

  return payload;
}

function sanitizeDragonFilmData(input) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const movieLibrary = source.movieLibrary && typeof source.movieLibrary === 'object' && !Array.isArray(source.movieLibrary)
    ? source.movieLibrary
    : {};

  return {
    app: 'dragonfilm',
    type: 'cloud-data',
    version: 3,
    savedAt: new Date().toISOString(),
    localStorage: sanitizeStorage(source.localStorage || source.storage),
    history: arrayOfObjects(source.history).slice(0, 50),
    resumeTimes: sanitizeResumeTimes(source.resumeTimes),
    movieLibrary: {
      watchLater: arrayOfObjects(movieLibrary.watchLater).slice(0, 200),
      liked: arrayOfObjects(movieLibrary.liked).slice(0, 200),
    },
  };
}

function sanitizeStorage(storage) {
  if (!storage || typeof storage !== 'object' || Array.isArray(storage)) return {};

  return Object.entries(storage).reduce((safe, [key, value]) => {
    const storageKey = String(key || '');
    if (!storageKey.startsWith('dragonfilm_') || BLOCKED_STORAGE_KEYS.has(storageKey)) return safe;
    if (value === null || value === undefined) return safe;
    safe[storageKey] = typeof value === 'string' ? value : JSON.stringify(value);
    return safe;
  }, {});
}

function sanitizeResumeTimes(times) {
  if (!times || typeof times !== 'object' || Array.isArray(times)) return {};

  return Object.entries(times).reduce((safe, [slug, seconds]) => {
    const value = Number(seconds);
    if (slug && Number.isFinite(value) && value > 5) safe[String(slug)] = value;
    return safe;
  }, {});
}

function arrayOfObjects(value) {
  return Array.isArray(value) ? value.filter(item => item && typeof item === 'object' && !Array.isArray(item)) : [];
}

function getRequiredEnv(env, key, publicMessage) {
  const value = env?.[key];
  if (value) return String(value);

  const error = new Error(`Missing ${key}`);
  error.statusCode = 500;
  error.publicMessage = publicMessage;
  throw error;
}

function filterValue(value) {
  return encodeURIComponent(String(value));
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: jsonHeaders(),
  });
}

function emptyResponse(status = 204) {
  return new Response(null, {
    status,
    headers: jsonHeaders(),
  });
}

function jsonHeaders() {
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function handleError(error) {
  const status = error.statusCode || 500;
  if (status >= 500) console.error(error);

  return json({
    ok: false,
    error: error.publicMessage || error.message || 'Loi server. Vui long thu lai.',
  }, status);
}

function throwUnauthorized() {
  const error = new Error('Phien dang nhap khong hop le. Vui long dang nhap lai.');
  error.statusCode = 401;
  throw error;
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function base64UrlJson(value) {
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

function parseBase64UrlJson(value) {
  try {
    return JSON.parse(new TextDecoder().decode(base64UrlToBytes(value)));
  } catch {
    throwUnauthorized();
  }
}

function bytesToBase64(bytes) {
  let binary = '';
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64Url(bytes) {
  return bytesToBase64(bytes)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlToBytes(value) {
  const padded = `${value}${'='.repeat((4 - (value.length % 4)) % 4)}`;
  return base64ToBytes(padded.replace(/-/g, '+').replace(/_/g, '/'));
}

function safeEqual(left, right) {
  const a = String(left || '');
  const b = String(right || '');
  let diff = a.length ^ b.length;
  const length = Math.max(a.length, b.length);

  for (let i = 0; i < length; i += 1) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }

  return diff === 0;
}
