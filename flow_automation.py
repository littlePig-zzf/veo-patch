"""
Google Flow 文生视频自动化模块
使用 Selenium 实现批量提交提示词和下载视频
"""

import time
import json
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException


class FlowAutomation:
    """Google Flow 自动化操作类"""

    def __init__(self, driver, wait_time=3):
        """
        初始化自动化操作

        Args:
            driver: Selenium WebDriver 实例
            wait_time: 每次操作后的等待时间（秒）
        """
        self.driver = driver
        self.wait_time = wait_time
        self.wait = WebDriverWait(driver, 30)

    def open_flow_page(self):
        """打开 Google Flow 页面"""
        url = "https://labs.google/fx/tools/flow"
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

            # 4. 清空并输入提示词
            print("  → 输入提示词...")

            # 先聚焦到输入框
            self.driver.execute_script("arguments[0].focus();", textarea)
            time.sleep(0.3)

            # 清空输入框
            try:
                textarea.clear()
            except:
                # 如果 clear() 失败，使用 JavaScript 清空
                self.driver.execute_script("arguments[0].value = '';", textarea)

            time.sleep(0.3)

            # 使用 JavaScript 输入提示词
            self.driver.execute_script("arguments[0].value = arguments[1];", textarea, prompt)

            # 触发所有必要的事件
            self.driver.execute_script("""
                arguments[0].dispatchEvent(new Event('input', { bubbles: true }));
                arguments[0].dispatchEvent(new Event('change', { bubbles: true }));
            """, textarea)

            time.sleep(0.3)

            # 失焦以激活提交按钮
            print("  → 触发失焦事件...")
            self.driver.execute_script("arguments[0].blur();", textarea)

            time.sleep(0.5)

            # 3. 点击生成按钮
            print("  → 查找生成按钮...")
            generate_btn = self._find_generate_button()

            if not generate_btn:
                raise Exception("未找到生成按钮")

            print("  → 点击生成按钮...")
            time.sleep(0.5)
            generate_btn.click()
            time.sleep(1)

            print(f"✓ [{index}/{total}] 提示词已提交")

            # 等待指定时间
            time.sleep(self.wait_time)

        except Exception as e:
            print(f"✗ [{index}/{total}] 提交失败: {e}")
            raise

    def _find_generate_button(self):
        """查找生成按钮（带有箭头图标的按钮）"""
        try:
            # 查找包含 arrow_forward 图标的按钮
            buttons = self.driver.find_elements(By.CSS_SELECTOR, "button, [role='button']")

            for btn in buttons:
                if not btn.is_displayed() or not btn.is_enabled():
                    continue

                # 检查按钮内是否有 arrow_forward 图标
                try:
                    icon = btn.find_element(By.CSS_SELECTOR, "i, svg")
                    icon_text = icon.text.strip().lower()
                    if "arrow_forward" in icon_text:
                        return btn
                except NoSuchElementException:
                    pass

            # 如果没找到，返回最后一个可用按钮
            for btn in reversed(buttons):
                if btn.is_displayed() and btn.is_enabled():
                    return btn

            return None

        except Exception as e:
            print(f"查找生成按钮时出错: {e}")
            return None

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

    def batch_download_videos(self, start_index=1, end_index=None):
        """
        批量下载视频

        Args:
            start_index: 起始索引（从1开始）
            end_index: 结束索引（包含）
        """
        print(f"\n开始批量下载视频（索引 {start_index} 到 {end_index}）...")

        # 注入批量下载脚本
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

                // 查找下载按钮
                const buttons = item.querySelectorAll('button, [role="button"]');
                let downloadBtn = null;

                for (const btn of buttons) {
                    const text = btn.textContent.toLowerCase();
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

            print(f"✓ 批量下载完成！共触发 {downloaded_count} 个下载")

        except Exception as e:
            print(f"✗ 批量下载失败: {e}")
            raise

    def run_full_workflow(self, prompts):
        """
        运行完整的自动化流程

        Args:
            prompts: 提示词列表
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
            video_count = len(prompts)
            self.batch_download_videos(start_index=1, end_index=video_count)

            print("\n" + "=" * 50)
            print("✓ 全部流程执行完成！")
            print("=" * 50)

        except Exception as e:
            print(f"\n✗ 流程执行失败: {e}")
            raise
