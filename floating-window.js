// 可移动悬浮窗口实现
class FloatingWindow {
  constructor() {
    this.isDragging = false;
    this.currentX = 0;
    this.currentY = 0;
    this.initialX = 0;
    this.initialY = 0;
    this.xOffset = 0;
    this.yOffset = 0;

    // 处理状态变量
    this.isProcessing = false;
    this.shouldStop = false;
    this.hasEnsuredFrameMode = Boolean(window.flowFrameModeEnsured);

    this.promptEntries = [];
    this.promptDetailModalId = "flow-prompt-detail-modal";
    this.promptDetailOverlay = null;
    this.clipboardSupported =
      typeof navigator !== "undefined" &&
      navigator.clipboard &&
      typeof navigator.clipboard.readText === "function";

    this.createFloatingWindow();
    this.cacheElements();
    this.loadSettings();
  }

  createFloatingWindow() {
    // 创建悬浮窗口容器
    this.window = document.createElement("div");
    this.window.id = "flow-floating-window";
    this.window.innerHTML = `
            <div class="floating-header">
                <span class="floating-title">Flow帧转视频助手</span>
                <div class="floating-controls">
                    <button class="floating-minimize" title="最小化" id="minimize-btn">−</button>
                    <button class="floating-close" title="关闭" id="close-btn">×</button>
                </div>
            </div>
            <div class="floating-content">
                <div class="form-group">
                    <label>选择图片文件夹 (可选):</label>
                    <input type="file" id="floating-folder-input" webkitdirectory directory multiple accept="image/*" style="display: none;">
                    <button id="floating-folder-btn" class="folder-btn">选择文件夹</button>
                    <div id="selected-folder" class="folder-info">未选择文件夹（将复用当前页面中的图片）</div>
                    <div id="folder-preview" class="folder-preview">
                        <div class="preview-placeholder">选择文件夹后将展示前3张图片预览</div>
                    </div>
                </div>
                
                <div class="form-group">
                    <label>镜头等待时间 (秒):</label>
                    <input type="number" id="floating-wait-time" value="3" min="3" max="30" class="wait-input">
                    <div class="speed-hint">建议设置3-15秒，避免操作过快导致网站提示</div>
                    <div id="orientation-indicator" class="orientation-indicator">当前裁剪方向：尚未检测</div>
                </div>
                
                <div class="form-group prompt-group">
                    <div class="prompt-header">
                        <label>提示词列表:</label>
                        <div class="prompt-actions">
                            <button type="button" id="paste-prompts-btn" class="paste-prompts-btn">粘贴提示词</button>
                            <button type="button" id="open-import-dialog" class="import-json-btn">导入 JSON</button>
                        </div>
                    </div>
                    <textarea id="floating-prompts" class="prompt-textarea" style="display:none;"></textarea>
                    <div id="prompt-list-note" class="prompt-list-note">提示词列表：点击每条提示词查看完整内容</div>
                    <div id="prompt-list" class="prompt-list"></div>
                </div>
                
                <div class="floating-actions">
                    <button id="floating-start-btn" class="action-btn primary">开始自动提交</button>
                    <button id="floating-clear-btn" class="action-btn secondary">清空提示词列表</button>
                </div>
                
                <div id="floating-steps" class="steps-display"></div>
                <div id="floating-status" class="status-message"></div>
            </div>
        `;

    // 添加样式
    this.addStyles();
    document.body.appendChild(this.window);

    // 绑定事件
    this.bindEvents();

    // 初始化最小化状态
    this.isMinimized = false;
  }

