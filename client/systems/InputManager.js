// Gerenciador de Entradas e Pointer Lock API

export class InputManager {
  constructor(canvasElement, onPointerLockChange, onWeaponSelect, onWeaponCycle) {
    this.canvas = canvasElement;
    this.onPointerLockChange = onPointerLockChange;
    this.onWeaponSelect = onWeaponSelect;
    this.onWeaponCycle = onWeaponCycle;

    this.isPointerLocked = false;

    // Estado das teclas
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      jump: false,
      sprint: false,
      reload: false
    };

    // Estado do mouse
    this.mouse = {
      deltaX: 0,
      deltaY: 0,
      leftButton: false,
      rightButton: false
    };

    this.mouseSensitivity = 0.0022;
    this.sensitivityMultiplier = 1.0;

    this._bindEvents();
  }

  setSensitivityMultiplier(mult = 1.0) {
    this.sensitivityMultiplier = THREE.MathUtils.clamp(mult, 0.1, 2.0);
  }

  _bindEvents() {
    // Pointer Lock
    document.addEventListener('pointerlockchange', () => {
      this.isPointerLocked = document.pointerLockElement === this.canvas;
      if (this.onPointerLockChange) {
        this.onPointerLockChange(this.isPointerLocked);
      }
    });

    document.addEventListener('pointerlockerror', () => {
      console.warn('Erro ao requisitar Pointer Lock');
    });

    // Movimento do Mouse com sensibilidade adaptativa e proteção total contra NaN
    window.addEventListener('mousemove', (e) => {
      if (!this.isPointerLocked) return;
      const movX = Number.isFinite(e.movementX) ? e.movementX : (e.mozMovementX || e.webkitMovementX || 0);
      const movY = Number.isFinite(e.movementY) ? e.movementY : (e.mozMovementY || e.webkitMovementY || 0);
      const sens = Number.isFinite(this.sensitivityMultiplier) ? this.sensitivityMultiplier : 1.0;
      const effectiveSens = this.mouseSensitivity * sens;
      if (Number.isFinite(movX) && Number.isFinite(movY)) {
        this.mouse.deltaX += movX * effectiveSens;
        this.mouse.deltaY += movY * effectiveSens;
      }
    });

    // Cliques do Mouse
    window.addEventListener('mousedown', (e) => {
      if (!this.isPointerLocked) return;
      if (e.button === 0) this.mouse.leftButton = true;
      if (e.button === 2) this.mouse.rightButton = true;
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.leftButton = false;
      if (e.button === 2) this.mouse.rightButton = false;
    });

    // Clique na tela/canvas para reativar Pointer Lock e movimentação se nenhum modal estiver aberto
    this.canvas.addEventListener('click', () => {
      const profileModal = document.getElementById('profile-modal');
      const isProfileOpen = profileModal && profileModal.classList.contains('active');
      if (!isProfileOpen && !this.isPointerLocked) {
        this.requestLock();
      }
    });

    window.addEventListener('click', (e) => {
      const profileModal = document.getElementById('profile-modal');
      const isProfileOpen = profileModal && profileModal.classList.contains('active');
      const isClickInsideModal = e.target.closest('#profile-modal') || e.target.closest('#instructions-blocker') || e.target.closest('#btn-open-profile');

      if (!isProfileOpen && !isClickInsideModal && !this.isPointerLocked) {
        this.requestLock();
      }
    });

    // Roda do Mouse (Ciclo de armas)
    window.addEventListener('wheel', (e) => {
      if (!this.isPointerLocked) return;
      if (this.onWeaponCycle) {
        const direction = e.deltaY > 0 ? 1 : -1;
        this.onWeaponCycle(direction);
      }
    }, { passive: true });

    // Teclado
    window.addEventListener('keydown', (e) => this._handleKey(e, true));
    window.addEventListener('keyup', (e) => this._handleKey(e, false));

    // Previne menu de contexto ao mirar com o botão direito
    window.addEventListener('contextmenu', (e) => {
      if (this.isPointerLocked) e.preventDefault();
    });
  }

  _handleKey(e, isPressed) {
    // Se o usuário estiver digitando no campo de texto do perfil, não executa atalhos de jogo
    if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
      if (e.code === 'Enter') {
        document.activeElement.blur();
      }
      return;
    }

    // Teclas de Troca Rápida de Armas (1, 2, 3, 4)
    if (isPressed && !e.repeat) {
      if (e.code === 'Digit1') this._selectWeapon(0);
      if (e.code === 'Digit2') this._selectWeapon(1);
      if (e.code === 'Digit3') this._selectWeapon(2);
      if (e.code === 'Digit4') this._selectWeapon(3);
    }

    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.keys.forward = isPressed;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.keys.backward = isPressed;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.keys.left = isPressed;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.keys.right = isPressed;
        break;
      case 'Space':
        this.keys.jump = isPressed;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.keys.sprint = isPressed;
        break;
      case 'KeyR':
        this.keys.reload = isPressed;
        break;
    }
  }

  _selectWeapon(index) {
    if (this.isPointerLocked && this.onWeaponSelect) {
      this.onWeaponSelect(index);
    }
  }

  requestLock() {
    this.canvas.requestPointerLock({
      unadjustedMovement: true
    }).catch(() => {
      this.canvas.requestPointerLock();
    });
  }

  exitLock() {
    if (document.exitPointerLock) {
      document.exitPointerLock();
    }
  }

  consumeMouseDelta() {
    const dX = this.mouse.deltaX;
    const dY = this.mouse.deltaY;
    this.mouse.deltaX = 0;
    this.mouse.deltaY = 0;
    return { deltaX: dX, deltaY: dY };
  }
}
