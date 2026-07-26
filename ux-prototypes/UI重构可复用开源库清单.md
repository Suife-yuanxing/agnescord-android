# UI 重构可复用开源库清单

> 创建日期：2026-06-27
> 说明：针对 UI 重构方案的各模块需求，筛选出的可直接复用的 GitHub 开源库，避免重复造轮子。

---

## 一、SPA 路由引擎（替代自研 router.js）

### 1. vanilla-spa-router
- **GitHub**: https://github.com/SantiagoGdaR/vanilla-spa
- **许可**: MIT
- **体积**: ~3KB gzip
- **特点**: 纯 JS 零依赖，基于 History API + hashchange，支持路径参数、查询字符串解析
- **适配度**: ★★★★☆ — 非常契合项目"零框架依赖"的设计哲学，可直接嵌入或作为 router.js 的参考实现
- **注意**: 项目规模较小，可能需要在此基础上扩展视图生命周期钩子

### 2. vanilla-ui-router
- **GitHub**: https://github.com/erikringsquand/vanilla-ui-router
- **许可**: MIT
- **体积**: ~2KB min
- **特点**: 零依赖，支持路由守卫、模板加载、参数传递
- **适配度**: ★★★☆☆ — 更偏传统 SPA 路由，需要适配我们的 HTML fragment 视图模式

### 建议
项目需求简单（5 个核心视图 + 转场动画），**建议自研 router.js**，参考以上库的路由匹配和 History API 封装模式。自研可以更好地控制视图转场动画（淡入/推入）和 WS 连接生命周期管理。

---

## 二、WebSocket 自动重连（直接复用）

### reconnecting-websocket ★★★★★ 强烈推荐
- **GitHub**: https://github.com/joewalnes/reconnecting-websocket
- **npm**: `reconnecting-websocket`
- **CDN**: `https://cdn.jsdelivr.net/npm/reconnecting-websocket@latest/dist/reconnecting-websocket.min.js`
- **许可**: MIT
- **体积**: ~3KB min+gzip
- **特点**:
  - 原生 WebSocket API 的透明包装器，API 完全兼容
  - 自动重连 + 指数退避策略（可配置）
  - 支持 Web / React Native / Node.js
  - 零配置：`new ReconnectingWebSocket(url)` 即可替换 `new WebSocket(url)`
- **适配度**: ★★★★★ — 直接替换现有 api.js 中的 WS 连接逻辑，解决验收标准 G.5（网络恢复自动重连）
- **用法**:
  ```js
  // 替换前
  var ws = new WebSocket('ws://server/chat/ws');
  // 替换后
  var ws = new ReconnectingWebSocket('ws://server/chat/ws');
  // 其余 onopen/onmessage/onclose 代码完全不变
  ```

### websocket-heartbeat-js（备选）
- **GitHub**: https://github.com/zimv/websocket-heartbeat-js
- **特点**: 带心跳检测（ping/pong）+ 自动重连
- **适配度**: ★★★☆☆ — 如果后端需要心跳保活可选用，但 reconnecting-websocket 更轻量

---

## 三、农历/节日检测系统（直接复用）

### lunar-javascript ★★★★★ 强烈推荐
- **GitHub**: https://github.com/6tail/lunar-javascript
- **npm**: `lunar-javascript`
- **CDN**: `https://cdn.bootcdn.net/ajax/libs/lunar-javascript/1.6.13/lunar.min.js`
- **许可**: MIT
- **特点**:
  - 公历↔农历互转、24 节气、传统节日、法定假日
  - 星座、干支、生肖、每日宜忌、吉凶方位
  - 支持获取公历/农历节日列表
  - 持续维护（最近更新 2025 年）
  - **纯 JS，零依赖**，可在浏览器直接使用
- **适配度**: ★★★★★ — 完美覆盖 Agnes 节日庆祝系统的全部需求
  - 公历节日：`solar.getFestivals()`
  - 农历节日：`lunar.getFestivals()`
  - 节气：`solar.getJieQi()`
  - 用户生日农历转换：`Lunar.fromYmd()` → `Solar`
