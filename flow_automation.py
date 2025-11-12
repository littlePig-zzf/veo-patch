"""
Google Flow 文生视频自动化模块
使用 Selenium 实现批量提交提示词和下载视频
"""

import time
import json
import os
from pathlib import Path
from urllib.parse import urlparse
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
from selenium.webdriver.common.by import By
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import (
    TimeoutException,
    NoSuchElementException,
    StaleElementReferenceException,
)


class FlowAutomation:
    """Google Flow 自动化操作类"""

    def __init__(
        self,
        driver,
        wait_time=3,
        download_dir=None,
        download_workers=5,
        flow_url=None,
        collect_chunk_size=80,
    ):
        """
        初始化自动化操作

        Args:
            driver: Selenium WebDriver 实例
            wait_time: 每次操作后的等待时间（秒）
            download_dir: 自定义下载目录
            download_workers: 并行下载线程数
            flow_url: Flow 项目页面地址（可自定义）
            collect_chunk_size: 每次滚动采集的最大 data-index 数量
        """
        self.driver = driver
        self.wait_time = wait_time
        self.wait = WebDriverWait(driver, 30)
        self.custom_download_dir = Path(download_dir).expanduser() if download_dir else None
        self.run_timestamp = time.strftime("%Y%m%d_%H%M%S")
        self.flow_url = flow_url or "https://labs.google/fx/tools/flow"
        self.current_batch_dir = None  # 当前批次的下载目录
        try:
            chunk_size = int(collect_chunk_size)
        except (TypeError, ValueError):
            chunk_size = 80
        self.collect_chunk_size = max(10, chunk_size)
        try:
            workers = int(download_workers)
        except (TypeError, ValueError):
            workers = 5
        self.download_workers = max(1, workers)
        try:
            self.driver.set_script_timeout(180)
        except Exception:
            pass

    def open_flow_page(self):
        """打开 Google Flow 页面"""
        url = self.flow_url
        print(f"正在打开 {url}")
        self.driver.get(url)
        time.sleep(3)
        print("✓ 页面已加载")

    def click_new_project(self):
        """点击 New project 按钮"""
        print("正在查找 New project 按钮...")

        try:
            # 尝试多种选择器查找 New project 按钮
            selectors = [
                "//button[contains(text(), 'New project')]",
                "//button[contains(text(), 'new project')]",
                "//button[contains(., 'New project')]",
                "//*[@role='button'][contains(text(), 'New project')]",
                "//span[contains(text(), 'New project')]/ancestor::button",
            ]

            new_project_btn = None
            for selector in selectors:
                try:
                    new_project_btn = self.wait.until(
                        EC.element_to_be_clickable((By.XPATH, selector))
                    )
                    if new_project_btn:
                        break
                except TimeoutException:
                    continue

            if not new_project_btn:
                raise Exception("未找到 New project 按钮")

            print("✓ 找到 New project 按钮，准备点击")
            time.sleep(1)

            # 滚动到按钮
            try:
                self.driver.execute_script("arguments[0].scrollIntoView(true);", new_project_btn)
                time.sleep(0.5)
            except:
                pass

            # 点击按钮
            try:
                new_project_btn.click()
            except:
                # 如果普通点击失败，使用 JavaScript 点击
                self.driver.execute_script("arguments[0].click();", new_project_btn)

            time.sleep(3)  # 等待页面加载
            print("✓ 已点击 New project 按钮")

        except Exception as e:
            print(f"✗ 点击 New project 失败: {e}")
            raise

    def submit_prompt(self, prompt, index=1, total=1):
        """
        提交单个提示词

        Args:
            prompt: 提示词文本
            index: 当前任务序号
            total: 总任务数
        """
        print(f"\n[{index}/{total}] 正在提交提示词...")
        print(f"提示词: {prompt[:80]}...")

        try:
            # 1. 查找提示词输入框
            print("  → 查找提示词输入框...")
            textarea_selectors = [
                "#PINHOLE_TEXT_AREA_ELEMENT_ID",
                "textarea[placeholder*='text']",
                "textarea[placeholder*='提示']",
                "textarea",
                "div[contenteditable='true']",
            ]

            textarea = None
            for selector in textarea_selectors:
                try:
                    textarea = self.driver.find_element(By.CSS_SELECTOR, selector)
                    if textarea.is_displayed():
                        break
                except NoSuchElementException:
                    continue

            if not textarea:
                raise Exception("未找到提示词输入框")

            # 2. 等待元素可交互
            print("  → 等待输入框准备就绪...")
            time.sleep(1)

            # 3. 尝试滚动到元素
            try:
                self.driver.execute_script("arguments[0].scrollIntoView(true);", textarea)
                time.sleep(0.5)
            except:
                pass

            # 4. 清空并输入提示词（完全对齐插件 enterPrompt 逻辑）
            print("  → 输入提示词...")
            time.sleep(0.3)

            self.driver.execute_script("arguments[0].focus();", textarea)
            time.sleep(0.3)

            self.driver.execute_script("""
                const el = arguments[0];
                const text = arguments[1] ?? '';
                const triggerEvents = () => {
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                };

                if (el.getAttribute('contenteditable') === 'true') {
                    el.innerHTML = '';
                    triggerEvents();
                    el.textContent = text;
                    triggerEvents();
                } else {
                    el.value = '';
                    triggerEvents();
                    el.value = text;
                    triggerEvents();
                }
            """, textarea, prompt)

            time.sleep(0.3)

            # 5. 追加一次真实的键盘事件，确保按钮正确解锁
            self._simulate_human_keystrokes(textarea)

            # 3. 点击生成按钮
            print("  → 查找生成按钮...")
            generate_btn = self._find_generate_button()

            if not generate_btn:
                print("  → 未找到生成按钮，等待页面稳定后重试...")
                for retry in range(1, 4):
                    time.sleep(1)
                    generate_btn = self._find_generate_button()
                    if generate_btn:
                        print(f"  → 第 {retry} 次重试成功，已定位生成按钮")
                        break
                if not generate_btn:
                    raise Exception("多次尝试后仍未找到生成按钮，请检查页面状态")

            if not self._wait_for_button_enabled(generate_btn, timeout=8):
                raise Exception("生成按钮仍处于禁用状态，请检查页面")

            print("  → 点击生成按钮...")
            time.sleep(0.5)
            try:
                generate_btn.click()
            except StaleElementReferenceException:
                print("  → 生成按钮在点击时刷新，重新定位后再试...")
                refreshed_btn = self._find_generate_button()
                if not refreshed_btn:
                    raise Exception("生成按钮在点击时消失，请确认页面是否刷新")
                refreshed_btn.click()
            time.sleep(1)

            print(f"✓ [{index}/{total}] 提示词已提交")

            # 等待指定时间
            time.sleep(self.wait_time)

        except Exception as e:
            print(f"✗ [{index}/{total}] 提交失败: {e}")
            raise

    def _find_generate_button(self, retries=3, delay=0.4):
        """查找生成按钮（带有箭头图标的按钮），失败时短暂重试"""
        last_error = None
        for attempt in range(1, retries + 1):
            try:
                buttons = self.driver.find_elements(By.CSS_SELECTOR, "button, [role='button']")

                for btn in buttons:
                    try:
                        if not btn.is_displayed() or not btn.is_enabled():
                            continue
                    except StaleElementReferenceException as e:
                        last_error = e
                        continue

                    try:
                        icon = btn.find_element(By.CSS_SELECTOR, "i, svg")
                        icon_text = (icon.text or "").strip().lower()
                        if "arrow_forward" in icon_text:
                            return btn
                    except NoSuchElementException:
                        pass
                    except StaleElementReferenceException as e:
                        last_error = e
                        continue

                for btn in reversed(buttons):
                    try:
                        if btn.is_displayed() and btn.is_enabled():
                            return btn
                    except StaleElementReferenceException as e:
                        last_error = e
                        continue

            except Exception as e:
                last_error = e

            if attempt < retries:
                time.sleep(delay)

        if last_error:
            print(f"查找生成按钮时出错（已重试 {retries} 次）: {last_error}")
        return None

    def _simulate_human_keystrokes(self, element):
        """通过一次空格+退格模拟人工输入，触发前端校验"""
        try:
            actions = ActionChains(self.driver)
            actions.move_to_element(element)
            actions.click()
            actions.pause(0.1)
            actions.send_keys(" ")
            actions.pause(0.05)
            actions.send_keys(Keys.BACKSPACE)
            actions.perform()
            time.sleep(0.2)
        except Exception as e:
            print(f"  → 模拟人工键入失败（忽略）：{e}")

    def _wait_for_button_enabled(self, button, timeout=5):
        """等待按钮解除禁用状态"""
        start = time.time()

        while time.time() - start < timeout:
            try:
                is_disabled = self.driver.execute_script("""
                    const btn = arguments[0];
                    if (!btn) return true;
                    const ariaDisabled = btn.getAttribute('aria-disabled');
                    const dataDisabled = btn.getAttribute('data-disabled');
                    return btn.disabled === true ||
                           ariaDisabled === 'true' ||
                           dataDisabled === 'true';
                """, button)

                if not is_disabled:
                    return True
            except Exception:
                # 元素可能被重新渲染，尝试重新查找
                new_button = self._find_generate_button()
                if new_button:
                    button = new_button
                    continue
                return False

            time.sleep(0.2)

        return False

    def _collect_video_urls(self, start_index, end_index):
        """按配置的块大小分批滚动收集视频直链"""
        chunk_size = self.collect_chunk_size
        if start_index > end_index:
            start_index, end_index = end_index, start_index

        collected = {}
        total = end_index - start_index + 1
        print(f"  → 需要收集 {total} 个索引，使用块大小 {chunk_size}")

        chunk_id = 0
        for chunk_start in range(start_index, end_index + 1, chunk_size):
            chunk_id += 1
            chunk_end = min(end_index, chunk_start + chunk_size - 1)
            print(f"    ...正在收集索引 {chunk_start}-{chunk_end}（第 {chunk_id} 块）")
            chunk_videos = self._collect_video_urls_once(chunk_start, chunk_end)
            if not chunk_videos:
                print("    ⚠ 本块未收集到可用视频链接")
                continue
            for item in chunk_videos:
                idx = item.get('index')
                url = item.get('url')
                if idx is None or not url:
                    continue
                collected[idx] = url

            if len(collected) >= total:
                break

        missing = [i for i in range(start_index, end_index + 1) if i not in collected]
        if missing:
            print(f"⚠ 仍缺少以下索引的视频: {missing[:20]}{'...' if len(missing) > 20 else ''}")

        return [
            {'index': idx, 'url': collected[idx]}
            for idx in sorted(collected.keys())
        ]

    def _collect_video_urls_once(self, start_index, end_index):
        """滚动整个虚拟列表，收集指定范围内的所有视频直链"""
        async_script = """
        const start = Number(arguments[0]) || 1;
        const end = Number(arguments[1]) || start;
        const callback = arguments[2];

        const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

        function extractVideoUrl(item) {
            const video = item.querySelector('video');
            if (video) {
                const source = video.querySelector('source');
                if (source && source.src) {
                    return source.src;
                }
                if (video.src) {
                    return video.src;
                }
                if (video.poster && video.poster.includes('storage.googleapis.com')) {
                    return video.poster;
                }
            }

            const links = item.querySelectorAll('a[href*="storage.googleapis.com"]');
            for (const link of links) {
                const href = link.href;
                if (href && href.match(/\\.(mp4|webm|mov)(\\?|$)/i)) {
                    return href;
                }
            }

            if (item.dataset && item.dataset.videoUrl) {
                return item.dataset.videoUrl;
            }

            return null;
        }

        function findScrollContainer() {
            const knownSelectors = [
                '[data-virtuoso-scroller="true"]',
                '[data-testid="virtuoso-scroller"]',
                '.sc-1cf8ce28-7',
                '[class*="eOSwrz"]'
            ];

            for (const selector of knownSelectors) {
                const container = document.querySelector(selector);
                if (container && container.scrollHeight > container.clientHeight) {
                    return container;
                }
            }

            const firstItem = document.querySelector('[data-index="1"]');
            if (firstItem) {
                let parent = firstItem.parentElement;
                while (parent && parent !== document.body) {
                    const style = window.getComputedStyle(parent);
                    const hasScroll = (
                        style.overflowY === 'scroll' || style.overflowY === 'auto' ||
                        style.overflow === 'scroll' || style.overflow === 'auto'
                    );

                    if (hasScroll && parent.scrollHeight > parent.clientHeight) {
                        return parent;
                    }
                    parent = parent.parentElement;
                }
            }

            return null;
        }

        (async () => {
            const minIndex = Math.min(start, end);
            const maxIndex = Math.max(start, end);
            const totalNeeded = maxIndex - minIndex + 1;
            const collected = new Map();

            const scrollContainer = findScrollContainer();
            if (!scrollContainer) {
                throw new Error('未找到视频列表的滚动容器');
            }

            try {
                if (typeof scrollContainer.scrollTo === 'function') {
                    scrollContainer.scrollTo({ top: 0, behavior: 'auto' });
                } else {
                    scrollContainer.scrollTop = 0;
                }
            } catch (error) {
                scrollContainer.scrollTop = 0;
            }

            await sleep(1200);

            let attempts = 0;
            const maxAttempts = 220;
            let lastScrollTop = -1;
            let stuckCount = 0;

            while (collected.size < totalNeeded && attempts < maxAttempts) {
                attempts += 1;
                const items = document.querySelectorAll('[data-index]');
                let currentMin = Infinity;
                let currentMax = -Infinity;

                items.forEach(item => {
                    const indexAttr = item.getAttribute('data-index');
                    const index = parseInt(indexAttr, 10);
                    if (!Number.isFinite(index) || index === 0) {
                        return;
                    }

                    currentMin = Math.min(currentMin, index);
                    currentMax = Math.max(currentMax, index);

                    if (index >= minIndex && index <= maxIndex && !collected.has(index)) {
                        const url = extractVideoUrl(item);
                        if (url) {
                            collected.set(index, url);
                        }
                    }
                });

                if (collected.size >= totalNeeded) {
                    break;
                }

                const missing = [];
                for (let i = minIndex; i <= maxIndex; i++) {
                    if (!collected.has(i)) {
                        missing.push(i);
                    }
                }

                if (missing.length === 0) {
                    break;
                }

                const currentScrollTop = scrollContainer.scrollTop;
                if (currentScrollTop === lastScrollTop) {
                    stuckCount += 1;
                    if (stuckCount > 5) {
                        break;
                    }
                } else {
                    stuckCount = 0;
                    lastScrollTop = currentScrollTop;
                }

                const viewportHeight = scrollContainer.clientHeight || window.innerHeight || 800;
                const scrollAmount = Math.max(viewportHeight * 0.9, 600);
                if (!Number.isFinite(currentMin) || missing[0] < currentMin) {
                    scrollContainer.scrollBy({ top: -scrollAmount, behavior: 'smooth' });
                } else {
                    scrollContainer.scrollBy({ top: scrollAmount, behavior: 'smooth' });
                }

                await sleep(900);
            }

            const videos = Array.from(collected.entries())
                .map(([index, url]) => ({ index, url }))
                .sort((a, b) => a.index - b.index);

            const missing = [];
            for (let i = minIndex; i <= maxIndex; i++) {
                if (!collected.has(i)) {
                    missing.push(i);
                }
            }

            callback({
                success: true,
                videos,
                missing
            });
        })().catch(error => {
            callback({
                success: false,
                error: error && error.message ? error.message : String(error)
            });
        });
        """

        try:
            result = self.driver.execute_async_script(
                async_script,
                start_index,
                end_index
            )
        except Exception as e:
            print(f"✗ 注入滚动收集脚本失败: {e}")
            return []

        if not isinstance(result, dict):
            print("✗ 收集视频 URL 失败: 未知返回结果")
            return []

        if not result.get('success'):
            error_msg = result.get('error', '未知错误')
            print(f"✗ 收集视频 URL 失败: {error_msg}")
            return []

        videos = result.get('videos', [])
        missing = result.get('missing') or []

        if missing:
            print(f"⚠ 未能收集到以下索引的视频: {missing}")

        return sorted(videos, key=lambda item: item['index'])

    def _download_videos_to_disk(self, videos):
        """使用 requests 将视频保存到本地"""
        download_dir = self._ensure_download_directory()
        print(f"  → 下载目录: {download_dir}")

        success = 0
        failures = []

        max_workers = min(self.download_workers, len(videos)) or 1
        print(f"  → 启用 {max_workers} 个并行下载线程（目标 {len(videos)} 个视频）")

        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_to_index = {
                executor.submit(self._download_single_video, item, download_dir): item.get('index')
                for item in videos
            }

            for future in as_completed(future_to_index):
                index = future_to_index[future]
                try:
                    result = future.result()
                except Exception as e:
                    failures.append((index, str(e)))
                    print(f"    ✗ 视频 {index} 下载失败: {e}")
                    continue

                if result.get('success'):
                    success += 1
                    size = result.get('size_mb')
                    filename = result.get('filename')
                    print(f"    ✓ 视频 {index} 已保存 ({size:.2f} MB) → {filename}")
                else:
                    failures.append((index, result.get('error', '未知错误')))
                    print(f"    ✗ 视频 {index} 下载失败: {result.get('error')}")

        print(f"\n下载统计: 成功 {success} 个 / 共 {len(videos)} 个")
        if failures:
            for idx, reason in failures:
                print(f"  - 索引 {idx} 失败: {reason}")
            print("⚠ 可稍后使用相同下载目录重新运行以补齐失败的文件")

    def _download_single_video(self, item, download_dir):
        """下载单个视频，返回执行结果"""
        index = item.get('index')
        url = item.get('url')

        if not url:
            return {'index': index, 'success': False, 'error': 'URL 为空'}

        ext = self._guess_extension(url)
        filename = f"flow_video_{str(index).zfill(3)}{ext}"
        file_path = download_dir / filename

        try:
            with requests.get(url, stream=True, timeout=180) as resp:
                resp.raise_for_status()
                with open(file_path, 'wb') as f:
                    for chunk in resp.iter_content(chunk_size=1024 * 512):
                        if chunk:
                            f.write(chunk)

            file_size_mb = file_path.stat().st_size / (1024 * 1024)
            return {
                'index': index,
                'success': True,
                'filename': filename,
                'size_mb': file_size_mb
            }
        except Exception as e:
            if file_path.exists():
                file_path.unlink(missing_ok=True)
            return {'index': index, 'success': False, 'error': str(e)}

    def _trigger_browser_downloads(self, start_index, end_index):
        """回退方案：模拟点击页面上的下载按钮"""
        download_script = """
        async function batchDownloadVideos(startIndex, endIndex) {
            console.log(`开始批量下载视频: ${startIndex} 到 ${endIndex}`);

            const items = document.querySelectorAll('[data-index]');
            const targetItems = Array.from(items).filter(item => {
                const index = parseInt(item.getAttribute('data-index'));
                return index >= startIndex && index <= endIndex;
            });

            console.log(`找到 ${targetItems.length} 个视频项`);

            for (let i = 0; i < targetItems.length; i++) {
                const item = targetItems[i];
                const index = item.getAttribute('data-index');

                const buttons = item.querySelectorAll('button, [role="button"]');
                let downloadBtn = null;

                for (const btn of buttons) {
                    const text = (btn.textContent || '').toLowerCase();
                    const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();

                    if (text.includes('download') || text.includes('下载') ||
                        ariaLabel.includes('download') || ariaLabel.includes('下载')) {
                        downloadBtn = btn;
                        break;
                    }
                }

                if (downloadBtn) {
                    console.log(`点击下载按钮 [${index}]`);
                    downloadBtn.click();
                    await new Promise(resolve => setTimeout(resolve, 500));
                } else {
                    console.warn(`未找到下载按钮 [${index}]`);
                }
            }

            return targetItems.length;
        }

        return await batchDownloadVideos(arguments[0], arguments[1]);
        """

        try:
            downloaded_count = self.driver.execute_script(
                download_script,
                start_index,
                end_index
            )

            print(f"✓ 已触发浏览器原生下载，共 {downloaded_count} 个（请检查浏览器下载列表）")

        except Exception as e:
            print(f"✗ 回退下载方式失败: {e}")
            raise

    def _ensure_download_directory(self, batch_number=None):
        """
        创建/返回当次运行的下载目录

        Args:
            batch_number: 批次号，如果提供则创建批次子目录
        """
        if self.current_batch_dir:
            # 如果已经设置了当前批次目录，直接返回
            return self.current_batch_dir

        if self.custom_download_dir:
            target_dir = self.custom_download_dir
            if batch_number is not None:
                target_dir = target_dir / f"batch_{batch_number}"
            target_dir.mkdir(parents=True, exist_ok=True)
            return target_dir

        base_dir = Path(os.getcwd()) / "flow_downloads"
        run_dir = base_dir / f"run_{self.run_timestamp}"
        if batch_number is not None:
            run_dir = run_dir / f"batch_{batch_number}"
        run_dir.mkdir(parents=True, exist_ok=True)
        return run_dir

    def set_batch_download_dir(self, batch_number):
        """设置当前批次的下载目录"""
        self.current_batch_dir = self._ensure_download_directory(batch_number)
        return self.current_batch_dir

    def _guess_extension(self, url):
        """根据 URL 猜测合适的文件扩展名"""
        path = urlparse(url).path.lower()
        for ext in ('.mp4', '.webm', '.mov'):
            if path.endswith(ext):
                return ext
        return '.mp4'

    def batch_submit_prompts(self, prompts):
        """
        批量提交提示词

        Args:
            prompts: 提示词列表
        """
        total = len(prompts)
        print(f"\n开始批量提交 {total} 个提示词...")

        for i, prompt in enumerate(prompts, 1):
            self.submit_prompt(prompt, index=i, total=total)

            if i >= 6:
                self._wait_for_process_slot(current_prompt=prompt)

        print(f"\n✓ 所有提示词已提交完成！共 {total} 个")

    def wait_for_video_ready(self, timeout=600):
        """
        等待第一个视频生成完成（data-index="1" 的盒子出现视频链接）

        Args:
            timeout: 超时时间（秒）

        Returns:
            bool: 是否检测到视频链接
        """
        print(f"\n正在等待视频生成完成（最多等待 {timeout} 秒）...")

        start_time = time.time()
        check_count = 0
        last_progress = None

        while time.time() - start_time < timeout:
            check_count += 1

            try:
                # 检查浏览器是否仍然存在
                try:
                    self.driver.title  # 尝试访问浏览器以检查连接
                except Exception as e:
                    print(f"\n✗ 浏览器窗口已关闭或崩溃: {e}")
                    print("⚠ 无法继续等待，请检查 ChromeDriver 版本是否匹配")
                    return False

                # 查找 data-index="1" 的元素
                item_box = self.driver.find_element(By.CSS_SELECTOR, '[data-index="1"]')

                # 检查是否正在生成（有"数字+%"）
                box_text = item_box.text
                import re
                progress_match = re.search(r'(\d+)%', box_text)

                if progress_match:
                    current_progress = progress_match.group(0)
                    if current_progress != last_progress:
                        print(f"  → 视频生成中: {current_progress}")
                        last_progress = current_progress
                    # 继续等待
                    time.sleep(2)
                    continue

                # 检查是否存在视频相关元素（video 标签或视频链接）
                has_video = False

                # 方法1: 检查是否有 video 标签
                try:
                    video = item_box.find_element(By.TAG_NAME, "video")
                    if video:
                        has_video = True
                        print("✓ 检测到 video 标签")
                except NoSuchElementException:
                    pass

                # 方法2: 检查是否有下载按钮或链接
                if not has_video:
                    try:
                        # 查找下载相关按钮
                        download_elements = item_box.find_elements(
                            By.CSS_SELECTOR,
                            'button, a, [role="button"]'
                        )
                        for elem in download_elements:
                            text = elem.text.lower()
                            if "download" in text or "下载" in text:
                                has_video = True
                                print("✓ 检测到下载按钮")
                                break
                    except NoSuchElementException:
                        pass

                # 方法3: 检查是否存在视频 URL（blob: 或 https://）
                if not has_video:
                    try:
                        sources = item_box.find_elements(By.CSS_SELECTOR, '[src]')
                        for src_elem in sources:
                            src = src_elem.get_attribute('src')
                            if src and ('blob:' in src or 'http' in src):
                                has_video = True
                                print(f"✓ 检测到视频源: {src[:50]}...")
                                break
                    except NoSuchElementException:
                        pass

                if has_video:
                    print(f"✓ 视频已生成完成！(检查了 {check_count} 次)")
                    return True

                # 每5秒输出一次进度
                if check_count % 10 == 0:
                    elapsed = int(time.time() - start_time)
                    print(f"  ...等待中 ({elapsed}s / {timeout}s)，已检查 {check_count} 次")

            except NoSuchElementException:
                if check_count % 10 == 0:
                    print(f"  ...未找到 data-index='1' 的元素，继续等待...")

            # 每 0.5 秒检查一次
            time.sleep(0.5)

        print(f"✗ 等待超时（{timeout}秒），未检测到视频生成完成")
        return False

    def _wait_for_process_slot(self, current_prompt, max_retries=60, interval=5):
        """模仿插件逻辑：6 个以上任务时轮询 data-index=1 的内容"""
        print("  → 进程队列达到上限，开始检测 data-index=1 以等待空位...")

        for attempt in range(1, max_retries + 1):
            button_text = self._read_first_slot_button_text()

            if button_text is None:
                print("    ⚠ 未能读取 data-index=1 的按钮内容，跳过队列等待")
                return

            if button_text.strip() == (current_prompt or "").strip():
                print("    ✓ 检测到 data-index=1 已更新为当前提示词，继续提交下一条")
                return

            print(f"    … 队列仍然繁忙（第 {attempt}/{max_retries} 次），等待 {interval}s 再试")
            time.sleep(interval)

            try:
                generate_btn = self._find_generate_button()
                if generate_btn and generate_btn.is_enabled():
                    generate_btn.click()
                    print("    → 已重新点击生成按钮，尝试唤醒任务")
                    time.sleep(1)
            except Exception as e:
                print(f"    → 重新点击生成按钮失败（忽略）：{e}")

        print("    ⚠ 等待队列空位超时，继续处理剩余提示词")

    def _read_first_slot_button_text(self, retries=3, retry_delay=0.3):
        """返回 data-index=1 卡片内按钮的文本（容错 DOM 刷新）"""
        for attempt in range(1, retries + 1):
            try:
                item_box = self.driver.find_element(By.CSS_SELECTOR, '[data-index="1"]')
            except NoSuchElementException:
                if attempt == retries:
                    print("    ⚠ 未找到 data-index=1 元素")
                    return None
                time.sleep(retry_delay)
                continue

            try:
                button = item_box.find_element(By.TAG_NAME, "button")
                return button.text.strip()
            except NoSuchElementException:
                if attempt == retries:
                    print("    ⚠ data-index=1 中未找到 button")
                    return None
            except StaleElementReferenceException:
                if attempt == retries:
                    print("    ⚠ data-index=1 元素已刷新，无法读取按钮文本")
                    return None
            time.sleep(retry_delay)

    def batch_download_videos(self, start_index=1, end_index=None):
        """
        批量下载视频

        Args:
            start_index: 起始索引（从1开始）
            end_index: 结束索引（包含）
        """
        if end_index is None:
            end_index = start_index

        print(f"\n开始批量下载视频（索引 {start_index} 到 {end_index}）...")

        video_meta = self._collect_video_urls(start_index, end_index)

        if video_meta:
            print(f"✓ 收集到 {len(video_meta)} 个可下载视频 URL，开始本地保存...")
            self._download_videos_to_disk(video_meta)
            return

        print("⚠ 未能直接收集到视频 URL，将回退为模拟点击浏览器下载按钮")
        self._trigger_browser_downloads(start_index, end_index)

    def run_full_workflow(self, prompts, download_start=1, download_end=None):
        """
        运行完整的自动化流程

        Args:
            prompts: 提示词列表
            download_start: 下载起始索引
            download_end: 下载结束索引（默认等于提示词数量）
        """
        try:
            # 1. 打开页面
            self.open_flow_page()

            # 2. 点击 New project
            self.click_new_project()

            # 3. 批量提交提示词
            self.batch_submit_prompts(prompts)

            # 4. 等待第一个视频生成完成
            video_ready = self.wait_for_video_ready(timeout=600)

            if not video_ready:
                print("⚠ 警告: 未检测到视频生成完成，但仍将尝试下载")

            # 5. 批量下载视频
            target_end = download_end if download_end is not None else len(prompts)
            self.batch_download_videos(
                start_index=download_start,
                end_index=target_end
            )

            print("\n" + "=" * 50)
            print("✓ 全部流程执行完成！")
            print("=" * 50)

        except Exception as e:
            print(f"\n✗ 流程执行失败: {e}")
            raise

    def close_current_tab(self):
        """关闭当前标签页，如果有多个标签则切换到第一个"""
        try:
            print("正在关闭当前页面...")

            # 获取所有窗口句柄
            handles = self.driver.window_handles

            if len(handles) > 1:
                # 如果有多个标签，关闭当前标签
                self.driver.close()
                # 切换到第一个标签
                self.driver.switch_to.window(handles[0])
                print("✓ 当前标签已关闭，已切换到主窗口")
            else:
                # 如果只有一个标签，不关闭（保持浏览器会话）
                print("✓ 仅有一个标签页，保持窗口打开")

            time.sleep(1)

        except Exception as e:
            print(f"⚠ 关闭页面失败（忽略）: {e}")

    def run_batch_workflow(self, prompts, batch_size=120):
        """
        分批运行自动化流程
        每批都会新打开Flow页面，处理完后关闭页面

        Args:
            prompts: 提示词列表
            batch_size: 每批处理的提示词数量
        """
        total_prompts = len(prompts)
        total_batches = (total_prompts + batch_size - 1) // batch_size

        print(f"\n开始分批处理，共 {total_prompts} 个提示词，分 {total_batches} 批")
        print(f"每批 {batch_size} 个\n")

        for batch_num in range(1, total_batches + 1):
            start_idx = (batch_num - 1) * batch_size
            end_idx = min(start_idx + batch_size, total_prompts)
            batch_prompts = prompts[start_idx:end_idx]

            print("\n" + "=" * 60)
            print(f"第 {batch_num}/{total_batches} 批")
            print(f"提示词索引: {start_idx + 1} - {end_idx} (共 {len(batch_prompts)} 个)")
            print("=" * 60)

            try:
                # 设置当前批次的下载目录
                batch_dir = self.set_batch_download_dir(batch_num)
                print(f"批次下载目录: {batch_dir}\n")

                # 1. 打开新的Flow页面
                print("正在打开新的Flow页面...")
                self.open_flow_page()

                # 2. 点击 New project
                self.click_new_project()

                # 3. 提交当前批次的提示词
                self.batch_submit_prompts(batch_prompts)

                # 4. 等待第一个视频生成完成
                print("\n等待视频生成...")
                video_ready = self.wait_for_video_ready(timeout=600)

                if not video_ready:
                    print("⚠ 警告: 未检测到视频生成完成，但仍将尝试下载")

                # 5. 下载当前批次的视频
                print(f"\n开始下载第 {batch_num} 批视频...")
                self.batch_download_videos(
                    start_index=1,
                    end_index=len(batch_prompts)
                )

                print(f"\n✓ 第 {batch_num}/{total_batches} 批处理完成！")

                # 6. 关闭当前页面（如果不是最后一批）
                if batch_num < total_batches:
                    self.close_current_tab()
                    print(f"\n等待 3 秒后开始下一批...")
                    time.sleep(3)

                # 重置批次目录，为下一批做准备
                self.current_batch_dir = None

            except Exception as e:
                print(f"\n✗ 第 {batch_num} 批处理失败: {e}")
                import traceback
                traceback.print_exc()

                # 尝试关闭当前页面，继续处理下一批
                try:
                    if batch_num < total_batches:
                        self.close_current_tab()
                except:
                    pass

                # 重置批次目录
                self.current_batch_dir = None
                print("继续处理下一批...\n")
                continue

        print("\n" + "=" * 60)
        print(f"✓ 所有 {total_batches} 批次处理完成！")
        print(f"总计处理了 {total_prompts} 个提示词")
        print("=" * 60)
