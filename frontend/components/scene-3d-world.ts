import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { aiChip, dashboard, fit, laptop, phone, pipeline, serverRack, type Prop } from "./scene-3d-props";

// The WebGL side of <Scene3D>. Loaded lazily (with three.js) after the page is interactive, so
// it never delays the first paint. Each variant is a small composition in TechJest's palette:
// glossy navy, crimson and stone objects that pop in, float, and lean toward the pointer.

export type SceneVariant =
  | "home"
  | "services"
  | "about"
  | "work"
  | "contact"
  | "emblem"
  | "web"
  | "mobile"
  | "ai"
  | "cloud"
  | "design"
  | "automation";

const NAVY = 0x1b1e4a;
const NAVY_RAISED = 0x2c3170;
const CRIMSON = 0xd21319;
const STONE = 0xc9c8be;
const WHITE = 0xfbfaf6;

const TEAM = [
  "chayan-khatua",
  "amit-singh-panwar",
  "arushi-choudhary",
  "sindhant-dadwal",
  "nishtha-banerjee",
  "nayan-roy",
  "chitwandeep-kaur",
].map((name) => `/images/team/${name}-portrait.jpg`);

type Placed = {
  object: THREE.Object3D;
  // Where the object sits, as a fraction of the visible half-width/half-height, plus depth.
  at: (portrait: boolean) => [number, number, number];
  size: (portrait: boolean) => number;
  spin: [number, number];
  // Instead of spinning, rock gently side to side (for things that should face the viewer).
  sway: number;
  bob: number;
  delay: number;
};

type Built = { items: Placed[]; tick?: (t: number) => void };

const glossy = (color: number, extra: THREE.MeshPhysicalMaterialParameters = {}) =>
  new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.22,
    metalness: 0.08,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
    // Dark brand colours wash out to lavender under strong reflections; keep them deep navy.
    envMapIntensity: color === NAVY || color === NAVY_RAISED ? 0.35 : 0.9,
    ...extra,
  });

function hexagon(radius: number) {
  const shape = new THREE.Shape();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const x = Math.cos(a) * radius;
    const y = Math.sin(a) * radius;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

// The TechJest mark: a navy hexagon ring with a crimson "T" standing out of its middle.
function emblem() {
  const group = new THREE.Group();
  const ring = hexagon(1.6);
  ring.holes.push(new THREE.Path(hexagon(1.12).getPoints()));
  const bevel = { bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.06, bevelSegments: 4 };
  const ringGeometry = new THREE.ExtrudeGeometry(ring, { depth: 0.42, ...bevel });
  ringGeometry.center();
  group.add(new THREE.Mesh(ringGeometry, glossy(NAVY)));
  const t = new THREE.Shape();
  t.moveTo(-0.72, 0.62);
  t.lineTo(0.72, 0.62);
  t.lineTo(0.72, 0.3);
  t.lineTo(0.17, 0.3);
  t.lineTo(0.17, -0.78);
  t.lineTo(-0.17, -0.78);
  t.lineTo(-0.17, 0.3);
  t.lineTo(-0.72, 0.3);
  t.closePath();
  const tGeometry = new THREE.ExtrudeGeometry(t, { depth: 0.62, ...bevel });
  tGeometry.center();
  const tMesh = new THREE.Mesh(tGeometry, glossy(CRIMSON));
  tMesh.position.z = 0.12;
  group.add(tMesh);
  return group;
}

const place = (
  object: THREE.Object3D,
  at: Placed["at"],
  size: Placed["size"],
  options: Partial<Pick<Placed, "spin" | "sway" | "bob" | "delay">> = {},
): Placed => ({
  object,
  at,
  size,
  spin: options.spin ?? [0.2, 0.3],
  sway: options.sway ?? 0,
  bob: options.bob ?? 0.15,
  delay: options.delay ?? 0,
});

const both =
  <T>(value: T) =>
  () =>
    value;

function sphere(color: number, extra?: THREE.MeshPhysicalMaterialParameters) {
  return new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), glossy(color, extra));
}

