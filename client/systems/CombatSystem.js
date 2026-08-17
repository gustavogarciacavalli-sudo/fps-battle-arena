import * as THREE from 'three';
import { WEAPONS_CONFIG, WEAPON_SLOTS } from '../config/weapons.config.js';
import { WEAPON_BALLISTICS } from '../config/weapons.ballistics.js';

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

    this.ballisticsSystem = null;

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

    // Disparo Balístico ou Hitscan
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
    casing.position.copy(muzzlePos).addScaledVector(forward, -0.3).addScaledVector(right, 0.08);
    casing.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    this.scene.add(casing);

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

  _getCombatObjects() {
    const objects = [];
    if (this.playerManager) {
      objects.push(...this.playerManager.getAllHitMeshes());
    }
    this.targetDummies.forEach(dummy => {
      if (!dummy.isDead) objects.push(...dummy.hitMeshes);
    });
    objects.push(...this.arenaShootables);
    return objects;
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

    const ballistics = WEAPON_BALLISTICS[this.currentWeaponKey];

    // Se for modo Projétil com Trajetória e Gravidade (Sniper)
    if (ballistics && ballistics.mode === 'projectile' && this.ballisticsSystem) {
      return this._fireProjectile(spreadX, spreadY, ballistics);
    }

    // Modo Hitscan instantâneo (M4A1, MP5, Shotgun)
    return this._fireHitscan(spreadX, spreadY, pelletIndex);
  }

  _fireHitscan(spreadX, spreadY, pelletIndex) {
    const screenCenter = new THREE.Vector2(spreadX, spreadY);
    this.raycaster.setFromCamera(screenCenter, this.camera);
    this.raycaster.far = this.weaponConfig.range;

    const testObjects = this._getCombatObjects();
    const intersects = this.raycaster.intersectObjects(testObjects, false);
    const muzzlePos = this.weaponSystem.getMuzzleWorldPosition();

    let hitPoint = null;
    let hitNormal = null;

    if (intersects.length > 0) {
      const hit = intersects[0];
      hitPoint = hit.point;
      hitNormal = hit.face ? hit.face.normal : new THREE.Vector3(0, 1, 0);
      this._processHit(hit, pelletIndex);
    } else {
      if (pelletIndex === 0 && this.profileManager) {
        this.profileManager.recordShot(false);
      }
      hitPoint = this.camera.position.clone().add(
        this.raycaster.ray.direction.clone().multiplyScalar(this.weaponConfig.range)
      );
    }

    // Traçante de bala balístico
    this._spawnTracer(muzzlePos, hitPoint, 0xffdd66);

    // Notifica o servidor autoritativo
    if (this.networkManager && pelletIndex === 0) {
      this.networkManager.sendShoot(
        this.currentWeaponKey,
        this.camera.position,
        this.raycaster.ray.direction,
        hitPoint,
        null,
        false
      );
    }
  }

  _fireProjectile(spreadX, spreadY, config) {
    const direction = new THREE.Vector3(spreadX, spreadY, -1);
    direction.unproject(this.camera).sub(this.camera.position).normalize();

    const origin = this.weaponSystem.getMuzzleWorldPosition();

    this.ballisticsSystem.createProjectile({
      origin,
      direction,
      speed: config.projectileSpeed,
      gravityScale: config.gravityScale,
      maxDistance: config.maxDistance,
      color: 0xffe0a1,
      targetObjects: this._getCombatObjects(),
      onHit: (hit) => {
        this._processHit(hit, 0);
      }
    });

    if (this.networkManager) {
      this.networkManager.sendShoot(
        this.currentWeaponKey,
        this.camera.position,
        direction,
        null,
        null,
        false
      );
    }
  }

  _processHit(hit, pelletIndex = 0) {
    const hitPoint = hit.point;
    const hitNormal = hit.face ? hit.face.normal : new THREE.Vector3(0, 1, 0);

    // 1. Acerto em Outro Operador (Multiplayer)
    if (hit.object.userData && hit.object.userData.isRemotePlayer) {
      const isHeadshot = !!hit.object.userData.isHead;
      const targetPlayerId = hit.object.userData.playerId;

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
    // 2. Acerto em Bot / Manequim Inimigo
    else if (hit.object.userData && hit.object.userData.isDummy) {
      const dummy = hit.object.userData.target;
      const isHeadshot = !!hit.object.userData.isHead;
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
        this.hudSystem.showKillNotification(`🎯 INIMIGO ELIMINADO (+${isHeadshot ? 125 : 100} XP)`);
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
    // 3. Acerto em Estruturas da Arena (Concreto, Areia, Metal)
    else {
      if (pelletIndex === 0 && this.profileManager) {
        this.profileManager.recordShot(false);
      }
      this._spawnImpactParticles(hitPoint, hitNormal, 0xffbb44, 5);
    }
  }

  handleRemotePlayerShot(data) {
    if (data.origin && data.hitPoint) {
      const start = new THREE.Vector3(data.origin.x, data.origin.y, data.origin.z);
      const end = new THREE.Vector3(data.hitPoint.x, data.hitPoint.y, data.hitPoint.z);
      this._spawnTracer(start, end, 0xffcc44);
      this._spawnImpactParticles(end, new THREE.Vector3(0, 1, 0), 0xffaa33, 4);
    }
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

  _spawnTracer(start, end, color = 0xffdd66) {
    const material = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.85
    });

    const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
    const line = new THREE.Line(geometry, material);
    this.scene.add(line);

    this.tracers.push({
      line,
      lifetime: 0.08,
      age: 0
    });
  }

  _spawnImpactParticles(position, normal, color = 0xffbb44, count = 5) {
    const group = new THREE.Group();
    group.position.copy(position);

    for (let i = 0; i < count; i++) {
      const particleGeo = new THREE.SphereGeometry(0.025, 4, 4);
      const particleMat = new THREE.MeshBasicMaterial({ color });
      const particle = new THREE.Mesh(particleGeo, particleMat);

      const vel = normal.clone().multiplyScalar(2 + Math.random() * 3);
      vel.x += (Math.random() - 0.5) * 4;
      vel.y += (Math.random() - 0.5) * 4;
      vel.z += (Math.random() - 0.5) * 4;

      particle.userData = { velocity: vel };
      group.add(particle);
    }

    this.scene.add(group);
    this.particles.push({
      group,
      lifetime: 0.25,
      age: 0
    });
  }

  _spawnFloatingDamage(worldPos, damage, isHeadshot) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = isHeadshot ? '#ef4444' : '#ffffff';
    ctx.font = isHeadshot ? 'bold 36px monospace' : 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.round(damage)}`, 64, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false
    });

    const sprite = new THREE.Sprite(spriteMat);
    sprite.position.copy(worldPos);
    sprite.position.y += 0.5;
    sprite.scale.set(0.8, 0.4, 1);
    this.scene.add(sprite);

    this.floatingTexts.push({
      sprite,
      texture,
      age: 0,
      lifetime: 0.6
    });
  }

  update(deltaTime, currentTime) {
    if (this.isReloading && currentTime >= this.reloadEndTime) {
      this._finishReload();
    }

    // 1. Atualiza Traçantes
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.age += deltaTime;
      t.line.material.opacity = 0.85 * (1 - t.age / t.lifetime);

      if (t.age >= t.lifetime) {
        this.scene.remove(t.line);
        t.line.geometry.dispose();
        t.line.material.dispose();
        this.tracers.splice(i, 1);
      }
    }

    // 2. Atualiza Partículas de Impacto
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += deltaTime;
      const progress = p.age / p.lifetime;

      p.group.children.forEach(mesh => {
        mesh.position.addScaledVector(mesh.userData.velocity, deltaTime);
        mesh.userData.velocity.y -= 9.8 * deltaTime;
        mesh.scale.setScalar(1 - progress);
      });

      if (p.age >= p.lifetime) {
        this.scene.remove(p.group);
        p.group.children.forEach(m => {
          m.geometry.dispose();
          m.material.dispose();
        });
        this.particles.splice(i, 1);
      }
    }

    // 3. Atualiza Ejeção de Cápsulas de Cartuchos 3D
    for (let i = this.shellCasings.length - 1; i >= 0; i--) {
      const c = this.shellCasings[i];
      c.age += deltaTime;

      c.mesh.position.addScaledVector(c.velocity, deltaTime);
      c.velocity.y -= 14.0 * deltaTime;

      c.mesh.rotation.x += c.rotVelocity.x * deltaTime;
      c.mesh.rotation.y += c.rotVelocity.y * deltaTime;
      c.mesh.rotation.z += c.rotVelocity.z * deltaTime;

      if (c.mesh.position.y <= 0.05) {
        c.mesh.position.y = 0.05;
        c.velocity.set(0, 0, 0);
        c.rotVelocity.set(0, 0, 0);
      }

      if (c.age >= c.lifetime) {
        this.scene.remove(c.mesh);
        c.mesh.geometry.dispose();
        this.shellCasings.splice(i, 1);
      }
    }

    // 4. Atualiza Textos Flutuantes de Dano
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.age += deltaTime;
      ft.sprite.position.y += deltaTime * 1.2;
      ft.sprite.material.opacity = 1 - ft.age / ft.lifetime;

      if (ft.age >= ft.lifetime) {
        this.scene.remove(ft.sprite);
        ft.texture.dispose();
        ft.sprite.material.dispose();
        this.floatingTexts.splice(i, 1);
      }
    }
  }
}
