# 第三方组件与字体授权说明

LifeQuest 自身以 [MIT 协议](LICENSE) 发布。程序里还包含下列第三方成果，各自的版权与授权如下。

## 运行时依赖

| 组件 | 用途 | 协议 |
|---|---|---|
| [Electron](https://github.com/electron/electron) | 桌面运行时 | MIT |
| [Vue 3](https://github.com/vuejs/core) | 界面框架 | MIT |
| [Pinia](https://github.com/vuejs/pinia) | 状态管理 | MIT |
| [Chromium](https://www.chromium.org/)（随 Electron 分发） | 渲染引擎 | BSD-3-Clause 及若干第三方许可，详见 Electron 发行包内的 `LICENSES.chromium.html` |

## 构建期依赖

| 组件 | 用途 | 协议 |
|---|---|---|
| [Vite](https://github.com/vitejs/vite) | 构建工具 | MIT |
| [electron-vite](https://github.com/alex8088/electron-vite) | Electron 构建集成 | MIT |
| [electron-builder](https://github.com/electron-userland/electron-builder) | 打包 | MIT |
| [TypeScript](https://github.com/microsoft/TypeScript) | 类型检查 | Apache-2.0 |

## 字体（SIL Open Font License 1.1）

程序内打包了以下字体文件（位于 `src/renderer/src/assets/fonts/`）：

| 字体 | 作者 / 来源 | 协议 |
|---|---|---|
| ZCOOL KuaiLe（站酷快乐体） | ZCOOL 站酷 | SIL Open Font License 1.1 |
| Baloo 2 | Ek Type | SIL Open Font License 1.1 |

SIL Open Font License 1.1 允许自由使用、修改与再分发（包括随软件一起分发），条件包括：

1. 保留本授权说明与版权声明；
2. 字体本身**不得单独售卖**；
3. 若修改了字体文件，**不得继续使用原字体名称**（Reserved Font Name）。

OFL 全文见 <https://openfontlicense.org/open-font-license-official-text/> 。
字体原始授权文件随字体发行方提供，可在上述来源处获取。

## 说明

- 若你二次分发本项目的构建产物，请一并保留本文件。
- 不含任何商业授权受限的图标或素材：界面图标为项目内自行绘制的 SVG（`src/renderer/src/components/AppIcon.vue`），无第三方图标库依赖。
