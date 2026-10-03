// Imported first in main.ts: loads .env (if present) before any module reads process.env.
try {
  process.loadEnvFile();
} catch {
  // no .env file: rely on the host's environment (Render / Railway)
}

const missing = ['DATABASE_URL', 'DIRECT_URL', 'REDIS_URL', 'CODE_SECRET', 'WEB_ORIGIN'].filter((k) => !process.env[k]);
if (missing.length) throw new Error(`Missing env vars: ${missing.join(', ')} (see .env.example)`);
