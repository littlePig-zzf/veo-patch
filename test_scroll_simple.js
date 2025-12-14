// ============================================
// Vidu 滚动测试 - 简化版
// 直接在浏览器控制台粘贴运行
// ============================================

console.clear();
console.log('🔍 开始检测滚动容器...\n');

// 1. 查找所有可能的滚动容器
const allDivs = document.querySelectorAll('div');
const scrollableContainers = [];

allDivs.forEach((div, index) => {
    const style = window.getComputedStyle(div);
    const overflowY = style.overflowY;
    const scrollHeight = div.scrollHeight;
    const clientHeight = div.clientHeight;

    if ((overflowY === 'auto' || overflowY === 'scroll') && scrollHeight > clientHeight) {
        scrollableContainers.push({
            element: div,
            scrollHeight,
            clientHeight,
            overflow: overflowY,
            index
        });
    }
});

console.log(`📊 找到 ${scrollableContainers.length} 个可滚动容器:\n`);

scrollableContainers.forEach((container, i) => {
    console.log(`容器 ${i + 1}:`);
    console.log(`  scrollHeight: ${container.scrollHeight}px`);
    console.log(`  clientHeight: ${container.clientHeight}px`);
    console.log(`  overflow-y: ${container.overflow}`);
    console.log(`  元素:`, container.element);
    console.log('');
});

// 2. 检查视频列表
const videoItems = document.querySelectorAll('[data-index]');
console.log(`📹 找到 ${videoItems.length} 个视频项 (data-index)\n`);

if (videoItems.length > 0) {
    const indexes = [];
    videoItems.forEach(item => {
        const idx = item.getAttribute('data-index');
        if (idx && idx !== '0') indexes.push(parseInt(idx));
    });
    indexes.sort((a, b) => a - b);

    console.log(`索引范围: ${indexes[0]} - ${indexes[indexes.length - 1]}`);
    console.log(`总数: ${indexes.length} 个`);
    console.log(`示例: ${indexes.slice(0, 10).join(', ')}...\n`);
}

// 3. 自动选择最可能的滚动容器
let mainContainer = null;

if (scrollableContainers.length > 0) {
    // 选择scrollHeight最大的
    mainContainer = scrollableContainers.reduce((max, current) =>
        current.scrollHeight > max.scrollHeight ? current : max
    ).element;

    console.log('✅ 选择的滚动容器 (scrollHeight最大):');
    console.log(mainContainer);
    console.log('');

    // 暴露到全局
    window.scrollContainer = mainContainer;

    // 提供测试函数
    window.scrollDown = (px = 1142) => {
        console.log(`⬇️ 向下滚动 ${px}px...`);
        const before = mainContainer.scrollTop;
        mainContainer.scrollBy({ top: px, behavior: 'smooth' });
        setTimeout(() => {
            console.log(`   之前: ${before}px`);
            console.log(`   之后: ${mainContainer.scrollTop}px`);
            console.log(`   实际滚动: ${mainContainer.scrollTop - before}px\n`);
        }, 1000);
    };

    window.scrollUp = (px = 1142) => {
        console.log(`⬆️ 向上滚动 ${px}px...`);
        const before = mainContainer.scrollTop;
        mainContainer.scrollBy({ top: -px, behavior: 'smooth' });
        setTimeout(() => {
            console.log(`   之前: ${before}px`);
            console.log(`   之后: ${mainContainer.scrollTop}px`);
            console.log(`   实际滚动: ${before - mainContainer.scrollTop}px\n`);
        }, 1000);
    };

    window.scrollToTop = () => {
        console.log('⬆️ 滚动到顶部...');
        mainContainer.scrollTo({ top: 0, behavior: 'smooth' });
        setTimeout(() => {
            console.log(`   当前 scrollTop: ${mainContainer.scrollTop}px\n`);
        }, 1000);
    };

    window.getCurrentVideos = () => {
        const items = document.querySelectorAll('[data-index]');
        const indexes = [];
        items.forEach(item => {
            const idx = item.getAttribute('data-index');
            if (idx && idx !== '0') indexes.push(parseInt(idx));
        });
        indexes.sort((a, b) => a - b);
        console.log(`📹 当前加载的视频: ${indexes[0]} - ${indexes[indexes.length - 1]} (共${indexes.length}个)`);
        return indexes;
    };

    // 监听滚动
    let scrollTimer;
    mainContainer.addEventListener('scroll', () => {
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(() => {
            const items = document.querySelectorAll('[data-index]');
            const indexes = [];
            items.forEach(item => {
                const idx = item.getAttribute('data-index');
                if (idx && idx !== '0') indexes.push(parseInt(idx));
            });
            indexes.sort((a, b) => a - b);

            console.log(`📜 滚动完成 - scrollTop: ${mainContainer.scrollTop}px, 视频: ${indexes[0]}-${indexes[indexes.length - 1]} (${indexes.length}个)`);
        }, 500);
    });

    console.log('🎯 可用命令:');
    console.log('  scrollDown()       - 向下滚动 1142px');
    console.log('  scrollUp()         - 向上滚动 1142px');
    console.log('  scrollToTop()      - 滚动到顶部');
    console.log('  getCurrentVideos() - 查看当前加载的视频');
    console.log('  scrollContainer    - 滚动容器对象');
    console.log('\n✅ 准备完成！可以开始测试了\n');

} else {
    console.log('❌ 未找到滚动容器！');
}
