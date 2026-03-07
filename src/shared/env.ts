import "dotenv/config";

export function getEnv(name: string): string | undefined {
  return process.env[name];
}

export function requireEnv(name: string): string {
  const value = getEnv(name);

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}
