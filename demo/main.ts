import "@/styles/tokens.css";
import "@/styles/datagrids.css";
import "./controls";
import "./sections/core";
import "./sections/responsive";
import "./sections/sticky";
import "./sections/keyboard";
import "./sections/server";
import "./sections/virtual";
import "./sections/lifecycle";
import "./sections/filters";
import "./sections/actions";
import "./sections/state";
import "./sections/colreorder";
import "./sections/lazy";
import "./sections/export";
import "./sections/extras";
import "./sections/selection";
import "./sections/light";
import "./sections/should";
import "./sections/can";
import { buildOverview } from "./overview";
import { buildNews } from "./sections/news";

buildOverview();
buildNews();

const hash = location.hash;
if (hash) requestAnimationFrame(() => document.querySelector(hash)?.scrollIntoView());
