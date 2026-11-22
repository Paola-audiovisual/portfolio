function createPaobotMotion({ dock, track, launcher, blocked, onRest }) {
  const home = { x: 0, y: 0 };
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const header = document.querySelector(".topbar");
  let position = home;
  let movement;
  let timer;
  let restsSinceGroom = 0;

  function delay(min, max) {
    return min + Math.random() * (max - min);
  }

  function limits() {
    return {
      x: Math.max(0, dock.clientWidth - launcher.offsetWidth),
      y: Math.max(0, dock.getBoundingClientRect().top - header.offsetHeight - 12)
    };
  }

  function transform(spot, bounds = limits()) {
    return `translate3d(${-spot.x * bounds.x}px, ${-spot.y * bounds.y}px, 0)`;
  }

  function draw() {
    track.style.transform = transform(position);
  }

  function canWalk() {
    return !reduceMotion.matches && !blocked();
  }

  function hold() {
    clearTimeout(timer);
    timer = undefined;
    if (movement) {
      const { animation, destination } = movement;
      const progress = animation.effect.getComputedTiming().progress ?? 0;
      position = {
        x: position.x + (destination.x - position.x) * progress,
        y: position.y + (destination.y - position.y) * progress
      };
      animation.cancel();
      movement = undefined;
      draw();
    }
    dock.dataset.pose = "sit";
  }

  function wait(pose, min, max) {
    dock.dataset.pose = pose;
    timer = setTimeout(walk, delay(min, max));
  }

  function chooseDestination() {
    let candidate;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      candidate = { x: Math.random(), y: Math.random() };
      if (Math.hypot(candidate.x - position.x, candidate.y - position.y) >= .3) break;
    }
    return candidate;
  }

  function walk() {
    timer = undefined;
    if (!canWalk()) return;
    const destination = chooseDestination();
    const bounds = limits();
    const distance = Math.hypot(
      (destination.x - position.x) * bounds.x,
      (destination.y - position.y) * bounds.y
    );
    const duration = Math.min(16_000, Math.max(2_200, distance / delay(60, 95) * 1_000));
    dock.dataset.facing = destination.x > position.x ? "left" : "right";
    dock.dataset.pose = "walk";
    const animation = track.animate(
      [{ transform: transform(position, bounds) }, { transform: transform(destination, bounds) }],
      { duration, fill: "forwards" }
    );
    movement = { animation, destination };
    animation.onfinish = () => {
      if (movement?.animation !== animation) return;
      position = destination;
      draw();
      animation.cancel();
      movement = undefined;
      onRest(position);
      const grooming = restsSinceGroom >= 2 || Math.random() < .5;
      restsSinceGroom = grooming ? 0 : restsSinceGroom + 1;
      wait(grooming ? "groom" : "sit", 2_400, 5_600);
    };
  }

  function sync() {
    if (!canWalk()) {
      hold();
      return;
    }
    if (!movement && timer === undefined) wait("sit", 650, 1_350);
  }

  function place(savedPosition) {
    hold();
    position = savedPosition ?? home;
    draw();
  }

  function resize() {
    hold();
    draw();
    sync();
  }

  reduceMotion.addEventListener("change", sync);

  return { hold, place, resize, sync, position: () => position };
}
