import * as THREE from 'three';

export class CharacterRig {
  constructor(root, materials = {}) {
    this.root = root;

    this.matUniform =
      materials.uniform ||
      new THREE.MeshStandardMaterial({
        color: 0x394332,
        roughness: 0.88
      });

    this.matVest =
      materials.vest ||
      new THREE.MeshStandardMaterial({
        color: 0x151817,
        metalness: 0.15,
        roughness: 0.78
      });

    this.matSkin =
      materials.skin ||
      new THREE.MeshStandardMaterial({
        color: 0xc28d73,
        roughness: 0.8
      });

    this.matHelmet =
      materials.helmet ||
      new THREE.MeshStandardMaterial({
        color: 0x343d2f,
        roughness: 0.62,
        metalness: 0.2
      });

    this.matBoot =
      materials.boot ||
      new THREE.MeshStandardMaterial({
        color: 0x171816,
        roughness: 0.92
      });

    this.matMetal =
      materials.metal ||
      new THREE.MeshStandardMaterial({
        color: 0x282b29,
        metalness: 0.78,
        roughness: 0.32
      });

    this._createBones();
    this._createBodyParts();

    this.animationTime = 0;
    this.prevPosition = new THREE.Vector3();

    this.isMoving = false;
    this.isSprinting = false;
    this.isAiming = false;
    this.isGrounded = true;

    this.moveBlend = 0;
    this.sprintBlend = 0;
    this.aimBlend = 0;

    this.verticalVelocity = 0;
    this.turnAmount = 0;
  }

  // ============================================================
  // SKELETON
  // ============================================================

  _createBones() {
    this.hips = new THREE.Bone();
    this.hips.name = 'hips';

    this.spine = new THREE.Bone();
    this.spine.name = 'spine';

    this.chest = new THREE.Bone();
    this.chest.name = 'chest';

    this.neck = new THREE.Bone();
    this.neck.name = 'neck';

    this.head = new THREE.Bone();
    this.head.name = 'head';

    this.leftShoulder = new THREE.Bone();
    this.rightShoulder = new THREE.Bone();

    this.leftUpperArm = new THREE.Bone();
    this.rightUpperArm = new THREE.Bone();

    this.leftForearm = new THREE.Bone();
    this.rightForearm = new THREE.Bone();

    this.leftHand = new THREE.Bone();
    this.rightHand = new THREE.Bone();

    this.leftUpperLeg = new THREE.Bone();
    this.rightUpperLeg = new THREE.Bone();

    this.leftLowerLeg = new THREE.Bone();
    this.rightLowerLeg = new THREE.Bone();

    this.leftFoot = new THREE.Bone();
    this.rightFoot = new THREE.Bone();

    // ------------------------------------------------------------
    // HIERARQUIA
    // ------------------------------------------------------------

    this.root.add(this.hips);

    this.hips.add(this.spine);
    this.spine.add(this.chest);
    this.chest.add(this.neck);
    this.neck.add(this.head);

    this.chest.add(this.leftShoulder);
    this.chest.add(this.rightShoulder);

    this.leftShoulder.add(this.leftUpperArm);
    this.leftUpperArm.add(this.leftForearm);
    this.leftForearm.add(this.leftHand);

    this.rightShoulder.add(this.rightUpperArm);
    this.rightUpperArm.add(this.rightForearm);
    this.rightForearm.add(this.rightHand);

    this.hips.add(this.leftUpperLeg);
    this.hips.add(this.rightUpperLeg);

    this.leftUpperLeg.add(this.leftLowerLeg);
    this.rightUpperLeg.add(this.rightLowerLeg);

    this.leftLowerLeg.add(this.leftFoot);
    this.rightLowerLeg.add(this.rightFoot);

    // ------------------------------------------------------------
    // POSIÇÕES
    // ------------------------------------------------------------

    this.hips.position.set(0, 0.95, 0);

    this.spine.position.set(0, 0.32, 0);
    this.chest.position.set(0, 0.32, 0);

    this.neck.position.set(0, 0.32, 0);
    this.head.position.set(0, 0.13, 0);

    this.leftShoulder.position.set(-0.34, 0.16, 0);
    this.rightShoulder.position.set(0.34, 0.16, 0);

    this.leftUpperArm.position.set(-0.16, -0.02, 0);
    this.rightUpperArm.position.set(0.16, -0.02, 0);

    this.leftForearm.position.set(0, -0.34, 0);
    this.rightForearm.position.set(0, -0.34, 0);

    this.leftHand.position.set(0, -0.31, 0);
    this.rightHand.position.set(0, -0.31, 0);

    this.leftUpperLeg.position.set(-0.16, -0.05, 0);
    this.rightUpperLeg.position.set(0.16, -0.05, 0);

    this.leftLowerLeg.position.set(0, -0.42, 0);
    this.rightLowerLeg.position.set(0, -0.42, 0);

    this.leftFoot.position.set(0, -0.40, 0.07);
    this.rightFoot.position.set(0, -0.40, 0.07);
  }

