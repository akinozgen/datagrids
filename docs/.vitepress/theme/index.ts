import DefaultTheme from "vitepress/theme";
import type { Theme } from "vitepress";
import Demo from "./Demo.vue";
// The library's stylesheets, straight from src/ (tokens first, then the core, then every module sheet).
// The docs site is deliberately NOT isolated from VitePress' own table styles: it is a hostile host test.
import "../../../src/styles/tokens.css";
import "../../../src/styles/datagrids.css";
import.meta.glob("../../../src/styles/*.css", { eager: true });
import "./custom.css";

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component("Demo", Demo);
  },
} satisfies Theme;
