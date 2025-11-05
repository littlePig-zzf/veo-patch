// 独立的Playwright测试脚本，用于验证插件功能
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function testFlowAutomation() {
    const browser = await chromium.launch({ 
        headless: false,
        args: [
            `--disable-extensions-except=${__dirname}`,
            `--load-extension=${__dirname}`
        ]
    });
    
    const context = await browser.newContext();
    const page = await context.newPage();
    
    try {
        // 1. 导航到 Flow 帧转视频页面
        await page.goto('https://labs.google/fx/zh/tools/flow', { waitUntil: 'networkidle' });
        
        // 2. 选择“帧转视频”模式
        const modeList = page.getByRole('combobox').first();
        await modeList.click();
        await page.getByRole('option', { name: /帧转视频/ }).click();
        
        // 3. 模拟插件操作
        console.log('页面已加载，等待插件操作...');
        
        // 4. 测试图片上传功能
        const testImagePath = path.join(__dirname, 'test-images', '001.jpg');
        
        if (fs.existsSync(testImagePath)) {
            console.log('找到测试图片，开始上传测试...');
            
            // 触发上传弹窗
            await page.getByRole('button', { name: /add/i }).first().click();
            await page.getByRole('button', { name: /upload 上传/i }).click();

            // 上传图片（选择弹窗中的文件输入控件）
            const fileInput = await page.locator('input[type="file"]').first();
            await fileInput.setInputFiles(testImagePath);

            // 使用 Playwright 校验上传是否完成
            await waitForFlowUploadSuccess(page, 20000);
            
            // 等待上传完成
            await page.waitForTimeout(3000);
            
            // 输入提示词
            const prompt = await page.locator('#PINHOLE_TEXT_AREA_ELEMENT_ID');
            await prompt.fill('测试提示词：一个美丽的风景');
            
            // 点击创建按钮
            const generateBtn = await page.getByRole('button', { name: /创建|创作|生成/ });
            await generateBtn.click();
            
            console.log('测试完成！');
        } else {
            console.log('未找到测试图片，请创建 test-images/001.jpg 进行测试');
        }
        
    } catch (error) {
        console.error('测试失败:', error);
    } finally {
        // 保持浏览器打开以便观察
        // await browser.close();
    }
}

// 创建测试图片目录和示例图片
function setupTestImages() {
    const testDir = path.join(__dirname, 'test-images');
    if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir);
        console.log('已创建测试图片目录：', testDir);
        console.log('请将测试图片命名为 001.jpg, 002.jpg 等放入此目录');
    }
}

// 运行设置和测试
setupTestImages();
// testFlowAutomation(); // 取消注释运行测试

// 等待 Flow 上传完成：上传中文字样消失且展示区域出现预览
async function waitForFlowUploadSuccess(page, timeoutMs = 20000) {
    const start = Date.now();
    const uploadingText = page.getByText('上传中', { exact: false });
    const fileInput = page.locator('input[type="file"]').first();

    const isReady = async () => {
        const uploadingVisible = await uploadingText.isVisible().catch(() => false);
        if (uploadingVisible) return false;

    const uploadWidget = fileInput.locator('xpath=ancestor::div[1]');
        const thumb = uploadWidget.locator('img, video').first();
        const visible = await thumb.isVisible().catch(() => false);
        if (visible) return true;
        return false;
    };

    while (Date.now() - start < timeoutMs) {
        if (await isReady()) return;
        await page.waitForTimeout(200);
    }
    throw new Error('等待上传缩略图出现超时');
}

module.exports = { testFlowAutomation };
