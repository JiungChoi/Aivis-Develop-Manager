// Runtime config from environment (see .env.example).
export const PORT = Number(process.env.PORT ?? 4500);

// Public base URL of this manager (used in approval links shared by the loop).
export const PUBLIC_URL = (process.env.PUBLIC_URL ?? `http://localhost:${PORT}`).replace(/\/+$/, '');

// Shared secret guarding approve/decline. When set (required for public tunnels),
// approval links must carry ?token=<APPROVAL_TOKEN>; calls without it are rejected.
export const APPROVAL_TOKEN = process.env.APPROVAL_TOKEN ?? '';
