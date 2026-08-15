import * as THREE from 'three';

export class WeaponSystem {
  constructor(camera, scene) {
    this.camera = camera;
    this.scene = scene;

    this.viewmodelGroup = new THREE.Group();
    this.camera.add(this.viewmodelGroup);

    // Posições de repouso e mira (ADS tático militar)
    this.hipPosition = new THREE.Vector3(0.24, -0.24, -0.52);
    this.adsPosition = new THREE.Vector3(0.0, -0.19, -0.40);
    this.currentRestPosition = this.hipPosition.clone();

    this.baseRotation = new THREE.Euler(0, 0, 0);

    // Recuo e Balanço
    this.recoilOffset = new THREE.Vector3();
    this.recoilRotation = new THREE.Euler();
    this.swayOffset = new THREE.Vector2();

    this.bobTime = 0;
    this.isReloading = false;
    this.reloadProgress = 0;
    this.reloadDuration = 1.8;

    this.isAiming = false;
    this.aimProgress = 0;

    // Troca de Armas
    this.isSwitching = false;
    this.switchProgress = 0;
    this.switchDuration = 0.25;
    this.nextWeaponKey = null;

    this.currentWeaponKey = 'm4a1';
    this.weaponModels = {};

    this._initAllTacticalWeapons();
    this._createMuzzleFlash();
    this.showWeaponModel('m4a1');
  }

  _initAllTacticalWeapons() {
    this.weaponModels.m4a1 = this._buildM4A1Model();
    this.weaponModels.mp5 = this._buildMP5Model();
    this.weaponModels.shotgun = this._buildShotgunModel();
    this.weaponModels.sniper = this._buildM24SniperModel();

    Object.values(this.weaponModels).forEach(model => {
      model.group.visible = false;
      this.viewmodelGroup.add(model.group);
    });
  }

