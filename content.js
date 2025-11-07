// 等待DOM加载完成
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initialize);
} else {
  initialize();
}

const HUMAN_ACTION_DELAY = 300;

if (typeof window !== "undefined") {
  window.flowFrameModeEnsured = Boolean(window.flowFrameModeEnsured);
}

function initialize() {
  console.log("Flow帧转视频助手已加载");

  // 添加错误处理，防止扩展上下文失效
  window.addEventListener("error", function (e) {
    if (e.message.includes("Extension context invalidated")) {
      console.warn("检测到扩展上下文失效，尝试重新初始化...");
      // 可以在这里添加重新初始化逻辑
    }
  });

  // 添加页面卸载时的清理
  window.addEventListener("beforeunload", function () {
    console.log("页面即将卸载，清理资源...");
    window.shouldStopProcessing = true;
  });

  // 监听来自popup的消息
  chrome.runtime.onMessage.addListener(async function (
    request,
    sender,
    sendResponse
  ) {
    if (request.action === "processImage") {
      try {
        await processImageWithPrompt(
          request.imageFile,
          request.prompt,
          request.index,
          request.total,
          request.waitTime,
          request.hasImage
        );
        sendResponse({ success: true });
      } catch (error) {
        console.error("处理图片失败:", error);
        sendResponse({ success: false, error: error.message });
      }
    }
  });

  // 监听来自悬浮窗口的自定义事件
  document.addEventListener("processFlowImage", async function (e) {
    const { imageFile, prompt, index, total, waitTime, hasImage } = e.detail;
    try {
      await processImageWithPrompt(
        imageFile,
        prompt,
        index,
        total,
        waitTime,
        hasImage
      );

      // 只有在真正处理完成时才发送成功事件
      console.log(`第${index}个任务处理完成，发送成功事件`);
      document.dispatchEvent(
        new CustomEvent("flowImageProcessed", {
          detail: { index, success: true },
        })
      );
    } catch (error) {
      console.error(`第${index}个任务处理失败:`, error);
      document.dispatchEvent(
        new CustomEvent("flowImageProcessed", {
          detail: { index, success: false, error: error.message },
        })
      );
    }
  });

  // 监听点击生成按钮的事件
  document.addEventListener("clickGenerateButton", async function () {
    try {
      await clickGenerateButton();
      console.log("响应clickGenerateButton事件，已点击生成按钮");
    } catch (error) {
      console.error("点击生成按钮失败:", error);
    }
  });

  document.addEventListener("ensureFrameMode", async function (event) {
    const force = Boolean(event?.detail?.force);
    try {
      await ensureFrameModeEnabled(10000, force);
      document.dispatchEvent(
        new CustomEvent("ensureFrameModeResult", {
          detail: { success: true },
        })
      );
    } catch (error) {
      document.dispatchEvent(
        new CustomEvent("ensureFrameModeResult", {
          detail: { success: false, message: error.message },
        })
      );
    }
  });

  // 添加全局Promise错误处理
  window.addEventListener("unhandledrejection", function (event) {
    console.warn("未处理的Promise错误:", event.reason);
    if (
      event.reason &&
      event.reason.message &&
      event.reason.message.includes("Extension context invalidated")
    ) {
      console.warn("检测到扩展上下文失效，忽略此错误");
      event.preventDefault(); // 阻止默认的错误处理
    }
  });
}

async function ensureFrameModeEnabled(timeout = 10000, force = false) {
  if (!force && window.flowFrameModeEnsured && isFrameModeActive()) {
    console.log("帧转视频模式此前已确认，无需重复切换");
    return;
  }

  if (!force && window.flowFrameModeEnsured && !isFrameModeActive()) {
    console.warn("检测到帧转视频模式可能被修改，准备重新切换");
    window.flowFrameModeEnsured = false;
  }

  if (isFrameModeActive()) {
    console.log("当前已处于帧转视频模式");
    window.flowFrameModeEnsured = true;
    return;
  }

  console.log("检测帧转视频模式...");
  await ensureFrameToVideoMode(timeout);

  if (isFrameModeActive()) {
    window.flowFrameModeEnsured = true;
    console.log("当前已处于帧转视频模式");
    return;
  }

  throw new Error("未能确认已选择帧转视频模式，请手动检查页面模式");
}

