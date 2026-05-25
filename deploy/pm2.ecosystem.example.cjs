/**
 * PM2 ecosystem example for Windows Server (non-Docker fallback).
 *
 *   copy deploy\pm2.ecosystem.example.cjs C:\baladiyati\ecosystem.config.cjs
 *   pm2 delete baladi-api baladi-web 2>$null
 *   pm2 start C:\baladiyati\ecosystem.config.cjs
 *   pm2 save
 *
 * IMPORTANT: the destination file MUST be named ecosystem.config.cjs (or .js).
 * PM2 7 treats pm2.ecosystem.cjs as a normal Node script, not an ecosystem file.
 */
const node = 'C:\\Program Files\\nodejs\\node.exe';

module.exports = {
  apps: [
    {
      name: 'baladi-api',
      cwd: 'C:\\baladiyati\\app',
      script: 'dist\\src\\main.js',
      interpreter: node,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      env: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '512M',
    },
    {
      name: 'baladi-web',
      cwd: 'C:\\baladiyati\\app\\web-dashboard',
      script: 'node_modules\\next\\dist\\bin\\next',
      args: ['start', '-p', '3001'],
      interpreter: node,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      env: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '512M',
    },
  ],
};
