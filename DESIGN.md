# Mia Studio Design System

## Intent

Mia Studio 是一张专注写作的工作台，不是通用 SaaS 仪表盘。内容始终是画面中最重的东西；选题、素材、AI 和发布作为写作上下文出现。

## Layout

- 桌面：48px 顶栏，240–280px 左侧内容域，中央编辑/微信预览，可选 320–360px 右侧检查器，28px 状态栏。
- 平板：左侧内容域与检查器改为抽屉。
- 手机：顶栏 + 单一当前阶段 + 底部五导航（选题、素材、写作、预览、发布）。AI 是上下文动作，不单独占导航位。

## Tokens

```css
:root {
  --canvas: oklch(0.985 0.003 160);
  --surface: oklch(1 0 0);
  --surface-subtle: oklch(0.965 0.004 160);
  --ink: oklch(0.24 0.012 160);
  --ink-muted: oklch(0.46 0.016 160);
  --border: oklch(0.89 0.008 160);
  --primary: oklch(0.43 0.105 160);
  --primary-hover: oklch(0.36 0.09 160);
  --primary-soft: oklch(0.94 0.025 160);
  --warning: oklch(0.58 0.13 65);
  --danger: oklch(0.52 0.18 28);
}
```

产品 UI 使用系统无衬线字体；编辑区使用等宽字体。基础圆角 6px，面板优先使用 1px 边界分隔而非卡片。手机触控区不小于 44px。

## Core interactions

- `Cmd/Ctrl + S`：立即保存。
- `Cmd/Ctrl + K`：上下文 AI 动作。
- `Cmd/Ctrl + P`：快速打开文章或选题。
- `Cmd/Ctrl + Shift + P`：打开发布预检。
- AI 修改必须以 diff 呈现，确认后才写回。
- 保存状态明确经过「有修改」→「保存中」→「已存到服务器」。
- 冲突不静默覆盖，应显示服务器版本与本地版本处理入口。

## Anti-patterns

不使用 iframe 拼接、渐变字、玻璃卡片、装饰光斑、仪表盘指标方块，也不在顶部常驻几十个低频格式化按钮。