  // ============================================================
  // VISUAL BODY
  // ============================================================

  _createBodyParts() {
    // Torso
    const torso = new THREE.Mesh(
      new THREE.CapsuleGeometry(
        0.34,
        0.42,
        6,
        12
      ),
      this.matUniform
    );

    torso.scale.z = 0.68;
    torso.castShadow = true;
    torso.position.y = 0.02;
    this.chest.add(torso);
    this.torsoMesh = torso;

    // Plate carrier
    const vest = new THREE.Mesh(
      new THREE.BoxGeometry(
        0.68,
        0.56,
        0.38
      ),
      this.matVest
    );

    vest.position.set(
      0,
      -0.02,
      0.015
    );

    vest.castShadow = true;
    this.chest.add(vest);

    // Cabeça
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(
        0.215,
        20,
        16
      ),
      this.matSkin
    );

    head.castShadow = true;
    head.userData.isCharacterHead = true;
    this.head.add(head);
    this.headMesh = head;

    // Capacete
    const helmet = new THREE.Mesh(
      new THREE.SphereGeometry(
        0.245,
        20,
        14,
        0,
        Math.PI * 2,
        0,
        Math.PI * 0.66
      ),
      this.matHelmet
    );

    helmet.position.y = 0.04;
    helmet.castShadow = true;
    this.head.add(helmet);

    // Pescoço
    const neck = new THREE.Mesh(
      new THREE.CylinderGeometry(
        0.10,
        0.11,
        0.16,
        12
      ),
      this.matSkin
    );

    this.neck.add(neck);

    // Braços
    this._createArm(
      this.leftUpperArm,
      this.leftForearm,
      this.leftHand
    );

    this._createArm(
      this.rightUpperArm,
      this.rightForearm,
      this.rightHand
    );

    // Pernas
    this._createLeg(
      this.leftUpperLeg,
      this.leftLowerLeg,
      this.leftFoot
    );