  addStyles() {
    const styleContent = `
            #flow-floating-window {
                position: fixed;
                top: 100px;
                right: 20px;
                width: 380px;
                background: #ffffff;
                border: none;
                border-radius: 16px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08);
                z-index: 10000;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                font-size: 14px;
                cursor: move;
                backdrop-filter: blur(10px);
                overflow: hidden;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            }

            .floating-header {
                background: linear-gradient(135deg, #f87171 0%, #ef4444 60%, #dc2626 100%);
                color: white;
                padding: 16px 20px;
                border-radius: 16px 16px 0 0;
                display: flex;
                justify-content: space-between;
                align-items: center;
                cursor: move;
                min-height: 48px;
                box-shadow: 0 2px 8px rgba(239, 68, 68, 0.25);
            }

            .floating-title {
                font-weight: 600;
                cursor: move;
                font-size: 15px;
                letter-spacing: 0.3px;
                text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
            }

            .floating-controls {
                display: flex;
                gap: 8px;
                align-items: center;
            }

            .floating-minimize, .floating-close {
                background: rgba(255, 255, 255, 0.15);
                border: none;
                color: white;
                font-size: 18px;
                cursor: pointer;
                padding: 0;
                width: 28px;
                height: 28px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                transition: all 0.2s ease;
                backdrop-filter: blur(10px);
            }

            .floating-minimize:hover, .floating-close:hover {
                background: rgba(255, 255, 255, 0.25);
                transform: scale(1.1);
            }

            .floating-close:hover {
                background: rgba(239, 68, 68, 0.9);
            }

            #flow-floating-window.minimized {
                height: auto !important;
                width: 280px !important;
            }

            #flow-floating-window.minimized .floating-content {
                display: none !important;
            }

            #flow-floating-window.minimized .floating-header {
                border-radius: 16px !important;
            }

            #flow-floating-window.minimized .floating-controls {
                margin-left: auto;
            }

            .floating-content {
                padding: 20px;
                cursor: default;
                background: #fff8f8;
            }

            .form-group {
                margin-bottom: 20px;
            }

            .form-group label {
                display: block;
                margin-bottom: 8px;
                font-weight: 600;
                color: #374151;
                font-size: 13px;
                letter-spacing: 0.3px;
            }

            .prompt-group {
                position: relative;
            }

            .prompt-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 12px;
            }

            .prompt-actions {
                display: flex;
                gap: 8px;
                align-items: center;
            }

            .prompt-actions button {
                padding: 6px 12px;
                border-radius: 8px;
                border: none;
                cursor: pointer;
                font-size: 12px;
                font-weight: 500;
                background: linear-gradient(135deg, #fca5a5 0%, #f87171 100%);
                color: white;
                transition: all 0.2s ease;
            }

            .prompt-actions button:hover {
                background: linear-gradient(135deg, #f87171 0%, #ef4444 100%);
                box-shadow: 0 4px 12px rgba(248, 113, 113, 0.35);
                transform: translateY(-1px);
            }

            .prompt-actions button:disabled {
                opacity: 0.6;
                cursor: not-allowed;
                box-shadow: none;
            }

            .folder-btn, .action-btn {
                width: 100%;
                padding: 12px 16px;
                border: none;
                border-radius: 10px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 500;
                transition: all 0.2s ease;
                letter-spacing: 0.3px;
            }

            .folder-btn {
                background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
                color: #7f1d1d;
                border: 2px solid #fecdd3;
            }

            .folder-btn:hover {
                background: linear-gradient(135deg, #fecaca 0%, #fca5a5 100%);
                border-color: #fca5a5;
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(239, 68, 68, 0.2);
            }

            .action-btn.primary {
                background: linear-gradient(135deg, #f87171 0%, #ef4444 100%);
                color: white;
                box-shadow: 0 4px 12px rgba(239, 68, 68, 0.35);
            }

            .action-btn.primary:hover {
                background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
                transform: translateY(-2px);
                box-shadow: 0 6px 16px rgba(239, 68, 68, 0.45);
            }

            .action-btn.secondary {
                background: linear-gradient(135deg, #fecaca 0%, #f87171 100%);
                color: white;
                margin-top: 8px;
                box-shadow: 0 4px 12px rgba(248, 113, 113, 0.35);
            }

            .action-btn.secondary:hover {
                background: linear-gradient(135deg, #f87171 0%, #ef4444 100%);
                transform: translateY(-2px);
                box-shadow: 0 6px 16px rgba(248, 113, 113, 0.45);
            }

            .wait-input, .prompt-textarea {
                width: 100%;
                padding: 10px 14px;
                border: 2px solid #e5e7eb;
                border-radius: 10px;
                font-size: 14px;
                box-sizing: border-box;
                color: #1f2937;
                transition: all 0.2s ease;
                font-family: inherit;
            }

            .wait-input:focus, .prompt-textarea:focus {
                outline: none;
                border-color: #ef4444;
                box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.15);
            }

            .speed-hint {
                font-size: 12px;
                color: #991b1b;
                margin-top: 6px;
                line-height: 1.5;
            }

            .orientation-indicator {
                margin-top: 8px;
                font-size: 12px;
                color: #7f1d1d;
                background: #fff5f5;
                border: 1px dashed #fca5a5;
                border-radius: 8px;
                padding: 6px 10px;
                line-height: 1.4;
            }

            .orientation-indicator.vertical {
                background: #dcfce7;
                border-color: #22c55e;
                color: #166534;
            }

            .orientation-indicator.horizontal {
                background: #fff7ed;
                border-color: #f97316;
                color: #9a3412;
            }

            .wait-input {
                height: 40px;
            }

            .prompt-textarea {
                height: 90px;
                resize: vertical;
                line-height: 1.5;
            }

            .prompt-list-note {
                margin-top: 10px;
                font-size: 12px;
                color: #b91c1c;
                background: #fee2e2;
                border: 1px solid #fca5a5;
                border-radius: 8px;
                padding: 8px 12px;
            }

            .prompt-list {
                margin-top: 10px;
                display: flex;
                flex-direction: column;
                gap: 8px;
                max-height: 200px;
                overflow-y: auto;
            }

            .prompt-list::-webkit-scrollbar {
                width: 6px;
            }

            .prompt-list::-webkit-scrollbar-track {
                background: #fee2e2;
                border-radius: 3px;
            }

            .prompt-list::-webkit-scrollbar-thumb {
                background: #fca5a5;
                border-radius: 3px;
            }

            .prompt-item {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 10px 12px;
                border-radius: 10px;
                background: linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%);
                border: 1px solid #fca5a5;
                cursor: pointer;
                transition: all 0.2s ease;
            }

            .prompt-item:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 14px rgba(248, 113, 113, 0.35);
            }

            .prompt-item.pending {
                opacity: 0.9;
            }

            .prompt-item.processing {
                box-shadow: 0 0 0 2px rgba(248, 113, 113, 0.45);
                border-color: #f87171;
                background: linear-gradient(135deg, #fee2e2 0%, #fecdd3 100%);
            }

            .prompt-item.completed {
                border-color: #22c55e;
                background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
            }

            .prompt-item.error {
                border-color: #ef4444;
                background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
                box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.35);
            }

            .prompt-index {
                width: 32px;
                height: 32px;
                border-radius: 50%;
                background: linear-gradient(135deg, #f97316 0%, #ef4444 100%);
                color: white;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: 600;
                font-size: 13px;
            }

            .prompt-preview {
                flex: 1;
                color: #7f1d1d;
                font-size: 12px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .prompt-empty {
                font-size: 12px;
                color: #991b1b;
                text-align: center;
                padding: 12px;
                background: #fff5f5;
                border: 1px dashed #fca5a5;
                border-radius: 8px;
            }

            .flow-modal {
                position: fixed;
                inset: 0;
                background: rgba(0, 0, 0, 0.55);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 20000;
                padding: 24px;
            }

            .flow-modal-content {
                background: #ffffff;
                border-radius: 16px;
                width: min(720px, 90vw);
                max-height: 80vh;
                overflow: hidden;
                display: flex;
                flex-direction: column;
                box-shadow: 0 18px 45px rgba(0, 0, 0, 0.25);
            }

            .flow-modal-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 16px 20px;
                background: linear-gradient(135deg, #f87171 0%, #ef4444 100%);
                color: white;
                font-weight: 600;
            }

            .flow-modal-close {
                background: rgba(255, 255, 255, 0.2);
                border: none;
                color: white;
                font-size: 20px;
                width: 32px;
                height: 32px;
                border-radius: 50%;
                cursor: pointer;
                transition: all 0.2s ease;
            }

            .flow-modal-close:hover {
                background: rgba(255, 255, 255, 0.35);
            }

            .flow-modal-body {
                margin: 0;
                padding: 18px 20px 24px;
                font-size: 13px;
                color: #111827;
                background: #fff8f8;
                overflow: auto;
                white-space: pre-wrap;
                word-break: break-word;
            }

            .flow-import-body {
                padding: 18px 20px 24px;
                background: #fff8f8;
                display: flex;
                flex-direction: column;
                gap: 12px;
            }

            .flow-import-body textarea {
                width: 100%;
                min-height: 180px;
                resize: vertical;
                padding: 12px;
                border-radius: 12px;
                border: 2px solid #fecaca;
                font-family: "JetBrains Mono", "Fira Code", Consolas, monospace;
                font-size: 12px;
                background: #ffffff;
                color: #111827;
                line-height: 1.5;
                box-sizing: border-box;
            }

            .flow-import-body textarea:focus {
                outline: none;
                border-color: #ef4444;
                box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.2);
            }

            .flow-import-actions {
                display: flex;
                flex-wrap: wrap;
                gap: 10px;
                justify-content: space-between;
                align-items: center;
                margin-top: 4px;
            }

            .flow-import-actions-left,
            .flow-import-actions-right {
                display: flex;
                gap: 10px;
                align-items: center;
            }

            .flow-import-actions button {
                padding: 8px 16px;
                border-radius: 10px;
                border: none;
                cursor: pointer;
                font-size: 13px;
                font-weight: 500;
                color: white;
                background: linear-gradient(135deg, #fca5a5 0%, #f87171 100%);
                transition: all 0.2s ease;
            }

            .flow-import-actions button:hover {
                background: linear-gradient(135deg, #f87171 0%, #ef4444 100%);
                box-shadow: 0 4px 12px rgba(248, 113, 113, 0.35);
                transform: translateY(-1px);
            }

            .flow-import-actions .secondary {
                background: linear-gradient(135deg, #c4b5fd 0%, #a855f7 100%);
            }

            .flow-import-actions .secondary:hover {
                background: linear-gradient(135deg, #a855f7 0%, #9333ea 100%);
                box-shadow: 0 4px 12px rgba(147, 51, 234, 0.35);
            }

            .flow-import-message {
                font-size: 12px;
                border-radius: 8px;
                padding: 8px 10px;
                display: none;
            }

            .flow-import-message.error {
                color: #b91c1c;
                background: #fee2e2;
                border: 1px solid #fca5a5;
            }

            .flow-import-message.success {
                color: #166534;
                background: #dcfce7;
                border: 1px solid #86efac;
            }

            .folder-info {
                margin-top: 8px;
                font-size: 12px;
                color: #7f1d1d;
                word-break: break-all;
                padding: 8px 12px;
                background: #fff1f2;
                border-radius: 8px;
                border-left: 3px solid #ef4444;
            }

            .folder-preview {
                margin-top: 10px;
                padding: 12px;
                background: linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%);
                border: 2px dashed #fca5a5;
                border-radius: 10px;
                transition: all 0.2s ease;
            }

            .folder-preview-title {
                font-size: 12px;
                color: #b91c1c;
                margin-bottom: 8px;
                font-weight: 600;
                letter-spacing: 0.3px;
            }

            .preview-placeholder {
                font-size: 12px;
                color: #b91c1c;
                text-align: center;
                padding: 8px;
            }

            .preview-list {
                display: flex;
                gap: 10px;
                justify-content: center;
            }

            .preview-item {
                display: flex;
                flex-direction: column;
                align-items: center;
                width: 75px;
                font-size: 11px;
                color: #6b7280;
                text-align: center;
                gap: 6px;
            }

            .preview-item img {
                width: 100%;
                height: 55px;
                object-fit: cover;
                border-radius: 8px;
                border: 2px solid #fca5a5;
                box-shadow: 0 2px 8px rgba(239, 68, 68, 0.15);
            }

            .preview-name {
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                width: 100%;
                font-weight: 500;
            }

            .floating-actions {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .status-message {
                margin-top: 12px;
                padding: 12px 16px;
                border-radius: 10px;
                font-size: 13px;
                display: none;
                white-space: pre-line;
                line-height: 1.6;
                border-left: 4px solid;
            }

            .status-message.success {
                background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
                color: #9f1239;
                border-color: #ef4444;
            }

            .status-message.error {
                background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
                color: #991b1b;
                border-color: #ef4444;
            }

            .status-message.info {
                background: linear-gradient(135deg, #ffe4e6 0%, #fecdd3 100%);
                color: #b91c1c;
                border-color: #f87171;
            }

            .steps-display {
                margin-top: 12px;
                padding: 12px;
                background: #fff5f5;
                border: 2px solid #fee2e2;
                border-radius: 10px;
                font-size: 12px;
                display: none;
                max-height: 120px;
                overflow-y: auto;
            }

            .steps-display::-webkit-scrollbar {
                width: 6px;
            }

            .steps-display::-webkit-scrollbar-track {
                background: #f3f4f6;
                border-radius: 3px;
            }

            .steps-display::-webkit-scrollbar-thumb {
                background: #fca5a5;
                border-radius: 3px;
            }

            .steps-display::-webkit-scrollbar-thumb:hover {
                background: #f87171;
            }

            .steps-display.show {
                display: block;
            }

            .step-item {
                margin: 4px 0;
                padding: 6px 12px;
                border-left: 3px solid #e5e7eb;
                background: white;
                border-radius: 6px;
                transition: all 0.2s ease;
            }

            .step-item.pending {
                border-left-color: #fecaca;
                color: #fca5a5;
            }

            .step-item.current {
                border-left-color: #ef4444;
                font-weight: 600;
                color: #b91c1c;
                background: #fee2e2;
                box-shadow: 0 2px 4px rgba(239, 68, 68, 0.2);
            }

            .step-item.completed {
                border-left-color: #ef4444;
                color: #b91c1c;
                font-weight: 500;
            }

            .step-item.error {
                border-left-color: #ef4444;
                color: #dc2626;
                font-weight: 600;
                background: #fef2f2;
            }
        `;

    let style = document.querySelector("#flow-floating-styles");
    if (!style) {
      style = document.createElement("style");
      style.id = "flow-floating-styles";
      document.head.appendChild(style);
    }

    style.textContent = styleContent;
  }

