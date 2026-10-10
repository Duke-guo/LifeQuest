# 参与贡献 / Contributing

感谢你有兴趣帮忙。中文、English 都可以。

## 开始之前

项目有一条**不可动摇的设计原则**：**不制造焦虑**。任何会让用户产生「被工具逼着走」感觉的功能（排行榜、断签惩罚、强制每日任务、红点轰炸）都不会被接受。提交前请先读 [AGENT.md](AGENT.md)（项目纲要）和 [docs/架构与数据设计.md](docs/架构与数据设计.md)。

## 开发环境

```bash
node -v            # 需要 20 或更高
npm install
npm run dev        # 启动开发模式
npm run typecheck  # 提交前请保证 0 错误
```

## 提交 PR 的流程

1. Fork 本仓库，从 `main` 开一个分支：`git switch -c feat/你的改动`
2. 改动尽量小而聚焦，一个 PR 只做一件事
3. 保证 `npm run typecheck` 通过；界面改动请附一张截图（深浅色主题各一张更好）
4. 提交信息用一句话说清「改了什么、为什么」，中英文都行
5. 在 PR 描述里写：改动目的 / 影响范围 / 你怎么验证的

## 代码约定

- **TypeScript 严格模式**，不要用 `any` 蒙混；共用类型放在 `src/shared/types.ts`
- 渲染进程通过 `window.api.*` 访问文件系统，**不要**直接在渲染进程里用 Node API
- 所有写入磁盘的数据都要能被老版本读取：改结构时请在 `src/main/dataStore.ts` 的迁移表里登记 `schemaVersion`，新字段一律给默认值
- 界面文案用中文，风格口语化、不说教
- 日期/日程相关的逻辑请复用 `src/renderer/src/utils/` 里的函数（`schedule.ts` 展开日程、`dayColor.ts` 算配色、`deadline.ts` 算截止），不要在组件里重写一套

## 数据格式约定（重要）

- 结构化数据 → `config/*.json`、`tasks/tasks.json`、`plans/plans.json`，每个文件带 `schemaVersion`
- 长文本 → `journal/YYYY-MM-DD.md`（日记）、`journal/w<周日>.md`（周记）、`notes/<uuid>.md`（笔记）
- 一律 **UTF-8、LF、两空格缩进**；`.gitattributes` 已统一换行
- **不要把任何个人数据提交进仓库**：`LifeQuest-Data/`、`*.lnk` 已在 `.gitignore` 里，请勿强制添加

## 可以帮忙的方向

- 应用图标（`build/icon.ico`，256×256 起）与界面细节打磨
- macOS / Linux 打包目标（`package.json` 的 `build` 字段）
- 英文界面文案（i18n）
- 更多导入方式：ICS 日历、待办清单文本、Markdown 批量导入
- 无障碍与键盘操作
- 文档与截图更新

## 报告 Bug

请用 Issue 模板，并尽量附上：操作系统与版本、复现步骤、期望结果、实际结果、截图或控制台报错。
**注意**：贴 `settings.json` 或日志前请先把 API Key、个人日记内容删掉。
