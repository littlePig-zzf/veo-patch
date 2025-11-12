"""
Google Flow 批量提交主程序
支持 AdsPower 指纹浏览器集成
"""

import json
import argparse
import sys
from adspower_api import AdsPowerAPI
from flow_automation import FlowAutomation


def load_prompts_from_file(file_path):
    """
    从文件加载提示词

    Args:
        file_path: 文件路径（支持 .txt 或 .json）

    Returns:
        提示词列表
    """
    print(f"正在加载提示词文件: {file_path}")

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            if file_path.endswith('.json'):
                data = json.load(f)
                if isinstance(data, list):
                    prompts = [str(item) for item in data]
                else:
                    raise ValueError("JSON 文件必须是数组格式")
            else:
                # .txt 文件，每行一个提示词
                prompts = [line.strip() for line in f if line.strip()]

        print(f"✓ 成功加载 {len(prompts)} 个提示词")
        return prompts

    except Exception as e:
        print(f"✗ 加载提示词失败: {e}")
        sys.exit(1)


def parse_download_range(range_str, default_total):
    """
    解析下载范围参数

    Args:
        range_str: 形如 "1-10" 或 "8" 的字符串
        default_total: 默认的结束索引（一般为提示词数量）
    """
    if not range_str:
        total = default_total if default_total and default_total > 0 else 1
        return 1, total

    cleaned = range_str.strip()
    cleaned = cleaned.replace('，', ',')
    cleaned = cleaned.replace('－', '-').replace('–', '-').replace('—', '-')

    if '-' in cleaned:
        parts = [p for p in cleaned.split('-') if p.strip()]
        if len(parts) != 2:
            raise ValueError("范围格式应为 start-end，例如 1-10")
        start, end = parts
    else:
        start = cleaned
        end = cleaned

    try:
        start_int = int(start)
        end_int = int(end)
    except ValueError:
        raise ValueError("范围必须是整数或整数范围，例如 5 或 5-20")

    if start_int <= 0 or end_int <= 0:
        raise ValueError("范围必须从 1 开始的正整数")

    return (start_int, end_int) if start_int <= end_int else (end_int, start_int)