// A prop, turned to a pose and sized so its longest side is 2.6 units.
function posed(prop: Prop, rx: number, ry: number) {
  const pose = new THREE.Group();
  pose.add(fit(prop.object));
  pose.rotation.set(rx, ry, 0);
  return pose;
}

const withProps = (items: Placed[], props: Prop[]): Built => ({
  items,
  tick: (t) => props.forEach((prop) => prop.tick?.(t)),
});

const calm = { spin: [0, 0] as [number, number], sway: 0.18, bob: 0.08 };

// The homepage hero: the work itself framing the headline. A laptop writing code, a phone
// running an app, an AI chip and a server rack.
function home(): Built {
  const props = [laptop(), phone("app"), aiChip(), serverRack()];
  const [code, app, chip, rack] = props as [Prop, Prop, Prop, Prop];
  return withProps(
    [
      place(
        posed(code, 0.32, -0.55),
        (p) => (p ? [1.02, -0.5, 0] : [0.76, -0.34, 0]),
        (p) => (p ? 0.45 : 1),
        {
          ...calm,
          delay: 0.2,
        },
      ),
      place(
        posed(app, 0.05, 0.42),
        (p) => (p ? [-1.04, -0.66, 0] : [-0.8, -0.52, 0.5]),
        (p) => (p ? 0.4 : 0.8),
        {
          ...calm,
          delay: 0.35,
        },
      ),
      place(
        posed(chip, 0, 0.5),
        (p) => (p ? [-1.02, 1, -1] : [-0.8, 0.52, -1]),
        (p) => (p ? 0.4 : 0.62),
        {
          ...calm,
          delay: 0.5,
        },
      ),
      place(
        posed(rack, 0.18, -0.5),
        (p) => (p ? [1.04, 1.02, -2] : [0.82, 0.6, -2]),
        (p) => (p ? 0.35 : 0.55),
        {
          ...calm,
          delay: 0.65,
        },
      ),
    ],
    props,
  );
}

// Six service areas, each shown by the thing it delivers.
function services(): Built {
  const props = [laptop(), phone("app"), aiChip(), serverRack(), dashboard(), pipeline()];
  const poses: [number, number][] = [
    [0.32, -0.45],
    [0.05, 0.35],
    [0, 0.5],
    [0.18, -0.45],
    [0.08, 0.35],
    [0.1, -0.2],
  ];
  return withProps(
    props.map((prop, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const [rx, ry] = poses[i] ?? [0, 0];
      return place(
        posed(prop, rx, ry),
        (p) => (p ? [(col - 1) * 0.62, row ? -0.42 : 0.42, 0] : [(col - 1) * 0.6, row ? -0.45 : 0.45, 0]),
        (p) => (p ? 0.5 : 0.7),
        { ...calm, delay: 0.1 + i * 0.12 },
      );
    }),
    props,
  );
}

// One service's own prop, large and centred, with a companion where it helps tell the story.
function single(variant: "web" | "mobile" | "ai" | "cloud" | "design" | "automation"): Built {
  const main =
    variant === "web"
      ? laptop()
      : variant === "mobile"
        ? phone("app")
        : variant === "ai"
          ? aiChip()
          : variant === "cloud"
            ? serverRack()
            : variant === "design"
              ? dashboard()
              : pipeline();
  const pose: Record<typeof variant, [number, number]> = {
    web: [0.3, -0.4],
    mobile: [0.05, 0.3],
    ai: [0, 0.45],
    cloud: [0.18, -0.45],
    design: [0.06, 0.3],
    automation: [0.1, -0.15],
  };
  const companion =
    variant === "web" ? phone("app") : variant === "mobile" ? phone("chat") : variant === "ai" ? pipeline() : null;
  const items = [
    place(
      posed(main, ...pose[variant]),
      () => (companion ? [-0.12, 0.08, 0] : [0, 0, 0]),
      () => 1.75,
      { ...calm, delay: 0.15 },
    ),
  ];
  const props = [main];
  if (companion) {
    props.push(companion);
    items.push(
      place(
        posed(companion, 0.05, variant === "ai" ? 0 : 0.4),
        () => (variant === "ai" ? [0.5, -0.55, 0.5] : [0.62, -0.42, 0.5]),
        () => (variant === "ai" ? 1 : 0.75),
        {
          ...calm,
          delay: 0.4,
        },
      ),
    );
  }
  return withProps(items, props);
}

