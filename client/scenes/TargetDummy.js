import * as THREE from 'three';
import { CharacterRig } from '../systems/CharacterRig.js';
import { BotAI } from '../systems/BotAI.js';

export class TargetDummy {
  constructor(scene, position = new THREE.Vector3(0, 0, -10)) {
    this.scene = scene;
    this.initialPosition = position.clone();
    this.maxHp = 100;
    this.currentHp = this.maxHp;
    this.isDead = false;
    this.respawnTimer = 0;
    this.respawnDuration = 4.0;

    this.isBot = true;
    this.isMoving = false;
    this.isSprinting = false;

    this.group = new THREE.Group();
    this.group.position.copy(this.initialPosition);

    this.hitMeshes = [];
    this.onBotAttack = null;
    this.getVisibilityObjects = null;

    this._initMaterials();
    this._buildModel();
    this._createHealthBar();

    // Inteligência Artificial Tática
    this.botAI = new BotAI(this);

    this.scene.add(this.group);
  }

  _initMaterials() {
    this.matUniform = new THREE.MeshStandardMaterial({
      color: 0x475569, // Cinza urbano tático
      roughness: 0.85,
      metalness: 0.1
    });

    this.matVest = new THREE.MeshStandardMaterial({
      color: 0x0f172a, // Colete escuro
      roughness: 0.7,
      metalness: 0.2
    });

    this.matHelmet = new THREE.MeshStandardMaterial({
      color: 0xef4444, // Capacete vermelho para identificação de alvo
      roughness: 0.45,
      metalness: 0.3
    });

    this.matSkin = new THREE.MeshStandardMaterial({
      color: 0xc8987b,
      roughness: 0.8,
      metalness: 0.1
    });

    this.matBoot = new THREE.MeshStandardMaterial({
      color: 0x111317,
      roughness: 0.9
    });

    this.matMetal = new THREE.MeshStandardMaterial({
      color: 0x22262d,
      metalness: 0.8,
      roughness: 0.3
    });

    this.matFlash = new THREE.MeshBasicMaterial({ color: 0xffffff });
  }

  _buildModel() {
    // 1. Rig Procedural do Operador Bot
    this.rig = new CharacterRig(this.group, {
      uniform: this.matUniform,
      vest: this.matVest,
      skin: this.matSkin,
      helmet: this.matHelmet,
      boot: this.matBoot,
      metal: this.matMetal
    });

    // 2. Hitbox Invisível de Corpo (Capsule)
    const bodyHitbox = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.34, 0.55, 4, 8),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    bodyHitbox.position.y = 1.05;
    bodyHitbox.userData = { isDummy: true, isHead: false, target: this };
    this.group.add(bodyHitbox);
    this.hitMeshes.push(bodyHitbox);
    this.torsoMesh = bodyHitbox;

