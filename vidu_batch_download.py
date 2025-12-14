#!/usr/bin/env python3
"""
Vidu 视频批量下载工具
用于批量下载 https://www.vidu.cn/create/text2video 页面的视频
"""

import time
import os
from datetime import datetime
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
import requests
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading


class VideoBatchDownloader:
    def __init__(self, start_index=1, end_index=10, output_dir="vidu_videos", batch_size=5):
        """
        初始化下载器

        Args:
            start_index: 起始索引 (data-index)
            end_index: 结束索引 (data-index)
            output_dir: 输出目录
            batch_size: 每批并发下载的视频数量
        """
        self.start_index = start_index
        self.end_index = end_index
        self.output_dir = output_dir
        self.batch_size = batch_size
        self.driver = None
        self.collected_videos = {}
        self.download_lock = threading.Lock()
        self.progress_count = 0

        # 创建输出目录
        Path(output_dir).mkdir(parents=True, exist_ok=True)

    def init_browser(self):
        """初始化浏览器"""
        print("正在启动浏览器...")
        print("自动下载匹配的 ChromeDriver...")

        options = webdriver.ChromeOptions()
        # 可选：无头模式
        # options.add_argument('--headless')
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')

        # 使用 webdriver-manager 自动管理 ChromeDriver 版本
        service = Service(ChromeDriverManager().install())
        self.driver = webdriver.Chrome(service=service, options=options)
        self.driver.maximize_window()
        print("浏览器启动成功")

    def open_page(self, url="https://www.vidu.cn/create/text2video"):
        """打开视频列表页面"""
        print(f"正在打开页面: {url}")
        self.driver.get(url)
        time.sleep(3)  # 等待页面加载
        print("页面加载完成")

    def find_scroll_container(self):
        """查找可滚动容器"""
        # 尝试多个可能的选择器
        selectors = [
            '[data-virtuoso-scroller="true"]',
            '[data-testid="virtuoso-scroller"]',
            'div[style*="overflow"]',
        ]

        for selector in selectors:
            try:
                containers = self.driver.find_elements(By.CSS_SELECTOR, selector)
                for container in containers:
                    # 检查是否可滚动
                    scroll_height = self.driver.execute_script(
                        "return arguments[0].scrollHeight", container
                    )
                    client_height = self.driver.execute_script(
                        "return arguments[0].clientHeight", container
                    )
                    if scroll_height > client_height:
                        print(f"找到滚动容器: {selector}")
                        return container
            except:
                continue

        # 如果没找到，尝试从第一个视频项向上查找
        try:
            first_item = self.driver.find_element(By.CSS_SELECTOR, '[data-index="1"]')
            parent = first_item.find_element(By.XPATH, '..')
            while parent:
                overflow = self.driver.execute_script(
                    "return window.getComputedStyle(arguments[0]).overflowY", parent
                )
                if overflow in ['scroll', 'auto']:
                    scroll_height = self.driver.execute_script(
                        "return arguments[0].scrollHeight", parent
                    )
                    client_height = self.driver.execute_script(
                        "return arguments[0].clientHeight", parent
                    )
                    if scroll_height > client_height:
                        print("从视频项找到滚动容器")
                        return parent
                parent = parent.find_element(By.XPATH, '..')
        except:
            pass

        print("警告: 未找到明确的滚动容器，将使用页面滚动")
        return None

    def scroll_and_collect_videos(self):
        """滚动页面并收集视频信息"""
        total_needed = self.end_index - self.start_index + 1
        print(f"\n需要收集: {self.start_index} 到 {self.end_index}, 共 {total_needed} 个视频")

        scroll_container = self.find_scroll_container()

        # 先滚动到顶部
        print("滚动到顶部...")
        if scroll_container:
            self.driver.execute_script("arguments[0].scrollTo(0, 0)", scroll_container)
        else:
            self.driver.execute_script("window.scrollTo(0, 0)")
        time.sleep(2)

        attempts = 0
        max_attempts = 200
        last_scroll_top = -1
        stuck_count = 0
        no_progress_count = 0  # 新增：连续无进展计数
        last_collected_count = 0  # 新增：上次收集到的数量

        while len(self.collected_videos) < total_needed and attempts < max_attempts:
            attempts += 1
            print(f"\n--- 第 {attempts} 次尝试 ---")

            # 查找当前已加载的视频项
            items = self.driver.find_elements(By.CSS_SELECTOR, '[data-index]')
            current_min_index = float('inf')
            current_max_index = -1

            for item in items:
                try:
                    index_str = item.get_attribute('data-index')
                    if not index_str or index_str == '0':
                        continue

                    index = int(index_str)
                    current_min_index = min(current_min_index, index)
                    current_max_index = max(current_max_index, index)

                    # 只处理目标范围内的
                    if self.start_index <= index <= self.end_index:
                        if index not in self.collected_videos:
                            video_url = self.extract_video_url(item)
                            if video_url:
                                self.collected_videos[index] = video_url
                                print(f"✅ 收集到视频 {index}: {video_url[:80]}...")
                            else:
                                print(f"⏳ 索引 {index} 的视频URL未加载")
                except Exception as e:
                    print(f"处理视频项出错: {e}")
                    continue

            print(f"进度: {len(self.collected_videos)}/{total_needed} (视口: {current_min_index}-{current_max_index})")

            # 检查是否有进展
            if len(self.collected_videos) == last_collected_count:
                no_progress_count += 1
                print(f"⚠️ 无新收集 {no_progress_count}/10 次")
                if no_progress_count > 10:
                    print("❌ 连续 10 次无进展，停止滚动")
                    break
            else:
                no_progress_count = 0
                last_collected_count = len(self.collected_videos)

            if len(self.collected_videos) < total_needed:
                # 找到缺失的索引
                missing_indexes = [i for i in range(self.start_index, self.end_index + 1)
                                 if i not in self.collected_videos]

                if missing_indexes:
                    print(f"❌ 还缺失 {len(missing_indexes)} 个, 范围: {missing_indexes[0]} - {missing_indexes[-1]}")

                    # 检查是否卡住
                    if scroll_container:
                        current_scroll_top = self.driver.execute_script(
                            "return arguments[0].scrollTop", scroll_container
                        )
                    else:
                        current_scroll_top = self.driver.execute_script("return window.pageYOffset")

                    print(f"📍 当前scrollTop: {current_scroll_top}, 上次: {last_scroll_top}")

                    if current_scroll_top == last_scroll_top:
                        stuck_count += 1
                        print(f"⚠️ 滚动位置未变 {stuck_count}/5")
                        if stuck_count > 5:
                            print("❌ 滚动已到达边界（顶部或底部）")
                            break
                    else:
                        stuck_count = 0
                        last_scroll_top = current_scroll_top

                    # 智能滚动
                    scroll_amount = 1142  # 2个视频项的高度
                    if missing_indexes[0] < current_min_index:
                        print(f"⬆️ 向上滚动 {scroll_amount}px")
                        if scroll_container:
                            self.driver.execute_script(
                                f"arguments[0].scrollBy(0, -{scroll_amount})", scroll_container
                            )
                        else:
                            self.driver.execute_script(f"window.scrollBy(0, -{scroll_amount})")
                    else:
                        print(f"⬇️ 向下滚动 {scroll_amount}px")
                        if scroll_container:
                            self.driver.execute_script(
                                f"arguments[0].scrollBy(0, {scroll_amount})", scroll_container
                            )
                        else:
                            self.driver.execute_script(f"window.scrollBy(0, {scroll_amount})")

                    time.sleep(1.5)
                else:
                    print("✅ 所有视频已收集完毕")
                    break

        print(f"\n📊 收集统计: 尝试了 {attempts} 次")
        if len(self.collected_videos) < total_needed:
            missing = [i for i in range(self.start_index, self.end_index + 1)
                      if i not in self.collected_videos]
            print(f"⚠️ 只收集到 {len(self.collected_videos)}/{total_needed} 个视频")
            print(f"缺失索引: {', '.join(map(str, missing))}")

            # 询问用户是否继续
            if len(self.collected_videos) == 0:
                raise Exception("未收集到任何视频！请检查页面是否正确加载。")

            user_input = input(f"\n只找到 {len(self.collected_videos)} 个视频，是否继续下载这些视频? (y/n): ")
            if user_input.lower() != 'y':
                raise Exception("用户取消下载")

        print("视频收集完成:", sorted(self.collected_videos.keys()))

    def extract_video_url(self, item):
        """从视频项中提取视频URL"""
        try:
            # 方法1: 从video标签获取
            videos = item.find_elements(By.TAG_NAME, 'video')
            for video in videos:
                # 尝试source标签
                sources = video.find_elements(By.TAG_NAME, 'source')
                for source in sources:
                    src = source.get_attribute('src')
                    if src and src.strip():
                        return src

                # 尝试video的src
                src = video.get_attribute('src')
                if src and src.strip():
                    return src

                # 尝试poster (可能需要转换)
                poster = video.get_attribute('poster')
                if poster and 'storage' in poster:
                    # 可能需要根据实际情况调整URL转换逻辑
                    # 这里先返回poster作为参考
                    print(f"找到poster: {poster}")

            # 方法2: 查找链接
            links = item.find_elements(By.TAG_NAME, 'a')
            for link in links:
                href = link.get_attribute('href')
                if href and any(ext in href.lower() for ext in ['.mp4', '.webm', '.mov']):
                    return href

            # 方法3: 检查data属性
            video_url = item.get_attribute('data-video-url')
            if video_url:
                return video_url

        except Exception as e:
            print(f"提取URL出错: {e}")

        return None

    def download_video(self, index, url, total, batch_num=None):
        """下载单个视频（线程安全）"""
        try:
            response = requests.get(url, stream=True, timeout=60)
            response.raise_for_status()

            # 确定文件扩展名
            content_type = response.headers.get('content-type', '')
            if 'webm' in content_type:
                ext = 'webm'
            elif 'quicktime' in content_type or 'mov' in content_type:
                ext = 'mov'
            else:
                ext = 'mp4'

            # 生成文件名
            today = datetime.now().strftime('%Y%m%d')
            filename = f"vidu_{today}_video_{index}.{ext}"
            filepath = os.path.join(self.output_dir, filename)

            # 下载文件
            total_size = int(response.headers.get('content-length', 0))

            with open(filepath, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)

            file_size_mb = os.path.getsize(filepath) / 1024 / 1024

            # 线程安全的进度更新
            with self.download_lock:
                self.progress_count += 1
                batch_info = f" (第{batch_num}批)" if batch_num else ""
                print(f"✅ 视频 {index} 下载完成: {filename} ({file_size_mb:.2f}MB) - 进度: {self.progress_count}/{total}{batch_info}")

            return {'index': index, 'success': True, 'filename': filename}

        except Exception as e:
            with self.download_lock:
                self.progress_count += 1
                print(f"❌ 视频 {index} 下载失败: {e} - 进度: {self.progress_count}/{total}")
            return {'index': index, 'success': False, 'error': str(e)}

    def download_all_videos(self):
        """批量并发下载所有视频"""
        if not self.collected_videos:
            print("没有收集到视频")
            return

        videos = sorted(self.collected_videos.items())
        total = len(videos)
        self.progress_count = 0
        all_results = []

        print(f"\n📥 开始批量下载 {total} 个视频, 每批 {self.batch_size} 个并发...")

        # 分批下载
        for i in range(0, len(videos), self.batch_size):
            batch = videos[i:i + self.batch_size]
            batch_num = i // self.batch_size + 1
            total_batches = (len(videos) + self.batch_size - 1) // self.batch_size

            print(f"\n📦 开始第 {batch_num}/{total_batches} 批下载 ({len(batch)} 个视频)")

            # 使用线程池并发下载这一批
            with ThreadPoolExecutor(max_workers=self.batch_size) as executor:
                futures = {
                    executor.submit(self.download_video, index, url, total, batch_num): index
                    for index, url in batch
                }

                # 等待这一批全部完成
                batch_results = []
                for future in as_completed(futures):
                    result = future.result()
                    batch_results.append(result)

                all_results.extend(batch_results)

            # 统计这一批的结果
            batch_failed = [r for r in batch_results if not r['success']]
            if batch_failed:
                print(f"⚠️ 第{batch_num}批有 {len(batch_failed)} 个失败")

            # 批次间延迟，避免网络压力过大
            if i + self.batch_size < len(videos):
                print(f"⏸️ 批次间休息 1 秒...")
                time.sleep(1)

        # 统计总结果
        failed_results = [r for r in all_results if not r['success']]
        success_count = total - len(failed_results)

        print(f"\n📊 下载完成统计:")
        print(f"  总共: {total} 个")
        print(f"  成功: {success_count} 个")
        print(f"  失败: {len(failed_results)} 个")
        if failed_results:
            print(f"  失败索引: {', '.join(str(r['index']) for r in failed_results)}")
        print(f"  保存位置: {os.path.abspath(self.output_dir)}")

    def run(self):
        """运行完整流程"""
        try:
            self.init_browser()
            self.open_page()

            # 等待用户登录（如果需要）
            input("\n⚠️ 请在浏览器中登录 Vidu 账号（如需要），然后按 Enter 继续...")

            self.scroll_and_collect_videos()
            self.download_all_videos()

        except Exception as e:
            print(f"❌ 运行出错: {e}")
            import traceback
            traceback.print_exc()

        finally:
            if self.driver:
                print("\n关闭浏览器...")
                self.driver.quit()