// The team as photo discs orbiting the TechJest mark.
function about(loader: THREE.TextureLoader): Built {
  const discs = TEAM.map((src) => {
    const texture = loader.load(src);
    texture.colorSpace = THREE.SRGBColorSpace;
    // A cylinder cap maps images a quarter-turn round; turn the photo back upright.
    texture.center.set(0.5, 0.5);
    texture.rotation = Math.PI / 2;
    const rim = glossy(WHITE);
    const face = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.6 });
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.12, 48), [rim, face, face]);
    disc.rotation.x = Math.PI / 2;
    const holder = new THREE.Group();
    holder.add(disc);
    return holder;
  });
  const orbit = new THREE.Group();
  discs.forEach((disc) => orbit.add(disc));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3, 0.025, 12, 160), glossy(STONE));
  ring.rotation.x = Math.PI / 2;
  orbit.add(ring);
  const tilt = new THREE.Group();
  tilt.add(orbit);
  tilt.rotation.x = 0.32;
  tilt.rotation.z = -0.12;
  return {
    items: [
      place(emblem(), both([0, 0, 0]), both(0.9), { spin: [0, 0], sway: 0.6, delay: 0.1, bob: 0.1 }),
      place(tilt, both([0, 0, 0]), both(1), { spin: [0, 0], delay: 0.3, bob: 0 }),
    ],
    tick: (t) => {
      discs.forEach((disc, i) => {
        const a = t * 0.35 + (i / discs.length) * Math.PI * 2;
        disc.position.set(Math.cos(a) * 3, Math.sin(t * 1.2 + i) * 0.18, Math.sin(a) * 3);
        // Faces stay turned toward the viewer as they orbit.
        disc.rotation.y = -orbit.rotation.y;
        disc.rotation.x = -tilt.rotation.x;
      });
    },
  };
}

function browserPanel(loader: THREE.TextureLoader, src: string | null, body: number, screen: number) {
  const group = new THREE.Group();
  group.add(new THREE.Mesh(new RoundedBoxGeometry(4, 2.6, 0.16, 4, 0.08), glossy(body)));
  const bar = new THREE.Mesh(new THREE.PlaneGeometry(3.76, 0.26), new THREE.MeshStandardMaterial({ color: STONE }));
  bar.position.set(0, 1.08, 0.085);
  group.add(bar);
  [CRIMSON, STONE, NAVY].forEach((color, i) => {
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.06, 20), new THREE.MeshBasicMaterial({ color }));
    dot.position.set(-1.7 + i * 0.18, 1.08, 0.09);
    group.add(dot);
  });
  const material = new THREE.MeshStandardMaterial({ color: screen, roughness: 0.55 });
  if (src) {
    const texture = loader.load(src);
    texture.colorSpace = THREE.SRGBColorSpace;
    material.map = texture;
    material.color.set(0xffffff);
  }
  const view = new THREE.Mesh(new THREE.PlaneGeometry(3.76, 2.06), material);
  view.position.set(0, -0.12, 0.085);
  group.add(view);
  return group;
}

