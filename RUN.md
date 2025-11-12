# 运行命令

## 🚀 快速开始

### 1. 确保 AdsPower 正在运行

打开 AdsPower 客户端，确保环境 `kpcl6vt` 可用

### 2. 运行测试命令

```bash
cd "/Users/zzf/work/veo批量提交"

python3 main.py --prompts prompts.txt --profile-id kpcl6vt --download-dir "/Users/zzf/youtube/reddit" --download-workers 8 --wait-time 5;
```

> 默认开启无头模式，如需查看浏览器界面请加上 `--show-browser`

### 3. 参数说明

- `--prompts prompts_example.txt` - 提示词文件
- `--profile-id kpcl6vt` - 你的 AdsPower 环境 ID
- `--wait-time 5` - 每次提交后等待 5 秒
- `--show-browser` - 关闭无头模式，强制显示浏览器
- `--yes` - 自动开始，不需要确认
- `--download-only` - 仅执行下载流程（跳过提交提示词）
- `--download-range 1-275` - 指定需要抓取的 `data-index` 范围
- `--force-new-project` - 在下载模式下也自动点击 “New project”
- `--flow-url https://...` - 打开指定 Flow 项目链接（默认首页）
- `--download-chunk-size 80` - 单次滚动采集的最大数量，超大区间可调小以避免超时

## 📝 使用自己的提示词

### 方式 1：编辑现有文件

```bash
# 编辑 prompts_example.txt
nano prompts_example.txt
```

每行一个提示词：

```
A serene mountain landscape at sunset
A futuristic city with flying cars
Ocean waves crashing on a rocky shore
```

### 方式 2：创建新的 JSON 文件

```bash
# 创建 my_prompts.json
cat > my_prompts.json << 'EOF'
[
  "你的第一个提示词",
  "你的第二个提示词",
  "你的第三个提示词"
]
EOF
```

然后运行：

```bash
python3 main.py --prompts my_prompts.json --profile-id kpcl6vt --wait-time 5 --yes
```

## 🔧 高级选项

### 交互模式（手动确认）

```bash
python3 main.py --prompts prompts_example.txt --profile-id kpcl6vt --wait-time 5
# 程序会提示你按 Enter 键确认
```

### 调整等待时间

```bash
# 等待时间设为 10 秒（适合网速较慢的情况）
python3 main.py --prompts prompts_example.txt --profile-id kpcl6vt --wait-time 10 --yes
```

### 显示浏览器界面（关闭无头模式）

```bash
python3 main.py --prompts prompts_example.txt --profile-id kpcl6vt --show-browser --wait-time 5 --yes
```

### 不使用 AdsPower（使用本地 Chrome）

```bash
python3 main.py --prompts prompts_example.txt --wait-time 5 --yes
# 注意：这会启动本地 Chrome，但可能遇到 ChromeDriver 版本问题
```

## 📊 预期输出

程序运行时会显示：

```
==================================================
Google Flow 批量提交工具
==================================================
提示词数量: 3
等待时间: 5 秒
AdsPower 环境: kpcl6vt
==================================================

使用 AdsPower 指纹浏览器...
正在启动 AdsPower 环境: kpcl6vt
✓ 成功连接到 AdsPower 浏览器
正在打开 https://labs.google/fx/tools/flow
✓ 页面已加载
✓ 已点击 New project 按钮

开始批量提交 3 个提示词...
✓ [1/3] 提示词已提交
✓ [2/3] 提示词已提交
✓ [3/3] 提示词已提交

正在等待视频生成完成...
  → 视频生成中: 25%
  → 视频生成中: 50%
  → 视频生成中: 75%
✓ 视频已生成完成！

开始批量下载视频...
✓ 批量下载完成！共 3 个视频

✓ 全部流程执行完成！
```

## ⚠️ 已知问题

如果遇到 `no such window: target window already closed` 错误：

**原因**：ChromeDriver 版本不匹配

**解决方案**：查看 [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

## 🛑 停止程序

如果需要停止程序，按 `Ctrl + C`

## 🔍 调试模式

如果遇到问题，想查看浏览器操作过程，去掉 `--yes` 参数并使用 `--show-browser`：

```bash
python3 main.py --prompts prompts_example.txt --profile-id kpcl6vt --show-browser
```

这样程序会等待你按 Enter 确认，浏览器也会保持打开让你查看。
### 单独下载模式（只滚动收集并下载视频）

当提示词已经全部提交完成，只需要重新抓取并下载视频时，可以使用下载模式：

```bash
python3 main.py \
  --download-only \
  --download-range 1-275 \
  --download-chunk-size 60 \
  --flow-url "https://labs.google/fx/tools/flow/projects/xxxx" \
  --profile-id kpcl6vt \
  --download-dir "/Users/zzf/youtube/reddit" \
  --show-browser \
  --yes
```

- `--download-range` 可写成 `起始-结束` 或单个数值，例如 `120`。
- 未提供 `--download-range` 时，会默认使用提示词文件行数；如未指定提示词文件，请务必设置范围。
- 下载模式默认不会自动点击 “New project”，若需要进入空白项目，可追加 `--force-new-project`。
- 需要抓取某个特定项目，可通过 `--flow-url` 传入该项目链接，脚本会直接打开该页面。
- 当数据量非常大时，可用 `--download-chunk-size 40` 等更小的值，让脚本分批采集，避免浏览器响应超时。
- 推荐搭配 `--show-browser`，确认页面已经展示出需要抓取的 `data-index` 列表后再执行。
