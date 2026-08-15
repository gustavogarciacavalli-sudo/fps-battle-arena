import * as THREE from 'three';

export class RemotePlayer {
  constructor(scene, data) {
    this.scene = scene;
    this.id = data.id;
    this.name = data.name || 'Operador';
    this.color = data.color || '#38bdf8';
    this.camo = data.camo || 'black';
    this.maxHealth = data.maxHealth || 100;
    this.health = data.health || 100;
    this.isDead = !!data.isDead;

    this.group = new THREE.Group();
    this.group.position.set(data.position.x, data.position.y - 1.65, data.position.z);

    // Variáveis de Interpolação (Lerp)
    this.targetPosition = new THREE.Vector3(data.position.x, data.position.y - 1.65, data.position.z);
    this.targetYaw = (data.rotation && data.rotation.yaw) || 0;
    this.targetPitch = (data.rotation && data.rotation.pitch) || 0;

    this.hitMeshes = [];
    this.currentWeaponKey = data.weapon || 'm4a1';
    this.weaponMeshes = {};

    this._initMaterials();
    this._buildOperatorModel();
    this._createTacticalNameplate();

    this.scene.add(this.group);
  }

  _initMaterials() {
    // Camuflagem e uniforme tático
    const camoColors = {
      black: 0x181e26,
      olive: 0x33402e,
      tan: 0x7c6346,
      navy: 0x1a2638
    };

    const uniformColor = camoColors[this.camo] || 0x181e26;

    this.matUniform = new THREE.MeshStandardMaterial({
      color: uniformColor,
      roughness: 0.85,
      metalness: 0.1
    });

    this.matVest = new THREE.MeshStandardMaterial({
      color: 0x0f131a, // Colete preto tático
      roughness: 0.7,
      metalness: 0.2
    });

    this.matHelmet = new THREE.MeshStandardMaterial({
      color: uniformColor,
      roughness: 0.5,
      metalness: 0.4
    });

    this.matGoggles = new THREE.MeshStandardMaterial({
      color: 0x0a0c10,
      roughness: 0.1,
      metalness: 0.9
    });

    this.matSkin = new THREE.MeshStandardMaterial({
      color: 0xc8987b,
      roughness: 0.7,
      metalness: 0.1
    });

    this.matArmband = new THREE.MeshBasicMaterial({
      color: this.color
    });

    this.matFlash = new THREE.MeshBasicMaterial({ color: 0xffffff });
  }