// Floating browser windows: the live Stream Bird India site in front, TechJest work behind.
function work(loader: THREE.TextureLoader): Built {
  const lines = browserPanel(loader, null, NAVY, NAVY_RAISED);
  [1.6, 2.4, 1.1, 2, 1.4].forEach((width, i) => {
    const bar = new THREE.Mesh(new RoundedBoxGeometry(width, 0.14, 0.06, 2, 0.03), glossy(i === 1 ? CRIMSON : STONE));
    bar.position.set(-1.6 + width / 2, 0.55 - i * 0.32, 0.12);
    lines.add(bar);
  });
  return {
    items: [
      place(lines, both([-0.3, 0.34, -2.2]), both(0.85), { spin: [0, 0], bob: 0.12, delay: 0.1 }),
      place(browserPanel(loader, "/images/techjest-brand.png", WHITE, NAVY), both([0.36, 0.4, -1.2]), both(0.68), {
        spin: [0, 0],
        bob: 0.14,
        delay: 0.25,
      }),
      place(browserPanel(loader, "/images/StreamBirdIndia.png", WHITE, WHITE), both([0.02, -0.2, 0.4]), both(1.05), {
        spin: [0, 0],
        bob: 0.1,
        delay: 0.4,
      }),
    ],
    tick: (t) => {
      // The back window sways on its own so the stack reads as layered in space.
      lines.rotation.y = Math.sin(t * 0.5) * 0.12 - 0.2;
    },
  };
}

// A conversation with TechJest playing out on a phone, beside a laptop with the enquiry open.
function contact(): Built {
  const chat = phone("chat");
  const desk = laptop();
  return withProps(
    [
      place(
        posed(desk, 0.3, -0.35),
        () => [0.22, 0.1, -1.5],
        () => 1.55,
        { ...calm, delay: 0.1 },
      ),
      place(
        posed(chat, 0.04, 0.3),
        () => [-0.36, -0.1, 1],
        () => 1.05,
        { ...calm, delay: 0.3 },
      ),
    ],
    [chat, desk],
  );
}

// The TechJest mark with a few shapes in orbit: the default for pages without their own scene.
function emblemScene(): Built {
  const orbiters = [
    sphere(CRIMSON),
    new THREE.Mesh(new RoundedBoxGeometry(1, 1, 1, 4, 0.2), glossy(NAVY_RAISED)),
    sphere(STONE, { metalness: 0.5 }),
  ];
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.03, 12, 160), glossy(STONE));
  ring.rotation.x = Math.PI / 2.4;
  return {
    items: [
      place(emblem(), both([0, 0, 0]), both(1), { spin: [0, 0], sway: 0.6, delay: 0.1, bob: 0.1 }),
      place(ring, both([0, 0, 0]), both(1), { spin: [0, 0], delay: 0.25, bob: 0 }),
      ...orbiters.map((mesh, i) =>
        place(mesh, both([0, 0, 0]), both(i === 1 ? 0.42 : 0.32), { delay: 0.4 + i * 0.1, bob: 0 }),
      ),
    ],
    tick: (t) => {
      orbiters.forEach((mesh, i) => {
        const a = t * 0.6 + (i / orbiters.length) * Math.PI * 2;
        mesh.position.set(Math.cos(a) * 2.6, Math.sin(a) * 2.6 * Math.cos(Math.PI / 2.4), Math.sin(a) * 1.2);
      });
    },
  };
}

const easeOutBack = (x: number) => {
  const c = 1.6;
  return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2);
};

