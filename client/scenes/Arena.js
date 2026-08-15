import * as THREE from 'three';

export class Arena {
  constructor(scene) {
    this.scene = scene;
    this.colliders = []; // Caixas AABB para colisão física
    this.shootableMeshes = []; // Meshes atingíveis por Raycasting
    this.spawnPoints = [
      new THREE.Vector3(0, 1.8, 18),
      new THREE.Vector3(0, 1.8, -18),
      new THREE.Vector3(18, 1.8, 0),
      new THREE.Vector3(-18, 1.8, 0)
    ];

    this._initMaterials();
    this._buildTacticalCompound();
    this._setupLighting();
  }

  _initMaterials() {
    // 1. Piso de Concreto Tático Claro (Canvas Procedural)
    const floorCanvas = document.createElement('canvas');
    floorCanvas.width = 512;
    floorCanvas.height = 512;
    const ctx = floorCanvas.getContext('2d');

    // Base de concreto cinza claro militar
    ctx.fillStyle = '#64748b';
    ctx.fillRect(0, 0, 512, 512);

    // Placas de concreto com juntas de dilatação
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, 256, 256);
    ctx.strokeRect(256, 0, 256, 256);
    ctx.strokeRect(0, 256, 256, 256);
    ctx.strokeRect(256, 256, 256, 256);

    // Textura de desgaste e ruído
    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    for (let i = 0; i < 500; i++) {
      ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }
    ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
    for (let i = 0; i < 400; i++) {
      ctx.fillRect(Math.random() * 512, Math.random() * 512, 3, 3);
    }

    // Faixa amarela tática de segurança
    ctx.fillStyle = '#eab308';
    ctx.fillRect(16, 240, 480, 8);

    const floorTexture = new THREE.CanvasTexture(floorCanvas);
    floorTexture.wrapS = THREE.RepeatWrapping;
    floorTexture.wrapT = THREE.RepeatWrapping;
    floorTexture.repeat.set(12, 12);

    this.matConcreteFloor = new THREE.MeshStandardMaterial({
      map: floorTexture,
      roughness: 0.75,
      metalness: 0.1
    });

    // 2. Paredes de Concreto Armado Militar
    const wallCanvas = document.createElement('canvas');
    wallCanvas.width = 512;
    wallCanvas.height = 512;
    const wCtx = wallCanvas.getContext('2d');
    wCtx.fillStyle = '#718096';
    wCtx.fillRect(0, 0, 512, 512);
    wCtx.fillStyle = '#5a687c';
    wCtx.fillRect(20, 20, 472, 472);
    wCtx.strokeStyle = '#4a5568';
    wCtx.lineWidth = 8;
    wCtx.strokeRect(8, 8, 496, 496);

    // Estêncil militar
    wCtx.fillStyle = '#cbd5e1';
    wCtx.font = 'bold 36px monospace';
    wCtx.fillText('SECTOR 04 // LIVE FIRE', 40, 80);

    const wallTexture = new THREE.CanvasTexture(wallCanvas);
    wallTexture.wrapS = THREE.RepeatWrapping;
    wallTexture.wrapT = THREE.RepeatWrapping;
    wallTexture.repeat.set(6, 2);

    this.matBlastWall = new THREE.MeshStandardMaterial({
      map: wallTexture,
      roughness: 0.8,
      metalness: 0.1
    });

    // 3. Materiais de Coberturas Táticas Militares
    // Contêiner Verde-Oliva Militar (OD Green)
    this.matContainerOD = new THREE.MeshStandardMaterial({
      color: 0x476336,
      roughness: 0.65,
      metalness: 0.35
    });

    // Contêiner Tan Desértico
    this.matContainerTan = new THREE.MeshStandardMaterial({
      color: 0xc4a36f,
      roughness: 0.7,
      metalness: 0.25
    });

