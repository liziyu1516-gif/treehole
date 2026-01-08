const studentId = '/239210302'; 
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const app = express();
const port = 3000;

// 开启 JSON 解析中间件（关键！）
app.use(express.json());
app.use(studentId, express.static('public'));

// 初始化数据库
const db = new sqlite3.Database('treehole.db');

// 创建表和添加列的逻辑（修复重复列问题）
function initDatabase() {
    return new Promise((resolve, reject) => {
        // 1. 创建 messages 表（如果不存在）
        db.run(
            "CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, content TEXT, time TEXT, likes INTEGER DEFAULT 0)",
            (err) => {
                if (err) {
                    console.error('创建表失败:', err);
                    reject(err);
                    return;
                }
                console.log('表 messages 已就绪');
                
                // 2. 检查是否需要添加 likes 列（如果表已存在但没有 likes 列）
                checkAndAddLikesColumn(resolve, reject);
            }
        );
    });
}

// 检查并添加 likes 列（如果不存在）
function checkAndAddLikesColumn(resolve, reject) {
    db.get("PRAGMA table_info(messages)", (err, result) => {
        if (err) {
            console.error('检查表结构失败:', err);
            reject(err);
            return;
        }
        
        // 检查所有列，看是否有 likes 列
        db.all("PRAGMA table_info(messages)", (err, columns) => {
            if (err) {
                console.error('获取表结构失败:', err);
                reject(err);
                return;
            }
            
            const hasLikesColumn = columns.some(col => col.name === 'likes');
            
            if (!hasLikesColumn) {
                // 如果没有 likes 列，则添加
                db.run("ALTER TABLE messages ADD COLUMN likes INTEGER DEFAULT 0", (err) => {
                    if (err) {
                        console.error('添加 likes 列失败:', err);
                        reject(err);
                        return;
                    }
                    console.log('已添加 likes 列');
                    resolve();
                });
            } else {
                console.log('likes 列已存在，无需添加');
                resolve();
            }
        });
    });
}

// 初始化数据库并启动服务器
initDatabase().then(() => {
    // 添加根路径重定向到学号路径
    app.get('/', (req, res) => {
        res.redirect(studentId);
    });

    // 接口1：获取所有留言
    app.get(studentId + '/api/messages', (req, res) => {
        
        db.all("SELECT * FROM messages ORDER BY id DESC", (err, rows) => {
            console.log('GET /api/messages/', rows?.length || 0, '条记录');
            res.json(rows);
        });
    });

    // 接口2：提交新留言
    app.post(studentId + '/api/messages', (req, res) => {
        const content = req.body.content; // 获取前端发来的 content

        console.log('POST /api/messages/', content);

        const time = new Date().toLocaleString();

        if(!content) { return res.status(400).json({error: "内容不能为空"}); }

        const stmt = db.prepare("INSERT INTO messages (content, time) VALUES (?, ?)");
        stmt.run(content, time, function(err) {
            // this.lastID 可以拿到新插入数据的ID
            res.json({ id: this.lastID, content: content, time: time });
        });
        stmt.finalize();
    });

    // 删除留言接口
    app.delete(studentId + '/api/messages/:id', (req, res) => {
        const id = req.params.id;
        console.log('DELETE /api/messages/', id);
        const stmt = db.prepare("DELETE FROM messages WHERE id = ?");
        stmt.run(id, function(err) {
            if (err) {
                return res.status(500).json({ error: '删除失败' });
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: '未找到消息' });
            }
            res.json({ success: true });
        });
        stmt.finalize();
    });

    // 点赞/取消点赞接口 - 改为切换模式
    app.put(studentId + '/api/messages/:id/like', (req, res) => {
        const id = req.params.id;
        const { action } = req.body; // 'like' 或 'unlike'
        
        console.log(`PUT /api/messages/${id}/like, action: ${action}`);
        
        if (action === 'like') {
            // 增加点赞数
            db.run("UPDATE messages SET likes = likes + 1 WHERE id = ?", [id], function(err) {
                if (err) {
                    console.error('点赞失败:', err);
                    return res.status(500).json({ error: '点赞失败' });
                }
                if (this.changes === 0) {
                    return res.status(404).json({ error: '未找到消息' });
                }
                
                // 获取更新后的点赞数
                db.get("SELECT likes FROM messages WHERE id = ?", [id], (err, row) => {
                    if (err) {
                        return res.status(500).json({ error: '获取点赞数失败' });
                    }
                    res.json({ success: true, likes: row.likes, action: 'liked' });
                });
            });
        } else if (action === 'unlike') {
            // 减少点赞数（确保不小于0）
            db.run("UPDATE messages SET likes = CASE WHEN likes > 0 THEN likes - 1 ELSE 0 END WHERE id = ?", [id], function(err) {
                if (err) {
                    console.error('取消点赞失败:', err);
                    return res.status(500).json({ error: '取消点赞失败' });
                }
                if (this.changes === 0) {
                    return res.status(404).json({ error: '未找到消息' });
                }
                
                // 获取更新后的点赞数
                db.get("SELECT likes FROM messages WHERE id = ?", [id], (err, row) => {
                    if (err) {
                        return res.status(500).json({ error: '获取点赞数失败' });
                    }
                    res.json({ success: true, likes: row.likes, action: 'unliked' });
                });
            });
        } else {
            res.status(400).json({ error: '无效的操作类型' });
        }
    });

    app.listen(port, () => console.log(`树洞启动: http://localhost:${port}`));
}).catch(err => {
    console.error('数据库初始化失败，无法启动服务器:', err);
});