async function ensureFrameToVideoMode(timeout = 6000) {
  if (window.shouldStopProcessing) {
    return;
  }

  const combobox =
    (await waitForElement('[role="combobox"]', timeout)) ||
    document.querySelector('[role="combobox"]');

  if (!combobox) {
    console.warn("未找到模式切换下拉框，跳过模式确认步骤");
    return;
  }

  const readCurrentLabel = () =>
    normalizeText(
      combobox.textContent || combobox.getAttribute("aria-label") || ""
    );

  const frameKeywords = ["帧转视频", "Frames to Video"].map(normalizeText);

  if (frameKeywords.some((keyword) => readCurrentLabel().includes(keyword))) {
    console.log("当前已处于“帧转视频”模式");
    return;
  }

  console.log("检测到模式未设置为“帧转视频”，尝试切换...");

  await humanDelay();
  try {
    if (typeof combobox.focus === "function") {
      combobox.focus();
      await humanDelay();
    }
    combobox.click();
    await humanDelay();
  } catch (error) {
    console.warn("模式切换下拉框点击失败，尝试派发鼠标事件:", error);
    try {
      await humanDelay();
      combobox.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true })
      );
      await humanDelay();
    } catch (innerError) {
      console.error("模式切换下拉框备用触发也失败:", innerError);
    }
  }

  const listbox =
    (await waitForElement('[role="listbox"]', 4000)) ||
    document.querySelector('[role="listbox"]');

  if (!listbox) {
    console.warn("未找到模式列表，无法切换到“帧转视频”，请手动确认页面模式");
    return;
  }

  const option =
    Array.from(listbox.querySelectorAll('[role="option"]')).find((item) => {
      const label = normalizeText(item.textContent || "");
      return frameKeywords.some((keyword) => label.includes(keyword));
    }) ||
    Array.from(listbox.querySelectorAll("*")).find((item) => {
      const label = normalizeText(item.textContent || "");
      return frameKeywords.some((keyword) => label.includes(keyword));
    });

  if (!option) {
    console.warn("模式列表中未找到“帧转视频”选项，请手动切换模式");
    return;
  }

  await humanDelay();
  try {
    if (typeof option.focus === "function") {
      option.focus();
      await humanDelay();
    }
    option.click();
    await humanDelay();
  } catch (error) {
    console.warn("点击“帧转视频”选项失败，尝试备用触发:", error);
    try {
      await humanDelay();
      option.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true })
      );
      await humanDelay();
    } catch (innerError) {
      console.error("备用方式触发“帧转视频”选项仍失败:", innerError);
    }
  }

  const start = Date.now();
  while (Date.now() - start < 4000) {
    await delay(150);
    if (frameKeywords.some((keyword) => readCurrentLabel().includes(keyword))) {
      console.log("模式已成功切换到“帧转视频”");
      return;
    }
  }

  console.warn("模式切换未在预期时间内生效，请手动确认是否已选择“帧转视频”");
}

function isFrameModeActive() {
  const comboboxes = Array.from(
    document.querySelectorAll('[role="combobox"]')
  ).filter(isVisibleElement);

  const frameKeywords = ["帧转视频", "Frames to Video"].map(normalizeText);

  return comboboxes.some((combobox) => {
    const label = normalizeText(
      combobox.textContent || combobox.getAttribute("aria-label") || ""
    );
    return frameKeywords.some((keyword) => label.includes(keyword));
  });
}

function detectCurrentOrientationLabel() {
  const comboboxes = Array.from(
    document.querySelectorAll('[role="combobox"]')
  ).filter(isVisibleElement);

  for (const combobox of comboboxes) {
    const label = normalizeText(
      combobox.textContent || combobox.getAttribute("aria-label") || ""
    );
    if (!label) {
      continue;
    }
    if (label.includes("纵向") || label.includes("portrait")) {
      return "纵向";
    }
    if (label.includes("横向") || label.includes("landscape")) {
      return "横向";
    }
  }

  return null;
}

function isCurrentOrientationVertical() {
  return detectCurrentOrientationLabel() === "纵向";
}

function reportOrientationStatus(context = "general") {
  const orientation = detectCurrentOrientationLabel();
  document.dispatchEvent(
    new CustomEvent("flowOrientationDetected", {
      detail: { orientation, context, timestamp: Date.now() },
    })
  );
  if (orientation) {
    console.log(`当前裁剪方向：${orientation}（来源：${context}）`);
  } else {
    console.log(`未检测到裁剪方向控件（来源：${context}）`);
  }
  return orientation;
}

