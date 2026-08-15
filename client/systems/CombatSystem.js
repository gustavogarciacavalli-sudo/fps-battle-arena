import * as THREE from 'three';
import { WEAPONS_CONFIG, WEAPON_SLOTS } from '../config/weapons.config.js';

export class CombatSystem {
  constructor(scene, camera, weaponSystem, audioSystem, hudSystem, networkManager, playerManager, profileManager) {
    this.scene = scene;
    this.camera = camera;
    this.weaponSystem = weaponSystem;
    this.audioSystem = audioSystem;
    this.hudSystem = hudSystem;
    this.networkManager = networkManager;
    this.playerManager = playerManager;
    this.profileManager = profileManager;

    this.currentWeaponIndex = 0;
    this.currentWeaponKey = WEAPON_SLOTS[0];
    this.weaponConfig = WEAPONS_CONFIG[this.currentWeaponKey];

    // Inventário de munição por arma
    this.ammoInventory = {};
    Object.keys(WEAPONS_CONFIG).forEach(key => {
      const cfg = WEAPONS_CONFIG[key];
      this.ammoInventory[key] = {
        inMag: cfg.magazineSize,
        reserve: cfg.maxReserveAmmo
      };
    });

    this.lastShotTime = 0;
    this.isReloading = false;
    this.reloadEndTime = 0;

    this.isAiming = false;
    this.baseFov = 75;
    this.currentFov = 75;

    this.raycaster = new THREE.Raycaster();

    // Efeitos visuais
    this.tracers = [];
    this.particles = [];
    this.floatingTexts = [];
    this.shellCasings = [];

    // Materiais reutilizáveis para cápsulas 3D de latão militar
    this.shellMat = new THREE.MeshStandardMaterial({
      color: 0xdfb14e,
      metalness: 0.92,
      roughness: 0.25
    });
    this.shellGeo = new THREE.CylinderGeometry(0.007, 0.007, 0.024, 8);

    this.targetDummies = [];
    this.arenaShootables = [];

    this._updateHUDAll();
  }

  setTargets(dummies, arenaShootables) {
    this.targetDummies = dummies;
    this.arenaShootables = arenaShootables;
  }

  selectWeapon(slotIndex) {
    if (slotIndex < 0 || slotIndex >= WEAPON_SLOTS.length) return;
    if (this.currentWeaponIndex === slotIndex && !this.isReloading) return;

    const newKey = WEAPON_SLOTS[slotIndex];
    this._executeWeaponSwitch(slotIndex, newKey);
  }

  cycleWeapon(direction) {
    let nextIndex = this.currentWeaponIndex + direction;
    if (nextIndex < 0) nextIndex = WEAPON_SLOTS.length - 1;
    if (nextIndex >= WEAPON_SLOTS.length) nextIndex = 0;

    this.selectWeapon(nextIndex);
  }

  _executeWeaponSwitch(newIndex, newKey) {
    if (this.isReloading) {
      this.isReloading = false;
      this.hudSystem.showReloading(false);
    }

    this.currentWeaponIndex = newIndex;
    this.currentWeaponKey = newKey;
    this.weaponConfig = WEAPONS_CONFIG[newKey];

    this.audioSystem.playWeaponSwitch();
    this.weaponSystem.startWeaponSwitch(newKey);

    this._updateHUDAll();
  }

  setAiming(isAiming, inputManager = null) {
    this.isAiming = isAiming;
    this.weaponSystem.setADS(isAiming);

    if (this.weaponConfig.hasZoom) {
      this.hudSystem.showSniperScope(isAiming);
      if (inputManager) inputManager.setSensitivityMultiplier(isAiming ? 0.32 : 1.0);
    } else {
      this.hudSystem.showSniperScope(false);
      if (inputManager) inputManager.setSensitivityMultiplier(isAiming ? 0.75 : 1.0);
    }
  }

  tryShoot(currentTime) {
    if (this.isReloading || this.weaponSystem.isSwitching) return false;

    if (currentTime - this.lastShotTime < this.weaponConfig.fireRate) {
      return false;
    }

    const currentAmmo = this.ammoInventory[this.currentWeaponKey];
    if (currentAmmo.inMag <= 0) {
      this.audioSystem.playEmptyClick();
      this.lastShotTime = currentTime;
      if (currentAmmo.reserve > 0) {
        this.reload(currentTime);
      }
      return false;
    }

    this.lastShotTime = currentTime;
    currentAmmo.inMag--;
    this._updateHUDAmmo();

    // Áudio e Efeitos Locais
    this.audioSystem.playGunshot(this.currentWeaponKey);
    this.weaponSystem.triggerMuzzleFlash();
    this.weaponSystem.triggerRecoil(this.weaponConfig.recoilKick);
    this.hudSystem.triggerCrosshairKick();

    // Ejeção física de cápsula de cartucho 3D
    this._spawnShellCasing();

    // Disparo por Raycasting
    const pelletCount = this.weaponConfig.pellets || 1;
    for (let i = 0; i < pelletCount; i++) {
      this._executeSingleRay(i);
    }

    return true;
  }

