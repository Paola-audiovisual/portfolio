import { mkdir, readFile, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = path => readFile(new URL(path, root), "utf8");

const pages = [
  { name: "home", directory: "", title: "Paola Sanz · Creative OS" },
  { name: "projects", directory: "proyectos/", title: "Projects" },
  { name: "experience", directory: "experiencia/", title: "Experience" },
  { name: "about", directory: "sobre-mi/", title: "About me" },
  { name: "contact", directory: "contacto/", title: "Contact" }
];

const legacySections = Object.fromEntries(
  pages.slice(1).map(({ directory }) => ["#" + directory.slice(0, -1), directory])
);

const entryScript = `  <script>
    const fragment = location.hash;
    const sections = ${JSON.stringify(legacySections)};
    if (Object.hasOwn(sections, fragment)) {
      location.replace(sections[fragment] + location.search);
    } else if (fragment.startsWith("#proyecto/") && fragment !== "#proyecto/where-communication-begins") {
      location.replace("./proyectos/" + location.search + fragment);
    } else if (!fragment) {
      let entered = false;
      try {
        entered = sessionStorage.getItem("creative-os-welcome-complete") === "1";
      } catch {}
      if (!entered) document.documentElement.classList.add("entry-pending", "boot-pending");
    }
  </script>`;

const [layout, entryScreens] = await Promise.all([
  read("src/layout.html"),
  read("src/entry-screens.html")
]);

for (const { name, directory, title } of pages) {
  const home = name === "home";
  const pageTitle = home
    ? `  <title>${title}</title>`
    : `  <title data-page-title="${name}">${title} · Paola Sanz</title>`;
  const content = await read(`src/pages/${name}.html`);
  const html = layout
    .replace('  <!-- PAGE_TITLE -->', pageTitle)
    .replace(/^  <!-- ENTRY_SCRIPT -->\n/m, home ? entryScript + "\n" : "")
    .replace(/^  <!-- ENTRY_SCREENS -->\n/m, home ? entryScreens : "")
    .replace('          <!-- PAGE_CONTENT -->', content.trimEnd())
    .replace(/ data-nav="([^"]+)"/g, (_, item) => item === name ? ' aria-current="page"' : "")
    .replace(/\b(href|src)="\/(?!\/)([^"]*)"/g, (_, attribute, path) => {
      const relativeRoot = home ? "./" : "../";
      return attribute + '="' + relativeRoot + path + '"';
    });

  const output = new URL(directory, root);
  await mkdir(output, { recursive: true });
  await writeFile(new URL("index.html", output), html);
}
