module.exports = {
  apps: [
    {
      name: 'webhook-server',
      script: 'app.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 8080
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 8080
      },
      // PM2 logs configuration
      out_file: 'logs/out.log',
      error_file: 'logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Process management
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 5000,
      
      // Advanced features
      node_args: '--max-old-space-size=1024',
      
      // Restart conditions
      min_uptime: '10s',
      max_restarts: 10,
      
      // Monitoring
      monit: true
    }
  ]
};
