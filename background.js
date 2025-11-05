// background.js - 后台脚本
chrome.runtime.onInstalled.addListener(() => {
  console.log("Flow帧转视频助手 v1.0.0 已安装");
});

const FLOW_URL = "https://labs.google/fx/zh/tools/flow";
const FLOW_FALLBACK_URL = "https://labs.google/fx/tools/flow";

// 点击插件图标时打开悬浮窗口
chrome.action.onClicked.addListener(async (tab) => {
  const currentUrl = tab?.url || "";
  const isFlowPage =
    currentUrl.includes("labs.google/fx/zh/tools/flow") ||
    currentUrl.includes("labs.google/fx/tools/flow");

  if (isFlowPage) {
    // 在当前标签页执行脚本打开悬浮窗口
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        if (window.floatingWindow) {
          window.floatingWindow.show();
        } else if (window.initFloatingWindow) {
          window.initFloatingWindow().show();
        } else {
          // 如果悬浮窗口未初始化，重新创建
          const event = new Event("reinitFloatingWindow");
          document.dispatchEvent(event);
        }
      },
    });
  } else {
    // 如果不是 Flow 帧转视频页面，打开新标签页（带兼容路径）
    chrome.tabs.create({ url: FLOW_URL, active: true }, (createdTab) => {
      if (chrome.runtime.lastError || !createdTab) {
        chrome.tabs.create({ url: FLOW_FALLBACK_URL, active: true });
      }
    });
  }
});
