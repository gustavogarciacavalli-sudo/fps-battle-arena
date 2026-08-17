import * as THREE from 'three';

export class BotAI {
  constructor(bot) {
    this.bot = bot;
    this.state = 'patrol'; // 'patrol' | 'chase' | 'attack' | 'search' | 'idle'
    this.target = null;
    this.stateTime = 0;

    // Distâncias de combate
    this.detectionRange = 26;
    this.attackRange = 18;
    this.forgetRange = 32;

    // Velocidades
    this.moveSpeed = 2.4;
    this.sprintSpeed = 3.8;

    // Temporizadores de tiro e cadência
    this.attackCooldown = 0;
    this.attackInterval = 0.65;
    this.fireProbability = 0.75;
    this.reactionDelay = 0.25 + Math.random() * 0.35;
    this.reactionTimer = 0;

    this.lastKnownTargetPosition = new THREE.Vector3();
    this.patrolCenter = bot.group.position.clone();
    this.patrolTarget = new THREE.Vector3();

    this.changePatrolTarget();
  }

  update(deltaTime, player) {
    if (this.bot.isDead) return;

    this.stateTime += deltaTime;
    this.attackCooldown = Math.max(0, this.attackCooldown - deltaTime);

    if (!player || player.isDead) {
      this._patrol(deltaTime);
      return;
    }

    const distance = this.bot.group.position.distanceTo(player.position);
    const canSee = this._canSeePlayer(player);

    // ----------------------------------------------------------
    // 1. DETECÇÃO COM ATRASO DE REAÇÃO HUMANA
    // ----------------------------------------------------------
    if (canSee && distance <= this.detectionRange) {
      this.reactionTimer += deltaTime;
      if (this.reactionTimer >= this.reactionDelay) {
        this.target = player;
        this.lastKnownTargetPosition.copy(player.position);

        if (distance <= this.attackRange) {
          this.state = 'attack';
        } else {
          this.state = 'chase';
        }
      }
    } else {
      this.reactionTimer = Math.max(0, this.reactionTimer - deltaTime * 2);
    }

    // ----------------------------------------------------------
    // 2. ESTADO: ATAQUE
    // ----------------------------------------------------------
    if (this.state === 'attack') {
      if (distance > this.forgetRange) {
        this.state = 'search';
        return;
      }

      this._faceTarget(player, deltaTime);

      // Leve aproximação ou recuo tático
      if (distance > this.attackRange * 0.85) {
        this._moveToward(player.position, deltaTime, this.moveSpeed * 0.5);
      }

      if (canSee && this.attackCooldown <= 0) {
        this._attack(player);
      }
      return;
    }

    // ----------------------------------------------------------
    // 3. ESTADO: PERSEGUIÇÃO
    // ----------------------------------------------------------
    if (this.state === 'chase') {
      this._faceTarget(player, deltaTime);
      this._moveToward(player.position, deltaTime, this.sprintSpeed);

      if (distance <= this.attackRange) {
        this.state = 'attack';
      }
      return;
    }

    // ----------------------------------------------------------
    // 4. ESTADO: BUSCA NA ÚLTIMA POSIÇÃO CONHECIDA
    // ----------------------------------------------------------
    if (this.state === 'search') {
      this._facePosition(this.lastKnownTargetPosition, deltaTime);
      this._moveToward(this.lastKnownTargetPosition, deltaTime, this.moveSpeed);

      if (this.bot.group.position.distanceTo(this.lastKnownTargetPosition) < 1.8) {
        this.state = 'patrol';
        this.changePatrolTarget();
      }
      return;
    }

    // ----------------------------------------------------------
    // 5. ESTADO: PATRULHA
    // ----------------------------------------------------------
    this._patrol(deltaTime);
  }

  _patrol(deltaTime) {
    if (this.bot.group.position.distanceTo(this.patrolTarget) < 1.3) {
      this.changePatrolTarget();
    }

    this._facePosition(this.patrolTarget, deltaTime);
    this._moveToward(this.patrolTarget, deltaTime, this.moveSpeed * 0.65);
  }

  changePatrolTarget() {
    this.patrolTarget.set(
      this.patrolCenter.x + (Math.random() - 0.5) * 14,
      this.patrolCenter.y,
      this.patrolCenter.z + (Math.random() - 0.5) * 14
    );
  }

  _moveToward(target, deltaTime, speed) {
    const direction = target.clone().sub(this.bot.group.position);
    direction.y = 0;

    if (direction.lengthSq() < 0.001) return;

    direction.normalize();
    this.bot.group.position.addScaledVector(direction, speed * deltaTime);
    this.bot.isMoving = true;
  }

  _faceTarget(target, deltaTime) {
    this._facePosition(target.position, deltaTime);
  }

  _facePosition(target, deltaTime) {
    const direction = target.clone().sub(this.bot.group.position);
    direction.y = 0;

    if (direction.lengthSq() < 0.0001) return;

    const targetYaw = Math.atan2(direction.x, direction.z);
    let delta = targetYaw - this.bot.group.rotation.y;
    delta = Math.atan2(Math.sin(delta), Math.cos(delta));

    this.bot.group.rotation.y += delta * (1 - Math.exp(-8 * deltaTime));
  }

  _canSeePlayer(player) {
    const origin = this.bot.group.position.clone();
    origin.y += 1.45;

    const target = player.position.clone();
    target.y -= 0.15;

    const direction = target.sub(origin);
    const distance = direction.length();
    direction.normalize();

    const ray = new THREE.Raycaster(origin, direction, 0, distance);
    const obstacles = this.bot.getVisibilityObjects ? this.bot.getVisibilityObjects() : [];
    const hits = ray.intersectObjects(obstacles, false);

    return hits.length === 0;
  }

  _attack(player) {
    this.attackCooldown = this.attackInterval;

    if (Math.random() > this.fireProbability) return;

    if (this.bot.onBotAttack) {
      this.bot.onBotAttack(player);
    }
  }
}
