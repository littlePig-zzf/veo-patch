#!/bin/bash

# Google Flow 批量提交测试脚本
# AdsPower 环境 ID: kpcl6vt

echo "开始运行 Google Flow 批量提交工具..."
echo "AdsPower 环境 ID: kpcl6vt"
echo ""

# 使用示例提示词文件
python3 main.py \
  --prompts prompts_example.txt \
  --profile-id kpcl6vt \
  --wait-time 5 \
  --yes
