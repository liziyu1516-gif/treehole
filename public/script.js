/* 
 * 树洞前端逻辑
 * 连接了 Node.js 后端。
 */
// 1. 消息数据（动态从后端获取）
let msgData = []; // 会通过 loadMessages() 填充来自 /api/messages 的数据（形状：{id, content, time}）

// 2. 获取DOM元素
// 在所有fetch请求前添加学号前缀
const API_PREFIX = '/239210302'; 
const msgInput = document.getElementById('msgInput');
const sendBtn = document.getElementById('sendBtn');
const msgList = document.getElementById('msgList');
const charCount = document.getElementById('charCount');

// 获取用户点赞状态存储键
function getUserLikeKey(messageId) {
    return `like_${messageId}`;
}

// 检查用户是否已点赞某条消息
function hasUserLiked(messageId) {
    return localStorage.getItem(getUserLikeKey(messageId)) === 'true';
}

// 设置用户点赞状态
function setUserLikeStatus(messageId, liked) {
    localStorage.setItem(getUserLikeKey(messageId), liked ? 'true' : 'false');
}

// 3. 渲染函数：把数据变成HTML
function renderMessages() {
    msgList.innerHTML = ''; 
    // 清空当前列表
    // 倒序遍历（新消息在上面）
    // Slice()是为了复制一份数组，防止reverse影响原数组
    msgData.slice().reverse().forEach(msg => {
        // 创建卡片容器
        const li = document.createElement('li');
        li.className = 'message-card';

        // 安全地处理内容 (防XSS攻击的伏笔)
        // 使用 textContent 而不是 innerHTML
        const divContent = document.createElement('div');
        divContent.className = 'msg-content';
        divContent.textContent = msg.content; 

        // 检查用户是否已点赞此消息
        const userLiked = hasUserLiked(msg.id);
        const likeCount = msg.likes || 0;
        
        // 创建元数据区 (时间 + 点赞/取消点赞按钮 + 删除按钮)
        const divMeta = document.createElement('div');
        divMeta.className = 'msg-meta';
        
        divMeta.innerHTML = `
            <span class="time">${msg.time}</span>
            <div class="like-section">
                <button class="btn-like ${userLiked ? 'liked' : ''}" onclick="toggleLike(${msg.id})" data-liked="${userLiked}">
                    <span class="like-icon">${userLiked ? '❤️' : '🤍'}</span>
                    <span class="like-count" id="like-count-${msg.id}">${likeCount}</span>
                </button>
                <button class="btn-delete" onclick="deleteMessage(${msg.id})">删除</button>
            </div>
        `;

        // 组装
        li.appendChild(divContent);
        li.appendChild(divMeta);
        msgList.appendChild(li);
    });
}

// 4. 字数统计功能 (提升用户体验的小细节)
msgInput.addEventListener('input', function() {
    const len = this.value.length;
    charCount.textContent = `${len}/200`;
    if(len >= 200) {
        charCount.style.color = 'red';
    } else {
        charCount.style.color = '#888';
    }
});

// 5. 删除功能 (全局函数，以便HTML中的onclick调用)
window.deleteMessage = function(id) {
    if (!confirm("确定要删除这条树洞吗？")) return;
    fetch(API_PREFIX + `/api/messages/${id}`, { method: 'DELETE' })
      .then(res => {
        if (!res.ok) throw new Error('删除失败');
        return res.json();
      })
      .then(() => {
        // 删除成功后从本地存储中也移除点赞状态
        localStorage.removeItem(getUserLikeKey(id));
        // 重新从后端加载并渲染
        loadMessages();
      })
      .catch(err => {
        console.error('删除失败', err);
        showAlert('删除失败，请稍后重试', 'error');
      });
};

