import * as THREE from 'three';

export class PlayerController {
  constructor(camera, startPosition = new THREE.Vector3(0, 1.8, 14)) {
    this.camera = camera;
    this.position = startPosition.clone();
    this.velocity = new THREE.Vector3();

    // Rotações da câmera
    this.yaw = 0; // horizontal (radianos)
    this.pitch = 0; // vertical (radianos)
    this.camera.rotation.order = 'YXZ';
    this.lastMouseDelta = { deltaX: 0, deltaY: 0 };

    // Configurações de movimentação física responsiva
    this.walkSpeed = 7.5;
    this.sprintSpeed = 12.0;

    this.accelGround = 55;
    this.accelAir = 11;
    this.decelGround = 20;
    this.decelSprint = 10;
    this.airControl = 0.28;

    this.jumpForce = 8.5;
    this.gravity = 24.0;

    // Coyote Time e Jump Buffering
    this.coyoteTime = 0.11;
    this.coyoteTimer = 0;
    this.jumpBufferTime = 0.12;
    this.jumpBufferTimer = 0;

    // Efeitos dinâmicos de Câmera de FPS
    this.cameraBobTime = 0;
    this.cameraRoll = 0;
    this.landImpact = 0;

    // Dimensões do jogador para colisão AABB
    this.playerRadius = 0.4;
    this.playerHeight = 1.8;
    this.eyeHeight = 1.65;

    // Estados
    this.isGrounded = false;
    this.wasGrounded = true;
    this.isMoving = false;
    this.isSprinting = false;
    this.stepTimer = 0;

    // Atributos do jogador
    this.maxHealth = 100;
    this.currentHealth = 100;

    this.playerBox = new THREE.Box3();
    this._updatePlayerBox();
    this.camera.position.copy(this.position);
  }

  setPosition(x, y, z) {
    this.position.set(x, y, z);
    this.camera.position.copy(this.position);
    this._updatePlayerBox();
  }

  _updatePlayerBox() {
    this.playerBox.min.set(
      this.position.x - this.playerRadius,
      this.position.y - this.eyeHeight,
      this.position.z - this.playerRadius
    );
    this.playerBox.max.set(
      this.position.x + this.playerRadius,
      this.position.y - this.eyeHeight + this.playerHeight,
      this.position.z + this.playerRadius
    );
  }

  getMovementState() {
    if (!this.isGrounded) {
      return this.velocity.y > 0 ? 'jump' : 'fall';
    }
    if (this.isSprinting) {
      return 'sprint';
    }
    if (this.isMoving) {
      return 'walk';
    }
    return 'idle';
  }

  _updateCamera(deltaTime) {
    const horizontalSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    const speed01 = THREE.MathUtils.clamp(horizontalSpeed / this.sprintSpeed, 0, 1);

    // 1. Head Bobbing Dinâmico
    if (this.isGrounded && this.isMoving) {
      const bobSpeed = this.isSprinting ? 14 : 9;
      this.cameraBobTime += deltaTime * bobSpeed;
    }

    const bobStrength = this.isGrounded && this.isMoving ? 1 : 0;
    const bobX = Math.cos(this.cameraBobTime * 0.5) * 0.014 * speed01 * bobStrength;
    const bobY = Math.sin(this.cameraBobTime) * 0.019 * speed01 * bobStrength;

    // 2. Sprint Lean (Inclinação de Câmera na Corrida)
    const targetRoll = this.isSprinting && this.isMoving ? -0.025 : 0;
    this.cameraRoll = THREE.MathUtils.damp(this.cameraRoll, targetRoll, 7, deltaTime);

    // 3. Amortecimento de Impacto de Aterrissagem
    this.landImpact = THREE.MathUtils.damp(this.landImpact, 0, 16, deltaTime);

    // 4. Aplicação na Câmera
    this.camera.position.set(
      this.position.x + bobX,
      this.position.y + bobY + this.landImpact,
      this.position.z
    );

    this.camera.rotation.z = this.cameraRoll;
  }

