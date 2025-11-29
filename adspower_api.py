"""
AdsPower API 集成模块
用于启动和管理 AdsPower 指纹浏览器环境
"""

import requests
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.desired_capabilities import DesiredCapabilities
import time
import subprocess


class AdsPowerAPI:
    """AdsPower API 客户端"""

    def __init__(self, api_url="http://local.adspower.net:50325"):
        """
        初始化 AdsPower API 客户端

        Args:
            api_url: AdsPower 本地 API 地址
        """
        self.api_url = api_url
        self.driver = None
        self.profile_id = None

    def start_browser(self, profile_id, headless=False):
        """
        启动 AdsPower 指纹浏览器

        Args:
            profile_id: AdsPower 环境 ID
            headless: 是否无头模式

        Returns:
            selenium WebDriver 实例
        """
        print(f"正在启动 AdsPower 环境: {profile_id}")

        # 先检查浏览器是否已经在运行
        check_url = f"{self.api_url}/api/v1/browser/active"
        try:
            check_response = requests.get(check_url, params={"user_id": profile_id})
            if check_response.status_code == 200:
                check_data = check_response.json()
                if check_data.get("code") == 0 and check_data.get("data", {}).get("status") == "Active":
                    print(f"检测到浏览器已在运行，先关闭...")
                    self.stop_browser(profile_id)
                    time.sleep(2)
        except Exception as e:
            print(f"检查浏览器状态时出错（忽略）: {e}")

        # 调用 AdsPower API 启动浏览器
        url = f"{self.api_url}/api/v1/browser/start"
        params = {
            "user_id": profile_id,
            "headless": 1 if headless else 0
        }

        try:
            response = requests.get(url, params=params)
            response.raise_for_status()
            data = response.json()

            if data.get("code") != 0:
                raise Exception(f"启动浏览器失败: {data.get('msg', '未知错误')}")

            browser_data = data["data"]
            webdriver_path = browser_data.get("webdriver")
            selenium_address = browser_data["ws"]["selenium"]
            selenium_endpoint = selenium_address
            if selenium_endpoint.startswith("ws://"):
                selenium_endpoint = selenium_endpoint[len("ws://"):]
            elif selenium_endpoint.startswith("http://"):
                selenium_endpoint = selenium_endpoint[len("http://"):]
            elif selenium_endpoint.startswith("https://"):
                selenium_endpoint = selenium_endpoint[len("https://"):]

            print(f"浏览器已启动，Selenium 地址: {selenium_address}")
            print(f"使用 AdsPower webdriver: {webdriver_path}")

            if not webdriver_path:
                raise Exception("AdsPower API 未返回 webdriver 路径，无法连接浏览器")

            # 等待浏览器完全启动
            print("等待浏览器完全启动...")
            time.sleep(3)

            # 连接到 AdsPower 浏览器，强制使用 AdsPower 内置的 chromedriver
            chrome_options = Options()
            chrome_options.add_experimental_option("debuggerAddress", selenium_endpoint)
            # 添加必要的参数
            chrome_options.add_argument('--no-sandbox')
            chrome_options.add_argument('--disable-dev-shm-usage')

            debugger_url = f"http://{selenium_endpoint}/json/version"
            debugger_ready = False
            debugger_error = None
            for wait_idx in range(10):
                try:
                    resp = requests.get(debugger_url, timeout=2)
                    if resp.status_code == 200:
                        debugger_ready = True
                        break
                except requests.RequestException as dbg_err:
                    debugger_error = dbg_err
                time.sleep(1)

            if not debugger_ready:
                raise Exception(f"调试端口无响应: {debugger_error}")

            print(f"调试端口已就绪，准备连接...")

            # 尝试方案1: 使用 Remote WebDriver (推荐用于 AdsPower)
            last_error = None

            # 先尝试启动 chromedriver 作为服务
            chromedriver_port = 9515
            chromedriver_process = None

            try:
                # 启动 chromedriver
                print(f"启动 chromedriver 服务...")
                chromedriver_process = subprocess.Popen(
                    [webdriver_path, f"--port={chromedriver_port}"],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE
                )
                time.sleep(2)

                # 使用 Remote WebDriver 连接
                print(f"使用 Remote WebDriver 连接...")
                command_executor = f"http://127.0.0.1:{chromedriver_port}"
                self.driver = webdriver.Remote(
                    command_executor=command_executor,
                    options=chrome_options
                )
                print("✓ Remote WebDriver 连接成功")

            except Exception as remote_error:
                print(f"✗ Remote WebDriver 方式失败: {remote_error}")
                if chromedriver_process:
                    chromedriver_process.terminate()
                    chromedriver_process = None

                # 方案2: 回退到原来的方式，但增加更多重试
                print("尝试使用传统 Service 方式连接...")
                for attempt in range(5):
                    try:
                        if attempt > 0:
                            wait_time = 4 + (attempt * 2)
                            print(f"等待 {wait_time} 秒后重试... (第 {attempt + 1}/5 次)")
                            time.sleep(wait_time)

                        service = Service(executable_path=webdriver_path)
                        print(f"尝试连接 (第 {attempt + 1}/5 次)...")
                        self.driver = webdriver.Chrome(service=service, options=chrome_options)
                        break
                    except Exception as connect_error:
                        last_error = connect_error
                        error_msg = str(connect_error)
                        print(f"✗ 连接失败: {error_msg[:200]}")
                else:
                    raise Exception(f"无法连接 AdsPower 浏览器: {last_error}")

            self.profile_id = profile_id

            print("✓ 成功连接到 AdsPower 浏览器")
            return self.driver

        except Exception as e:
            print(f"✗ 启动浏览器失败: {e}")
            raise

    def stop_browser(self, profile_id):
        """
        停止指定的 AdsPower 浏览器

        Args:
            profile_id: AdsPower 环境 ID
        """
        try:
            url = f"{self.api_url}/api/v1/browser/stop"
            params = {"user_id": profile_id}
            response = requests.get(url, params=params)
            if response.status_code == 200:
                print(f"✓ AdsPower 环境已停止: {profile_id}")
        except Exception as e:
            print(f"停止 AdsPower 环境时出错: {e}")

    def close_browser(self):
        """关闭 AdsPower 浏览器"""
        if self.driver:
            try:
                self.driver.quit()
                print("✓ 浏览器已关闭")
            except Exception as e:
                print(f"关闭浏览器时出错: {e}")

        if self.profile_id:
            self.stop_browser(self.profile_id)

    def __enter__(self):
        """上下文管理器入口"""
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """上下文管理器退出"""
        self.close_browser()
