/* =========================================================
   ONTERRA, Three.js hero
   An animated "reservoir / seismic" wireframe surface with
   drifting energy particles. Evokes the subsurface that
   marginal-field work is all about. Degrades gracefully.
   ========================================================= */
(function () {
  const canvas = document.getElementById('heroCanvas');
  if (!canvas || typeof THREE === 'undefined') return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x070b12, 0.085);

  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  camera.position.set(0, 3.4, 9);
  camera.lookAt(0, 0, 0);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (e) {
    return; // no WebGL, CSS gradient hero remains
  }
  renderer.setClearColor(0x000000, 0);

  // ---- Reservoir surface (undulating wireframe plane) ----
  const SEG = 60;
  const geo = new THREE.PlaneGeometry(28, 22, SEG, SEG);
  geo.rotateX(-Math.PI / 2);

  const mat = new THREE.MeshBasicMaterial({
    color: 0x1fa3b8,
    wireframe: true,
    transparent: true,
    opacity: 0.42,
  });
  const surface = new THREE.Mesh(geo, mat);
  surface.position.y = -1.6;
  scene.add(surface);

  // A second, amber "hotspot" surface layered subtly underneath
  const geo2 = geo.clone();
  const mat2 = new THREE.MeshBasicMaterial({
    color: 0xf2a900,
    wireframe: true,
    transparent: true,
    opacity: 0.10,
  });
  const surface2 = new THREE.Mesh(geo2, mat2);
  surface2.position.y = -2.4;
  scene.add(surface2);

  const base = geo.attributes.position.array.slice();
  const base2 = geo2.attributes.position.array.slice();

  function wave(arr, src, t, amp, freq) {
    for (let i = 0; i < arr.length; i += 3) {
      const x = src[i], z = src[i + 2];
      arr[i + 1] =
        Math.sin(x * freq + t) * amp +
        Math.cos(z * (freq * 0.8) + t * 1.1) * amp * 0.8;
    }
  }

  // ---- Energy particles ----
  const COUNT = 900;
  const pGeo = new THREE.BufferGeometry();
  const pos = new Float32Array(COUNT * 3);
  const speed = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 26;
    pos[i * 3 + 1] = Math.random() * 9 - 1;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 20;
    speed[i] = 0.002 + Math.random() * 0.01;
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pMat = new THREE.PointsMaterial({
    color: 0xffc24d,
    size: 0.06,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(pGeo, pMat);
  scene.add(points);

  // ---- Resize ----
  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  // ---- Mouse parallax ----
  const target = { x: 0, y: 0 };
  const cur = { x: 0, y: 0 };
  window.addEventListener('pointermove', (e) => {
    target.x = (e.clientX / window.innerWidth - 0.5);
    target.y = (e.clientY / window.innerHeight - 0.5);
  });

  // ---- Loop ----
  let t = 0;
  let raf;
  function tick() {
    t += reduceMotion ? 0.002 : 0.012;

    wave(geo.attributes.position.array, base, t, 0.9, 0.55);
    geo.attributes.position.needsUpdate = true;
    wave(geo2.attributes.position.array, base2, t * 0.7, 1.2, 0.4);
    geo2.attributes.position.needsUpdate = true;

    const arr = pGeo.attributes.position.array;
    for (let i = 0; i < COUNT; i++) {
      arr[i * 3 + 1] += speed[i] * (reduceMotion ? 0.3 : 1);
      if (arr[i * 3 + 1] > 8) arr[i * 3 + 1] = -1.5;
    }
    pGeo.attributes.position.needsUpdate = true;

    cur.x += (target.x - cur.x) * 0.04;
    cur.y += (target.y - cur.y) * 0.04;
    camera.position.x = cur.x * 2.2;
    camera.position.y = 3.4 - cur.y * 1.4;
    camera.lookAt(0, -0.5, 0);

    surface.rotation.z = Math.sin(t * 0.1) * 0.04;

    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  }
  tick();

  // Pause when hero off-screen (perf)
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { if (!raf) tick(); }
        else { cancelAnimationFrame(raf); raf = null; }
      });
    }, { threshold: 0.01 });
    io.observe(canvas);
  }
})();