def main():
    """主函数"""
    print("=" * 60)
    print("Vidu 视频批量下载工具")
    print("=" * 60)

    # 获取用户输入
    try:
        start_index = int(input("\n请输入起始索引 (data-index，默认为1): ") or "1")
        end_index = int(input("请输入结束索引 (data-index，默认为10): ") or "10")
        output_dir = input("请输入输出目录 (默认为 vidu_videos): ") or "vidu_videos"
        batch_size = int(input("请输入每批并发数量 (默认为5): ") or "5")

        if start_index < 1 or end_index < 1 or start_index > end_index:
            print("❌ 索引无效，请确保起始索引和结束索引都大于0，且起始索引不大于结束索引")
            return

        if batch_size < 1 or batch_size > 20:
            print("❌ 并发数量无效，建议设置为 1-20 之间")
            return

        print(f"\n将下载索引 {start_index} 到 {end_index} 的视频")
        print(f"保存到目录: {output_dir}")
        print(f"每批并发: {batch_size} 个")

        confirm = input("\n确认开始下载? (y/n): ")
        if confirm.lower() != 'y':
            print("已取消")
            return

        # 创建下载器并运行
        downloader = VideoBatchDownloader(
            start_index=start_index,
            end_index=end_index,
            output_dir=output_dir,
            batch_size=batch_size
        )
        downloader.run()

    except KeyboardInterrupt:
        print("\n\n用户中断")
    except Exception as e:
        print(f"\n❌ 错误: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
