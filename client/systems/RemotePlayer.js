import * as THREE from 'three';
import { CharacterRig } from './CharacterRig.js';

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
    this.group.position.set(data.position.x, data.position.y - 1.79, data.position.z);

    // Variáveis de Interpolação (Lerp)
    this.targetPosition = new THREE.Vector3(data.position.x, data.position.y - 1.79, data.position.z);
    this.prevPosition = this.group.position.clone();
    this.targetYaw = (data.rotation && data.rotation.yaw) || 0;
    this.targetPitch = (data.rotation && data.rotation.pitch) || 0;

    this.hitMeshes = [];
    this.currentWeaponKey = data.weapon || 'm4a1';
    this.weaponMeshes = {};

    this.isMoving = !!data.isMoving;
    this.isSprinting = !!data.isSprinting;

    this._initMaterials();
    this._buildOperatorModel();
    this._createTacticalNameplate();

    this.scene.add(this.group);
  }

  _initMaterials() {
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
      color: 0x0f131a,
      roughness: 0.7,
      metalness: 0.2
    });

    this.matHelmet = new THREE.MeshStandardMaterial({
      color: uniformColor,
      roughness: 0.5,
      metalness: 0.4
    });

    this.matSkin = new THREE.MeshStandardMaterial({
      color: 0xc8987b,
      roughness: 0.7,
      metalness: 0.1
    });

    this.matBoot = new THREE.MeshStandardMaterial({
      color: 0x121417,
      roughness: 0.92
    });

    this.matMetal = new THREE.MeshStandardMaterial({
      color: 0x45443f,
      metalness: 0.75,
      roughness: 0.4
    });

    this.matFlash = new THREE.MeshBasicMaterial({ color: 0xffffff });
  }

  _buildOperatorModel() {
    // 1. Esqueleto Procedural Hierárquico (CharacterRig)
    this.rig = new CharacterRig(this.group, {
      uniform: this.matUniform,
      vest: this.matVest,
      skin: this.matSkin,
      helmet: this.matHelmet,
      boot: this.matBoot,
      metal: this.matMetal
    });

    // 2. Hitboxes Invisíveis de Alta Precisão Balística
    const bodyHitbox = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.34, 0.55, 4, 8),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    bodyHitbox.position.y = 1.05;
    bodyHitbox.userData = {
      isRemotePlayer: true,
      isHead: false,
      playerId: this.id,
      target: this
    };
    this.group.add(bodyHitbox);
    this.hitMeshes.push(bodyHitbox);
    this.bodyHitbox = bodyHitbox;

    const headHitbox = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 12, 8),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    headHitbox.position.y = 1.75;
    headHitbox.userData = {
      isRemotePlayer: true,
      isHead: true,
      playerId: this.id,
      target: this
    };
    this.group.add(headHitbox);
    this.hitMeshes.push(headHitbox);
    this.headHitbox = headHitbox;

    // 3. Armas em Terceira Pessoa
    this._buildThirdPersonWeapons();
    this.setWeapon(this.currentWeaponKey);
  }

  _buildThirdPersonWeapons() {
    this.weaponAnchor = new THREE.Group();
    this.weaponAnchor.position.set(0.18, 0.92, 0.36);
    this.weaponAnchor.rotation.set(-0.15, -0.1, 0);
    this.group.add(this.weaponAnchor);

    const metal = new THREE.MeshStandardMaterial({
      color: 0x1a1c1d,
      metalness: 0.88,
      roughness: 0.28
    });

    const polymer = new THREE.MeshStandardMaterial({
      color: 0x111313,
      metalness: 0.08,
      roughness: 0.85
    });

    const brown = new THREE.MeshStandardMaterial({
      color: 0x4d3628,
      roughness: 0.9
    });

    // --- M4A1 ---
    const m4 = new THREE.Group();
    const m4Body = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.10, 0.42), metal);
    m4.add(m4Body);

    const m4Handguard = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.09, 0.28), metal);
    m4Handguard.position.z = -0.34;
    m4.add(m4Handguard);

    const m4Barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.32, 12), metal);
    m4Barrel.rotation.x = Math.PI / 2;
    m4Barrel.position.z = -0.62;
    m4.add(m4Barrel);

    const m4Grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.07), polymer);
    m4Grip.position.set(0, -0.13, 0.10);
    m4Grip.rotation.x = -0.3;
    m4.add(m4Grip);

    const m4Stock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.10, 0.20), polymer);
    m4Stock.position.z = 0.32;
    m4.add(m4Stock);

    this.weaponMeshes.m4a1 = m4;
    this.weaponAnchor.add(m4);

    // --- MP5 ---
    const mp5 = new THREE.Group();
    const mp5Body = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.10, 0.35), metal);
    mp5.add(mp5Body);

    const mp5Barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.18, 12), metal);
    mp5Barrel.rotation.x = Math.PI / 2;
    mp5Barrel.position.z = -0.28;
    mp5.add(mp5Barrel);

    const mp5Mag = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.18, 0.06), metal);
    mp5Mag.position.set(0, -0.12, -0.02);
    mp5Mag.rotation.x = 0.25;
    mp5.add(mp5Mag);

    this.weaponMeshes.mp5 = mp5;
    this.weaponAnchor.add(mp5);

    // --- SHOTGUN ---
    const shotgun = new THREE.Group();
    const shotBody = new THREE.BoxGeometry(0.075, 0.10, 0.38);
    shotgun.add(new THREE.Mesh(shotBody, metal));

    const shotBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.48, 14), metal);
    shotBarrel.rotation.x = Math.PI / 2;
    shotBarrel.position.z = -0.42;
    shotgun.add(shotBarrel);

    const pump = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.07, 0.18), polymer);
    pump.position.set(0, -0.02, -0.27);
    shotgun.add(pump);

    const woodStock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.11, 0.27), brown);
    woodStock.position.z = 0.30;
    shotgun.add(woodStock);

    this.weaponMeshes.shotgun = shotgun;
    this.weaponAnchor.add(shotgun);

    // --- SNIPER ---
    const sniper = new THREE.Group();
    const sniperBody = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.10, 0.65), polymer);
    sniper.add(sniperBody);

    const sniperBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.015, 0.48, 14), metal);
    sniperBarrel.rotation.x = Math.PI / 2;
    sniperBarrel.position.z = -0.55;
    sniper.add(sniperBarrel);

    const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.32, 16), metal);
    scope.rotation.x = Math.PI / 2;
    scope.position.set(0, 0.09, -0.12);
    sniper.add(scope);

    const scopeFront = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.05, 16), metal);
    scopeFront.rotation.x = Math.PI / 2;
    scopeFront.position.z = -0.29;
    scopeFront.position.y = 0.09;
    sniper.add(scopeFront);

    this.weaponMeshes.sniper = sniper;
    this.weaponAnchor.add(sniper);

    Object.values(this.weaponMeshes).forEach(weapon => {
      weapon.visible = false;
    });
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
    this.nameplateSprite.position.set(0, 2.35, 0);
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
      this.targetPosition.set(data.position.x, data.position.y - 1.79, data.position.z);
    }
    if (data.rotation) {
      this.targetYaw = data.rotation.yaw;
      this.targetPitch = data.rotation.pitch;
    }
    if (data.isMoving !== undefined) {
      this.isMoving = !!data.isMoving;
    }
    if (data.isSprinting !== undefined) {
      this.isSprinting = !!data.isSprinting;
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
    if (this.rig && this.rig.torsoMesh && this.rig.headMesh) {
      const origBody = this.rig.torsoMesh.material;
      const origHead = this.rig.headMesh.material;
      this.rig.torsoMesh.material = this.matFlash;
      this.rig.headMesh.material = this.matFlash;

      setTimeout(() => {
        if (this.rig.torsoMesh) this.rig.torsoMesh.material = origBody;
        if (this.rig.headMesh) this.rig.headMesh.material = origHead;
      }, 60);
    }
  }

  update(deltaTime) {
    if (this.isDead) {
      this.group.visible = false;
      return;
    }
    this.group.visible = true;

    // 1. Interpolação suave exponencial de posição
    this.group.position.lerp(
      this.targetPosition,
      1 - Math.exp(-14 * deltaTime)
    );

    // 2. Interpolação suave de rotação angular com menor caminho (Shortest Angular Delta)
    let yawDelta = this.targetYaw - this.group.rotation.y;
    yawDelta = Math.atan2(Math.sin(yawDelta), Math.cos(yawDelta));
    this.group.rotation.y += yawDelta * (1 - Math.exp(-15 * deltaTime));

    // 3. Cálculo de deslocamento e estados
    const displacement = this.group.position.distanceTo(this.prevPosition);
    const isActuallyMoving = this.isMoving || displacement > deltaTime * 0.5;
    const isActuallySprinting = this.isSprinting || (isActuallyMoving && displacement > deltaTime * 5.0);

    // 4. Animação de Esqueleto Procedural no Rig
    if (this.rig) {
      this.rig.update(deltaTime, {
        moving: isActuallyMoving,
        sprinting: isActuallySprinting,
        aiming: false,
        grounded: true,
        verticalVelocity: 0,
        turn: yawDelta
      });
    }

    this.prevPosition.copy(this.group.position);
  }

  destroy() {
    this.scene.remove(this.group);
    this.nameplateTexture.dispose();
  }
}
