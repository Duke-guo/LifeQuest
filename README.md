# LifeQuest · 把现实生活当成一场可以自己定规则的游戏

> 日记 / 日历 / 待办 / 笔记 / 活动计划，一处聚合。
> **本地优先**：所有数据都是你自己电脑上的普通 Markdown 和 JSON 文件，随时能打开、复制、备份、带走。
> **游戏化只是可选外壳**：没有排行榜，没有连续打卡惩罚，没有强制任务。

![license](https://img.shields.io/badge/license-MIT-green) ![platform](https://img.shields.io/badge/平台-Windows%20%7C%20macOS%20%7C%20Linux-blue) ![stack](https://img.shields.io/badge/技术栈-Electron%20%2B%20Vue%203%20%2B%20TypeScript-orange)

**🌐 产品主页（含截图与下载）：<https://duke-guo.github.io/LifeQuest/>**

![首页](docs/screenshots/01-home.png)

---

## 这是什么

给「想认真记录生活，但讨厌被工具 PUA」的人。

- 有课程表、有 deadline、想记日记和笔记，但不想在五六个 App 之间来回切
- 喜欢游戏化的反馈感（等级、成就、完成度），但反感打卡断签、每日强制任务、排行榜比较
- 在意数据归属：不想把日记存在别人的服务器上

## 它不是什么

- 不是打卡类自律 App：**不制造焦虑**是硬性设计原则，失败没有惩罚
- 不是云笔记：默认不联网、不上传（唯一联网功能是「AI 识图导入」，用你自己的 API Key，可关闭）
- 不是团队协作工具：单人本地应用

---

## 功能一览

### 日历：一周是一条连续的时间带

![周视图](docs/screenshots/02-week.png)

- **一列一天，滚轮左右连贯滑动**（不是一页一周），进页面自动把今天放在屏幕正中
- 鼠标悬停时下边缘跟着鼠标平缓起伏；移开就重新突出**今天**
- 每天自动配色：**色相＝忙碌程度、饱和度＝心情、明度＝天气**
- 一天的「性质」可手动指定：上课 / 周末 / 放假停课 / 考试 / 空白 / 自定义
- 忙碌程度可手写覆盖；过完的日子按完成度给 **S / A / B / C / D** 评级

### 日视图：时间轴 + 截止压迫带

![日视图](docs/screenshots/03-day.png)

- 左时间轴 06:00–24:00，日程按时间块排；图上直接增删改、调重要度
- 截止型任务画成**横线 + 渐变**；结束时间可选 **24:00 = 当天结束**

### 任务：主线 / 支线 / 每日，以及会自己冒头的 ddl

![任务页](docs/screenshots/04-tasks.png)

- 重要度 1–5 星，卡片上的**罗盘指针**跟着指向
- 重复：每天 / 工作日 / 每周 / 双周 / **每 N 天** / 每月；支持**重复链**（一周上两次）
- **跳过某几次**：点任务卡的日历按钮，列出所有日期 → 只勾某一天 / 跳到那一周 / **删掉这一次**（放假调课，带确认）
- **截止清单**：ddl 每天自动冒头，越接近截止显示重要度越高
- 支线可**拖到主线**上变成子任务；长列表拖拽自动滚动

### 日记：每日日记与周记在同一页

- 每日日记 + 周记（`w<周日>.md`），天气/心情参与日历配色
- 「葡萄藤」视图：果实＝写过日记的日子，滚动与日历同步

### 笔记：Markdown + 块级即时编辑

- 段落级就地编辑、图片/附件（Ctrl+V 贴截图）、标签、评价
- **关联**：把笔记关联到任务/另一篇笔记/计划，还能一键关联「今天的课」

### 计划、知识地图、主线地图

- **学期计划**：校历起止、假期（放假自动停课）、考试周
- **活动计划**：给一段时间定个主题，铺到日历上
- **知识地图**：笔记 / 任务 / 标签的关系网
- **主线 / 支线地图**：主轴是学期、支线是假期，日记是蓝点，点一下回到那一天

### 赛季 · 成长 · 回顾

- **称号为主、等级藏角落**（记录者 → 生活史官…）
- **里程碑成就**（第一次做某件事就点亮）+ **自定义成就**（可只统计某个赛季）
- **赛季回顾**：应用内直接看统计 / 高光时刻 / 你写过的原话，可存 Markdown

### 新手导引 · 每页帮助 · 示例数据

- 左上角罗盘 →「新手导引」；**每个页面右上角「?」**是本页说明
- 第一次用可**载入示例数据**（带「示例」前缀，随时一键清空）

---

## 下载即用

**推荐从产品主页下载：<https://duke-guo.github.io/LifeQuest/>**，或直接到 [Releases](../../releases) 挑对应系统的文件：

| 系统 | 文件 | 说明 |
|---|---|---|
| **Windows** | `LifeQuest-*-portable.exe` | 免安装，双击就能跑；数据落在 exe 同级的 `LifeQuest-Data/` |
| **macOS** | `LifeQuest-*-mac-x64.dmg` / `-mac-arm64.dmg` | Intel 选 x64，Apple 芯片选 arm64 |
| **Linux** | `LifeQuest-*-linux-x86_64.AppImage` | `chmod +x` 后运行；也有 `.deb` |

**首次运行提示**（个人项目，未购买代码签名证书，属正常现象）：

- Windows：「未知发布者」→「更多信息 → 仍要运行」
- macOS：右键 App →「打开」；若提示"已损坏"，执行 `xattr -cr /Applications/LifeQuest.app`
- Linux：个别发行版报沙箱错误时，用 `./LifeQuest-*.AppImage --no-sandbox`

---

# 开发者指南 · 项目全貌

> 下面面向**想参与开发 / 想读懂这个项目**的人，把技术栈、架构、每个目录和文件的职责、数据如何管理、怎么构建与发布讲清楚。更细的数据契约见 [docs/架构与数据设计.md](docs/架构与数据设计.md)，协作约定见 [CONTRIBUTING.md](CONTRIBUTING.md) 与 [AGENT.md](AGENT.md)。

## 技术栈

| 层 | 技术 | 版本 | 作用 |
|---|---|---|---|
| 桌面壳 | Electron | 44.x | 跨平台桌面运行时，主进程 + 渲染进程 |
| 界面 | Vue 3 | 3.5.x | 组合式 API（`<script setup>`） |
| 状态 | Pinia | 4.x | 全局 store，按「数据域」划分 |
| 构建 | Vite | 7.x | 通过 **electron-vite** 分别打包 main / preload / renderer |
| 语言 | TypeScript | 5.9 | 严格模式，共享类型集中在 `src/shared/types.ts` |
| 打包 | electron-builder | 26.x | 生成 Windows portable / macOS dmg+zip / Linux AppImage+deb |
| 字体 | ZCOOL KuaiLe + Baloo 2 | — | 中文标题字体 + 圆润数字字体（woff2 内嵌） |

**没有数据库、没有后端、没有云服务**——一切读写都落在本地文件上。

## 架构分层

```
┌─────────────────────────────────────────────────────────┐
│  src/main        Electron 主进程（Node 环境，能碰文件系统）      │
│    index.ts      窗口/菜单/更新检查/窗口控制/调试装置           │
│    ipc.ts        所有 data:* / ai:* / update:* 的 IPC 处理   │
│    dataStore.ts  数据根目录定位、建目录、schemaVersion 迁移、    │
│                  文件读写与「防目录穿越」校验                  │
├─────────────────────────────────────────────────────────┤
│  src/preload     contextBridge 白名单：把 window.api 暴露给界面 │
├─────────────────────────────────────────────────────────┤
│  src/renderer/src   Vue 界面（跑在渲染进程，只有 window.api）    │
│    services/data.ts   ← 唯一的数据入口 dataApi（关键接缝）      │
│    stores/            Pinia，按数据域封装状态与持久化           │
│    views/             9 个视图 + 设置                          │
│    components/        可复用 UI 组件                           │
│    utils/             纯函数：日程展开、配色、截止、Markdown…    │
├─────────────────────────────────────────────────────────┤
│  src/shared/types.ts  主进程与渲染进程共用的类型（数据契约唯一来源） │
└─────────────────────────────────────────────────────────┘
```

**一条写操作的完整链路**（以保存任务为例）：

`TasksView → store.addTask → dataApi.writeTasks()（services/data.ts，先把响应式对象 JSON 深拷贝成普通对象）→ window.api.writeJson('tasks')（preload）→ ipcMain.handle('data:writeJson')（ipc.ts）→ dataStore.writeJsonFile() → 磁盘 tasks/tasks.json`。

要点：**渲染进程永远不直接碰 Node API**，只通过 `window.api.*`；`services/data.ts` 的 `dataApi` 是唯一接缝——这也是将来做网页版/PWA 时唯一需要替换的实现（见 [docs/移动端方案.md](docs/移动端方案.md)）。

## 目录结构（逐项说明）

```
LifeQuest/
├── src/
│   ├── main/                    # Electron 主进程
│   │   ├── index.ts             # 应用生命周期、无边框窗口、菜单、窗口控制、
│   │   │                        #   检查更新；以及一套环境变量驱动的“无头调试装置”
│   │   ├── ipc.ts               # 注册全部 ipcMain.handle：
│   │   │                        #   data:*（读写 JSON/Markdown/图片/附件/导出）、
│   │   │                        #   ai:imageToTasks、app:version、update:check
│   │   └── dataStore.ts         # resolveDataRoot()、建目录、seedDefaults()、
│   │                            #   migrateIfNeeded()（schemaVersion 迁移）、
│   │                            #   readJsonFile/writeJsonFile/read|writeMarkdownFile/listFiles
│   ├── preload/index.ts         # contextBridge 白名单：window.api（见上文）
│   ├── renderer/
│   │   ├── index.html           # 挂载点
│   │   └── src/
│   │       ├── main.ts          # Vue 入口
│   │       ├── App.vue          # 视图路由、返回栈、全局弹窗（确认框/帮助/导引/设置）
│   │       ├── env.d.ts         # window.api 的类型声明
│   │       ├── assets/          # main.css（主题变量）+ 字体
│   │       ├── services/data.ts # dataApi：渲染进程唯一数据入口
│   │       ├── stores/          # Pinia（见下）
│   │       ├── views/           # 9 个视图 + 设置（见下）
│   │       ├── components/      # 可复用组件（见下）
│   │       └── utils/           # 纯函数（见下）
│   └── shared/types.ts          # 全部共享类型（Task/Note/Semester/Plan/…）
├── docs/                        # 设计文档 + 落地页 + 截图
│   ├── 架构与数据设计.md          # 数据契约权威文档（每份 JSON 的 schema）
│   ├── 成就与回顾设计.md
│   ├── 移动端方案.md
│   └── index.html               # GitHub Pages 产品主页
├── scripts/                     # 开发/发布辅助脚本（见下）
├── .github/workflows/release.yml # 三平台打包 + 发布 Release
├── build/icon.png               # 应用图标源（1024²，由它生成 ico/icns）
├── electron.vite.config.ts      # 打包入口与别名（@ → renderer/src）
├── package.json                 # 版本、依赖、脚本、electron-builder 配置
└── LifeQuest-Data/              # 运行时数据（被 .gitignore 排除，不进仓库）
```

## 核心模块逐个说明

### views/（视图，App.vue 里按 active 切换）

| 文件 | 实现什么 |
|---|---|
| `HomeView.vue` | 首页：本周色带、今天/明天安排、最近三天日记、★重要提醒、学期进度 |
| `TasksView.vue` | 任务/日程：新增表单、主线/支线/每日/截止清单分组、拖拽挂支线、AI 识图入口 |
| `CalendarView.vue` | 日历三视图（月/周/日）：连续周带、每日配色、停课日、截止旗标、当日日记 |
| `NotesView.vue` | 笔记：列表（葡萄藤）+ Markdown 块级编辑 + 图片/附件 + 标签 + 关联 |
| `JournalView.vue` | 日记/周记：每日正文 + 天气心情 + 葡萄藤 |
| `PlansView.vue` | 学期计划（校历/假期停课）+ 活动计划 |
| `SeasonsView.vue` | 赛季/成长：称号、里程碑/自定义成就、赛季回顾入口、新建赛季 |
| `GraphView.vue` | 知识地图：笔记/任务/标签的力导向关系图 |
| `QuestMapView.vue` | 主线/支线地图：赛季时间轴 + 日记锚点传送 |
| `SettingsView.vue` | 设置：主题、动画、游戏化开关、AI 配置、数据导出 |

### stores/（Pinia，按数据域划分）

| store | 职责 |
|---|---|
| `tasks.ts` | 任务的增删改、按类型分组、`toggleDone`（按次完成）、`skipOccurrence`（跳过某次） |
| `notes.ts` | 笔记列表、读写、当前选中 |
| `journal.ts` | 单日日记的读/写（含天气心情） |
| `journalIndex.ts` | 所有日记日期的索引（供日历染色/葡萄藤/回顾用，不读正文） |
| `weeklyJournal.ts` | 周记 |
| `semester.ts` | 学期校历：周号、停课日集合、某天性质 |
| `seasons.ts` | 赛季增删、进行中/未开始/已结束判定 |
| `plans.ts` | 活动计划 |
| `tags.ts` / `links.ts` | 标签、实体关联（笔记↔任务↔笔记） |
| `dayNotes.ts` | 每天的忙碌标签/性质/备注 |
| `history.ts` | 增删历史（误删一键找回） |
| `gamification.ts` | 里程碑成就、自定义成就、称号、等级（进度实时从数据算） |
| `settings.ts` / `confirm.ts` / `update.ts` | 设置、全局确认框、检查更新 |

### utils/（纯函数，组件里不重复造轮子）

| 文件 | 实现什么 |
|---|---|
| `schedule.ts` | **核心**：重复规则展开（每天/每周/每N天…）、任务→日历事件、跳过某次、冲突检测、周概括 |
| `dayColor.ts` | 每天的色相（忙碌）/饱和度（心情）/明度（天气）→ 忙碌分级（空闲…紧张） |
| `dayGrade.ts` | 过完的一天按完成度给 S/A/B/C/D |
| `deadline.ts` | 截止压力、重要度自动抬高、`daysLeft` |
| `markdown.ts` | Markdown → HTML（渲染笔记/日记） |
| `frontmatter.ts` | Markdown 的 front matter 解析/序列化 |
| `helps.ts` | 每页「?」帮助文案（9 个视图） |
| `demoData.ts` | 一键载入/清空示例数据（记录在 config/demo.json，可精准清理） |
| `noteActions.ts` / `noteSubject.ts` | 从任务一键写笔记、按学科归类 |
| `taskDrag.ts` | 任务拖拽挂支线 |
| `helpers.ts` / `theme.ts` | uid/日期工具、主题切换 |

### components/（可复用 UI）

- **任务相关**：`TaskItem`（罗盘任务卡）、`TaskEditModal`、`TaskOccurrencesModal`（列出所有日期/按次勾/删单次）、`ChainEditor`（重复链）、`OccurrenceEditor`（逐次日期）、`AddHistory`
- **笔记/日记**：`NoteBody`（块级编辑）、`NotesVine` / `JournalVine`（葡萄藤）、`WeeklyJournalModal`
- **通用**：`ConfirmDialog`、`HelpModal`、`GuideModal`（新手导引）、`GuideDrawer`（左上角罗盘菜单）、`RadialMenu`（右下角导航）、`TitleBar`（自绘标题栏）、`ReminderBanner`、`AppIcon`（内联 SVG 图标集）、`DateField` / `TimeField`（自绘日期/时间面板，支持 24:00）
- **AI / 赛季**：`AiImportPanel`（识图导入）、`SeasonReviewModal`（应用内赛季回顾）

## 数据如何管理

### 目录布局（运行时 `LifeQuest-Data/`）

```
LifeQuest-Data/
├── config/          JSON：settings / semester / seasons / achievements /
│                    tags / links / daynotes / history / demo
├── tasks/tasks.json 全部任务与日程
├── plans/plans.json 活动计划
├── journal/         YYYY-MM-DD.md（日记）、w<周日>.md（周记）
├── notes/           <uuid>.md（每篇笔记一个文件）
├── assets/          笔记图片与附件
└── archive/         生成的赛季回顾 md
```

- **结构化数据**（任务/赛季/标签…）放 JSON，每份带 `schemaVersion`；结构变更时在 `dataStore.ts` 的迁移表里登记，旧数据自动备份后升级。
- **长文本**（日记/周记/笔记）放 Markdown，正文用 front matter 存元信息。
- 数据根目录：Windows 便携版＝exe 旁、macOS＝文稿、Linux AppImage＝同目录；可用环境变量 `LIFEQUEST_DATA_ROOT` 覆盖。

### 三条必须遵守的约定

1. 渲染进程**只通过 `window.api` / `dataApi`** 读写文件，不直接 import Node API。
2. 新增/修改数据结构 → 同步改 `src/shared/types.ts`（唯一类型来源）+ 在 `dataStore.ts` 登记 `schemaVersion` 迁移 + 更新 `docs/架构与数据设计.md`。
3. **不要把 `LifeQuest-Data/` 提交进仓库**（已在 `.gitignore`）。

## 从源码运行

需要 Node.js 20+ 与 npm（三平台均可）。

```bash
git clone https://github.com/Duke-guo/LifeQuest.git
cd LifeQuest
npm install
npm run dev          # 开发模式（热更新）
```

常用命令：

```bash
npm run typecheck    # TypeScript 检查（提交前请保证 0 错误）
npm run build        # 编译 main/preload/renderer 到 out/
npm run dist         # 打包当前平台安装包（产物在 release/）
npm run release      # 打包 + （Windows）把便携版同步到 app/
npm run check:workflow  # 校验 release.yml（含重复键检测）
```

改图标：编辑 `scripts/make-icon.cjs` 里的 SVG，运行生成 `build/icon.png`（1024²），三平台图标由它派生。

## 打包与发布（CI）

`.github/workflows/release.yml`：

- 触发：推 `main`、打 `v*` tag、手动 workflow_dispatch
- 矩阵：Windows（portable）/ macOS（dmg+zip，x64+arm64）/ Linux（AppImage+deb）
- 打 tag 后自动创建 GitHub Release，附上各平台产物

`scripts/` 里的辅助工具：

| 脚本 | 作用 |
|---|---|
| `post-release.mjs` | 按 package.json 版本号挑便携版，复制免解压版到 `app/` |
| `make-icon.cjs` | SVG → `build/icon.png` |
| `check-workflow.mjs` | 校验 workflow YAML（含重复键，防历史踩坑） |
| `list-models.mjs` / `probe-vision.mjs` / `test-ai.mjs` | AI 识图联调工具 |

## 无头调试装置（对贡献者有用）

主进程 `index.ts` 内置一套**环境变量驱动的调试装置**，可在不开图形界面点鼠标的情况下跑流程、截图、断言（本项目大量 UI 验证就靠它）：

| 变量 | 作用 |
|---|---|
| `LIFEQUEST_SCREENSHOT=<路径>` | 启动后截图到该文件 |
| `LIFEQUEST_DUMP=<路径>` | 把页面文字 + 布局体检信息写到该文件 |
| `LIFEQUEST_VIEW=任务` | 自动切到指定视图 |
| `LIFEQUEST_CLICK=...` | 按逗号分隔执行动作（`@wait:` / `@eval:` / `@type:` / `@hover:` / `@drag:` / 裸选择器＝点击） |
| `LIFEQUEST_IMAGE=<路径>` | 配合 `@image` 注入一张图（测 AI 识图/粘贴） |

示例：

```bash
LIFEQUEST_DATA_ROOT=.scratch/data \
LIFEQUEST_VIEW=任务 \
LIFEQUEST_DUMP=.scratch/o.txt \
LIFEQUEST_SCREENSHOT=.scratch/o.png \
LIFEQUEST_CLICK="@eval:document.querySelector('.help-btn').click(),@wait:900" \
npx electron .
```

## 参与贡献

见 [CONTRIBUTING.md](CONTRIBUTING.md)。Issue 和 PR 都欢迎，中文英文都可以。开始前请先读 [AGENT.md](AGENT.md)（项目纲要）和 [docs/架构与数据设计.md](docs/架构与数据设计.md)（数据契约）。

## 常见问题

**Q：有哪些平台版本？** Windows（便携 exe）、macOS（dmg，Intel/Apple）、Linux（AppImage/deb），见 [Releases](../../releases)。三平台同一套代码，界面按平台自适应（macOS 用系统红绿灯，Windows/Linux 用自绘标题栏）。

**Q：macOS 提示「已损坏」？** 个人项目未购买 Apple 开发者证书：右键 App → 打开；仍被拦则 `xattr -cr /Applications/LifeQuest.app`。

**Q：换电脑怎么搬？** 整个 `LifeQuest-Data/` 拷过去即可，纯文本、跨版本向上迁移。

**Q：会不会丢数据？** 所有写入都先落本地文件；删任务可在「历史添加」找回。建议定期备份 `LifeQuest-Data/`。

**Q：能出手机版 / 网页版吗？** 方案已在筹划（优先 PWA，复用现有界面层），详见 [docs/移动端方案.md](docs/移动端方案.md)。当前桌面版是主线。

## 协议与致谢

本项目使用 [MIT 协议](LICENSE)，可自由使用、修改、商用，保留版权声明即可。

第三方组件与字体的授权说明见 [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)。

---

## English (short)

**LifeQuest** is a local-first, gamification-optional life management desktop app (journal, calendar, todos, notes, plans) built with Electron + Vue 3 + TypeScript. All data lives in plain Markdown/JSON files on your own disk — no accounts, no cloud, no rankings, no streak shaming. Windows portable builds are on the [Releases](../../releases) page; run from source with `npm install && npm run dev`. Licensed under MIT.