    // Plataforma de Aço Galvanizado
    this.matSteelPlatform = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.5,
      metalness: 0.55
    });

    // Sacos de Areia (Sandbags)
    this.matSandbags = new THREE.MeshStandardMaterial({
      color: 0xcaa770,
      roughness: 0.95,
      metalness: 0.05
    });

    // Barreiras Jersey de Concreto
    this.matJerseyBarrier = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.85,
      metalness: 0.1
    });

    // Caixas de Munição Militar de Madeira / Aço
    this.matAmmoCrate = new THREE.MeshStandardMaterial({
      color: 0x556b2f,
      roughness: 0.7,
      metalness: 0.2
    });
  }

  _buildTacticalCompound() {
    // 1. Piso Principal (60x60m)
    const floorGeo = new THREE.PlaneGeometry(60, 60);
    const floor = new THREE.Mesh(floorGeo, this.matConcreteFloor);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);
    this.shootableMeshes.push(floor);

    // 2. Muros Periféricos de Concreto Armado (Altura: 7m)
    const wallHeight = 7;
    const arenaSize = 60;
    const halfSize = arenaSize / 2;

    this._createWall(0, wallHeight / 2, -halfSize, arenaSize, wallHeight, 1.5); // Norte
    this._createWall(0, wallHeight / 2, halfSize, arenaSize, wallHeight, 1.5);  // Sul
    this._createWall(-halfSize, wallHeight / 2, 0, 1.5, wallHeight, arenaSize); // Oeste
    this._createWall(halfSize, wallHeight / 2, 0, 1.5, wallHeight, arenaSize);  // Leste

    // 3. Plataforma Central Elevada (Torre de Observação / Passarela)
    this._createPlatform(0, 1.4, 0, 12, 2.8, 12);

    // 4. Contêineres de Transporte Tático (Layout de Combate CQB)
    this._createShippingContainer(-10, 1.5, -8, 6.5, 3.0, 2.8, this.matContainerOD, 0.3);
    this._createShippingContainer(10, 1.5, 8, 6.5, 3.0, 2.8, this.matContainerTan, -0.4);
    this._createShippingContainer(-12, 1.5, 10, 6.5, 3.0, 2.8, this.matContainerTan, Math.PI / 2);
    this._createShippingContainer(12, 1.5, -10, 6.5, 3.0, 2.8, this.matContainerOD, -Math.PI / 2);

    // Contêiner empilhado
    this._createShippingContainer(-10, 4.5, -8, 6.5, 3.0, 2.8, this.matContainerTan, 0.3);

    // 5. Bunkers de Sacos de Areia (Sandbags)
    this._createSandbagBunker(-4, 0.6, -14, 4.5, 1.2, 0.8);
    this._createSandbagBunker(4, 0.6, 14, 4.5, 1.2, 0.8);
    this._createSandbagBunker(-15, 0.6, -2, 0.8, 1.2, 4.5);
    this._createSandbagBunker(15, 0.6, 2, 0.8, 1.2, 4.5);

    // 6. Barreiras Jersey de Concreto
    this._createJerseyBarrier(0, 0.6, 7, 5.0, 1.2, 0.6);
    this._createJerseyBarrier(0, 0.6, -7, 5.0, 1.2, 0.6);
    this._createJerseyBarrier(-6, 0.6, 0, 0.6, 1.2, 5.0);
    this._createJerseyBarrier(6, 0.6, 0, 0.6, 1.2, 5.0);

    // 7. Pilhas de Caixas de Munição Táticas
    this._createAmmoCrateStack(-7, 0.6, 6, 2, 2);
    this._createAmmoCrateStack(7, 0.6, -6, 2, 2);
    this._createAmmoCrateStack(-15, 0.6, -15, 3, 2);
    this._createAmmoCrateStack(15, 0.6, 15, 3, 2);
  }

  _createWall(x, y, z, width, height, depth) {
    const geo = new THREE.BoxGeometry(width, height, depth);
    const mesh = new THREE.Mesh(geo, this.matBlastWall);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    this.shootableMeshes.push(mesh);
    this._registerCollider(mesh);
  }

  _createPlatform(x, y, z, width, height, depth) {
    const group = new THREE.Group();

    // Base de aço elevada
    const baseGeo = new THREE.BoxGeometry(width, height, depth);
    const base = new THREE.Mesh(baseGeo, this.matSteelPlatform);
    base.position.set(x, y, z);
    base.castShadow = true;
    base.receiveShadow = true;
    this.scene.add(base);

    this.shootableMeshes.push(base);
    this._registerCollider(base);

    // Rampas de Acesso (Norte e Sul)
    const rampLength = 6.0;
    const rampWidth = 3.5;
    const rampThickness = 0.4;
    const rampAngle = Math.atan2(height, rampLength);

    const rampGeo = new THREE.BoxGeometry(rampWidth, rampThickness, Math.hypot(height, rampLength));
    
    // Rampa Sul
    const rampSouth = new THREE.Mesh(rampGeo, this.matSteelPlatform);
    rampSouth.position.set(x, height / 2, z + depth / 2 + rampLength / 2);
    rampSouth.rotation.x = -rampAngle;
    rampSouth.castShadow = true;
    rampSouth.receiveShadow = true;
    this.scene.add(rampSouth);
    this.shootableMeshes.push(rampSouth);
    this._registerCollider(rampSouth);

    // Rampa Norte
    const rampNorth = new THREE.Mesh(rampGeo, this.matSteelPlatform);
    rampNorth.position.set(x, height / 2, z - depth / 2 - rampLength / 2);
    rampNorth.rotation.x = rampAngle;
    rampNorth.castShadow = true;
    rampNorth.receiveShadow = true;
    this.scene.add(rampNorth);
    this.shootableMeshes.push(rampNorth);
    this._registerCollider(rampNorth);
  }

  _createShippingContainer(x, y, z, length, height, width, material, rotationY = 0) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = rotationY;

    // Caixa principal do contêiner
    const bodyGeo = new THREE.BoxGeometry(length, height, width);
    const body = new THREE.Mesh(bodyGeo, material);
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // Detalhes das ranhuras de aço ondulado
    const ribMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.6,
      metalness: 0.6
    });
    const ribCount = 8;
    const ribGeo = new THREE.BoxGeometry(0.1, height * 0.94, width * 1.02);

    for (let i = 0; i < ribCount; i++) {
      const ribX = -length / 2 + (length / (ribCount + 1)) * (i + 1);
      const rib = new THREE.Mesh(ribGeo, ribMat);
      rib.position.set(ribX, 0, 0);
      group.add(rib);
    }

    this.scene.add(group);
    this.shootableMeshes.push(body);
    this._registerCollider(body);
  }

  _createSandbagBunker(x, y, z, width, height, depth) {
    const geo = new THREE.BoxGeometry(width, height, depth);
    const mesh = new THREE.Mesh(geo, this.matSandbags);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    this.shootableMeshes.push(mesh);
    this._registerCollider(mesh);
  }

  _createAmmoCrateStack(baseX, baseY, baseZ, countX, countY) {
    const crateSize = 1.0;
    for (let ix = 0; ix < countX; ix++) {
      for (let iy = 0; iy < countY; iy++) {
        const x = baseX + (ix - countX / 2 + 0.5) * crateSize * 1.1;
        const y = baseY + iy * crateSize;
        const z = baseZ;
        this._createSingleCrate(x, y, z, crateSize);
      }
    }
  }

  _createSingleCrate(x, y, z, size) {
    const geo = new THREE.BoxGeometry(size, size, size);
    const mesh = new THREE.Mesh(geo, this.matAmmoCrate);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    this.shootableMeshes.push(mesh);
    this._registerCollider(mesh);
  }

  _createJerseyBarrier(x, y, z, width, height, depth) {
    const geo = new THREE.BoxGeometry(width, height, depth);
    const mesh = new THREE.Mesh(geo, this.matJerseyBarrier);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    this.shootableMeshes.push(mesh);
    this._registerCollider(mesh);
  }

  _registerCollider(mesh) {
    mesh.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(mesh);
    this.colliders.push({ box, mesh });
  }

  _setupLighting() {
    // 1. Luz do Céu Diurno Tático (Ambient Skylight claro e nítido)
    const ambientLight = new THREE.AmbientLight(0xdce7f2, 1.5);
    this.scene.add(ambientLight);

    // 2. Luz Solar Direta com Sombras PCF Nítidas
    const sunLight = new THREE.DirectionalLight(0xfffdf5, 2.6);
    sunLight.position.set(28, 48, 24);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 1.0;
    sunLight.shadow.camera.far = 120;
    sunLight.shadow.camera.left = -38;
    sunLight.shadow.camera.right = 38;
    sunLight.shadow.camera.top = 38;
    sunLight.shadow.camera.bottom = -38;
    sunLight.shadow.bias = -0.0003;
    this.scene.add(sunLight);

    // 3. Luz de Preenchimento Tática (Hemisphere Light do Céu para o Solo)
    const hemiLight = new THREE.HemisphereLight(0xe2e8f0, 0x64748b, 1.2);
    this.scene.add(hemiLight);
  }
}