  _spawnShellCasing() {
    const muzzlePos = this.weaponSystem.getMuzzleWorldPosition();
    const right = new THREE.Vector3(1, 0, 0).applyEuler(this.camera.rotation);
    const up = new THREE.Vector3(0, 1, 0).applyEuler(this.camera.rotation);
    const forward = new THREE.Vector3(0, 0, -1).applyEuler(this.camera.rotation);

    const casing = new THREE.Mesh(this.shellGeo, this.shellMat);
    // Posição de ejeção ligeiramente atrás da boca da arma e à direita
    casing.position.copy(muzzlePos).addScaledVector(forward, -0.3).addScaledVector(right, 0.08);
    casing.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    this.scene.add(casing);

    // Velocidade de ejeção lateral para a direita e para cima
    const velocity = new THREE.Vector3()
      .addScaledVector(right, 1.8 + Math.random() * 0.8)
      .addScaledVector(up, 1.4 + Math.random() * 0.6)
      .addScaledVector(forward, -0.4 + (Math.random() - 0.5) * 0.4);

    const rotVelocity = new THREE.Vector3(
      (Math.random() - 0.5) * 25,
      (Math.random() - 0.5) * 25,
      (Math.random() - 0.5) * 25
    );

    this.shellCasings.push({
      mesh: casing,
      velocity,
      rotVelocity,
      lifetime: 0.9,
      age: 0
    });
  }

  _executeSingleRay(pelletIndex) {
    const spreadFactor = this.isAiming ? 0.35 : 1.0;
    const baseSpread = this.weaponConfig.spread * spreadFactor;

    let spreadX = (Math.random() - 0.5) * baseSpread;
    let spreadY = (Math.random() - 0.5) * baseSpread;

    if (this.weaponConfig.pellets > 1 && pelletIndex > 0) {
      const angle = (pelletIndex / this.weaponConfig.pellets) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const radius = Math.random() * baseSpread;
      spreadX = Math.cos(angle) * radius;
      spreadY = Math.sin(angle) * radius;
    }

    const screenCenter = new THREE.Vector2(spreadX, spreadY);
    this.raycaster.setFromCamera(screenCenter, this.camera);
    this.raycaster.far = this.weaponConfig.range;

    // Coleta objetos testáveis (Jogadores Remotos + Dummies + Arena)
    const testObjects = [];
    if (this.playerManager) {
      testObjects.push(...this.playerManager.getAllHitMeshes());
    }
    this.targetDummies.forEach(dummy => {
      if (!dummy.isDead) testObjects.push(...dummy.hitMeshes);
    });
    testObjects.push(...this.arenaShootables);

    const intersects = this.raycaster.intersectObjects(testObjects, false);
    const muzzlePos = this.weaponSystem.getMuzzleWorldPosition();
    let hitPoint = null;
    let hitNormal = null;
    let targetPlayerId = null;
    let isHeadshot = false;

    if (intersects.length > 0) {
      const hit = intersects[0];
      hitPoint = hit.point;
      hitNormal = hit.face ? hit.face.normal : new THREE.Vector3(0, 1, 0);

      // 1. Acerto em Outro Operador (Multiplayer)
      if (hit.object.userData && hit.object.userData.isRemotePlayer) {
        targetPlayerId = hit.object.userData.playerId;
        isHeadshot = !!hit.object.userData.isHead;

        if (pelletIndex === 0) {
          if (this.profileManager) this.profileManager.recordShot(true);
          if (isHeadshot) {
            this.audioSystem.playHeadshot();
            this.hudSystem.showHitmarker('headshot');
          } else {
            this.audioSystem.playHitmarker();
            this.hudSystem.showHitmarker('body');
          }
        }

        this._spawnImpactParticles(hitPoint, hitNormal, 0xff2222, 6);
      }
      // 2. Acerto em Manequim de Treino Local
      else if (hit.object.userData && hit.object.userData.isDummy) {
        const dummy = hit.object.userData.target;
        isHeadshot = !!hit.object.userData.isHead;
        let dmg = this.weaponConfig.damage;
        if (isHeadshot) dmg *= this.weaponConfig.headshotMultiplier;

        if (pelletIndex === 0 && this.profileManager) {
          this.profileManager.recordShot(true);
          this.profileManager.recordDamage(dmg);
        }

        dummy.takeDamage(dmg, isHeadshot, () => {
          this.audioSystem.playKillSound();
          if (this.profileManager) {
            this.profileManager.recordKill(isHeadshot);
          }
          this.hudSystem.showKillNotification(`🎯 ALVO ELIMINADO (+${isHeadshot ? 125 : 100} XP)`);
        });

        if (pelletIndex === 0) {
          if (isHeadshot) {
            this.audioSystem.playHeadshot();
            this.hudSystem.showHitmarker('headshot');
          } else {
            this.audioSystem.playHitmarker();
            this.hudSystem.showHitmarker('body');
          }
        }

        this._spawnFloatingDamage(hitPoint, dmg, isHeadshot);
        this._spawnImpactParticles(hitPoint, hitNormal, 0xff2222, 6);
      }
      // 3. Acerto em Estruturas da Arena (Concreto/Metal)
      else {
        if (pelletIndex === 0 && this.profileManager) {
          this.profileManager.recordShot(false);
        }
        this._spawnImpactParticles(hitPoint, hitNormal, 0xffbb44, 5);
      }
    } else {
      if (pelletIndex === 0 && this.profileManager) {
        this.profileManager.recordShot(false);
      }
      hitPoint = this.camera.position.clone().add(
        this.raycaster.ray.direction.clone().multiplyScalar(this.weaponConfig.range)
      );
    }

    // Traçante de bala balístico amarelo/alaranjado
    this._spawnTracer(muzzlePos, hitPoint, 0xffdd66);

    // Notifica o servidor autoritativo
    if (this.networkManager && pelletIndex === 0) {
      this.networkManager.sendShoot(
        this.currentWeaponKey,
        this.camera.position,
        this.raycaster.ray.direction,
        hitPoint,
        targetPlayerId,
        isHeadshot
      );
    }
  }

