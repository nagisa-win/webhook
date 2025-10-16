/**
 * Health check handler
 * Returns server status and basic information
 */

export function handler(req, res) {
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();

    const healthData = {
        code: 0,
        status: 'healthy',
        timestamp: new Date().toLocaleString(),
        uptime: {
            seconds: Math.floor(uptime),
            readable: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`,
        },
        memory: {
            rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
            heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
            heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
        },
        node: process.version,
        platform: process.platform,
        arch: process.arch,
    };

    console.log(`[health.js] Health check requested`);

    return res.json(healthData);
}
