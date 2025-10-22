import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class WebhookServer {
    constructor() {
        this.app = express();
        this.config = null;
        this.handlersDir = path.join(__dirname, 'handlers');

        this.setupMiddleware();
    }

    setupMiddleware() {
        // Security middleware with CSP allowing our dashboard assets
        this.app.use(
            helmet({
                contentSecurityPolicy: {
                    useDefaults: true,
                    directives: {
                        defaultSrc: ["'self'"],
                        scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
                        styleSrc: ["'self'", "'unsafe-inline'"],
                        imgSrc: ["'self'", 'data:'],
                        connectSrc: ["'self'"],
                        fontSrc: ["'self'", 'data:'],
                        objectSrc: ["'none'"],
                        frameAncestors: ["'self'"],
                        baseUri: ["'self'"],
                    },
                },
            })
        );

        // CORS middleware
        this.app.use(cors());

        // Logging middleware
        this.app.use(morgan('combined'));

        // Body parsing middleware
        this.app.use(bodyParser.json({ limit: '10mb' }));
        this.app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
        this.app.use(bodyParser.raw({ limit: '10mb' }));
        this.app.use(bodyParser.text({ limit: '10mb' }));

        // Request logging middleware
        this.app.use((req, res, next) => {
            console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
            console.log('Headers:', JSON.stringify(req.headers, null, 2));
            if (Object.keys(req.body).length > 0) {
                console.log('Body:', JSON.stringify(req.body, null, 2));
            }
            next();
        });
    }

    async loadConfig() {
        try {
            const configPath = path.join(__dirname, 'config.json');
            const configData = await fs.readFile(configPath, 'utf8');
            this.config = JSON.parse(configData);
            console.log('Configuration loaded successfully');
        } catch (error) {
            console.error('Failed to load configuration:', error.message);
            process.exit(1);
        }
    }

    async ensureHandlersDirectory() {
        try {
            await fs.access(this.handlersDir);
        } catch {
            await fs.mkdir(this.handlersDir, { recursive: true });
            console.log('Created handlers directory');
        }
    }

    async loadHandler(handlerFile) {
        try {
            const handlerPath = path.join(this.handlersDir, handlerFile);

            // Check if handler file exists
            try {
                await fs.access(handlerPath);
            } catch {
                console.warn(`Handler file not found: ${handlerPath}`);
                return this.createDefaultHandler(handlerFile);
            }

            // Dynamic import with cache busting for development
            const module = await import(`${handlerPath}?t=${Date.now()}`);

            if (typeof module.handler !== 'function') {
                console.warn(`Handler function not exported from ${handlerFile}`);
                return this.createDefaultHandler(handlerFile);
            }

            return module.handler;
        } catch (error) {
            console.error(`Failed to load handler ${handlerFile}:`, error.message);
            return this.createDefaultHandler(handlerFile);
        }
    }

    createDefaultHandler(handlerFile) {
        return (req, res) => {
            res.json({
                status: 'success',
                message: `Webhook received at ${req.path}`,
                handler: handlerFile,
                timestamp: new Date().toISOString(),
                method: req.method,
                headers: req.headers,
                query: req.query,
                params: req.params,
                body: req.body,
            });
        };
    }

    async registerRoutes() {
        const routes = this.config.routes;

        for (const [routeName, routeConfig] of Object.entries(routes)) {
            const { path: routePath, method: methods, handler: handlerFile } = routeConfig;

            console.log(`Registering route: ${routeName}`);
            console.log(`  Path: ${routePath}`);
            console.log(`  Methods: ${methods.join(', ')}`);
            console.log(`  Handler: ${handlerFile}`);

            // Load the handler function
            const handlerFunction = await this.loadHandler(handlerFile);

            // Register route for each HTTP method
            methods.forEach(method => {
                const lowerMethod = method.toLowerCase();

                if (typeof this.app[lowerMethod] === 'function') {
                    this.app[lowerMethod](routePath, async (req, res) => {
                        try {
                            await handlerFunction(req, res);
                        } catch (error) {
                            console.error(`Handler error for ${routePath}:`, error);
                            if (!res.headersSent) {
                                res.status(500).json({
                                    status: 'error',
                                    message: 'Internal server error',
                                    error: error.message,
                                });
                            }
                        }
                    });
                } else {
                    console.warn(`Unsupported HTTP method: ${method}`);
                }
            });
        }
    }

    setupErrorHandling() {
        // 404 handler
        this.app.use((req, res) => {
            res.status(404).json({
                status: 'error',
                message: 'Route not found',
                path: req.path,
                method: req.method,
            });
        });

        // Global error handler
        this.app.use((error, req, res, next) => {
            console.error('Unhandled error:', error);

            if (!res.headersSent) {
                res.status(500).json({
                    status: 'error',
                    message: 'Internal server error',
                    error:
                        process.env.NODE_ENV === 'development'
                            ? error.message
                            : 'Something went wrong',
                });
            }
        });
    }

    async start() {
        try {
            await this.loadConfig();
            await this.ensureHandlersDirectory();
            await this.registerRoutes();

            this.setupErrorHandling();

            const { host, port } = this.config.server;

            this.server = this.app.listen(port, host, () => {
                console.log(`🚀 Webhook server started on http://${host}:${port}`);
                console.log(`📁 Handlers directory: ${this.handlersDir}`);
                console.log(`📋 Registered ${Object.keys(this.config.routes).length} routes`);
            });

            // Graceful shutdown
            process.on('SIGTERM', () => this.shutdown());
            process.on('SIGINT', () => this.shutdown());
        } catch (error) {
            console.error('Failed to start server:', error);
            process.exit(1);
        }
    }

    async shutdown() {
        console.log('Shutting down server...');

        if (this.server) {
            this.server.close(() => {
                console.log('Server closed');
                process.exit(0);
            });
        } else {
            process.exit(0);
        }
    }
}

// Start the server
const webhookServer = new WebhookServer();
webhookServer.start();

export default WebhookServer;
