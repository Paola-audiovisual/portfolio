(() => {
  const dock = document.getElementById("paobot-dock");
  const launcher = document.getElementById("paobot");
  const track = launcher.closest(".paobot-track");
  const languageSwitch = document.querySelector(".top-actions .language-switch");
  const panel = document.getElementById("paobot-panel");
  const intro = document.getElementById("paobot-intro");
  const message = document.getElementById("paobot-message");
  const close = document.getElementById("paobot-close");
  const showLanguage = document.getElementById("paobot-language");
  const contact = document.getElementById("paobot-contact");
  const next = document.getElementById("paobot-next");
  const stayHome = document.getElementById("paobot-home");
  const memoryKey = "creative-os-paobot-memory";
  const previousVisitKey = "creative-os-paobot-visit";
  const pinKey = "creative-os-paobot-home";
  const invitationDelay = 40_000;
  const doubleTapWindow = 360;
  const atHome = !!document.getElementById("hero-title");
  const onContactPage = !!document.getElementById("contact-title");
  let memory = { greeted: false, invited: false, elapsed: 0 };
  let pinned = readPin();
  let ready = false;
  let kind = "thought";
  let thought = -1;
  let hovered = false;
  let pointerDown = false;
  let tapTimer;
  let clockStart;
  let invitationTimer;
  let thoughtTimer;
  let closeThoughtTimer;
  const motion = createPaobotMotion({
    dock,
    track,
    launcher,
    blocked: () => !ready || pinned || dock.hidden || document.hidden || dialog.open
      || !panel.hidden || hovered || pointerDown || tapTimer !== undefined || launcher.matches(":focus-visible"),
    onRest: position => remember({ position })
  });

  function readMemory() {
    try {
      return JSON.parse(localStorage.getItem(memoryKey))
        ?? JSON.parse(sessionStorage.getItem(previousVisitKey))
        ?? memory;
    } catch {
      return memory;
    }
  }

  function remember(updates) {
    memory = { ...readMemory(), ...updates };
    try {
      localStorage.setItem(memoryKey, JSON.stringify(memory));
    } catch {}
  }

  function readPin() {
    try {
      return localStorage.getItem(pinKey) === "1";
    } catch {
      return false;
    }
  }

  function render() {
    const welcoming = kind === "welcome";
    intro.hidden = !welcoming;
    message.hidden = welcoming;
    message.textContent = kind === "thought"
      ? (paobotThoughts[thought]?.[language === "es" ? 1 : 0] ?? "")
      : kind === "contact"
        ? t("paobotContact")
        : kind === "pin"
          ? t(pinned ? "paobotStaying" : "paobotFollowing")
          : "";
    showLanguage.hidden = !welcoming;
    contact.hidden = kind !== "contact";
    next.hidden = welcoming || kind === "contact";
    stayHome.textContent = t(pinned ? "paobotFollow" : "paobotStayHome");
    placePanel();
  }

  function setGuide(offset) {
    dock.classList.toggle("is-guiding", Boolean(offset));
    languageSwitch.classList.toggle("is-paobot-target", Boolean(offset));
    launcher.style.translate = offset ? `${offset.x}px ${offset.y}px` : "";
  }

  function placePanel() {
    if (panel.hidden || dock.hidden) return;
    const { clientWidth, clientHeight } = document.documentElement;
    const margin = 12;
    const gap = 8;
    const trackBounds = track.getBoundingClientRect();
    const selector = languageSwitch.getBoundingClientRect();
    const guiding = kind === "welcome" && selector.top >= 0 && selector.bottom + 134 <= clientHeight;
    let anchor = trackBounds;
    if (guiding) {
      const right = Math.min(clientWidth - margin, Math.max(margin + launcher.offsetWidth, selector.right));
      const top = selector.bottom + gap;
      anchor = { right, top, bottom: top + launcher.offsetHeight };
      setGuide({ x: right - trackBounds.right, y: top - trackBounds.top });
    } else {
      setGuide(null);
    }

    panel.style.maxHeight = guiding ? `${clientHeight - anchor.bottom - gap - margin}px` : "";
    const { width, height } = panel.getBoundingClientRect();
    const left = Math.max(margin, Math.min(anchor.right - width, clientWidth - width - margin));
    const above = anchor.top - height - gap;
    const below = Math.min(anchor.bottom + gap, clientHeight - height - margin);
    panel.style.left = left + "px";
    panel.style.top = Math.max(margin, !guiding && above >= margin ? above : below) + "px";
  }

  function open(kindToShow) {
    clearTimeout(thoughtTimer);
    clearTimeout(closeThoughtTimer);
    kind = kindToShow;
    panel.hidden = false;
    launcher.setAttribute("aria-expanded", "true");
    motion.sync();
    render();
  }

  function hide() {
    const returnFocus = panel.contains(document.activeElement);
    panel.hidden = true;
    launcher.setAttribute("aria-expanded", "false");
    setGuide(null);
    if (returnFocus) launcher.focus({ preventScroll: true });
    motion.sync();
    scheduleThought();
  }

  function anotherThought() {
    const latest = readMemory();
    const remaining = latest.remaining?.slice() ?? [];
    if (!remaining.length) {
      for (let index = 0; index < paobotThoughts.length; index += 1) remaining.push(index);
      for (let index = remaining.length - 1; index > 0; index -= 1) {
        const other = Math.floor(Math.random() * (index + 1));
        [remaining[index], remaining[other]] = [remaining[other], remaining[index]];
      }
      if (remaining.at(-1) === latest.thought) {
        [remaining[0], remaining[remaining.length - 1]] = [remaining.at(-1), remaining[0]];
      }
    }
    thought = remaining.pop();
    remember({ thought, remaining });
    open("thought");
  }

  function exploring() {
    return ready && !document.hidden;
  }

  function scheduleThought() {
    clearTimeout(thoughtTimer);
    if (!exploring() || dock.hidden || !panel.hidden || dialog.open) return;
    thoughtTimer = setTimeout(() => {
      if (!exploring() || dock.hidden || !panel.hidden || dialog.open) return;
      anotherThought();
      closeThoughtTimer = setTimeout(() => {
        if (!panel.matches(":hover") && !dock.contains(document.activeElement)) hide();
      }, 9_000);
    }, 58_000 + Math.random() * 40_000);
  }

  function toggleHome() {
    pinned = !pinned;
    try {
      localStorage.setItem(pinKey, pinned ? "1" : "0");
    } catch {}
    updateDock();
    if (dock.hidden) {
      hide();
      document.getElementById("contenido").focus({ preventScroll: true });
    } else {
      open("pin");
    }
    refresh();
  }

  function pauseClock() {
    clearTimeout(invitationTimer);
    if (clockStart === undefined) return;
    const elapsed = performance.now() - clockStart;
    clockStart = undefined;
    const latest = readMemory();
    if (!latest.invited) remember({ elapsed: (latest.elapsed ?? 0) + elapsed });
  }

  function resumeClock() {
    memory = readMemory();
    if (!exploring() || memory.invited || onContactPage || clockStart !== undefined) return;
    clockStart = performance.now();
    if (dock.hidden || dialog.open) return;
    invitationTimer = setTimeout(() => {
      pauseClock();
      if (!exploring() || dialog.open) {
        resumeClock();
        return;
      }
      if (readMemory().invited) return;
      remember({ invited: true });
      open("contact");
    }, Math.max(0, invitationDelay - (memory.elapsed ?? 0)));
  }

  function restartClock() {
    pauseClock();
    resumeClock();
  }

  function greet() {
    if (readMemory().greeted || dock.hidden || dialog.open) return;
    remember({ greeted: true });
    open("welcome");
  }

  function updateDock() {
    const wasPinned = dock.classList.contains("is-pinned");
    dock.classList.toggle("is-pinned", pinned);
    dock.hidden = pinned && !atHome;
    if (pinned && !wasPinned && !dock.hidden) motion.place(null);
    motion.sync();
  }

  function refresh() {
    motion.sync();
    restartClock();
    scheduleThought();
  }

  function start() {
    if (ready) return;
    ready = true;
    remember({});
    updateDock();
    motion.place(pinned ? null : memory.position);
    greet();
    refresh();
  }

  launcher.addEventListener("click", event => {
    if (tapTimer !== undefined) {
      clearTimeout(tapTimer);
      tapTimer = undefined;
      if (event.detail !== 0) {
        toggleHome();
        return;
      }
    }
    const singleTap = () => {
      tapTimer = undefined;
      if (panel.hidden) anotherThought();
      else hide();
      motion.sync();
    };
    if (event.detail === 0) singleTap();
    else {
      tapTimer = setTimeout(singleTap, doubleTapWindow);
      motion.sync();
    }
  });
  launcher.addEventListener("pointerenter", event => {
    if (event.pointerType === "touch") return;
    hovered = true;
    motion.sync();
  });
  launcher.addEventListener("pointerleave", () => {
    hovered = false;
    motion.sync();
  });
  launcher.addEventListener("pointerdown", () => {
    pointerDown = true;
    motion.sync();
  });
  for (const event of ["pointerup", "pointercancel"]) {
    window.addEventListener(event, () => {
      if (!pointerDown) return;
      pointerDown = false;
      requestAnimationFrame(motion.sync);
    });
  }
  for (const event of ["focus", "blur"]) launcher.addEventListener(event, motion.sync);
  close.addEventListener("click", hide);
  stayHome.addEventListener("click", toggleHome);
  next.addEventListener("click", anotherThought);
  showLanguage.addEventListener("click", () => {
    languageSwitch.scrollIntoView({ block: "nearest", behavior: "instant" });
    placePanel();
    languageSwitch.querySelector("[aria-pressed='true']").focus({ preventScroll: true });
  });
  languageSwitch.addEventListener("click", event => {
    if (kind === "welcome" && event.target.closest("[data-language]")) hide();
  });
  dock.addEventListener("keydown", event => {
    if (event.key !== "Escape" || panel.hidden) return;
    hide();
    event.stopPropagation();
  });
  new MutationObserver(() => {
    if (!dialog.open) greet();
    if (ready) refresh();
  }).observe(dialog, { attributeFilter: ["open"] });

  document.addEventListener("portfolio:language", render);
  document.addEventListener("portfolio:entered", start);
  document.addEventListener("visibilitychange", () => {
    if (!ready) return;
    refresh();
    if (document.hidden && !pinned && !dock.hidden) remember({ position: motion.position() });
  });
  for (const event of ["focus", "blur"]) window.addEventListener(event, refresh);
  window.addEventListener("resize", () => {
    motion.resize();
    placePanel();
  });
  window.addEventListener("scroll", () => {
    if (kind === "welcome") placePanel();
  }, { passive: true });
  window.addEventListener("pagehide", () => {
    pauseClock();
    clearTimeout(thoughtTimer);
    clearTimeout(closeThoughtTimer);
    motion.hold();
    if (ready && !pinned && !dock.hidden) remember({ position: motion.position() });
  });
  window.addEventListener("pageshow", event => {
    if (!event.persisted || !ready) return;
    memory = readMemory();
    pinned = readPin();
    updateDock();
    if (dock.hidden || kind === "contact") hide();
    render();
    greet();
    refresh();
  });
  window.addEventListener("storage", event => {
    if (event.key === memoryKey) {
      memory = readMemory();
      if (memory.invited) pauseClock();
    }
    if (event.key === pinKey && ready) {
      pinned = readPin();
      updateDock();
      if (dock.hidden) hide();
      if (!panel.hidden) render();
      refresh();
    }
  });

  if (!page.classList.contains("entry-pending")) start();
})();