def main():
    """主程序入口"""
    parser = argparse.ArgumentParser(
        description="Google Flow 批量提交工具（支持 AdsPower）"
    )

    parser.add_argument(
        '--prompts',
        type=str,
        help='提示词文件路径（.txt 或 .json）'
    )

    parser.add_argument(
        '--profile-id',
        type=str,
        help='AdsPower 环境 ID（不提供则使用本地 Chrome）'
    )

    parser.add_argument(
        '--wait-time',
        type=int,
        default=3,
        help='每次提交后的等待时间（秒），默认 3 秒'
    )

    parser.add_argument(
        '--headless',
        dest='headless',
        action='store_true',
        default=True,
        help='无头模式运行（默认开启，AdsPower 与本地 Chrome 均支持）'
    )

    parser.add_argument(
        '--show-browser',
        dest='headless',
        action='store_false',
        help='强制显示浏览器界面（关闭无头模式）'
    )

    parser.add_argument(
        '--download-dir',
        type=str,
        help='自定义下载目录（默认在当前项目生成 flow_downloads/run_时间戳）'
    )

    parser.add_argument(
        '--download-workers',
        type=int,
        default=5,
        help='并行下载的线程数，默认 5'
    )

    parser.add_argument(
        '--download-chunk-size',
        type=int,
        default=80,
        help='单次滚动采集的最大 data-index 数量，默认 80'
    )

    parser.add_argument(
        '--yes', '-y',
        action='store_true',
        help='跳过确认，直接开始执行'
    )

    parser.add_argument(
        '--flow-url',
        type=str,
        help='自定义 Flow 项目页面 URL（默认 https://labs.google/fx/tools/flow）'
    )

    parser.add_argument(
        '--download-only',
        action='store_true',
        help='仅执行下载流程，不再提交提示词'
    )

    parser.add_argument(
        '--download-range',
        type=str,
        help='下载范围（例如 1-50 或 120），默认会使用提示词数量'
    )

    parser.add_argument(
        '--force-new-project',
        action='store_true',
        help='下载模式下仍自动点击 "New project" 按钮'
    )

    parser.add_argument(
        '--batch-size',
        type=int,
        default=0,
        help='分批处理提示词，每批提交的数量（例如 120），0 表示不分批'
    )

    args = parser.parse_args()

    prompts = []
    if args.prompts:
        prompts = load_prompts_from_file(args.prompts)

    if not args.download_only and not prompts:
        print("✗ 提示词列表为空，退出程序")
        sys.exit(1)

    if args.download_only and not prompts and not args.download_range:
        print("✗ 下载模式需要提供 --download-range 或有效的提示词文件以确定范围")
        sys.exit(1)

    prompt_count = len(prompts)

    try:
        download_start, download_end = parse_download_range(args.download_range, prompt_count)
    except ValueError as e:
        print(f"✗ 下载范围无效: {e}")
        sys.exit(1)

    # 计算分批信息
    batch_size = args.batch_size if args.batch_size > 0 else 0
    total_batches = 0
    if batch_size > 0 and prompts:
        total_batches = (len(prompts) + batch_size - 1) // batch_size

    print("\n" + "=" * 50)
    print("Google Flow 批量提交工具")
    print("=" * 50)
    if prompts:
        print(f"提示词数量: {len(prompts)}")
    else:
        print("提示词数量: （未提供文件）")
    print(f"等待时间: {args.wait_time} 秒")
    print(f"AdsPower 环境: {args.profile_id or '不使用'}")
    print(f"无头模式: {'是' if args.headless else '否'}")
    print(f"运行模式: {'仅下载' if args.download_only else '完整流程'}")
    if not args.download_only:
        if batch_size > 0:
            print(f"分批模式: 每批 {batch_size} 个，共 {total_batches} 批")
        else:
            print(f"分批模式: 不分批（一次性处理）")
    else:
        print(f"下载范围: {download_start}-{download_end}")
    print("=" * 50 + "\n")

    # 确认开始
    if not args.yes:
        try:
            confirm = input("按 Enter 键开始执行，输入 'q' 退出: ")
            if confirm.lower() == 'q':
                print("已取消执行")
                sys.exit(0)
        except EOFError:
            print("检测到非交互式环境，自动开始执行...")
    else:
        print("跳过确认，直接开始执行...\n")

    driver = None

    try:
        if args.profile_id:
            # 使用 AdsPower
            print("\n使用 AdsPower 指纹浏览器...")
            adspower = AdsPowerAPI()
            driver = adspower.start_browser(
                profile_id=args.profile_id,
                headless=args.headless
            )
        else:
            # 使用本地 Chrome
            print("\n使用本地 Chrome 浏览器...")
            from selenium import webdriver
            from selenium.webdriver.chrome.options import Options

            chrome_options = Options()
            if args.headless:
                chrome_options.add_argument('--headless')
                chrome_options.add_argument('--disable-gpu')
                chrome_options.add_argument('--window-size=1920,1080')

            driver = webdriver.Chrome(options=chrome_options)
            print("✓ 浏览器已启动")

        # 创建自动化实例
        automation = FlowAutomation(
            driver,
            wait_time=args.wait_time,
            download_dir=args.download_dir,
            download_workers=args.download_workers,
            flow_url=args.flow_url,
            collect_chunk_size=args.download_chunk_size
        )

        if args.download_only:
            print("\n仅下载模式：将直接尝试滚动收集视频 URL 并下载")
            automation.open_flow_page()
            if args.force_new_project:
                automation.click_new_project()
            automation.batch_download_videos(
                start_index=download_start,
                end_index=download_end
            )
        else:
            # 分批处理或完整处理
            if batch_size > 0:
                print(f"\n分批模式：将分 {total_batches} 批处理")
                automation.run_batch_workflow(
                    prompts,
                    batch_size=batch_size
                )
            else:
                automation.run_full_workflow(
                    prompts,
                    download_start=download_start,
                    download_end=download_end
                )

        print("\n✓ 程序执行完成！")
        if not args.yes:
            print("提示: 浏览器将保持打开，您可以手动检查结果")
            try:
                input("\n按 Enter 键关闭浏览器...")
            except EOFError:
                print("自动关闭浏览器...")
                import time
                time.sleep(5)
        else:
            print("等待 10 秒后自动关闭浏览器...")
            import time
            time.sleep(10)

    except KeyboardInterrupt:
        print("\n\n✗ 用户中断执行")

    except Exception as e:
        print(f"\n✗ 程序执行失败: {e}")
        import traceback
        traceback.print_exc()

    finally:
        if driver:
            try:
                if args.profile_id:
                    adspower.close_browser()
                else:
                    driver.quit()
                print("✓ 浏览器已关闭")
            except Exception as e:
                print(f"关闭浏览器时出错: {e}")


if __name__ == "__main__":
    main()