    // 3. Hitbox Invisível de Cabeça (Sphere - Headshot Target)
    const headHitbox = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 12, 8),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    headHitbox.position.y = 1.75;
    headHitbox.userData = { isDummy: true, isHead: true, target: this };
    this.group.add(headHitbox);
    this.hitMeshes.push(headHitbox);
    this.headMesh = headHitbox;

    // 4. Arma 3D na mão do Bot
    const gunGroup = new THREE.Group();
    const gunBody = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, 0.42), this.matMetal);
    gunGroup.add(gunBody);

    const gunBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.28, 8), this.matMetal);
    gunBarrel.rotation.x = Math.PI / 2;
    gunBarrel.position.z = -0.32;
    gunGroup.add(gunBarrel);

    gunGroup.position.set(0.18, 0.92, 0.35);
    gunGroup.rotation.set(-0.15, -0.1, 0);
    this.group.add(gunGroup);
    this.gunMesh = gunGroup;
  }

  _createHealthBar() {
    this.healthCanvas = document.createElement('canvas');
    this.healthCanvas.width = 256;
    this.healthCanvas.height = 48;
    this.healthCtx = this.healthCanvas.getContext('2d');

    this.healthTexture = new THREE.CanvasTexture(this.healthCanvas);
    const spriteMat = new THREE.SpriteMaterial({
      map: this.healthTexture,
      transparent: true,
      depthTest: false
    });

    this.healthSprite = new THREE.Sprite(spriteMat);
    this.healthSprite.position.set(0, 2.35, 0);
    this.healthSprite.scale.set(1.4, 0.28, 1);
    this.group.add(this.healthSprite);

    this._updateHealthCanvas();
  }

  _updateHealthCanvas() {
    const ctx = this.healthCtx;
    const w = 256;
    const h = 48;

    ctx.clearRect(0, 0, w, h);

    // Fundo
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.roundRect(0, 0, w, h, 8);
    ctx.fill();

    // Borda
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Barra de Vida
    const healthPercent = Math.max(0, this.currentHp / this.maxHp);
    const barWidth = (w - 12) * healthPercent;

    if (healthPercent > 0.5) {
      ctx.fillStyle = '#22c55e';
    } else if (healthPercent > 0.25) {
      ctx.fillStyle = '#eab308';
    } else {
      ctx.fillStyle = '#ef4444';
    }

    ctx.fillRect(6, 6, barWidth, h - 12);

    // Texto de HP
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`BOT INIMIGO - ${Math.round(this.currentHp)} HP`, w / 2, h / 2);

    this.healthTexture.needsUpdate = true;
  }

  takeDamage(amount, isHeadshot, onKillCallback) {
    if (this.isDead) return;

    this.currentHp = Math.max(0, this.currentHp - amount);
    this._updateHealthCanvas();

    // Flash ao ser atingido
    this._triggerHitFlash();

    // Alerta o bot sobre o alvo ao tomar tiro
    if (this.botAI) {
      this.botAI.state = 'attack';
    }

    if (this.currentHp <= 0) {
      this.die(onKillCallback);
    }
  }

  _triggerHitFlash() {
    if (this.rig && this.rig.torsoMesh && this.rig.headMesh) {
      const origTorso = this.rig.torsoMesh.material;
      const origHead = this.rig.headMesh.material;
      this.rig.torsoMesh.material = this.matFlash;
      this.rig.headMesh.material = this.matFlash;

      setTimeout(() => {
        if (!this.isDead && this.rig) {
          if (this.rig.torsoMesh) this.rig.torsoMesh.material = origTorso;
          if (this.rig.headMesh) this.rig.headMesh.material = origHead;
        }
      }, 60);
    }
  }

  die(onKillCallback) {
    if (this.isDead) return;
    this.isDead = true;
    this.respawnTimer = this.respawnDuration;
    this.healthSprite.visible = false;

    if (onKillCallback) {
      onKillCallback();
    }
  }

  respawn() {
    this.isDead = false;
    this.currentHp = this.maxHp;
    this._updateHealthCanvas();
    this.healthSprite.visible = true;
    this.group.position.copy(this.initialPosition);
    this.group.rotation.set(0, 0, 0);

    if (this.botAI) {
      this.botAI.state = 'patrol';
      this.botAI.changePatrolTarget();
    }
  }

  update(deltaTime, player = null) {
    if (this.isDead) {
      // Animação de colapso ao morrer
      if (this.group.rotation.x > -Math.PI / 2) {
        this.group.rotation.x -= deltaTime * 4;
      }
      if (this.group.position.y > -0.5) {
        this.group.position.y -= deltaTime * 0.5;
      }

      this.respawnTimer -= deltaTime;
      if (this.respawnTimer <= 0) {
        this.respawn();
      }
      return;
    }

    this.isMoving = false;

    // 1. Atualização da IA do Bot
    if (this.botAI && player) {
      this.botAI.update(deltaTime, player);
    }

    // 2. Animação de Rig Esquelético
    if (this.rig) {
      const isAttacking = this.botAI ? this.botAI.state === 'attack' : false;
      const isChasing = this.botAI ? this.botAI.state === 'chase' : false;

      this.rig.update(deltaTime, {
        moving: this.isMoving,
        sprinting: isChasing,
        aiming: isAttacking,
        grounded: true,
        verticalVelocity: 0,
        turn: 0
      });
    }
  }
}
