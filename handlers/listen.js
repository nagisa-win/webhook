/**
 * Basic webhook listener handler
 * This is the example handler mentioned in config.json
 */

export function handler(req, res) {
    // Log the request for debugging
    console.log(`[listen.js] Received ${req.method} request to ${req.path}`);

    // Return simple success response
    return res.json({
        code: 0,
        status: 'ok',
        message: 'Webhook received successfully',
        timestamp: new Date().toLocaleString(),
        requestInfo: {
            method: req.method,
            path: req.path,
            userAgent: req.get('User-Agent'),
            contentType: req.get('Content-Type'),
            bodySize: JSON.stringify(req.body).length,
            body: req.body,
        },
    });
}
