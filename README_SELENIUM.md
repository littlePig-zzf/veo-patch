# Google Flow 批量提交工具（Selenium 版本）

基于 Selenium 和 AdsPower 的 Google Flow 文生视频批量提交和下载工具。

## 功能特性

✅ **支持 AdsPower 指纹浏览器**：防检测、多账号管理
✅ **自动化完整流程**：打开页面 → 点击 New Project → 批量提交 → 等待生成 → 批量下载
✅ **智能进度监控**：自动检测视频生成完成（监控 data-index="1" 的视频链接）
✅ **可后台运行**：支持 headless 模式（无界面）
✅ **灵活配置**：支持 .txt 和 .json 格式的提示词文件

## 文件说明

```
.
├── main.py                    # 主程序入口
├── adspower_api.py           # AdsPower API 集成模块
├── flow_automation.py        # Google Flow 自动化核心逻辑
├── requirements.txt          # Python 依赖
├── prompts_example.txt       # 示例提示词文件（文本格式）
├── prompts_example.json      # 示例提示词文件（JSON 格式）
└── README_SELENIUM.md        # 本文档
```

## 安装依赖

```bash
# 安装 Python 依赖
pip install -r requirements.txt

# 如果使用 Chrome，需要安装 ChromeDriver
# 或者使用 webdriver-manager 自动管理（已包含在 requirements.txt）
```

## 准备提示词文件

### 方式 1：文本文件（.txt）

每行一个提示词：

```txt
A serene mountain landscape at sunset
A futuristic city with flying cars
Ocean waves crashing on a rocky shore
```

### 方式 2：JSON 文件（.json）

```json
[
  "A serene mountain landscape at sunset",
  "A futuristic city with flying cars",
  "Ocean waves crashing on a rocky shore"
]
```

## 使用方法

### 方式 1：使用本地 Chrome

```bash
python main.py --prompts prompts_example.txt
```

**可选参数：**
- `--wait-time 5`：设置每次提交后的等待时间（秒）
- `--headless`：无头模式运行（不显示浏览器窗口）

### 方式 2：使用 AdsPower 指纹浏览器（推荐）

```bash
python main.py \
  --prompts prompts_example.txt \
  --profile-id "你的AdsPower环境ID" \
  --wait-time 5
```

**如何获取 AdsPower 环境 ID：**
1. 打开 AdsPower 客户端
2. 在浏览器列表中找到你的环境
3. 复制环境 ID（通常是一串字符）

## 完整流程说明

程序将自动执行以下步骤：

1. **启动浏览器**
   - 如果使用 AdsPower，连接到指定的指纹环境
   - 如果使用本地 Chrome，启动新的浏览器实例

2. **打开 Google Flow 页面**
   - 访问 https://labs.google/fx/tools/flow

3. **点击 New Project**
   - 自动查找并点击 "New project" 按钮

4. **批量提交提示词**
   - 按顺序提交所有提示词
   - 每次提交后等待指定时间（默认 3 秒）

5. **等待视频生成完成**
   - 监控 `data-index="1"` 的元素
   - 检测是否出现视频链接或下载按钮
   - 最多等待 10 分钟（600 秒）

6. **批量下载视频**
   - 自动触发所有视频的下载（索引 1 到 提示词数量）

## 进阶配置

### 修改等待超时时间

编辑 [flow_automation.py](flow_automation.py:149)：

```python
def wait_for_video_ready(self, timeout=600):  # 默认 600 秒（10 分钟）
```

### 自定义下载范围

如果只想下载特定范围的视频，可以修改 [flow_automation.py](flow_automation.py:286)：

```python
# 例如：只下载第 1-5 个视频
self.batch_download_videos(start_index=1, end_index=5)
```

### AdsPower API 地址

如果 AdsPower API 地址不是默认的 `http://local.adspower.net:50325`，可以修改 [adspower_api.py](adspower_api.py:13)：

```python
def __init__(self, api_url="http://your-custom-url:port"):
```

## 常见问题

### 1. 无法找到 "New project" 按钮

**原因**：页面加载较慢或页面结构变化
**解决**：
- 增加等待时间：`--wait-time 10`
- 检查是否已登录 Google 账号
- 手动刷新页面后重试

### 2. 视频未检测到生成完成

**原因**：页面结构变化或生成时间过长
**解决**：
- 增加超时时间（修改 `wait_for_video_ready` 的 `timeout` 参数）
- 手动检查 `data-index="1"` 的元素是否存在

### 3. AdsPower 连接失败

**检查清单**：
- ✅ AdsPower 客户端是否正在运行
- ✅ API 地址是否正确（默认 `http://local.adspower.net:50325`）
- ✅ 环境 ID 是否正确
- ✅ 环境是否已被其他程序占用

### 4. 下载未开始

**原因**：页面下载按钮结构变化
**解决**：
- 检查浏览器控制台是否有错误
- 手动点击一次下载按钮，观察元素选择器
- 根据实际情况修改 [flow_automation.py](flow_automation.py:197) 中的下载逻辑

## 与 Chrome 插件版本的对比

| 特性 | Chrome 插件 | Selenium 版本 |
|------|------------|--------------|
| 需要浏览器可见 | ✅ 是 | ❌ 否（支持 headless） |
| 占用本机资源 | ✅ 是 | ❌ 否（可放服务器） |
| 支持 AdsPower | ⚠️ 手动配置 | ✅ 原生支持 |
| 自动化程度 | ⚠️ 中 | ✅ 高 |
| 批量并发 | ❌ 难 | ✅ 容易 |
| 后台运行 | ❌ 不支持 | ✅ 支持 |
| 错误处理 | ⚠️ 中 | ✅ 强 |

## 示例输出

```
==================================================
Google Flow 批量提交工具
==================================================
提示词数量: 3
等待时间: 3 秒
AdsPower 环境: jxxxxxx
无头模式: 否
==================================================

按 Enter 键开始执行，输入 'q' 退出:

正在启动 AdsPower 环境: jxxxxxx
浏览器已启动，Selenium 地址: 127.0.0.1:9515
✓ 成功连接到 AdsPower 浏览器
正在打开 https://labs.google/fx/tools/flow
✓ 页面已加载
正在查找 New project 按钮...
✓ 找到 New project 按钮，准备点击
✓ 已点击 New project 按钮

开始批量提交 3 个提示词...

[1/3] 正在提交提示词...
提示词: A serene mountain landscape at sunset...
  → 查找提示词输入框...
  → 输入提示词...
  → 查找生成按钮...
  → 点击生成按钮...
✓ [1/3] 提示词已提交

[2/3] 正在提交提示词...
...

✓ 所有提示词已提交完成！共 3 个

正在等待视频生成完成（最多等待 600 秒）...
✓ 检测到视频源: blob:https://labs.google/...
✓ 视频已生成完成！(检查了 45 次)

开始批量下载视频（索引 1 到 3）...
✓ 批量下载完成！共触发 3 个下载

==================================================
✓ 全部流程执行完成！
==================================================

✓ 程序执行完成！
提示: 浏览器将保持打开，您可以手动检查结果

按 Enter 键关闭浏览器...
```

## 开发与调试

如果需要调试或修改代码：

1. **查看浏览器控制台**：移除 `--headless` 参数
2. **添加断点**：在代码中插入 `import pdb; pdb.set_trace()`
3. **查看元素选择器**：使用浏览器开发者工具检查 DOM 结构
4. **增加日志输出**：在关键步骤添加 `print()` 语句

## 许可证

本项目与原 Chrome 插件共享相同的许可证。

## 问题反馈

如有问题，请在项目 GitHub 仓库提交 Issue。
