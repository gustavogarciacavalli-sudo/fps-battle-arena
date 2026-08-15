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

    // Configurações de movimentação
    this.walkSpeed = 7.5;
    this.sprintSpeed = 12.0;
    this.acceleration = 45.0;
    this.friction = 12.0;
    this.jumpForce = 8.5;
    this.gravity = 24.0;

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

  update(deltaTime, inputManager, colliders, audioSystem) {
    if (!inputManager.isPointerLocked) {
      this.camera.position.copy(this.position);
      return;
    }

    // 1. Rotação da Câmera pelo Mouse
    const mouseDelta = inputManager.consumeMouseDelta();
    this.lastMouseDelta = mouseDelta;
    if (Number.isFinite(mouseDelta.deltaX)) this.yaw -= mouseDelta.deltaX;
    if (Number.isFinite(mouseDelta.deltaY)) this.pitch -= mouseDelta.deltaY;

    if (!Number.isFinite(this.yaw)) this.yaw = 0;
    if (!Number.isFinite(this.pitch)) this.pitch = 0;

    // Limita o pitch vertical entre -85° e +85°
    const maxPitch = Math.PI / 2 - 0.05;
    this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));

    // Ordem YXZ é obrigatória em FPS para evitar gimbal lock / inclinação de 90° ao girar
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');

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

    // 3. Aceleração horizontal e atrito
    const targetVelX = moveVector.x * currentSpeed;
    const targetVelZ = moveVector.z * currentSpeed;

    if (this.isMoving) {
      this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, targetVelX, deltaTime * this.acceleration * 0.25);
      this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, targetVelZ, deltaTime * this.acceleration * 0.25);
    } else {
      // Atrito quando parado
      this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, 0, deltaTime * this.friction);
      this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, 0, deltaTime * this.friction);
    }

    // 4. Pulo e Gravidade
    if (this.isGrounded) {
      if (keys.jump) {
        this.velocity.y = this.jumpForce;
        this.isGrounded = false;
        if (audioSystem) audioSystem.playJump();
      } else {
        this.velocity.y = -0.5; // Força sutil para mantê-lo colado ao chão
      }
    } else {
      this.velocity.y -= this.gravity * deltaTime;
    }

    // 5. Resolução de Colisão AABB (Eixo a Eixo para deslizar suavemente)
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
    const prevGrounded = this.wasGrounded;
    const prevVelY = this.velocity.y;
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
          // Pousou em cima de um bloco/plataforma
          this.position.y = c.box.max.y + this.eyeHeight + 0.001;
          this.velocity.y = 0;
          this.isGrounded = true;
        } else if (this.velocity.y > 0) {
          // Bateu a cabeça no teto
          this.position.y = c.box.min.y - (this.playerHeight - this.eyeHeight) - 0.001;
          this.velocity.y = 0;
        }
        this._updatePlayerBox();
      }
    }

    // Detecção de aterrissagem com som
    if (!prevGrounded && this.isGrounded && prevVelY < -2.5) {
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
      this.stepTimer = 0.2; // Quase pronto para o próximo passo ao começar a andar
    }

    // 6. Atualiza posição final da câmera
    this.camera.position.copy(this.position);
  }
}
