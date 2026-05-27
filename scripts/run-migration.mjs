import { existsSync, readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const envFiles = ['.env', '.env.local'];
const originalEnvKeys = new Set(Object.keys(process.env));

for (const envFile of envFiles) {
  if (existsSync(envFile)) {
    loadEnvFile(envFile);
  }
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('DATABASE_URL is missing. Add it to .env or .env.local before running migrations.');
  process.exit(1);
}

console.log('Database migration target:');
console.log(maskDatabaseUrl(databaseUrl));
printDatabaseTargetHint(databaseUrl);

if (looksLikePlainLocalPostgres(databaseUrl)) {
  console.error('');
  console.error('This looks like a plain local PostgreSQL database on port 5432.');
  console.error('This project needs a Supabase database because migrations reference auth.users and auth.uid().');
  console.error('Run `supabase start`, then set DATABASE_URL to:');
  console.error('postgresql://postgres:postgres@127.0.0.1:54322/postgres');
  process.exit(1);
}

if (process.env.CI && looksLikeSupabaseDirectConnection(databaseUrl)) {
  console.error('');
  console.error('This looks like a Supabase direct connection URL.');
  console.error('GitHub Actions often cannot reach Supabase direct database URLs because they require IPv6.');
  console.error('Use the Supabase Session pooler connection string for the GitHub DATABASE_URL secret.');
  console.error('Expected shape: postgresql://postgres.<project-ref>:***@aws-0-<region>.pooler.supabase.com:5432/postgres');
  process.exit(1);
}

if (!process.env.CI) {
  const readline = createInterface({ input, output });
  const answer = await readline.question('Apply pending migrations to this database? Type "yes" to continue: ');
  readline.close();

  if (answer.trim().toLowerCase() !== 'yes') {
    console.log('Migration cancelled.');
    process.exit(1);
  }
}

const child = spawn('supabase', ['migration', 'up', '--db-url', databaseUrl], {
  stdio: 'inherit',
  env: process.env,
});

child.on('error', (error) => {
  if (error.code === 'ENOENT') {
    console.error('Supabase CLI was not found. Install it first: https://supabase.com/docs/guides/cli');
    process.exit(1);
  }

  console.error(error.message);
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code ?? 1);
});

function loadEnvFile(filePath) {
  const lines = readFileSync(filePath, 'utf8').split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    const key = match[1];
    if (originalEnvKeys.has(key)) continue;

    process.env[key] = unquote(match[2].trim());
  }
}

function unquote(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function maskDatabaseUrl(value) {
  try {
    const url = new URL(value);
    if (url.password) url.password = '***';
    return url.toString();
  } catch {
    return value.replace(/:\/\/([^:\s]+):([^@\s]+)@/, '://$1:***@');
  }
}

function printDatabaseTargetHint(value) {
  try {
    const url = new URL(value);
    const username = url.username.includes('.') ? url.username.replace(/\.[^.]+$/, '.<project-ref>') : url.username;

    console.log(`Host: ${url.hostname}`);
    console.log(`Port: ${url.port || '(default)'}`);
    console.log(`User: ${username}`);
  } catch {
    console.log('Could not parse DATABASE_URL for target details.');
  }
}

function looksLikeSupabaseDirectConnection(value) {
  try {
    const url = new URL(value);

    return url.hostname.startsWith('db.') && url.hostname.endsWith('.supabase.co');
  } catch {
    return false;
  }
}

function looksLikePlainLocalPostgres(value) {
  try {
    const url = new URL(value);
    const isLocalHost = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
    const isDefaultPostgresPort = !url.port || url.port === '5432';

    return isLocalHost && isDefaultPostgresPort;
  } catch {
    return false;
  }
}