  _buildOperatorModel() {
    // 1. Pernas com Coturnos Militares
    const legGeo = new THREE.BoxGeometry(0.22, 0.75, 0.24);
    this.leftLeg = new THREE.Mesh(legGeo, this.matUniform);
    this.leftLeg.position.set(-0.16, 0.38, 0);
    this.leftLeg.castShadow = true;
    this.group.add(this.leftLeg);

    this.rightLeg = new THREE.Mesh(legGeo, this.matUniform);
    this.rightLeg.position.set(0.16, 0.38, 0);
    this.rightLeg.castShadow = true;
    this.group.add(this.rightLeg);

    // Joelheiras de Proteção
    const padGeo = new THREE.BoxGeometry(0.18, 0.14, 0.08);
    const padL = new THREE.Mesh(padGeo, this.matVest);
    padL.position.set(-0.16, 0.38, 0.12);
    this.group.add(padL);
    const padR = new THREE.Mesh(padGeo, this.matVest);
    padR.position.set(0.16, 0.38, 0.12);
    this.group.add(padR);

    // 2. Tronco e Colete Tático (Plate Carrier) - Hitbox de Corpo
    const torsoGeo = new THREE.BoxGeometry(0.65, 0.7, 0.36);
    this.torsoMesh = new THREE.Mesh(torsoGeo, this.matUniform);
    this.torsoMesh.position.y = 1.1;
    this.torsoMesh.castShadow = true;
    this.torsoMesh.receiveShadow = true;
    this.torsoMesh.userData = { isRemotePlayer: true, isHead: false, playerId: this.id, target: this };
    this.group.add(this.torsoMesh);
    this.hitMeshes.push(this.torsoMesh);

    // Colete Tático Balístico sobreposto
    const vestGeo = new THREE.BoxGeometry(0.68, 0.55, 0.40);
    const vest = new THREE.Mesh(vestGeo, this.matVest);
    vest.position.set(0, 1.15, 0);
    vest.castShadow = true;
    this.group.add(vest);

    // Bolsos de Carregadores no Colete (Mag Pouches)
    const pouchGeo = new THREE.BoxGeometry(0.14, 0.18, 0.08);
    for (let i = -1; i <= 1; i++) {
      const pouch = new THREE.Mesh(pouchGeo, this.matVest);
      pouch.position.set(i * 0.16, 1.02, 0.22);
      this.group.add(pouch);
    }

    // Braçadeira de Identificação de Esquadrão
    const armbandGeo = new THREE.BoxGeometry(0.18, 0.1, 0.18);
    const armband = new THREE.Mesh(armbandGeo, this.matArmband);
    armband.position.set(-0.42, 1.25, 0);
    this.group.add(armband);

    // 3. Braços Táticos em Posição de Disparo
    const armGeo = new THREE.BoxGeometry(0.16, 0.6, 0.16);
    this.leftArm = new THREE.Mesh(armGeo, this.matUniform);
    this.leftArm.position.set(-0.42, 1.1, 0.15);
    this.leftArm.rotation.x = -0.6;
    this.leftArm.castShadow = true;
    this.group.add(this.leftArm);

    this.rightArm = new THREE.Mesh(armGeo, this.matUniform);
    this.rightArm.position.set(0.42, 1.1, 0.15);
    this.rightArm.rotation.x = -0.6;
    this.rightArm.castShadow = true;
    this.group.add(this.rightArm);

    // 4. Cabeça e Capacete Balístico Militar FAST - Hitbox de Headshot
    const headGeo = new THREE.SphereGeometry(0.22, 16, 16);
    this.headMesh = new THREE.Mesh(headGeo, this.matSkin);
    this.headMesh.position.y = 1.68;
    this.headMesh.castShadow = true;
    this.headMesh.userData = { isRemotePlayer: true, isHead: true, playerId: this.id, target: this };
    this.group.add(this.headMesh);
    this.hitMeshes.push(this.headMesh);

    // Capacete FAST
    const helmetGeo = new THREE.SphereGeometry(0.24, 16, 16, 0, Math.PI * 2, 0, Math.PI / 1.7);
    const helmet = new THREE.Mesh(helmetGeo, this.matHelmet);
    helmet.position.set(0, 1.72, 0);
    this.group.add(helmet);

    // Óculos de Proteção Táticos (Combat Goggles)
    const goggleGeo = new THREE.BoxGeometry(0.28, 0.08, 0.12);
    const goggles = new THREE.Mesh(goggleGeo, this.matGoggles);
    goggles.position.set(0, 1.68, 0.16);
    this.group.add(goggles);

    // 5. Armas 3D Visíveis nas Mãos do Operador
    this._buildThirdPersonWeapons();
    this.setWeapon(this.currentWeaponKey);
  }

