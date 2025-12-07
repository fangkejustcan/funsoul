# FunSoul 项目更新日志

## 2025-12-08

### Git 初始化
- 初始化了 git 仓库
- 添加了所有项目文件（P5LLM.js, game.js, index.html）
- 创建初始提交
- 推送到远程仓库 git@github.com:fangkejustcan/funsoul.git

### Bug 修复
1. **修复 p5.js 保留函数名冲突**
   - 问题：game.js:435 使用了变量名 `line`，与 p5.js 的保留函数 `line()` 冲突
   - 解决：将变量 `line` 重命名为 `lineNum`（game.js:435, 457, 458, 459）

2. **修复文件加载错误**
   - 问题：index.html 引用的 style.css 文件不存在，导致 ERR_FILE_NOT_FOUND 错误
   - 解决：创建了基础的 style.css 文件

3. **修复 planck.js 'aabb' undefined 错误**
   - 问题：`Cannot read properties of undefined (reading 'aabb')` - 来自 planck.js 物理引擎
   - 原因：可能是库版本更新导致的兼容性问题（项目创建于2年多前）
   - 尝试的解决方案：
     - 调整 sprites 初始化顺序：先创建 intentions → objects → 最后创建 links
     - 确保在创建 links 时，所有被引用的 sprites 都已完全初始化
     - **降级 p5.js 版本：从 1.11.4 → 1.5.0（2022年版本）**
     - **使用本地旧版本的 p5play 和 planck 文件（替代 CDN 链接）**
   - 状态：等待更换更新版本的 p5play（需要支持 attractTo 方法）

## 项目结构
```
funsoul/
├── P5LLM.js        # P5LLM 库，集成 PlayKit SDK
├── game.js         # 游戏主逻辑
├── index.html      # 入口文件
├── style.css       # 样式文件
├── planck.min.js   # 物理引擎（本地旧版本）
├── p5play.js       # p5play 库（本地旧版本）
├── p5play.min.js   # p5play 压缩版（本地旧版本）
├── README.md       # 说明文档
└── claude.md       # 项目更新日志
```

## 技术栈
- p5.js v1.5.0 (2022年版本，从 v1.11.4 降级)
- p5play v3 (本地旧版本文件)
- planck.js (本地旧版本物理引擎)
- p5.touchgui v0.5.2
- PlayKit SDK
- DeepSeek Chat API
