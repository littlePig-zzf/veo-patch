"""
测试 AdsPower 连接
"""

import requests

def test_adspower_connection():
    """测试 AdsPower API 连接"""
    api_url = "http://local.adspower.net:50325"
    profile_id = "kpcl6vt"

    print(f"测试 AdsPower 连接...")
    print(f"API 地址: {api_url}")
    print(f"环境 ID: {profile_id}\n")

    try:
        # 测试启动浏览器
        url = f"{api_url}/api/v1/browser/start"
        params = {"user_id": profile_id}

        print("正在发送启动请求...")
        response = requests.get(url, params=params, timeout=10)

        print(f"响应状态码: {response.status_code}")
        print(f"响应内容: {response.text}\n")

        if response.status_code == 200:
            data = response.json()
            print(f"解析后的数据: {data}\n")

            if data.get("code") == 0:
                print("✓ AdsPower 连接成功！")
                print(f"Selenium 地址: {data['data']['ws']['selenium']}")
                return True
            else:
                print(f"✗ AdsPower 返回错误: {data.get('msg', '未知错误')}")
                return False
        else:
            print(f"✗ HTTP 请求失败: {response.status_code}")
            return False

    except requests.exceptions.ConnectionError as e:
        print(f"✗ 无法连接到 AdsPower API")
        print(f"请确保:")
        print(f"  1. AdsPower 客户端正在运行")
        print(f"  2. API 地址正确: {api_url}")
        print(f"错误详情: {e}")
        return False
    except Exception as e:
        print(f"✗ 发生错误: {e}")
        return False

if __name__ == "__main__":
    test_adspower_connection()
