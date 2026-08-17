import * as THREE from 'three';
import { MaterialFactory } from '../utils/MaterialFactory.js';

export class Arena {
  constructor(scene) {
    this.scene = scene;

    this.colliders = [];
    this.shootableMeshes = [];

    this.spawnPoints = [
      new THREE.Vector3(0, 1.8, 26),
      new THREE.Vector3(0, 1.8, -26),
      new THREE.Vector3(26, 1.8, 0),
      new THREE.Vector3(-26, 1.8, 0)
    ];

    this._initMaterials();
    this._setupWorld();
    this._buildMap();
    this._setupLighting();
  }

  // ============================================================
  // WORLD
  // ============================================================

  _setupWorld() {
    this.scene.background = new THREE.Color(0xd8b88f);

    this.scene.fog = new THREE.FogExp2(
      0xc9a37a,
      0.0085
    );
  }

  // ============================================================
  // LIGHTING
  // ============================================================

  _setupLighting() {
    // 1. Sol do Deserto (Direcional Dourada Forte)
    const sunLight = new THREE.DirectionalLight(0xfff1db, 2.2);
    sunLight.position.set(-35, 45, -25);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 160;
    sunLight.shadow.camera.left = -45;
    sunLight.shadow.camera.right = 45;
    sunLight.shadow.camera.top = 45;
    sunLight.shadow.camera.bottom = -45;
    sunLight.shadow.bias = -0.0004;
    this.scene.add(sunLight);

    // 2. Luz Ambiente Hemisférica (Céu azul suave + Reflexo da areia dourada)
    const hemiLight = new THREE.HemisphereLight(0x6f9fc6, 0xc5a273, 1.1);
    this.scene.add(hemiLight);

    // 3. Luz Ambiente de Preenchimento
    const ambientLight = new THREE.AmbientLight(0xd8b88f, 0.45);
    this.scene.add(ambientLight);
  }

  // ============================================================
  // MATERIALS
  // ============================================================

  _initMaterials() {
    this.matSand = new THREE.MeshStandardMaterial({
      map: MaterialFactory.desertGround(),
      roughness: 0.96,
      metalness: 0
    });

    this.matSandDark = new THREE.MeshStandardMaterial({
      color: 0xa98258,
      roughness: 1
    });

    this.matAsphalt = new THREE.MeshStandardMaterial({
      color: 0x343330,
      roughness: 0.92
    });

    this.matConcrete = new THREE.MeshStandardMaterial({
      map: MaterialFactory.concrete(),
      roughness: 0.9,
      metalness: 0.02
    });

    this.matConcreteDark = new THREE.MeshStandardMaterial({
      color: 0x827565,
      roughness: 0.94
    });

    this.matBrick = new THREE.MeshStandardMaterial({
      color: 0x945e45,
      roughness: 0.95
    });

    this.matMetal = new THREE.MeshStandardMaterial({
      map: MaterialFactory.rustedMetal(),
      roughness: 0.62,
      metalness: 0.65
    });

    this.matMetalDark = new THREE.MeshStandardMaterial({
      color: 0x171817,
      metalness: 0.82,
      roughness: 0.3
    });

    this.matOlive = new THREE.MeshStandardMaterial({
      color: 0x46513a,
      metalness: 0.15,
      roughness: 0.78
    });

    this.matTanMetal = new THREE.MeshStandardMaterial({
      color: 0x997956,
      metalness: 0.35,
      roughness: 0.7
    });

    this.matWood = new THREE.MeshStandardMaterial({
      color: 0x624837,
      roughness: 0.93
    });

    this.matSandbag = new THREE.MeshStandardMaterial({
      map: MaterialFactory.sandbag(),
      roughness: 0.95
    });

    this.matGlass = new THREE.MeshStandardMaterial({
      color: 0x25363e,
      metalness: 0.35,
      roughness: 0.14,
      transparent: true,
      opacity: 0.72
    });

    this.matRubber = new THREE.MeshStandardMaterial({
      color: 0x121212,
      roughness: 0.92
    });

    this.matEmissive = new THREE.MeshStandardMaterial({
      color: 0x26170c,
      emissive: 0xff8b35,
      emissiveIntensity: 2.5
    });
  }

