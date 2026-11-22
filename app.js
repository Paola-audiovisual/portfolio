const assetRoot = new URL("assets/", document.currentScript.src).href;

const types = {
  video: "▶",
  foto: "▧",
  audio: "◖",
  branding: "◇"
};

const page = document.documentElement;
const languageButtons = [...document.querySelectorAll("[data-language]")];
const languageKey = "creative-os-language";
const entryKey = "creative-os-welcome-complete";
let language = "en";
let projects;

function t(key, values = {}) {
  return portfolioCopy[language][key].replace(/\{(\w+)\}/g, (_, name) => values[name]);
}

function setLanguage(locale) {
  language = locale;
  page.lang = locale;
  document.querySelectorAll("[data-copy]").forEach(element => {
    element.textContent = t(element.dataset.copy);
  });
  for (const attribute of ["aria", "alt", "content"]) {
    const data = "data-copy-" + attribute;
    const target = attribute === "aria" ? "aria-label" : attribute;
    document.querySelectorAll(`[${data}]`).forEach(element => {
      element.setAttribute(target, t(element.getAttribute(data)));
    });
  }
  document.querySelectorAll(".language-switch").forEach(switcher => { switcher.hidden = false; });
  for (const button of languageButtons) {
    button.setAttribute("aria-pressed", String(button.dataset.language === locale));
  }
  const title = document.querySelector("[data-page-title]");
  if (title) title.textContent = t(title.dataset.pageTitle) + " · Paola Sanz";
  if (copyStatus) copyStatus.textContent = "";
  projects = projectCatalog.map(({ en, es, photos, ...project }) => ({
    ...project,
    ...(locale === "es" ? es : en),
    photos: photos?.map(([src, captions]) => [src, captions[locale]])
  }));
  if (grid) renderCards();
  syncLocation();
  document.dispatchEvent(new Event("portfolio:language"));
}

const grid = document.getElementById("project-grid");
const count = document.getElementById("project-count");
const dialog = document.getElementById("case-window");
const detail = document.getElementById("case-content");
const closeButton = document.getElementById("close-case");
const projectHash = "#proyecto/";
const filters = [...document.querySelectorAll("[data-filter]")];
let selectedFilter = "todos";
let lastTrigger;
let openProject;
let shiftGallery;

const pendingNotes = {
  awaitingMedia: "originalMediaNote",
  comingSoon: "photoPendingNote",
  inProgress: "journalPendingNote"
};

function renderCards() {
  const visible = projects.filter(project => selectedFilter === "todos" || selectedFilter === project.type);
  count.textContent = visible.length === 1 ? t("oneProject") : t("multipleProjects", { count: visible.length });
  grid.innerHTML = visible.map(project => {
    const typeIcon = types[project.type];
    const cover = project.cover
      ? `<img src="${assetRoot}${project.cover}" alt="" loading="lazy" decoding="async">`
      : project.art === "indie"
        ? '<span class="indie-wordmark" aria-hidden="true">indiependízate</span>'
        : `<span class="art-mark" aria-hidden="true">${project.type === "audio" ? "▂▆▃▇▂" : typeIcon}</span>`;
    const format = project.type === "video" && !project.video
      ? t("videoCase")
      : t(project.type);
    return `
      <article class="project-card">
        <div class="card-art ${project.art ? "art-" + project.art : ""}" style="--card-y: ${project.position ?? 50}%">
          ${cover}
          <span class="card-type"><span aria-hidden="true">${typeIcon}</span>${format}</span>
        </div>
        <div class="card-body">
          <p>${project.client}</p>
          ${project.status ? `<p class="card-status">${t(project.status)}</p>` : ""}
          <h3><a class="card-link" href="${projectHash}${project.id}" data-project="${project.id}">${project.title}</a></h3>
          <span aria-hidden="true"><i class="arrow northeast"></i></span>
        </div>
      </article>`;
  }).join("");
}

function videoMarkup(project) {
  return `
    <div class="case-media">
      <video class="case-video${project.landscape ? " case-video-wide" : ""}" controls playsinline preload="metadata" poster="${assetRoot}${project.cover}" src="${assetRoot}${project.video}" aria-label="${project.title}"></video>
      <p class="video-error" role="status" hidden>${t("videoError")} <a href="${assetRoot}${project.video}" target="_blank" rel="noopener">${t("videoOpen")}</a>.</p>
    </div>`;
}

