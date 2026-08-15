import * as THREE from 'three';

export class TargetDummy {
  constructor(scene, position = new THREE.Vector3(0, 0, -10)) {
    this.scene = scene;
    this.initialPosition = position.clone();
    this.maxHp = 100;
    this.currentHp = this.maxHp;
    this.isDead = false;
    this.respawnTimer = 0;
    this.respawnDuration = 3.0; // segundos para reaparecer

    this.group = new THREE.Group();
    this.group.position.copy(this.initialPosition);

    this.hitMeshes = []; // Array de meshes interceptáveis pelo Raycast

    this._initMaterials();
    this._buildModel();
    this._createHealthBar();

    this.scene.add(this.group);
  }

  _initMaterials() {
    this.matBase = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.6,
      metalness: 0.5
    });

    this.matBody = new THREE.MeshStandardMaterial({
      color: 0xef4444, // Vermelho de alvo
      roughness: 0.4,
      metalness: 0.3
    });

    this.matHead = new THREE.MeshStandardMaterial({
      color: 0xf59e0b, // Amarelo/Laranja na cabeça (indicando headshot)
      roughness: 0.3,
      metalness: 0.4
    });

    this.matJoints = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.8,
      metalness: 0.2
    });

    // Material de flash ao tomar dano
    this.matFlash = new THREE.MeshBasicMaterial({ color: 0xffffff });
  }

  _buildModel() {
    // 1. Base no chão
    const baseGeo = new THREE.CylinderGeometry(0.6, 0.7, 0.15, 16);
    const baseMesh = new THREE.Mesh(baseGeo, this.matBase);
    baseMesh.position.y = 0.075;
    baseMesh.castShadow = true;
    this.group.add(baseMesh);

    // 2. Haste central / suporte
    const postGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.8, 8);
    const postMesh = new THREE.Mesh(postGeo, this.matJoints);
    postMesh.position.y = 0.55;
    postMesh.castShadow = true;
    this.group.add(postMesh);

    // 3. Tronco / Corpo (Alvo Principal)
    const torsoGeo = new THREE.BoxGeometry(0.7, 0.9, 0.35);
    this.torsoMesh = new THREE.Mesh(torsoGeo, this.matBody);
    this.torsoMesh.position.y = 1.35;
    this.torsoMesh.castShadow = true;
    this.torsoMesh.receiveShadow = true;
    this.torsoMesh.userData = { isDummy: true, isHead: false, target: this };
    this.group.add(this.torsoMesh);
    this.hitMeshes.push(this.torsoMesh);

    // 4. Braços de Manequim
    const armGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.7, 8);
    const leftArm = new THREE.Mesh(armGeo, this.matJoints);
    leftArm.position.set(-0.48, 1.3, 0);
    leftArm.rotation.z = 0.2;
    leftArm.castShadow = true;
    this.group.add(leftArm);

    const rightArm = new THREE.Mesh(armGeo, this.matJoints);
    rightArm.position.set(0.48, 1.3, 0);
    rightArm.rotation.z = -0.2;
    rightArm.castShadow = true;
    this.group.add(rightArm);

    // 5. Pescoço
    const neckGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.15, 8);
    const neck = new THREE.Mesh(neckGeo, this.matJoints);
    neck.position.y = 1.85;
    this.group.add(neck);

    // 6. Cabeça (Headshot Target!)
    const headGeo = new THREE.SphereGeometry(0.25, 16, 16);
    this.headMesh = new THREE.Mesh(headGeo, this.matHead);
    this.headMesh.position.y = 2.1;
    this.headMesh.castShadow = true;
    this.headMesh.userData = { isDummy: true, isHead: true, target: this };
    this.group.add(this.headMesh);
    this.hitMeshes.push(this.headMesh);

    // Faixa/Olho estilizado na cabeça
    const visorGeo = new THREE.BoxGeometry(0.3, 0.08, 0.15);
    const visorMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0, 2.1, 0.2);
    this.group.add(visor);
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
    this.healthSprite.position.set(0, 2.65, 0);
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
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.roundRect(0, 0, w, h, 8);
    ctx.fill();

    // Borda
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Barra de Vida
    const healthPercent = Math.max(0, this.currentHp / this.maxHp);
    const barWidth = (w - 12) * healthPercent;
    
    // Cor dinâmica: Verde -> Amarelo -> Vermelho
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
    ctx.fillText(`${Math.round(this.currentHp)} / ${this.maxHp}`, w / 2, h / 2);

    this.healthTexture.needsUpdate = true;
  }

  takeDamage(amount, isHeadshot, onKillCallback) {
    if (this.isDead) return;

    this.currentHp = Math.max(0, this.currentHp - amount);
    this._updateHealthCanvas();

    // Efeito de Flash Vermelho/Branco temporário
    this._triggerHitFlash(isHeadshot);

    // Balanço físico ao ser atingido
    this.group.rotation.x = 0.15;

    if (this.currentHp <= 0) {
      this.die(onKillCallback);
    }
  }

  _triggerHitFlash(isHeadshot) {
    const origBodyMat = this.torsoMesh.material;
    const origHeadMat = this.headMesh.material;

    this.torsoMesh.material = this.matFlash;
    this.headMesh.material = this.matFlash;

    setTimeout(() => {
      if (!this.isDead) {
        this.torsoMesh.material = origBodyMat;
        this.headMesh.material = origHeadMat;
      }
    }, 60);
  }

  die(onKillCallback) {
    if (this.isDead) return;
    this.isDead = true;
    this.respawnTimer = this.respawnDuration;

    // Desabilita barra de vida e gira/tumba o boneco
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
    this.group.scale.set(1, 1, 1);
    this.torsoMesh.material = this.matBody;
    this.headMesh.material = this.matHead;
  }

  update(deltaTime) {
    if (this.isDead) {
      // Animação de colapso/morte
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
    } else {
      // Recuperação suave do recuo de impacto
      if (this.group.rotation.x > 0.001) {
        this.group.rotation.x = THREE.MathUtils.lerp(this.group.rotation.x, 0, deltaTime * 8);
      }
    }
  }
}
