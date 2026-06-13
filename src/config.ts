// Runtime config from environment (see .env.example).
export const PORT = Number(process.env.PORT ?? 4500);

// Public base URL of this manager (used in approval links shared by the loop).
export const PUBLIC_URL = (process.env.PUBLIC_URL ?? `http://localhost:${PORT}`).replace(/\/+$/, '');
