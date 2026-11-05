(() => {
  const photoPaths = Array.from({ length: 15 }, (_, index) => `img/fotos/foto${index + 1}.jpg`);
  let memories = photoPaths.map((image, index) => {
    const story = window.memoryStories[index] || {};
    return {
      id: `memory-${index + 1}`,
      image,
      mediaType: "image",
      title: story.titulo || `Recuerdo ${index + 1}`,
      description: story.texto || "Todavía no hay una descripción para este recuerdo.",
      capturedAt: null
    };
  });
  const colors = [0xf08bc2, 0x86b9ff, 0xb996ff, 0xffc886, 0x8fe0ce];
  const profileStorageKey = "memoryUniverse.profile";
  const defaultProfile = {
    name: "Explorador",
    shipColor: "#d8d1ec",
    characterColor: "#cac9dd"
  };
  function normalizeName(value) {
    return typeof value === "string"
      ? value.trim().replace(/\s+/g, " ").slice(0, 24) || defaultProfile.name
      : defaultProfile.name;
  }
  function normalizeProfile(value) {
    return {
      name: normalizeName(value && value.name),
      shipColor: /^#[0-9a-f]{6}$/i.test(value && value.shipColor) ? value.shipColor : defaultProfile.shipColor,
      characterColor: /^#[0-9a-f]{6}$/i.test(value && value.characterColor)
        ? value.characterColor
        : defaultProfile.characterColor
    };
  }
  function readProfile() {
    try {
      const saved = localStorage.getItem(profileStorageKey);
      return saved ? normalizeProfile(JSON.parse(saved)) : { ...defaultProfile };
    } catch (error) {
      console.warn("No se pudo leer el perfil guardado; se usarán los colores predeterminados.", error);
      return { ...defaultProfile };
    }
  }
  const profile = readProfile();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05040c);
  scene.fog = new THREE.FogExp2(0x05040c, 0.0009);

  function createReflectionEnvironment() {
    const faceColors = [
      ["#1c1730", "#4c3163"],
      ["#070914", "#35254e"],
      ["#201631", "#76506d"],
      ["#080b18", "#292348"],
      ["#101627", "#603d65"],
      ["#080a16", "#332b59"]
    ];
    const faces = faceColors.map(([topColor, bottomColor], faceIndex) => {
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 256;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("No se pudo crear el entorno de reflejos.");
      const gradient = context.createLinearGradient(0, 0, 256, 256);
      gradient.addColorStop(0, topColor);
      gradient.addColorStop(1, bottomColor);
      context.fillStyle = gradient;
      context.fillRect(0, 0, 256, 256);
      for (let starIndex = 0; starIndex < 44; starIndex += 1) {
        const x = Math.random() * 256;
        const y = Math.random() * 256;
        const radius = 0.5 + Math.random() * 1.7;
        context.fillStyle = starIndex % 8 === faceIndex % 8 ? "#ffb9e8" : "#c8d6ff";
        context.globalAlpha = 0.25 + Math.random() * 0.6;
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;
      return canvas;
    });
    const environment = new THREE.CubeTexture(faces);
    environment.mapping = THREE.CubeReflectionMapping;
    environment.encoding = THREE.sRGBEncoding;
    environment.needsUpdate = true;
    scene.environment = environment;
    return environment;
  }

  createReflectionEnvironment();

  const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.1, 1800);
  camera.position.set(0, 0, 58);
  camera.rotation.order = "YXZ";

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  document.body.appendChild(renderer.domElement);
  renderer.domElement.setAttribute("aria-label", "Universo 3D de recuerdos");
  renderer.domElement.style.touchAction = "none";

  scene.add(new THREE.AmbientLight(0xb9a6d8, 1.15));
  const keyLight = new THREE.PointLight(0xffc8ed, 1.5, 420);
  keyLight.position.set(-35, 38, 42);
  scene.add(keyLight);

  const ship = new THREE.Group();
  const shipBodyMaterial = new THREE.MeshStandardMaterial({
    color: profile.shipColor,
    metalness: 0.68,
    roughness: 0.24,
    envMapIntensity: 1.25,
    flatShading: true
  });
  const shipAccentMaterial = new THREE.MeshStandardMaterial({
    color: 0xed8ec8,
    emissive: 0x7d235d,
    emissiveIntensity: 0.4,
    metalness: 0.58,
    roughness: 0.24,
    envMapIntensity: 1.15
  });
  const shipGlassMaterial = new THREE.MeshStandardMaterial({
    color: 0x77dfff,
    emissive: 0x174c82,
    emissiveIntensity: 0.7,
    metalness: 0.25,
    roughness: 0.15
  });
  const shipNose = new THREE.Mesh(new THREE.ConeGeometry(0.78, 3.8, 8), shipBodyMaterial);
  shipNose.userData.profileColor = "ship";
  shipNose.rotation.x = -Math.PI / 2;
  shipNose.position.z = -1.6;
  ship.add(shipNose);
  const shipCabin = new THREE.Mesh(new THREE.SphereGeometry(0.67, 16, 10), shipGlassMaterial);
  shipCabin.scale.set(0.9, 0.72, 1.35);
  shipCabin.position.set(0, 0.43, -0.5);
  ship.add(shipCabin);
  const shipThrusters = [];
  const boostAuras = [];
  [-1, 1].forEach((side) => {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.18, 1.45), shipBodyMaterial);
    wing.userData.profileColor = "ship";
    wing.position.set(side * 1.45, -0.12, 0.65);
    wing.rotation.y = side * -0.12;
    ship.add(wing);

    const engine = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.4, 1.05, 10), shipAccentMaterial);
    engine.userData.profileColor = "ship";
    engine.rotation.x = Math.PI / 2;
    engine.position.set(side * 1.3, -0.05, 1.2);
    ship.add(engine);

    const thruster = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 12, 8),
      new THREE.MeshBasicMaterial({ color: 0x9deaff })
    );
    thruster.position.set(side * 1.3, -0.05, 1.77);
    ship.add(thruster);
    shipThrusters.push(thruster);

    const aura = new THREE.Mesh(
      new THREE.ConeGeometry(0.62, 5, 16, 1, true),
      new THREE.MeshBasicMaterial({
        color: side < 0 ? 0x83dcff : 0xff8ad9,
        transparent: true,
        opacity: 0.19,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    aura.position.set(side * 1.45, -0.05, 3.35);
    aura.rotation.x = Math.PI / 2;
    aura.visible = false;
    ship.add(aura);
    boostAuras.push(aura);
  });
  ship.visible = false;
  scene.add(ship);

  const astronaut = new THREE.Group();
  const suitMaterial = new THREE.MeshStandardMaterial({
    color: profile.characterColor,
    roughness: 0.38,
    metalness: 0.28,
    envMapIntensity: 0.85,
    flatShading: true
  });
  const suitAccent = new THREE.MeshStandardMaterial({
    color: 0x8c73aa,
    emissive: 0x261533,
    roughness: 0.32,
    metalness: 0.35,
    envMapIntensity: 0.9,
    flatShading: true
  });
  const visorMaterial = new THREE.MeshStandardMaterial({
    color: 0x63d7ee,
    emissive: 0x124b62,
    emissiveIntensity: 0.5,
    metalness: 0.35,
    roughness: 0.2
  });
  const astronautBody = new THREE.Mesh(new THREE.SphereGeometry(0.82, 16, 12), suitMaterial);
  astronautBody.userData.profileColor = "character";
  astronautBody.scale.set(0.78, 1.05, 0.62);
  astronautBody.position.y = 1.25;
  astronaut.add(astronautBody);
  const astronautHelmet = new THREE.Mesh(new THREE.SphereGeometry(0.66, 20, 14), suitMaterial);
  astronautHelmet.userData.profileColor = "character";
  astronautHelmet.position.y = 2.45;
  astronaut.add(astronautHelmet);
  const astronautVisor = new THREE.Mesh(new THREE.SphereGeometry(0.49, 16, 12), visorMaterial);
  astronautVisor.scale.set(1, 0.75, 0.38);
  astronautVisor.position.set(0, 2.46, -0.46);
  astronaut.add(astronautVisor);
  const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.25, 0.48), suitAccent);
  backpack.userData.profileColor = "character";
  backpack.position.set(0, 1.35, 0.58);
  astronaut.add(backpack);
  const limbs = [];
  function addLimb(start, end, radius, material) {
    const from = new THREE.Vector3(...start);
    const to = new THREE.Vector3(...end);
    const direction = new THREE.Vector3().subVectors(to, from);
    const limb = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.78, radius, direction.length(), 10), material);
    limb.position.copy(from).add(to).multiplyScalar(0.5);
    limb.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    astronaut.add(limb);
    limb.userData.profileColor = "character";
    limbs.push(limb);
    return limb;
  }
  addLimb([-0.53, 1.75, 0], [-0.88, 1.15, -0.2], 0.2, suitMaterial);
  addLimb([0.53, 1.75, 0], [0.88, 1.15, -0.2], 0.2, suitMaterial);
  addLimb([-0.3, 0.72, 0], [-0.36, 0.05, 0.08], 0.25, suitMaterial);
  addLimb([0.3, 0.72, 0], [0.36, 0.05, 0.08], 0.25, suitMaterial);
  const jetpackFlames = [];
  [-0.25, 0.25].forEach((side) => {
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.16, 0.9, 8),
      new THREE.MeshBasicMaterial({ color: 0xff9a64, transparent: true, opacity: 0.75 })
    );
    flame.position.set(side, 0.45, 0.8);
    flame.rotation.x = Math.PI;
    astronaut.add(flame);
    jetpackFlames.push(flame);
  });
  astronaut.visible = false;
  scene.add(astronaut);

  function createStars() {
    const count = 5200;
    const positions = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      const offset = index * 3;
      positions[offset] = (Math.random() - 0.5) * 950;
      positions[offset + 1] = (Math.random() - 0.5) * 620;
      positions[offset + 2] = (Math.random() - 0.5) * 950;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: 0xe9ddff,
      size: 0.7,
      transparent: true,
      opacity: 0.85,
      sizeAttenuation: true
    });
    const stars = new THREE.Points(geometry, material);
    scene.add(stars);
    return stars;
  }

  function createHeartField() {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("No se pudo crear la textura de partículas románticas.");
    context.font = "96px Segoe UI Symbol";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.shadowColor = "#ff86d7";
    context.shadowBlur = 22;
    context.fillStyle = "#ffb2e8";
    context.fillText("♥", 64, 67);
    const texture = new THREE.CanvasTexture(canvas);
    const particles = [];
    for (let index = 0; index < 36; index += 1) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      }));
      const scale = 0.45 + Math.random() * 0.75;
      sprite.scale.set(scale, scale, 1);
      sprite.position.set(
        (Math.random() - 0.5) * 100,
        (Math.random() - 0.5) * 65,
        (Math.random() - 0.5) * 110
      );
      scene.add(sprite);
      particles.push({
        sprite,
        speed: 0.5 + Math.random() * 1.2,
        drift: (Math.random() - 0.5) * 0.45,
        phase: Math.random() * Math.PI * 2
      });
    }
    return { particles, texture };
  }

  const meteoriteColors = [0xff79be, 0x9a83ff, 0x5bcde3, 0xffc46f, 0xf18f9d];
  const heartShape = new THREE.Shape();
  heartShape.moveTo(0, 0.3);
  heartShape.bezierCurveTo(0.5, 0.9, 1, 0.3, 0, -0.55);
  heartShape.bezierCurveTo(-1, 0.3, -0.5, 0.9, 0, 0.3);
  const meteoriteHeartGeometry = new THREE.ExtrudeGeometry(heartShape, {
    depth: 0.18,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.08,
    bevelThickness: 0.06
  });
  meteoriteHeartGeometry.scale(0.65, 0.65, 0.65);
  const meteoriteHeartMaterial = new THREE.MeshStandardMaterial({
    color: 0xffb8e3,
    emissive: 0xb51669,
    emissiveIntensity: 0.9,
    metalness: 0.25,
    roughness: 0.32,
    side: THREE.DoubleSide
  });
  const meteoriteGeometry = new THREE.IcosahedronGeometry(1, 1);
  const laserGeometry = new THREE.CylinderGeometry(0.055, 0.1, 2.8, 8);
  const laserUp = new THREE.Vector3(0, 1, 0);

  function randomUnitVector() {
    return new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
  }

  function placeMeteoriteAhead(object, minimumDistance = 70, maximumDistance = 200) {
    const forward = camera.getWorldDirection(new THREE.Vector3());
    const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
    const up = new THREE.Vector3().crossVectors(right, forward).normalize();
    object.position.copy(camera.position)
      .addScaledVector(forward, minimumDistance + Math.random() * (maximumDistance - minimumDistance))
      .addScaledVector(right, (Math.random() - 0.5) * 130)
      .addScaledVector(up, (Math.random() - 0.5) * 90);
  }

  function createMeteorite() {
    const radius = 1.4 + Math.random() * 2.6;
    const rockGeometry = meteoriteGeometry.clone();
    const positions = rockGeometry.attributes.position;
    for (let index = 0; index < positions.count; index += 1) {
      const distortion = 0.78 + Math.random() * 0.42;
      positions.setXYZ(index, positions.getX(index) * distortion, positions.getY(index) * distortion, positions.getZ(index) * distortion);
    }
    positions.needsUpdate = true;
    rockGeometry.computeVertexNormals();
    const group = new THREE.Group();
    group.userData.radius = radius;
    const rock = new THREE.Mesh(rockGeometry, new THREE.MeshStandardMaterial({
      color: meteoriteColors[Math.floor(Math.random() * meteoriteColors.length)],
      roughness: 0.72,
      metalness: 0.18,
      flatShading: true,
      envMapIntensity: 0.35
    }));
    rock.scale.set(radius, radius * (0.72 + Math.random() * 0.48), radius * (0.78 + Math.random() * 0.44));
    group.add(rock);
    const heart = new THREE.Mesh(meteoriteHeartGeometry, meteoriteHeartMaterial);
    heart.position.set(0, radius * 0.18, -radius * 0.78);
    heart.rotation.z = (Math.random() - 0.5) * 0.35;
    heart.scale.setScalar(Math.max(0.7, radius * 0.55));
    group.add(heart);
    group.rotation.copy(new THREE.Euler(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI));
    group.userData.spin = new THREE.Vector3(
      (Math.random() - 0.5) * 0.45,
      (Math.random() - 0.5) * 0.6,
      (Math.random() - 0.5) * 0.45
    );
    group.userData.drift = randomUnitVector().multiplyScalar(0.45 + Math.random() * 1.4);
    placeMeteoriteAhead(group);
    scene.add(group);
    return group;
  }

  function createMeteoriteField(count = 32) {
    return Array.from({ length: count }, createMeteorite);
  }

  function createCosmicResources(textureForTrail) {
    const loader = new THREE.TextureLoader();
    const resources = Array.from({ length: 5 }, (_, index) => {
      const root = new THREE.Group();
      const material = new THREE.SpriteMaterial({
        transparent: true,
        depthWrite: false,
        opacity: 0.94,
        color: index % 2 === 0 ? 0xfff0fb : 0xe7f5ff
      });
      const image = new THREE.Sprite(material);
      const size = 10 + Math.random() * 8;
      image.scale.set(size, size, 1);
      root.add(image);
      loader.load(
        `img/recursos/snoopy${index + 1}.png`,
        (texture) => {
          texture.encoding = THREE.sRGBEncoding;
          material.map = texture;
          material.needsUpdate = true;
        },
        undefined,
        (error) => console.error(`No se pudo cargar img/recursos/snoopy${index + 1}.png.`, error)
      );
      const trail = [];
      for (let particleIndex = 0; particleIndex < 12; particleIndex += 1) {
        const particle = new THREE.Sprite(new THREE.SpriteMaterial({
          map: textureForTrail,
          color: meteoriteColors[(index + particleIndex) % meteoriteColors.length],
          transparent: true,
          opacity: 0.42 * (1 - particleIndex / 14),
          blending: THREE.AdditiveBlending,
          depthWrite: false
        }));
        const particleSize = 1.2 + (1 - particleIndex / 12) * 2.4;
        particle.scale.set(particleSize, particleSize, 1);
        particle.position.set(
          Math.sin(particleIndex * 0.55 + index) * (0.8 + particleIndex * 0.22),
          Math.cos(particleIndex * 0.4 + index) * (0.55 + particleIndex * 0.13),
          2 + particleIndex * 2.2
        );
        root.add(particle);
        trail.push(particle);
      }
      root.userData.drift = randomUnitVector().multiplyScalar(1.3 + Math.random() * 1.8);
      root.userData.spin = (Math.random() - 0.5) * 0.3;
      root.userData.phase = Math.random() * Math.PI * 2;
      root.position.set(
        camera.position.x + (Math.random() - 0.5) * 340,
        camera.position.y + (Math.random() - 0.5) * 190,
        camera.position.z - 90 - Math.random() * 260
      );
      root.userData.trail = trail;
      scene.add(root);
      return root;
    });
    return resources;
  }

  function createLabel(text, color) {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 192;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("No se pudo crear el texto 3D del sector.");
    context.font = "600 48px Segoe UI, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.shadowColor = color;
    context.shadowBlur = 22;
    context.fillStyle = "#fff4fb";
    context.fillText(text, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(24, 4.5, 1);
    return sprite;
  }

  function createRoundedAlpha() {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("No se pudo crear la máscara de las fotografías.");
    context.fillStyle = "#fff";
    context.beginPath();
    context.roundRect(8, 8, 496, 496, 32);
    context.fill();
    return new THREE.CanvasTexture(canvas);
  }

  function monthKey(date) {
    if (!date) return "undated";
    const dateParts = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/.exec(date);
    if (!dateParts) return "undated";
    const year = Number(dateParts[1]);
    const month = Number(dateParts[2]);
    const day = Number(dateParts[3]);
    const parsedDate = new Date(Date.UTC(year, month - 1, day));
    if (
      Number.isNaN(parsedDate.getTime()) ||
      parsedDate.getUTCFullYear() !== year ||
      parsedDate.getUTCMonth() !== month - 1 ||
      parsedDate.getUTCDate() !== day
    ) return "undated";
    return `${year}-${String(month).padStart(2, "0")}`;
  }

  function monthLabel(key) {
    if (key === "undated") return "Sector por definir";
    const [year, month] = key.split("-");
    const date = new Date(Number(year), Number(month) - 1, 1);
    return new Intl.DateTimeFormat("es", { month: "long", year: "numeric" }).format(date);
  }

  function groupMemories(items) {
    const groups = new Map();
    items.forEach((memory) => {
      const key = monthKey(memory.capturedAt);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(memory);
    });
    return Array.from(groups.entries())
      .sort(([left], [right]) => left === "undated" ? 1 : right === "undated" ? -1 : left.localeCompare(right))
      .map(([key, groupMemories]) => ({ key, label: monthLabel(key), memories: groupMemories }));
  }

  function createOrbit(radius, color) {
    const geometry = new THREE.TorusGeometry(radius, 0.055, 6, 160);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.22
    });
    const orbit = new THREE.Mesh(geometry, material);
    orbit.rotation.x = Math.PI / 2;
    return orbit;
  }

  const photoMeshes = [];
  const planetReflectionRecords = [];
  const photoGeometry = new THREE.PlaneGeometry(6.6, 6.6);
  const roundedAlpha = createRoundedAlpha();
  let loadedPhotos = 0;
  let failedPhotos = 0;
  let groups = groupMemories(memories);
  const photoLoader = new THREE.TextureLoader();
  const sectorTitle = document.getElementById("sector-title");
  const sectorCount = document.getElementById("sector-count");

  function getOrbitMetrics(count) {
    const ringCapacity = 8;
    const ringCount = Math.max(1, Math.ceil(count / ringCapacity));
    return {
      ringCapacity,
      ringCount,
      photoScale: Math.max(0.28, Math.min(0.72, Math.sqrt(3 / count))),
      ringSpacing: 9,
      baseRadius: 22
    };
  }

  function updateOrbitBands(group) {
    const metrics = getOrbitMetrics(group.memories.length);
    group.orbitMeshes.forEach((orbit) => {
      group.root.remove(orbit);
      orbit.geometry.dispose();
      orbit.material.dispose();
    });
    group.orbitMeshes = [];
    for (let ringIndex = 0; ringIndex < metrics.ringCount; ringIndex += 1) {
      const radius = metrics.baseRadius + ringIndex * metrics.ringSpacing;
      const orbit = createOrbit(radius, ringIndex % 2 === 0 ? group.color : 0x9c83c5);
      group.root.add(orbit);
      group.orbitMeshes.push(orbit);
    }

    group.photoRecords.forEach((record, memoryIndex) => {
      record.ringIndex = Math.floor(memoryIndex / metrics.ringCapacity);
      record.ringPosition = memoryIndex % metrics.ringCapacity;
      record.ringSize = Math.min(metrics.ringCapacity, group.memories.length - record.ringIndex * metrics.ringCapacity);
      record.radius = metrics.baseRadius + record.ringIndex * metrics.ringSpacing;
      record.photoGroup.scale.setScalar(metrics.photoScale);
      record.phase = 0;
    });
    group.halfWidth = metrics.baseRadius + (metrics.ringCount - 1) * metrics.ringSpacing + 12;
  }

  function createMemoryPhoto(group, memory, memoryIndex) {
    const photoGroup = new THREE.Group();
    group.root.add(photoGroup);

    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(8.4, 8.4),
      new THREE.MeshBasicMaterial({
        color: group.color,
        transparent: true,
        opacity: 0.13,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    glow.position.z = -0.16;
    photoGroup.add(glow);

    const frame = new THREE.Mesh(
      photoGeometry,
      new THREE.MeshBasicMaterial({ color: 0xfff4fb, side: THREE.DoubleSide })
    );
    frame.scale.set(1.07, 1.07, 1);
    frame.position.z = -0.08;
    photoGroup.add(frame);

    const material = new THREE.MeshBasicMaterial({
      color: 0x33263b,
      side: THREE.DoubleSide,
      transparent: true,
      alphaMap: roundedAlpha
    });
    const photo = new THREE.Mesh(photoGeometry, material);
    photo.userData.memory = memory;
    photoGroup.add(photo);
    photoMeshes.push(photo);

    const caption = createLabel(memory.title, `#${new THREE.Color(group.color).getHexString()}`);
    caption.scale.set(12, 2.2, 1);
    caption.position.y = -4.7;
    photoGroup.add(caption);

    group.photoRecords.push({
      memory,
      photoGroup,
      phase: 0,
      radius: 0,
      ringIndex: 0,
      ringPosition: memoryIndex,
      ringSize: group.memories.length,
      orbitSpeed: 0.035 + (memoryIndex % 5) * 0.003
    });

    if (memory.mediaType === "video") {
      const video = document.createElement("video");
      video.src = memory.image;
      video.crossOrigin = "anonymous";
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = "metadata";
      const onVideoReady = () => {
        const texture = new THREE.VideoTexture(video);
        texture.encoding = THREE.sRGBEncoding;
        texture.minFilter = THREE.LinearFilter;
        material.map = texture;
        material.color.set(0xffffff);
        material.needsUpdate = true;
        video.play().catch((error) => {
          console.warn(`La vista previa de ${memory.title} requiere interacción para reproducirse.`, error);
        });
        loadedPhotos += 1;
        updateSectorStatus();
      };
      video.addEventListener("loadeddata", onVideoReady, { once: true });
      video.addEventListener("error", () => {
        failedPhotos += 1;
        console.error(`No se pudo cargar el video ${memory.image}.`);
        updateSectorStatus();
      }, { once: true });
      video.load();
    } else {
      photoLoader.load(
        memory.image,
        (texture) => {
          texture.encoding = THREE.sRGBEncoding;
          texture.wrapS = THREE.ClampToEdgeWrapping;
          texture.wrapT = THREE.ClampToEdgeWrapping;
          const image = texture.image;
          const aspect = image.width / image.height;
          if (aspect > 1) {
            texture.repeat.set(1 / aspect, 1);
            texture.offset.set((1 - 1 / aspect) / 2, 0);
          } else {
            texture.repeat.set(1, aspect);
            texture.offset.set(0, (1 - aspect) / 2);
          }
          material.map = texture;
          material.color.set(0xffffff);
          material.needsUpdate = true;
          loadedPhotos += 1;
          updateSectorStatus();
        },
        undefined,
        (error) => {
          failedPhotos += 1;
          console.error(`No se pudo cargar ${memory.image}.`, error);
          updateSectorStatus();
        }
      );
    }
  }

  function createPlanet(group, groupIndex) {
    group.root = new THREE.Group();
    group.root.position.set(0, 0, 0);
    group.color = colors[groupIndex % colors.length];
    group.photoRecords = [];
    group.orbitMeshes = [];
    group.spinSpeed = 0.012 + groupIndex * 0.001;
    const planetGeometry = new THREE.SphereGeometry(8, 40, 32);
    const planetMaterial = new THREE.MeshStandardMaterial({
      color: 0x493253,
      roughness: 0.24,
      metalness: 0.62,
      envMapIntensity: 1.45,
      flatShading: true,
      emissive: group.color,
      emissiveIntensity: 0.06
    });
    group.planet = new THREE.Mesh(planetGeometry, planetMaterial);
    group.root.add(group.planet);
    const reflectionTarget = new THREE.WebGLCubeRenderTarget(128, {
      format: THREE.RGBFormat,
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter
    });
    const reflectionCamera = new THREE.CubeCamera(0.1, 1800, reflectionTarget);
    scene.add(reflectionCamera);
    group.planet.material.envMap = reflectionTarget.texture;
    group.planet.material.needsUpdate = true;
    planetReflectionRecords.push({ planet: group.planet, camera: reflectionCamera, target: reflectionTarget });
    group.root.add(new THREE.Mesh(
      new THREE.SphereGeometry(8.7, 32, 24),
      new THREE.MeshBasicMaterial({
        color: group.color,
        transparent: true,
        opacity: 0.12,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending
      })
    ));
    group.labelSprite = createLabel(group.label, `#${new THREE.Color(group.color).getHexString()}`);
    group.labelSprite.position.set(0, 13, 0);
    group.root.add(group.labelSprite);
    scene.add(group.root);
    group.memories.forEach((memory, index) => createMemoryPhoto(group, memory, index));
    updateOrbitBands(group);
  }

  function repositionPlanets() {
    const gap = 26;
    const anchorIndex = Math.max(0, groups.findIndex((group) => group.key === "undated"));
    const anchor = groups[anchorIndex];
    if (!anchor) return;
    anchor.worldX = 0;
    for (let index = anchorIndex - 1; index >= 0; index -= 1) {
      const current = groups[index];
      const next = groups[index + 1];
      current.worldX = next.worldX - next.halfWidth - gap - current.halfWidth;
    }
    for (let index = anchorIndex + 1; index < groups.length; index += 1) {
      const current = groups[index];
      const previous = groups[index - 1];
      current.worldX = previous.worldX + previous.halfWidth + gap + current.halfWidth;
    }
    groups.forEach((group) => group.root.position.x = group.worldX);
  }

  function addMemory(memory) {
    if (!memory || typeof memory !== "object") throw new TypeError("El recuerdo debe ser un objeto.");
    if (typeof memory.image !== "string" || !memory.image.trim()) throw new TypeError("El recuerdo necesita una imagen.");
    if (memory.mediaType !== "image" && memory.mediaType !== "video") throw new TypeError("El formato multimedia del recuerdo no es válido.");
    if (typeof memory.title !== "string" || !memory.title.trim()) throw new TypeError("El recuerdo necesita un título.");
    if (typeof memory.description !== "string") throw new TypeError("La descripción del recuerdo no es válida.");
    if (typeof memory.capturedAt !== "string" || monthKey(memory.capturedAt) === "undated") {
      throw new TypeError("La fecha debe tener un formato válido (AAAA-MM-DD).");
    }

    const savedMemory = { ...memory, id: memory.id || `memory-${Date.now()}-${memories.length}` };
    const key = monthKey(savedMemory.capturedAt);
    let group = groups.find((candidate) => candidate.key === key);
    if (!group) {
      group = { key, label: monthLabel(key), memories: [] };
      groups.push(group);
      groups.sort((left, right) => left.key === "undated" ? 1 : right.key === "undated" ? -1 : left.key.localeCompare(right.key));
      createPlanet(group, groups.indexOf(group));
    }
    group.memories.push(savedMemory);
    memories.push(savedMemory);
    if (group.root && group.photoRecords) {
      createMemoryPhoto(group, savedMemory, group.memories.length - 1);
      updateOrbitBands(group);
    }
    repositionPlanets();
    updateSectorStatus();
    return savedMemory.id;
  }

  function updateSectorStatus() {
    const group = groups.reduce((nearest, candidate) => {
      if (!nearest) return candidate;
      const nearestDistance = Math.hypot(camera.position.x - nearest.worldX, camera.position.y, camera.position.z);
      const candidateDistance = Math.hypot(camera.position.x - candidate.worldX, camera.position.y, camera.position.z);
      return candidateDistance < nearestDistance ? candidate : nearest;
    }, null);
    if (!group) {
      sectorTitle.textContent = "Universo vacío";
      sectorCount.textContent = "Todavía no hay recuerdos publicados.";
      return;
    }
    sectorTitle.textContent = group.label;
    const status = `${group.memories.length} recuerdos en este planeta · ${loadedPhotos} de ${memories.length} medios listos`;
    sectorCount.textContent = failedPhotos > 0 ? `${status} · ${failedPhotos} no cargaron` : status;
  }

  groups.forEach(createPlanet);
  repositionPlanets();
  updateSectorStatus();
  const stars = createStars();
  const heartField = createHeartField();
  const meteorites = createMeteoriteField();
  const cosmicResources = createCosmicResources(heartField.texture);
  const laserProjectiles = [];
  const burstParticles = [];
  const meteoriteCountLabel = document.getElementById("meteorite-count");
  let destroyedMeteorites = 0;
  const projectileDirection = new THREE.Vector3();
  const projectileNextPosition = new THREE.Vector3();
  const collisionSegment = new THREE.Vector3();
  const collisionOffset = new THREE.Vector3();
  const collisionClosestPoint = new THREE.Vector3();

  const state = {
    yaw: 0,
    pitch: 0,
    thirdPerson: false,
    jetpack: false,
    pointerLocked: false,
    nativePointerLocked: false,
    interfaceVisible: true,
    dragging: false,
    movedPointer: false,
    lastX: 0,
    lastY: 0,
    pendingMemory: null,
    keys: new Set()
  };
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const clock = new THREE.Clock();
  let reflectionCooldown = 0;
  let nextReflectionIndex = 0;
  const modal = document.getElementById("cartaModal");
  const music = document.getElementById("bg-music");
  const startScreen = document.getElementById("start-screen");
  const cameraModeLabel = document.getElementById("camera-mode");
  const desiredCameraPosition = new THREE.Vector3();
  const cameraLookTarget = new THREE.Vector3();
  const photoWorldQuaternion = new THREE.Quaternion();
  const photoParentInverse = new THREE.Quaternion();
  const photoLocalQuaternion = new THREE.Quaternion();
  const desiredCameraQuaternion = new THREE.Quaternion();
  const desiredCameraEuler = new THREE.Euler(0, 0, 0, "YXZ");
  const cameraAim = new THREE.PerspectiveCamera();
  const flightForward = new THREE.Vector3();
  const flightRight = new THREE.Vector3();
  const movementVector = new THREE.Vector3();
  const targetFlightEuler = new THREE.Euler(0, 0, 0, "YXZ");
  const targetFlightQuaternion = new THREE.Quaternion();
  let pointerLockRequestGeneration = 0;
  ship.position.copy(camera.position);
  ship.rotation.order = "YXZ";
  astronaut.rotation.order = "YXZ";

  function updateFlightVectors() {
    const pitchCosine = Math.cos(state.pitch);
    flightForward.set(
      -Math.sin(state.yaw) * pitchCosine,
      Math.sin(state.pitch),
      -Math.cos(state.yaw) * pitchCosine
    );
    flightRight.set(Math.cos(state.yaw), 0, -Math.sin(state.yaw));
  }

  const remotePlayers = new Map();
  const multiplayerStatusLabel = document.getElementById("multiplayer-status");
  let multiplayerConnection = null;

  function setMultiplayerStatus(status) {
    const playerCount = Math.max(0, status.playerCount || 0);
    multiplayerStatusLabel.textContent = status.state === "connected"
      ? `${status.message} · ${playerCount === 0 ? "esperando a otra persona" : `${playerCount + 1} jugadores`}`
      : `Multijugador: ${status.message}`;
    multiplayerStatusLabel.dataset.state = status.state;
  }

  function copyMaterials(object) {
    object.traverse((child) => {
      if (!child.isMesh) return;
      child.material = Array.isArray(child.material)
        ? child.material.map((material) => material.clone())
        : child.material.clone();
    });
  }

  function applyProfileColors(object, colorsToApply) {
    object.traverse((child) => {
      if (!child.isMesh || !child.userData.profileColor) return;
      const color = colorsToApply[child.userData.profileColor === "ship" ? "shipColor" : "characterColor"];
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => material.color.set(color));
    });
  }

  function playerColorHex(value, fallback) {
    return Number.isInteger(value) && value >= 0 && value <= 0xffffff
      ? `#${value.toString(16).padStart(6, "0")}`
      : fallback;
  }

  const previewHost = document.getElementById("profile-preview-stage");
  const previewRenderer = new THREE.WebGLRenderer({
    canvas: document.getElementById("profile-preview-canvas"),
    alpha: true,
    antialias: true
  });
  previewRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  previewRenderer.setClearColor(0x000000, 0);
  const previewScene = new THREE.Scene();
  previewScene.add(new THREE.AmbientLight(0xdac8ff, 1.8));
  const previewLight = new THREE.PointLight(0xffc7ea, 2.4, 80);
  previewLight.position.set(0, 8, 8);
  previewScene.add(previewLight);
  const previewShip = ship.clone(true);
  const previewAstronaut = astronaut.clone(true);
  copyMaterials(previewShip);
  copyMaterials(previewAstronaut);
  previewShip.visible = true;
  previewAstronaut.visible = true;
  previewShip.position.set(-5, -0.5, 0);
  previewAstronaut.position.set(5, -1.6, 0);
  previewShip.scale.setScalar(1.12);
  previewAstronaut.scale.setScalar(0.9);
  previewScene.add(previewShip, previewAstronaut);
  applyProfileColors(previewShip, profile);
  applyProfileColors(previewAstronaut, profile);

  const previewShipCamera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
  previewShipCamera.position.set(-5, 2.8, 10);
  previewShipCamera.lookAt(-5, 0, 0);
  const previewAstronautCamera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
  previewAstronautCamera.position.set(5, 2, -9);
  previewAstronautCamera.lookAt(5, 0.6, 0);
  let previewWidth = 0;
  let previewHeight = 0;

  const nameInput = document.getElementById("profile-name");
  const shipColorInput = document.getElementById("ship-color");
  const characterColorInput = document.getElementById("character-color");
  const profileFeedback = document.getElementById("profile-feedback");
  nameInput.value = profile.name;
  shipColorInput.value = profile.shipColor;
  characterColorInput.value = profile.characterColor;

  function saveProfile() {
    profile.name = normalizeName(nameInput.value);
    profile.shipColor = shipColorInput.value;
    profile.characterColor = characterColorInput.value;
    nameInput.value = profile.name;
    try {
      localStorage.setItem(profileStorageKey, JSON.stringify(profile));
      profileFeedback.textContent = `Perfil guardado para ${profile.name}.`;
      profileFeedback.dataset.state = "saved";
    } catch (error) {
      profileFeedback.textContent = "No se pudo guardar el perfil en este navegador; se aplicará durante esta sesión.";
      profileFeedback.dataset.state = "error";
      console.error("No se pudo guardar el perfil del explorador.", error);
    }
    applyProfileColors(ship, profile);
    applyProfileColors(astronaut, profile);
    applyProfileColors(previewShip, profile);
    applyProfileColors(previewAstronaut, profile);
  }

  nameInput.addEventListener("input", saveProfile);
  shipColorInput.addEventListener("input", saveProfile);
  characterColorInput.addEventListener("input", saveProfile);

  function renderProfilePreview() {
    const width = previewHost.clientWidth;
    const height = previewHost.clientHeight;
    if (!width || !height) return;
    const halfWidth = width / 2;
    if (width !== previewWidth || height !== previewHeight) {
      previewWidth = width;
      previewHeight = height;
      previewRenderer.setSize(width, height, false);
      previewShipCamera.aspect = (width / 2) / height;
      previewShipCamera.updateProjectionMatrix();
      previewAstronautCamera.aspect = (width / 2) / height;
      previewAstronautCamera.updateProjectionMatrix();
    }
    previewRenderer.setScissorTest(true);
    previewRenderer.setViewport(0, 0, halfWidth, height);
    previewRenderer.setScissor(0, 0, halfWidth, height);
    previewRenderer.render(previewScene, previewShipCamera);
    previewRenderer.setViewport(halfWidth, 0, halfWidth, height);
    previewRenderer.setScissor(halfWidth, 0, halfWidth, height);
    previewRenderer.render(previewScene, previewAstronautCamera);
    previewRenderer.setScissorTest(false);
  }

  function disposeProfilePreview() {
    previewRenderer.dispose();
    [previewShip, previewAstronaut].forEach((object) => object.traverse((child) => {
      if (!child.isMesh) return;
      if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose());
      else child.material.dispose();
    }));
    previewRenderer.domElement.remove();
  }

  function createRemotePlayer(uid, playerState) {
    const remoteShip = ship.clone(true);
    const remoteAstronaut = astronaut.clone(true);
    copyMaterials(remoteShip);
    copyMaterials(remoteAstronaut);
    remoteShip.visible = true;
    remoteAstronaut.visible = Boolean(playerState.jetpack);
    remoteShip.traverse((child) => {
      if (child.isMesh && child.geometry.type === "ConeGeometry" && child.material.transparent) {
        child.visible = Boolean(playerState.boosting);
      }
    });
    const label = createLabel(normalizeName(playerState.name || `Explorador ${uid.slice(0, 5)}`), "#a9eaff");
    label.scale.set(12, 2.2, 1);
    scene.add(remoteShip, remoteAstronaut, label);
    const remote = {
      ship: remoteShip,
      astronaut: remoteAstronaut,
      label,
      targetPosition: new THREE.Vector3(),
      targetRotation: new THREE.Quaternion(),
      targetShipPosition: new THREE.Vector3(),
      targetShipRotation: new THREE.Quaternion(),
      jetpack: Boolean(playerState.jetpack),
      boosting: Boolean(playerState.boosting),
      name: normalizeName(playerState.name || `Explorador ${uid.slice(0, 5)}`),
      shipColor: playerColorHex(playerState.shipColor, defaultProfile.shipColor),
      characterColor: playerColorHex(playerState.characterColor, defaultProfile.characterColor),
      phase: Math.random() * Math.PI * 2
    };
    remotePlayers.set(uid, remote);
    updateRemotePlayer(uid, playerState);
    return remote;
  }

  function readVector(value) {
    if (!value || !["x", "y", "z"].every((key) => Number.isFinite(value[key]))) return null;
    return new THREE.Vector3(value.x, value.y, value.z);
  }

  function readRotation(value) {
    if (!value || !["x", "y", "z"].every((key) => Number.isFinite(value[key]))) return null;
    return new THREE.Quaternion().setFromEuler(new THREE.Euler(value.x, value.y, value.z, "YXZ"));
  }

  function updateRemotePlayer(uid, playerState) {
    const position = readVector(playerState.position);
    const rotation = readRotation(playerState.rotation);
    const shipPosition = readVector(playerState.shipPosition);
    const shipRotation = readRotation(playerState.shipRotation);
    if (!position || !rotation || !shipPosition || !shipRotation) {
      removeRemotePlayer(uid);
      return;
    }

    const remote = remotePlayers.get(uid) || createRemotePlayer(uid, playerState);
    remote.targetPosition.copy(position);
    remote.targetRotation.copy(rotation);
    remote.targetShipPosition.copy(shipPosition);
    remote.targetShipRotation.copy(shipRotation);
    remote.jetpack = playerState.jetpack === true;
    remote.boosting = playerState.boosting === true;
    const nextName = normalizeName(playerState.name || `Explorador ${uid.slice(0, 5)}`);
    if (remote.name !== nextName) {
      remote.name = nextName;
      scene.remove(remote.label);
      remote.label.material.map.dispose();
      remote.label.material.dispose();
      remote.label = createLabel(nextName, "#a9eaff");
      remote.label.scale.set(12, 2.2, 1);
      scene.add(remote.label);
    }
    remote.shipColor = playerColorHex(playerState.shipColor, defaultProfile.shipColor);
    remote.characterColor = playerColorHex(playerState.characterColor, defaultProfile.characterColor);
    applyProfileColors(remote.ship, remote);
    applyProfileColors(remote.astronaut, remote);
    remote.astronaut.visible = remote.jetpack;
    remote.ship.visible = true;
    remote.ship.traverse((child) => {
      if (child.isMesh && child.geometry.type === "ConeGeometry" && child.material.transparent) {
        child.visible = remote.boosting;
      }
    });
  }

  function removeRemotePlayer(uid) {
    const remote = remotePlayers.get(uid);
    if (!remote) return;
    scene.remove(remote.ship, remote.astronaut, remote.label);
    [remote.ship, remote.astronaut].forEach((object) => object.traverse((child) => {
      if (!child.isMesh) return;
      if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose());
      else child.material.dispose();
    }));
    remote.label.material.map.dispose();
    remote.label.material.dispose();
    remotePlayers.delete(uid);
  }

  if (window.memoryMultiplayer) {
    window.memoryMultiplayer.connect({
      profile,
      onPlayerUpdated: updateRemotePlayer,
      onPlayerRemoved: removeRemotePlayer,
      onStatus: setMultiplayerStatus
    }).then((connection) => {
      multiplayerConnection = connection;
    }).catch((error) => {
      setMultiplayerStatus({ state: "error", message: error.message, playerCount: 0 });
      console.error("No se pudo iniciar el multijugador.", error);
    });
  } else {
    setMultiplayerStatus({
      state: "error",
      message: "Falta cargar firebase-multiplayer.js",
      playerCount: 0
    });
  }

  function openMemory(memory) {
    document.getElementById("modalTitulo").textContent = memory.title;
    document.getElementById("modalTexto").textContent = memory.description;
    const dateLabel = document.getElementById("modalFecha");
    if (memory.capturedAt) {
      dateLabel.textContent = new Intl.DateTimeFormat("es", {
        dateStyle: "long"
      }).format(new Date(`${memory.capturedAt}T00:00:00`));
      dateLabel.hidden = false;
    } else {
      dateLabel.hidden = true;
      dateLabel.textContent = "";
    }
    const image = document.getElementById("modalFoto");
    const video = document.getElementById("modalVideo");
    if (memory.mediaType === "video") {
      image.hidden = true;
      image.removeAttribute("src");
      video.src = memory.image;
      video.hidden = false;
      video.play().catch((error) => {
        console.warn("El video requiere iniciar la reproducción desde el control del modal.", error);
      });
    } else {
      video.pause();
      video.hidden = true;
      video.removeAttribute("src");
      image.src = memory.image;
      image.hidden = false;
    }
    modal.classList.add("active");
  }

  function closeMemory() {
    modal.classList.remove("active");
    const video = document.getElementById("modalVideo");
    video.pause();
    video.removeAttribute("src");
    video.load();
  }

  function toggleCameraMode() {
    state.thirdPerson = !state.thirdPerson;
    ship.visible = state.jetpack || state.thirdPerson;
    astronaut.visible = state.jetpack && state.thirdPerson;
    cameraModeLabel.textContent = `${state.jetpack ? "Jetpack" : "Nave"} · ${state.thirdPerson ? "tercera" : "primera"} persona`;
  }

  function toggleJetpack() {
    if (!state.jetpack) {
      updateFlightVectors();
      astronaut.position.copy(ship.position).addScaledVector(flightRight, 5);
      astronaut.rotation.set(state.pitch, state.yaw, 0, "YXZ");
      astronaut.visible = true;
      ship.visible = true;
      state.jetpack = true;
      state.thirdPerson = true;
      cameraModeLabel.textContent = "Jetpack · tercera persona";
    } else {
      ship.position.copy(astronaut.position);
      ship.rotation.copy(astronaut.rotation);
      astronaut.visible = false;
      state.jetpack = false;
      cameraModeLabel.textContent = `Nave · ${state.thirdPerson ? "tercera" : "primera"} persona`;
    }
    state.keys.clear();
  }

  function requestGamePointerLock() {
    const requestGeneration = ++pointerLockRequestGeneration;
    if (!renderer.domElement.requestPointerLock) {
      console.warn("Este navegador no permite capturar el mouse; puedes dirigir con arrastre.");
      enablePointerLockFallback(requestGeneration);
      return;
    }
    try {
      const request = renderer.domElement.requestPointerLock();
      if (request && typeof request.catch === "function") {
        request.catch((error) => {
          console.warn("El navegador rechazó la captura nativa del mouse; se usará el modo inmersivo alternativo.", error);
          enablePointerLockFallback(requestGeneration);
        });
      }
    } catch (error) {
      console.warn("No se pudo capturar el mouse de forma nativa; se usará el modo inmersivo alternativo.", error);
      enablePointerLockFallback(requestGeneration);
    }
  }

  function enablePointerLockFallback(requestGeneration) {
    if (requestGeneration !== pointerLockRequestGeneration) return;
    state.pointerLocked = true;
    state.nativePointerLocked = false;
    state.dragging = false;
    document.body.classList.add("is-pointer-locked");
  }

  function releaseGamePointerLock() {
    pointerLockRequestGeneration += 1;
    if (document.pointerLockElement) document.exitPointerLock();
    state.pointerLocked = false;
    state.nativePointerLocked = false;
    state.dragging = false;
    document.body.classList.remove("is-pointer-locked");
  }

  function getMemoryAtPointer(clientX, clientY) {
    pointer.x = (clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const [hit] = raycaster.intersectObjects(photoMeshes, false);
    return hit && hit.object.userData.memory ? hit.object.userData.memory : null;
  }

  function shootLaser(direction = null) {
    if (direction) projectileDirection.copy(direction).normalize();
    else camera.getWorldDirection(projectileDirection);
    const material = new THREE.MeshBasicMaterial({
      color: 0xffc8f0,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const beam = new THREE.Mesh(laserGeometry, material);
    beam.quaternion.setFromUnitVectors(laserUp, projectileDirection);
    beam.position.copy(camera.position).addScaledVector(projectileDirection, 2.4);
    scene.add(beam);
    laserProjectiles.push({
      mesh: beam,
      direction: projectileDirection.clone(),
      previousPosition: beam.position.clone(),
      life: 2.1
    });
  }

  function createMeteoriteBurst(position) {
    for (let index = 0; index < 9; index += 1) {
      const material = new THREE.SpriteMaterial({
        map: heartField.texture,
        color: meteoriteColors[index % meteoriteColors.length],
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const sprite = new THREE.Sprite(material);
      const size = 0.45 + Math.random() * 0.7;
      sprite.scale.set(size, size, 1);
      sprite.position.copy(position);
      scene.add(sprite);
      burstParticles.push({
        sprite,
        velocity: randomUnitVector().multiplyScalar(3 + Math.random() * 8),
        life: 0.8 + Math.random() * 0.45,
        maxLife: 1.25
      });
    }
  }

  function updateMeteoriteField(delta) {
    meteorites.forEach((meteorite) => {
      meteorite.position.addScaledVector(meteorite.userData.drift, delta);
      meteorite.rotation.x += meteorite.userData.spin.x * delta;
      meteorite.rotation.y += meteorite.userData.spin.y * delta;
      meteorite.rotation.z += meteorite.userData.spin.z * delta;
      if (meteorite.position.distanceTo(camera.position) > 330) placeMeteoriteAhead(meteorite);
    });

    for (let projectileIndex = laserProjectiles.length - 1; projectileIndex >= 0; projectileIndex -= 1) {
      const projectile = laserProjectiles[projectileIndex];
      projectile.previousPosition.copy(projectile.mesh.position);
      projectile.mesh.position.addScaledVector(projectile.direction, 210 * delta);
      projectile.life -= delta;
      projectile.mesh.material.opacity = Math.min(1, projectile.life * 1.5);
      projectileNextPosition.copy(projectile.mesh.position);
      collisionSegment.subVectors(projectileNextPosition, projectile.previousPosition);
      const segmentLengthSquared = collisionSegment.lengthSq();
      let hitMeteorite = null;
      for (const meteorite of meteorites) {
        collisionOffset.subVectors(meteorite.position, projectile.previousPosition);
        const segmentPosition = segmentLengthSquared
          ? THREE.MathUtils.clamp(collisionOffset.dot(collisionSegment) / segmentLengthSquared, 0, 1)
          : 0;
        collisionClosestPoint.copy(projectile.previousPosition).addScaledVector(collisionSegment, segmentPosition);
        const closestDistance = meteorite.position.distanceTo(collisionClosestPoint);
        if (closestDistance < meteorite.userData.radius + 0.85) {
          hitMeteorite = meteorite;
          break;
        }
      }
      if (hitMeteorite) {
        createMeteoriteBurst(hitMeteorite.position);
        placeMeteoriteAhead(hitMeteorite);
        hitMeteorite.userData.drift.copy(randomUnitVector()).multiplyScalar(0.45 + Math.random() * 1.4);
        destroyedMeteorites += 1;
        meteoriteCountLabel.textContent = `Meteoritos destruidos: ${destroyedMeteorites}`;
        projectile.life = 0;
      }
      if (projectile.life <= 0 || projectile.mesh.position.distanceTo(camera.position) > 420) {
        scene.remove(projectile.mesh);
        projectile.mesh.material.dispose();
        laserProjectiles.splice(projectileIndex, 1);
      }
    }

    for (let index = burstParticles.length - 1; index >= 0; index -= 1) {
      const particle = burstParticles[index];
      particle.life -= delta;
      particle.sprite.position.addScaledVector(particle.velocity, delta);
      particle.velocity.multiplyScalar(Math.max(0, 1 - delta * 1.8));
      particle.sprite.material.opacity = Math.max(0, particle.life / particle.maxLife);
      particle.sprite.rotation += delta * 2;
      if (particle.life <= 0) {
        scene.remove(particle.sprite);
        particle.sprite.material.dispose();
        burstParticles.splice(index, 1);
      }
    }
  }

  function updateCosmicResources(delta) {
    cosmicResources.forEach((resource) => {
      resource.position.addScaledVector(resource.userData.drift, delta);
      resource.rotation.y += resource.userData.spin * delta;
      resource.userData.phase += delta;
      resource.userData.trail.forEach((particle, index) => {
        particle.material.opacity = (0.25 + (Math.sin(resource.userData.phase * 2 - index * 0.3) + 1) * 0.12) *
          (1 - index / 14);
      });
      if (resource.position.distanceTo(camera.position) > 430) {
        resource.position.set(
          camera.position.x + (Math.random() - 0.5) * 340,
          camera.position.y + (Math.random() - 0.5) * 190,
          camera.position.z - 90 - Math.random() * 260
        );
      }
    });
  }

  function toggleInterface() {
    state.interfaceVisible = !state.interfaceVisible;
    document.body.classList.toggle("interface-hidden", !state.interfaceVisible);
  }

  document.getElementById("closeBtn").addEventListener("click", closeMemory);
  document.getElementById("mobile-camera-toggle").addEventListener("click", toggleCameraMode);
  document.getElementById("mobile-jetpack-toggle").addEventListener("click", toggleJetpack);
  document.getElementById("mobile-fire-button").addEventListener("click", () => shootLaser());
  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeMemory();
  });
  document.addEventListener("pointerlockchange", () => {
    state.nativePointerLocked = document.pointerLockElement === renderer.domElement;
    state.pointerLocked = state.nativePointerLocked;
    document.body.classList.toggle("is-pointer-locked", state.pointerLocked);
    state.dragging = false;
  });
  window.addEventListener("keydown", (event) => {
    if (event.code === "Escape") {
      closeMemory();
      releaseGamePointerLock();
      return;
    }
    if (!startScreen.classList.contains("hidden")) return;
    if (event.code === "KeyP" && !event.repeat) {
      toggleInterface();
      event.preventDefault();
      return;
    }
    if (modal.classList.contains("active")) return;
    if (event.code === "KeyR" && !event.repeat) {
      toggleCameraMode();
      event.preventDefault();
      return;
    }
    if (event.code === "KeyE" && !event.repeat) {
      toggleJetpack();
      event.preventDefault();
      return;
    }
    if (["KeyW", "KeyA", "KeyS", "KeyD", "Space", "KeyC", "ShiftLeft", "ShiftRight"].includes(event.code)) {
      event.preventDefault();
      state.keys.add(event.code);
    }
  });
  window.addEventListener("keyup", (event) => state.keys.delete(event.code));
  window.addEventListener("blur", () => {
    state.keys.clear();
    if (!state.nativePointerLocked) releaseGamePointerLock();
  });

  renderer.domElement.addEventListener("pointerdown", (event) => {
    if (!startScreen.classList.contains("hidden") || modal.classList.contains("active")) return;
    if (event.pointerType === "mouse" && state.pointerLocked) {
      if (event.button === 0) shootLaser();
      event.preventDefault();
      return;
    }
    if (event.pointerType === "mouse") {
      state.pendingMemory = getMemoryAtPointer(event.clientX, event.clientY);
      if (!state.pendingMemory && event.button === 0) {
        pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
        pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        shootLaser(raycaster.ray.direction);
        if (window.matchMedia("(pointer: fine)").matches) requestGamePointerLock();
      }
      if (state.pendingMemory) {
        state.movedPointer = false;
        return;
      }
      state.dragging = !state.pointerLocked;
      state.movedPointer = false;
      state.lastX = event.clientX;
      state.lastY = event.clientY;
      return;
    }
    state.dragging = true;
    state.movedPointer = false;
    state.lastX = event.clientX;
    state.lastY = event.clientY;
    renderer.domElement.setPointerCapture(event.pointerId);
  });

  document.addEventListener("pointermove", (event) => {
    if (state.pointerLocked && event.pointerType === "mouse") {
      state.yaw -= event.movementX * 0.0025;
      state.pitch = THREE.MathUtils.clamp(state.pitch - event.movementY * 0.0025, -1.35, 1.35);
      return;
    }
    if (event.target !== renderer.domElement) return;
    if (!state.dragging) return;
    const deltaX = event.clientX - state.lastX;
    const deltaY = event.clientY - state.lastY;
    if (Math.abs(deltaX) + Math.abs(deltaY) > 2) state.movedPointer = true;
    state.yaw -= deltaX * 0.003;
    state.pitch = THREE.MathUtils.clamp(state.pitch - deltaY * 0.003, -1.35, 1.35);
    state.lastX = event.clientX;
    state.lastY = event.clientY;
  });

  renderer.domElement.addEventListener("pointerup", (event) => {
    if (state.pendingMemory) {
      const memory = state.pendingMemory;
      state.pendingMemory = null;
      openMemory(memory);
      return;
    }
    if (!state.dragging) return;
    state.dragging = false;
    if (!state.movedPointer && !modal.classList.contains("active")) {
      const memory = getMemoryAtPointer(event.clientX, event.clientY);
      if (memory) openMemory(memory);
      else if (event.pointerType !== "mouse") {
        pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
        pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        shootLaser(raycaster.ray.direction);
      }
    }
  });
  renderer.domElement.addEventListener("pointercancel", () => {
    state.dragging = false;
  });

  document.querySelectorAll("#mobile-controls [data-key]").forEach((button) => {
    const key = button.dataset.key;
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      state.keys.add(key);
      button.setPointerCapture(event.pointerId);
    });
    const release = () => state.keys.delete(key);
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("lostpointercapture", release);
  });

  document.getElementById("launch-button").addEventListener("click", () => {
    saveProfile();
    startScreen.classList.add("hidden");
    document.getElementById("ui").classList.add("visible");
    disposeProfilePreview();
    music.volume = 0.55;
    music.loop = true;
    music.play().catch((error) => {
      console.warn("La música no pudo iniciar automáticamente; el viaje seguirá sin audio.", error);
    });
    requestGamePointerLock();
  });

  function animate() {
    requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.05);
    updateMeteoriteField(delta);
    updateCosmicResources(delta);
    if (!startScreen.classList.contains("hidden")) {
      previewShip.rotation.y += delta * 0.25;
      previewAstronaut.rotation.y = Math.sin(clock.elapsedTime * 0.55) * 0.12;
      renderProfilePreview();
    }
    const boosting = state.keys.has("ShiftLeft") || state.keys.has("ShiftRight");
    const speed = boosting ? 34 : state.jetpack ? 13 : 18;
    const forward = Number(state.keys.has("KeyW")) - Number(state.keys.has("KeyS"));
    const sideways = Number(state.keys.has("KeyD")) - Number(state.keys.has("KeyA"));
    const vertical = Number(state.keys.has("Space")) - Number(state.keys.has("KeyC"));
    updateFlightVectors();
    movementVector.copy(flightForward).multiplyScalar(forward)
      .addScaledVector(flightRight, sideways);
    movementVector.y += vertical;
    const movementLength = movementVector.length() || 1;

    const controlledObject = state.jetpack ? astronaut : ship;
    controlledObject.position.addScaledVector(movementVector, speed * delta / movementLength);
    targetFlightEuler.set(state.pitch, state.yaw, -sideways * (state.jetpack ? 0.12 : 0.28), "YXZ");
    targetFlightQuaternion.setFromEuler(targetFlightEuler);
    controlledObject.quaternion.slerp(targetFlightQuaternion, 1 - Math.exp(-7 * delta));
    const chaseDistance = state.jetpack ? 13 : 24;
    const focusHeight = state.jetpack ? 1.65 : 0.7;
    if (state.thirdPerson) {
      desiredCameraPosition.copy(controlledObject.position)
        .addScaledVector(flightForward, -chaseDistance);
      desiredCameraPosition.y += focusHeight + (state.jetpack ? 3.5 : 5);
      cameraLookTarget.copy(controlledObject.position)
        .addScaledVector(flightForward, 2.5);
      cameraLookTarget.y += focusHeight;
      camera.position.lerp(desiredCameraPosition, 1 - Math.exp(-5 * delta));
      cameraAim.position.copy(camera.position);
      cameraAim.lookAt(cameraLookTarget);
      camera.quaternion.slerp(cameraAim.quaternion, 1 - Math.exp(-6 * delta));
    } else {
      desiredCameraPosition.copy(controlledObject.position);
      desiredCameraPosition.y += state.jetpack ? 2.35 : 0.4;
      camera.position.lerp(desiredCameraPosition, 1 - Math.exp(-7 * delta));
      desiredCameraEuler.set(state.pitch, state.yaw, 0, "YXZ");
      desiredCameraQuaternion.setFromEuler(desiredCameraEuler);
      camera.quaternion.slerp(desiredCameraQuaternion, 1 - Math.exp(-7 * delta));
    }
    if (multiplayerConnection) {
      multiplayerConnection.publish({
        position: { x: controlledObject.position.x, y: controlledObject.position.y, z: controlledObject.position.z },
        rotation: { x: controlledObject.rotation.x, y: controlledObject.rotation.y, z: controlledObject.rotation.z },
        shipPosition: { x: ship.position.x, y: ship.position.y, z: ship.position.z },
        shipRotation: { x: ship.rotation.x, y: ship.rotation.y, z: ship.rotation.z },
        jetpack: state.jetpack,
        boosting,
        name: profile.name,
        shipColor: Number.parseInt(profile.shipColor.slice(1), 16),
        characterColor: Number.parseInt(profile.characterColor.slice(1), 16)
      });
    }
    remotePlayers.forEach((remote) => {
      const blend = 1 - Math.exp(-10 * delta);
      remote.ship.position.lerp(remote.targetShipPosition, blend);
      remote.ship.quaternion.slerp(remote.targetShipRotation, blend);
      remote.astronaut.position.lerp(remote.targetPosition, blend);
      remote.astronaut.quaternion.slerp(remote.targetRotation, blend);
      remote.label.position.copy(remote.jetpack ? remote.astronaut.position : remote.ship.position);
      remote.label.position.y += remote.jetpack ? 4.1 : 4.8;
      remote.phase += delta;
      remote.ship.traverse((child) => {
        if (child.isMesh && child.geometry.type === "ConeGeometry" && child.material.transparent) {
          child.material.opacity = remote.boosting && !remote.jetpack
            ? 0.18 + (Math.sin(remote.phase * 18) + 1) * 0.07
            : 0;
        }
      });
    });
    camera.getWorldQuaternion(photoWorldQuaternion);
    groups.forEach((group) => {
      group.root.rotation.y += group.spinSpeed * delta;
      group.planet.rotation.y += delta * 0.06;
      group.root.getWorldQuaternion(photoParentInverse).invert();
      photoLocalQuaternion.multiplyQuaternions(photoParentInverse, photoWorldQuaternion);
      group.photoRecords.forEach((record) => {
        record.phase += record.orbitSpeed * delta;
        const angle = record.phase + (record.ringPosition / record.ringSize) * Math.PI * 2;
        const verticalOffset = record.ringIndex % 2 === 0 ? -5 : 5;
        const verticalAmplitude = 1.8 + record.ringIndex * 0.15;
        record.photoGroup.position.set(
          Math.cos(angle) * record.radius,
          verticalOffset + Math.sin(angle * 2 + record.ringIndex) * verticalAmplitude,
          Math.sin(angle) * record.radius
        );
        record.photoGroup.quaternion.copy(photoLocalQuaternion);
      });
    });
    reflectionCooldown -= delta;
    if (planetReflectionRecords.length && reflectionCooldown <= 0) {
      const reflection = planetReflectionRecords[nextReflectionIndex % planetReflectionRecords.length];
      reflectionCooldown = 1.5;
      nextReflectionIndex += 1;
      reflection.planet.getWorldPosition(reflection.camera.position);
      reflection.planet.visible = false;
      try {
        reflection.camera.update(renderer, scene);
      } finally {
        reflection.planet.visible = true;
      }
    }
    jetpackFlames.forEach((flame, index) => {
      flame.visible = state.jetpack && (forward !== 0 || sideways !== 0 || vertical !== 0);
      flame.scale.y = 0.75 + Math.sin(clock.elapsedTime * 14 + index) * 0.18;
    });
    const boostPulse = 0.82 + (Math.sin(clock.elapsedTime * 18) + 1) * 0.14;
    boostAuras.forEach((aura, index) => {
      aura.visible = boosting && !state.jetpack;
      aura.scale.y = boostPulse * (index === 0 ? 1 : 0.86);
      aura.material.opacity = boosting ? 0.12 + boostPulse * 0.12 : 0;
    });
    shipThrusters.forEach((thruster, index) => {
      const pulse = 0.82 + (Math.sin(clock.elapsedTime * (boosting ? 20 : 6) + index) + 1) * 0.1;
      thruster.scale.setScalar(pulse * (boosting ? 1.22 : 1));
    });
    shipCabin.position.y = 0.43 + Math.sin(clock.elapsedTime * 2.4) * 0.025;
    astronautBody.scale.y = 1.05 + Math.sin(clock.elapsedTime * 2.1) * 0.025;
    astronautHelmet.rotation.y = Math.sin(clock.elapsedTime * 0.8) * 0.055;
    astronautHelmet.position.y = 2.45 + Math.sin(clock.elapsedTime * 2.1 + 0.4) * 0.018;
    limbs.forEach((limb, index) => {
      limb.rotation.z = Math.sin(clock.elapsedTime * 2.1 + index * 0.7) * (index < 2 ? 0.025 : 0.018);
    });
    updateSectorStatus();
    heartField.particles.forEach((particle) => {
      const { sprite } = particle;
      sprite.position.y += particle.speed * delta;
      sprite.position.x += particle.drift * delta;
      particle.phase += delta * 0.7;
      particle.sprite.material.opacity = 0.38 + (Math.sin(particle.phase) + 1) * 0.18;
      if (sprite.position.y > camera.position.y + 38) sprite.position.y = camera.position.y - 38;
      if (sprite.position.y < camera.position.y - 48) sprite.position.y = camera.position.y + 38;
      if (sprite.position.x > camera.position.x + 65) sprite.position.x = camera.position.x - 65;
      if (sprite.position.x < camera.position.x - 65) sprite.position.x = camera.position.x + 65;
      if (Math.abs(sprite.position.z - camera.position.z) > 85) {
        sprite.position.z = camera.position.z + (Math.random() - 0.5) * 150;
      }
    });
    stars.position.copy(camera.position);
    stars.rotation.y += delta * 0.002;
    renderer.render(scene, camera);
  }
  animate();

  window.memoryUniverse = Object.freeze({
    addMemory,
    getMemories: () => memories.map((memory) => ({ ...memory })),
    getSpaceStats: () => ({
      meteorites: meteorites.length,
      lasers: laserProjectiles.length,
      destroyedMeteorites,
      cosmicResources: cosmicResources.length
    }),
    getSectors: () => groups.map((group) => ({
      key: group.key,
      label: group.label,
      memories: group.memories.length,
      orbitRings: group.orbitMeshes.length
    }))
  });

  fetch(new URL("./img/recuerdos.json", window.location.href))
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then((publishedMemories) => {
      if (!Array.isArray(publishedMemories)) throw new TypeError("El manifiesto debe ser una lista de recuerdos.");
      const currentIds = new Set(memories.map((memory) => memory.id));
      publishedMemories.forEach((memory) => {
        if (memory && !currentIds.has(memory.id)) {
          window.memoryUniverse.addMemory(memory);
          currentIds.add(memory.id);
        }
      });
    })
    .catch((error) => {
      console.error("No se pudo leer img/recuerdos.json.", error);
      sectorCount.textContent = `No se pudieron leer los recuerdos publicados: ${error.message}`;
    });

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  });
})();
