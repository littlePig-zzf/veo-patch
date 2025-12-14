# Vidu 视频批量下载工具

这是一个用于批量下载 Vidu 网站（https://www.vidu.cn/create/text2video）视频列表的 Python 脚本。

## 功能特性

- ✅ 支持指定起始和结束索引（data-index）批量下载
- ✅ **多线程并发下载**，大幅提升下载速度
- ✅ 可配置每批并发数量（默认 5 个）
- ✅ 自动滚动页面加载所有目标视频
- ✅ 智能检测滚动容器
- ✅ 实时显示下载进度
- ✅ 自动命名文件（包含日期和索引）
- ✅ 支持多种视频格式（MP4、WebM、MOV）

## 安装依赖

```bash
# 安装 Python 依赖包
pip3 install selenium requests webdriver-manager

# 注意：不需要手动下载 ChromeDriver
# webdriver-manager 会自动下载匹配你 Chrome 版本的驱动
```

**需要的软件：**
- Python 3.7+
- Google Chrome 浏览器

## 使用方法

### 方式1: 交互式运行

```bash
python3 vidu_batch_download.py
```

然后按照提示输入：
- 起始索引（data-index）：例如 1
- 结束索引（data-index）：例如 230
- 输出目录：例如 vidu_videos（默认）
- 每批并发数量：例如 5（默认，建议 1-20）

### 方式2: 代码中配置

编辑脚本中的 `main()` 函数，或者直接在代码中创建下载器：

```python
from vidu_batch_download import VideoBatchDownloader

# 创建下载器，下载索引 1-230 的视频，每批并发 5 个
downloader = VideoBatchDownloader(
    start_index=1,
    end_index=230,
    output_dir="vidu_videos",
    batch_size=5  # 每批并发下载 5 个视频
)

# 运行
downloader.run()
```

## 工作流程

1. **启动浏览器**：自动打开 Chrome 浏览器
2. **打开页面**：访问 https://www.vidu.cn/create/text2video
3. **等待登录**：如果需要登录，脚本会暂停等待你手动登录
4. **滚动收集**：自动滚动页面，收集所有目标视频的 URL
5. **批量下载**：使用多线程并发下载所有视频到指定目录
   - 每批同时下载 5 个视频（可配置）
   - 批次之间有 1 秒间隔，避免服务器压力过大
   - 实时显示下载进度

## 输出文件格式

下载的文件命名格式：`vidu_YYYYMMDD_video_<索引>.<扩展名>`

例如：
- vidu_20251213_video_1.mp4
- vidu_20251213_video_2.mp4
- vidu_20251213_video_230.webm

## 注意事项

1. **Chrome 浏览器**：需要安装 Chrome 浏览器和对应的 ChromeDriver
2. **网络连接**：确保网络稳定，视频文件可能较大
3. **登录状态**：如果页面需要登录，脚本会暂停等待你手动登录
4. **data-index**：data-index=0 是第一个元素，但通常从 1 开始计数
5. **存储空间**：确保有足够的磁盘空间存储视频

## DOM 结构说明

根据 Vidu 页面的 DOM 结构，视频元素包含 `data-index` 属性：

```html
<div data-index="1">
  <video>
    <source src="视频URL" />
  </video>
</div>
```

脚本会：
1. 查找所有带 `data-index` 属性的元素
2. 提取其中的视频 URL（从 `<video>` 或 `<source>` 标签）
3. 下载对应索引范围内的所有视频

## 故障排除

### 问题1: ChromeDriver 版本不匹配
```bash
# 检查 Chrome 版本
google-chrome --version

# 下载对应版本的 ChromeDriver
# https://chromedriver.chromium.org/downloads
```

### 问题2: 找不到视频元素
- 检查页面是否加载完成
- 确认 data-index 属性是否存在
- 可能需要调整等待时间

### 问题3: 下载失败
- 检查网络连接
- 确认视频 URL 是否有效
- 可能需要登录账号

## 与原 Flow 脚本的区别

| 特性 | Flow (Userscript) | Vidu (Python) |
|------|-------------------|---------------|
| 运行环境 | 浏览器扩展 | Python + Selenium |
| 目标网站 | Google Flow | Vidu.cn |
| 打包方式 | ZIP 压缩 | 单个文件下载 |
| 交互方式 | 页面悬浮面板 | 命令行 |
| 滚动逻辑 | 相同 | 相同 |

## 许可证

本工具仅供学习和个人使用，请遵守 Vidu 网站的使用条款。
