import "server-only";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`${name} is not configured.`);
  }

  return value;
}

export function getPrivilegedSupabaseConfig() {
  return {
    url: requireEnv("SUPABASE_URL", supabaseUrl),
    secretKey: requireEnv("SUPABASE_SECRET_KEY", supabaseSecretKey)
  };
}
