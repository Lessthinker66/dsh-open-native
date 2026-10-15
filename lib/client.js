/**
 * dsh-open-native — 客户端半区。
 *
 * 背景：`@deepseek-ai/dsh-client-ui-deliverables` 给出的交付卡片，点击（那个铺满
 * 卡片的 `cardPreview` 按钮）默认行为是「在侧边栏预览」，DSH 没有开关能改。
 * 而卡片按钮的 `title` 上挂的正是解析后的绝对路径
 * （`resolveWorkspacePath(cwd, file.path)`），原生打开则走宿主的
 * `session.openWorkspacePath`。
 *
 * 所以本插件在 document 的捕获阶段拦下这次点击：读出路径 → preventDefault
 * 掉原来的预览 → 改调宿主，交给系统默认程序（.xlsx → WPS）。
 *
 * 保留原行为的办法：按住 Shift（或 Ctrl / Alt / Cmd）点击，仍然走 DSH 内预览。
 *
 * 只接管卡片本体那一下；卡片右下角的动作按钮（打开（默认）/ 在文件夹中显示）
 * 一律放行，不做拦截。
 */
window.__ModuleLoader__.load({
  id: "dsh-open-native",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    const NS = "dsh-open-native";

    /** 需要的客户端服务：会话 Remote —— 原生打开走它。 */
    const inject = ["remote", "remote.session"];

    /** 交付卡片容器标记，由 ui-deliverables 自己打在 div 上。 */
    const CARD_SELECTOR = "[data-presented-file]";

    /** 卡片里铺满整块的预览按钮：CSS module 类名形如 `<hash>_cardPreview`。 */
    const PREVIEW_BUTTON_SELECTOR = 'button[class*="cardPreview"]';

    /**
     * 绝对路径的样子：盘符（`C:\` / `C:/`）、UNC（`\\`）或 POSIX 根（`/`）。
     * 只认这个，才不会把 title 上的普通文案当成路径去打开。
     */
    const ABSOLUTE_PATH = /^(?:[A-Za-z]:[\\/]|\\\\|\/)/;

    /** 按住这些修饰键点击，保持 DSH 原来的「侧边栏预览」。 */
    const PASSTHROUGH_MODIFIERS = ["shiftKey", "ctrlKey", "altKey", "metaKey"];

    /**
     * 读一个元素 `title` 上的绝对路径。
     * @param element - 目标元素，允许为 null。
     * @returns 绝对路径；不是路径（或没有 title）时返回 null。
     */
    function pathOf(element) {
      const title = element === null ? null : element.getAttribute("title");
      return title !== null && ABSOLUTE_PATH.test(title) ? title : null;
    }

    /**
     * 找卡片上那个「点了会预览」的按钮。
     *
     * 首选 CSS module 类名；DSH 若改了类名，退回「第一个 title 是绝对路径的按钮」，
     * 这样插件不会因为一次样式重构就整个失效。
     * @param card - 交付卡片容器。
     * @returns 预览按钮；找不到返回 null。
     */
    function findPreviewButton(card) {
      const byClassName = card.querySelector(PREVIEW_BUTTON_SELECTOR);
      if (byClassName !== null) return byClassName;
      for (const candidate of card.querySelectorAll("button[title]")) {
        if (pathOf(candidate) !== null) return candidate;
      }
      return null;
    }

    /**
     * 交给宿主用系统默认程序打开一个路径。
     * @param ctx - 客户端根上下文。
     * @param path - 宿主机上的绝对路径。
     * @returns 宿主是否受理。
     */
    async function openWithDefaultApp(ctx, path) {
      const result = await ctx.remote.session.openWorkspacePath({ path });
      // 宿主成功时回的是 `{ opened: true }`；不同版本可能多包一层 `ok`。
      if (result?.opened !== true && result?.ok !== true) {
        console.warn(`[${NS}] 宿主没有受理原生打开：`, path, result);
        return false;
      }
      return true;
    }

    /**
     * 客户端插件主体：装一个捕获阶段的点击拦截。
     * @param ctx - 客户端根上下文。
     */
    function apply(ctx) {
      /**
       * 捕获阶段拦下交付卡片本体的点击，改成用系统默认程序打开。
       * @param event - 文档上冒泡/捕获到的点击事件。
       */
      function onClickCapture(event) {
        if (event.defaultPrevented) return;
        if (event.button !== 0) return;
        if (PASSTHROUGH_MODIFIERS.some((key) => event[key] === true)) return;

        const target = event.target;
        if (!(target instanceof Element)) return;

        const card = target.closest(CARD_SELECTOR);
        if (card === null) return;

        const previewButton = findPreviewButton(card);
        if (previewButton === null) return;

        // 卡片右下角的动作按钮是独立的 <button>（原生打开 / 在文件夹中显示），
        // 点到它们一律放行，只有当这一下不是落在别的按钮上时才接管。
        const clickedButton = target.closest("button");
        if (clickedButton !== null && clickedButton !== previewButton) return;

        // 路径取「这一下真正点到的那个按钮」，避免卡片里出现多个文件时认错。
        const path = pathOf(clickedButton ?? previewButton);
        if (path === null) return;

        event.preventDefault();
        event.stopPropagation();

        openWithDefaultApp(ctx, path).catch((error) => {
          console.warn(`[${NS}] 原生打开调用异常：`, path, error);
        });
      }

      ctx.effect(() => {
        document.addEventListener("click", onClickCapture, true);
        return () => document.removeEventListener("click", onClickCapture, true);
      }, `${NS}: deliverable card click -> system default app`);
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  }
});
