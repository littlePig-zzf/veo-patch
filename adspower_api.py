"""
AdsPower API 集成模块
用于启动和管理 AdsPower 指纹浏览器环境
"""

import requests
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
import time


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

            print(f"浏览器已启动，Selenium 地址: {selenium_address}")

            # 连接到 AdsPower 浏览器
            chrome_options = Options()
            chrome_options.add_experimental_option("debuggerAddress", selenium_address)

            self.driver = webdriver.Chrome(options=chrome_options)
            self.profile_id = profile_id

            print("✓ 成功连接到 AdsPower 浏览器")
            return self.driver

        except Exception as e:
            print(f"✗ 启动浏览器失败: {e}")
            raise

    def close_browser(self):
        """关闭 AdsPower 浏览器"""
        if self.driver:
            try:
                self.driver.quit()
                print("✓ 浏览器已关闭")
            except Exception as e:
                print(f"关闭浏览器时出错: {e}")

        if self.profile_id:
            try:
                # 调用 API 停止浏览器
                url = f"{self.api_url}/api/v1/browser/stop"
                params = {"user_id": self.profile_id}
                requests.get(url, params=params)
                print(f"✓ AdsPower 环境已停止: {self.profile_id}")
            except Exception as e:
                print(f"停止 AdsPower 环境时出错: {e}")

    def __enter__(self):
        """上下文管理器入口"""
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """上下文管理器退出"""
        self.close_browser()