async function processImageWithPrompt(
  imageFile,
  prompt,
  index,
  total,
  waitTime = 5000,
  hasImageFlag
) {
  const hasImage =
    typeof hasImageFlag === "boolean"
      ? hasImageFlag
      : Boolean(imageFile && imageFile?.dataUrl);
  const taskLabel = hasImage
    ? `图片: ${imageFile.name}`
    : "无新图片，仅提交提示词";
  console.log(
    `开始处理第${index}个任务（${taskLabel}），等待时间: ${waitTime}ms`
  );

  try {
    if (typeof chrome !== "undefined" && chrome.runtime) {
      chrome.runtime.getURL("");
    }
  } catch (error) {
    if (error.message.includes("Extension context invalidated")) {
      console.error("扩展上下文已失效，无法继续处理");
      throw new Error("扩展上下文已失效，请刷新页面后重试");
    }
  }

  if (window.shouldStopProcessing) {
    console.log("检测到停止信号，跳过处理");
    return;
  }

  if (document.readyState !== "complete") {
    console.log("页面未完全加载，等待...");
    await new Promise((resolve) => {
      if (document.readyState === "complete") {
        resolve();
      } else {
        window.addEventListener("load", resolve, { once: true });
      }
    });
  }

  const currentUrl = window.location.href;
  const isFlowPage =
    currentUrl.includes("labs.google/fx/zh/tools/flow") ||
    currentUrl.includes("labs.google/fx/tools/flow");
  if (!isFlowPage) {
    throw new Error("当前页面不是 Flow 帧转视频页面，请打开 https://labs.google/fx/zh/tools/flow");
  }

  if (hasImage) {
    await ensureFrameToVideoMode();
    reportOrientationStatus("before-task");
  } else {
    console.log("未提供图片文件，跳过帧转视频模式确认与裁剪方向检测");
    document.dispatchEvent(
      new CustomEvent("flowOrientationDetected", {
        detail: { orientation: null, context: "no-image", timestamp: Date.now() },
      })
    );
  }
  await humanDelay();


  if (window.shouldStopProcessing) {
    return;
  }

  if (index > 1) {
    await humanDelay();
  }

  document.dispatchEvent(
    new CustomEvent("updateStep", {
      detail: { stepIndex: 1, status: "completed" },
    })
  );

  document.dispatchEvent(
    new CustomEvent("updateStep", {
      detail: { stepIndex: 2, status: "completed" },
    })
  );

  let uploadContext = null;

  if (hasImage) {
    document.dispatchEvent(
      new CustomEvent("updateStep", {
        detail: { stepIndex: 3, status: "current" },
      })
    );

    await humanDelay();
    await clearReferenceImage();
    await humanDelay();

    document.dispatchEvent(
      new CustomEvent("updateStep", {
        detail: { stepIndex: 3, status: "completed" },
      })
    );

    if (window.shouldStopProcessing) {
      return;
    }

    console.log("开始上传图片...");
    document.dispatchEvent(
      new CustomEvent("updateStep", {
        detail: { stepIndex: 4, status: "current" },
      })
    );

    await humanDelay();
    uploadContext = await uploadImage(imageFile);
    await humanDelay();

    document.dispatchEvent(
      new CustomEvent("updateStep", {
        detail: { stepIndex: 4, status: "completed" },
      })
    );

    if (window.shouldStopProcessing) {
      return;
    }

    console.log("等待上传完成...");
    document.dispatchEvent(
      new CustomEvent("updateStep", {
        detail: { stepIndex: 5, status: "current" },
      })
    );

    await humanDelay();
    await waitForUploadComplete(uploadContext);
    await humanDelay();

    document.dispatchEvent(
      new CustomEvent("updateStep", {
        detail: { stepIndex: 5, status: "completed" },
      })
    );
  } else {
    console.log("未提供图片文件，跳过图片清理与上传步骤");
    await humanDelay();
    document.dispatchEvent(
      new CustomEvent("updateStep", {
        detail: { stepIndex: 3, status: "completed" },
      })
    );
    await humanDelay();
    document.dispatchEvent(
      new CustomEvent("updateStep", {
        detail: { stepIndex: 4, status: "completed" },
      })
    );
    await humanDelay();
    document.dispatchEvent(
      new CustomEvent("updateStep", {
        detail: { stepIndex: 5, status: "completed" },
      })
    );
  }

  if (window.shouldStopProcessing) {
    return;
  }

  console.log("开始输入提示词...");
  document.dispatchEvent(
    new CustomEvent("updateStep", {
      detail: { stepIndex: 6, status: "current" },
    })
  );

  await humanDelay();
  await enterPrompt(prompt);
  await humanDelay();

  document.dispatchEvent(
    new CustomEvent("updateStep", {
      detail: { stepIndex: 6, status: "completed" },
    })
  );

  if (window.shouldStopProcessing) {
    return;
  }

  await humanDelay();

  document.dispatchEvent(
    new CustomEvent("updateStep", {
      detail: { stepIndex: 7, status: "current" },
    })
  );

  await humanDelay();
  await clickGenerateButton();
  await humanDelay();

  document.dispatchEvent(
    new CustomEvent("updateStep", {
      detail: { stepIndex: 7, status: "completed" },
    })
  );

  if (window.shouldStopProcessing) {
    return;
  }

  await delay(waitTime || 1000);

  document.dispatchEvent(
    new CustomEvent("updateStep", {
      detail: { stepIndex: 8, status: "completed" },
    })
  );

  if (hasImage) {
    reportOrientationStatus("after-task");
  }
  console.log(`第${index}个任务处理完成，已提交创作任务`);
}