  _buildThirdPersonWeapons() {
    this.weaponAnchor = new THREE.Group();
    this.weaponAnchor.position.set(0.18, 1.05, 0.35);
    this.group.add(this.weaponAnchor);

    const matGun = new THREE.MeshStandardMaterial({ color: 0x111317, metalness: 0.9, roughness: 0.3 });

    // M4A1
    const m4Group = new THREE.Group();
    const m4Body = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, 0.55), matGun);
    m4Group.add(m4Body);
    this.weaponMeshes.m4a1 = m4Group;
    this.weaponAnchor.add(m4Group);

    // MP5
    const mp5Group = new THREE.Group();
    const mp5Body = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.40), matGun);
    mp5Group.add(mp5Body);
    this.weaponMeshes.mp5 = mp5Group;
    this.weaponAnchor.add(mp5Group);

    // Shotgun
    const shotGroup = new THREE.Group();
    const shotBody = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.09, 0.60), matGun);
    shotGroup.add(shotBody);
    this.weaponMeshes.shotgun = shotGroup;
    this.weaponAnchor.add(shotGroup);

    // Sniper
    const snipGroup = new THREE.Group();
    const snipBody = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, 0.85), matGun);
    snipGroup.add(snipBody);
    this.weaponMeshes.sniper = snipGroup;
    this.weaponAnchor.add(snipGroup);
  }

  setWeapon(weaponKey) {
    this.currentWeaponKey = weaponKey;
    Object.keys(this.weaponMeshes).forEach(k => {
      this.weaponMeshes[k].visible = (k === weaponKey);
    });
  }

  _createTacticalNameplate() {
    this.nameplateCanvas = document.createElement('canvas');
    this.nameplateCanvas.width = 256;
    this.nameplateCanvas.height = 64;
    this.nameplateCtx = this.nameplateCanvas.getContext('2d');

    this.nameplateTexture = new THREE.CanvasTexture(this.nameplateCanvas);
    const spriteMat = new THREE.SpriteMaterial({
      map: this.nameplateTexture,
      transparent: true,
      depthTest: false
    });

    this.nameplateSprite = new THREE.Sprite(spriteMat);
    this.nameplateSprite.position.set(0, 2.25, 0);
    this.nameplateSprite.scale.set(1.4, 0.35, 1);
    this.group.add(this.nameplateSprite);

    this._updateNameplate();
  }

  _updateNameplate() {
    const ctx = this.nameplateCtx;
    const w = 256;
    const h = 64;

    ctx.clearRect(0, 0, w, h);

    // Fundo Militar Escuro
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.roundRect(0, 0, w, h, 6);
    ctx.fill();

    // Borda na cor do esquadrão
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Nome do Operador
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(this.name.toUpperCase(), w / 2, 22);

    // Barra de Vida Militar
    const healthPct = Math.max(0, this.health / this.maxHealth);
    const barWidth = (w - 16) * healthPct;

    if (healthPct > 0.5) ctx.fillStyle = '#22c55e';
    else if (healthPct > 0.25) ctx.fillStyle = '#eab308';
    else ctx.fillStyle = '#ef4444';

    ctx.fillRect(8, 34, barWidth, 18);

    // Texto de HP numérico
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px monospace';
    ctx.fillText(`${Math.round(this.health)} HP`, w / 2, 48);

    this.nameplateTexture.needsUpdate = true;
  }

  updateState(data) {
    if (data.position) {
      this.targetPosition.set(data.position.x, data.position.y - 1.65, data.position.z);
    }
    if (data.rotation) {
      this.targetYaw = data.rotation.yaw;
      this.targetPitch = data.rotation.pitch;
    }
    if (data.weapon && data.weapon !== this.currentWeaponKey) {
      this.setWeapon(data.weapon);
    }
    if (data.health !== undefined && data.health !== this.health) {
      this.health = data.health;
      this._updateNameplate();
    }
    if (data.isDead !== undefined && data.isDead !== this.isDead) {
      this.isDead = data.isDead;
      this.group.visible = !this.isDead;
    }
  }

  playDamageFlash() {
    const origBody = this.torsoMesh.material;
    const origHead = this.headMesh.material;
    this.torsoMesh.material = this.matFlash;
    this.headMesh.material = this.matFlash;

    setTimeout(() => {
      this.torsoMesh.material = origBody;
      this.headMesh.material = origHead;
    }, 60);
  }

  update(deltaTime) {
    if (this.isDead) {
      this.group.visible = false;
      return;
    }
    this.group.visible = true;

    // Interpolação suave de posição e rotação (Lerp a 60 FPS)
    this.group.position.lerp(this.targetPosition, deltaTime * 18);
    this.group.rotation.y = THREE.MathUtils.lerp(this.group.rotation.y, this.targetYaw, deltaTime * 18);
  }

  destroy() {
    this.scene.remove(this.group);
    this.nameplateTexture.dispose();
  }
}