  cacheElements() {
    this.promptsTextarea = this.window.querySelector("#floating-prompts");
    this.promptListEl = this.window.querySelector("#prompt-list");
    this.promptListNote = this.window.querySelector("#prompt-list-note");
    this.orientationIndicator = this.window.querySelector("#orientation-indicator");
  }

  bindEvents() {
    const header = this.window.querySelector(".floating-header");
    const closeBtn = this.window.querySelector("#close-btn");
    const minimizeBtn = this.window.querySelector("#minimize-btn");
    const folderBtn = this.window.querySelector("#floating-folder-btn");
    const folderInput = this.window.querySelector("#floating-folder-input");
    const startBtn = this.window.querySelector("#floating-start-btn");
    const clearBtn = this.window.querySelector("#floating-clear-btn");
    const pasteBtn = this.window.querySelector("#paste-prompts-btn");
    const importJsonBtn = this.window.querySelector("#open-import-dialog");
    const promptList = this.promptListEl;

    // 拖拽功能
    header.addEventListener("mousedown", this.dragStart.bind(this));
    document.addEventListener("mousemove", this.drag.bind(this));
    document.addEventListener("mouseup", this.dragEnd.bind(this));

    // 最小化按钮
    minimizeBtn.addEventListener("click", () => {
      this.toggleMinimize();
    });

    // 关闭按钮
    closeBtn.addEventListener("click", () => {
      this.hide();
    });

    // 文件夹选择
    folderBtn.addEventListener("click", () => {
      folderInput.click();
    });

    folderInput.addEventListener("change", (e) => {
      this.handleFolderSelection(e.target.files);
    });

    // 开始按钮
    startBtn.addEventListener("click", () => {
      if (this.isProcessing) {
        // 如果正在处理，则停止
        this.shouldStop = true;
        window.shouldStopProcessing = true; // 设置全局停止信号
        this.showStatus("正在停止处理...", "info");
      } else {
        // 如果未在处理，则开始处理
        window.shouldStopProcessing = false; // 清除停止信号
        this.startProcessing();
      }
    });

    // 清空按钮
    clearBtn.addEventListener("click", () => {
      this.clearAll();
    });

    if (pasteBtn) {
      if (!this.clipboardSupported) {
        pasteBtn.disabled = true;
        pasteBtn.title = "浏览器不支持直接读取剪贴板，请使用导入 JSON";
        pasteBtn.style.opacity = "0.6";
        pasteBtn.style.cursor = "not-allowed";
      } else {
        pasteBtn.addEventListener("click", () => {
          this.handlePastePrompts();
        });
      }
    }

    if (importJsonBtn) {
      importJsonBtn.addEventListener("click", () => {
        this.openJsonImportModal();
      });
    }

    if (promptList) {
      promptList.addEventListener("click", (event) => {
        const item = event.target.closest(".prompt-item");
        if (!item) return;
        event.preventDefault();
        event.stopPropagation();
        const index = Number(item.dataset.index);
        if (!Number.isNaN(index)) {
          this.showPromptModal(index);
        }
      });
    }

    // 保存设置
    this.window.querySelector("#floating-wait-time").addEventListener("change", () => {
      this.saveSettings();
    });

    // 监听步骤更新事件
    document.addEventListener("updateStep", (e) => {
      if (this.isProcessing) {
        this.updateStep(e.detail.stepIndex, e.detail.status);
      }
    });

    document.addEventListener("flowOrientationDetected", (e) => {
      const orientation = e.detail?.orientation || null;
      this.updateOrientationIndicator(orientation);
    });
  }