async function clearReferenceImage() {
  if (window.shouldStopProcessing) {
    return;
  }

  const workspace = locateFrameWorkspace();

  if (!workspace) {
    console.log("未能定位帧区域，跳过清除步骤");
    return;
  }

  if (!hasUploadedPreview(workspace)) {
    console.log("未检测到上一张图片，无需清理");
    return;
  }

  const removalButtons = findFrameRemovalButtons(workspace);

  if (!removalButtons.length) {
    console.log("未找到清除按钮，将直接覆盖上传");
    return;
  }

  const clearButton = removalButtons[0];
  console.log("检测到上一张图片，尝试清除...");
  await humanDelay();

  try {
    if (typeof clearButton.focus === "function") {
      clearButton.focus();
      await humanDelay();
    }
    clearButton.click();
    await humanDelay();
    clearButton.dispatchEvent(new Event("click", { bubbles: true }));
    await humanDelay();
  } catch (error) {
    console.warn("清理按钮点击失败，尝试使用备用方式:", error);
    try {
      await humanDelay();
      clearButton.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true })
      );
      await humanDelay();
    } catch (innerError) {
      console.error("备用点击方式也失败:", innerError);
    }
  }

  const start = Date.now();
  while (Date.now() - start < 5000) {
    if (window.shouldStopProcessing) {
      return;
    }
    if (!hasUploadedPreview(workspace)) {
      console.log("上一张图片已清除");
      return;
    }
    await delay(200);
  }

  console.log("未能在预期时间内清除上一张图片，将继续后续步骤");
}

async function uploadImage(imageFile) {
  console.log(`上传首帧图片: ${imageFile.name}`);

  const workspace = locateFrameWorkspace();

  const file = dataURLtoFile(imageFile.dataUrl, imageFile.name);
  const dropZone = locateFrameDropZone(workspace);

  await humanDelay();

  let uploaded = false;
  if (dropZone) {
    try {
      const dropTriggered = await simulateFileDrop(dropZone, file);
      if (dropTriggered) {
        console.log("已尝试通过拖拽方式上传，等待裁剪弹窗出现...");
        await humanDelay();
        uploaded = await waitForCropDialogOpen(4000);
        if (uploaded) {
          console.log("检测到裁剪弹窗，拖拽上传成功");
        }
      }
    } catch (error) {
      console.warn("拖拽上传流程异常:", error);
    }
  } else {
    console.warn("未能定位拖拽区域");
  }

  if (!uploaded) {
    throw new Error("拖拽上传未成功，请确认页面支持拖拽或稍后重试");
  }

  await humanDelay();
  await handleCropDialog();
  reportOrientationStatus("post-upload");

  return { container: workspace || document.body, trigger: dropZone || null };
}

async function waitForCropDialogOpen(timeout = 2000) {
  const start = Date.now();
  const saveButtonKeywords = [
    "剪裁并保存",
    "裁剪并保存",
    "crop and save",
    "cropandsave"
  ];
  while (Date.now() - start < timeout) {
    const saveButtons = findElementsByText(
      ["button", '[role="button"]', "span", "div"],
      saveButtonKeywords
    ).filter(isVisibleElement);
    if (saveButtons.length > 0) {
      return true;
    }
    await delay(100);
  }
  return false;
}

async function handleCropDialog(timeout = 15000) {
  const start = Date.now();
  const saveButtonKeywords = [
    "剪裁并保存",
    "裁剪并保存",
    "crop and save",
    "cropandsave"
  ];

  while (Date.now() - start < timeout) {
    if (window.shouldStopProcessing) {
      return false;
    }

    const saveButtonCandidates = findElementsByText(
      ["button", '[role="button"]', "span", "div"],
      saveButtonKeywords
    ).filter(isVisibleElement);

    if (!saveButtonCandidates.length) {
      await delay(120);
      continue;
    }

    const saveButton = saveButtonCandidates[0];
    console.log("检测到剪裁弹窗，准备切换纵向并保存");

    await humanDelay();
    await ensureVerticalCrop(saveButton);
    await humanDelay();

    try {
      saveButton.click();
    } catch (error) {
      console.warn("点击“剪裁并保存”按钮失败，尝试备用触发:", error);
      try {
      await humanDelay();
      saveButton.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true })
      );
      await humanDelay();
      } catch (innerError) {
        console.error("备用触发“剪裁并保存”按钮仍失败:", innerError);
      }
    }

    await humanDelay();
    await waitForCropDialogClose(saveButton, 6000);
    return true;
  }

  console.log("未检测到剪裁弹窗，继续后续流程");
  return false;
}