- **用法**:
  ```js
  const { Solar, Lunar } = require('lunar-javascript');
  
  // 检查今天是否有节日
  const today = Solar.fromDate(new Date());
  const festivals = today.getFestivals();     // 公历节日
  const lunarFestivals = today.getLunar().getFestivals();  // 农历节日
  
  // 用户生日（假设农历八月十五）
  const lunarBirthday = Lunar.fromYmd(2000, 8, 15);
  const solarBirthday = lunarBirthday.getSolar();
  ```

### calendar.js（备选）
- **GitHub**: https://github.com/jjonline/calendar.js
- **特点**: 轻量级农历公历互转，体积更小
- **适配度**: ★★★☆☆ — 功能不如 lunar-javascript 全面，缺少节日/节气

---

## 四、状态机引擎（Agnes 心情系统）

### javascript-state-machine ★★★★★ 推荐
- **GitHub**: https://github.com/jakesgordon/javascript-state-machine
- **npm**: `javascript-state-machine`
- **CDN**: `https://cdn.bootcdn.net/ajax/libs/javascript-state-machine/3.1.0/state-machine.min.js`
- **许可**: MIT
- **体积**: ~5KB min
- **特点**:
  - 声明式定义状态和转换规则
  - 生命周期钩子（onEnter/onLeave/onTransition）
  - 可视化调试工具
  - 支持通配符 `from: '*'` 允许从任意状态转入
- **适配度**: ★★★★★ — 完美匹配 Agnes 心情状态机需求
- **用法**:
  ```js
  const moodMachine = new StateMachine({
    init: 'happy',
    transitions: [
      { name: 'miss',    from: '*',        to: 'missing'   },
      { name: 'excite',  from: '*',        to: 'excited'   },
      { name: 'sleepy',  from: '*',        to: 'sleepy'    },
      { name: 'bore',    from: '*',        to: 'bored'     },
      { name: 'sad',     from: '*',        to: 'sad'       },
      { name: 'celebrate', from: '*',      to: 'celebrating' },
      { name: 'surprise',  from: '*',      to: 'surprised' },
      { name: 'calm',    from: '*',        to: 'happy'     }
    ],
    methods: {
      onTransition: function(lifecycle) {
        // 触发心情切换动画
        animateMoodChange(lifecycle.from, lifecycle.to);
      }
    }
  });
  ```

### XState（备选，过重）
- **GitHub**: https://github.com/statelyai/xstate
- **特点**: 功能最强大的状态机/状态图库，但体积较大（~40KB）
- **适配度**: ★★☆☆☆ — 功能过剩，对本项目来说太重了

---

## 五、CSS 设计令牌 / 主题系统（参考/复用）

### Open Props ★★★★☆ 推荐参考
- **GitHub**: https://github.com/argyleink/open-props
- **npm**: `open-props`
- **CDN**: `https://unpkg.com/open-props`
- **许可**: MIT
- **体积**: ~4KB gzip（全量），可按模块引入
- **特点**:
  - 500+ CSS 自定义属性：颜色、渐变、阴影、动画、间距、排版
  - 内置明/暗主题切换（`props.theme.css` + `props.theme.dark.css`）
  - 支持 OKLCH 色彩空间
  - 响应式断点、缓动函数预设
  - 模块化：可按需引入 `props.colors.css` / `props.shadows.css` / `props.animations.css`
- **适配度**: ★★★★☆ — **作为 tokens.css 重构的参考基础**
  - 可直接复用的：阴影系统、缓动函数、间距比例、断点
  - 需要自定义的：品牌色（#F472B6）、情感浓度梯度（data-emotion 1-5）、Soft Glass 专用变量
- **建议**: 不直接引入整个库，而是**参考其变量命名规范和分层架构**，在 tokens.css 中构建自己的设计令牌体系，保留品牌独特性

---

## 六、图标库（已在方案中确认）

