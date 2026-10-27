// Demo-only global controls: theme (host color-scheme), direction, density, accent. Not part of the library.
const nav = document.getElementById("nav")!;
const box = document.createElement("div");
box.className = "demo-controls";
box.innerHTML = `
  <label>Tema <select id="ctl-theme"><option value="light">Açık</option><option value="dark">Koyu</option><option value="light dark">Sistem</option></select></label>
  <label>Yön <select id="ctl-dir"><option value="ltr">LTR</option><option value="rtl">RTL</option></select></label>
  <label>Yoğunluk <select id="ctl-density"><option value="">normal</option><option value="compact">compact</option><option value="comfortable">comfortable</option></select></label>
  <label>Accent <input id="ctl-accent" type="color" value="#3d63dd"></label>`;
nav.querySelector("p")!.after(box);
const root = document.documentElement;
const apply = () => {
  const theme = (document.getElementById("ctl-theme") as HTMLSelectElement).value;
  root.style.colorScheme = theme;
  root.dataset.demoTheme = theme;
  root.dir = (document.getElementById("ctl-dir") as HTMLSelectElement).value;
  const density = (document.getElementById("ctl-density") as HTMLSelectElement).value;
  document.querySelectorAll<HTMLElement>(".dg").forEach((g) => (density ? g.setAttribute("data-density", density) : g.removeAttribute("data-density")));
  document.body.style.setProperty("--dg-accent", (document.getElementById("ctl-accent") as HTMLInputElement).value);
};
box.addEventListener("change", apply);
box.addEventListener("input", apply);