async function ensureVerticalCrop(referenceElement) {
  const scope =
    (referenceElement && referenceElement.closest?.("div")) || document;

  reportOrientationStatus("before-ensure-vertical");

  const setVerticalViaButton = async () => {
    const selectors = ["button", '[role="button"]', "span", "div"];
    const chineseCandidates = findElementsByText(selectors, "纵向").filter(
      isVisibleElement
    );
    const englishCandidates = findElementsByText(selectors, "Portrait").filter(
      isVisibleElement
    );
    const allCandidates = [...chineseCandidates, ...englishCandidates];

    if (!allCandidates.length) {
      return false;
    }

    const verticalButton =
      allCandidates.find((element) => scope.contains(element)) ||
      allCandidates[0];

    if (!verticalButton) {
      return false;
    }

    try {
      await humanDelay();
      verticalButton.click();
      await humanDelay();
      return true;
    } catch (error) {
      console.warn("点击“纵向”按钮失败，尝试备用方式:", error);
      try {
        await humanDelay();
        verticalButton.dispatchEvent(
          new MouseEvent("click", { bubbles: true, cancelable: true })
        );
        await humanDelay();
        return true;
      } catch (innerError) {
        console.error("备用方式点击“纵向”按钮也失败:", innerError);
      }
    }
    return false;
  };

  if (isCurrentOrientationVertical()) {
    return true;
  }

  if (await setVerticalViaButton()) {
    reportOrientationStatus("after-vertical-button");
    if (isCurrentOrientationVertical()) {
      return true;
    }
  }

  const combobox = await locateOrientationCombobox();
  if (!combobox) {
    console.warn("未找到裁剪方向下拉框，可能无需调整");
    return false;
  }

  const success = await selectVerticalFromCombobox(combobox);
  if (!success) {
    console.warn("通过下拉框设置纵向失败，请检查页面结构");
  } else {
    reportOrientationStatus("after-combobox-select");
  }
  return success;
}

async function locateOrientationCombobox(timeout = 3000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const combos = Array.from(
      document.querySelectorAll('[role="combobox"]')
    ).filter(isVisibleElement);

    const match = combos.find((combobox) => {
      const label = normalizeText(combobox.textContent || "");
      return (
        label.includes("横向") ||
        label.includes("纵向") ||
        label.includes("landscape") ||
        label.includes("portrait")
      );
    });

    if (match) {
      return match;
    }

    await delay(120);
  }
  return null;
}

async function selectVerticalFromCombobox(combobox) {
  const readState = () =>
    normalizeText(combobox.textContent || combobox.getAttribute("aria-label") || "");

  const orientationKeywords = ["纵向", "Portrait"].map(normalizeText);

  if (orientationKeywords.some((keyword) => readState().includes(keyword))) {
    return true;
  }

  try {
    await humanDelay();
    combobox.click();
    await humanDelay();
  } catch (error) {
    console.warn("裁剪方向下拉框点击失败:", error);
    try {
      await humanDelay();
      combobox.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true })
      );
      await humanDelay();
    } catch (innerError) {
      console.error("备用方式点击裁剪下拉框也失败:", innerError);
    }
  }

  const option = await locateVerticalOption();
  if (!option) {
    console.warn("未在下拉选项中找到“纵向”");
    return false;
  }

  try {
    await humanDelay();
    option.click();
    await humanDelay();
  } catch (error) {
    console.warn("点击“纵向”选项失败，尝试备用方式:", error);
    try {
      await humanDelay();
      option.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true })
      );
      await humanDelay();
    } catch (innerError) {
      console.error("备用方式点击“纵向”选项也失败:", innerError);
    }
  }

  const start = Date.now();
  while (Date.now() - start < 3000) {
    if (orientationKeywords.some((keyword) => readState().includes(keyword))) {
      return true;
    }
    await delay(120);
  }
  return false;
}

async function locateVerticalOption(timeout = 3000) {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    const options = Array.from(
      document.querySelectorAll('[role="option"]')
    ).filter(isVisibleElement);

    const vertical = options.find((option) => {
      const label = normalizeText(option.textContent || "");
      return label.includes("纵向") || label.includes("portrait");
    });

    if (vertical) {
      return vertical;
    }

    await delay(80);
  }

  return null;
}

async function waitForCropDialogClose(referenceElement, timeout = 6000) {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    if (!document.contains(referenceElement)) {
      return true;
    }

    if (!isVisibleElement(referenceElement)) {
      return true;
    }

    await delay(150);
  }

  console.warn("剪裁弹窗可能仍然存在，继续后续流程");
  return false;
}