  // --- 1. M4A1 TÁTICO MILITAR (RIFLE DE ASSALTO) ---
  _buildM4A1Model() {
    const group = new THREE.Group();

    // Materiais militares realistas
    const matGunmetal = new THREE.MeshStandardMaterial({ color: 0x1c1f26, metalness: 0.85, roughness: 0.35 });
    const matPolymer = new THREE.MeshStandardMaterial({ color: 0x111317, metalness: 0.1, roughness: 0.85 });
    const matBarrelSteel = new THREE.MeshStandardMaterial({ color: 0x0c0e12, metalness: 0.95, roughness: 0.2 });
    const matSightDot = new THREE.MeshBasicMaterial({ color: 0xff2222 }); // Ponto vermelho EOTech

    // Receptor Superior e Inferior
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.09, 0.38), matGunmetal);
    group.add(receiver);

    // Trilho Picatinny Superior
    const topRail = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.015, 0.36), matGunmetal);
    topRail.position.set(0, 0.052, -0.01);
    group.add(topRail);

    // Guarda-mão Quad-Rail (Handguard)
    const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.07, 0.28), matGunmetal);
    handguard.position.set(0, 0.01, -0.28);
    group.add(handguard);

    // Cano de Aço
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.32, 16), matBarrelSteel);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.015, -0.44);
    group.add(barrel);

    // Quebra-chamas Militar tipo Birdcage
    const flashHider = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.07, 12), matGunmetal);
    flashHider.rotation.x = Math.PI / 2;
    flashHider.position.set(0, 0.015, -0.62);
    group.add(flashHider);

    // Carregador STANAG 5.56mm Curvo
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.19, 0.08), matGunmetal);
    mag.position.set(0, -0.12, -0.05);
    mag.rotation.x = 0.22;
    group.add(mag);

    // Empunhadura de Polímero (Pistol Grip)
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.14, 0.065), matPolymer);
    grip.position.set(0, -0.11, 0.13);
    grip.rotation.x = -0.32;
    group.add(grip);

    // Tubo de Coronha e Coronha Telescópica Tática (Crane Stock)
    const bufferTube = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.22, 12), matGunmetal);
    bufferTube.rotation.x = Math.PI / 2;
    bufferTube.position.set(0, 0.01, 0.28);
    group.add(bufferTube);

    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.11, 0.18), matPolymer);
    stock.position.set(0, -0.02, 0.34);
    group.add(stock);

    // Mira Holográfica Tática EOTech
    const sightHood = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.045, 0.09), matGunmetal);
    sightHood.position.set(0, 0.085, -0.06);
    group.add(sightHood);

    const redDot = new THREE.Mesh(new THREE.SphereGeometry(0.005, 8, 8), matSightDot);
    redDot.position.set(0, 0.085, -0.06);
    group.add(redDot);

    const muzzlePoint = new THREE.Object3D();
    muzzlePoint.position.set(0, 0.015, -0.66);
    group.add(muzzlePoint);

    return { group, muzzlePoint, color: 0xffaa33 };
  }

  // --- 2. MP5 TÁTICA (SUBMETRALHADORA 9MM) ---
  _buildMP5Model() {
    const group = new THREE.Group();

    const matReceiver = new THREE.MeshStandardMaterial({ color: 0x15181e, metalness: 0.8, roughness: 0.4 });
    const matPolymer = new THREE.MeshStandardMaterial({ color: 0x0f1115, metalness: 0.1, roughness: 0.9 });
    const matSteel = new THREE.MeshStandardMaterial({ color: 0x0a0c0f, metalness: 0.95, roughness: 0.2 });

    // Caixa de culatra tubular
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.32, 16), matReceiver);
    upper.rotation.x = Math.PI / 2;
    upper.position.set(0, 0.02, -0.02);
    group.add(upper);

    // Guarda-mão de polímero texturizado
    const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.07, 0.18), matPolymer);
    handguard.position.set(0, 0.0, -0.18);
    group.add(handguard);

    // Cano curto
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.16, 12), matSteel);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.015, -0.28);
    group.add(barrel);

    // Tri-lug / Compensador de boca 9mm
    const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.05, 12), matSteel);
    muzzle.rotation.x = Math.PI / 2;
    muzzle.position.set(0, 0.015, -0.37);
    group.add(muzzle);

    // Carregador 9mm Curvo
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.18, 0.05), matSteel);
    mag.position.set(0, -0.11, -0.06);
    mag.rotation.x = 0.28;
    group.add(mag);

    // Empunhadura clássica Navy
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.13, 0.06), matPolymer);
    grip.position.set(0, -0.09, 0.08);
    grip.rotation.x = -0.28;
    group.add(grip);

    // Coronha retrátil de aço
    const stockBars = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.18), matReceiver);
    stockBars.position.set(0, 0.01, 0.22);
    group.add(stockBars);

    // Massa de mira circular com dioptro
    const sightRing = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.003, 8, 16), matSteel);
    sightRing.position.set(0, 0.055, -0.24);
    group.add(sightRing);

    const muzzlePoint = new THREE.Object3D();
    muzzlePoint.position.set(0, 0.015, -0.40);
    group.add(muzzlePoint);

    return { group, muzzlePoint, color: 0xffaa22 };
  }

  // --- 3. ESCOPETA 12 GAUGE TÁTICA (REMINGTON 870) ---
  _buildShotgunModel() {
    const group = new THREE.Group();

    const matReceiver = new THREE.MeshStandardMaterial({ color: 0x22262e, metalness: 0.85, roughness: 0.3 });
    const matPolymer = new THREE.MeshStandardMaterial({ color: 0x13161a, metalness: 0.15, roughness: 0.85 });
    const matBarrelSteel = new THREE.MeshStandardMaterial({ color: 0x0d0f12, metalness: 0.95, roughness: 0.15 });

    // Receptor maciço de aço
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.095, 0.40), matReceiver);
    group.add(body);

    // Cano Pesado 12 Gauge
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.48, 16), matBarrelSteel);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.025, -0.42);
    group.add(barrel);

    // Tubo de cartuchos inferior
    const magTube = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.42, 16), matBarrelSteel);
    magTube.rotation.x = Math.PI / 2;
    magTube.position.set(0, -0.018, -0.39);
    group.add(magTube);

    // Telha / Bomba de recarga com ranhuras táteis (Pump Forend)
    const pump = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.20, 16), matPolymer);
    pump.rotation.x = Math.PI / 2;
    pump.position.set(0, -0.015, -0.32);
    group.add(pump);

    // Escudo térmico perfurado sobre o cano (Heat Shield)
    const heatShield = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.28, 12, 1, true), matReceiver);
    heatShield.rotation.x = Math.PI / 2;
    heatShield.position.set(0, 0.025, -0.36);
    group.add(heatShield);

    // Empunhadura tática e coronha sintética
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.07), matPolymer);
    grip.position.set(0, -0.10, 0.12);
    grip.rotation.x = -0.35;
    group.add(grip);

    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.11, 0.28), matPolymer);
    stock.position.set(0, -0.02, 0.32);
    group.add(stock);

    const muzzlePoint = new THREE.Object3D();
    muzzlePoint.position.set(0, 0.025, -0.67);
    group.add(muzzlePoint);

    return { group, muzzlePoint, color: 0xff9922 };
  }

  // --- 4. M24 SNIPER TÁTICA MILITAR (ALTA PRECISÃO) ---
  _buildM24SniperModel() {
    const group = new THREE.Group();

    const matChassisOD = new THREE.MeshStandardMaterial({ color: 0x3d4a37, metalness: 0.2, roughness: 0.8 }); // OD Green
    const matActionSteel = new THREE.MeshStandardMaterial({ color: 0x16191f, metalness: 0.9, roughness: 0.25 });
    const matScopeBody = new THREE.MeshStandardMaterial({ color: 0x111317, metalness: 0.75, roughness: 0.35 });
    const matGlass = new THREE.MeshBasicMaterial({ color: 0x1e293b });

    // Coronha/Chassis inteiriço em polímero militar OD Green
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.085, 0.75), matChassisOD);
    stock.position.set(0, -0.02, 0.05);
    group.add(stock);

    // Descanso de bochecha ajustável (Cheek Rest)
    const cheekRest = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.04, 0.18), matChassisOD);
    cheekRest.position.set(0, 0.04, 0.32);
    group.add(cheekRest);

    // Ação do ferrolho e câmara
    const action = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, 0.25), matActionSteel);
    action.position.set(0, 0.03, -0.05);
    group.add(action);

    // Alavanca do ferrolho tático
    const boltHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.06, 8), matActionSteel);
    boltHandle.position.set(0.045, 0.04, 0.02);
    boltHandle.rotation.z = 0.6;
    group.add(boltHandle);

    // Cano pesado flutuante (Heavy Match Barrel)
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.016, 0.70, 16), matActionSteel);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.03, -0.58);
    group.add(barrel);

    // Freio de boca militar duplo (Muzzle Brake)
    const brake = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.035, 0.08), matActionSteel);
    brake.position.set(0, 0.03, -0.94);
    group.add(brake);

    // Luneta Militar de Longo Alcance (Scope)
    const scopeTube = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.34, 16), matScopeBody);
    scopeTube.rotation.x = Math.PI / 2;
    scopeTube.position.set(0, 0.115, -0.05);
    group.add(scopeTube);

    // Lentes e torretes de ajuste
    const scopeBell = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.026, 0.08, 16), matScopeBody);
    scopeBell.rotation.x = Math.PI / 2;
    scopeBell.position.set(0, 0.115, -0.22);
    group.add(scopeBell);

    const turretTop = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.02, 12), matActionSteel);
    turretTop.position.set(0, 0.15, -0.05);
    group.add(turretTop);

    // Bipé tático dobrado (Bipod)
    const bipodL = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.22, 8), matActionSteel);
    bipodL.position.set(-0.028, -0.04, -0.48);
    bipodL.rotation.x = 0.2;
    group.add(bipodL);

    const bipodR = bipodL.clone();
    bipodR.position.x = 0.028;
    group.add(bipodR);

    const muzzlePoint = new THREE.Object3D();
    muzzlePoint.position.set(0, 0.03, -0.98);
    group.add(muzzlePoint);

    return { group, muzzlePoint, color: 0xffaa22 };
  }

  _createMuzzleFlash() {
    const flashGeo = new THREE.OctahedronGeometry(0.09, 0);
    this.flashMat = new THREE.MeshBasicMaterial({
      color: 0xfff0a0,
      transparent: true,
      opacity: 0
    });
    this.muzzleFlashMesh = new THREE.Mesh(flashGeo, this.flashMat);
    this.viewmodelGroup.add(this.muzzleFlashMesh);

    this.muzzleLight = new THREE.PointLight(0xff9922, 0, 8);
    this.viewmodelGroup.add(this.muzzleLight);
  }

  showWeaponModel(weaponKey) {
    this.currentWeaponKey = weaponKey;
    Object.keys(this.weaponModels).forEach(key => {
      const model = this.weaponModels[key];
      model.group.visible = (key === weaponKey);
    });

    const active = this.weaponModels[weaponKey];
    if (active) {
      this.activeMuzzlePoint = active.muzzlePoint;
      this.muzzleFlashMesh.position.copy(active.muzzlePoint.position);
      this.muzzleLight.position.copy(active.muzzlePoint.position);
    }
  }

  startWeaponSwitch(newWeaponKey) {
    if (this.isSwitching || this.currentWeaponKey === newWeaponKey) return;
    this.isSwitching = true;
    this.switchProgress = 0;
    this.nextWeaponKey = newWeaponKey;
  }

  triggerMuzzleFlash() {
    this.flashMat.opacity = 0.95;
    this.muzzleFlashMesh.rotation.z = Math.random() * Math.PI;
    this.muzzleFlashMesh.scale.set(
      0.8 + Math.random() * 0.4,
      0.8 + Math.random() * 0.4,
      1.4 + Math.random() * 0.5
    );
    this.muzzleLight.intensity = 4.0;

    setTimeout(() => {
      if (this.flashMat) this.flashMat.opacity = 0;
      if (this.muzzleLight) this.muzzleLight.intensity = 0;
    }, 45);
  }

  triggerRecoil(kick = { x: 0.01, y: 0.028, z: 0.075 }) {
    this.recoilOffset.z += kick.z;
    this.recoilOffset.y += kick.y * 0.4;
    this.recoilOffset.x += (Math.random() - 0.5) * kick.x;

    this.recoilRotation.x += kick.y * 2.2;
    this.recoilRotation.y += (Math.random() - 0.5) * kick.x * 2.0;
    this.recoilRotation.z += (Math.random() - 0.5) * kick.x * 1.5;
  }

  startReload(duration = 1.8) {
    if (this.isReloading) return;
    this.isReloading = true;
    this.reloadProgress = 0;
    this.reloadDuration = duration;
  }

  setADS(isAiming) {
    this.isAiming = isAiming;
  }

  getMuzzleWorldPosition() {
    if (this.activeMuzzlePoint) {
      const worldPos = new THREE.Vector3();
      this.activeMuzzlePoint.getWorldPosition(worldPos);
      return worldPos;
    }
    const worldPos = new THREE.Vector3();
    this.camera.getWorldPosition(worldPos);
    return worldPos;
  }

  update(deltaTime, mouseDelta = { deltaX: 0, deltaY: 0 }, isMoving = false, isSprinting = false) {
    // 1. Recuperação de Recuo
    this.recoilOffset.lerp(new THREE.Vector3(0, 0, 0), deltaTime * 16);
    this.recoilRotation.x = THREE.MathUtils.lerp(this.recoilRotation.x, 0, deltaTime * 16);
    this.recoilRotation.y = THREE.MathUtils.lerp(this.recoilRotation.y, 0, deltaTime * 16);
    this.recoilRotation.z = THREE.MathUtils.lerp(this.recoilRotation.z, 0, deltaTime * 16);

    // 2. Interpolação de ADS Militar
    const targetAimProgress = this.isAiming ? 1.0 : 0.0;
    this.aimProgress = THREE.MathUtils.lerp(this.aimProgress, targetAimProgress, deltaTime * 14);
    this.currentRestPosition.lerpVectors(this.hipPosition, this.adsPosition, this.aimProgress);

    // 3. Balanço com o mouse (Sway)
    const swayMultiplier = 1.0 - this.aimProgress * 0.75;
    const targetSwayX = -mouseDelta.deltaX * 0.012 * swayMultiplier;
    const targetSwayY = mouseDelta.deltaY * 0.012 * swayMultiplier;
    this.swayOffset.x = THREE.MathUtils.lerp(this.swayOffset.x, targetSwayX, deltaTime * 10);
    this.swayOffset.y = THREE.MathUtils.lerp(this.swayOffset.y, targetSwayY, deltaTime * 10);

    // 4. Bobbing ao andar
    const bobSpeed = isSprinting ? 14 : (isMoving ? 9 : 2);
    const bobAmount = (isSprinting ? 0.026 : (isMoving ? 0.012 : 0.003)) * (1.0 - this.aimProgress * 0.85);
    this.bobTime += deltaTime * bobSpeed;

    const bobX = Math.cos(this.bobTime * 0.5) * bobAmount * 0.8;
    const bobY = Math.sin(this.bobTime) * bobAmount;

    // 5. Troca de Armas
    let switchOffsetY = 0;
    if (this.isSwitching) {
      this.switchProgress += deltaTime / this.switchDuration;
      if (this.switchProgress < 0.5) {
        switchOffsetY = -Math.sin(this.switchProgress * Math.PI) * 0.4;
      } else {
        if (this.nextWeaponKey && this.currentWeaponKey !== this.nextWeaponKey) {
          this.showWeaponModel(this.nextWeaponKey);
          this.nextWeaponKey = null;
        }
        switchOffsetY = -Math.sin(this.switchProgress * Math.PI) * 0.4;
      }

      if (this.switchProgress >= 1.0) {
        this.isSwitching = false;
        this.switchProgress = 0;
      }
    }

    // 6. Recarga
    let reloadOffsetY = 0;
    let reloadRotZ = 0;
    let reloadRotX = 0;

    if (this.isReloading) {
      this.reloadProgress += deltaTime / this.reloadDuration;
      if (this.reloadProgress >= 1.0) {
        this.isReloading = false;
        this.reloadProgress = 0;
      } else {
        const phase = Math.sin(this.reloadProgress * Math.PI);
        reloadOffsetY = -phase * 0.22;
        reloadRotZ = phase * 0.45;
        reloadRotX = -phase * 0.25;
      }
    }

    // 7. Posição e Rotação Finais
    this.viewmodelGroup.position.set(
      this.currentRestPosition.x + this.recoilOffset.x + this.swayOffset.x + bobX,
      this.currentRestPosition.y + this.recoilOffset.y + this.swayOffset.y + bobY + reloadOffsetY + switchOffsetY,
      this.currentRestPosition.z + this.recoilOffset.z
    );

    this.viewmodelGroup.rotation.set(
      this.baseRotation.x + this.recoilRotation.x + reloadRotX,
      this.baseRotation.y + this.recoilRotation.y + this.swayOffset.x * 1.5,
      this.baseRotation.z + this.recoilRotation.z + reloadRotZ + bobX * 0.5
    );
  }
}