function galleryMarkup(project) {
  return `
    <figure class="case-media" aria-label="${t("gallery")}">
      <div class="gallery-stage"><img alt="" decoding="async"></div>
      <div class="gallery-controls">
        <button class="icon-button" type="button" data-step="-1" aria-label="${t("previousPhoto")}">‹</button>
        <span class="gallery-count" role="status" aria-live="polite"></span>
        <button class="icon-button" type="button" data-step="1" aria-label="${t("nextPhoto")}">›</button>
      </div>
      <div class="gallery-thumbs" role="group" aria-label="${t("choosePhoto")}">
        ${project.photos.map(([src, alt], index) => `<button type="button" data-photo="${index}" aria-label="${t("photoNumber", { index: index + 1 })}. ${alt}"><img src="${assetRoot}${src}" alt="" decoding="async"></button>`).join("")}
      </div>
      <figcaption class="gallery-caption"></figcaption>
    </figure>`;
}

function connectGallery(project) {
  const stage = detail.querySelector(".gallery-stage img");
  const counter = detail.querySelector(".gallery-count");
  const caption = detail.querySelector("figcaption");
  const thumbs = [...detail.querySelectorAll("[data-photo]")];
  let index = 0;

  function showPhoto(nextIndex) {
    index = (nextIndex + project.photos.length) % project.photos.length;
    const [src, description] = project.photos[index];
    stage.src = assetRoot + src;
    stage.alt = description;
    counter.textContent = t("photoCount", { index: index + 1, total: project.photos.length });
    caption.textContent = description;
    thumbs.forEach((button, thumbIndex) => {
      if (thumbIndex === index) button.setAttribute("aria-current", "true");
      else button.removeAttribute("aria-current");
    });
  }

  shiftGallery = step => showPhoto(index + step);
  detail.querySelectorAll("[data-step]").forEach(button => button.addEventListener("click", () => shiftGallery(Number(button.dataset.step))));
  thumbs.forEach((button, thumbIndex) => button.addEventListener("click", () => showPhoto(thumbIndex)));
  showPhoto(0);
}

function relatedMarkup(project) {
  if (!project.related?.length) return "";
  const links = project.related.map(id => projects.find(item => item.id === id));
  return `<h3>${t("relatedProjects")}</h3>
    <ul class="related-projects">${links.map(item => `<li><a href="${projectHash}${item.id}" data-project="${item.id}">${item.title}<i class="arrow northeast" aria-hidden="true"></i></a></li>`).join("")}</ul>`;
}

function instagramLink(text, href) {
  const link = document.createElement("a");
  link.href = href;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = text;
  return link;
}

function instagramSection(project) {
  const section = document.createElement("section");
  section.className = "instagram-post";
  section.setAttribute("aria-labelledby", "instagram-caption-title");
  section.innerHTML = `
    <div class="instagram-post-heading">
      <h3 id="instagram-caption-title">${t("instagramCaption")}</h3>
      <a class="outline-button link-button" target="_blank" rel="noopener noreferrer">
        <span>${t("viewOnInstagram")}</span><span aria-hidden="true"><i class="arrow northeast"></i></span>
      </a>
    </div>`;
  section.querySelector("a").href = project.instagram.url;

  if (project.instagram.language !== language) {
    const note = document.createElement("p");
    note.className = "instagram-post-translation";
    note.textContent = t("captionTranslation");
    section.append(note);
  }

  const copy = document.createElement("div");
  copy.className = "instagram-post-copy";
  for (const paragraph of project.instagramCaption) {
    const line = document.createElement("p");
    const parts = Array.isArray(paragraph) ? paragraph : [paragraph];
    for (const part of parts) {
      line.append(typeof part === "string" ? part : instagramLink(part.text, part.href));
    }
    copy.append(line);
  }
  section.append(copy);

  const tags = document.createElement("p");
  tags.className = "instagram-post-hashtags";
  for (const tag of project.instagram.hashtags) {
    const href = `https://www.instagram.com/explore/tags/${encodeURIComponent(tag.toLowerCase())}/`;
    tags.append(instagramLink("#" + tag, href));
  }
  section.append(tags);
  return section;
}

