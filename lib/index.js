/**
 * dsh-open-native — 宿主半区。
 *
 * 这个插件要改的行为全在浏览器端（点击交付卡片那一下），宿主侧不需要注册
 * 任何工具、路由或服务，所以这里只提供一个合法的空插件，让 bundle 能被加载。
 */

export const name = "dsh-open-native";

/** 宿主侧不依赖任何服务。 */
export const inject = [];

/** 宿主侧无操作。 */
export function apply() {}
