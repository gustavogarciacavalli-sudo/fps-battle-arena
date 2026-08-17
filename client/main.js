import * as THREE from 'three';
import { Arena } from './scenes/Arena.js';
import { TargetDummy } from './scenes/TargetDummy.js';
import { TitleScene } from './scenes/TitleScene.js';
import { InputManager } from './systems/InputManager.js';
import { PlayerController } from './systems/PlayerController.js';
import { WeaponSystem } from './systems/WeaponSystem.js';
import { CombatSystem } from './systems/CombatSystem.js';
import { BallisticsSystem } from './systems/BallisticsSystem.js';
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

    // Estados do Jogo: 'LOBBY' ou 'IN_GAME'
    this.gameState = 'LOBBY';

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

    // Inicia no Lobby 3D de DEADLY SHOT
    this.setGameState('LOBBY');

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
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.shadowMap.autoUpdate = true;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xd8b88f);
    this.scene.fog = new THREE.FogExp2(0xc9a37a, 0.0085);

    this.camera = new THREE.PerspectiveCamera(
      72,
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

    // 1. Sistema de Perfil e Progressão
    this.profileManager = new ProfileManager({
      onXpGain: (amount, reason) => {
        this.audioSystem.playXpGain();
        this.hudSystem.showXpToast(amount, reason);
        this._updateHUDXpBar();
        this._syncLobbyProfile();
      },
      onLevelUp: (newLevel, newRank) => {
        this.audioSystem.playLevelUp();
        this.hudSystem.showLevelUpBanner(newLevel, newRank);
        this._updateHUDXpBar();
        this._syncLobbyProfile();
      },
      onProfileChange: () => {
        this._updateHUDXpBar();
        this._syncLobbyProfile();
      }
    });

    // 2. Sistema de Psycho Mode / Pós-processamento
    this.psychoModeSystem = new PsychoModeSystem(
      this.renderer,
      this.scene,
      this.camera,
      this.audioSystem,
      this.hudSystem
    );

    this.playerManager = new PlayerManager(this.scene);
    this.weaponSystem = new WeaponSystem(this.camera, this.scene);

    // 3. Sistema de Balística
    this.ballisticsSystem = new BallisticsSystem(this.scene);

    // 4. Sistema de Combate
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
    this.combatSystem.ballisticsSystem = this.ballisticsSystem;

    // 5. Entradas
    this.inputManager = new InputManager(
      this.canvas,
      (isLocked) => {
        if (this.gameState === 'IN_GAME') {
          this.hudSystem.setPointerLockState(isLocked);
          if (isLocked) {
            this.audioSystem.ensureContext();
            if (this.isProfileModalOpen) this._toggleProfile(false);
          }
        }
      },
      (slotIndex) => {
        if (this.gameState === 'IN_GAME' && !this.isDead && !this.isProfileModalOpen && !this.isMatchOver) {
          this.combatSystem.selectWeapon(slotIndex);
        }
      },
      (direction) => {
        if (this.gameState === 'IN_GAME' && !this.isDead && !this.isProfileModalOpen && !this.isMatchOver) {
          this.combatSystem.cycleWeapon(direction);
        }
      }
    );

    // 6. Cenas: Arena de Combate e Lobby 3D de DEADLY SHOT
    this.arena = new Arena(this.scene);
    this.titleScene = new TitleScene(this.scene, this.camera);

    this.dummies = [
      new TargetDummy(this.scene, new THREE.Vector3(0, 0, -8)),
      new TargetDummy(this.scene, new THREE.Vector3(0, 2.8, 0)),
      new TargetDummy(this.scene, new THREE.Vector3(-14, 0, -10))
    ];

    this.playerController = new PlayerController(this.camera, new THREE.Vector3(0, 1.8, 18));
    this.combatSystem.setTargets(this.dummies, this.arena.shootableMeshes);

    // Configura IA e tiro dos bots
    this.dummies.forEach(bot => {
      bot.getVisibilityObjects = () => [...this.arena.shootableMeshes];
      bot.onBotAttack = (player) => {
        this.botFireAtPlayer(bot, player);
      };
    });
  }

  botFireAtPlayer(bot, player) {
    if (!player || this.isDead || this.gameState !== 'IN_GAME') return;

    const origin = bot.group.position.clone();
    origin.y += 1.45;

    const target = player.position.clone();
    target.y -= 0.25;

    const direction = target.sub(origin).normalize();

    // Dispersão balística e imperfeição de mira do bot
    const spread = 0.045;
    direction.x += (Math.random() - 0.5) * spread;
    direction.y += (Math.random() - 0.5) * spread;
    direction.z += (Math.random() - 0.5) * spread;
    direction.normalize();

    const ray = new THREE.Raycaster(origin, direction, 0, 40);
    const obstacles = [...this.arena.shootableMeshes];
    const hits = ray.intersectObjects(obstacles, false);

    const distToPlayer = origin.distanceTo(player.position);
    const isBlocked = hits.length > 0 && hits[0].distance < distToPlayer;

    // Traçante de tiro do bot
    const tracerEnd = isBlocked ? hits[0].point : player.position.clone();
    this.combatSystem._spawnTracer(origin, tracerEnd, 0xff5533);
    this.audioSystem.playGunshot('m4a1');

    if (!isBlocked && distToPlayer < 35) {
      // Dano causado pelo bot no jogador
      const damage = Math.floor(12 + Math.random() * 8);
      this.hudSystem.triggerDamageFlash();
      this.audioSystem.playHitImpact();
      this.playerController.currentHealth = Math.max(0, this.playerController.currentHealth - damage);
      this.hudSystem.updateHealth(this.playerController.currentHealth, this.playerController.maxHealth);

      if (this.playerController.currentHealth <= 0) {
        this.isDead = true;
        this.respawnRemaining = 4.0;
        this.hudSystem.showRespawnScreen(true, 4.0);
        this.hudSystem.showKillNotification(`💀 VOCÊ FOI ELIMINADO POR UM OPERADOR BOT!`);
      }
    }
  }

  setGameState(newState) {
    this.gameState = newState;
    const titleScreen = document.getElementById('title-screen');
    const hudLayer = document.getElementById('hud-layer');
    const pausePrompt = document.getElementById('pause-prompt');

    if (newState === 'LOBBY') {
      this.titleScene.show();
      this.titleScene.setCameraPosition();
      this.weaponSystem.viewmodelGroup.visible = false;

      if (titleScreen) titleScreen.classList.remove('hidden');
      if (hudLayer) hudLayer.style.display = 'none';
      if (pausePrompt) pausePrompt.classList.remove('active');

      this.inputManager.exitLock();
      this._syncLobbyProfile();
      this._updateLobbySquad();
    } else if (newState === 'IN_GAME') {
      this.titleScene.hide();
      this.weaponSystem.viewmodelGroup.visible = true;

      if (titleScreen) titleScreen.classList.add('hidden');
      if (hudLayer) hudLayer.style.display = 'block';

      this.playerController.setPosition(0, 1.8, 18);
      this.playerController.yaw = 0;
      this.playerController.pitch = 0;

      this.inputManager.requestLock();
      this.hudSystem.setPointerLockState(true);
    }
  }

  _setupProfile() {
    this._updateHUDXpBar();
    this._syncLobbyProfile();
  }

  _syncLobbyProfile() {
    const prof = this.profileManager.profile;
    const rankInfo = this.profileManager.getRankInfo(prof.level);

    const nameEl = document.getElementById('lobby-profile-name');
    const rankEl = document.getElementById('lobby-profile-rank');
    const xpFillEl = document.getElementById('lobby-xp-fill');
    const showcaseNameEl = document.getElementById('showcase-operator-name');
    const squadLocalNameEl = document.getElementById('squad-local-name');

    if (nameEl) nameEl.textContent = prof.name.toUpperCase();
    if (rankEl) rankEl.textContent = `${rankInfo.name.toUpperCase()} • NÍVEL ${prof.level} [${rankInfo.tag}]`;
    if (showcaseNameEl) showcaseNameEl.textContent = prof.name.toUpperCase();
    if (squadLocalNameEl) squadLocalNameEl.textContent = prof.name.toUpperCase();

    if (xpFillEl) {
      const pct = Math.max(0, Math.min(100, (prof.currentXp / rankInfo.neededXp) * 100));
      xpFillEl.style.width = `${pct}%`;
    }
  }

  _updateLobbySquad() {
    const localProf = this.profileManager.profile;
    const squad = [
      { name: localProf.name, isLeader: true, camoColor: 0x181e26, color: '#38bdf8', weapon: 'm4a1' }
    ];

    // Adiciona operadores remotos conectados ao esquadrão do lobby
    if (this.playerManager && this.playerManager.remotePlayers) {
      this.playerManager.remotePlayers.forEach((p) => {
        squad.push({
          name: p.name || 'Aliado',
          isLeader: false,
          camoColor: 0x273549,
          color: p.squadColor || '#4ade80',
          weapon: 'mp5'
        });
      });
    }

    this.titleScene.setSquad(squad);
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

    this.hudSystem.toggleProfileModal(
      this.isProfileModalOpen,
      prof,
      rankInfo,
      accuracy,
      kd
    );

    if (this.isProfileModalOpen) {
      this.inputManager.exitLock();
    }
  }

  _setupNetwork() {
    this.networkManager = new NetworkManager({
      onConnect: () => {
        console.log('[DEADLY SHOT] Conectado ao Servidor WebSocket 30 Hz');
        this.networkManager.sendJoin(this.profileManager.profile.name);
      },
      onInit: (msg) => {
        this.selfId = msg.id;
        this.hudSystem.setPlayerSquad(msg.squad.name, msg.squad.color);
        this._updateLobbySquad();
      },
      onPlayerJoined: (p) => {
        this.playerManager.addPlayer(p);
        this.hudSystem.showXpToast(25, `OPERADOR ${p.name.toUpperCase()} REAGRUPOU`);
        this._updateLobbySquad();
      },
      onPlayerLeft: (id) => {
        this.playerManager.removePlayer(id);
        this._updateLobbySquad();
      },
      onSnapshot: (snapshot) => {
        this.playerManager.remotePlayers.forEach((player, id) => {
          const state = snapshot.players.find(p => p.id === id);
          if (state) {
            player.updateState(state);
          }
        });
      },
      onPlayerDied: (msg) => {
        if (msg.victimId === this.selfId) {
          this.isDead = true;
          this.respawnRemaining = msg.respawnTime || 4.0;
          this.currentKillstreak = 0;
          this.profileManager.recordDeath();
          this.audioSystem.playDeath();
          this.hudSystem.showRespawnScreen(true, this.respawnRemaining);
          this.inputManager.exitLock();
        } else if (msg.killerId === this.selfId) {
          this.currentKillstreak++;
          this.hudSystem.kills = this.profileManager.profile.stats.kills;
          this.audioSystem.playKillConfirm();
          this.hudSystem.showKillNotification('🎯 OPERADOR INIMIGO ELIMINADO (+100 XP)');
          this.profileManager.recordKill(false);
          this.profileManager.addXp(100, 'ELIMINAÇÃO DE OPERADOR');

          if (this.currentKillstreak >= 3) {
            this.psychoModeSystem.triggerLevel(1, 10.0);
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
          if (this.gameState === 'IN_GAME') {
            this.inputManager.requestLock();
          }
        }
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
          this.profileManager.recordDamage(msg.damage);
        }
      },
      onMatchEnded: (msg) => {
        this.isMatchOver = true;
        const isWinner = msg.winnerSquad === this.networkManager.squadName;

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
        if (this.gameState === 'IN_GAME') {
          this.inputManager.requestLock();
        }
      }
    });

    this.combatSystem.networkManager = this.networkManager;
  }

  _setupEventListeners() {
    // Clique global para capturar áudio
    window.addEventListener('click', () => {
      this.audioSystem.ensureContext();
    });

    // 1. Botão JOGAR no Lobby
    const btnPlay = document.getElementById('btn-play-game');
    if (btnPlay) {
      btnPlay.addEventListener('click', (e) => {
        e.stopPropagation();
        this.audioSystem.ensureContext();
        this.audioSystem.playGunshot('m4a1');
        this.setGameState('IN_GAME');
      });
    }

    // 2. Botão Personalizar / Dossiê no Lobby
    const btnCustomization = document.getElementById('btn-open-customization');
    if (btnCustomization) {
      btnCustomization.addEventListener('click', (e) => {
        e.stopPropagation();
        this._toggleProfile(true);
      });
    }

    const btnLobbyProfile = document.getElementById('btn-lobby-profile');
    if (btnLobbyProfile) {
      btnLobbyProfile.addEventListener('click', (e) => {
        e.stopPropagation();
        this._toggleProfile(true);
      });
    }

    const btnLobbyAudio = document.getElementById('btn-lobby-audio');
    if (btnLobbyAudio) {
      btnLobbyAudio.addEventListener('click', (e) => {
        e.stopPropagation();
        this.audioSystem.ensureContext();
      });
    }

    // 3. Botão de Dossiê no HUD durante o jogo
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
        if (this.gameState === 'IN_GAME') {
          this.inputManager.requestLock();
        }
      });
    }

    // 4. Botão de Retorno ao Lobby no Fim da Partida
    const btnReturnLobby = document.getElementById('btn-return-lobby');
    if (btnReturnLobby) {
      btnReturnLobby.addEventListener('click', (e) => {
        e.stopPropagation();
        this.hudSystem.hideMatchEnd();
        this.isMatchOver = false;
        this.setGameState('LOBBY');
      });
    }

    // Botão de Reinício da Partida
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

    // Salvar Nome no Dossiê
    const btnSaveName = document.getElementById('btn-save-name');
    const nameInput = document.getElementById('profile-name-input');
    if (btnSaveName && nameInput) {
      btnSaveName.addEventListener('click', (e) => {
        e.stopPropagation();
        const val = nameInput.value.trim();
        if (val) {
          this.profileManager.setName(val);
          this.hudSystem.setPlayerSquad(val, '#38bdf8');
          if (this.networkManager) this.networkManager.sendJoin(val);
          this._syncLobbyProfile();
          this._toggleProfile(false);
          if (this.gameState === 'IN_GAME') {
            this.inputManager.requestLock();
          }
        }
      });
    }

    // Resetar Perfil
    const btnResetProfile = document.getElementById('btn-reset-profile');
    if (btnResetProfile) {
      btnResetProfile.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('Tem certeza que deseja resetar todo o progresso militar?')) {
          this.profileManager.resetProfile();
          this._syncLobbyProfile();
          this._updateHUDXpBar();
          this._toggleProfile(false);
        }
      });
    }

    // Atalho de Teclado [P] para abrir/fechar Dossiê
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyP' && !e.repeat) {
        if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
        this._toggleProfile();
      }
      if (e.code === 'Escape') {
        if (this.isProfileModalOpen) {
          this._toggleProfile(false);
        }
      }
    });

    // Redimensionamento de Janela
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

    // =========================================================
    // ESTADO 1: LOBBY 3D (DEADLY SHOT)
    // =========================================================
    if (this.gameState === 'LOBBY') {
      this.titleScene.update(deltaTime);
      this.titleScene.setCameraPosition();
      this.renderer.render(this.scene, this.camera);
      return;
    }

    // =========================================================
    // ESTADO 2: IN_GAME (COMBATE FPS NA ARENA)
    // =========================================================
    const canControlPlayer = !this.isDead && !this.isProfileModalOpen && !this.isMatchOver;

    if (canControlPlayer) {
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

    // 5. Atualiza Sistema de Balística e Combate
    if (this.ballisticsSystem) {
      this.ballisticsSystem.update(deltaTime);
      this.ballisticsSystem.updateEffects(deltaTime);
    }
    this.combatSystem.update(deltaTime, currentTime);

    // 6. Atualiza Bots Inimigos com rastreamento do jogador
    this.dummies.forEach(dummy => dummy.update(deltaTime, this.playerController));

    // 7. Atualiza Sistema de Psycho Mode e Pós-Processamento
    this.psychoModeSystem.update(deltaTime, currentTime);

    // Ajusta FOV dinamicamente com base no ADS (zoomFov) da arma + Adrenalina do Psycho Mode
    const baseFov = (this.combatSystem.isAiming && this.combatSystem.weaponConfig && this.combatSystem.weaponConfig.zoomFov)
      ? this.combatSystem.weaponConfig.zoomFov
      : 75;
    const targetFov = baseFov + (this.psychoModeSystem ? this.psychoModeSystem.getFovOffset() : 0);
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, Math.max(15, Math.min(115, targetFov)), deltaTime * 12.0);
    this.camera.updateProjectionMatrix();

    // 8. Renderiza Cena 3D
    this.psychoModeSystem.render();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new Game();
});
