import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

// Realistic props for TechJest's work, built in code so there is nothing to download: a laptop
// writing code, a phone running an app, an AI chip, a server rack, a design dashboard and an
// automation pipeline. Screens are canvas textures; the ones that move redraw a few times a second.

export type Prop = { object: THREE.Object3D; tick?: (t: number) => void };

const NAVY = "#1b1e4a";
const NAVY_DEEP = "#0f1129";
const CRIMSON = "#d21319";
const STONE = "#c9c8be";
const PAPER = "#f7f6f2";
const PERIWINKLE = "#8fa0ff";
const MINT = "#7fd8a8";

const aluminium = () => new THREE.MeshPhysicalMaterial({ color: 0xc9ccd3, metalness: 1, roughness: 0.32 });
const graphite = () =>
  new THREE.MeshPhysicalMaterial({ color: 0x23262f, metalness: 0.55, roughness: 0.38, clearcoat: 0.4 });
const darkGlass = () => new THREE.MeshPhysicalMaterial({ color: 0x0b0c14, metalness: 0.2, roughness: 0.08 });
const screen = (texture: THREE.Texture) => new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });

function canvas(width: number, height: number) {
  const element = document.createElement("canvas");
  element.width = width;
  element.height = height;
  const ctx = element.getContext("2d");
  if (!ctx) throw new Error("2D canvas unavailable");
  const texture = new THREE.CanvasTexture(element);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return { ctx, texture, width, height };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

// Scales an object so its largest side is `size`, and centres it on the origin.
export function fit(object: THREE.Object3D, size = 2.6) {
  const box = new THREE.Box3().setFromObject(object);
  const dims = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  const holder = new THREE.Group();
  object.position.sub(centre);
  holder.add(object);
  holder.scale.setScalar(size / Math.max(dims.x, dims.y, dims.z, 0.001));
  return holder;
}

/* ---------- Laptop: an editor typing TechJest's launch script ---------- */

const CODE = [
  'import { automate } from "@techjest/ai";',
  "",
  "export async function launch(idea) {",
  "  const plan = await design(idea);",
  "  const app = await build(plan, {",
  "    web: true,",
  "    mobile: true,",
  "  });",
  "  await automate(app.workflows);",
  "  return deploy(app); // live in weeks",
  "}",
];
const KEYWORDS = new Set(["import", "from", "export", "async", "function", "const", "await", "return", "true"]);

function drawCode(ctx: CanvasRenderingContext2D, w: number, h: number, typed: number, caretOn: boolean) {
  ctx.fillStyle = "#11132b";
  ctx.fillRect(0, 0, w, h);
  // Window chrome and tabs.
  ctx.fillStyle = "#191c3d";
  ctx.fillRect(0, 0, w, 54);
  [CRIMSON, "#e7b448", MINT].forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(30 + i * 26, 27, 8, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.fillStyle = "#11132b";
  roundRect(ctx, 120, 12, 190, 42, 8);
  ctx.fill();
  ctx.fillStyle = STONE;
  ctx.font = "500 20px ui-monospace, Menlo, monospace";
  ctx.fillText("launch.ts", 146, 40);
  ctx.fillStyle = "#6d7196";
  ctx.fillText("deploy.yml", 340, 40);
  // Code, typed up to `typed` characters.
  ctx.font = "500 25px ui-monospace, Menlo, monospace";
  let left = typed;
  let caret = null as [number, number] | null;
  CODE.forEach((line, row) => {
    const y = 104 + row * 40;
    ctx.fillStyle = "#4a4e78";
    ctx.fillText(String(row + 1).padStart(2, " "), 22, y);
    if (left <= 0) return;
    const shown = line.slice(0, left);
    left -= line.length + 1;
    let x = 78;
    const tokens = shown.split(/(\s+|[(){}.,;:]|"[^"]*"?|\/\/.*$)/).filter(Boolean);
    tokens.forEach((token, k) => {
      ctx.fillStyle = token.startsWith("//")
        ? "#6d7196"
        : token.startsWith('"')
          ? MINT
          : KEYWORDS.has(token)
            ? "#ff6b70"
            : tokens[k + 1] === "("
              ? PERIWINKLE
              : "#e6e8ff";
      ctx.fillText(token, x, y);
      x += ctx.measureText(token).width;
    });
    if (left <= 0 || row === CODE.length - 1) caret = [x, y];
  });
  if (caretOn && caret) {
    const [cx, cy] = caret;
    ctx.fillStyle = CRIMSON;
    ctx.fillRect(cx + 2, cy - 22, 12, 28);
  }
  // Status bar.
  ctx.fillStyle = CRIMSON;
  ctx.fillRect(0, h - 34, w, 34);
  ctx.fillStyle = "#fff";
  ctx.font = "600 18px ui-monospace, Menlo, monospace";
  ctx.fillText("● main   ✓ tests passing   TechJest", 20, h - 11);
}

export function laptop(): Prop {
  const group = new THREE.Group();
  const base = new THREE.Mesh(new RoundedBoxGeometry(3.2, 0.12, 2.15, 4, 0.05), aluminium());
  group.add(base);
  // Keyboard well and trackpad.
  const keys = canvas(512, 200);
  keys.ctx.fillStyle = "#1d2028";
  keys.ctx.fillRect(0, 0, 512, 200);
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 14; col++) {
      keys.ctx.fillStyle = "#2c303b";
      roundRect(keys.ctx, 8 + col * 36, 8 + row * 38, 30, 32, 4);
      keys.ctx.fill();
    }
  }
  const keyboard = new THREE.Mesh(
    new THREE.PlaneGeometry(2.8, 1.05),
    new THREE.MeshStandardMaterial({ map: keys.texture, roughness: 0.7 }),
  );
  keyboard.rotation.x = -Math.PI / 2;
  keyboard.position.set(0, 0.062, -0.38);
  group.add(keyboard);
  const pad = new THREE.Mesh(
    new THREE.PlaneGeometry(1.05, 0.62),
    new THREE.MeshPhysicalMaterial({ color: 0xb9bdc6, metalness: 0.8, roughness: 0.45 }),
  );
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(0, 0.062, 0.62);
  group.add(pad);
  // Lid, hinged at the back edge and opened a little past upright.
  const lid = new THREE.Group();
  lid.position.set(0, 0.06, -1.06);
  const shell = new THREE.Mesh(new RoundedBoxGeometry(3.2, 2.08, 0.07, 4, 0.03), aluminium());
  shell.position.set(0, 1.04, -0.02);
  lid.add(shell);
  const bezel = new THREE.Mesh(new THREE.PlaneGeometry(3.08, 1.96), darkGlass());
  bezel.position.set(0, 1.04, 0.017);
  lid.add(bezel);
  const code = canvas(1024, 600);
  const display = new THREE.Mesh(new THREE.PlaneGeometry(2.92, 1.72), screen(code.texture));
  display.position.set(0, 1.06, 0.02);
  lid.add(display);
  lid.rotation.x = -0.22;
  group.add(lid);

  const total = CODE.join("\n").length;
  let last = -1;
  return {
    object: group,
    tick: (t) => {
      // Type for ~7s, hold the finished script for ~3s, then start again.
      const cycle = t % 10;
      const typed = Math.min(Math.floor(cycle * 26), total);
      const caretOn = Math.floor(t * 2.4) % 2 === 0;
      const key = typed * 2 + (caretOn ? 1 : 0);
      if (key === last) return;
      last = key;
      drawCode(code.ctx, code.width, code.height, typed, caretOn);
      code.texture.needsUpdate = true;
    },
  };
}

/* ---------- Phone: an app home screen, or a chat with TechJest ---------- */

function statusBar(ctx: CanvasRenderingContext2D, w: number, color: string) {
  ctx.fillStyle = color;
  ctx.font = "600 26px system-ui, sans-serif";
  ctx.fillText("9:41", 44, 52);
  ctx.fillRect(w - 92, 34, 44, 20);
  ctx.fillStyle = "#000";
  roundRect(ctx, w / 2 - 70, 22, 140, 40, 20);
  ctx.fill();
}

function drawApp(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = NAVY;
  ctx.fillRect(0, 0, w, 300);
  statusBar(ctx, w, "#fff");
  ctx.fillStyle = STONE;
  ctx.font = "500 26px system-ui, sans-serif";
  ctx.fillText("Good morning", 44, 150);
  ctx.fillStyle = "#fff";
  ctx.font = "700 46px system-ui, sans-serif";
  ctx.fillText("Orders today", 44, 210);
  ctx.fillStyle = "#ff6b70";
  ctx.font = "800 40px system-ui, sans-serif";
  ctx.fillText("+24%", 44, 268);
  // Chart card with bars that breathe.
  ctx.fillStyle = "#fff";
  roundRect(ctx, 32, 330, w - 64, 330, 28);
  ctx.fill();
  const bars = [0.45, 0.62, 0.38, 0.8, 0.55, 0.92, 0.7];
  bars.forEach((value, i) => {
    const grow = value * (0.85 + 0.15 * Math.sin(t * 1.6 + i));
    const bh = grow * 230;
    ctx.fillStyle = i === 5 ? CRIMSON : NAVY;
    roundRect(ctx, 70 + i * 58, 620 - bh, 34, bh, 10);
    ctx.fill();
  });
  // List rows.
  ["New order #1042", "Payment received", "Delivery booked"].forEach((label, i) => {
    const y = 700 + i * 112;
    ctx.fillStyle = "#fff";
    roundRect(ctx, 32, y, w - 64, 92, 22);
    ctx.fill();
    ctx.fillStyle = i === 0 ? CRIMSON : NAVY;
    ctx.beginPath();
    ctx.arc(84, y + 46, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = NAVY;
    ctx.font = "600 26px system-ui, sans-serif";
    ctx.fillText(label, 126, y + 55);
  });
  ctx.fillStyle = CRIMSON;
  roundRect(ctx, 32, h - 120, w - 64, 76, 38);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = "700 28px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("View report", w / 2, h - 72);
  ctx.textAlign = "start";
}

const CHAT: [boolean, string][] = [
  [false, "Hi! We need an app for our shop."],
  [true, "Great — tell us about your customers."],
  [false, "Online orders + delivery tracking."],
  [true, "Perfect. Proposal in 1 business day."],
];

function drawChat(ctx: CanvasRenderingContext2D, w: number, h: number, shown: number, typing: boolean) {
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = NAVY;
  ctx.fillRect(0, 0, w, 190);
  statusBar(ctx, w, "#fff");
  ctx.fillStyle = CRIMSON;
  ctx.beginPath();
  ctx.arc(84, 132, 32, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = "800 30px system-ui, sans-serif";
  ctx.fillText("T", 74, 143);
  ctx.font = "700 30px system-ui, sans-serif";
  ctx.fillText("TechJest", 132, 128);
  ctx.fillStyle = MINT;
  ctx.font = "500 22px system-ui, sans-serif";
  ctx.fillText("● online", 132, 160);
  ctx.font = "500 25px system-ui, sans-serif";
  let y = 240;
  CHAT.slice(0, shown).forEach(([ours, text]) => {
    const width = Math.min(ctx.measureText(text).width + 48, w - 120);
    const x = ours ? 40 : w - 40 - width;
    ctx.fillStyle = ours ? "#fff" : NAVY;
    roundRect(ctx, x, y, width, 70, 26);
    ctx.fill();
    ctx.fillStyle = ours ? NAVY : "#fff";
    ctx.fillText(text, x + 24, y + 44, width - 48);
    y += 96;
  });
  if (typing) {
    ctx.fillStyle = "#fff";
    roundRect(ctx, 40, y, 120, 64, 26);
    ctx.fill();
    [0, 1, 2].forEach((i) => {
      ctx.fillStyle = i === 1 ? NAVY : CRIMSON;
      ctx.beginPath();
      ctx.arc(72 + i * 28, y + 32, 8, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  ctx.fillStyle = "#fff";
  roundRect(ctx, 32, h - 110, w - 64, 72, 36);
  ctx.fill();
  ctx.fillStyle = "#9a99a0";
  ctx.font = "500 24px system-ui, sans-serif";
  ctx.fillText("Message TechJest…", 64, h - 64);
}

export function phone(mode: "app" | "chat" = "app"): Prop {
  const group = new THREE.Group();
  group.add(new THREE.Mesh(new RoundedBoxGeometry(0.92, 1.9, 0.09, 6, 0.04), graphite()));
  const glass = new THREE.Mesh(new RoundedBoxGeometry(0.86, 1.84, 0.01, 4, 0.004), darkGlass());
  glass.position.z = 0.046;
  group.add(glass);
  const ui = canvas(540, 1140);
  const display = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.69), screen(ui.texture));
  display.position.z = 0.053;
  group.add(display);
  const lens = new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.34, 0.04, 4, 0.06), graphite());
  lens.position.set(-0.2, 0.68, -0.06);
  group.add(lens);
  let last = -1;
  return {
    object: group,
    tick: (t) => {
      if (mode === "app") {
        const frame = Math.floor(t * 8);
        if (frame === last) return;
        last = frame;
        drawApp(ui.ctx, ui.width, ui.height, t);
      } else {
        // One message every 1.4s, with the reply "typing" first; loops every 9s.
        const cycle = t % 9;
        const shown = Math.min(Math.floor(cycle / 1.4), CHAT.length);
        const typing = shown < CHAT.length && CHAT[shown]?.[0] === true && cycle % 1.4 > 0.5;
        const key = shown * 2 + (typing ? 1 : 0);
        if (key === last) return;
        last = key;
        drawChat(ui.ctx, ui.width, ui.height, shown, typing);
      }
      ui.texture.needsUpdate = true;
    },
  };
}

/* ---------- AI chip ---------- */

export function aiChip(): Prop {
  const group = new THREE.Group();
  const board = canvas(512, 512);
  const { ctx } = board;
  ctx.fillStyle = "#161827";
  ctx.fillRect(0, 0, 512, 512);
  ctx.lineCap = "round";
  // Circuit traces running from the core to the edges.
  for (let i = 0; i < 28; i++) {
    const side = i % 4;
    const offset = 60 + ((i * 53) % 392);
    ctx.strokeStyle = i % 5 === 0 ? CRIMSON : "#3b4170";
    ctx.lineWidth = i % 5 === 0 ? 5 : 3;
    ctx.beginPath();
    const [sx, sy] = side === 0 ? [offset, 0] : side === 1 ? [512, offset] : side === 2 ? [offset, 512] : [0, offset];
    ctx.moveTo(sx, sy);
    const mid = side % 2 === 0 ? [sx, sy === 0 ? 120 : 392] : [sx === 0 ? 120 : 392, sy];
    ctx.lineTo(mid[0] ?? sx, mid[1] ?? sy);
    ctx.lineTo(256 + (sx - 256) * 0.28, 256 + (sy - 256) * 0.28);
    ctx.stroke();
    ctx.fillStyle = ctx.strokeStyle;
    ctx.beginPath();
    ctx.arc(mid[0] ?? sx, mid[1] ?? sy, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#0d0e19";
  roundRect(ctx, 150, 150, 212, 212, 18);
  ctx.fill();
  ctx.strokeStyle = CRIMSON;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.font = "800 96px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("AI", 256, 290);
  ctx.font = "600 22px ui-monospace, Menlo, monospace";
  ctx.fillStyle = STONE;
  ctx.fillText("TJ-01", 256, 330);
  const top = new THREE.MeshStandardMaterial({
    map: board.texture,
    emissiveMap: board.texture,
    emissive: 0xffffff,
    emissiveIntensity: 0.55,
    roughness: 0.45,
    metalness: 0.3,
  });
  const body = new THREE.Mesh(new RoundedBoxGeometry(2, 0.2, 2, 4, 0.04), graphite());
  group.add(body);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.9), top);
  face.rotation.x = -Math.PI / 2;
  face.position.y = 0.102;
  group.add(face);
  const pinMaterial = new THREE.MeshPhysicalMaterial({ color: 0xd8b56a, metalness: 1, roughness: 0.28 });
  const pin = new THREE.BoxGeometry(0.07, 0.05, 0.22);
  for (let side = 0; side < 4; side++) {
    for (let i = 0; i < 10; i++) {
      const mesh = new THREE.Mesh(pin, pinMaterial);
      const along = -0.81 + i * 0.18;
      mesh.position.set(along, -0.06, 1.1);
      const holder = new THREE.Group();
      holder.rotation.y = (side * Math.PI) / 2;
      holder.add(mesh);
      group.add(holder);
    }
  }
  group.rotation.x = 0.9;
  return {
    object: group,
    tick: (t) => {
      top.emissiveIntensity = 0.45 + Math.sin(t * 2.2) * 0.2;
    },
  };
}

/* ---------- Server rack with blinking status lights ---------- */

export function serverRack(): Prop {
  const group = new THREE.Group();
  const front = canvas(512, 96);
  front.ctx.fillStyle = "#1b1e2a";
  front.ctx.fillRect(0, 0, 512, 96);
  for (let i = 0; i < 26; i++) {
    front.ctx.fillStyle = "#2f3342";
    front.ctx.fillRect(150 + i * 12, 22, 6, 52);
  }
  front.ctx.fillStyle = STONE;
  front.ctx.font = "600 22px ui-monospace, Menlo, monospace";
  front.ctx.fillText("TJ-NODE", 22, 56);
  const lights: THREE.MeshStandardMaterial[] = [];
  for (let unit = 0; unit < 4; unit++) {
    const y = unit * 0.48;
    const box = new THREE.Mesh(new RoundedBoxGeometry(2.4, 0.42, 1.5, 3, 0.03), graphite());
    box.position.y = y;
    group.add(box);
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(2.3, 0.36),
      new THREE.MeshStandardMaterial({ map: front.texture, roughness: 0.6 }),
    );
    panel.position.set(0, y, 0.752);
    group.add(panel);
    [MINT, MINT, CRIMSON].forEach((color, i) => {
      const material = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1 });
      lights.push(material);
      const led = new THREE.Mesh(new THREE.CircleGeometry(0.035, 16), material);
      led.position.set(0.82 + i * 0.12, y, 0.756);
      group.add(led);
    });
  }
  return {
    object: group,
    tick: (t) => {
      lights.forEach((material, i) => {
        material.emissiveIntensity = Math.sin(t * (3 + (i % 5)) + i * 1.7) > 0.2 ? 2.2 : 0.15;
      });
    },
  };
}

