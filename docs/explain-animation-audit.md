# 题解动画检查记录

日期: 2026-09-29.

覆盖 Hot 100 的全部 100 份内置题解. 本次修正 74 份内容或局部图形, 其余题目在完整核对后保留算法演示; 100 题共用更新后的样式和播放器.

## 实现

- 抽离统一主题和播放时钟, 保留每道题需要的柱高、树边、矩阵和语义色, 移除原先会破坏几何的全局覆盖.
- 修复脚本语法/运行异常、错误求和/下标/指针、缺失的选择与撤销、重播残留以及树边/柱高/标签遮挡.
- 提供暂停/继续、下一步、重播、可见倍率、缩放比例、缩小/放大、适应窗口与折叠思路说明.
- 右下角可拖动缩放, 双击或 Home 适应窗口, 方向键调整; 工具提示支持键盘焦点. Esc 关闭, 关闭后停止播放.

## 验证范围

- 100/100 题逐份阅读 caption、完整 HTML 和 JavaScript, 对照固定输入、状态变化、终值、复杂度及重播.
- 100/100 题在真实浏览器中各推进 240 次单步, 共 24,000 次. 最终报告中脚本异常和横向越界均为 0.
- 100/100 题代表帧截图逐一查看, 修复后重新截图复核. 额外检查柱顶、树的父子连线、指针标签和说明区裁切.
- `node scripts/check-explains.js`: 目录与题单 100 个 slug 完全匹配; 原始 100 段和注入后 200 段脚本可编译; 10 项播放器时钟/协议检查通过.
- 完整页面实测暂停内容稳定、单步前进、倍率切换、重播、窗口拖动、拖动缩放、键盘缩放、双击适应窗口、Esc 和关闭重开.
- `pnpm run dist` 成功生成 macOS arm64 App. 安装包中的 100 份题解和 9 个播放器/界面/素材文件与源码逐字节一致; 已重新启动真实 App 验证新操作栏、单步和倍率.
- 检查对象是每题内置示例及其动画机制, 不等同于通用算法求解器的全输入穷举证明. 截图和浏览器轨迹是本轮临时验收产物, 不作为产品资源打包.

## 逐题结果