function showCase(project) {
  if (openProject === project) return;
  detail.querySelector("video")?.pause();
  openProject = project;
  shiftGallery = undefined;
  const media = project.video
    ? videoMarkup(project)
    : project.photos
      ? galleryMarkup(project)
      : project.still
        ? `<figure class="case-media case-still"><img src="${assetRoot}${project.still}" alt="${project.title}"></figure>`
        : "";
  detail.innerHTML = `
    <div class="case-heading">
      <p>${project.client}${project.duration ? " · " + project.duration : ""}</p>
      <h2 id="case-title">${project.title}</h2>
    </div>
    <div class="case-layout ${!media || project.landscape ? "text-only" : ""}">
      ${media}
      <div class="case-copy">
        <p>${project.summary}</p>
        ${project.spotifyUrl ? `
          <a class="case-listen primary-button" href="${project.spotifyUrl}" target="_blank" rel="noopener noreferrer">
            ${t("listenOnSpotify")} <span aria-hidden="true"><i class="arrow northeast"></i></span>
          </a>` : ""}
        <h3>${t("contribution")}</h3><p>${project.role}</p>
        <h3>${t("approach")}</h3><p>${project.process}</p>
        ${project.animationCredit ? `<h3>${t("animationCredits")}</h3><p>${t(project.animationCredit)}</p>` : ""}
        <ul class="tags">${project.tags.map(tag => `<li>${tag}</li>`).join("")}</ul>
        ${project.status ? `<p class="media-note">${t(pendingNotes[project.status])}</p>` : ""}
        ${relatedMarkup(project)}
      </div>
    </div>`;
  if (project.instagram) detail.append(instagramSection(project));
  if (project.photos) connectGallery(project);
  const video = detail.querySelector("video");
  if (video) video.addEventListener("error", () => { detail.querySelector(".video-error").hidden = false; });
  if (!dialog.open) dialog.showModal();
  detail.scrollTop = 0;
  closeButton.focus({ preventScroll: true });
}

function hideCase() {
  if (!dialog.open) return;
  detail.querySelector("video")?.pause();
  dialog.close();
  detail.replaceChildren();
  openProject = undefined;
  shiftGallery = undefined;
  if (lastTrigger?.isConnected) lastTrigger.focus({ preventScroll: true });
  lastTrigger = undefined;
}

function syncLocation() {
  const hash = location.hash;
  const project = hash.startsWith(projectHash) ? projects.find(item => item.id === hash.slice(projectHash.length)) : undefined;
  if (project) showCase(project);
  else hideCase();
}

function closeCase() {
  if (history.state?.portfolioCase) {
    history.back();
  } else {
    history.replaceState(null, "", location.pathname + location.search);
    syncLocation();
    const trigger = document.querySelector(".journal-strip [data-project], .project-grid .card-link");
    trigger?.focus();
  }
}

document.addEventListener("click", event => {
  const link = event.target.closest("[data-project]");
  if (!link || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
  event.preventDefault();
  if (dialog.open) {
    history.replaceState(history.state, "", link.hash);
  } else {
    lastTrigger = link;
    history.pushState({ portfolioCase: true }, "", link.hash);
  }
  syncLocation();
});

filters.forEach(button => button.addEventListener("click", () => {
  selectedFilter = button.dataset.filter;
  filters.forEach(option => option.setAttribute("aria-pressed", String(option === button)));
  renderCards();
}));

window.addEventListener("hashchange", syncLocation);
window.addEventListener("popstate", syncLocation);
closeButton.addEventListener("click", closeCase);
dialog.addEventListener("cancel", event => {
  event.preventDefault();
  closeCase();
});
dialog.addEventListener("click", event => {
  if (event.target === dialog) closeCase();
});
dialog.addEventListener("keydown", event => {
  if (!shiftGallery || event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
  event.preventDefault();
  shiftGallery(event.key === "ArrowRight" ? 1 : -1);
});

const copy = document.querySelector("[data-email]");
const copyStatus = document.getElementById("copy-status");
copy?.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(copy.dataset.email);
    copyStatus.textContent = t("copied");
  } catch {
    copyStatus.textContent = copy.dataset.email;
  }
});

