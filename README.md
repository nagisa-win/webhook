# Webhook Server

一个基于Node.js + Express + PM2的动态webhook服务器，类似webhook.site的功能。支持通过配置文件动态添加webhook端点，每个端点可以使用独立的处理逻辑文件。

## 功能特性

- 🚀 **动态路由配置**：通过config.json文件灵活配置webhook端点
- 📁 **模块化处理器**：每个webhook使用独立的handler文件
- 🔒 **安全性**：集成Helmet安全中间件和CORS支持
- 📊 **详细日志**：完整的请求/响应日志记录
- 🔄 **PM2管理**：使用PM2进行进程管理和监控
- 🛠 **错误处理**：完善的错误处理和优雅关闭
- 📈 **健康检查**：内置健康检查端点

## 项目结构

```
webhook/
├── app.js                 # 主应用文件
├── config.json           # 路由配置文件
├── pm2.config.cjs   # PM2配置文件
├── package.json          # 项目配置
├── start.sh             # 启动脚本
├── README.md            # 文档
├── handlers/            # 处理器目录
│   ├── listen.js        # 基础监听处理器
│   ├── health.js        # 健康检查处理器
└── logs/                # 日志目录
    ├── out.log
    └── error.log
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置路由

编辑 `config.json` 文件添加你的webhook端点：

```json
{
    "server": {
        "port": 8080,
        "host": "0.0.0.0"
    },
    "routes": {
        "my webhook": {
            "path": "/my-webhook",
            "method": ["POST"],
            "handler": "my-handler.js"
        }
    }
}
```

### 3. 创建处理器

在 `handlers/` 目录下创建处理器文件：

```javascript
// handlers/my-handler.js
export function handler(req, res) {
    console.log('收到webhook请求:', req.body);

    return res.json({
        status: 'success',
        message: '处理完成',
        timestamp: new Date().toISOString(),
    });
}
```

### 4. 启动服务

#### 使用启动脚本（推荐）

```bash
./start.sh start
```

#### 手动启动

```bash
# 开发模式
npm run dev

# 生产模式（PM2）
npm run pm2:start
```

## 配置说明

### config.json 结构

```json
{
    "server": {
        "port": 8080, // 服务端口
        "host": "0.0.0.0" // 监听地址
    },
    "routes": {
        "路由名称": {
            "path": "/路径", // URL路径，支持参数如 /webhook/:id
            "method": ["GET", "POST"], // 支持的HTTP方法
            "handler": "处理器文件名.js" // 处理器文件名
        }
    }
}
```

### Handler处理器

处理器文件必须导出一个 `handler` 函数：

```javascript
export function handler(req, res) {
    // req: Express请求对象
    // res: Express响应对象

    // 处理逻辑
    console.log('请求数据:', req.body);

    // 返回响应
    return res.json({
        status: 'success',
        data: '处理结果',
    });
}
```

## 内置端点

服务器默认提供以下端点：

| 端点               | 方法                   | 描述                    |
| ------------------ | ---------------------- | ----------------------- |
| `/`                | GET, POST              | 基础监听端点            |
| `/health`          | GET                    | 健康检查                |

## PM2管理命令

```bash
# 启动服务
./start.sh start

npm run pm2:start

# 停止服务
./start.sh stop

npm run pm2:stop

# 重启服务
./start.sh restart

npm run pm2:restart

# 查看状态
npm run pm2:status

# 查看日志
npm run pm2:logs
```

## 使用示例

### 1. 测试基础端点

```bash
# GET请求
curl http://localhost:8080/

# POST请求
curl -X POST http://localhost:8080/ \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
```

### 2. 健康检查

```bash
curl http://localhost:8080/health
```

## 开发指南

### 添加新的webhook

1. 在 `config.json` 中添加路由配置
2. 在 `handlers/` 目录下创建对应的处理器文件
3. 重启服务：`npm run pm2:restart`

### 处理器开发最佳实践

```javascript
export function handler(req, res) {
    try {
        // 1. 验证请求
        if (!req.body) {
            return res.status(400).json({ error: '请求体为空' });
        }

        // 2. 提取数据
        const { action, data } = req.body;

        // 3. 业务逻辑处理
        console.log(`处理 ${action} 操作:`, data);

        // 4. 返回结果
        return res.json({
            status: 'success',
            message: '处理完成',
            timestamp: new Date().toISOString(),
            processed: {
                action,
                dataSize: JSON.stringify(data).length,
            },
        });
    } catch (error) {
        console.error('处理器错误:', error);
        return res.status(500).json({
            status: 'error',
            message: error.message,
        });
    }
}
```

## 部署

### 生产环境部署

1. 设置环境变量：

```bash
export NODE_ENV=production
export PORT=8080
```

2. 启动服务：

```bash
npm run pm2:start
```

3. 设置开机自启：

```bash
pm2 startup
pm2 save
```

### Docker部署

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
EXPOSE 8080

CMD ["npm", "start"]
```

## 故障排除

### 常见问题

1. **端口被占用**
    - 修改 `config.json` 中的端口号
    - 或者停止占用端口的进程

2. **Handler文件不存在**
    - 检查 `handlers/` 目录下是否有对应文件
    - 确保文件导出了 `handler` 函数

3. **PM2启动失败**
    - 检查 `pm2.config.cjs` 配置
    - 查看日志：`npm run pm2:logs`

4. **内存使用过高**
    - 调整 `pm2.config.cjs` 中的 `max_memory_restart`
    - 优化处理器代码

### 日志查看

```bash
# PM2日志
npm run pm2:logs

# 应用日志
tail -f logs/out.log

# 错误日志
tail -f logs/error.log
```

## 许可证

MIT License

## 贡献

欢迎提交 Issues 和 Pull Requests！