export function mountScene(host: HTMLElement, variant: SceneVariant, still: boolean) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.domElement.setAttribute("aria-hidden", "true");
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  scene.environment = pmrem.fromScene(room, 0.04).texture;
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(0, 0, 14);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd9d6ee, 0.9));
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(4, 7, 9);
  scene.add(key);
  const glow = new THREE.PointLight(CRIMSON, 30, 30);
  glow.position.set(-5, -3, 6);
  scene.add(glow);

  let render = () => renderer.render(scene, camera);
  const manager = new THREE.LoadingManager(() => render());
  const loader = new THREE.TextureLoader(manager);
  const built =
    variant === "home"
      ? home()
      : variant === "services"
        ? services()
        : variant === "about"
          ? about(loader)
          : variant === "work"
            ? work(loader)
            : variant === "contact"
              ? contact()
              : variant === "emblem"
                ? emblemScene()
                : single(variant);

  const world = new THREE.Group();
  scene.add(world);
  // anchor: layout position and size. spinner: pop-in, spin and float. object: its own pose.
  const spinners = built.items.map((item) => {
    const spinner = new THREE.Group();
    spinner.add(item.object);
    return spinner;
  });
  const anchors = spinners.map((spinner) => {
    const anchor = new THREE.Group();
    anchor.add(spinner);
    world.add(anchor);
    return anchor;
  });

  let portrait = false;
  const layout = () => {
    const width = host.clientWidth || 1;
    const height = host.clientHeight || 1;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    portrait = camera.aspect < 0.9;
    built.items.forEach((item, i) => {
      const [nx, ny, z] = item.at(portrait);
      const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * (camera.position.z - z);
      const halfW = halfH * camera.aspect;
      // Single-object scenes fill the frame; the home hero sizes against its height.
      const unit = variant === "home" ? halfH / 4.2 : Math.min(halfW, halfH) / 3.4;
      anchors[i]?.position.set(nx * halfW, ny * halfH, z);
      anchors[i]?.scale.setScalar(item.size(portrait) * unit);
    });
  };
  layout();

  let mouseX = 0;
  let mouseY = 0;
  const onPointer = (event: PointerEvent) => {
    mouseX = (event.clientX / window.innerWidth) * 2 - 1;
    mouseY = (event.clientY / window.innerHeight) * 2 - 1;
  };
  window.addEventListener("pointermove", onPointer, { passive: true });

  // Elapsed time only advances while the scene plays, so it resumes rather than replays its pop-in.
  const timer = new THREE.Timer();
  let frame = 0;
  let visible = true;
  const step = () => {
    const t = still ? 2.5 : timer.getElapsed();
    built.items.forEach((item, i) => {
      const spinner = spinners[i];
      if (!spinner) return;
      const grow = still ? 1 : easeOutBack(Math.min(Math.max((t - item.delay) / 1.1, 0), 1));
      spinner.scale.setScalar(Math.max(grow, 0.0001));
      const [sx, sy] = item.spin;
      spinner.rotation.set(sx ? sx * t + i : 0, sy ? sy * t + i * 0.7 : 0, 0);
      if (item.sway) {
        spinner.rotation.y = Math.sin(t * 0.55 + i) * item.sway;
        spinner.rotation.x = Math.sin(t * 0.4 + i) * item.sway * 0.25;
      }
      spinner.position.y = Math.sin(t * 0.9 + i * 1.3) * item.bob;
    });
    built.tick?.(t);
    // Lean toward the pointer, and turn a little as the page scrolls.
    const scrollTurn = Math.min(window.scrollY / 900, 1) * 0.5;
    world.rotation.y += (mouseX * 0.35 + scrollTurn - world.rotation.y) * 0.05;
    world.rotation.x += (mouseY * 0.2 - world.rotation.x) * 0.05;
    renderer.render(scene, camera);
  };
  render = step;
  const loop = () => {
    frame = requestAnimationFrame(loop);
    timer.update();
    step();
  };
  const play = () => {
    if (still || frame || !visible || document.hidden) return;
    timer.reset();
    loop();
  };
  const pause = () => {
    cancelAnimationFrame(frame);
    frame = 0;
  };

  const resize = new ResizeObserver(() => {
    layout();
    step();
  });
  resize.observe(host);
  const seen = new IntersectionObserver(([entry]) => {
    visible = Boolean(entry?.isIntersecting);
    if (visible) play();
    else pause();
  });
  seen.observe(host);
  const onVisibility = () => (document.hidden ? pause() : play());
  document.addEventListener("visibilitychange", onVisibility);
  step();
  play();

  return () => {
    pause();
    resize.disconnect();
    seen.disconnect();
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("pointermove", onPointer);
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material: THREE.Material & { map?: THREE.Texture | null }) => {
          material.map?.dispose();
          material.dispose();
        });
      }
    });
    scene.environment?.dispose();
    pmrem.dispose();
    timer.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };
}