// 点赞/取消点赞功能
window.toggleLike = function(id) {
    const userLiked = hasUserLiked(id);
    const action = userLiked ? 'unlike' : 'like';
    
    // 获取点赞按钮和计数元素
    const likeBtn = document.querySelector(`.btn-like[onclick="toggleLike(${id})"]`);
    const likeCountElement = document.getElementById(`like-count-${id}`);
    
    if (!likeBtn || !likeCountElement) {
        console.error('未找到点赞按钮或计数元素');
        return;
    }
    
    // 禁用按钮防止重复点击
    likeBtn.disabled = true;
    
    fetch(API_PREFIX + `/api/messages/${id}/like`, { 
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: action })
    })
    .then(res => {
        if (!res.ok) throw new Error(`${action === 'like' ? '点赞' : '取消点赞'}失败`);
        return res.json();
    })
    .then(data => {
        // 更新点赞数显示
        likeCountElement.textContent = data.likes;
        
        // 更新本地存储状态
        const newLikedStatus = action === 'like';
        setUserLikeStatus(id, newLikedStatus);
        
        // 更新按钮状态
        likeBtn.dataset.liked = newLikedStatus;
        likeBtn.classList.toggle('liked', newLikedStatus);
        
        // 更新图标
        const likeIcon = likeBtn.querySelector('.like-icon');
        if (likeIcon) {
            likeIcon.textContent = newLikedStatus ? '❤️' : '🤍';
        }
        
        // 显示提示信息
        const message = newLikedStatus ? '点赞成功！' : '已取消点赞';
        showAlert(message, 'success');
        
        // 添加点赞动画效果
        likeBtn.classList.add('like-animation');
        setTimeout(() => {
            likeBtn.classList.remove('like-animation');
        }, 500);
    })
    .catch(err => {
        console.error(`${action === 'like' ? '点赞' : '取消点赞'}失败`, err);
        showAlert(`${action === 'like' ? '点赞' : '取消点赞'}失败，请稍后重试`, 'error');
    })
    .finally(() => {
        // 重新启用按钮
        setTimeout(() => {
            likeBtn.disabled = false;
        }, 500);
    });
};

// --- 初始化 ---
// 页面加载完成后，将通过 loadMessages() 从后端获取并渲染数据

// --- 客户端：通过 HTTP 请求与后端交互（浏览器环境） ---
// 加载留言函数（从后端 /api/messages 获取数据）
function loadMessages() {
    fetch(API_PREFIX + '/api/messages')
        .then(res => res.json())
        .then(data => {
            // 将后端返回的数据映射到 msgData，包含点赞数
            msgData = data.map(m => ({ 
                id: m.id, 
                content: m.content, 
                time: m.time,
                likes: m.likes || 0  // 确保有 likes 字段，默认为0
            }));
            console.log('加载的留言数据：', msgData); // 调试用，可删除
            renderMessages();
        }).catch(err => {
            console.error('加载留言失败', err);
        });
}

// 发送留言事件
sendBtn.onclick = () => {
    const content = msgInput.value.trim();
    
    // 输入校验
    if (!content) {
        // 使用更友好的提示方式
        showAlert('请输入内容后再发送哦~', 'warning');
        msgInput.focus();
        return;
    }
    
    sendBtn.disabled = true;
    sendBtn.innerHTML = '发送中...';

    fetch(API_PREFIX + '/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content })
    })
    .then(res => {
        if (!res.ok) {
            throw new Error('发送失败');
        }
        return res.json();
    })
    .then(() => {
        msgInput.value = '';
        charCount.textContent = '0/200';
        charCount.style.color = '#888';
        loadMessages();
        showAlert('留言发送成功！', 'success');
    })
    .catch(err => {
        console.error('发送失败', err);
        showAlert('发送失败，请稍后重试', 'error');
    })
    .finally(() => {
        sendBtn.disabled = false;
        sendBtn.innerHTML = '发送留言';
    });
};

// 添加显示提示的函数
function showAlert(message, type = 'info') {
    // 创建提示元素
    const alertDiv = document.createElement('div');
    alertDiv.className = `custom-alert alert-${type}`;
    alertDiv.textContent = message;
    
    // 添加到页面顶部
    document.body.insertBefore(alertDiv, document.body.firstChild);
    
    // 显示动画
    setTimeout(() => {
        alertDiv.classList.add('show');
    }, 10);
    
    // 3秒后移除
    setTimeout(() => {
        alertDiv.classList.remove('show');
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.parentNode.removeChild(alertDiv);
            }
        }, 400);
    }, 3000);
}

// 页面一打开就加载
loadMessages();