| # | 题目 | 检查输入 | 预期结果 | 内容/图形处理 | 不同文本状态 | 运行/视觉 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | [三数之和](../assets/explains/3sum.json) | [-1,0,1,2,-1,-4] | [[-1,-1,2],[-1,0,1]] | 由排序和双指针真实计算每一帧, 修复两处求和错误; 分开去重、指针相遇和结束帧, 修复固定值为 0 却声称大于 0 | 12 | 240步通过 / 截图通过 |
| 2 | [两数相加](../assets/explains/add-two-numbers.json) | {"l1":[2,4,3],"l2":[5,6,4]} | [7,0,8] | 移除工作卡片固定144px最小高度, 收紧公式和进位之间的空白 | 5 | 240步通过 / 截图通过 |
| 3 | [买卖股票的最佳时机](../assets/explains/best-time-to-buy-and-sell-stock.json) | {"rising":[7,1,5,3,6,4],"falling":[7,6,4,3,1]} | {"rising":5,"falling":0} | 明确状态框是处理当前日后的最低价, 与候选利润使用此前最低价区分 | 6 | 240步通过 / 截图通过 |
| 4 | [二叉树的中序遍历](../assets/explains/binary-tree-inorder-traversal.json) | [1,null,2,3] | [1,3,2] | 原有演示确认正确, 采用统一主题与播放器. | 7 | 240步通过 / 截图通过 |
| 5 | [二叉树的层序遍历](../assets/explains/binary-tree-level-order-traversal.json) | [3,9,20,null,null,15,7] | [[3],[9,20],[15,7]] | 原有演示确认正确, 采用统一主题与播放器. | 7 | 240步通过 / 截图通过 |
| 6 | [二叉树中的最大路径和](../assets/explains/binary-tree-maximum-path-sum.json) | [-10,9,20,null,null,15,7] | 42 | 原有演示确认正确, 采用统一主题与播放器. | 6 | 240步通过 / 截图通过 |
| 7 | [二叉树的右视图](../assets/explains/binary-tree-right-side-view.json) | [1,2,3,null,5,null,4] | [1,3,4] | 原有演示确认正确, 采用统一主题与播放器. | 5 | 240步通过 / 截图通过 |
| 8 | [爬楼梯](../assets/explains/climbing-stairs.json) | 3 | 3 | 原有演示确认正确, 采用统一主题与播放器. | 4 | 240步通过 / 截图通过 |
| 9 | [零钱兑换](../assets/explains/coin-change.json) | {"coins":[1,2,5],"amount":11} | {"count":3,"coins":[5,5,1]} | 按金额外层、硬币内层生成真实 DP 转移, 逐次显示来源和候选值; 真实记录最优硬币并回溯 11→6→1→0, 使描述和执行顺序一致; 金额格扩大到44px, 避免金额10/11标签拆行 | 33 | 240步通过 / 截图通过 |
| 10 | [组合总和](../assets/explains/combination-sum.json) | {"candidates":[2,3,6,7],"target":7} | [[2,2,3],[7]] | 用完整回溯生成选择、剪枝、撤销和收集帧, 消除多个分支直接跳变; 答案显示由当前帧确定, 重播可完全复位 | 29 | 240步通过 / 截图通过 |
| 11 | [从前序与中序遍历序列构造二叉树](../assets/explains/construct-binary-tree-from-preorder-and-inorder-traversal.json) | {"preorder":[3,9,20,15,7],"inorder":[9,3,15,20,7]} | [3,9,20,null,null,15,7] | 原有演示确认正确, 采用统一主题与播放器. | 5 | 240步通过 / 截图通过 |
| 12 | [盛最多水的容器](../assets/explains/container-with-most-water.json) | [1,8,6,2,5,4,8,3,7] | 49 | 将水面及左右指针定位绑定实际柱体几何, 修复无效 calc 和被裁切的指针; 为柱体容器设置高度变量, 使数值标签位于对应柱顶; 保持缩放后重新测量 | 8 | 240步通过 / 截图通过 |
| 13 | [将有序数组转换为二叉搜索树](../assets/explains/convert-sorted-array-to-binary-search-tree.json) | [-10,-3,0,5,9] | [0,-3,9,-10,null,5] | 修复偶数区间选右中点却显示向下取整的公式 | 6 | 240步通过 / 截图通过 |
| 14 | [随机链表的复制](../assets/explains/copy-list-with-random-pointer.json) | [[7,null],[13,0],[11,4],[10,2],[1,0]] | {"copy":[[7,null],[13,0],[11,4],[10,2],[1,0]],"originalRestored":true} | 逐节点执行穿插、random 映射、拆分三轮并展示真实指针快照; 完成态同时核对原链表恢复及副本独立; 修复阶段2声称所有副本指针已独立的过早结论; 每行两组原节点/副本, 增宽指针卡片使next/random目标完整同行显示 | 17 | 240步通过 / 截图通过 |
| 15 | [课程表](../assets/explains/course-schedule.json) | {"numCourses":2,"acyclic":[[1,0]],"cyclic":[[1,0],[0,1]]} | {"acyclic":true,"cyclic":false} | 失败终帧仍保留双向环箭头 | 5 | 240步通过 / 截图通过 |
| 16 | [每日温度](../assets/explains/daily-temperatures.json) | [73,74,75,71,69,72,76,73] | [1,1,4,2,1,1,0,0] | 补充相等温度必须留栈, 避免把递减误解成严格递减 | 9 | 240步通过 / 截图通过 |
| 17 | [字符串解码](../assets/explains/decode-string.json) | 3[a2[c]] | accaccacc | 原有演示确认正确, 采用统一主题与播放器. | 9 | 240步通过 / 截图通过 |
| 18 | [二叉树的直径](../assets/explains/diameter-of-binary-tree.json) | [1,2,3,4,5] | 3 | 原有演示确认正确, 采用统一主题与播放器. | 5 | 240步通过 / 截图通过 |
| 19 | [编辑距离](../assets/explains/edit-distance.json) | {"word1":"horse","word2":"ros"} | 3 | 增宽DP矩阵列, 使dp[i][j]完整同行显示 | 25 | 240步通过 / 截图通过 |
| 20 | [找到字符串中所有字母异位词](../assets/explains/find-all-anagrams-in-a-string.json) | {"s":"cbaebabacd","p":"abc"} | [0,6] | 实际维护 26 项滑动窗口频次, 明示每次移出/加入字符; 增加扫描完成帧与其他字符计数, 状态快照保证重播复位 | 9 | 240步通过 / 截图通过 |
| 21 | [在排序数组中查找元素的第一个和最后一个位置](../assets/explains/find-first-and-last-position-of-element-in-sorted-array.json) | {"nums":[5,7,7,8,8,10],"target":8} | [3,4] | 原有演示确认正确, 采用统一主题与播放器. | 7 | 240步通过 / 截图通过 |
| 22 | [数据流的中位数](../assets/explains/find-median-from-data-stream.json) | ["addNum(1)","addNum(2)","findMedian()","addNum(3)","findMedian()"] | [null,null,1.5,null,2] | 区分插入 O(log n) 与中位数查询 O(1) | 6 | 240步通过 / 截图通过 |
| 23 | [寻找旋转排序数组中的最小值](../assets/explains/find-minimum-in-rotated-sorted-array.json) | [4,5,6,7,0,1,2] | 0 | 原有演示确认正确, 采用统一主题与播放器. | 4 | 240步通过 / 截图通过 |
| 24 | [寻找重复数](../assets/explains/find-the-duplicate-number.json) | [1,3,4,2,2] | 2 | 统一 Floyd 为从 nums[0] 同时出发并先移动后比较, 修复快指针移动帧和路径文字 | 7 | 240步通过 / 截图通过 |
| 25 | [缺失的第一个正数](../assets/explains/first-missing-positive.json) | [3,4,-1,1] | 2 | 修复三次交换被误写为两次; 说明重复值停止交换条件和后续已归位扫描 | 7 | 240步通过 / 截图通过 |
| 26 | [二叉树展开为链表](../assets/explains/flatten-binary-tree-to-linked-list.json) | [1,2,5,3,4,null,6] | [1,2,3,4,5,6] | 真实执行前驱查找及三条赋值, 单帧只展示一次改线; 修复 pre=4/3 冲突、静态树冒充当前结构及提前展示最终指针; 仅显示已确定的先序前缀, 并展示各节点实时 left/right | 22 | 240步通过 / 截图通过 |
| 27 | [括号生成](../assets/explains/generate-parentheses.json) | 3 | ["((()))","(()())","(())()","()(())","()()()"] | 完整枚举合法前缀及每次回退, 不直接跳过分支中间状态; 修复 meters 容器缺少闭合 div 的 HTML 结构错误 | 49 | 240步通过 / 截图通过 |
| 28 | [字母异位词分组](../assets/explains/group-anagrams.json) | ["eat","tea","tan","ate","nat","bat"] | [["eat","tea","ate"],["tan","nat"],["bat"]] | 原有演示确认正确, 采用统一主题与播放器. | 8 | 240步通过 / 截图通过 |
| 29 | [打家劫舍](../assets/explains/house-robber.json) | [2,7,9,3,1] | {"amount":12,"houses":[1,3,5]} | 增宽房屋卡片使房屋编号和状态不再拆成竖排, 金额水平对齐 | 6 | 240步通过 / 截图通过 |
| 30 | [实现 Trie (前缀树)](../assets/explains/implement-trie-prefix-tree.json) | ["Trie()","insert(apple)","search(apple)","search(app)","startsWith(app)","insert(app)","search(app)"] | [null,null,true,false,true,null,true] | 为深度和单词结尾标记添加明确间距 | 10 | 240步通过 / 截图通过 |
| 31 | [相交链表](../assets/explains/intersection-of-two-linked-lists.json) | {"A":["A0:4","A1:1","C0:8","C1:4","C2:5"],"B":["B0:5","B1:6","B2:1","C0:8","C1:4","C2:5"]} | C0:8 | 按节点身份执行 p = p ? p.next : headB 的真实轨迹; 补上 null 比较帧, 修复同时切换起点的错误说明; 增宽轨迹格并把步骤与节点身份固定分行, 让两指针时间轴对齐可读 | 10 | 240步通过 / 截图通过 |
| 32 | [翻转二叉树](../assets/explains/invert-binary-tree.json) | [4,2,7,1,3,6,9] | [4,7,2,9,6,3,1] | 原有演示确认正确, 采用统一主题与播放器. | 4 | 240步通过 / 截图通过 |
| 33 | [跳跃游戏](../assets/explains/jump-game.json) | {"reachable":[2,3,1,1,4],"blocked":[3,2,1,0,4]} | {"reachable":true,"blocked":false} | reset清空所有marker文本及颜色, 修复等待下一案例时残留上轮不可达标签 | 7 | 240步通过 / 截图通过 |
| 34 | [跳跃游戏 II](../assets/explains/jump-game-ii.json) | [2,3,1,1,4] | 2 | 明确 BFS 层是最少跳数分组, 不排除可用更多跳数到达早期下标; 修复只有扫完整层才能得出答案的过强断言; 增宽数组格避免边界结算/第1层/当前层等关键状态碎行 | 6 | 240步通过 / 截图通过 |
| 35 | [数组中的第K个最大元素](../assets/explains/kth-largest-element-in-an-array.json) | {"nums":[3,2,1,5,6,4],"k":2} | 5 | 改为用真实分区过程生成 17 帧, 显示每次比较、交换、边界和舍弃区间; caption 明确随机化期望与最坏复杂度; 按关键帧截图修正本题局部图形几何或标签排布, 不修改公共主题. | 17 | 240步通过 / 截图通过 |
| 36 | [二叉搜索树中第 K 小的元素](../assets/explains/kth-smallest-element-in-a-bst.json) | {"root":[5,3,6,2,4,null,null,1],"k":3} | 3 | 按关键帧截图修正本题局部图形几何或标签排布, 不修改公共主题. | 5 | 240步通过 / 截图通过 |
| 37 | [柱状图中最大的矩形](../assets/explains/largest-rectangle-in-histogram.json) | [2,1,5,6,2,3] | 10 | 明确空栈时直接入栈, 不引用不存在的栈顶.; 按关键帧截图修正本题局部图形几何或标签排布, 不修改公共主题. | 12 | 240步通过 / 截图通过 |
| 38 | [电话号码的字母组合](../assets/explains/letter-combinations-of-a-phone-number.json) | 23 | ["ad","ae","af","bd","be","bf","cd","ce","cf"] | 由真实 DFS 生成 35 帧, 分开显示选择、记录、撤销; 未来答案显示占位, 只在记录后显示组合; 增加输出规模与复杂度说明 | 35 | 240步通过 / 截图通过 |
| 39 | [环形链表](../assets/explains/linked-list-cycle.json) | {"head":[3,2,0,-4],"pos":1} | true | 明确至少移动一轮后才判断相遇; 初始位置不作为相遇结论; 按关键帧截图修正本题局部图形几何或标签排布, 不修改公共主题. | 4 | 240步通过 / 截图通过 |
| 40 | [环形链表 II](../assets/explains/linked-list-cycle-ii.json) | {"head":[3,2,0,-4],"pos":1} | {"index":1,"value":2} | 按关键帧截图修正本题局部图形几何或标签排布, 不修改公共主题. | 8 | 240步通过 / 截图通过 |
| 41 | [最长公共子序列](../assets/explains/longest-common-subsequence.json) | {"text1":"abcde","text2":"ace"} | {"length":3,"subsequence":"ace"} | 原有演示确认正确, 采用统一主题与播放器. | 17 | 240步通过 / 截图通过 |
| 42 | [最长连续序列](../assets/explains/longest-consecutive-sequence.json) | [100,4,200,1,3,2] | 4 | 用集合检查和扩展生成完整 13 帧; 显示各段长度与历史最大值, 补齐 3/2 跳过步骤 | 13 | 240步通过 / 截图通过 |
| 43 | [最长递增子序列](../assets/explains/longest-increasing-subsequence.json) | [10,9,2,5,3,7,101,18] | 4 | 追加分支明确不存在 >= x 的结尾, 返回的是尾后插入位置 | 24 | 240步通过 / 截图通过 |
| 44 | [最长回文子串](../assets/explains/longest-palindromic-substring.json) | ["babad","cbbd"] | ["bab","bb"] | 按真实中心扩展生成 30 帧, 展示全部中心; 越界时显示真实 L/R 并说明先检查边界; 说明仅在当前回文更长时刷新答案, 同长/更短继续保留原值. | 30 | 240步通过 / 截图通过 |
| 45 | [无重复字符的最长子串](../assets/explains/longest-substring-without-repeating-characters.json) | abcabcbb | 3 | 原有演示确认正确, 采用统一主题与播放器. | 8 | 240步通过 / 截图通过 |
| 46 | [最长有效括号](../assets/explains/longest-valid-parentheses.json) | )()()) | 4 | 原有演示确认正确, 采用统一主题与播放器. | 8 | 240步通过 / 截图通过 |
| 47 | [二叉树的最近公共祖先](../assets/explains/lowest-common-ancestor-of-a-binary-tree.json) | {"root":[3,5,1,6,2,0,8,null,null,7,4],"p":5,"q":4} | 5 | 统一为真实完整后序汇总生成 10 帧; 每帧提供 extra 并显示左右子树返回值; caption 明确完整后序与提前返回版本区别 | 10 | 240步通过 / 截图通过 |
| 48 | [LRU 缓存](../assets/explains/lru-cache.json) | {"capacity":2,"ops":["put(1,1)","put(2,2)","get(1)","put(3,3)","get(2)","put(4,4)","get(1)","get(3)","get(4)"]} | [null,null,1,null,-1,null,-1,3,4] | 原有演示确认正确, 采用统一主题与播放器. | 10 | 240步通过 / 截图通过 |
| 49 | [多数元素](../assets/explains/majority-element.json) | [2,2,1,1,1,2,2] | 2 | 原有演示确认正确, 采用统一主题与播放器. | 8 | 240步通过 / 截图通过 |
| 50 | [二叉树的最大深度](../assets/explains/maximum-depth-of-binary-tree.json) | [3,9,20,null,null,15,7] | 3 | 增加4条局部SVG父子连线, 保留节点网格位置和全部运行状态. | 5 | 240步通过 / 截图通过 |
| 51 | [乘积最大子数组](../assets/explains/maximum-product-subarray.json) | [2,3,-2,4] | 6 | 原有演示确认正确, 采用统一主题与播放器. | 4 | 240步通过 / 截图通过 |
| 52 | [最大子数组和](../assets/explains/maximum-subarray.json) | [-2,1,-3,4,-1,2,1,-5,4] | {"sum":6,"range":[3,6],"values":[4,-1,2,1]} | 仅将调度函数改名为 startPlayback 并更新两处引用, 保留算法起点变量 | 10 | 240步通过 / 截图通过 |
| 53 | [寻找两个正序数组的中位数](../assets/explains/median-of-two-sorted-arrays.json) | {"nums1":[1,2],"nums2":[3,4]} | 2.5 | 补充左侧大小 floor((m+n+1)/2) 和奇数取左最大; 复杂度说明涵盖较短数组为空的边界 | 4 | 240步通过 / 截图通过 |
| 54 | [合并区间](../assets/explains/merge-intervals.json) | [[1,3],[2,6],[8,10],[15,18]] | [[1,6],[8,10],[15,18]] | 每帧重置条形透明度; 定向验证 render(1)→render(0); 修改结果区说明区分最后一项当前区间; 按关键帧截图修正本题局部图形几何或标签排布, 不修改公共主题. | 5 | 240步通过 / 截图通过 |
| 55 | [合并 K 个升序链表](../assets/explains/merge-k-sorted-lists.json) | [[1,4,5],[1,3,4],[2,6]] | [1,1,2,3,4,4,5,6] | 标题明确按值展示候选, 不是堆数组顺序; 状态文字根据后继存在与否分别描述 | 9 | 240步通过 / 截图通过 |
| 56 | [合并两个有序链表](../assets/explains/merge-two-sorted-lists.json) | {"l1":[1,2,4],"l2":[1,3,4]} | [1,1,2,3,4,4] | 原有演示确认正确, 采用统一主题与播放器. | 7 | 240步通过 / 截图通过 |
| 57 | [最小栈](../assets/explains/min-stack.json) | ["push(-2)","push(0)","push(-3)","getMin()","pop()","top()","getMin()"] | [null,null,null,-3,null,0,-2] | 原有演示确认正确, 采用统一主题与播放器. | 8 | 240步通过 / 截图通过 |
| 58 | [最小路径和](../assets/explains/minimum-path-sum.json) | [[1,3,1],[1,5,1],[4,2,1]] | {"sum":7,"path":[[0,0],[0,1],[0,2],[1,2],[2,2]]} | 原有演示确认正确, 采用统一主题与播放器. | 10 | 240步通过 / 截图通过 |
| 59 | [最小覆盖子串](../assets/explains/minimum-window-substring.json) | {"s":"ADOBECODEBANC","t":"ABC"} | BANC | 用真实计数与双指针生成完整 35 帧; 每次扩张、记录候选、收缩分别显示 | 35 | 240步通过 / 截图通过 |
| 60 | [移动零](../assets/explains/move-zeroes.json) | [0,1,0,3,12] | [1,3,12,0,0] | 从真实数组操作生成 14 帧, 分离读取与写入完成; 同位置合并读/写标签, 完成后不显示越界指针 | 14 | 240步通过 / 截图通过 |
| 61 | [N 皇后](../assets/explains/n-queens.json) | 4 | [[".Q..","...Q","Q...","..Q."],["..Q.","Q...","...Q",".Q.."]] | 真实回溯生成 84 帧, 包含所有候选、放置、撤销与失败返回; 两份已记录方案持续保留高亮 | 84 | 240步通过 / 截图通过 |
| 62 | [下一个排列](../assets/explains/next-permutation.json) | [1,2,3] | [1,3,2] | 按关键帧截图修正本题局部图形几何或标签排布, 不修改公共主题. | 4 | 240步通过 / 截图通过 |
| 63 | [岛屿数量](../assets/explains/number-of-islands.json) | [["1","1","0","0","0"],["1","1","0","0","0"],["0","0","1","0","0"],["0","0","0","1","1"]] | 3 | 按真实扫描+DFS 生成 29 帧; 显示水域跳过、已访问跳过与逐格扩展, 修正阶段条和当前访问图例; 按关键帧截图修正本题局部图形几何或标签排布, 不修改公共主题. | 29 | 240步通过 / 截图通过 |
| 64 | [回文链表](../assets/explains/palindrome-linked-list.json) | [1,2,2,1] | true | 说明逐次修改节点2/3的 next, 然后 slow.next 接新头; 恢复阶段明确接回原后半头 | 6 | 240步通过 / 截图通过 |
| 65 | [分割回文串](../assets/explains/palindrome-partitioning.json) | aab | [["a","a","b"],["aa","b"]] | 由真实递归生成检查、选择、记录、撤销、剪枝和结束帧; 结束与回溯使用各自准确说明 | 20 | 240步通过 / 截图通过 |
| 66 | [分割等和子集](../assets/explains/partition-equal-subset-sum.json) | [1,5,11,5] | {"result":true,"subsets":[[1,5,5],[11]]} | 原有演示确认正确, 采用统一主题与播放器. | 37 | 240步通过 / 截图通过 |
| 67 | [划分字母区间](../assets/explains/partition-labels.json) | ababcbacadefegdehijhklij | [9,7,8] | 在切分帧使用刚完成片段的起点, 非切分帧使用当前 start; Node VM 对三次切分文字和起点做定向断言 | 25 | 240步通过 / 截图通过 |
| 68 | [杨辉三角](../assets/explains/pascals-triangle.json) | numRows=5 | [[1],[1,1],[1,2,1],[1,3,3,1],[1,4,6,4,1]] | 按行逐格生成15个状态, 隐藏未来值, 每步高亮确切父格. | 16 | 240步通过 / 截图通过 |
| 69 | [路径总和 III](../assets/explains/path-sum-iii.json) | root=[10,5,-3,3,2,null,11,3,-2,null,1], target=8 | {"count":3,"paths":[[5,3],[5,2,1],[-3,11]]} | 真实DFS生成访问、查找、记录、回溯帧, 可见前缀频次表, 最后恢复为0→1.; 视觉核验修正: 原ASCII斜线悬在节点之间, 下层父子关系不明确. 已改精确坐标SVG树边, 9节点身份与JS高亮保持一致. | 29 | 240步通过 / 截图通过 |
| 70 | [完全平方数](../assets/explains/perfect-squares.json) | n=12 | 3 | 所有候选平方数逐个比较, 每帧保存并覆盖完整dp状态, 重播恢复问号. | 27 | 240步通过 / 截图通过 |
| 71 | [全排列](../assets/explains/permutations.json) | nums=[1,2,3] | [[1,2,3],[1,3,2],[2,1,3],[2,3,1],[3,1,2],[3,2,1]] | 真实回溯生成每次选择、记录、撤销, 逐帧路径最多变化一个元素. | 38 | 240步通过 / 截图通过 |
| 72 | [除了自身以外数组的乘积](../assets/explains/product-of-array-except-self.json) | nums=[1,2,3,4]; 补充[-1,1,0,-3,3] | {"main":[24,12,8,6],"zero":[0,0,9,0,0]} | 原有演示确认正确, 采用统一主题与播放器. | 10 | 240步通过 / 截图通过 |
| 73 | [删除链表的倒数第 N 个结点](../assets/explains/remove-nth-node-from-end-of-list.json) | head=[1,2,3,4,5], n=2 | [1,2,3,5] | 删除帧跳过节点4, 链上明确相邻显示3→5, 保留原身份指针标签. | 8 | 240步通过 / 截图通过 |
| 74 | [反转链表](../assets/explains/reverse-linked-list.json) | head=[1,2,3,4,5] | [5,4,3,2,1] | 按阶段计算prev真实位置, 保留next引用, 增加指针数值和反转段null终点.; 视觉核验修正: 分开的反转链和剩余链、null边界、curr/next清楚; prev标签对比弱, 已单独提高已反转节点标签对比. | 17 | 240步通过 / 截图通过 |
| 75 | [K 个一组翻转链表](../assets/explains/reverse-nodes-in-k-group.json) | head=[1,2,3,4,5], k=3 | [3,2,1,4,5] | 真实指针更新生成帧; 节点卡片位置固定, 显示每个真实next、curr、prev、next和组前驱.; 视觉核验修正: 固定身份卡片的next方向正确; curr文字在蓝底上不清晰且next挤成两行. 已加宽卡片并提高活动指针文字对比. | 16 | 240步通过 / 截图通过 |
| 76 | [轮转数组](../assets/explains/rotate-array.json) | nums=[1,2,3,4,5,6,7], k=3 | [5,6,7,1,2,3,4] | 每对交换实际生成快照, 明示交换下标和值; 进度与步骤同步. | 10 | 240步通过 / 截图通过 |
| 77 | [旋转图像](../assets/explains/rotate-image.json) | matrix=[[1,2,3],[4,5,6],[7,8,9]] | [[7,4,1],[8,5,2],[9,6,3]] | 逐对生成转置和行反转状态, 标注坐标映射, 进度跟随实际步骤. | 8 | 240步通过 / 截图通过 |
| 78 | [腐烂的橘子](../assets/explains/rotting-oranges.json) | grid=[[2,1,1],[1,1,0],[0,1,1]]; 不可达例; 无新鲜例 | {"minutes":4,"unreachable":-1,"noFresh":0} | 从原网格真实BFS生成rottenAt/frontiers, 第3分钟前沿仅(2,1); 不可达例补完整输入. | 5 | 240步通过 / 截图通过 |
| 79 | [搜索二维矩阵](../assets/explains/search-a-2d-matrix.json) | matrix=[[1,3,5,7],[10,11,16,20],[23,30,34,60]], target=3/13 | [true,false] | 公式改为⌊mid/n⌋, 其余每轮区间与结果正确. | 8 | 240步通过 / 截图通过 |
| 80 | [搜索二维矩阵 II](../assets/explains/search-a-2d-matrix-ii.json) | 5×5标准升序矩阵, target=5/20 | [true,false] | 进度按访问步数更新, 找到/越界时完成, 切换案例清零. | 17 | 240步通过 / 截图通过 |
| 81 | [搜索旋转排序数组](../assets/explains/search-in-rotated-sorted-array.json) | nums=[4,5,6,7,0,1,2], target=0 | 4 | 视觉核验修正: 原left/mid/right三标签横向溢出同一格并覆盖邻格. 已改为正常流纵向标签并适度加宽格子.; 上轮只扩大cell而遗漏原固定grid列宽38px, 新截图显示相邻格轻微重叠. 已同步grid列宽56/60/52px. | 3 | 240步通过 / 截图通过 |
| 82 | [搜索插入位置](../assets/explains/search-insert-position.json) | nums=[1,3,5,6], target=5/2/7 | [2,1,4] | 视觉核验修正: 原left/right/答案与分隔点挤成多行, 可读性差. 已每个标签独立一行并加宽格子.; 上轮只扩大cell而遗漏原固定grid列宽38px, 新截图显示相邻格轻微重叠. 已同步grid列宽56/60/52px. | 13 | 240步通过 / 截图通过 |
| 83 | [矩阵置零](../assets/explains/set-matrix-zeroes.json) | 边界零:[[0,1,2,0],[3,4,5,2],[1,3,1,5]]; 内部零:[[1,1,1],[1,0,1],[1,1,1]] | {"boundary":[[0,0,0,0],[0,4,5,0],[0,3,1,0]],"interior":[[1,0,1],[0,0,0],[1,0,1]]} | 增加内部0例的写标记、清内部、保留边界过程, 标题同步输入, 明确下标大于0. | 9 | 240步通过 / 截图通过 |
| 84 | [只出现一次的数字](../assets/explains/single-number.json) | nums=[4,1,2,1,2] | 4 | 视觉核验修正: 原每格都显示“当前i”, 造成错误指针暗示. 已仅对活动格显示该标签并避免换行. | 5 | 240步通过 / 截图通过 |
| 85 | [滑动窗口最大值](../assets/explains/sliding-window-maximum.json) | nums=[1,3,-1,-3,5,3,6,7], k=3 | [3,3,5,5,6,7] | 首帧明确队列为空; 后续队尾比较和输出轨迹保持正确. | 8 | 240步通过 / 截图通过 |
| 86 | [颜色分类](../assets/explains/sort-colors.json) | nums=[2,0,2,1,1,0] | [0,0,1,1,2,2] | 视觉核验修正: left/scan同格时分隔点制造空行, 蓝底指针对比弱. 已独立逐行放标签、加宽并提高指针对比.; 上轮只扩大cell而遗漏原固定grid列宽38px, 新截图显示相邻格轻微重叠. 已同步grid列宽56/60/52px. | 8 | 240步通过 / 截图通过 |
| 87 | [排序链表](../assets/explains/sort-list.json) | head=[4,2,1,3] | [1,2,3,4] | 实际next切段/归并生成快照, 分列输出、左右剩余、未分组, 保持N0…N3固定身份并列出全部next. | 15 | 240步通过 / 截图通过 |
| 88 | [螺旋矩阵](../assets/explains/spiral-matrix.json) | matrix=[[1,2,3,4],[5,6,7,8],[9,10,11,12]] | [1,2,3,4,8,12,11,10,9,5,6,7] | 完成时显示实际终止边界, 脚本封装IIFE隔离顶层名称. | 14 | 240步通过 / 截图通过 |
| 89 | [和为 K 的子数组](../assets/explains/subarray-sum-equals-k.json) | nums=[1,1,1], k=2 | 2 | 真实生成每轮查询和写入两个独立帧, 命中时只显示旧历史, 明确先查后记. | 7 | 240步通过 / 截图通过 |
| 90 | [子集](../assets/explains/subsets.json) | nums=[1,2,3] | [[],[1],[2],[1,2],[3],[1,3],[2,3],[1,2,3]] | 原有演示确认正确, 采用统一主题与播放器. | 5 | 240步通过 / 截图通过 |
| 91 | [两两交换链表中的节点](../assets/explains/swap-nodes-in-pairs.json) | head=[1,2,3,4] | [2,1,4,3] | 真实逐条执行first.next、second.next、prev.next并显示各节点next; 完整交换后推进prev.; 视觉核验修正: 原dummy文字超出窄卡片, 活动second/next文字蓝底对比弱. 已加宽节点卡并提高活动角色文字对比. | 12 | 240步通过 / 截图通过 |
| 92 | [对称二叉树](../assets/explains/symmetric-tree.json) | root=[1,2,2,3,4,4,3] / [1,2,2,null,3,null,3] | [true,false] | 真实队列生成逐对状态与4组空子节点比较, 当前对从待队列移除, 失败立即停止, 补SVG语义错误色.; 完整图显示原900宽viewBox加max-height200将文字缩至约6px; 已解除高度压缩、放大节点文字并中文化队列位置. | 10 | 240步通过 / 截图通过 |
| 93 | [前 K 个高频元素](../assets/explains/top-k-frequent-elements.json) | nums=[1,1,1,2,2,3], k=2 | [1,2] | 实际建立频率桶数组, 累积同频元素, 扫描直接读桶并在第k项停止.; 视觉核验修正: 桶说明被迫将“元素”拆行, 活动频次数字蓝底蓝字. 已缩短冗余标签并提高活动计数/标签对比. | 18 | 240步通过 / 截图通过 |
| 94 | [接雨水](../assets/explains/trapping-rain-water.json) | height=[0,1,0,2,1,0,1,3,2,1,2,1] | 6 | 补全forEach结束符; 独立逐轮算法核对L/R、两侧max、单步水量与总量全部一致. | 12 | 240步通过 / 截图通过 |
| 95 | [两数之和](../assets/explains/two-sum.json) | nums=[2,7,11,15], target=9 | [0,1] | 原有演示确认正确, 采用统一主题与播放器. | 5 | 240步通过 / 截图通过 |
| 96 | [不同路径](../assets/explains/unique-paths.json) | m=3,n=7 | 28 | 视觉核验修正: 原坐标被拆为两行. 已扩大固定网格列宽并将坐标设为单行, 保留7列结构. | 11 | 240步通过 / 截图通过 |
| 97 | [有效的括号](../assets/explains/valid-parentheses.json) | s="([])" / "([)]" | [true,false] | 原有演示确认正确, 采用统一主题与播放器. | 7 | 240步通过 / 截图通过 |
| 98 | [验证二叉搜索树](../assets/explains/validate-binary-search-tree.json) | root=[2,1,3] / [5,1,4,null,null,3,6] / [5,1,7,null,null,4,8] | [true,false,false] | 增加父7下的4违反祖先5的例子; 明确32位整数可用64位边界, JS可用±Infinity.; 视觉核验修正: 原末层4在视觉上位于节点1之下, 虽标签说明属于7仍易误解. 已用精确SVG连线将4和8明确连到7. | 12 | 240步通过 / 截图通过 |
| 99 | [单词拆分](../assets/explains/word-break.json) | s="catsandog", dict=[cat,cats,sand,and,dog] | false | 视觉核验修正: 字符区间、dp下标、转移说明完整; 当前可达dp的true与蓝底对比弱, 已单独调整当前值文字对比. | 7 | 240步通过 / 截图通过 |
| 100 | [单词搜索](../assets/explains/word-search.json) | board=[[A,B,C,E],[S,F,C,S],[A,D,E,E]], word=ABCCED/SEE/ABCB | [true,true,false] | 真实DFS生成三个案例, 显示SEE首个S失败换起点、ABCB禁复用及逐格撤销、尝试第二个A后最终失败.; 视觉核验修正: 成功路径和ABCCED字符顺序完整, 坐标蓝底对比偏弱, 已提高已访问/当前格坐标文字对比. | 31 | 240步通过 / 截图通过 |
