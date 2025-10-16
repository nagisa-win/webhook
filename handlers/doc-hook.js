import fs from 'fs/promises';
import path from 'path';

const FILE_PATH = path.join(process.cwd(), 'storage');

class UserReadInfo {
    name = '';
    nickname = '';
    lastTs = 0;

    constructor(name, nickname, lastTs) {
        this.name = name;
        this.nickname = nickname;
        this.lastTs = lastTs;
    }
}

export function handler(req, res) {
    // Log the request for debugging
    console.log(`[doc-hook.js] Received ${req.method} request to ${req.path}`);

    const { docName, docId, docType, ts, user, doc, comments } = req.body;

    const fileName = `${docName}_${docId}.${docType}`;
    const filePath = path.join(FILE_PATH, fileName);
    // 保存文档
    if (doc) {
        const { title, author, id, content, nickname, createTime } = doc || {};

        const fileContent = `---
docId: ${id}
title: ${title}
author: ${author}
authorName: ${nickname}
createTime: ${createTime}
---

# ${content}

# Comments

${comments
    .map(
        item => `${item.author}(${item.authorEmail})：
${item.content}
${item.createAt}`
    )
    .join('\n\n')}
`;
        fs.writeFile(filePath, fileContent)
            .then(() => {
                console.log(`File ${fileName} written successfully`);
            })
            .catch(err => {
                console.error(`Error writing file ${fileName}: ${err}`);
            });
    }
    // 保存用户信息
    if (user) {
        const readLogName = fileName + '.json';
        const { name, nickname } = user;
        fs.readFile(path.join(FILE_PATH, readLogName))
            .then(data => {
                if (!data || data.length === 0) {
                    data = [];
                }
                const newUser = new UserReadInfo(name, nickname, ts);
                data.push(newUser);
                return fs.writeFile(path.join(FILE_PATH, readLogName), JSON.stringify(data));
            })
            .then(() => {
                console.log(`User read log ${readLogName} written successfully`);
            })
            .catch(err => {
                console.error(`Error writing user read log ${readLogName}: ${err}`);
            });
    }

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
