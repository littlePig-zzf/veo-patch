// ==UserScript==
// @name         Flow视频批量下载助手
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  批量下载Flow项目中的视频,支持选择范围并打包成ZIP
// @author       You
// @match        https://labs.google/fx/tools/flow/project/*
// @grant        none
// @require      https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js
// ==/UserScript==

(function() {
    'use strict';

    // 确保JSZip加载完成
    function waitForJSZip() {
        return new Promise((resolve, reject) => {
            if (typeof JSZip !== 'undefined') {
                console.log('JSZip已加载');
                resolve();
            } else {
                console.log('等待JSZip加载...');
                let attempts = 0;
                const interval = setInterval(() => {
                    attempts++;
                    if (typeof JSZip !== 'undefined') {
                        clearInterval(interval);
                        console.log('JSZip加载成功');
                        resolve();
                    } else if (attempts > 50) {
                        clearInterval(interval);
                        reject(new Error('JSZip加载超时'));
                    }
                }, 100);
            }
        });
    }

    // 全局状态
    let state = {
        startIndex: null,
        endIndex: null,
        isSelecting: false,
        collectedVideos: new Map(), // key: data-index, value: {url, blob}
    };

    // 暴露到全局，方便控制台调试和紧急救援
    window.flowDownloadState = state;

    // 创建悬浮控制面板
    function createControlPanel() {
        const panel = document.createElement('div');
        panel.id = 'flow-download-panel';
        panel.innerHTML = `
            <div style="
                position: fixed;
                top: 20px;
                right: 20px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                padding: 20px;
                border-radius: 12px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.3);
                z-index: 999999;
                min-width: 280px;
                color: white;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            ">
                <h3 style="margin: 0 0 15px 0; font-size: 16px; font-weight: 600;">批量下载助手</h3>

                <div style="margin-bottom: 12px; padding: 12px; background: rgba(255,255,255,0.1); border-radius: 6px;">
                    <div style="margin-bottom: 8px;">
                        <label style="font-size: 12px; opacity: 0.9; display: block; margin-bottom: 4px;">起点 index:</label>
                        <input id="start-index-input" type="number" min="1" placeholder="输入起点" style="
                            width: 100%;
                            padding: 6px 8px;
                            border: 1px solid rgba(255,255,255,0.3);
                            border-radius: 4px;
                            background: rgba(255,255,255,0.15);
                            color: white;
                            font-size: 14px;
                            box-sizing: border-box;
                        ">
                    </div>
                    <div>
                        <label style="font-size: 12px; opacity: 0.9; display: block; margin-bottom: 4px;">终点 index:</label>
                        <input id="end-index-input" type="number" min="1" placeholder="输入终点" style="
                            width: 100%;
                            padding: 6px 8px;
                            border: 1px solid rgba(255,255,255,0.3);
                            border-radius: 4px;
                            background: rgba(255,255,255,0.15);
                            color: white;
                            font-size: 14px;
                            box-sizing: border-box;
                        ">
                    </div>
                </div>

                <button id="select-mode-btn" style="
                    width: 100%;
                    padding: 10px;
                    background: rgba(255,255,255,0.2);
                    border: 1px solid rgba(255,255,255,0.3);
                    border-radius: 6px;
                    color: white;
                    cursor: pointer;
                    margin-bottom: 8px;
                    font-size: 14px;
                    transition: all 0.3s;
                ">或点击视频选择范围</button>

                <button id="start-download-btn" style="
                    width: 100%;
                    padding: 10px;
                    background: rgba(76, 175, 80, 0.8);
                    border: none;
                    border-radius: 6px;
                    color: white;
                    cursor: pointer;
                    margin-bottom: 8px;
                    font-size: 14px;
                    font-weight: 600;
                    transition: all 0.3s;
                " disabled>开始下载</button>

                <button id="emergency-save-btn" style="
                    width: 100%;
                    padding: 8px;
                    background: rgba(255, 152, 0, 0.7);
                    border: none;
                    border-radius: 6px;
                    color: white;
                    cursor: pointer;
                    font-size: 12px;
                    margin-bottom: 8px;
                    transition: all 0.3s;
                    display: none;
                ">🆘 紧急保存视频</button>

                <button id="reset-btn" style="
                    width: 100%;
                    padding: 8px;
                    background: rgba(244, 67, 54, 0.6);
                    border: none;
                    border-radius: 6px;
                    color: white;
                    cursor: pointer;
                    font-size: 12px;
                    transition: all 0.3s;
                ">重置</button>

                <div id="progress-info" style="
                    margin-top: 12px;
                    font-size: 12px;
                    padding: 8px;
                    background: rgba(0,0,0,0.2);
                    border-radius: 6px;
                    display: none;
                ">
                    <div id="progress-text">准备中...</div>
                    <div style="
                        margin-top: 6px;
                        height: 6px;
                        background: rgba(255,255,255,0.2);
                        border-radius: 3px;
                        overflow: hidden;
                    ">
                        <div id="progress-bar" style="
                            height: 100%;
                            width: 0%;
                            background: linear-gradient(90deg, #4CAF50, #8BC34A);
                            transition: width 0.3s;
                        "></div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(panel);

        // 绑定事件
        document.getElementById('select-mode-btn').addEventListener('click', toggleSelectMode);
        document.getElementById('start-download-btn').addEventListener('click', startDownloadProcess);
        document.getElementById('emergency-save-btn').addEventListener('click', emergencySaveVideos);
        document.getElementById('reset-btn').addEventListener('click', resetState);

        // 绑定输入框事件
        const startInput = document.getElementById('start-index-input');
        const endInput = document.getElementById('end-index-input');

        startInput.addEventListener('input', handleInputChange);
        endInput.addEventListener('input', handleInputChange);

        // 添加placeholder样式
        const style = document.createElement('style');
        style.textContent = `
            #start-index-input::placeholder,
            #end-index-input::placeholder {
                color: rgba(255,255,255,0.5);
            }
        `;
        document.head.appendChild(style);

        // 添加悬停效果
        const buttons = panel.querySelectorAll('button');
        buttons.forEach(btn => {
            btn.addEventListener('mouseenter', function() {
                if (!this.disabled) {
                    this.style.transform = 'translateY(-2px)';
                    this.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
                }
            });
            btn.addEventListener('mouseleave', function() {
                this.style.transform = 'translateY(0)';
                this.style.boxShadow = 'none';
            });
        });
    }

    // 处理输入框变化
    function handleInputChange() {
        const startInput = document.getElementById('start-index-input');
        const endInput = document.getElementById('end-index-input');
        const downloadBtn = document.getElementById('start-download-btn');

        const startValue = parseInt(startInput.value);
        const endValue = parseInt(endInput.value);

        // 验证输入
        if (!isNaN(startValue) && !isNaN(endValue) && startValue > 0 && endValue > 0) {
            state.startIndex = startValue;
            state.endIndex = endValue;

            // 启用下载按钮
            downloadBtn.disabled = false;
            downloadBtn.style.opacity = '1';

            console.log(`手动输入范围: ${startValue} - ${endValue}`);
        } else {
            // 如果输入不完整,禁用下载按钮
            downloadBtn.disabled = true;
            downloadBtn.style.opacity = '0.5';

            // 但保留已输入的值
            if (!isNaN(startValue) && startValue > 0) {
                state.startIndex = startValue;
            }
            if (!isNaN(endValue) && endValue > 0) {
                state.endIndex = endValue;
            }
        }
    }

    // 切换选择模式
    function toggleSelectMode() {
        state.isSelecting = !state.isSelecting;
        const btn = document.getElementById('select-mode-btn');

        if (state.isSelecting) {
            btn.textContent = '选择模式已激活(点击视频)';
            btn.style.background = 'rgba(255, 152, 0, 0.8)';
            addClickListenersToVideos();
        } else {
            btn.textContent = '开始选择范围';
            btn.style.background = 'rgba(255,255,255,0.2)';
            removeClickListenersFromVideos();
        }
    }

    // 为视频列表项添加点击监听
    function addClickListenersToVideos() {
        const videoItems = document.querySelectorAll('[data-index]');
        videoItems.forEach(item => {
            if (item.dataset.index && item.dataset.index !== '0') {
                item.style.cursor = 'pointer';
                item.style.transition = 'all 0.3s';
                item.addEventListener('click', handleVideoItemClick);
            }
        });
    }

    // 移除点击监听
    function removeClickListenersFromVideos() {
        const videoItems = document.querySelectorAll('[data-index]');
        videoItems.forEach(item => {
            item.style.cursor = '';
            item.style.outline = '';
            item.removeEventListener('click', handleVideoItemClick);
        });
    }

    // 处理视频项点击
    function handleVideoItemClick(event) {
        if (!state.isSelecting) return;

        event.preventDefault();
        event.stopPropagation();

        const index = parseInt(this.dataset.index);
        if (index === 0) return;

        if (state.startIndex === null) {
            // 选择起点
            state.startIndex = index;
            this.style.outline = '3px solid #4CAF50';
            document.getElementById('start-index-input').value = index;
            console.log('起点已选择:', index);
        } else if (state.endIndex === null) {
            // 选择终点
            state.endIndex = index;
            this.style.outline = '3px solid #F44336';
            document.getElementById('end-index-input').value = index;
            console.log('终点已选择:', index);

            // 关闭选择模式
            state.isSelecting = false;
            const btn = document.getElementById('select-mode-btn');
            btn.textContent = '范围已选择';
            btn.style.background = 'rgba(76, 175, 80, 0.8)';

            // 启用下载按钮
            document.getElementById('start-download-btn').disabled = false;
            document.getElementById('start-download-btn').style.opacity = '1';

            removeClickListenersFromVideos();
        }
    }

    // 重置状态
    function resetState() {
        state.startIndex = null;
        state.endIndex = null;
        state.isSelecting = false;
        state.collectedVideos.clear();

        // 清空输入框
        document.getElementById('start-index-input').value = '';
        document.getElementById('end-index-input').value = '';

        document.getElementById('select-mode-btn').textContent = '或点击视频选择范围';
        document.getElementById('select-mode-btn').style.background = 'rgba(255,255,255,0.2)';
        document.getElementById('start-download-btn').disabled = true;
        document.getElementById('start-download-btn').style.opacity = '0.5';
        document.getElementById('progress-info').style.display = 'none';

        removeClickListenersFromVideos();
        console.log('状态已重置');
    }

    // 开始下载流程
    async function startDownloadProcess() {
        if (state.startIndex === null || state.endIndex === null) {
            alert('请先选择起点和终点');
            return;
        }

        const minIndex = Math.min(state.startIndex, state.endIndex);
        const maxIndex = Math.max(state.startIndex, state.endIndex);

        console.log(`开始下载流程: ${minIndex} - ${maxIndex}`);

        // 显示进度
        document.getElementById('progress-info').style.display = 'block';
        updateProgress('正在收集视频列表...', 0);

        try {
            // 1. 滚动并收集所有视频
            await scrollAndCollectVideos(minIndex, maxIndex);

            // 2. 下载所有视频
            await downloadAllVideos();

            // 显示紧急保存按钮（视频已在内存中）
            document.getElementById('emergency-save-btn').style.display = 'block';

            // 3. 打包成ZIP
            try {
                await createZipAndDownload();
                updateProgress('下载完成!', 100);
            } catch (zipError) {
                console.error('ZIP打包失败:', zipError);
                console.log('⚠️ ZIP打包失败，尝试逐个下载视频文件...');

                // 备用方案：逐个下载视频文件
                if (confirm('ZIP打包失败（可能是文件过大）。\n是否改为逐个下载视频文件？')) {
                    await downloadVideosIndividually();
                    updateProgress('下载完成!', 100);
                } else {
                    throw zipError;
                }
            }

            setTimeout(() => {
                document.getElementById('progress-info').style.display = 'none';
            }, 3000);
        } catch (error) {
            console.error('下载过程出错:', error);
            alert('下载失败: ' + error.message);
            updateProgress('下载失败', 0);
        }
    }

    // 查找滚动容器
    function findScrollContainer() {
        // 优先查找virtuoso滚动容器
        const knownSelectors = [
            '[data-virtuoso-scroller="true"]',
            '[data-testid="virtuoso-scroller"]',
            '.sc-1cf8ce28-7',
            '[class*="eOSwrz"]'
        ];

        for (const selector of knownSelectors) {
            const container = document.querySelector(selector);
            if (container && container.scrollHeight > container.clientHeight) {
                console.log('✅ 找到滚动容器:', selector, container);
                return container;
            }
        }

        // 如果没找到,从第一个视频项向上查找父容器
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
                    console.log('✅ 从视频项找到滚动容器:', parent);
                    return parent;
                }
                parent = parent.parentElement;
            }
        }

        console.error('❌ 未找到滚动容器');
        return null;
    }

    // 滚动并收集视频
    async function scrollAndCollectVideos(minIndex, maxIndex) {
        const totalNeeded = maxIndex - minIndex + 1;
        const collectedIndexes = new Set();

        // 找到真正的滚动容器
        const scrollContainer = findScrollContainer();
        if (!scrollContainer) {
            throw new Error('未找到视频列表的滚动容器');
        }

        console.log(`📋 需要收集: ${minIndex} 到 ${maxIndex}, 共 ${totalNeeded} 个视频`);
        console.log(`📦 滚动容器信息: scrollHeight=${scrollContainer.scrollHeight}, clientHeight=${scrollContainer.clientHeight}`);

        // 先滚动到顶部,确保从头开始
        console.log('⬆️ 滚动到顶部...');
        scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
        await sleep(1500);

        let attempts = 0;
        const maxAttempts = 200;
        let lastScrollTop = -1;
        let stuckCount = 0;

        console.log('🔄 开始收集循环...');

        while (collectedIndexes.size < totalNeeded && attempts < maxAttempts) {
            attempts++;
            console.log(`\n--- 第 ${attempts} 次尝试 ---`);

            // 检查当前已加载的视频项
            const currentItems = document.querySelectorAll('[data-index]');
            let currentMinIndex = Infinity;
            let currentMaxIndex = -Infinity;

            currentItems.forEach(item => {
                const index = parseInt(item.dataset.index);
                if (index && index !== 0) {
                    currentMinIndex = Math.min(currentMinIndex, index);
                    currentMaxIndex = Math.max(currentMaxIndex, index);

                    // 只处理目标范围内的
                    if (index >= minIndex && index <= maxIndex) {
                        // 如果还没收集过这个index,尝试提取URL
                        if (!collectedIndexes.has(index)) {
                            const videoUrl = extractVideoUrl(item);
                            if (videoUrl) {
                                // 只有成功提取到URL才标记为已收集
                                collectedIndexes.add(index);
                                state.collectedVideos.set(index, { url: videoUrl, blob: null });
                                console.log(`✅ 收集到视频 ${index}: ${videoUrl.substring(0, 80)}...`);
                            } else {
                                // 没有提取到URL,说明视频还没加载
                                console.log(`⏳ 索引 ${index} 的视频URL未加载`);
                            }
                        }
                    }
                }
            });

            const progress = (collectedIndexes.size / totalNeeded) * 30;
            updateProgress(`收集中: ${collectedIndexes.size}/${totalNeeded} (视口: ${currentMinIndex}-${currentMaxIndex})`, progress);

            if (collectedIndexes.size < totalNeeded) {
                // 找到缺失的索引
                const missingIndexes = [];
                for (let i = minIndex; i <= maxIndex; i++) {
                    if (!collectedIndexes.has(i)) {
                        missingIndexes.push(i);
                    }
                }

                if (missingIndexes.length > 0) {
                    console.log(`❌ 还缺失 ${missingIndexes.length} 个, 范围: ${missingIndexes[0]} - ${missingIndexes[missingIndexes.length - 1]}`);

                    // 检查是否卡住
                    const currentScrollTop = scrollContainer.scrollTop;
                    console.log(`📍 当前scrollTop: ${currentScrollTop}, 上次: ${lastScrollTop}`);

                    if (currentScrollTop === lastScrollTop) {
                        stuckCount++;
                        console.warn(`⚠️ 滚动卡住 ${stuckCount}/5`);
                        if (stuckCount > 5) {
                            console.warn('❌ 滚动已到达底部,但仍有缺失项');
                            break;
                        }
                    } else {
                        stuckCount = 0;
                        lastScrollTop = currentScrollTop;
                    }

                    // 智能滚动 - 每次滚动2个列表项的高度
                    const scrollAmount = 571 * 2; // 1142px
                    if (missingIndexes[0] < currentMinIndex) {
                        console.log(`⬆️ 向上滚动 ${scrollAmount}px (缺失项在上方)`);
                        scrollContainer.scrollBy({ top: -scrollAmount, behavior: 'smooth' });
                    } else {
                        console.log(`⬇️ 向下滚动 ${scrollAmount}px (缺失项在下方)`);
                        scrollContainer.scrollBy({ top: scrollAmount, behavior: 'smooth' });
                    }

                    await sleep(1000);
                } else {
                    console.log('✅ 所有视频已收集完毕,退出循环');
                    break;
                }
            }
        }

        console.log(`\n📊 收集统计: 尝试了 ${attempts} 次`);


        if (collectedIndexes.size < totalNeeded) {
            const missing = [];
            for (let i = minIndex; i <= maxIndex; i++) {
                if (!collectedIndexes.has(i)) missing.push(i);
            }
            console.warn(`只收集到 ${collectedIndexes.size}/${totalNeeded} 个视频, 缺失: ${missing.join(', ')}`);
        }

        console.log('视频收集完成:', Array.from(collectedIndexes).sort((a, b) => a - b));
    }

    // 提取视频URL
    function extractVideoUrl(item) {
        // 方法1: 从video标签的poster属性提取
        const video = item.querySelector('video');
        if (video) {
            // 尝试获取src
            const source = video.querySelector('source');
            if (source && source.src) {
                return source.src;
            }

            // 尝试直接从video获取
            if (video.src) {
                return video.src;
            }

            // 从poster中提取(可能需要转换)
            if (video.poster && video.poster.includes('storage.googleapis.com')) {
                // poster通常是缩略图,可能需要找到真实视频链接
                // 这里先返回poster,后续可能需要调整
                console.log('找到poster:', video.poster);
            }
        }

        // 方法2: 查找所有视频相关链接
        const links = item.querySelectorAll('a[href*="storage.googleapis.com"]');
        for (const link of links) {
            if (link.href.match(/\.(mp4|webm|mov)$/i)) {
                return link.href;
            }
        }

        // 方法3: 从data属性中查找
        if (item.dataset.videoUrl) {
            return item.dataset.videoUrl;
        }

        console.warn('未能从该项中提取视频URL:', item);
        return null;
    }

    // 下载所有视频 - 批次下载模式（每批5个，批次间有间隔）
    async function downloadAllVideos() {
        const videos = Array.from(state.collectedVideos.entries()).sort((a, b) => a[0] - b[0]);
        const total = videos.length;
        const batchSize = 5; // 每批5个
        let completed = 0;
        const results = [];

        console.log(`📥 开始批次下载 ${total} 个视频, 每批 ${batchSize} 个`);

        // 分批下载
        for (let i = 0; i < videos.length; i += batchSize) {
            const batch = videos.slice(i, i + batchSize);
            const batchNum = Math.floor(i / batchSize) + 1;
            const totalBatches = Math.ceil(videos.length / batchSize);

            console.log(`\n📦 开始第 ${batchNum}/${totalBatches} 批下载 (${batch.length} 个视频)`);

            // 并发下载这一批
            const promises = batch.map(async ([index, data]) => {
                try {
                    console.log(`⬇️ 开始下载视频 ${index}...`);
                    const blob = await downloadVideoAsBlob(data.url);
                    state.collectedVideos.get(index).blob = blob;
                    completed++;

                    const progress = 30 + (completed / total) * 60;
                    updateProgress(`下载中: ${completed}/${total} (第${batchNum}批)`, progress);

                    console.log(`✅ 视频 ${index} 下载完成, 大小: ${(blob.size / 1024 / 1024).toFixed(2)}MB`);
                    return { index, success: true };
                } catch (error) {
                    console.error(`❌ 视频 ${index} 下载失败:`, error.message);
                    completed++;
                    const progress = 30 + (completed / total) * 60;
                    updateProgress(`下载中: ${completed}/${total} (第${batchNum}批, 部分失败)`, progress);
                    return { index, success: false, error: error.message };
                }
            });

            // 等待这一批全部完成
            const batchResults = await Promise.all(promises);
            results.push(...batchResults);

            const batchFailed = batchResults.filter(r => !r.success);
            if (batchFailed.length > 0) {
                console.warn(`⚠️ 第${batchNum}批有 ${batchFailed.length} 个失败`);
            }

            // 批次间延迟，避免网络压力过大
            if (i + batchSize < videos.length) {
                console.log(`⏸️ 批次间休息 1 秒...`);
                await sleep(1000);
            }
        }

        const failed = results.filter(r => !r.success);
        if (failed.length > 0) {
            console.warn(`⚠️ 总共有 ${failed.length} 个视频下载失败:`, failed.map(f => f.index).join(', '));
        }

        console.log(`📊 下载完成统计: 总共 ${total} 个, 成功 ${total - failed.length} 个`);
    }

    // 下载单个视频为Blob
    async function downloadVideoAsBlob(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`下载失败: HTTP ${response.status}`);
        }
        return await response.blob();
    }

    // 创建ZIP并下载 - 优化内存使用
    async function createZipAndDownload() {
        const videos = Array.from(state.collectedVideos.entries()).sort((a, b) => a[0] - b[0]);
        const validVideos = videos.filter(([_, data]) => data.blob);

        console.log(`📦 准备打包 ${validVideos.length} 个视频`);

        // 计算总大小
        const totalSize = validVideos.reduce((sum, [_, data]) => sum + data.blob.size, 0);
        const totalSizeMB = (totalSize / 1024 / 1024).toFixed(2);
        console.log(`📊 总大小: ${totalSizeMB}MB`);

        // 如果总大小超过500MB，分批打包（更保守，避免内存溢出）
        const maxSizePerZip = 500 * 1024 * 1024; // 500MB
        if (totalSize > maxSizePerZip) {
            console.log('⚠️ 文件过大，将分批打包');
            await createMultipleZips(validVideos, maxSizePerZip);
        } else {
            await createSingleZip(validVideos);
        }
    }

    // 创建单个ZIP文件
    async function createSingleZip(videos) {
        updateProgress('正在打包ZIP...', 95);

        const zip = new JSZip();
        const folder = zip.folder('flow_videos');

        for (const [index, data] of videos) {
            const ext = data.blob.type.includes('webm') ? 'webm' : 'mp4';
            // 使用 STORE 模式（不压缩），视频文件本身已压缩
            folder.file(`video_${index}.${ext}`, data.blob, {
                compression: 'STORE'
            });
        }

        // 生成ZIP - 不压缩，节省内存和时间
        const zipBlob = await zip.generateAsync({
            type: 'blob',
            compression: 'STORE',
            streamFiles: true
        }, (metadata) => {
            const percent = 95 + (metadata.percent / 100) * 5;
            updateProgress(`打包中: ${metadata.percent.toFixed(0)}%`, percent);
        });

        // 生成文件名
        const today = new Date();
        const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
        const fileName = `flow${dateStr}.zip`;

        downloadBlob(zipBlob, fileName);
        console.log(`✅ ZIP下载已触发: ${fileName}`);
    }

    // 分批创建多个ZIP文件
    async function createMultipleZips(videos, maxSizePerZip) {
        const batches = [];
        let currentBatch = [];
        let currentSize = 0;

        for (const [index, data] of videos) {
            if (currentSize + data.blob.size > maxSizePerZip && currentBatch.length > 0) {
                batches.push(currentBatch);
                currentBatch = [];
                currentSize = 0;
            }
            currentBatch.push([index, data]);
            currentSize += data.blob.size;
        }
        if (currentBatch.length > 0) {
            batches.push(currentBatch);
        }

        console.log(`📦 将创建 ${batches.length} 个ZIP文件`);

        const today = new Date();
        const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;

        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i];
            updateProgress(`正在打包第 ${i + 1}/${batches.length} 个ZIP...`, 95 + (i / batches.length) * 5);

            const zip = new JSZip();
            const folder = zip.folder('flow_videos');

            for (const [index, data] of batch) {
                const ext = data.blob.type.includes('webm') ? 'webm' : 'mp4';
                folder.file(`video_${index}.${ext}`, data.blob, {
                    compression: 'STORE'
                });
            }

            const zipBlob = await zip.generateAsync({
                type: 'blob',
                compression: 'STORE',
                streamFiles: true
            });

            const fileName = batches.length > 1
                ? `flow${dateStr}_part${i + 1}.zip`
                : `flow${dateStr}.zip`;

            downloadBlob(zipBlob, fileName);
            console.log(`✅ ZIP ${i + 1}/${batches.length} 下载已触发: ${fileName}`);

            // 等待一下，避免浏览器同时处理太多下载
            await sleep(500);
        }
    }

    // 下载Blob文件
    function downloadBlob(blob, filename) {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    }

    // 备用方案：逐个下载视频文件（不打包ZIP）
    async function downloadVideosIndividually() {
        const videos = Array.from(state.collectedVideos.entries()).sort((a, b) => a[0] - b[0]);
        const validVideos = videos.filter(([_, data]) => data.blob);

        console.log(`📥 开始逐个下载 ${validVideos.length} 个视频文件`);
        updateProgress('正在逐个下载视频...', 95);

        // 生成日期前缀
        const today = new Date();
        const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;

        for (let i = 0; i < validVideos.length; i++) {
            const [index, data] = validVideos[i];
            const ext = data.blob.type.includes('webm') ? 'webm' : 'mp4';
            const filename = `flow_${dateStr}_video_${index}.${ext}`;

            downloadBlob(data.blob, filename);
            console.log(`✅ 下载 ${i + 1}/${validVideos.length}: ${filename}`);

            const progress = 95 + ((i + 1) / validVideos.length) * 5;
            updateProgress(`下载中: ${i + 1}/${validVideos.length}`, progress);

            // 每个下载间隔一点时间，避免浏览器阻塞
            await sleep(100);
        }

        console.log('✅ 所有视频文件已下载完成');
    }

    // 紧急保存：手动触发逐个下载
    async function emergencySaveVideos() {
        const validVideos = Array.from(state.collectedVideos.entries()).filter(([_, data]) => data.blob);

        if (validVideos.length === 0) {
            alert('内存中没有视频数据！');
            return;
        }

        if (!confirm(`检测到内存中有 ${validVideos.length} 个视频。\n确认逐个下载吗？`)) {
            return;
        }

        console.log('🆘 紧急保存模式启动');
        await downloadVideosIndividually();
        alert(`✅ 已保存 ${validVideos.length} 个视频到下载文件夹`);
    }

    // 更新进度显示
    function updateProgress(text, percent) {
        document.getElementById('progress-text').textContent = text;
        document.getElementById('progress-bar').style.width = percent + '%';
    }

    // 延迟函数
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // 初始化
    async function init() {
        // 确保在Flow项目页面
        if (!window.location.href.includes('labs.google/fx/tools/flow/project/')) {
            console.log('不在Flow项目页面,脚本不会启动');
            return;
        }

        console.log('Flow视频批量下载助手已加载');

        // 等待JSZip加载
        try {
            await waitForJSZip();
        } catch (error) {
            console.error('JSZip加载失败:', error);
            alert('批量下载助手加载失败: JSZip库未能加载');
            return;
        }

        // 等待页面加载完成
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', createControlPanel);
        } else {
            createControlPanel();
        }
    }

    init();
})();
