import * as THREE from 'three';

export class TitleScene {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;

    this.root = new THREE.Group();
    this.root.name = 'TitleScene';

    this.players = [];
    this.dustParticles = null;
    this.lights = [];

    this._setup();
  }

  _setup() {
    this._setupEnvironment();
    this._setupLighting();
    this._setupDustParticles();
  }

  _setupEnvironment() {
    // 1. Plataforma circular tática de aço militar
    const floorGeo = new THREE.CylinderGeometry(8, 8.5, 0.4, 48);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.5,
      metalness: 0.7
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.y = -0.2;
    floor.receiveShadow = true;
    this.root.add(floor);

    // Anel de luz LED circular ciano na borda da plataforma
    const ringGeo = new THREE.RingGeometry(7.8, 8.0, 48);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.01;
    this.root.add(ring);

    // Grid tático sutil sobre o chão
    const grid = new THREE.GridHelper(20, 20, 0x0284c7, 0x1e293b);
    grid.position.y = 0.02;
    this.root.add(grid);

    this.scene.add(this.root);
  }

  _setupLighting() {
    // 1. Key Light frontal nítida
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
    keyLight.position.set(4, 8, 8);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    this.root.add(keyLight);
    this.lights.push(keyLight);

    // 2. Fill Light azulada ambiente
    const fillLight = new THREE.HemisphereLight(0x7dd3fc, 0x020617, 1.2);
    this.root.add(fillLight);
    this.lights.push(fillLight);

    // 3. Rim Light traseira dramática (Ciano tático)
    const rimLightLeft = new THREE.PointLight(0x38bdf8, 8, 14);
    rimLightLeft.position.set(-4, 3, -2);
    this.root.add(rimLightLeft);
    this.lights.push(rimLightLeft);

    const rimLightRight = new THREE.PointLight(0x0284c7, 6, 14);
    rimLightRight.position.set(4, 3, -2);
    this.root.add(rimLightRight);
    this.lights.push(rimLightRight);
  }

  _setupDustParticles() {
    const particleCount = 120;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i += 3) {
      positions[i] = (Math.random() - 0.5) * 14;
      positions[i + 1] = Math.random() * 6;
      positions[i + 2] = (Math.random() - 0.5) * 10;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color: 0x38bdf8,
      size: 0.05,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending
    });

    this.dustParticles = new THREE.Points(geo, mat);
    this.root.add(this.dustParticles);
  }

  setCameraPosition() {
    this.camera.position.set(0, 1.75, 4.8);
    this.camera.lookAt(0, 1.25, 0);
  }

  // Criação procedural de operador 3D de alta qualidade para a vitrine do Lobby
  createOperatorShowcase(options = {}) {
    const group = new THREE.Group();
    const camoColor = options.camoColor || 0x1e293b;
    const accentColor = options.accentColor || 0x38bdf8;
    const weaponKey = options.weapon || 'm4a1';

    // Materiais
    const matUniform = new THREE.MeshStandardMaterial({ color: camoColor, roughness: 0.85, metalness: 0.1 });
    const matVest = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.7, metalness: 0.3 });
    const matSkin = new THREE.MeshStandardMaterial({ color: 0xc8987b, roughness: 0.7, metalness: 0.1 });
    const matGoggles = new THREE.MeshStandardMaterial({ color: 0x0a0e17, roughness: 0.1, metalness: 0.9 });
    const matGun = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.4, metalness: 0.85 });

    // Pernas / Coturnos
    const legGeo = new THREE.BoxGeometry(0.24, 0.78, 0.26);
    const leftLeg = new THREE.Mesh(legGeo, matUniform);
    leftLeg.position.set(-0.18, 0.39, 0);
    leftLeg.castShadow = true;
    group.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, matUniform);
    rightLeg.position.set(0.18, 0.39, 0);
    rightLeg.castShadow = true;
    group.add(rightLeg);

    // Joelheiras
    const padGeo = new THREE.BoxGeometry(0.20, 0.14, 0.08);
    const padL = new THREE.Mesh(padGeo, matVest);
    padL.position.set(-0.18, 0.39, 0.13);
    group.add(padL);

    const padR = new THREE.Mesh(padGeo, matVest);
    padR.position.set(0.18, 0.39, 0.13);
    group.add(padR);

    // Tronco e Colete Plate Carrier
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.72, 0.38), matUniform);
    torso.position.y = 1.14;
    torso.castShadow = true;
    group.add(torso);

    const vest = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.58, 0.42), matVest);
    vest.position.set(0, 1.18, 0);
    vest.castShadow = true;
    group.add(vest);

    // Bolsos de munição táticos
    const pouchGeo = new THREE.BoxGeometry(0.15, 0.18, 0.08);
    for (let i = -1; i <= 1; i++) {
      const pouch = new THREE.Mesh(pouchGeo, matVest);
      pouch.position.set(i * 0.18, 1.05, 0.24);
      group.add(pouch);
    }

    // Braçadeira na cor de destaque
    const armband = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.10, 0.18),
      new THREE.MeshBasicMaterial({ color: accentColor })
    );
    armband.position.set(-0.44, 1.30, 0);
    group.add(armband);

    // Braços em posição de porte de arma tático
    const armGeo = new THREE.BoxGeometry(0.16, 0.62, 0.16);
    const leftArm = new THREE.Mesh(armGeo, matUniform);
    leftArm.position.set(-0.44, 1.15, 0.12);
    leftArm.rotation.x = -0.55;
    leftArm.rotation.y = 0.25;
    leftArm.castShadow = true;
    group.add(leftArm);

    const rightArm = new THREE.Mesh(armGeo, matUniform);
    rightArm.position.set(0.44, 1.15, 0.12);
    rightArm.rotation.x = -0.55;
    rightArm.rotation.y = -0.25;
    rightArm.castShadow = true;
    group.add(rightArm);

    // Cabeça e Capacete FAST Militar
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 16), matSkin);
    head.position.y = 1.72;
    head.castShadow = true;
    group.add(head);

    const helmet = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 16, 16, 0, Math.PI * 2, 0, Math.PI / 1.7),
      matUniform
    );
    helmet.position.set(0, 1.76, 0);
    group.add(helmet);

    // Óculos de combate
    const goggles = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.12), matGoggles);
    goggles.position.set(0, 1.72, 0.18);
    group.add(goggles);

    // Arma empunhada em posição "Low Ready"
    const weaponGroup = new THREE.Group();
    weaponGroup.position.set(0.16, 0.95, 0.35);
    weaponGroup.rotation.set(-0.35, 0.15, -0.1);

    if (weaponKey === 'sniper') {
      const rifle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, 0.95), matGun);
      const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.35, 12), matGun);
      scope.rotation.x = Math.PI / 2;
      scope.position.set(0, 0.09, 0);
      weaponGroup.add(rifle);
      weaponGroup.add(scope);
    } else if (weaponKey === 'shotgun') {
      const shot = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.09, 0.65), matGun);
      weaponGroup.add(shot);
    } else if (weaponKey === 'mp5') {
      const smg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.45), matGun);
      weaponGroup.add(smg);
    } else {
      // M4A1 padrão
      const m4 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, 0.60), matGun);
      const sight = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.04, 0.08), matGun);
      sight.position.set(0, 0.07, 0);
      weaponGroup.add(m4);
      weaponGroup.add(sight);
    }

    group.add(weaponGroup);
    group.userData = {
      basePosition: options.position ? options.position.clone() : new THREE.Vector3(),
      baseRotationY: options.rotationY || 0,
      isLeader: !!options.isLeader,
      name: options.name || 'Operador'
    };

    if (options.position) {
      group.position.copy(options.position);
    }
    if (options.rotationY) {
      group.rotation.y = options.rotationY;
    }

    return group;
  }

  setSquad(squadMembers = []) {
    this.clearCharacters();

    // Se não houver membros fornecidos, exibe o líder no centro
    if (!squadMembers || squadMembers.length === 0) {
      squadMembers = [{ name: 'VOCÊ', isLeader: true, camoColor: 0x1e293b, accentColor: 0x38bdf8 }];
    }

    // Posições táticas para até 4 membros do esquadrão no lobby
    const squadLayout = [
      { pos: new THREE.Vector3(0, 0, 0), rotY: 0, isLeader: true },             // Líder no centro
      { pos: new THREE.Vector3(-1.7, 0, -0.7), rotY: 0.28, isLeader: false },    // Operador Esquerda
      { pos: new THREE.Vector3(1.7, 0, -0.7), rotY: -0.28, isLeader: false },    // Operador Direita
      { pos: new THREE.Vector3(0, 0, -1.5), rotY: 0, isLeader: false }           // Operador Fundo
    ];

    squadMembers.forEach((member, index) => {
      if (index >= squadLayout.length) return;
      const layout = squadLayout[index];
      const char = this.createOperatorShowcase({
        name: member.name,
        isLeader: layout.isLeader,
        camoColor: member.camoColor || (index === 0 ? 0x181e26 : 0x273549),
        accentColor: member.color ? new THREE.Color(member.color).getHex() : (index === 0 ? 0x38bdf8 : 0x4ade80),
        weapon: member.weapon || (index === 0 ? 'm4a1' : 'mp5'),
        position: layout.pos,
        rotationY: layout.rotY
      });

      this.addCharacter(char);
    });
  }

  addCharacter(character) {
    this.root.add(character);
    this.players.push(character);
  }

  clearCharacters() {
    for (const player of this.players) {
      this.root.remove(player);
    }
    this.players = [];
  }

  update(deltaTime) {
    const time = performance.now() * 0.001;

    // 1. Animação de idle breathing e oscilação tática sutil dos operadores
    this.players.forEach((player, index) => {
      const basePos = player.userData.basePosition || new THREE.Vector3();
      const baseRotY = player.userData.baseRotationY || 0;

      player.position.y = basePos.y + Math.sin(time * 1.6 + index * 1.2) * 0.012;
      player.rotation.y = baseRotY + Math.sin(time * 0.45 + index * 0.8) * 0.035;
    });

    // 2. Animação de partículas de poeira luminosa
    if (this.dustParticles) {
      this.dustParticles.rotation.y = time * 0.02;
    }
  }

  show() {
    this.root.visible = true;
  }

  hide() {
    this.root.visible = false;
  }

  destroy() {
    this.clearCharacters();
    this.scene.remove(this.root);
  }
}
