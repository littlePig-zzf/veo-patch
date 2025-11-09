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


def main():
    """主程序入口"""
    parser = argparse.ArgumentParser(
        description="Google Flow 批量提交工具（支持 AdsPower）"
    )

    parser.add_argument(
        '--prompts',
        type=str,
        required=True,
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
        action='store_true',
        help='无头模式运行（仅 AdsPower 支持）'
    )

    parser.add_argument(
        '--yes', '-y',
        action='store_true',
        help='跳过确认，直接开始执行'
    )

    args = parser.parse_args()

    # 加载提示词
    prompts = load_prompts_from_file(args.prompts)

    if not prompts:
        print("✗ 提示词列表为空，退出程序")
        sys.exit(1)

    print("\n" + "=" * 50)
    print("Google Flow 批量提交工具")
    print("=" * 50)
    print(f"提示词数量: {len(prompts)}")
    print(f"等待时间: {args.wait_time} 秒")
    print(f"AdsPower 环境: {args.profile_id or '不使用'}")
    print(f"无头模式: {'是' if args.headless else '否'}")
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

            driver = webdriver.Chrome(options=chrome_options)
            print("✓ 浏览器已启动")

        # 创建自动化实例
        automation = FlowAutomation(driver, wait_time=args.wait_time)

        # 执行完整流程
        automation.run_full_workflow(prompts)

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
