/**
 * PM2 Production Process Manager Configuration for ICX Studios Self-Hosted Linux Server
 * Usage: pm2 start ecosystem.config.cjs && pm2 save
 */
module.exports = {
  apps: [
    {
      name: 'icx-api-server',
      cwd: './apps/server',
      script: 'dist/index.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
      },
    },
    {
      name: 'icx-web-app',
      cwd: './apps/web',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
  ],
};