  dragStart(e) {
    if (e.target.classList.contains("floating-close")) return;

    this.initialX = e.clientX - this.xOffset;
    this.initialY = e.clientY - this.yOffset;

    if (e.target.closest(".floating-header")) {
      this.isDragging = true;
    }
  }

  drag(e) {
    if (this.isDragging) {
      e.preventDefault();
      this.currentX = e.clientX - this.initialX;
      this.currentY = e.clientY - this.initialY;

      this.xOffset = this.currentX;
      this.yOffset = this.currentY;

      this.window.style.transform = `translate3d(${this.currentX}px, ${this.currentY}px, 0)`;
    }
  }

  dragEnd(e) {
    this.initialX = this.currentX;
    this.initialY = this.currentY;
    this.isDragging = false;
  }

  async handleFolderSelection(files) {
    // 筛选图片文件
    const imageFiles = Array.from(files).filter(
      (file) =>
        file.type.startsWith("image/") &&
        /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(file.name)
    );

    if (imageFiles.length > 0) {
      const folderName = files[0].webkitRelativePath.split("/")[0];
      this.window.querySelector(
        "#selected-folder"
      ).textContent = `已选择: ${folderName} (${imageFiles.length}张图片, 共${files.length}个文件)`;

      // 保存筛选后的图片文件
      this.imageFiles = imageFiles;
      await this.renderFolderPreview(imageFiles);
      this.saveSettings();
    } else {
      this.window.querySelector("#selected-folder").textContent =
        "未找到图片文件，将仅提交提示词";
      this.imageFiles = [];
      this.renderFolderPreview([]);
    }
  }

  async renderFolderPreview(imageFiles = []) {
    const previewContainer = this.window.querySelector("#folder-preview");
    if (!previewContainer) {
      return;
    }

    if (!imageFiles || imageFiles.length === 0) {
      previewContainer.innerHTML =
        '<div class="preview-placeholder">选择文件夹后将展示前3张图片预览</div>';
      return;
    }

    previewContainer.innerHTML =
      '<div class="preview-placeholder">正在加载预览...</div>';
    const fragment = document.createDocumentFragment();

    const title = document.createElement("div");
    title.className = "folder-preview-title";
    title.textContent = "图片预览（前3张）";
    fragment.appendChild(title);

    const list = document.createElement("div");
    list.className = "preview-list";

    const previewFiles = imageFiles.slice(0, 3);
    const previews = await Promise.all(
      previewFiles.map(async (file) => {
        try {
          const dataUrl = await this.fileToDataURL(file);
          return { file, dataUrl };
        } catch (error) {
          console.warn(`加载预览失败: ${file.name}`, error);
          return null;
        }
      })
    );

    let hasPreview = false;
    previews.forEach((preview) => {
      if (!preview) return;
      hasPreview = true;
      const item = document.createElement("div");
      item.className = "preview-item";

      const img = document.createElement("img");
      img.src = preview.dataUrl;
      img.alt = preview.file.name;

      const caption = document.createElement("div");
      caption.className = "preview-name";
      caption.textContent = preview.file.name;

      item.appendChild(img);
      item.appendChild(caption);
      list.appendChild(item);
    });

    if (!hasPreview) {
      previewContainer.innerHTML =
        '<div class="preview-placeholder">图片预览加载失败，请检查文件格式</div>';
      return;
    }

    fragment.appendChild(list);
    previewContainer.innerHTML = "";
    previewContainer.appendChild(fragment);
  }

  async startProcessing() {
    const files = Array.isArray(this.imageFiles) ? Array.from(this.imageFiles) : [];
    const waitTime =
      parseInt(this.window.querySelector("#floating-wait-time").value) || 3;

    // 记录开始处理时的提示词内容
    console.log(
      "开始处理时的提示词列表:",
      this.promptEntries.map((entry) => entry.raw).join("\n---\n")
    );

    const prompts = this.promptEntries.map((entry) => entry.raw);
    this.closeImportModal();

    if (prompts.length === 0) {
      this.showStatus("请先导入或粘贴提示词", "error");
      return;
    }

    const hasImages = files.length > 0;
    let sortedFiles = hasImages
      ? Array.from(files).sort((a, b) => {
          const aNum = parseInt(a.name.match(/\d+/)?.[0] || "0");
          const bNum = parseInt(b.name.match(/\d+/)?.[0] || "0");
          return aNum - bNum;
        })
      : [];

    let promptsForProcessing = prompts.slice();

    if (hasImages && sortedFiles.length !== promptsForProcessing.length) {
      const confirmed = confirm(
        `图片数量 (${sortedFiles.length}) 与提示词数量 (${promptsForProcessing.length}) 不一致。\n` +
          `图片：${sortedFiles.length} 张\n` +
          `提示词：${promptsForProcessing.length} 个\n\n` +
          `是否继续？系统将按较少数量处理。`
      );

      if (!confirmed) {
        return;
      }

      const minCount = Math.min(sortedFiles.length, promptsForProcessing.length);
      sortedFiles = sortedFiles.slice(0, minCount);
      promptsForProcessing = promptsForProcessing.slice(0, minCount);
      this.setPromptEntries(this.promptEntries.slice(0, minCount));
      this.saveSettings();
    }

    const tasks = hasImages
      ? sortedFiles.map((file, index) => ({
          file,
          prompt: promptsForProcessing[index],
        }))
      : promptsForProcessing.map((prompt) => ({
          file: null,
          prompt,
        }));

    if (!tasks.length) {
      this.showStatus("没有可处理的任务，请检查提示词或图片选择", "error");
      return;
    }

    // 更新内部文件列表，保持与任务数量一致
    if (hasImages) {
      this.imageFiles = tasks.map((task) => task.file);
    }

    // 设置处理状态
    this.isProcessing = true;
    this.shouldStop = false;
    window.shouldStopProcessing = false; // 清除停止信号
    this.resetPromptStatuses();

    if (!hasImages) {
      this.showStatus("未选择图片文件夹，将复用当前页面中的参考图片并按提示词提交。", "info");
    }

    // 显示处理步骤
    const processingSteps = [
      { text: "检查帧转视频模式", status: "pending" },
      { text: "准备处理任务", status: "pending" },
      { text: "确认页面就绪", status: "pending" },
      { text: "管理参考图片", status: "pending" },
      { text: "上传或确认参考图片", status: "pending" },
      { text: "确认图片已准备", status: "pending" },
      { text: "输入提示词", status: "pending" },
      { text: "点击生成按钮", status: "pending" },
      { text: "等待生成开始", status: "pending" },
    ];
    this.showSteps(processingSteps);
    this.updateStep(0, "current");

    if (hasImages) {
      this.hasEnsuredFrameMode =
        this.hasEnsuredFrameMode || Boolean(window.flowFrameModeEnsured);
      if (!this.hasEnsuredFrameMode) {
        const frameModeResult = await this.ensureFrameMode({ force: false });
        if (frameModeResult.success) {
          this.updateStep(0, "completed");
          this.hasEnsuredFrameMode = true;
        } else {
          this.updateStep(0, "error");
          this.showStatus(frameModeResult.message || "未能确认帧转视频模式状态", "error");
        }
      } else {
        this.updateStep(0, "completed");
      }
    } else {
      this.updateStep(0, "completed");
      this.updateOrientationIndicator(null);
    }

    try {
      const startBtn = this.window.querySelector("#floating-start-btn");
      startBtn.disabled = false;
      startBtn.textContent = "停止处理";
      startBtn.className = "action-btn secondary"; // 改为红色停止按钮样式

      let completedCount = 0;
      const totalCount = tasks.length;

      for (let i = 0; i < tasks.length; i++) {
        this.resetSteps(true);
        this.updateStep(1, "current");
        // 检查是否应该停止
        if (this.shouldStop) {
          if (this.promptEntries[i] && this.promptEntries[i].status === "processing") {
            this.setPromptStatus(i, "pending");
          }
          this.showStatus("处理已停止", "info");
          break;
        }

        const task = tasks[i];
        const file = task.file;
        const prompt = task.prompt;

        this.setPromptStatus(i, "processing");

        try {
          const previewText = this.formatPromptPreview(this.promptEntries[i], i);
          const taskLabel = file ? `任务图片: ${file.name}` : "任务提示词（无新图片）";
          this.showStatus(
            `正在处理第${i + 1}个任务\n${taskLabel}\n提示词: ${previewText}`,
            "info"
          );

          // 发送到content script处理
          const imageData = file ? await this.fileToDataURL(file) : null;
          await this.processImage(
            file,
            prompt,
            i + 1,
            totalCount,
            waitTime * 1000,
            imageData
          );

          console.log(`第${i + 1}个任务处理成功`);
          this.setPromptStatus(i, "completed");
          completedCount++;
        } catch (error) {
          console.error(`第${i + 1}个任务处理失败:`, error);
          this.showStatus(
            `第${i + 1}个任务处理失败: ${error.message}`,
            "error"
          );
          this.setPromptStatus(i, "error");
          // 继续处理下一个任务，不中断整个流程
          if (
            error?.message &&
            (error.message.includes("上传完成超时") ||
              error.message.includes("网络异常"))
          ) {
            this.shouldStop = true;
            window.shouldStopProcessing = true;
            this.showNetworkErrorNotification(error.message);
            break;
          }
        }

        // 检查是否应该停止
        if (this.shouldStop) {
          this.showStatus("处理已停止", "info");
          break;
        }

        // 等待一段时间确保生成任务稳定开始，然后处理下一个任务
        console.log(`等待${waitTime}秒后处理下一个任务...`);
        await new Promise((resolve) => setTimeout(resolve, waitTime * 1000));
      }

      // 等待所有任务真正完成
      if (!this.shouldStop) {
        this.showStatus("等待所有任务完成...", "info");

        // 等待额外的时间确保所有任务都真正提交
        await new Promise((resolve) => setTimeout(resolve, waitTime * 1000));

        this.showStatus(
          `所有任务处理完成！已处理 ${completedCount}/${totalCount} 个任务`,
          "success"
        );
        // 任务完成提示
        this.showCompleteNotification(completedCount);
      }
    } catch (error) {
      console.error("处理错误:", error);
      this.showStatus(`处理失败: ${error.message}`, "error");
    } finally {
      // 记录处理完成后的提示词框内容
      console.log(
        "处理完成后的提示词列表:",
        this.promptEntries.map((entry) => entry.raw).join("\n---\n")
      );

      // 重置按钮状态
      const startBtn = this.window.querySelector("#floating-start-btn");
      startBtn.disabled = false;
      startBtn.textContent = "开始自动提交";
      startBtn.className = "action-btn primary"; // 恢复开始按钮样式
      this.isProcessing = false;
      this.shouldStop = false;
      window.shouldStopProcessing = false; // 清除停止信号

      // 隐藏步骤显示
      this.hideSteps();
    }
  }

