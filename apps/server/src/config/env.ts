import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z
    .string()
    .default('postgresql://icx_admin:icx_secret_password@localhost:5432/icx_studios'),
  REDIS_URL: z.string().default('redis://:icx_redis_secret@localhost:6379/0'),
  CORS_ORIGINS: z.string().default('http://localhost:3000,http://localhost:8081'),
  JWT_ACCESS_SECRET: z
    .string()
    .min(32)
    .default('8f9a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32)
    .default('1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b1a0f'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_SECONDS: z.coerce.number().default(604800), // 7 days
  DOWNLOAD_HMAC_SECRET: z
    .string()
    .min(32)
    .default('9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d'),
  PRIVATE_STORAGE_ROOT: z.string().default('./storage/private'),
  TUS_UPLOAD_DIR: z.string().default('./storage/private/tus-staging'),
  WATERMARK_ASSET_PATH: z.string().default('./storage/private/system/watermark.png'),
  PAYSTACK_SECRET_KEY: z.string().default('sk_test_icx_placeholder_secret'),
});

export const env = EnvSchema.parse(process.env);

