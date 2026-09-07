# 翠压 - 图片压缩工具

一个支持批量图片压缩的全栈 Web 工具，提供压缩质量控制、格式转换、前后预览对比和 ZIP 批量下载。

## 功能

- 支持 JPG、PNG、WebP、GIF、TIFF、AVIF 图片上传
- 单次最多处理 20 张图片，单张最大 25MB
- 高、中、低质量预设，以及 1% 至 100% 的自定义质量
- 输出为 WebP、JPG、PNG 或保留原格式
- 显示压缩前后的尺寸、文件大小和预览图
- 支持单张下载和批量打包 ZIP 下载
- 响应式绿色界面，适配桌面和手机设备

## 技术栈

- 后端：Node.js、Express、Sharp、Multer、Archiver
- 前端：原生 HTML、CSS、JavaScript

## 本地运行

```bash
npm install
npm start
```

服务启动后，访问 [http://localhost:3000](http://localhost:3000)。

开发时可使用文件监听模式：

```bash
npm run dev
```

## 项目结构

```text
chzpng/
├── public/
│   ├── index.html       # 页面结构
│   ├── styles.css       # 响应式样式
│   └── app.js           # 上传、压缩和下载交互
├── server.js            # Express API 与 Sharp 图片处理
├── package.json         # 依赖和脚本
└── README.md
```

## API

### `POST /api/compress`

使用 `multipart/form-data` 提交图片压缩任务。

字段：

- `images`：一个或多个图片文件
- `quality`：`1` 至 `100` 的压缩质量，默认 `75`
- `format`：`webp`、`jpeg`、`png` 或 `original`，默认 `webp`

响应包含每张图片的原始信息、压缩后信息，以及可直接预览或下载的 Base64 Data URL。

### `POST /api/download-zip`

接收包含压缩图片名称和 Data URL 的 JSON 数据，返回 `compressed-images.zip` 文件。

## 注意事项

- 图片数据仅在本次请求处理期间保存在内存中，服务不会主动落盘保存上传文件。
- 批量 ZIP 接口使用 JSON 传输 Data URL；大批量或超大图片部署时，应结合反向代理限制调整请求体大小。
