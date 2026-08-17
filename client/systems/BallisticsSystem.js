import * as THREE from 'three';

export class BallisticsSystem {
  constructor(scene) {
    this.scene = scene;

    this.projectiles = [];
    this.impactEffects = [];

    // Gravidade para balística física de videogame (visível e controlável)
    this.gravity = 12.0;
    this.maxProjectileLifetime = 4.0;

    this.tmpVelocity = new THREE.Vector3();
    this.tmpNextPosition = new THREE.Vector3();
    this.tmpDirection = new THREE.Vector3();
  }

  createProjectile({
    origin,
    direction,
    speed = 75,
    gravityScale = 0,
    maxDistance = 400,
    color = 0xffd27a,
    width = 0.018,
    targetObjects = [],
    onHit = null
  }) {
    const velocity = direction.clone().normalize().multiplyScalar(speed);

    const projectile = {
      position: origin.clone(),
      velocity,
      speed,
      gravityScale,
      distance: 0,
      maxDistance,
      age: 0,
      onHit,
      targetObjects,
      alive: true
    };

    projectile.tracer = this._createTracer(origin, color, width);
    this.projectiles.push(projectile);

    return projectile;
  }

  update(deltaTime) {
    if (this.projectiles.length === 0) return;

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];

      if (!p.alive) {
        this._removeProjectile(i);
        continue;
      }

      p.age += deltaTime;
      if (p.age > this.maxProjectileLifetime) {
        this._removeProjectile(i);
        continue;
      }

      const frameDistance = p.velocity.length() * deltaTime;

      this.tmpVelocity.copy(p.velocity);
      // Aplica gravidade física configurada
      this.tmpVelocity.y -= this.gravity * p.gravityScale * deltaTime;

      this.tmpNextPosition.copy(p.position);
      this.tmpNextPosition.addScaledVector(this.tmpVelocity, deltaTime);

      const segment = this.tmpNextPosition.clone().sub(p.position);
      const segmentLength = segment.length();

      if (segmentLength > 0) {
        this.tmpDirection.copy(segment).normalize();
      }

      const hit = this._raycastSegment(
        p.position,
        this.tmpDirection,
        segmentLength,
        p.targetObjects
      );

      if (hit) {
        p.alive = false;
        this._updateTracer(p.tracer, p.position, hit.point);

        if (p.onHit) {
          p.onHit(hit);
        }

        this._createImpactEffect(
          hit.point,
          hit.face ? hit.face.normal : new THREE.Vector3(0, 1, 0)
        );

        this._removeProjectile(i);
        continue;
      }

      p.position.copy(this.tmpNextPosition);
      p.velocity.copy(this.tmpVelocity);
      p.distance += frameDistance;

      this._updateTracer(
        p.tracer,
        p.position,
        p.position.clone().subScaledVector(p.velocity, 0.015)
      );

      if (p.distance >= p.maxDistance) {
        this._removeProjectile(i);
      }
    }
  }

  _raycastSegment(origin, direction, distance, objects) {
    if (!objects || objects.length === 0 || distance <= 0) return null;

    const raycaster = new THREE.Raycaster(origin, direction, 0, distance);
    const intersections = raycaster.intersectObjects(objects, false);
    return intersections.length > 0 ? intersections[0] : null;
  }

  _createTracer(position, color, width) {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(6);
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.9,
      linewidth: 2
    });

    const line = new THREE.Line(geometry, material);
    line.frustumCulled = false;
    this.scene.add(line);

    return { line, positions, width };
  }

  _updateTracer(tracer, end, previous) {
    if (!tracer) return;
    const p = tracer.positions;
    p[0] = previous.x;
    p[1] = previous.y;
    p[2] = previous.z;
    p[3] = end.x;
    p[4] = end.y;
    p[5] = end.z;
    tracer.line.geometry.attributes.position.needsUpdate = true;
  }

  _createImpactEffect(position, normal) {
    const group = new THREE.Group();
    group.position.copy(position);

    // Núcleo luminoso de impacto
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.04, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffc46b })
    );
    group.add(core);

    // Faíscas balísticas dispersadas
    for (let i = 0; i < 8; i++) {
      const particle = new THREE.Mesh(
        new THREE.SphereGeometry(0.015, 6, 6),
        new THREE.MeshBasicMaterial({
          color: i % 2 === 0 ? 0xffdf80 : 0xd9803b
        })
      );

      particle.userData.velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 3.5,
        Math.random() * 2.5,
        (Math.random() - 0.5) * 3.5
      );
      group.add(particle);
    }

    this.scene.add(group);

    this.impactEffects.push({
      group,
      age: 0,
      lifetime: 0.25
    });
  }

  updateEffects(deltaTime) {
    for (let i = this.impactEffects.length - 1; i >= 0; i--) {
      const fx = this.impactEffects[i];
      fx.age += deltaTime;

      for (const particle of fx.group.children) {
        if (particle.userData && particle.userData.velocity) {
          particle.position.addScaledVector(particle.userData.velocity, deltaTime);
          particle.userData.velocity.y -= 8 * deltaTime;
        }
      }

      const fade = Math.max(0, 1 - fx.age / fx.lifetime);
      fx.group.scale.setScalar(0.5 + fade * 0.5);

      if (fx.age >= fx.lifetime) {
        this.scene.remove(fx.group);
        fx.group.traverse(obj => {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) obj.material.dispose();
        });
        this.impactEffects.splice(i, 1);
      }
    }
  }

  _removeProjectile(index) {
    const projectile = this.projectiles[index];
    if (!projectile) return;

    if (projectile.tracer) {
      this.scene.remove(projectile.tracer.line);
      projectile.tracer.line.geometry.dispose();
      projectile.tracer.line.material.dispose();
    }

    this.projectiles.splice(index, 1);
  }
}