  // Renderiza tiro de outro jogador remoto
  handleRemotePlayerShot(data) {
    if (data.origin && data.hitPoint) {
      const start = new THREE.Vector3(data.origin.x, data.origin.y, data.origin.z);
      const end = new THREE.Vector3(data.hitPoint.x, data.hitPoint.y, data.hitPoint.z);
      this._spawnTracer(start, end, 0xffcc44);
      this._spawnImpactParticles(end, new THREE.Vector3(0, 1, 0), 0xffaa33, 4);
    }
    // Toca som de tiro do outro jogador
    this.audioSystem.playGunshot(data.weapon || 'm4a1');
  }

  reload(currentTime) {
    if (this.isReloading || this.weaponSystem.isSwitching) return;

    const currentAmmo = this.ammoInventory[this.currentWeaponKey];
    if (currentAmmo.inMag === this.weaponConfig.magazineSize) return;
    if (currentAmmo.reserve <= 0) return;

    this.isReloading = true;
    this.reloadEndTime = currentTime + this.weaponConfig.reloadTime;

    if (this.isAiming && this.weaponConfig.hasZoom) {
      this.hudSystem.showSniperScope(false);
    }

    this.audioSystem.playReload();
    this.weaponSystem.startReload(this.weaponConfig.reloadTime);
    this.hudSystem.showReloading(true, this.weaponConfig.reloadTime);
  }

  _finishReload() {
    const currentAmmo = this.ammoInventory[this.currentWeaponKey];
    const needed = this.weaponConfig.magazineSize - currentAmmo.inMag;
    const toLoad = Math.min(needed, currentAmmo.reserve);

    currentAmmo.inMag += toLoad;
    currentAmmo.reserve -= toLoad;
    this.isReloading = false;

    this._updateHUDAmmo();
    this.hudSystem.showReloading(false);

    if (this.isAiming && this.weaponConfig.hasZoom) {
      this.hudSystem.showSniperScope(true);
    }
  }

  _updateHUDAll() {
    this.hudSystem.setActiveWeaponSlot(this.currentWeaponIndex, this.weaponConfig);
    this._updateHUDAmmo();
  }

  _updateHUDAmmo() {
    const currentAmmo = this.ammoInventory[this.currentWeaponKey];
    this.hudSystem.updateAmmo(currentAmmo.inMag, currentAmmo.reserve, this.weaponConfig.magazineSize);
  }

