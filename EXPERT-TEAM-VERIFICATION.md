# AI 专家团配置验证指南

## ✅ 配置已完成

已成功创建以下文件:

1. **[.cursorrules](file://d:/Android%20Studio/.cursorrules)** - Cursor/Windsurf/Cline 规则文件(180行)
2. **[AI-Expert-Team-Configuration.md](file://d:/Android%20Studio/AI-Expert-Team-Configuration.md)** - 完整专家团配置文档(685行)

---

##  验证步骤

### 步骤 1: 重启 AI 助手

如果您使用的是 **Cursor**、**Windsurf** 或 **Cline**,请:
1. 关闭当前对话窗口
2. 重新打开项目
3. 确认 `.cursorrules` 文件已被加载(Cursor 会在右下角显示 "Rules loaded")

### 步骤 2: 测试自动路由

向 AI 助手提出以下测试问题,观察是否正确路由到对应专家:

#### 测试 1: UI/UX 专家路由
```
问: "调整底部导航胶囊的颜色为深粉色"

期望响应:
✅ 引用 components.css 中的 .nav-capsule
✅ 使用 var(--color-primary-dark) 而非硬编码 #EC4899
✅ 提供完整的 CSS 代码块
✅ 提及暗色模式适配
```

#### 测试 2: Capacitor 专家路由
```
问: "添加录音权限并在 AndroidManifest 中声明"

期望响应:
✅ 在 AndroidManifest.xml 中添加 RECORD_AUDIO 权限
✅ 配对 <uses-feature android:name="android.hardware.microphone" />
✅ 提及动态权限请求 ActivityCompat.requestPermissions()
✅ 提醒 ProGuard 混淆规则
```

#### 测试 3: API 专家路由
```
问: "实现 WebSocket 断线重连逻辑"

期望响应:
✅ 引用 api.js 中的 openChatWs() 函数
✅ 使用指数退避算法(3s→6s→12s→...→30s)
✅ 提及 client_id 幂等性
✅ 包含 try-catch + Toast 错误提示
```

#### 测试 4: 架构专家路由
```
问: "检查 ux-prototypes 与 assets 的同步状态"

期望响应:
✅ 提及 Gradle copyWebAssets task
✅ 提供 diff 命令检查差异
✅ 提醒 README.md 更新日志同步
✅ 列出未同步文件清单
```

### 步骤 3: 测试跨领域协同

提出一个涉及多个专家的复杂任务:

```
问: "新增 Bot 设置页面,需要接入真实 API 并更新文档"

期望响应:
✅ ui-expert 主导: 页面布局和组件样式
✅ api-expert 协同: 接入 GET/PUT /bots/{id} API
✅ arch-expert 协同: 更新 README.md 路由覆盖表
✅ 明确说明各专家的分工和协作流程
```

---

## 🔍 故障排查

### 问题 1: AI 没有自动路由到对应专家

**症状**: 提问 "调整颜色" 但 AI 没有引用 `tokens.css`

**解决方案**:
1. 检查 `.cursorrules` 文件是否存在于项目根目录
2. 确认文件名为 `.cursorrules`(注意开头的点)
3. 重启 AI 助手并重新加载项目

### 问题 2: 跨领域任务没有协同机制

**症状**: 提问复杂任务时 AI 只从一个角度回答

**解决方案**:
1. 在问题中明确提及涉及的领域(如 "需要同时处理样式和 API")
2. 手动提示 AI 参考 `.cursorrules` 中的协同机制
3. 检查 `.cursorrules` 中的 "跨领域协同机制" 部分是否完整

### 问题 3: 验收标准未被遵循

**症状**: AI 提供的代码缺少 try-catch 或硬编码色值

**解决方案**:
1. 在对话中明确指出违反了哪项验收标准
2. 引用 `.cursorrules` 中的具体条款
3. 要求 AI 重新生成符合规范的代码

---

##  进阶使用

### 方式 1: 在其他 AI 工具中使用

如果您使用的是 **非 Cursor/Windsurf/Cline** 的工具:

1. 打开 AI 助手的 **Custom Instructions** 或 **System Prompt** 设置
2. 复制以下内容粘贴:

```markdown
你是一个专业的 AgnesCord 项目 AI 助手,内置四个专家角色:

1. **UI/UX 与前端样式专家**: 负责设计系统、毛玻璃特效、组件样式、暗色模式
2. **Capacitor 与 Android 混合开发专家**: 负责原生桥接、权限配置、Gradle 构建
3. **业务逻辑与 API 集成专家**: 负责 JS 业务逻辑、JWT 刷新、WebSocket、表单验证
4. **项目架构与资产同步专家**: 负责代码同步监控、文档维护、实施清单

根据用户请求的关键词自动路由到对应专家,跨领域任务采用"主导专家 + 协同专家"模式。

核心原则:
- 安全优先:所有 NativeBridge 方法参数校验,所有用户输入 escapeHtml
- 设计系统优先:所有样式使用 CSS 变量,禁止硬编码
- 文档即代码:每次功能上线后更新 README.md
- 同步自动化:通过 Gradle copyWebAssets 自动同步

详细规则请参考项目根目录的 AI-Expert-Team-Configuration.md 文件。
```

### 方式 2: 自定义触发词

您可以在 `.cursorrules` 中添加自定义触发词来增强路由准确性:

```markdown
### 自定义触发词扩展

**UI/UX 专家额外触发词**: 
- "美化"、"优化视觉"、"调整间距"、"修改圆角"、"更换主题"

**Capacitor 专家额外触发词**: 
- "打包"、"签名"、"混淆"、"生命周期"、"回调"

**API 专家额外触发词**: 
- "鉴权"、"刷新 token"、"心跳"、"序列化"、"反序列化"

**架构专家额外触发词**: 
- "重构"、"迁移"、"版本控制"、"分支策略"、"依赖管理"
```

---

## 🎯 最佳实践

### 1. 明确指定专家

当您需要特定专家的建议时,可以直接调用:

```
@ui-expert 请帮我优化聊天页的消息气泡样式
@api-expert 请检查 WebSocket 重连逻辑是否有并发问题
```

### 2. 提供上下文信息

在提问时附带相关文件路径,帮助 AI 更准确地定位:

```
我需要修改 tokens.css 中的主色调,从 #F472B6 改为 #E85D75,
请同时更新所有引用该变量的组件。
```

### 3. 使用验收标准自查

在 AI 生成代码后,对照 `.cursorrules` 中的验收标准逐项检查:

```
✅ 色值来自 tokens.css 变量
✅ 有暗色模式适配
✅ 有 fallback 方案
❌ 动画时长超过 500ms → 需要调整
```

---

## 📖 相关文档

- **完整配置文档**: [AI-Expert-Team-Configuration.md](file://d:/Android%20Studio/AI-Expert-Team-Configuration.md)
- **规则文件**: [.cursorrules](file://d:/Android%20Studio/.cursorrules)
- **项目总览**: [ux-prototypes/README.md](file://d:/Android%20Studio/ux-prototypes/README.md)
- **后端实施清单**: [后端API实施清单-2026-06-22.md](file://d:/Android%20Studio/ux-prototypes/后端API实施清单-2026-06-22.md)

---

## 🚀 下一步

1. ✅ **完成配置**: `.cursorrules` 已创建
2. 🔄 **重启 AI 助手**: 确保规则文件被加载
3. 🧪 **测试验证**: 使用上述测试问题验证路由是否正确
4. 📝 **开始使用**: 在日常开发中享受专家团带来的效率提升!

如有任何问题,请参考 [AI-Expert-Team-Configuration.md](file://d:/Android%20Studio/AI-Expert-Team-Configuration.md) 中的 FAQ 部分。
