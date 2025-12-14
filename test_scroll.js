// ============================================
// Vidu 滚动容器测试脚本
// 使用方法：在 https://www.vidu.cn/create/text2video 页面的控制台直接粘贴运行
// ============================================

(function() {
    console.log('========================================');
    console.log('🔍 开始测试滚动容器');
    console.log('========================================\n');

    // ============================================
    // 1. 查找滚动容器
    // ============================================
    function findScrollContainer() {
        console.log('📦 步骤1: 查找滚动容器\n');

        // 尝试多个可能的选择器
        const selectors = [
            '[data-virtuoso-scroller="true"]',
            '[data-testid="virtuoso-scroller"]',
            'div[style*="overflow"]',
            '[class*="scroll"]',
        ];

        console.log('尝试以下选择器:');
        selectors.forEach((sel, i) => console.log(`  ${i + 1}. ${sel}`));
        console.log('');

        for (const selector of selectors) {
            const containers = document.querySelectorAll(selector);
            console.log(`🔎 尝试选择器: ${selector}`);
            console.log(`   找到 ${containers.length} 个元素`);

            for (let i = 0; i < containers.length; i++) {
                const container = containers[i];
                const scrollHeight = container.scrollHeight;
                const clientHeight = container.clientHeight;
                const canScroll = scrollHeight > clientHeight;

                console.log(`   元素 ${i + 1}:`);
                console.log(`     scrollHeight: ${scrollHeight}px`);
                console.log(`     clientHeight: ${clientHeight}px`);
                console.log(`     可滚动: ${canScroll ? '✅ 是' : '❌ 否'}`);

                if (canScroll) {
                    console.log(`   ✅ 找到滚动容器！`);
                    console.log(`   容器信息:`, container);
                    console.log('');
                    return container;
                }
            }
            console.log('');
        }

        // 从第一个视频项向上查找
        console.log('🔎 尝试从视频项向上查找父容器...');
        const firstItem = document.querySelector('[data-index="1"]') || document.querySelector('[data-index="0"]');

        if (firstItem) {
            console.log(`   找到第一个视频项:`, firstItem);
            let parent = firstItem.parentElement;
            let level = 1;

            while (parent && parent !== document.body) {
                const style = window.getComputedStyle(parent);
                const overflowY = style.overflowY;
                const overflow = style.overflow;
                const scrollHeight = parent.scrollHeight;
                const clientHeight = parent.clientHeight;
                const canScroll = scrollHeight > clientHeight;

                console.log(`   父级 ${level}:`);
                console.log(`     overflow: ${overflow}`);
                console.log(`     overflowY: ${overflowY}`);
                console.log(`     scrollHeight: ${scrollHeight}px`);
                console.log(`     clientHeight: ${clientHeight}px`);
                console.log(`     可滚动: ${canScroll ? '✅ 是' : '❌ 否'}`);

                const hasScroll = (overflowY === 'scroll' || overflowY === 'auto' || overflow === 'scroll' || overflow === 'auto');

                if (hasScroll && canScroll) {
                    console.log(`   ✅ 找到滚动容器！`);
                    console.log(`   容器信息:`, parent);
                    console.log('');
                    return parent;
                }

                parent = parent.parentElement;
                level++;
            }
        } else {
            console.log('   ❌ 未找到 data-index 的视频项');
        }

        console.log('❌ 未找到滚动容器');
        console.log('');
        return null;
    }

    // ============================================
    // 2. 检查当前视频列表
    // ============================================
    function checkVideoList() {
        console.log('📦 步骤2: 检查当前视频列表\n');

        const items = document.querySelectorAll('[data-index]');
        console.log(`找到 ${items.length} 个带 data-index 的元素`);

        if (items.length === 0) {
            console.log('❌ 未找到任何视频项！');
            console.log('');
            return;
        }

        const indexes = [];
        items.forEach(item => {
            const index = item.getAttribute('data-index');
            if (index && index !== '0') {
                indexes.push(parseInt(index));
            }
        });

        indexes.sort((a, b) => a - b);

        console.log(`有效索引范围: ${indexes[0]} - ${indexes[indexes.length - 1]}`);
        console.log(`有效索引数量: ${indexes.length}`);
        console.log(`前10个索引: ${indexes.slice(0, 10).join(', ')}`);
        console.log(`后10个索引: ${indexes.slice(-10).join(', ')}`);
        console.log('');

        return indexes;
    }

    // ============================================
    // 3. 测试滚动功能
    // ============================================
    function testScroll(container, direction = 'down', amount = 1142) {
        if (!container) {
            console.log('❌ 没有滚动容器，无法测试滚动');
            return;
        }

        console.log(`📦 步骤3: 测试${direction === 'down' ? '向下' : '向上'}滚动\n`);

        const beforeScrollTop = container.scrollTop;
        console.log(`滚动前 scrollTop: ${beforeScrollTop}px`);

        if (direction === 'down') {
            container.scrollBy({ top: amount, behavior: 'smooth' });
        } else {
            container.scrollBy({ top: -amount, behavior: 'smooth' });
        }

        setTimeout(() => {
            const afterScrollTop = container.scrollTop;
            console.log(`滚动后 scrollTop: ${afterScrollTop}px`);
            console.log(`滚动距离: ${Math.abs(afterScrollTop - beforeScrollTop)}px`);
            console.log(`滚动${afterScrollTop !== beforeScrollTop ? '✅ 成功' : '❌ 失败（可能已到达边界）'}`);
            console.log('');

            // 再次检查视频列表
            checkVideoList();
        }, 1500);
    }

    // ============================================
    // 4. 监听滚动事件
    // ============================================
    function setupScrollListener(container) {
        if (!container) {
            console.log('❌ 没有滚动容器，无法设置监听器');
            return;
        }

        console.log('📦 步骤4: 设置滚动监听器\n');
        console.log('✅ 滚动监听器已设置，滚动页面时会实时显示信息...\n');

        let lastScrollTop = -1;
        let scrollCount = 0;

        container.addEventListener('scroll', function(e) {
            scrollCount++;
            const currentScrollTop = container.scrollTop;
            const scrollHeight = container.scrollHeight;
            const clientHeight = container.clientHeight;
            const scrollPercentage = ((currentScrollTop / (scrollHeight - clientHeight)) * 100).toFixed(2);

            if (currentScrollTop !== lastScrollTop) {
                console.log(`📜 滚动事件 #${scrollCount}:`);
                console.log(`   scrollTop: ${currentScrollTop}px`);
                console.log(`   scrollHeight: ${scrollHeight}px`);
                console.log(`   clientHeight: ${clientHeight}px`);
                console.log(`   滚动进度: ${scrollPercentage}%`);
                console.log(`   变化量: ${currentScrollTop - lastScrollTop}px`);

                // 检查当前可见的视频索引
                const items = document.querySelectorAll('[data-index]');
                const visibleIndexes = [];
                items.forEach(item => {
                    const rect = item.getBoundingClientRect();
                    const index = item.getAttribute('data-index');
                    // 检查元素是否在视口中
                    if (rect.top >= 0 && rect.top <= window.innerHeight) {
                        if (index && index !== '0') {
                            visibleIndexes.push(parseInt(index));
                        }
                    }
                });

                if (visibleIndexes.length > 0) {
                    visibleIndexes.sort((a, b) => a - b);
                    console.log(`   当前视口可见索引: ${visibleIndexes[0]} - ${visibleIndexes[visibleIndexes.length - 1]}`);
                }
                console.log('');

                lastScrollTop = currentScrollTop;
            }
        });

        console.log('💡 提示: 现在可以手动滚动页面，观察控制台输出');
        console.log('💡 或者使用以下命令测试自动滚动:');
        console.log('   - window.testScrollDown()  // 向下滚动');
        console.log('   - window.testScrollUp()    // 向上滚动');
        console.log('   - window.testScrollToTop() // 滚动到顶部');
        console.log('');
    }

    // ============================================
    // 执行测试
    // ============================================
    const container = findScrollContainer();
    const indexes = checkVideoList();

    if (container) {
        // 暴露到全局，方便手动测试
        window.viduScrollContainer = container;
        window.testScrollDown = () => testScroll(container, 'down', 1142);
        window.testScrollUp = () => testScroll(container, 'up', 1142);
        window.testScrollToTop = () => {
            console.log('⬆️ 滚动到顶部...\n');
            container.scrollTo({ top: 0, behavior: 'smooth' });
            setTimeout(() => {
                console.log(`✅ 滚动完成，当前 scrollTop: ${container.scrollTop}px\n`);
                checkVideoList();
            }, 1500);
        };
        window.testScrollToBottom = () => {
            console.log('⬇️ 滚动到底部...\n');
            container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
            setTimeout(() => {
                console.log(`✅ 滚动完成，当前 scrollTop: ${container.scrollTop}px\n`);
                checkVideoList();
            }, 1500);
        };

        setupScrollListener(container);

        console.log('========================================');
        console.log('✅ 测试准备完成！');
        console.log('========================================\n');
        console.log('🎯 可用的测试命令:');
        console.log('  window.viduScrollContainer  // 滚动容器对象');
        console.log('  window.testScrollDown()     // 向下滚动 1142px');
        console.log('  window.testScrollUp()       // 向上滚动 1142px');
        console.log('  window.testScrollToTop()    // 滚动到顶部');
        console.log('  window.testScrollToBottom() // 滚动到底部');
        console.log('\n💡 现在可以手动滚动或使用命令测试！\n');
    } else {
        console.log('========================================');
        console.log('❌ 测试失败：未找到滚动容器');
        console.log('========================================\n');
        console.log('请检查:');
        console.log('  1. 是否在正确的页面 (https://www.vidu.cn/create/text2video)');
        console.log('  2. 页面是否已完全加载');
        console.log('  3. 是否有视频列表显示');
        console.log('');
    }
})();