  update(deltaTime, inputManager, colliders, audioSystem) {
    // 1. Rotação da Câmera pelo Mouse
    if (inputManager.isPointerLocked) {
      const mouseDelta = inputManager.consumeMouseDelta();
      this.lastMouseDelta = mouseDelta;
      if (Number.isFinite(mouseDelta.deltaX)) this.yaw -= mouseDelta.deltaX;
      if (Number.isFinite(mouseDelta.deltaY)) this.pitch -= mouseDelta.deltaY;
    } else {
      inputManager.consumeMouseDelta();
      this.lastMouseDelta = { deltaX: 0, deltaY: 0 };
    }

    if (!Number.isFinite(this.yaw)) this.yaw = 0;
    if (!Number.isFinite(this.pitch)) this.pitch = 0;

    // Limita o pitch vertical entre -85° e +85°
    const maxPitch = Math.PI / 2 - 0.05;
    this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));

    // Ordem YXZ é obrigatória em FPS para evitar gimbal lock
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.set(this.pitch, this.yaw, this.cameraRoll, 'YXZ');

    // 2. Direção de Entrada do Teclado no plano XZ
    const keys = inputManager.keys;
    const moveVector = new THREE.Vector3();

    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).normalize();
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).normalize();

    if (keys.forward) moveVector.add(forward);
    if (keys.backward) moveVector.sub(forward);
    if (keys.right) moveVector.add(right);
    if (keys.left) moveVector.sub(right);

    if (moveVector.lengthSq() > 0) {
      moveVector.normalize();
      this.isMoving = true;
    } else {
      this.isMoving = false;
    }

    this.isSprinting = keys.sprint && keys.forward && !keys.backward;
    const currentSpeed = this.isSprinting ? this.sprintSpeed : this.walkSpeed;

    // 3. Aceleração horizontal e atrito com amortecimento físico suave
    const accel = this.isGrounded ? this.accelGround : this.accelAir;
    const decel = this.isSprinting ? this.decelSprint : this.decelGround;

    const targetX = moveVector.x * currentSpeed;
    const targetZ = moveVector.z * currentSpeed;

    if (this.isMoving) {
      this.velocity.x = THREE.MathUtils.damp(this.velocity.x, targetX, accel, deltaTime);
      this.velocity.z = THREE.MathUtils.damp(this.velocity.z, targetZ, accel, deltaTime);
    } else {
      this.velocity.x = THREE.MathUtils.damp(this.velocity.x, 0, decel, deltaTime);
      this.velocity.z = THREE.MathUtils.damp(this.velocity.z, 0, decel, deltaTime);
    }

    // Controle aéreo refinado
    if (!this.isGrounded) {
      this.velocity.x = THREE.MathUtils.damp(this.velocity.x, targetX, this.accelAir, deltaTime);
      this.velocity.z = THREE.MathUtils.damp(this.velocity.z, targetZ, this.accelAir, deltaTime);
    }

    // 4. Pulo com Coyote Time e Jump Buffering
    if (keys.jump) {
      this.jumpBufferTimer = this.jumpBufferTime;
    }
    this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - deltaTime);

    if (this.isGrounded) {
      this.coyoteTimer = this.coyoteTime;
    } else {
      this.coyoteTimer = Math.max(0, this.coyoteTimer - deltaTime);
    }

    if (this.jumpBufferTimer > 0 && this.coyoteTimer > 0) {
      this.velocity.y = this.jumpForce;
      this.isGrounded = false;
      this.jumpBufferTimer = 0;
      this.coyoteTimer = 0;
      if (audioSystem) audioSystem.playJump();
    } else if (this.isGrounded) {
      this.velocity.y = -0.5;
    } else {
      this.velocity.y -= this.gravity * deltaTime;
    }

    // 5. Resolução de Colisão AABB Eixo a Eixo
    // --- Eixo X ---
    this.position.x += this.velocity.x * deltaTime;
    this._updatePlayerBox();
    for (let c of colliders) {
      if (this.playerBox.intersectsBox(c.box)) {
        if (this.velocity.x > 0) {
          this.position.x = c.box.min.x - this.playerRadius - 0.001;
        } else if (this.velocity.x < 0) {
          this.position.x = c.box.max.x + this.playerRadius + 0.001;
        }
        this.velocity.x = 0;
        this._updatePlayerBox();
      }
    }

    // --- Eixo Z ---
    this.position.z += this.velocity.z * deltaTime;
    this._updatePlayerBox();
    for (let c of colliders) {
      if (this.playerBox.intersectsBox(c.box)) {
        if (this.velocity.z > 0) {
          this.position.z = c.box.min.z - this.playerRadius - 0.001;
        } else if (this.velocity.z < 0) {
          this.position.z = c.box.max.z + this.playerRadius + 0.001;
        }
        this.velocity.z = 0;
        this._updatePlayerBox();
      }
    }

    // --- Eixo Y (Chão, Teto e Plataformas) ---
    const previouslyGrounded = this.isGrounded;
    const previousVelocityY = this.velocity.y;
    this.position.y += this.velocity.y * deltaTime;
    this.isGrounded = false;

    // Chão padrão da arena (y = 0 -> eyeHeight = 1.65)
    if (this.position.y <= this.eyeHeight) {
      this.position.y = this.eyeHeight;
      this.velocity.y = 0;
      this.isGrounded = true;
    }

    this._updatePlayerBox();
    for (let c of colliders) {
      if (this.playerBox.intersectsBox(c.box)) {
        if (this.velocity.y < 0) {
          this.position.y = c.box.max.y + this.eyeHeight + 0.001;
          this.velocity.y = 0;
          this.isGrounded = true;
        } else if (this.velocity.y > 0) {
          this.position.y = c.box.min.y - (this.playerHeight - this.eyeHeight) - 0.001;
          this.velocity.y = 0;
        }
        this._updatePlayerBox();
      }
    }

    // Detecção de aterrissagem proporcional à velocidade vertical
    if (!previouslyGrounded && this.isGrounded && previousVelocityY < -2.0) {
      const impact = THREE.MathUtils.clamp(Math.abs(previousVelocityY) / 22, 0, 0.13);
      this.landImpact = -impact;
      if (audioSystem) audioSystem.playLand();
    }
    this.wasGrounded = this.isGrounded;

    // Som de passos procedurais sincronizados
    if (this.isGrounded && this.isMoving) {
      const stepInterval = this.isSprinting ? 0.32 : 0.48;
      this.stepTimer += deltaTime;
      if (this.stepTimer >= stepInterval) {
        this.stepTimer = 0;
        if (audioSystem) audioSystem.playFootstep(this.isSprinting);
      }
    } else {
      this.stepTimer = 0.2;
    }

    // 6. Atualiza posição final e efeitos dinâmicos de câmera
    this._updateCamera(deltaTime);
  }
}