    this._createLeg(
      this.rightUpperLeg,
      this.rightLowerLeg,
      this.rightFoot
    );
  }

  _createArm(
    upperBone,
    foreBone,
    handBone
  ) {
    const upper = new THREE.Mesh(
      new THREE.CapsuleGeometry(
        0.10,
        0.32,
        5,
        8
      ),
      this.matUniform
    );

    upper.position.y = -0.18;
    upper.castShadow = true;
    upperBone.add(upper);

    const elbow = new THREE.Mesh(
      new THREE.SphereGeometry(
        0.105,
        10,
        8
      ),
      this.matVest
    );

    elbow.position.y = -0.34;
    upperBone.add(elbow);

    const fore = new THREE.Mesh(
      new THREE.CapsuleGeometry(
        0.085,
        0.30,
        5,
        8
      ),
      this.matUniform
    );

    fore.position.y = -0.17;
    fore.castShadow = true;
    foreBone.add(fore);

    const hand = new THREE.Mesh(
      new THREE.SphereGeometry(
        0.105,
        12,
        8
      ),
      this.matSkin
    );

    handBone.add(hand);
  }

  _createLeg(
    upperBone,
    lowerBone,
    footBone
  ) {
    const thigh = new THREE.Mesh(
      new THREE.CapsuleGeometry(
        0.115,
        0.34,
        5,
        8
      ),
      this.matUniform
    );

    thigh.position.y = -0.20;
    thigh.castShadow = true;
    upperBone.add(thigh);

    const knee = new THREE.Mesh(
      new THREE.SphereGeometry(
        0.13,
        12,
        8
      ),
      this.matVest
    );

    knee.position.y = -0.40;
    upperBone.add(knee);

    const shin = new THREE.Mesh(
      new THREE.CapsuleGeometry(
        0.09,
        0.34,
        5,
        8
      ),
      this.matUniform
    );

    shin.position.y = -0.20;
    shin.castShadow = true;
    lowerBone.add(shin);

    const boot = new THREE.Mesh(
      new THREE.BoxGeometry(
        0.24,
        0.17,
        0.38
      ),
      this.matBoot
    );

    boot.position.set(
      0,
      -0.10,
      0.08
    );

    boot.castShadow = true;
    footBone.add(boot);
  }

  // ============================================================
  // ANIMATION
  // ============================================================

  update(
    deltaTime,
    {
      moving = false,
      sprinting = false,
      aiming = false,
      grounded = true,
      verticalVelocity = 0,
      turn = 0
    } = {}
  ) {
    this.isMoving = moving;
    this.isSprinting = sprinting;
    this.isAiming = aiming;
    this.isGrounded = grounded;
    this.verticalVelocity = verticalVelocity;
    this.turnAmount = turn;

    const moveTarget = moving ? 1 : 0;
    const sprintTarget = sprinting ? 1 : 0;
    const aimTarget = aiming ? 1 : 0;

    this.moveBlend = THREE.MathUtils.damp(
      this.moveBlend,
      moveTarget,
      9,
      deltaTime
    );

    this.sprintBlend = THREE.MathUtils.damp(
      this.sprintBlend,
      sprintTarget,
      8,
      deltaTime
    );

    this.aimBlend = THREE.MathUtils.damp(
      this.aimBlend,
      aimTarget,
      10,
      deltaTime
    );

    // Frequência
    const speed = 7 + this.sprintBlend * 5;

    if (this.moveBlend > 0.01) {
      this.animationTime += deltaTime * speed;
    }

    const t = this.animationTime;
    const walkCycle = Math.sin(t);
    const opposite = Math.sin(t + Math.PI);

    const stride = THREE.MathUtils.lerp(
      0.40,
      0.72,
      this.sprintBlend
    );

    const armSwing = THREE.MathUtils.lerp(
      0.30,
      0.54,
      this.sprintBlend
    );

    // ----------------------------------------------------------
    // PERNAS
    // ----------------------------------------------------------

    this.leftUpperLeg.rotation.x =
      opposite * stride * this.moveBlend;

    this.rightUpperLeg.rotation.x =
      walkCycle * stride * this.moveBlend;

    // Joelhos acompanham
    this.leftLowerLeg.rotation.x =
      Math.max(0, -opposite) * 0.75 * this.moveBlend;

    this.rightLowerLeg.rotation.x =
      Math.max(0, -walkCycle) * 0.75 * this.moveBlend;

    // Pés compensam
    this.leftFoot.rotation.x =
      -this.leftUpperLeg.rotation.x * 0.35;

    this.rightFoot.rotation.x =
      -this.rightUpperLeg.rotation.x * 0.35;

    // ----------------------------------------------------------
    // BRAÇOS
    // ----------------------------------------------------------

    const freeArmBlend = 1 - this.aimBlend;

    this.leftUpperArm.rotation.x =
      -0.6 + opposite * armSwing * this.moveBlend * freeArmBlend;

    this.rightUpperArm.rotation.x =
      -0.6 + walkCycle * armSwing * this.moveBlend * freeArmBlend;

    this.leftForearm.rotation.x =
      -0.18 - this.sprintBlend * 0.12;

    this.rightForearm.rotation.x =
      -0.18 - this.sprintBlend * 0.12;

    // ----------------------------------------------------------
    // AIM
    // ----------------------------------------------------------

    const aimPose = this.aimBlend;

    this.leftUpperArm.rotation.z = THREE.MathUtils.lerp(
      0.08,
      0.30,
      aimPose
    );

    this.rightUpperArm.rotation.z = THREE.MathUtils.lerp(
      -0.08,
      -0.30,
      aimPose
    );

    this.leftForearm.rotation.z = THREE.MathUtils.lerp(
      0,
      0.15,
      aimPose
    );

    this.rightForearm.rotation.z = THREE.MathUtils.lerp(
      0,
      -0.15,
      aimPose
    );

    // ----------------------------------------------------------
    // TRONCO
    // ----------------------------------------------------------

    const bodyBob =
      Math.abs(Math.sin(t)) * 0.035 * this.moveBlend;

    this.hips.position.y = THREE.MathUtils.damp(
      this.hips.position.y,
      0.95 + bodyBob,
      14,
      deltaTime
    );

    // Inclinação natural ao correr
    const targetLean = -0.045 * this.sprintBlend;

    this.spine.rotation.x = THREE.MathUtils.damp(
      this.spine.rotation.x,
      targetLean,
      8,
      deltaTime
    );

    // Balanço lateral
    this.chest.rotation.z = THREE.MathUtils.damp(
      this.chest.rotation.z,
      -this.turnAmount * 0.08,
      8,
      deltaTime
    );

    // ----------------------------------------------------------
    // CABEÇA
    // ----------------------------------------------------------

    this.neck.rotation.y = THREE.MathUtils.damp(
      this.neck.rotation.y,
      this.turnAmount * 0.12,
      9,
      deltaTime
    );

    // ----------------------------------------------------------
    // SALTO / QUEDA
    // ----------------------------------------------------------

    if (!grounded) {
      const airFactor = THREE.MathUtils.clamp(
        verticalVelocity / 10,
        -1,
        1
      );

      this.leftUpperLeg.rotation.x += -airFactor * 0.18;
      this.rightUpperLeg.rotation.x += -airFactor * 0.18;

      this.spine.rotation.x +=
        verticalVelocity > 0 ? 0.03 : -0.05;
    }

    this.root.updateMatrixWorld(true);
  }
}