/* ---------- Design dashboard on a glass panel ---------- */

export function dashboard(): Prop {
  const group = new THREE.Group();
  const ui = canvas(900, 600);
  const { ctx } = ui;
  ctx.fillStyle = "#fbfaf6";
  ctx.fillRect(0, 0, 900, 600);
  ctx.fillStyle = NAVY;
  ctx.fillRect(0, 0, 180, 600);
  ["Overview", "Users", "Flows", "Design"].forEach((label, i) => {
    ctx.fillStyle = i === 0 ? CRIMSON : "rgba(255,255,255,0.12)";
    roundRect(ctx, 20, 90 + i * 64, 140, 44, 10);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "600 20px system-ui, sans-serif";
    ctx.fillText(label, 36, 119 + i * 64);
  });
  [
    ["Conversion", "4.8%"],
    ["Sessions", "12.4k"],
    ["NPS", "72"],
  ].forEach(([label, value], i) => {
    const x = 210 + i * 225;
    ctx.fillStyle = "#fff";
    roundRect(ctx, x, 30, 205, 120, 16);
    ctx.fill();
    ctx.fillStyle = "#62615a";
    ctx.font = "500 20px system-ui, sans-serif";
    ctx.fillText(label ?? "", x + 20, 70);
    ctx.fillStyle = NAVY;
    ctx.font = "800 40px system-ui, sans-serif";
    ctx.fillText(value ?? "", x + 20, 122);
  });
  ctx.fillStyle = "#fff";
  roundRect(ctx, 210, 175, 655, 390, 16);
  ctx.fill();
  ctx.strokeStyle = CRIMSON;
  ctx.lineWidth = 6;
  ctx.lineJoin = "round";
  ctx.beginPath();
  [0.7, 0.6, 0.66, 0.45, 0.5, 0.3, 0.36, 0.18].forEach((v, i) => {
    const x = 250 + i * 85;
    const y = 200 + v * 330;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.strokeStyle = NAVY;
  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  [0.8, 0.75, 0.7, 0.72, 0.6, 0.62, 0.5, 0.48].forEach((v, i) => {
    const x = 250 + i * 85;
    const y = 200 + v * 330;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.globalAlpha = 1;
  const panel = new THREE.Mesh(new RoundedBoxGeometry(3.2, 2.15, 0.06, 4, 0.05), darkGlass());
  group.add(panel);
  const display = new THREE.Mesh(new THREE.PlaneGeometry(3.08, 2.05), screen(ui.texture));
  display.position.z = 0.032;
  group.add(display);
  // A colour-swatch card and a component card floating in front, like a design file.
  const swatch = canvas(300, 120);
  [NAVY, CRIMSON, STONE].forEach((color, i) => {
    swatch.ctx.fillStyle = color;
    roundRect(swatch.ctx, 16 + i * 96, 16, 80, 88, 14);
    swatch.ctx.fill();
  });
  const swatchCard = new THREE.Mesh(
    new RoundedBoxGeometry(1.1, 0.46, 0.04, 3, 0.04),
    new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.3 }),
  );
  const swatchFace = new THREE.Mesh(new THREE.PlaneGeometry(1.02, 0.4), screen(swatch.texture));
  swatchFace.position.z = 0.022;
  swatchCard.add(swatchFace);
  swatchCard.position.set(1.3, -0.9, 0.5);
  group.add(swatchCard);
  const button = canvas(300, 100);
  button.ctx.fillStyle = CRIMSON;
  roundRect(button.ctx, 0, 0, 300, 100, 50);
  button.ctx.fill();
  button.ctx.fillStyle = "#fff";
  button.ctx.font = "700 36px system-ui, sans-serif";
  button.ctx.textAlign = "center";
  button.ctx.fillText("Get started", 150, 62);
  const buttonCard = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.3), screen(button.texture));
  buttonCard.position.set(-1.25, 0.95, 0.45);
  group.add(buttonCard);
  return {
    object: group,
    tick: (t) => {
      swatchCard.position.y = -0.9 + Math.sin(t * 1.3) * 0.06;
      buttonCard.position.y = 0.95 + Math.sin(t * 1.1 + 1) * 0.06;
    },
  };
}

