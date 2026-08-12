// PM2 production process config for the BGT CRM.
// Build first: npm run build  →  then: pm2 start ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'bgt-crm',
      script: 'dist/server.cjs',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      out_file: 'logs/pm2-out.log',
      error_file: 'logs/pm2-error.log',
    },
  ],
};