async function waitForUploadComplete(context = {}, timeout = 180000) {
  const { container } = context;
  const start = Date.now();
  let uploadingVisibleOnce = false;

  while (Date.now() - start < timeout) {
    if (window.shouldStopProcessing) {
      console.log("检测到停止信号，停止等待上传完成");
      return;
    }

    const uploadingIndicators = Array.from(
      document.querySelectorAll("i, svg")
    )
      .filter(
        (icon) =>
          normalizeText(icon.textContent || "") === "progress_activity" &&
          isVisibleElement(icon)
      )
      .map((icon) => icon.closest("[role='alert'], [aria-live], div, span") || icon)
      .filter(Boolean);

    if (uploadingIndicators.length > 0) {
      uploadingVisibleOnce = true;
      console.log("检测到上传状态提示，继续等待...");
    }

    const hasFrameThumbnail = hasFirstFrameThumbnail(container);
    const hasPreview = hasUploadedPreview(container);

    if ((hasFrameThumbnail || hasPreview) && uploadingIndicators.length === 0) {
      console.log("检测到首帧缩略图，上传完成");
      return;
    }

    if (hasFrameThumbnail) {
      console.log("检测到帧缩略图，判定上传完成");
      return;
    }

    if (uploadingVisibleOnce && uploadingIndicators.length === 0 && hasPreview) {
      console.log("上传提示已消失并检测到预览，判定上传完成");
      return;
    }

    await delay(300);
  }

  throw new Error("等待图片上传完成超时，可能是网络异常");
}

async function enterPrompt(promptText) {
  const selectors = [
    "#PINHOLE_TEXT_AREA_ELEMENT_ID",
    'textarea[placeholder*="使用文本"]',
    'textarea[placeholder*="提示"]',
    "textarea",
    'div[contenteditable="true"]',
  ];

  let textarea = null;

  for (const selector of selectors) {
    const candidate = document.querySelector(selector);
    if (candidate && isVisibleElement(candidate)) {
      textarea = candidate;
      break;
    }
  }

  if (!textarea) {
    textarea = await waitForElement(
      '#PINHOLE_TEXT_AREA_ELEMENT_ID, textarea, div[contenteditable="true"]',
      5000
    );
  }

  if (!textarea) {
    throw new Error("未找到提示词输入框");
  }

  await humanDelay();
  textarea.focus();
  await humanDelay();

  if (textarea.getAttribute("contenteditable") === "true") {
    textarea.innerHTML = "";
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.textContent = promptText || "";
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  } else {
    textarea.value = "";
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.dispatchEvent(new Event("change", { bubbles: true }));

    await humanDelay();

    textarea.value = promptText || "";
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.dispatchEvent(new Event("change", { bubbles: true }));
    await humanDelay();
  }
  await humanDelay();
}

async function clickGenerateButton() {
  const normalize = (text = "") => text.replace(/\s+/g, "").toLowerCase();

  const allButtons = Array.from(
    document.querySelectorAll("button, [role='button']")
  ).filter((btn) => isVisibleElement(btn) && !btn.disabled);

  const iconMatchedButtons = Array.from(
    document.querySelectorAll("i, svg")
  )
    .filter((icon) => normalize(icon.textContent || "") === "arrow_forward")
    .map((icon) => icon.closest("button, [role='button']"))
    .filter((btn) => btn && isVisibleElement(btn) && !btn.disabled);

  const candidates = [...iconMatchedButtons, ...allButtons];

  const button =
    iconMatchedButtons[0] ||
    candidates.find((btn) => {
      const iconText = normalize(btn.querySelector?.("i, svg")?.textContent || "");
      return iconText === "arrow_forward";
    }) ||
    null;

  if (!button) {
    throw new Error("未找到生成/提交按钮");
  }

  await humanDelay();

  const overlay = button.querySelector("[data-type='button-overlay']");
  const primaryTarget =
    overlay && isVisibleElement(overlay) ? overlay : button;

  const triggerClick = (target) => {
    if (!target) {
      return false;
    }
    try {
      if (typeof target.click === "function") {
        target.click();
        return true;
      }
      target.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true })
      );
      return true;
    } catch (error) {
      console.warn("点击生成按钮失败，尝试备用方式:", error);
      return false;
    }
  };

  const clicked = triggerClick(primaryTarget);
  if (!clicked && primaryTarget !== button) {
    triggerClick(button);
  }

  await humanDelay();
  return true;
}

async function waitForElement(selector, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const checkElement = () => {
      // 检查是否应该停止
      if (window.shouldStopProcessing) {
        console.log("检测到停止信号，停止等待元素");
        resolve(null);
        return;
      }

      // 尝试多种方式查找元素
      let element = document.querySelector(selector);

      // 如果没找到，尝试更宽松的查找
      if (
        !element &&
        selector.includes(
          'textarea, input[type="text"], div[contenteditable="true"]'
        )
      ) {
        // 对于提示词输入框，使用更智能的查找
        const allInputs = document.querySelectorAll(
          'textarea, input[type="text"], div[contenteditable="true"]'
        );
        element = Array.from(allInputs).find((input) => {
          return (
            !input.closest("#flow-floating-window") &&
            input.offsetParent !== null &&
            input.offsetHeight > 0
          );
        });
      }

      if (element) {
        console.log("✅ waitForElement 找到元素:", element);
        resolve(element);
        return;
      }

      if (Date.now() - startTime > timeout) {
        reject(new Error(`元素 ${selector} 未找到`));
        return;
      }

      setTimeout(checkElement, 50);
    };

    checkElement();
  });
}

