/**
 * PM2 ecosystem example for Windows Server (non-Docker fallback).
 *
 *   npm install -g pm2
 *   copy deploy\pm2.ecosystem.example.cjs C:\baladiyati\pm2.ecosystem.cjs
 *   pm2 start C:\baladiyati\pm2.ecosystem.cjs
 *   pm2 save
 *   pm2 startup   # follow printed instructions for Windows boot
 */
module.exports = {
  apps: [
    {
      name: 'baladi-api',
      cwd: 'C:\\baladiyati\\app',
      script: 'dist\\src\\main.js',
      interpreter: 'node',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '512M',
    },
    {
      name: 'baladi-web',
      cwd: 'C:\\baladiyati\\app\\web-dashboard',
      script: 'node_modules\\next\\dist\\bin\\next',
      args: 'start -p 3001',
      interpreter: 'node',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '512M',
    },
  ],
};
