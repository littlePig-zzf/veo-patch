# 运行命令

## 🚀 快速开始

### 1. 确保 AdsPower 正在运行

打开 AdsPower 客户端，确保环境 `kpcl6vt` 可用

### 2. 运行测试命令

```bash
cd "/Users/zzf/work/veo批量提交"

python3 main.py --prompts prompts_example.txt --profile-id kpcl6vt --wait-time 5 --yes
```

### 3. 参数说明

- `--prompts prompts_example.txt` - 提示词文件
- `--profile-id kpcl6vt` - 你的 AdsPower 环境 ID
- `--wait-time 5` - 每次提交后等待 5 秒
- `--yes` - 自动开始，不需要确认

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

如果遇到问题，想查看浏览器操作过程，去掉 `--yes` 参数：

```bash
python3 main.py --prompts prompts_example.txt --profile-id kpcl6vt
```

这样程序会等待你按 Enter 确认，浏览器也会保持打开让你查看。