/* ---------- Automation pipeline: steps linked by tubes, with data flowing through ---------- */

function nodeFace(label: string, accent: string) {
  const face = canvas(256, 256);
  face.ctx.fillStyle = "#1b1e2a";
  face.ctx.fillRect(0, 0, 256, 256);
  face.ctx.strokeStyle = accent;
  face.ctx.lineWidth = 8;
  roundRect(face.ctx, 18, 18, 220, 220, 36);
  face.ctx.stroke();
  face.ctx.fillStyle = "#fff";
  face.ctx.font = `800 ${label.length > 2 ? 64 : 92}px system-ui, sans-serif`;
  face.ctx.textAlign = "center";
  face.ctx.textBaseline = "middle";
  face.ctx.fillText(label, 128, 134);
  return face.texture;
}

export function pipeline(): Prop {
  const group = new THREE.Group();
  const steps: [string, string, THREE.Vector3][] = [
    ["@", PERIWINKLE, new THREE.Vector3(-2.2, 0.9, 0)],
    ["AI", CRIMSON, new THREE.Vector3(-0.6, -0.2, 0.4)],
    ["{ }", PERIWINKLE, new THREE.Vector3(0.9, 0.7, -0.2)],
    ["✓", MINT, new THREE.Vector3(2.2, -0.6, 0.2)],
  ];
  steps.forEach(([label, accent, at]) => {
    const node = new THREE.Mesh(new RoundedBoxGeometry(0.9, 0.9, 0.9, 4, 0.14), graphite());
    node.position.copy(at);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.78), screen(nodeFace(label, accent)));
    face.position.z = 0.452;
    node.add(face);
    group.add(node);
  });
  const curve = new THREE.CatmullRomCurve3(steps.map(([, , at]) => at.clone()));
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 120, 0.05, 12, false),
    new THREE.MeshPhysicalMaterial({ color: 0xb9bdc6, metalness: 1, roughness: 0.3 }),
  );
  group.add(tube);
  const packets = [0, 1, 2].map(() => {
    const packet = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 24, 16),
      new THREE.MeshStandardMaterial({ color: CRIMSON, emissive: CRIMSON, emissiveIntensity: 1.8 }),
    );
    group.add(packet);
    return packet;
  });
  return {
    object: group,
    tick: (t) => {
      packets.forEach((packet, i) => {
        packet.position.copy(curve.getPointAt((((t * 0.18 + i / packets.length) % 1) + 1) % 1));
      });
    },
  };
}