function delay(ms = 0) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function humanDelay(multiplier = 1) {
  const factor = (Number.isFinite(multiplier) && multiplier > 0) ? multiplier : 1;
  await delay(HUMAN_ACTION_DELAY * factor);
}

async function findElementByText(selectors, text, timeout = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const matches = findElementsByText(selectors, text).filter(
      isVisibleElement
    );
    if (matches.length > 0) {
      return matches[0];
    }
    await delay(100);
  }
  return null;
}

function findElementsByText(selectors, text) {
  if (!Array.isArray(selectors)) {
    selectors = [selectors];
  }
  const targets = Array.isArray(text)
    ? text.map(normalizeText).filter(Boolean)
    : [normalizeText(text)].filter(Boolean);
  const result = [];

  if (!targets.length) {
    return result;
  }

  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector);
    elements.forEach((element) => {
      if (element.closest("#flow-floating-window")) {
        return;
      }
      const elementText = normalizeText(element.textContent || "");
      if (!elementText) {
        return;
      }
      if (targets.some((target) => elementText.includes(target))) {
        result.push(element);
      }
    });
  }

  return result;
}

function normalizeText(text) {
  return (text || "").replace(/\s+/g, "").toLowerCase();
}

function isVisibleElement(element) {
  if (!element) {
    return false;
  }
  if (element.closest && element.closest("#flow-floating-window")) {
    return false;
  }

  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden") {
    return false;
  }
  if (parseFloat(style.opacity) === 0) {
    return false;
  }

  const rect = element.getBoundingClientRect();
  return rect.width > 1 && rect.height > 1;
}

async function findNearestFileInput(container, timeout = 3000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const input = locateFileInput(container);
    if (input) {
      return input;
    }
    await delay(100);
  }
  return null;
}

function locateFileInput(container) {
  const scopes = [];
  if (container instanceof Element) {
    let current = container;
    while (current) {
      scopes.push(current);
      current = current.parentElement;
    }
  }
  scopes.push(document.body);

  for (const scope of scopes) {
    if (!scope) continue;
    const inputs = Array.from(scope.querySelectorAll('input[type="file"]')).filter(
      (input) =>
        !input.disabled && !input.closest("#flow-floating-window")
    );
    if (!inputs.length) {
      continue;
    }

    const preferred =
      inputs.find((input) => {
        const accept = (input.getAttribute("accept") || "").toLowerCase();
        return (
          accept.includes("image") ||
          accept.includes(".png") ||
          accept.includes(".jpg") ||
          accept.includes(".jpeg") ||
          accept.includes(".webp") ||
          accept.includes(".heic")
        );
      }) || inputs[0];

    if (preferred) {
      return preferred;
    }
  }
  return null;
}

function hasUploadedPreview(container) {
  const scope = container instanceof Element ? container : document;
  const images = Array.from(scope.querySelectorAll("img")).filter(
    (img) => !img.closest("#flow-floating-window")
  );

  const hasVisibleImage = images.some((img) => {
    if (!isVisibleElement(img)) {
      return false;
    }
    if (img.naturalWidth > 50 && img.naturalHeight > 50) {
      return true;
    }
    const src = img.getAttribute("src") || "";
    return src.startsWith("blob:") || src.startsWith("data:");
  });

  if (hasVisibleImage) {
    return true;
  }

  const videos = Array.from(scope.querySelectorAll("video")).filter(
    (video) => !video.closest("#flow-floating-window") && isVisibleElement(video)
  );
  if (videos.length > 0) {
    return true;
  }

  const backgroundElements = Array.from(
    scope.querySelectorAll('[style*="background-image"]')
  ).filter(isVisibleElement);
  if (backgroundElements.length > 0) {
    return true;
  }

  const canvasElements = Array.from(scope.querySelectorAll("canvas")).filter(
    isVisibleElement
  );
  return canvasElements.length > 0;
}

function hasFirstFrameThumbnail(container) {
  const scope = container instanceof Element ? container : document;
  const buttons = Array.from(
    scope.querySelectorAll("button, [role='button']")
  ).filter(isVisibleElement);

  for (const button of buttons) {
    const label = getElementLabel(button);
    if (
      !label.includes("第一帧") &&
      !label.includes("首帧") &&
      !label.includes("firstframe")
    ) {
      continue;
    }

    if (button.querySelector("img")) {
      return true;
    }

    const style = window.getComputedStyle(button);
    if (style.backgroundImage && style.backgroundImage !== "none") {
      return true;
    }

    const preview = button.querySelector('[style*="background-image"]');
    if (preview) {
      return true;
    }
  }

  return false;
}