  _spawnTracer(start, end, colorHex = 0xffdd66) {
    const material = new THREE.LineBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.95,
      linewidth: 2
    });

    const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
    const line = new THREE.Line(geometry, material);
    this.scene.add(line);

    this.tracers.push({
      mesh: line,
      lifetime: 0.06,
      age: 0
    });
  }

  _spawnImpactParticles(position, normal, colorHex, count = 5) {
    const geo = new THREE.BufferGeometry();
    const positions = [];
    const velocities = [];

    for (let i = 0; i < count; i++) {
      positions.push(position.x, position.y, position.z);
      const vx = (normal.x + (Math.random() - 0.5) * 1.5) * (2 + Math.random() * 4);
      const vy = (normal.y + (Math.random() - 0.5) * 1.5) * (2 + Math.random() * 4);
      const vz = (normal.z + (Math.random() - 0.5) * 1.5) * (2 + Math.random() * 4);
      velocities.push(new THREE.Vector3(vx, vy, vz));
    }

    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color: colorHex,
      size: 0.08,
      transparent: true,
      opacity: 1
    });

    const points = new THREE.Points(geo, mat);
    this.scene.add(points);

    this.particles.push({
      points,
      velocities,
      positions,
      lifetime: 0.22,
      age: 0
    });
  }

  _spawnFloatingDamage(position, amount, isHeadshot) {
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 80;
    const ctx = canvas.getContext('2d');

    ctx.font = isHeadshot ? 'bold 36px monospace' : 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = isHeadshot ? '#fbbf24' : '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 4;

    const text = isHeadshot ? `⚡${Math.round(amount)}` : `${Math.round(amount)}`;
    ctx.strokeText(text, 80, 40);
    ctx.fillText(text, 80, 40);

    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: 1,
      depthTest: false
    });

    const sprite = new THREE.Sprite(mat);
    sprite.position.set(
      position.x + (Math.random() - 0.5) * 0.3,
      position.y + 0.25,
      position.z + (Math.random() - 0.5) * 0.3
    );
    sprite.scale.set(0.7, 0.35, 1);
    this.scene.add(sprite);

    this.floatingTexts.push({
      sprite,
      velocity: new THREE.Vector3(0, 1.2, 0),
      lifetime: 0.65,
      age: 0
    });
  }

  spawnDamageNumberAt(position, amount, isHeadshot) {
    this._spawnFloatingDamage(position, amount, isHeadshot);
  }

  update(deltaTime, currentTime) {
    if (this.isReloading && currentTime >= this.reloadEndTime) {
      this._finishReload();
    }

    // Traçantes
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.age += deltaTime;
      t.mesh.material.opacity = 1 - (t.age / t.lifetime);
      if (t.age >= t.lifetime) {
        this.scene.remove(t.mesh);
        t.mesh.geometry.dispose();
        t.mesh.material.dispose();
        this.tracers.splice(i, 1);
      }
    }

    // Partículas
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += deltaTime;
      const progress = p.age / p.lifetime;

      const posAttr = p.points.geometry.attributes.position;
      for (let j = 0; j < p.velocities.length; j++) {
        p.positions[j * 3] += p.velocities[j].x * deltaTime;
        p.positions[j * 3 + 1] += (p.velocities[j].y - 9.8 * deltaTime) * deltaTime;
        p.positions[j * 3 + 2] += p.velocities[j].z * deltaTime;
      }
      posAttr.copyArray(p.positions);
      posAttr.needsUpdate = true;
      p.points.material.opacity = 1 - progress;

      if (p.age >= p.lifetime) {
        this.scene.remove(p.points);
        p.points.geometry.dispose();
        p.points.material.dispose();
        this.particles.splice(i, 1);
      }
    }

    // Textos de Dano
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.age += deltaTime;
      const progress = ft.age / ft.lifetime;

      ft.sprite.position.addScaledVector(ft.velocity, deltaTime);
      ft.sprite.material.opacity = 1 - Math.pow(progress, 2);

      if (ft.age >= ft.lifetime) {
        this.scene.remove(ft.sprite);
        ft.sprite.material.map.dispose();
        ft.sprite.material.dispose();
        this.floatingTexts.splice(i, 1);
      }
    }

    // Cápsulas de Cartuchos 3D (Física e Rotação)
    for (let i = this.shellCasings.length - 1; i >= 0; i--) {
      const c = this.shellCasings[i];
      c.age += deltaTime;

      // Gravidade
      c.velocity.y -= 16.0 * deltaTime;
      c.mesh.position.addScaledVector(c.velocity, deltaTime);

      // Rotação tridimensional
      c.mesh.rotation.x += c.rotVelocity.x * deltaTime;
      c.mesh.rotation.y += c.rotVelocity.y * deltaTime;
      c.mesh.rotation.z += c.rotVelocity.z * deltaTime;

      // Não afunda no chão (y = 0.02)
      if (c.mesh.position.y <= 0.02) {
        c.mesh.position.y = 0.02;
        c.velocity.set(0, 0, 0);
        c.rotVelocity.set(0, 0, 0);
      }

      if (c.age >= c.lifetime) {
        this.scene.remove(c.mesh);
        this.shellCasings.splice(i, 1);
      }
    }
  }
}
