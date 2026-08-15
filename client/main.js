import * as THREE from 'three';
import { Arena } from './scenes/Arena.js';
import { TargetDummy } from './scenes/TargetDummy.js';
import { InputManager } from './systems/InputManager.js';
import { PlayerController } from './systems/PlayerController.js';
import { WeaponSystem } from './systems/WeaponSystem.js';
import { CombatSystem } from './systems/CombatSystem.js';
import { HUDSystem } from './systems/HUDSystem.js';
import { AudioSystem } from './systems/AudioSystem.js';
import { PlayerManager } from './systems/PlayerManager.js';
import { NetworkManager } from './net/NetworkManager.js';
import { ProfileManager } from './systems/ProfileManager.js';
import { PsychoModeSystem } from './systems/PsychoModeSystem.js';

class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.clock = new THREE.Clock();

    this.isDead = false;
    this.isMatchOver = false;
    this.respawnRemaining = 0;
    this.lastNetSend = 0;
    this.survivalTimer = 0;
    this.isProfileModalOpen = false;
    this.currentKillstreak = 0;

    this._initThree();
    this._initSystems();
    this._setupNetwork();
    this._setupProfile();
    this._setupEventListeners();

    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  _initThree() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.35;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xa0b2c6);
    this.scene.fog = new THREE.FogExp2(0xa0b2c6, 0.0035);

    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.05,
      500
    );
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);
  }

  _initSystems() {
    this.audioSystem = new AudioSystem();
    this.hudSystem = new HUDSystem();

    // 1. Sistema de Perfil e Progressão (Fase 4)
    this.profileManager = new ProfileManager({
      onXpGain: (amount, reason) => {
        this.audioSystem.playXpGain();
        this.hudSystem.showXpToast(amount, reason);
        this._updateHUDXpBar();
      },
      onLevelUp: (newLevel, newRank) => {
        this.audioSystem.playLevelUp();
        this.hudSystem.showLevelUpBanner(newLevel, newRank);
        this._updateHUDXpBar();
      },
      onProfileChange: () => {
        this._updateHUDXpBar();
      }
    });

    // 2. Sistema de Psycho Mode / Pós-processamento (Fase 5)
    this.psychoModeSystem = new PsychoModeSystem(
      this.renderer,
      this.scene,
      this.camera,
      this.audioSystem,
      this.hudSystem
    );

    this.playerManager = new PlayerManager(this.scene);
    this.weaponSystem = new WeaponSystem(this.camera, this.scene);

    // 3. Sistema de Combate
    this.combatSystem = new CombatSystem(
      this.scene,
      this.camera,
      this.weaponSystem,
      this.audioSystem,
      this.hudSystem,
      null,
      this.playerManager,
      this.profileManager
    );

    // 4. Entradas
    this.inputManager = new InputManager(
      this.canvas,
      (isLocked) => {
        this.hudSystem.setPointerLockState(isLocked);
        if (isLocked) {
          this.audioSystem.ensureContext();
          if (this.isProfileModalOpen) this._toggleProfile(false);
        }
      },
      (slotIndex) => {
        if (!this.isDead && !this.isProfileModalOpen && !this.isMatchOver) {
          this.combatSystem.selectWeapon(slotIndex);
        }
      },
      (direction) => {
        if (!this.isDead && !this.isProfileModalOpen && !this.isMatchOver) {
          this.combatSystem.cycleWeapon(direction);
        }
      }
    );

    this.arena = new Arena(this.scene);

    this.dummies = [
      new TargetDummy(this.scene, new THREE.Vector3(0, 0, -8)),
      new TargetDummy(this.scene, new THREE.Vector3(0, 2.8, 0)),
      new TargetDummy(this.scene, new THREE.Vector3(-14, 0, -10))
    ];

    this.playerController = new PlayerController(this.camera, new THREE.Vector3(0, 1.8, 18));
    this.combatSystem.setTargets(this.dummies, this.arena.shootableMeshes);
  }

  _setupProfile() {
    this._updateHUDXpBar();
  }

  _updateHUDXpBar() {
    const prof = this.profileManager.profile;
    const rankInfo = this.profileManager.getRankInfo(prof.level);
    this.hudSystem.updateXp(prof.level, prof.currentXp, rankInfo.neededXp, rankInfo);
  }

  _toggleProfile(forceState = null) {
    if (this.isMatchOver) return;

    this.isProfileModalOpen = forceState !== null ? forceState : !this.isProfileModalOpen;
    const prof = this.profileManager.profile;
    const rankInfo = this.profileManager.getRankInfo(prof.level);
    const accuracy = this.profileManager.getAccuracyPercent();
    const kd = this.profileManager.getKdRatio();

    this.hudSystem.toggleProfileModal(this.isProfileModalOpen, prof, rankInfo, accuracy, kd);

    if (this.isProfileModalOpen) {
      this.inputManager.exitLock();
    } else {
      this.inputManager.requestLock();
    }
  }

  _setupNetwork() {
    this.networkManager = new NetworkManager({
      onInit: (self, initialPlayers) => {
        this.selfId = self.id;
        const localName = this.profileManager.getName() || self.name;
        this.hudSystem.setPlayerSquad(localName, self.color);
        this.playerController.setPosition(self.position.x, self.position.y, self.position.z);
        initialPlayers.forEach(p => this.playerManager.addPlayer(p));

        if (localName !== self.name) {
          this.networkManager.sendJoin(localName);
        }
      },
      onPlayerJoined: (player) => {
        this.playerManager.addPlayer(player);
        this.hudSystem.showKillNotification(`NOVO OPERADOR CONECTADO: ${player.name}`);
      },
      onPlayerLeft: (id) => {
        this.playerManager.removePlayer(id);
      },
      onWorldState: (players) => {
        this.hudSystem.updateScoreboard(players);
        players.forEach(p => {
          if (p.id === this.selfId) {
            this.hudSystem.updateHealth(p.health, p.maxHealth);
            const killScore = document.getElementById('kill-score');
            if (killScore) killScore.textContent = p.kills;
          } else {
            this.playerManager.updatePlayerState(p);
          }
        });
      },
      onRemoteShot: (msg) => {
        this.combatSystem.handleRemotePlayerShot(msg);
      },
      onDamageDealt: (msg) => {
        if (msg.targetId === this.selfId) {
          this.hudSystem.flashDamageVignette();
          this.hudSystem.updateHealth(msg.remainingHealth);

          if (msg.damage >= 35) {
            this.psychoModeSystem.triggerLevel(3, 7.0);
          } else if (msg.damage >= 15) {
            this.psychoModeSystem.triggerLevel(2, 6.0);
          }
        } else {
          const target = this.playerManager.getPlayer(msg.targetId);
          if (target) {
            target.playDamageFlash();
            if (msg.hitPoint) {
              const pos = new THREE.Vector3(msg.hitPoint.x, msg.hitPoint.y, msg.hitPoint.z);
              this.combatSystem.spawnDamageNumberAt(pos, msg.damage, msg.isHeadshot);
            }
          }
        }
      },
      onPlayerKilled: (msg) => {
        const headshotTag = msg.isHeadshot ? ' [HEADSHOT]' : '';
        const bannerText = `🎯 ${msg.killerName} ELIMINOU ${msg.victimName}${headshotTag}`;
        this.hudSystem.showKillNotification(bannerText);

        if (msg.victimId === this.selfId) {
          this.isDead = true;
          this.currentKillstreak = 0;
          this.respawnRemaining = 4.0;
          this.hudSystem.showRespawnScreen(true, 4);
          this.profileManager.recordDeath();
        }
        if (msg.killerId === this.selfId) {
          this.audioSystem.playKillSound();
          this.profileManager.recordKill(msg.isHeadshot);
          
          this.currentKillstreak++;
          if (this.currentKillstreak >= 4) {
            this.psychoModeSystem.triggerLevel(4, 10.0);
          } else if (this.currentKillstreak >= 2) {
            this.psychoModeSystem.triggerLevel(2, 8.0);
          }
        }
      },
      onPlayerRespawn: (msg) => {
        if (msg.id === this.selfId) {
          this.isDead = false;
          this.hudSystem.showRespawnScreen(false);
          this.playerController.setPosition(msg.position.x, msg.position.y, msg.position.z);
          this.playerController.velocity.set(0, 0, 0);
          this.hudSystem.updateHealth(100);
        }
      },
      // Evento de Fim de Partida / Vitória (Fase 6)
      onMatchEnded: (msg) => {
        this.isMatchOver = true;
        this.audioSystem.playVictorySound();

        const isWinner = msg.winnerId === this.selfId;
        if (isWinner) {
          this.profileManager.addXp(250, 'VITÓRIA DA OPERAÇÃO');
        }

        const accuracy = this.profileManager.getAccuracyPercent();
        const localKills = this.profileManager.profile.stats.kills;
        this.hudSystem.showMatchEnd(
          isWinner,
          msg.winnerName,
          msg.winnerColor,
          localKills,
          accuracy,
          isWinner ? 250 : 100
        );

        this.inputManager.exitLock();
      },
      onMatchRestarted: () => {
        this.isMatchOver = false;
        this.isDead = false;
        this.currentKillstreak = 0;
        this.hudSystem.hideMatchEnd();
        this.playerController.setPosition(0, 1.8, 18);
        this.playerController.velocity.set(0, 0, 0);
        this.hudSystem.updateHealth(100);
        this.inputManager.requestLock();
      }
    });

    this.combatSystem.networkManager = this.networkManager;
  }

  _setupEventListeners() {
    const blocker = document.getElementById('instructions-blocker');
    if (blocker) {
      blocker.addEventListener('click', () => {
        if (!this.isMatchOver) {
          this.inputManager.requestLock();
        }
      });
    }

    // Botão de Dossiê no HUD
    const btnOpenProfile = document.getElementById('btn-open-profile');
    if (btnOpenProfile) {
      btnOpenProfile.addEventListener('click', (e) => {
        e.stopPropagation();
        this._toggleProfile(true);
      });
    }

    const btnCloseProfile = document.getElementById('btn-close-profile');
    if (btnCloseProfile) {
      btnCloseProfile.addEventListener('click', (e) => {
        e.stopPropagation();
        this._toggleProfile(false);
        this.inputManager.requestLock();
      });
    }

    // Botão de Reinício da Partida (Fase 6)
    const btnRestartMatch = document.getElementById('btn-restart-match');
    if (btnRestartMatch) {
      btnRestartMatch.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.networkManager) {
          this.networkManager.sendRestartMatch();
        } else {
          this.isMatchOver = false;
          this.hudSystem.hideMatchEnd();
          this.playerController.position.set(0, 1.8, 18);
          this.inputManager.requestLock();
        }
      });
    }

    // Salvar Nome
    const btnSaveName = document.getElementById('btn-save-name');
    const nameInput = document.getElementById('profile-name-input');
    if (btnSaveName && nameInput) {
      btnSaveName.addEventListener('click', (e) => {
        e.stopPropagation();
        const val = nameInput.value;
        if (val) {
          this.profileManager.setName(val);
          this.hudSystem.setPlayerSquad(val, '#38bdf8');
          if (this.networkManager) this.networkManager.sendJoin(val);
          this._toggleProfile(false);
          this.inputManager.requestLock();
        }
      });
    }

    // Resetar Perfil
    const btnResetProfile = document.getElementById('btn-reset-profile');
    if (btnResetProfile) {
      btnResetProfile.addEventListener('click', () => {
        if (confirm('Deseja realmente resetar todas as estatísticas e nível do operador?')) {
          this.profileManager.resetProfile();
          this._updateHUDXpBar();
          this._toggleProfile(false);
        }
      });
    }

    // Atalhos de teclado (TAB, P, X, Escape)
    const scoreboard = document.getElementById('scoreboard-modal');
    window.addEventListener('keydown', (e) => {
      if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
        return;
      }

      if (e.code === 'Tab') {
        e.preventDefault();
        if (scoreboard) scoreboard.classList.add('active');
      }
      if (e.code === 'KeyP') {
        e.preventDefault();
        this._toggleProfile();
      }
      if (e.code === 'KeyX') {
        e.preventDefault();
        if (!this.isDead && !this.isMatchOver) {
          this.psychoModeSystem.cycleNextLevel();
        }
      }
      if (e.code === 'Escape' && this.isProfileModalOpen) {
        this._toggleProfile(false);
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Tab') {
        e.preventDefault();
        if (scoreboard) scoreboard.classList.remove('active');
      }
    });

    window.addEventListener('resize', () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.psychoModeSystem.onResize(width, height);
    });
  }

  animate() {
    requestAnimationFrame(this.animate);

    const deltaTime = Math.min(this.clock.getDelta(), 0.1);
    const currentTime = this.clock.getElapsedTime();

    // 1. Atualiza Jogador Local
    if (!this.isDead && !this.isProfileModalOpen && !this.isMatchOver) {
      this.playerController.update(
        deltaTime,
        this.inputManager,
        this.arena.colliders,
        this.audioSystem
      );

      this.hudSystem.updateCompass(this.playerController.yaw);

      // Sobrevivência Tática: Concede XP a cada 30 segundos
      this.survivalTimer += deltaTime;
      if (this.survivalTimer >= 30.0) {
        this.survivalTimer = 0;
        this.profileManager.recordSurvivalTime(30);
      }

      // Disparo e Mira (com Sensibilidade Dinâmica no ADS)
      if (this.inputManager.isPointerLocked) {
        this.combatSystem.setAiming(this.inputManager.mouse.rightButton, this.inputManager);

        if (this.inputManager.mouse.leftButton) {
          this.combatSystem.tryShoot(currentTime);
        }

        if (this.inputManager.keys.reload) {
          this.combatSystem.reload(currentTime);
        }
      } else {
        this.combatSystem.setAiming(false, this.inputManager);
      }
    } else if (this.isDead) {
      if (this.respawnRemaining > 0) {
        this.respawnRemaining -= deltaTime;
        this.hudSystem.showRespawnScreen(true, this.respawnRemaining);
      }
    }

    // 2. Envio de Rede a 30 Hz
    if (currentTime - this.lastNetSend >= 0.033) {
      this.lastNetSend = currentTime;
      if (this.networkManager && !this.isDead) {
        this.networkManager.sendPlayerUpdate(
          this.playerController.position,
          this.camera.rotation,
          this.combatSystem.currentWeaponKey,
          this.playerController.isMoving,
          this.playerController.isSprinting
        );
      }
    }

    // 3. Atualiza Jogadores Remotos
    this.playerManager.update(deltaTime);

    // 4. Atualiza Arma Local (Viewmodel)
    this.weaponSystem.update(
      deltaTime,
      this.playerController.lastMouseDelta || { deltaX: 0, deltaY: 0 },
      this.playerController.isMoving,
      this.playerController.isSprinting
    );

    // 5. Atualiza Sistema de Combate
    this.combatSystem.update(deltaTime, currentTime);

    // 6. Atualiza Manequins de Treino
    this.dummies.forEach(dummy => dummy.update(deltaTime));

    // 7. Atualiza Sistema de Psycho Mode e Pós-Processamento
    this.psychoModeSystem.update(deltaTime, currentTime);

    // Ajusta FOV dinamicamente com base no ADS (zoomFov) da arma + Adrenalina do Psycho Mode
    const baseFov = (this.combatSystem.isAiming && this.combatSystem.weaponConfig && this.combatSystem.weaponConfig.zoomFov)
      ? this.combatSystem.weaponConfig.zoomFov
      : 75;
    const targetFov = baseFov + (this.psychoModeSystem ? this.psychoModeSystem.getFovOffset() : 0);
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, Math.max(15, Math.min(115, targetFov)), deltaTime * 12.0);
    this.camera.updateProjectionMatrix();

    // 8. Renderiza Cena 3D com Efeitos de Pós-Processamento do Psycho Mode
    this.psychoModeSystem.render();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new Game();
});