const enterPortfolio = document.getElementById("enter-portfolio");

function startBoot() {
  if (!page.classList.contains("boot-pending")) return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    page.classList.remove("boot-pending");
    return;
  }

  const lines = [...document.querySelectorAll(".boot-log li")];
  const progress = document.getElementById("boot-progress");
  const skip = document.getElementById("skip-boot");
  let displayed = 1;
  let nextStep;

  function showWelcome() {
    clearTimeout(nextStep);
    const activeControl = document.activeElement;
    page.classList.remove("boot-pending");
    if (activeControl === skip) {
      enterPortfolio.focus();
    } else if (activeControl.closest(".boot-screen") && activeControl.dataset.language) {
      const nextControl = document.querySelector(`.welcome-screen [data-language="${activeControl.dataset.language}"]`);
      nextControl.focus();
    }
  }

  function advanceBoot() {
    if (!page.classList.contains("boot-pending")) return;
    if (displayed === lines.length) {
      showWelcome();
      return;
    }

    lines[displayed].hidden = false;
    displayed += 1;
    progress.value = displayed;
    nextStep = setTimeout(advanceBoot, displayed === lines.length ? 450 : 510);
  }

  skip.addEventListener("click", showWelcome);
  nextStep = setTimeout(advanceBoot, 510);
}

function rememberEntry() {
  try {
    sessionStorage.setItem(entryKey, "1");
  } catch {}
}

enterPortfolio?.addEventListener("click", event => {
  event.preventDefault();
  rememberEntry();
  page.classList.remove("entry-pending", "boot-pending");
  document.getElementById("contenido").focus({ preventScroll: true });
  document.dispatchEvent(new Event("portfolio:entered"));
});

window.addEventListener("hashchange", () => {
  if (!location.hash || !page.classList.contains("entry-pending")) return;
  page.classList.remove("entry-pending", "boot-pending");
  document.dispatchEvent(new Event("portfolio:entered"));
});

for (const button of languageButtons) {
  button.addEventListener("click", () => {
    const locale = button.dataset.language;
    if (locale === language) return;
    try {
      localStorage.setItem(languageKey, locale);
    } catch {}
    setLanguage(locale);
  });
}

function preferredLanguage() {
  try {
    return localStorage.getItem(languageKey) === "es" ? "es" : "en";
  } catch {
    return language;
  }
}

window.addEventListener("pageshow", event => {
  if (!event.persisted) return;
  const locale = preferredLanguage();
  if (locale !== language) setLanguage(locale);
});

setLanguage(preferredLanguage());
if (!page.classList.contains("entry-pending")) rememberEntry();
startBoot();


const portraitGallery = document.getElementById("portrait-gallery");
if (portraitGallery) {
  const portraits = [
    ["paola.webp", "portraitAlt", "50% 42%"],
    ["paola-flash.webp", "portraitFlash", "50% 28%"],
    ["paola-sunset.webp", "portraitSunset", "54% 28%"],
    ["paola-blue.webp", "portraitBlue", "50% 42%"],
    ["paola-window.webp", "portraitWindow", "50% 27%"]
  ];
  const portrait = portraitGallery.querySelector("img");
  const controls = document.getElementById("portrait-controls");
  const counter = document.getElementById("portrait-count");
  const frames = [...portraitGallery.querySelectorAll(".film-strip i")];
  let portraitIndex = 0;

  function renderPortrait() {
    const [src, alt, position] = portraits[portraitIndex];
    const url = assetRoot + src;
    if (portrait.getAttribute("src") !== url) portrait.src = url;
    portrait.dataset.copyAlt = alt;
    portrait.alt = t(alt);
    portrait.style.objectPosition = position;
    counter.textContent = t("portraitCount", { index: portraitIndex + 1, total: portraits.length });
    frames.forEach((frame, index) => frame.classList.toggle("current-frame", index === portraitIndex));
  }

  controls.querySelectorAll("[data-portrait-step]").forEach(button => button.addEventListener("click", () => {
    portraitIndex = (portraitIndex + Number(button.dataset.portraitStep) + portraits.length) % portraits.length;
    renderPortrait();
  }));
  document.addEventListener("portfolio:language", renderPortrait);
  renderPortrait();
  controls.hidden = false;
}