  async processImage(file, prompt, index, total, waitTime, imageData) {
    return new Promise((resolve, reject) => {
      // 检查是否应该停止
      if (this.shouldStop) {
        resolve();
        return;
      }

      const hasImage = Boolean(file && imageData);
      // 创建自定义事件来处理图片
      const event = new CustomEvent("processFlowImage", {
        detail: {
          imageFile: hasImage ? { name: file.name, dataUrl: imageData } : null,
          prompt: prompt,
          index: index,
          total: total,
          waitTime: waitTime,
          hasImage,
        },
      });

      document.dispatchEvent(event);

      let timeoutId;

      // 监听处理完成
      const handler = (e) => {
          if (e.detail.index === index) {
            clearTimeout(timeoutId);
            document.removeEventListener("flowImageProcessed", handler);
            if (e.detail.success) {
            console.log(`第${index}个任务处理成功`);
            resolve();
          } else {
            console.error(`第${index}个任务处理失败:`, e.detail.error);
            reject(new Error(e.detail.error || "任务处理失败"));
          }
        }
      };

      document.addEventListener("flowImageProcessed", handler);

      // 超时处理 - 超过3分钟仍未完成视为失败
      timeoutId = setTimeout(() => {
        document.removeEventListener("flowImageProcessed", handler);
        console.warn(`第${index}个任务处理超时，可能是网络异常`);
        reject(new Error(`第${index}个任务处理超时，可能是网络异常`));
      }, waitTime + 180000);
    });
  }

  fileToDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsText(file, "utf-8");
    });
  }

  showCompleteNotification(totalTasks) {
    this.ensureNotificationStyles();

    // 避免重复弹窗
    const existing = document.querySelector("#flow-complete-notification");
    if (existing) {
      existing.remove();
    }

    const notification = document.createElement("div");
    notification.id = "flow-complete-notification";
    notification.innerHTML = `
            <div class="notification-overlay">
                <div class="notification-content success">
                    <div class="notification-icon">🎉</div>
                    <div class="notification-title">任务完成！</div>
                    <div class="notification-message">
                        已成功提交 ${totalTasks} 个生成任务
                        <br>
                        请前往 Flow 帧转视频页面查看生成结果
                        <br>
                        <small>注意：任务可能需要几分钟时间才能完全处理完成</small>
                    </div>
                    <button class="notification-close" onclick="this.parentElement.parentElement.remove()">知道了</button>
                </div>
            </div>
        `;

    document.body.appendChild(notification);

    // 播放完成音效
    this.playCompleteSound();

    // 3秒后自动关闭
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 5000);
  }

  showNetworkErrorNotification(message = "检测到网络异常，请检查后重试") {
    // 若已有错误通知，先移除避免堆叠
    const existing = document.querySelector("#flow-error-notification");
    if (existing) {
      existing.remove();
    }

    this.ensureNotificationStyles();

    const notification = document.createElement("div");
    notification.id = "flow-error-notification";
    notification.innerHTML = `
            <div class="notification-overlay">
                <div class="notification-content error">
                    <div class="notification-icon">⚠️</div>
                    <div class="notification-title">网络可能异常</div>
                    <div class="notification-message">
                        ${message || "请检查网络连接状态后重新尝试"}
                    </div>
                    <button class="notification-close" onclick="this.parentElement.parentElement.remove()">知道了</button>
                </div>
            </div>
        `;

    document.body.appendChild(notification);
  }

  ensureNotificationStyles() {
    if (document.querySelector("#flow-notification-styles")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "flow-notification-styles";
    style.textContent = `
            #flow-complete-notification,
            #flow-error-notification {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 100000;
                font-family: Arial, sans-serif;
            }

            .notification-overlay {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .notification-content {
                background: white;
                padding: 30px;
                border-radius: 10px;
                text-align: center;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                max-width: 400px;
                margin: 20px;
                animation: notificationPop 0.3s ease-out;
            }

            .notification-content.error {
                border: 2px solid #f97316;
            }

            .notification-content.success {
                border: 2px solid transparent;
            }

            @keyframes notificationPop {
                0% { transform: scale(0.7); opacity: 0; }
                100% { transform: scale(1); opacity: 1; }
            }

            .notification-icon {
                font-size: 48px;
                margin-bottom: 15px;
            }

            .notification-title {
                font-size: 24px;
                font-weight: bold;
                color: #16a34a;
                margin-bottom: 10px;
            }

            .notification-content.error .notification-title {
                color: #dc2626;
            }

            .notification-message {
                font-size: 16px;
                color: #666;
                margin-bottom: 20px;
                line-height: 1.5;
            }

            .notification-close {
                background: #22c55e;
                color: white;
                border: none;
                padding: 10px 30px;
                border-radius: 5px;
                font-size: 16px;
                cursor: pointer;
                transition: background-color 0.3s;
            }

            .notification-content.error .notification-close {
                background: #dc2626;
            }

            .notification-close:hover {
                background: #15803d;
            }

            .notification-content.error .notification-close:hover {
                background: #b91c1c;
            }
        `;

    document.head.appendChild(style);
  }

  playCompleteSound() {
    // 创建音频上下文和音效
    try {
      const audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();

      // 创建成功提示音效
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5音符
      oscillator.frequency.setValueAtTime(
        659.25,
        audioContext.currentTime + 0.1
      ); // E5音符
      oscillator.frequency.setValueAtTime(
        783.99,
        audioContext.currentTime + 0.2
      ); // G5音符

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        audioContext.currentTime + 0.5
      );

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
      console.log("无法播放音效:", error);
      // 备用：使用系统提示音
      const audio = new Audio(
        "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmFgU7k9n1unEiBC13yO/eizEIHWq+8+OWT"
      );
      audio.play().catch(() => {});
    }
  }

  clearAll() {
    this.clearPromptEntries();
    this.closeImportModal();
    this.hideStatus();
  }

  updateOrientationIndicator(orientation) {
    const indicator = this.orientationIndicator;
    if (!indicator) {
      return;
    }

    indicator.classList.remove("vertical", "horizontal");

    if (orientation === "纵向") {
      indicator.textContent = "当前裁剪方向：纵向";
      indicator.classList.add("vertical");
    } else if (orientation === "横向") {
      indicator.textContent = "当前裁剪方向：横向";
      indicator.classList.add("horizontal");
    } else {
      indicator.textContent = "当前裁剪方向：尚未检测";
    }
  }

  showStatus(message, type) {
    const status = this.window.querySelector("#floating-status");
    status.textContent = message;
    status.className = `status-message ${type}`;
    status.style.display = "block";

    if (type === "success") {
      setTimeout(() => this.hideStatus(), 3000);
    }
  }

  hideStatus() {
    const status = this.window.querySelector("#floating-status");
    status.style.display = "none";
  }

  showSteps(steps) {
    const stepsContainer = this.window.querySelector("#floating-steps");
    if (!steps || steps.length === 0) {
      stepsContainer.style.display = "none";
      return;
    }

    stepsContainer.innerHTML = steps
      .map((step) => {
        let className = "step-item";
        if (step.status) {
          className += ` ${step.status}`;
        }
        return `<div class="${className}">${step.text}</div>`;
      })
      .join("");

    stepsContainer.style.display = "block";
    stepsContainer.classList.add("show");
  }

  hideSteps() {
    const stepsContainer = this.window.querySelector("#floating-steps");
    stepsContainer.style.display = "none";
    stepsContainer.classList.remove("show");
  }

  async handlePastePrompts() {
    if (!this.clipboardSupported) {
      this.showStatus("当前环境不支持直接读取剪贴板，请手动导入 JSON", "error");
      return;
    }
    try {
      const text = await navigator.clipboard.readText();
      if (!text || !text.trim()) {
        this.showStatus("剪贴板暂无可用内容，请先复制提示词", "error");
        return;
      }
      const entries = this.createEntriesFromText(text);
      if (!entries.length) {
        this.showStatus("未解析到有效提示词，请检查内容格式", "error");
        return;
      }
      this.setPromptEntries(entries);
      this.saveSettings();
      this.showStatus(`已粘贴 ${entries.length} 条提示词`, "success");
    } catch (error) {
      console.error("读取剪贴板失败:", error);
      this.showStatus("无法读取剪贴板，请确认已授权或手动导入 JSON", "error");
    }
  }

  openJsonImportModal() {
    this.closeImportModal();

    const overlay = document.createElement("div");
    overlay.className = "flow-modal";
    overlay.dataset.modal = "prompt-import";

    const content = document.createElement("div");
    content.className = "flow-modal-content";

    const header = document.createElement("div");
    header.className = "flow-modal-header";
    header.textContent = "导入 JSON 提示词";

    const closeBtn = document.createElement("button");
    closeBtn.className = "flow-modal-close";
    closeBtn.type = "button";
    closeBtn.textContent = "×";
    closeBtn.setAttribute("aria-label", "关闭");
    header.appendChild(closeBtn);

    const body = document.createElement("div");
    body.className = "flow-import-body";

    const textarea = document.createElement("textarea");
    textarea.placeholder = "粘贴 JSON 数组内容，或点击下方按钮选择 JSON 文件";

    const message = document.createElement("div");
    message.className = "flow-import-message";

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".json";
    fileInput.style.display = "none";

    const actions = document.createElement("div");
    actions.className = "flow-import-actions";

    const fileBtn = document.createElement("button");
    fileBtn.type = "button";
    fileBtn.textContent = "选择 JSON 文件";
    fileBtn.classList.add("secondary");

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.textContent = "取消";
    cancelBtn.classList.add("secondary");

    const confirmBtn = document.createElement("button");
    confirmBtn.type = "button";
    confirmBtn.textContent = "确认导入";

    const showMessage = (text, type = "error") => {
      if (!text) {
        message.style.display = "none";
        return;
      }
      message.textContent = text;
      message.style.display = "block";
      message.classList.remove("success", "error");
      message.classList.add(type === "success" ? "success" : "error");
    };

    fileBtn.addEventListener("click", () => {
      fileInput.click();
    });

    fileInput.addEventListener("change", async (event) => {
      const file = event.target.files && event.target.files[0];
      if (!file) {
        return;
      }
      try {
        const text = await this.readFileAsText(file);
        textarea.value = text;
        showMessage(`已读取文件：${file.name}`, "success");
      } catch (error) {
        console.error("读取 JSON 文件失败:", error);
        showMessage("读取文件失败，请重试", "error");
      } finally {
        event.target.value = "";
      }
    });

    confirmBtn.addEventListener("click", () => {
      const raw = textarea.value.trim();
      if (!raw) {
        showMessage("请粘贴 JSON 数组内容或选择 JSON 文件", "error");
        return;
      }
      try {
        const data = JSON.parse(raw);
        if (!Array.isArray(data)) {
          throw new Error("JSON 顶层结构必须是数组");
        }
        const entries = this.createEntriesFromJson(data);
        if (!entries.length) {
          throw new Error("未解析到有效提示词");
        }
        this.setPromptEntries(entries);
        this.saveSettings();
        this.showStatus(`已导入 ${entries.length} 条提示词`, "success");
        this.closeImportModal();
      } catch (error) {
        console.error("JSON 解析失败:", error);
        showMessage(`导入失败：${error.message}`, "error");
      }
    });

    const dismiss = () => {
      this.closeImportModal();
    };

    cancelBtn.addEventListener("click", dismiss);
    closeBtn.addEventListener("click", dismiss);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        dismiss();
      }
    });

    const actionsLeft = document.createElement("div");
    actionsLeft.className = "flow-import-actions-left";
    actionsLeft.appendChild(fileBtn);

    const actionsRight = document.createElement("div");
    actionsRight.className = "flow-import-actions-right";
    actionsRight.append(cancelBtn, confirmBtn);

    actions.append(actionsLeft, actionsRight);
    body.append(textarea, message, fileInput, actions);
    content.append(header, body);
    overlay.appendChild(content);
    document.body.appendChild(overlay);

    textarea.focus();
  }

  closeImportModal() {
    const existing = document.querySelector('.flow-modal[data-modal="prompt-import"]');
    if (existing) {
      existing.remove();
    }
  }

  createEntriesFromText(text) {
    return text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((raw) => ({
        raw,
        json: null,
        source: "paste",
        status: "pending",
      }));
  }

  createEntriesFromJson(array) {
    const entries = [];
    array.forEach((item) => {
      if (item === null || item === undefined) {
        return;
      }
      if (typeof item === "object") {
        entries.push({
          raw: JSON.stringify(item, null, 2),
          json: item,
          source: "json",
          status: "pending",
        });
      } else {
        const text = String(item);
        entries.push({
          raw: text,
          json: this.safeParseJson(text),
          source: "json",
          status: "pending",
        });
      }
    });
    return entries;
  }

  safeParseJson(text) {
    try {
      const parsed = JSON.parse(text);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch (error) {
      return null;
    }
  }

  addPromptEntries(entries) {
    if (!entries || !entries.length) {
      return;
    }
    this.promptEntries = this.promptEntries.concat(entries);
    this.resetPromptStatuses(false);
    this.closePromptModal();
    this.renderPromptList();
    this.updatePromptTextarea();
    this.saveSettings();
  }

  setPromptEntries(entries = []) {
    this.promptEntries = entries.map((entry) => ({
      raw: String(entry.raw ?? ""),
      json: entry.json ?? null,
      source: entry.source || "paste",
      status: "pending",
    }));
    this.resetPromptStatuses(false);
    this.closePromptModal();
    this.renderPromptList();
    this.updatePromptTextarea();
  }

  clearPromptEntries() {
    this.setPromptEntries([]);
    this.saveSettings();
  }

  updatePromptTextarea() {
    if (this.promptsTextarea) {
      this.promptsTextarea.value = this.promptEntries.map((entry) => entry.raw).join("\n");
    }
  }

  renderPromptList() {
    if (!this.promptListEl) {
      return;
    }

    this.promptListEl.innerHTML = "";

    if (!this.promptEntries.length) {
      const empty = document.createElement("div");
      empty.className = "prompt-empty";
      empty.textContent = "尚未添加提示词，可点击“粘贴提示词”或“导入 JSON”";
      this.promptListEl.appendChild(empty);
      if (this.promptListNote) {
        this.promptListNote.style.display = "none";
      }
      return;
    }

    if (this.promptListNote) {
      this.promptListNote.style.display = "block";
    }

    const fragment = document.createDocumentFragment();
    this.promptEntries.forEach((entry, index) => {
      const listItem = document.createElement("div");
      listItem.className = `prompt-item${entry.status ? ` ${entry.status}` : ""}`;
      listItem.dataset.index = String(index);

      const order = document.createElement("div");
      order.className = "prompt-index";
      order.textContent = String(index + 1).padStart(2, "0");

      const preview = document.createElement("div");
      preview.className = "prompt-preview";
      preview.textContent = this.formatPromptPreview(entry, index);

      listItem.append(order, preview);
      fragment.appendChild(listItem);
    });

    this.promptListEl.appendChild(fragment);
  }

  formatPromptPreview(entry, index) {
    const base = entry.json
      ? (() => {
          try {
            return JSON.stringify(entry.json);
          } catch (error) {
            return entry.raw;
          }
        })()
      : entry.raw;

    const cleaned = (base || "").replace(/\s+/g, " ").trim();
    const summaryBase = cleaned || "（未提供提示词）";
    return summaryBase.length > 80 ? `${summaryBase.slice(0, 80)}…` : summaryBase;
  }

  showPromptModal(index) {
    const entry = this.promptEntries[index];
    if (!entry) {
      return;
    }

    const overlay = this.ensurePromptDetailOverlay();

    const content = document.createElement("div");
    content.className = "flow-modal-content";

    const header = document.createElement("div");
    header.className = "flow-modal-header";
    const label = this.formatPromptTitle(entry, index);
    header.textContent = `提示词详情 - ${label}`;

    const closeBtn = document.createElement("button");
    closeBtn.className = "flow-modal-close";
    closeBtn.type = "button";
    closeBtn.textContent = "×";
    closeBtn.setAttribute("aria-label", "关闭");
    header.appendChild(closeBtn);

    const body = document.createElement("pre");
    body.className = "flow-modal-body";
    body.textContent = entry.raw;

    content.append(header, body);
    overlay.appendChild(content);

    const dismiss = () => {
      this.closePromptModal();
    };

    closeBtn.addEventListener("click", dismiss);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        dismiss();
      }
    });
  }

  closePromptModal() {
    if (this.promptDetailOverlay) {
      this.promptDetailOverlay.remove();
      this.promptDetailOverlay = null;
    }
  }

  ensurePromptDetailOverlay() {
    if (this.promptDetailOverlay && document.body.contains(this.promptDetailOverlay)) {
      this.promptDetailOverlay.innerHTML = "";
      return this.promptDetailOverlay;
    }

    const overlay = document.createElement("div");
    overlay.className = "flow-modal";
    overlay.id = this.promptDetailModalId;
    document.body.appendChild(overlay);
    this.promptDetailOverlay = overlay;
    return overlay;
  }

  formatPromptTitle(entry, index) {
    const ref = entry.json;
    if (ref && typeof ref === "object" && ref !== null) {
      if (ref.shot) return `镜头 ${ref.shot}`;
      if (ref.id) return `镜头 ${ref.id}`;
    }
    return `镜头 ${index + 1}`;
  }

  resetPromptStatuses(reRender = true) {
    this.promptEntries = this.promptEntries.map((entry) => ({
      ...entry,
      status: "pending",
    }));
    if (reRender) {
      this.renderPromptList();
    }
  }

  setPromptStatus(index, status) {
    if (!this.promptEntries[index]) {
      return;
    }
    this.promptEntries[index].status = status;
    if (!this.promptListEl) {
      return;
    }
    const item = this.promptListEl.querySelector(
      `.prompt-item[data-index="${index}"]`
    );
    if (item) {
      item.classList.remove("pending", "processing", "completed", "error");
      item.classList.add(status);
      if (status === "processing") {
        item.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }

  resetSteps(preserveFirst = false) {
    const stepsContainer = this.window.querySelector("#floating-steps");
    if (!stepsContainer) return;

    const stepItems = stepsContainer.querySelectorAll(".step-item");
    stepItems.forEach((item, index) => {
      if (preserveFirst && index === 0) {
        return;
      }
      item.className = "step-item pending";
    });
  }

  ensureFrameMode(options = {}) {
    const force = Boolean(options.force);
    return new Promise((resolve) => {
      let timeoutId;
      const handler = (event) => {
        cleanup();
        const success = Boolean(event.detail?.success);
        resolve({
          success,
          message:
            event.detail?.message || (success ? "" : "未能确认帧转视频模式"),
        });
      };

      const cleanup = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        document.removeEventListener("ensureFrameModeResult", handler);
      };

      document.addEventListener("ensureFrameModeResult", handler, {
        once: true,
      });
      document.dispatchEvent(
        new CustomEvent("ensureFrameMode", { detail: { force } })
      );

      timeoutId = setTimeout(() => {
        cleanup();
        resolve({
          success: false,
          message: "确认帧转视频模式状态超时，请手动检查。",
        });
      }, 8000);
    });
  }

  updateStep(stepIndex, status) {
    const stepsContainer = this.window.querySelector("#floating-steps");
    const stepItems = stepsContainer.querySelectorAll(".step-item");

    if (stepItems[stepIndex]) {
      stepItems[stepIndex].className = `step-item ${status}`;
    }
  }

  saveSettings() {
    const settings = {
      waitTime: this.window.querySelector("#floating-wait-time").value,
      promptEntries: this.promptEntries.map((entry) => ({
        raw: entry.raw,
        json: entry.json,
        source: entry.source,
      })),
    };
    localStorage.setItem("flowAutoSettings", JSON.stringify(settings));
  }

  loadSettings() {
    const saved = localStorage.getItem("flowAutoSettings");
    if (!saved) {
      this.renderPromptList();
      this.updatePromptTextarea();
      return;
    }

    try {
      const settings = JSON.parse(saved);
      this.window.querySelector("#floating-wait-time").value =
        settings.waitTime || "3";

      if (Array.isArray(settings.promptEntries)) {
        this.setPromptEntries(settings.promptEntries);
      } else if (settings.jsonMode && Array.isArray(settings.jsonPrompts)) {
        const entries = this.createEntriesFromJson(settings.jsonPrompts);
        this.setPromptEntries(entries);
      } else if (typeof settings.prompts === "string" && settings.prompts.trim()) {
        // 兼容旧版本：从换行文本恢复
        const entries = this.createEntriesFromText(settings.prompts);
        this.setPromptEntries(entries);
      } else {
        this.setPromptEntries([]);
      }
    } catch (error) {
      console.warn("加载提示词设置失败:", error);
      this.setPromptEntries([]);
    }
  }

  show() {
    this.window.style.display = "block";
  }

  hide() {
    this.window.style.display = "none";
  }

  toggle() {
    if (this.window.style.display === "none" || !this.window.style.display) {
      this.show();
    } else {
      this.hide();
    }
  }

  toggleMinimize() {
    console.log("切换最小化状态，当前:", this.isMinimized);
    this.isMinimized = !this.isMinimized;

    const minimizeBtn = this.window.querySelector("#minimize-btn");
    if (!minimizeBtn) {
      console.error("找不到最小化按钮");
      return;
    }

    if (this.isMinimized) {
      this.window.classList.add("minimized");
      minimizeBtn.textContent = "□";
      minimizeBtn.title = "还原";
      console.log("已最小化");
    } else {
      this.window.classList.remove("minimized");
      minimizeBtn.textContent = "−";
      minimizeBtn.title = "最小化";
      console.log("已还原");
    }
  }
}