### Lucide Icons ★★★★★ 已确认使用
- **GitHub**: https://github.com/lucide-icons/lucide
- **npm**: `lucide`（Vanilla JS 版）
- **CDN**: `https://unpkg.com/lucide@latest/dist/umd/lucide.js`
- **许可**: ISC（免费商用）
- **特点**:
  - 1000+ SVG 矢量图标，统一 24x24 网格设计
  - 支持 Vanilla JS：`<i data-lucide="heart"></i>` + `lucide.createIcons()`
  - Tree-shaking 支持按需导入
  - Figma 插件支持
- **适配度**: ★★★★★ — 方案已确认使用，补充猫/Bot/表情类图标用 Tabler Icons 补充

### Tabler Icons（补充图标）
- **GitHub**: https://github.com/tabler/tabler-icons
- **特点**: 5000+ 图标，猫/机器人/表情相关图标更丰富
- **许可**: MIT
- **用法**: 作为 Lucide 的补充，按需引入 SVG

---

## 七、Glassmorphism CSS（参考）

### liquid-glass-js
- **GitHub**: https://github.com/dashersw/liquid-glass-js
- **特点**: 纯 JS 实现的液态玻璃效果，包含 CSS + JS 动画
- **适配度**: ★★★☆☆ — 可参考其 glass 效果的 CSS 实现，但需深度定制以适配情感浓度梯度

### ui.glass
- **官网**: https://ui.glass
- **特点**: 基于 Glassmorphism 设计规范的完整 CSS UI 库
- **适配度**: ★★★☆☆ — 提供 glass 效果组件参考，但不是完整框架

### 建议
Glass 效果的核心是 CSS 变量（`backdrop-filter` + 半透明背景 + 边框），**建议自研**，参考以上库的实现方式，在 tokens.css 中通过 `data-emotion` 控制不同档位的玻璃效果参数。

---

## 八、打字机效果（流式输出）

### Typed.js
- **GitHub**: https://github.com/mattboldt/typed.js
- **特点**: 成熟的打字机效果库
- **适配度**: ★★☆☆☆ — 不适合 WS 流式场景（它基于预设文本数组）

### 建议
流式输出的打字机效果**必须自研**，因为：
1. 内容是 WS 实时推送的，不是预设文本
2. 需要支持中断（用户点击停止）
3. 需要打字机光标 + Markdown 渐进渲染
4. 现有 api.js 已有 WS 流式处理逻辑，在此基础上增强 UI 表现即可

---

## 九、底部导航胶囊动画

### 建议：自研
现有 app.js 中已有底部导航胶囊滑动 + 弹簧动画的实现。方案中的增强（双层拖尾 blur、方向性 scale 拉伸）属于品牌独特交互，没有现成库能直接覆盖，**继续自研**是最佳选择。

---

## 总结：复用优先级矩阵

| 需求模块 | 推荐库 | 复用方式 | 优先级 |
|---------|--------|---------|-------|
| WS 自动重连 | reconnecting-websocket | **直接引入** | P0 |
| 农历/节日检测 | lunar-javascript | **直接引入** | P0（Phase 2） |
| 心情状态机 | javascript-state-machine | **直接引入** | P0（Phase 2） |
| CSS 设计令牌 | Open Props | **参考架构**，自研 tokens.css | P0 |
| 图标 | Lucide Icons | **直接引入** | P0 |
| SPA 路由 | vanilla-spa-router | **参考实现**，自研 router.js | P0 |
| 玻璃拟态 | liquid-glass-js / ui.glass | **参考 CSS**，自研 | P0 |
| 打字机效果 | — | **自研**（WS 流式场景特殊） | P0 |
| 胶囊导航动画 | — | **自研**（品牌独特交互） | P0 |
| 补充图标 | Tabler Icons | **按需引入** | P1 |

---

## 安装清单（npm）

```bash
# Phase 1 必需
npm install reconnecting-websocket    # WS 自动重连
npm install lucide                    # 图标库

# Phase 2 需要
npm install lunar-javascript          # 农历/节日
npm install javascript-state-machine  # 心情状态机
```

或通过 CDN 在 HTML 中直接引入（适合独立 HTML 页面阶段）。
