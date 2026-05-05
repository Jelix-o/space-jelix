# Hermes Hub 部署与跨端验收

## 构建

前端生产包：

```bash
cd client
npm install
npm run build
```

后端生产包：

```bash
cd server
npm install
npm run build
PORT=3002 CORS_ORIGIN="https://space.9958.uk,capacitor://localhost,http://localhost:5173" npm start
```

Android APK：

```bash
cd client
npm run build
npx cap sync android
cd android
./gradlew assembleDebug
```

APK 输出路径：

```text
client/android/app/build/outputs/apk/debug/app-debug.apk
```

## Nginx 示例

将 `client/dist` 上传到服务器静态目录，例如 `/var/www/hermes-hub/dist`，后端监听 `127.0.0.1:3002`。

```nginx
server {
    listen 80;
    server_name space.9958.uk;

    root /var/www/hermes-hub/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /terminal {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 3600s;
    }
}
```

生产环境建议再用 HTTPS 证书接管 443。APK 默认读取 `client/.env.production` 中的 `VITE_API_URL=https://space.9958.uk`。

## 验收清单

- PC、平板、手机浏览器访问 `https://space.9958.uk`，刷新任意前端路由不 404。
- 访问 `https://space.9958.uk/api/health` 返回 `status: ok`。
- 终端页面可以建立 `/terminal` WebSocket 连接。
- 小米全面屏 APK 下，浅色主题顶部状态栏为淡紫背景，深色主题为深色背景，状态栏文字清晰。
- 设置页、生成页、聊天列表等带底部 tab 的页面唤起输入法时，底部 tab 不再浮到输入框上方。