// 初始化悬浮窗口
let floatingWindow;

function initFloatingWindow() {
  if (!floatingWindow) {
    floatingWindow = new FloatingWindow();
  }
  return floatingWindow;
}

// 创建浮动按钮来显示/隐藏窗口
function createFloatingButton() {
  const button = document.createElement("div");
  button.id = "flow-toggle-button";
  button.innerHTML = "Flow";
  button.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 60px;
        height: 60px;
        background: linear-gradient(135deg, #f87171, #ef4444);
        color: white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        font-weight: bold;
        cursor: pointer;
        box-shadow: 0 4px 15px rgba(248,113,113,0.45);
        z-index: 10001;
        user-select: none;
        transition: all 0.3s ease;
        border: 3px solid white;
        animation: pulse 2s infinite;
    `;

  // 添加悬停效果
  button.addEventListener("mouseenter", () => {
    button.style.transform = "scale(1.1)";
    button.style.boxShadow = "0 6px 20px rgba(248,113,113,0.6)";
  });

  button.addEventListener("mouseleave", () => {
    button.style.transform = "scale(1)";
    button.style.boxShadow = "0 4px 15px rgba(248,113,113,0.45)";
  });

  button.addEventListener("click", () => {
    initFloatingWindow().toggle();
  });

  // 添加脉冲动画
  const pulseStyle = document.createElement("style");
  pulseStyle.textContent = `
        @keyframes pulse {
            0% { box-shadow: 0 4px 15px rgba(248,113,113,0.45); }
            50% { box-shadow: 0 4px 28px rgba(248,113,113,0.75); }
            100% { box-shadow: 0 4px 15px rgba(248,113,113,0.45); }
        }
    `;

  if (!document.querySelector("#flow-pulse-style")) {
    pulseStyle.id = "flow-pulse-style";
    document.head.appendChild(pulseStyle);
  }

  document.body.appendChild(button);

  // 添加提示文字
  const tooltip = document.createElement("div");
  tooltip.id = "flow-button-tooltip";
  tooltip.textContent = "点击打开Flow帧转视频助手";
  tooltip.style.cssText = `
        position: fixed;
        bottom: 85px;
        right: 20px;
        background: rgba(127,29,29,0.92);
        color: white;
        padding: 8px 12px;
        border-radius: 5px;
        font-size: 12px;
        white-space: nowrap;
        opacity: 0;
        transition: opacity 0.3s;
        z-index: 10000;
        pointer-events: none;
    `;

  button.addEventListener("mouseenter", () => {
    tooltip.style.opacity = "1";
  });

  button.addEventListener("mouseleave", () => {
    tooltip.style.opacity = "0";
  });

  document.body.appendChild(tooltip);
}

// 注入到页面
function initPlugin() {
  const currentUrl = window.location.href;
  const isFlowPage =
    currentUrl.includes("labs.google/fx/zh/tools/flow") ||
    currentUrl.includes("labs.google/fx/tools/flow");

  if (!isFlowPage) {
    console.log("Flow帧转视频助手: 当前页面不是 Flow 帧转视频页面，跳过初始化");
    return;
  }

  createFloatingButton();
  // 初始化悬浮窗口但不显示
  initFloatingWindow();

  // 隐藏悬浮窗口
  if (floatingWindow) {
    floatingWindow.hide();
  }

  // 监听重新初始化事件
  document.addEventListener("reinitFloatingWindow", () => {
    if (floatingWindow) {
      floatingWindow.show();
    } else {
      initFloatingWindow().show();
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPlugin);
} else {
  initPlugin();
}

// 暴露到全局
window.initFloatingWindow = initFloatingWindow;


