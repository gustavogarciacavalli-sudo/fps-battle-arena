import * as THREE from 'three';

// Gerenciador de Entradas e Pointer Lock API
export class InputManager {
  constructor(canvasElement, onPointerLockChange, onWeaponSelect, onWeaponCycle) {
    this.canvas = canvasElement;

    this.onPointerLockChange = onPointerLockChange;
    this.onWeaponSelect = onWeaponSelect;
    this.onWeaponCycle = onWeaponCycle;

    this.isPointerLocked = false;

    // Evita chamadas repetidas de Pointer Lock
    this.pointerLockPending = false;

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
    const safeMult = Number.isFinite(mult) ? mult : 1.0;
    this.sensitivityMultiplier = THREE.MathUtils.clamp(
      safeMult,
      0.1,
      2.0
    );
  }

  _bindEvents() {
    // =========================================================
    // POINTER LOCK
    // =========================================================
    document.addEventListener('pointerlockchange', () => {
      this.pointerLockPending = false;

      this.isPointerLocked =
        document.pointerLockElement === this.canvas;

      this._resetTransientMouseState();

      if (this.onPointerLockChange) {
        this.onPointerLockChange(this.isPointerLocked);
      }
    });

    document.addEventListener('pointerlockerror', (event) => {
      this.pointerLockPending = false;

      console.warn('Erro ao requisitar Pointer Lock:', event);

      // Mesmo sem Pointer Lock, mantém o estado visual consistente.
      this._resetTransientMouseState();

      if (this.onPointerLockChange) {
        this.onPointerLockChange(false);
      }
    });

    // =========================================================
    // MOVIMENTO DO MOUSE
    // =========================================================
    window.addEventListener('mousemove', (e) => {
      if (!this.isPointerLocked) return;

      const movX = Number.isFinite(e.movementX)
        ? e.movementX
        : Number.isFinite(e.mozMovementX)
          ? e.mozMovementX
          : Number.isFinite(e.webkitMovementX)
            ? e.webkitMovementX
            : 0;

      const movY = Number.isFinite(e.movementY)
        ? e.movementY
        : Number.isFinite(e.mozMovementY)
          ? e.mozMovementY
          : Number.isFinite(e.webkitMovementY)
            ? e.webkitMovementY
            : 0;

      const sens = Number.isFinite(this.sensitivityMultiplier)
        ? this.sensitivityMultiplier
        : 1.0;

      const effectiveSens = this.mouseSensitivity * sens;

      if (Number.isFinite(movX) && Number.isFinite(movY)) {
        this.mouse.deltaX += movX * effectiveSens;
        this.mouse.deltaY += movY * effectiveSens;
      }
    });

    // =========================================================
    // MOUSE BUTTONS
    // =========================================================
    window.addEventListener('mousedown', (e) => {
      if (!this.isPointerLocked) return;

      if (e.button === 0) {
        this.mouse.leftButton = true;
      }

      if (e.button === 2) {
        this.mouse.rightButton = true;
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.mouse.leftButton = false;
      }

      if (e.button === 2) {
        this.mouse.rightButton = false;
      }
    });

    // Evita ficar "travado atirando" caso a janela perca foco.
    window.addEventListener('blur', () => {
      this._resetTransientMouseState();

      Object.keys(this.keys).forEach((key) => {
        this.keys[key] = false;
      });
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this._resetTransientMouseState();
      }
    });

    // =========================================================
    // CLIQUE NO CANVAS
    // =========================================================
    this.canvas.addEventListener('click', () => {
      const profileModal = document.getElementById('profile-modal');
      const isProfileOpen =
        profileModal &&
        profileModal.classList.contains('active');

      if (!isProfileOpen && !this.isPointerLocked) {
        this.requestLock();
      }
    });

    // Clique global: útil quando o canvas está atrás de elementos
    // que não são interativos.
    window.addEventListener('click', (e) => {
      const profileModal = document.getElementById('profile-modal');

      const isProfileOpen =
        profileModal &&
        profileModal.classList.contains('active');

      const clickedInsideModal =
        e.target.closest('#profile-modal') ||
        e.target.closest('#instructions-blocker') ||
        e.target.closest('#btn-open-profile');

      if (
        !isProfileOpen &&
        !clickedInsideModal &&
        !this.isPointerLocked
      ) {
        this.requestLock();
      }
    });

    // =========================================================
    // RODA DO MOUSE
    // =========================================================
    window.addEventListener(
      'wheel',
      (e) => {
        if (!this.isPointerLocked) return;

        if (this.onWeaponCycle) {
          const direction = e.deltaY > 0 ? 1 : -1;
          this.onWeaponCycle(direction);
        }
      },
      { passive: true }
    );

    // =========================================================
    // TECLADO
    // =========================================================
    window.addEventListener('keydown', (e) => {
      this._handleKey(e, true);
    });

    window.addEventListener('keyup', (e) => {
      this._handleKey(e, false);
    });

    // =========================================================
    // MENU DE CONTEXTO
    // =========================================================
    window.addEventListener('contextmenu', (e) => {
      if (this.isPointerLocked) {
        e.preventDefault();
      }
    });
  }

  _handleKey(e, isPressed) {
    // Não processa comandos de jogo enquanto estiver digitando.
    if (
      document.activeElement &&
      (
        document.activeElement.tagName === 'INPUT' ||
        document.activeElement.tagName === 'TEXTAREA'
      )
    ) {
      if (isPressed && e.code === 'Enter') {
        document.activeElement.blur();
      }

      return;
    }

    // Troca rápida de armas
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
    if (
      this.isPointerLocked &&
      this.onWeaponSelect
    ) {
      this.onWeaponSelect(index);
    }
  }

  requestLock() {
    if (
      this.pointerLockPending ||
      this.isPointerLocked ||
      !this.canvas
    ) {
      return;
    }

    this.pointerLockPending = true;

    try {
      const result = this.canvas.requestPointerLock({
        unadjustedMovement: true
      });

      // Alguns navegadores podem retornar undefined.
      if (result && typeof result.catch === 'function') {
        result.catch(() => {
          this.pointerLockPending = false;

          // Fallback sem unadjustedMovement
          try {
            const fallback = this.canvas.requestPointerLock();

            if (
              fallback &&
              typeof fallback.catch === 'function'
            ) {
              fallback.catch(() => {
                this.pointerLockPending = false;
              });
            }
          } catch (error) {
            this.pointerLockPending = false;
            console.warn(
              'Pointer Lock indisponível:',
              error
            );
          }
        });
      }
    } catch (error) {
      this.pointerLockPending = false;

      console.warn(
        'Falha ao iniciar Pointer Lock:',
        error
      );
    }
  }

  exitLock() {
    this.pointerLockPending = false;
    this._resetTransientMouseState();

    if (document.exitPointerLock) {
      document.exitPointerLock();
    }
  }

  consumeMouseDelta() {
    const dX = this.mouse.deltaX;
    const dY = this.mouse.deltaY;

    this.mouse.deltaX = 0;
    this.mouse.deltaY = 0;

    return {
      deltaX: dX,
      deltaY: dY
    };
  }

  _resetTransientMouseState() {
    this.mouse.leftButton = false;
    this.mouse.rightButton = false;
    this.mouse.deltaX = 0;
    this.mouse.deltaY = 0;
  }
}