function dataURLtoFile(dataurl, filename) {
  const arr = dataurl.split(",");
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);

  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }

  return new File([u8arr], filename, { type: mime });
}

function getElementLabel(element) {
  if (!element) {
    return "";
  }
  const parts = [
    element.getAttribute?.("aria-label") || "",
    element.getAttribute?.("title") || "",
    element.dataset?.tooltip || "",
    element.dataset?.title || "",
    element.textContent || "",
    element.getAttribute?.("alt") || "",
  ];
  return normalizeText(parts.join(" "));
}

function locateFrameUploadTrigger(scope) {
  const searchRoot = scope instanceof Element ? scope : document;
  const buttons = Array.from(
    searchRoot.querySelectorAll('button, [role="button"]')
  ).filter(isVisibleElement);

  const keywords = [
    "add",
    "+",
    "添加帧",
    "添加",
    "上传帧",
    "上传首帧",
    "首帧",
  ].map(normalizeText);

  for (const button of buttons) {
    const label = getElementLabel(button);
    if (!label) continue;
    if (keywords.some((keyword) => label.includes(keyword))) {
      return button;
    }
    const iconText = normalizeText(
      button.querySelector?.("i, svg")?.textContent || ""
    );
    if (iconText && keywords.some((keyword) => iconText.includes(keyword))) {
      return button;
    }
  }

  return null;
}

function locateFrameWorkspace() {
  const textarea = document.getElementById("PINHOLE_TEXT_AREA_ELEMENT_ID");
  if (textarea) {
    const candidate =
      textarea.closest(".sc-2e289e88-0, .sc-2e289e88-1") || textarea.parentElement;
    if (candidate) {
      const frameContainer =
        candidate.querySelector(".sc-408537d4-0") ||
        candidate.querySelector(".sc-aa137585-0");
      if (frameContainer && isVisibleElement(frameContainer)) {
        return frameContainer;
      }
    }
  }

  const trigger = locateFrameUploadTrigger(document);
  if (trigger) {
    const containers = [
      trigger.closest(".sc-aa137585-0"),
      trigger.closest(".sc-408537d4-0"),
      trigger.closest("[data-radix-collection-item]"),
      trigger.closest("[role='group']"),
      trigger.parentElement,
    ];
    for (const container of containers) {
      if (container && isVisibleElement(container)) {
        return container;
      }
    }
  }

  return null;
}

function locateFrameDropZone(workspace) {
  const candidates = [];

  if (workspace instanceof Element) {
    candidates.push(
      workspace.closest(".sc-2e289e88-0"),
      workspace.closest(".sc-2e289e88-1"),
      workspace.closest(".sc-2e289e88-2"),
      workspace
    );
  }

  const textarea = document.getElementById("PINHOLE_TEXT_AREA_ELEMENT_ID");
  if (textarea) {
    candidates.push(
      textarea.closest(".sc-2e289e88-0"),
      textarea.closest(".sc-2e289e88-1"),
      textarea.closest(".sc-2e289e88-2"),
      textarea.parentElement
    );
  }

  candidates.push(
    document.querySelector(".sc-2e289e88-1"),
    document.querySelector(".sc-2e289e88-2"),
    document.querySelector(".sc-2e289e88-0"),
    document.querySelector(".sc-aa137585-0")
  );

  return candidates.find((element) => element && isVisibleElement(element)) || null;
}

function findFrameRemovalButtons(workspace) {
  const scope = workspace instanceof Element ? workspace : document;
  const candidates = Array.from(
    scope.querySelectorAll('button, [role="button"]')
  ).filter(isVisibleElement);

  const keywords = [
    "删除",
    "移除",
    "清除",
    "移除帧",
    "清理",
    "取消选择",
    "remove",
    "delete",
    "clear",
    "close",
    "×",
  ].map(normalizeText);

  return candidates.filter((button) => {
    const label = getElementLabel(button);
    if (label && keywords.some((keyword) => label.includes(keyword))) {
      return true;
    }
    const iconText = normalizeText(
      button.querySelector?.("i, svg")?.textContent || ""
    );
    return iconText && keywords.some((keyword) => iconText.includes(keyword));
  });
}

async function simulateFileDrop(target, file) {
  if (!(target instanceof Element)) {
    return false;
  }

  try {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);

    const fire = (type) => {
      let event;
      try {
        event = new DragEvent(type, {
          bubbles: true,
          cancelable: true,
          dataTransfer,
        });
      } catch (dragError) {
        event = new Event(type, { bubbles: true, cancelable: true });
        Object.defineProperty(event, "dataTransfer", {
          value: dataTransfer,
        });
      }
      target.dispatchEvent(event);
    };

    await humanDelay();
    fire("dragenter");
    await humanDelay();
    fire("dragover");
    await humanDelay();
    fire("drop");
    return true;
  } catch (error) {
    console.warn("模拟拖拽上传失败:", error);
    return false;
  }
}