  // ============================================================
  // MAP
  // ============================================================

  _buildMap() {
    this._createTerrain();
    this._createRoadNetwork();
    this._createPerimeter();
    this._createBuildings();
    this._createCentralCompound();
    this._createCover();
    this._createMilitaryProps();
    this._createVegetation();
    this._createSky();
  }

  // ============================================================
  // TERRAIN
  // ============================================================

  _createTerrain() {
    const size = 80;

    const geometry = new THREE.PlaneGeometry(
      size,
      size,
      40,
      40
    );

    const position = geometry.attributes.position;

    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const y = position.getY(i);

      const height =
        Math.sin(x * 0.16) * 0.08 +
        Math.cos(y * 0.13) * 0.07 +
        Math.sin((x + y) * 0.07) * 0.05;

      position.setZ(i, height);
    }

    position.needsUpdate = true;
    geometry.computeVertexNormals();

    const ground = new THREE.Mesh(
      geometry,
      this.matSand
    );

    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;

    this.scene.add(ground);

    this.shootableMeshes.push(ground);

    // Áreas compactadas de areia
    for (let i = 0; i < 12; i++) {
      const patch = new THREE.Mesh(
        new THREE.CircleGeometry(
          2 + Math.random() * 4,
          24
        ),
        this.matSandDark
      );

      patch.rotation.x = -Math.PI / 2;

      patch.position.set(
        THREE.MathUtils.randFloat(-30, 30),
        0.025,
        THREE.MathUtils.randFloat(-30, 30)
      );

      patch.scale.y =
        0.4 + Math.random() * 0.5;

      this.scene.add(patch);
    }
  }

  // ============================================================
  // ROADS
  // ============================================================

  _createRoadNetwork() {
    this._createRoad(
      0,
      0,
      7,
      65,
      0
    );

    this._createRoad(
      0,
      0,
      7,
      65,
      Math.PI / 2
    );

    this._createRoad(
      -18,
      0,
      5,
      28,
      Math.PI / 2
    );

    this._createRoad(
      18,
      0,
      5,
      28,
      Math.PI / 2
    );
  }

  _createRoad(
    x,
    z,
    width,
    length,
    rotation
  ) {
    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(width, length),
      this.matAsphalt
    );

    road.rotation.x = -Math.PI / 2;
    road.rotation.z = rotation;
    road.position.set(x, 0.04, z);
    road.receiveShadow = true;

    this.scene.add(road);

    // Meio-fio
    const curbGeo =
      new THREE.BoxGeometry(
        width,
        0.12,
        0.12
      );

    const leftCurb =
      new THREE.Mesh(curbGeo, this.matConcreteDark);

    leftCurb.position.set(
      x,
      0.08,
      z - width / 2
    );

    leftCurb.rotation.y = rotation;

    this.scene.add(leftCurb);

    const rightCurb = leftCurb.clone();

    rightCurb.position.z =
      z + width / 2;

    this.scene.add(rightCurb);

    // Faixas quebradas
    for (
      let i = -Math.floor(length / 8);
      i < Math.floor(length / 8);
      i++
    ) {
      if (i % 3 === 0) continue;

      const line = new THREE.Mesh(
        new THREE.BoxGeometry(
          0.12,
          0.015,
          2
        ),
        this.matConcrete
      );

      line.position.set(
        x,
        0.055,
        z + i * 8
      );

      line.rotation.y = rotation;

      this.scene.add(line);
    }
  }

  // ============================================================
  // PERIMETER
  // ============================================================

  _createPerimeter() {
    const size = 68;
    const half = size / 2;
    const height = 6;

    this._createBlock(
      0,
      height / 2,
      -half,
      size,
      height,
      1.2,
      this.matConcreteDark,
      true
    );

    this._createBlock(
      0,
      height / 2,
      half,
      size,
      height,
      1.2,
      this.matConcreteDark,
      true
    );

    this._createBlock(
      -half,
      height / 2,
      0,
      1.2,
      height,
      size,
      this.matConcreteDark,
      true
    );

    this._createBlock(
      half,
      height / 2,
      0,
      1.2,
      height,
      size,
      this.matConcreteDark,
      true
    );

    // Torres
    const towers = [
      [-30, -30],
      [30, -30],
      [-30, 30],
      [30, 30]
    ];

    towers.forEach(
      ([x, z], index) => {
        this._createTower(
          x,
          z,
          index % 2 === 0
        );
      }
    );
  }

  // ============================================================
  // BUILDINGS
  // ============================================================

  _createBuildings() {
    const buildings = [
      [-22, -20, 10, 6, 8],
      [21, -20, 9, 5.5, 7],
      [-22, 19, 9, 5.8, 8],
      [22, 20, 11, 5.2, 7]
    ];

    buildings.forEach(
      ([x, z, w, h, d], index) => {
        this._createBuilding(
          x,
          z,
          w,
          h,
          d,
          index % 2 === 0
        );
      }
    );
  }

  _createBuilding(
    x,
    z,
    width,
    height,
    depth,
    rooftopDetails
  ) {
    const group = new THREE.Group();

    group.position.set(
      x,
      height / 2,
      z
    );

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(
        width,
        height,
        depth
      ),
      this.matConcrete
    );

    body.castShadow = true;
    body.receiveShadow = true;

    group.add(body);

    // Tijolos laterais
    const brickPatch = new THREE.Mesh(
      new THREE.BoxGeometry(
        width * 0.28,
        height * 0.38,
        0.07
      ),
      this.matBrick
    );

    brickPatch.position.set(
      -width * 0.18,
      0.2,
      depth / 2 + 0.04
    );

    group.add(brickPatch);

    // Janelas
    const rows =
      Math.max(
        1,
        Math.floor(height / 2)
      );

    const columns =
      Math.max(
        2,
        Math.floor(width / 2.2)
      );

    for (let row = 0; row < rows; row++) {
      for (
        let column = 0;
        column < columns;
        column++
      ) {
        const window = new THREE.Mesh(
          new THREE.BoxGeometry(
            0.85,
            0.65,
            0.05
          ),
          this.matGlass
        );

        window.position.set(
          -width / 2 +
            1.3 +
            column * 2.1,
          -height / 2 +
            1.5 +
            row * 2,
          depth / 2 + 0.04
        );

        group.add(window);
      }
    }

    // Porta
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(
        1.1,
        2.1,
        0.08
      ),
      this.matWood
    );

    door.position.set(
      0,
      -height / 2 + 1.05,
      depth / 2 + 0.06
    );

    group.add(door);

    // Ar-condicionado
    if (rooftopDetails) {
      for (let i = -1; i <= 1; i++) {
        const ac = new THREE.Mesh(
          new THREE.BoxGeometry(
            0.8,
            0.5,
            0.7
          ),
          this.matMetal
        );

        ac.position.set(
          i * width * 0.25,
          height / 2 + 0.3,
          0
        );

        ac.castShadow = true;

        group.add(ac);
      }

      // Caixa d'água
      const tank = new THREE.Mesh(
        new THREE.CylinderGeometry(
          0.55,
          0.55,
          1.3,
          16
        ),
        this.matMetalDark
      );

      tank.position.set(
        width * 0.2,
        height / 2 + 0.75,
        -depth * 0.15
      );

      tank.castShadow = true;

      group.add(tank);
    }

    this.scene.add(group);

    this._registerCollider(
      body,
      group
    );

    this.shootableMeshes.push(body);
  }

  // ============================================================
  // CENTRAL AREA
  // ============================================================

  _createCentralCompound() {
    this._createBlock(
      0,
      1,
      0,
      15,
      2,
      15,
      this.matConcrete,
      false
    );

    this._createBuilding(
      0,
      0,
      10,
      4.5,
      7,
      true
    );

    // Passarela
    const platform =
      new THREE.Mesh(
        new THREE.BoxGeometry(
          12,
          0.5,
          2.4
        ),
        this.matMetal
      );

    platform.position.set(
      0,
      4.2,
      -7
    );

    platform.castShadow = true;

    this.scene.add(platform);

    this._registerCollider(platform);

    // Guarda-corpo
    for (let x = -5; x <= 5; x += 5) {
      const post =
        new THREE.Mesh(
          new THREE.CylinderGeometry(
            0.035,
            0.035,
            1,
            8
          ),
          this.matMetalDark
        );

      post.position.set(
        x,
        4.95,
        -8
      );

      this.scene.add(post);
    }
  }

  // ============================================================
  // COVER
  // ============================================================

  _createCover() {
    const positions = [
      [-9, 8],
      [9, -8],
      [-8, -8],
      [8, 8]
    ];

    positions.forEach(
      ([x, z]) => {
        this._createSandbags(
          x,
          z,
          4.5,
          1
        );
      }
    );

    this._createJersey(
      0,
      0,
      12,
      5
    );

    this._createJersey(
      0,
      0,
      -12,
      5
    );

    this._createJersey(
      -12,
      0,
      0,
      5
    );

    this._createJersey(
      12,
      0,
      0,
      5
    );

    // Contêineres
    this._createContainer(
      -15,
      1.5,
      -8,
      this.matOlive,
      0.1
    );

    this._createContainer(
      15,
      1.5,
      9,
      this.matTanMetal,
      -0.1
    );

    this._createContainer(
      -15,
      4.5,
      -8,
      this.matTanMetal,
      0.1
    );
  }

  _createSandbags(
    x,
    z,
    width,
    depth
  ) {
    const group =
      new THREE.Group();

    group.position.set(
      x,
      0,
      z
    );

    for (let i = -4; i <= 4; i++) {
      const bag = new THREE.Mesh(
        new THREE.SphereGeometry(
          0.4,
          12,
          10
        ),
        this.matSandbag
      );

      bag.scale.set(
        1.3,
        0.55,
        0.75
      );

      bag.position.set(
        i * 0.45,
        0.35 + (i % 2) * 0.08,
        0
      );

      bag.castShadow = true;
      bag.receiveShadow = true;

      group.add(bag);
    }

    this.scene.add(group);

    const collider =
      new THREE.Mesh(
        new THREE.BoxGeometry(
          width,
          1,
          depth
        ),
        this.matSandbag
      );

    collider.position.set(
      x,
      0.6,
      z
    );

    collider.visible = false;

    this.scene.add(collider);

    this._registerCollider(collider);

    this.shootableMeshes.push(
      collider
    );
  }

  _createJersey(
    x,
    y,
    z,
    length
  ) {
    const shape =
      new THREE.Shape();

    shape.moveTo(
      -length / 2,
      0
    );

    shape.lineTo(
      length / 2,
      0
    );

    shape.lineTo(
      length / 2 - 0.18,
      1.2
    );

    shape.lineTo(
      -length / 2 + 0.18,
      1.2
    );

    shape.closePath();

    const geo =
      new THREE.ExtrudeGeometry(
        shape,
        {
          depth: 0.65,
          bevelEnabled: true,
          bevelSegments: 2,
          bevelSize: 0.05,
          bevelThickness: 0.05
        }
      );

    const mesh =
      new THREE.Mesh(
        geo,
        this.matConcreteDark
      );

    mesh.position.set(
      x,
      y,
      z
    );

    mesh.castShadow = true;
    mesh.receiveShadow = true;

    this.scene.add(mesh);

    this._registerCollider(mesh);

    this.shootableMeshes.push(
      mesh
    );
  }

  // ============================================================
  // CONTAINERS
  // ============================================================

  _createContainer(
    x,
    y,
    z,
    material,
    rotationY
  ) {
    const group =
      new THREE.Group();

    group.position.set(
      x,
      y,
      z
    );

    group.rotation.y =
      rotationY;

    const body =
      new THREE.Mesh(
        new THREE.BoxGeometry(
          6.8,
          3,
          2.8
        ),
        material
      );

    body.castShadow = true;
    body.receiveShadow = true;

    group.add(body);

    for (let i = 0; i < 10; i++) {
      const rib =
        new THREE.Mesh(
          new THREE.BoxGeometry(
            0.07,
            2.8,
            2.9
          ),
          this.matMetalDark
        );

      rib.position.x =
        -3 +
        (i + 1) *
          (6 / 11);

      group.add(rib);
    }

    const door =
      new THREE.Mesh(
        new THREE.BoxGeometry(
          0.08,
          2.5,
          2.2
        ),
        this.matMetalDark
      );

    door.position.z =
      3.35;

    group.add(door);

    this.scene.add(group);

    this._registerCollider(
      body,
      group
    );

    this.shootableMeshes.push(
      body
    );
  }

  // ============================================================
  // MILITARY PROPS
  // ============================================================

  _createMilitaryProps() {
    const barrelPositions = [
      [-5, 21],
      [-6, 21.5],
      [16, -14],
      [17, -14.5],
      [4, 20],
      [-18, 10]
    ];

    barrelPositions.forEach(
      ([x, z], i) => {
        this._createBarrel(
          x,
          z,
          i % 2 === 0
        );
      }
    );

    this._createTruck(
      24,
      7,
      0
    );

    this._createTruck(
      -24,
      -7,
      Math.PI
    );

    this._createRadioTower(
      9,
      -2
    );
  }

  _createBarrel(
    x,
    z,
    glowing
  ) {
    const barrel =
      new THREE.Mesh(
        new THREE.CylinderGeometry(
          0.4,
          0.4,
          0.9,
          18
        ),
        glowing
          ? this.matTanMetal
          : this.matMetal
      );

    barrel.position.set(
      x,
      0.45,
      z
    );

    barrel.castShadow = true;
    barrel.receiveShadow = true;

    this.scene.add(barrel);

    this._registerCollider(
      barrel
    );

    this.shootableMeshes.push(
      barrel
    );

    const top =
      new THREE.Mesh(
        new THREE.TorusGeometry(
          0.4,
          0.045,
          8,
          18
        ),
        this.matMetalDark
      );

    top.rotation.x =
      Math.PI / 2;

    top.position.set(
      x,
      0.9,
      z
    );

    this.scene.add(top);

    if (glowing) {
      const light =
        new THREE.PointLight(
          0xff8b35,
          2.5,
          8
        );

      light.position.set(
        x,
        1.0,
        z
      );

      this.scene.add(light);
    }
  }

  _createTruck(
    x,
    z,
    rotationY
  ) {
    const group =
      new THREE.Group();

    group.position.set(
      x,
      0.7,
      z
    );

    group.rotation.y =
      rotationY;

    const chassis =
      new THREE.Mesh(
        new THREE.BoxGeometry(
          5,
          0.5,
          1.8
        ),
        this.matMetal
      );

    chassis.castShadow = true;
    group.add(chassis);

    const cabin =
      new THREE.Mesh(
        new THREE.BoxGeometry(
          1.7,
          1.4,
          1.7
        ),
        this.matOlive
      );

    cabin.position.set(
      1.25,
      0.8,
      0
    );

    cabin.castShadow = true;

    group.add(cabin);

    const bed =
      new THREE.Mesh(
        new THREE.BoxGeometry(
          2.4,
          1.1,
          1.7
        ),
        this.matTanMetal
      );

    bed.position.set(
      -1,
      0.7,
      0
    );

    bed.castShadow = true;

    group.add(bed);

    const wheelGeo =
      new THREE.CylinderGeometry(
        0.42,
        0.42,
        0.3,
        18
      );

    const wheelPositions = [
      [-1.5, -0.85],
      [-1.5, 0.85],
      [1.4, -0.85],
      [1.4, 0.85]
    ];

    wheelPositions.forEach(
      ([wx, wz]) => {
        const wheel =
          new THREE.Mesh(
            wheelGeo,
            this.matRubber
          );

        wheel.rotation.z =
          Math.PI / 2;

        wheel.position.set(
          wx,
          0.35,
          wz
        );

        group.add(wheel);
      }
    );

    this.scene.add(group);

    this._registerCollider(
      chassis,
      group
    );

    this.shootableMeshes.push(
      chassis
    );
  }

  _createRadioTower(
    x,
    z
  ) {
    const group =
      new THREE.Group();

    group.position.set(
      x,
      0,
      z
    );

    const mast =
      new THREE.Mesh(
        new THREE.CylinderGeometry(
          0.055,
          0.09,
          9,
          12
        ),
        this.matMetal
      );

    mast.position.y = 4.5;
    mast.castShadow = true;

    group.add(mast);

    for (let i = 0; i < 5; i++) {
      const ring =
        new THREE.Mesh(
          new THREE.TorusGeometry(
            0.22,
            0.02,
            8,
            16
          ),
          this.matMetalDark
        );

      ring.position.y =
        2 +
        i * 1.35;

      group.add(ring);
    }

    const antenna =
      new THREE.Mesh(
        new THREE.CylinderGeometry(
          0.02,
          0.02,
          1.5,
          8
        ),
        this.matMetal
      );

    antenna.position.y =
      9.75;

    group.add(antenna);

    this.scene.add(group);
  }

  // ============================================================
  // WATCH TOWERS
  // ============================================================

  _createTower(
    x,
    z,
    lit
  ) {
    const group =
      new THREE.Group();

    group.position.set(
      x,
      0,
      z
    );

    const support =
      new THREE.Mesh(
        new THREE.BoxGeometry(
          2.8,
          5.5,
          2.8
        ),
        this.matMetal
      );

    support.position.y = 2.75;
    support.castShadow = true;

    group.add(support);

    const cabin =
      new THREE.Mesh(
        new THREE.BoxGeometry(
          3.5,
          2.1,
          3
        ),
        this.matConcrete
      );

    cabin.position.y = 6;

    cabin.castShadow = true;

    group.add(cabin);

    const glass =
      new THREE.Mesh(
        new THREE.BoxGeometry(
          2.7,
          0.8,
          0.04
        ),
        this.matGlass
      );

    glass.position.set(
      0,
      6.1,
      1.52
    );

    group.add(glass);

    const roof =
      new THREE.Mesh(
        new THREE.BoxGeometry(
          3.8,
          0.25,
          3.3
        ),
        this.matConcreteDark
      );

    roof.position.y =
      7.1;

    group.add(roof);

    if (lit) {
      const lamp =
        new THREE.Mesh(
          new THREE.SphereGeometry(
            0.12,
            10,
            10
          ),
          this.matEmissive
        );

      lamp.position.set(
        0,
        6.1,
        1.58
      );

      group.add(lamp);
    }

    this.scene.add(group);

    this._registerCollider(
      support,
      group
    );

    this._registerCollider(
      cabin,
      group
    );

    this.shootableMeshes.push(
      support,
      cabin
    );
  }

  // ============================================================
  // VEGETATION
  // ============================================================

  _createVegetation() {
    const positions = [
      [-27, -7],
      [27, 10],
      [-28, 20],
      [28, -20]
    ];

    positions.forEach(
      ([x, z], i) => {
        this._createPalm(
          x,
          z,
          i
        );
      }
    );
  }

  _createPalm(
    x,
    z,
    index
  ) {
    const group =
      new THREE.Group();

    group.position.set(
      x,
      0,
      z
    );

    const trunk =
      new THREE.Mesh(
        new THREE.CylinderGeometry(
          0.22,
          0.32,
          4.4,
          12
        ),
        this.matWood
      );

    trunk.position.y = 2.2;
    trunk.rotation.z =
      Math.sin(index) * 0.08;

    trunk.castShadow = true;

    group.add(trunk);

    const leafMat =
      new THREE.MeshStandardMaterial({
        color: 0x43543c,
        roughness: 0.95
      });

    for (let i = 0; i < 7; i++) {
      const leaf =
        new THREE.Mesh(
          new THREE.BoxGeometry(
            0.12,
            0.7,
            2.8
          ),
          leafMat
        );

      leaf.position.y =
        4.35;

      leaf.rotation.y =
        (i / 7) *
        Math.PI *
        2;

      leaf.rotation.x =
        -0.45;

      leaf.translateZ(1.2);

      leaf.castShadow = true;

      group.add(leaf);
    }

    this.scene.add(group);
  }

  // ============================================================
  // SKY
  // ============================================================

  _createSky() {
    const geometry =
      new THREE.SphereGeometry(
        180,
        32,
        16
      );

    const material =
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,

        uniforms: {
          topColor: {
            value:
              new THREE.Color(
                0x6f9fc6
              )
          },

          horizonColor: {
            value:
              new THREE.Color(
                0xe5bf91
              )
          },

          bottomColor: {
            value:
              new THREE.Color(
                0x9b765c
              )
          },

          sunPosition: {
            value:
              new THREE.Vector3(
                -0.45,
                0.55,
                -0.3
              )
          }
        },

        vertexShader: `
          varying vec3 vWorldDirection;

          void main() {
            vec4 worldPosition =
              modelMatrix *
              vec4(position, 1.0);

            vWorldDirection =
              normalize(
                worldPosition.xyz -
                cameraPosition
              );

            gl_Position =
              projectionMatrix *
              modelViewMatrix *
              vec4(position, 1.0);
          }
        `,

        fragmentShader: `
          uniform vec3 topColor;
          uniform vec3 horizonColor;
          uniform vec3 bottomColor;
          uniform vec3 sunPosition;

          varying vec3 vWorldDirection;

          void main() {
            vec3 direction =
              normalize(
                vWorldDirection
              );

            float height =
              clamp(
                direction.y * 0.5 +
                0.5,
                0.0,
                1.0
              );

            vec3 color =
              mix(
                bottomColor,
                horizonColor,
                smoothstep(
                  0.1,
                  0.5,
                  height
                )
              );

            color =
              mix(
                color,
                topColor,
                smoothstep(
                  0.5,
                  0.95,
                  height
                )
              );

            float sun =
              pow(
                max(
                  dot(
                    direction,
                    normalize(
                      sunPosition
                    )
                  ),
                  0.0
                ),
                48.0
              );

            color +=
              vec3(
                1.0,
                0.55,
                0.22
              ) *
              sun *
              0.8;

            float haze =
              pow(
                1.0 -
                abs(direction.y),
                4.0
              );

            color +=
              vec3(
                1.0,
                0.45,
                0.18
              ) *
              haze *
              0.05;

            gl_FragColor =
              vec4(
                color,
                1.0
              );
          }
        `
      });

    const sky =
      new THREE.Mesh(
        geometry,
        material
      );

    sky.name =
      'DeadlyShotDesertSky';

    sky.renderOrder = -10;

    this.scene.add(sky);
  }

  // ============================================================
  // HELPERS
  // ============================================================

  _createBlock(
    x,
    y,
    z,
    width,
    height,
    depth,
    material,
    shootable
  ) {
    const mesh =
      new THREE.Mesh(
        new THREE.BoxGeometry(
          width,
          height,
          depth
        ),
        material
      );

    mesh.position.set(
      x,
      y,
      z
    );

    mesh.castShadow = true;
    mesh.receiveShadow = true;

    this.scene.add(mesh);

    this._registerCollider(mesh);

    if (shootable) {
      this.shootableMeshes.push(
        mesh
      );
    }

    return mesh;
  }

  _registerCollider(
    mesh,
    root = null
  ) {
    mesh.updateMatrixWorld(true);

    const box =
      new THREE.Box3().setFromObject(
        root || mesh
      );

    this.colliders.push({
      box,
      mesh
    });
  }
}
