module.exports = {
  apps: [
    {
      name: 'ilena-backend',
      script: 'src/app.js',
      cwd: '/mine/sistem_ilena/html/backend',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '400M',
      env: { NODE_ENV: 'production' },
    },
    {
      name: 'ilena-frontend',
      script: 'node_modules/.bin/next',
      args: 'start -p 3001',
      cwd: '/mine/sistem_ilena/html/frontend',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '500M',
      env: { NODE_ENV: 'production', PORT: 3001 },
    },
  ],
};
