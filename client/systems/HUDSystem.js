export class HUDSystem {
  constructor() {
    this.elements = {
      healthValue: document.getElementById('health-val'),
      healthFill: document.getElementById('health-fill'),
      ammoCurrent: document.getElementById('ammo-current'),
      ammoReserve: document.getElementById('ammo-reserve'),
      weaponName: document.getElementById('weapon-name'),
      reloadPrompt: document.getElementById('reload-prompt'),
      reloadBar: document.getElementById('reload-progress-bar'),
      reloadContainer: document.getElementById('reload-container'),
      crosshair: document.getElementById('crosshair'),
      hitmarker: document.getElementById('hitmarker'),
      killNotification: document.getElementById('kill-notification'),
      killBanner: document.getElementById('kill-banner'),
      blocker: document.getElementById('instructions-blocker'),
      sniperScope: document.getElementById('sniper-scope-overlay'),
      damageVignette: document.getElementById('damage-vignette'),
      respawnScreen: document.getElementById('respawn-screen'),
      respawnTimerText: document.getElementById('respawn-timer-text'),
      scoreboardList: document.getElementById('scoreboard-list'),
      compassDegrees: document.getElementById('compass-degrees'),
      playerSquadTag: document.getElementById('player-squad-tag'),

      // Elementos de Progressão e XP (Fase 4)
      hudRankTag: document.getElementById('hud-rank-tag'),
      hudRankName: document.getElementById('hud-rank-name'),
      hudXpFill: document.getElementById('hud-xp-fill'),
      hudXpNumbers: document.getElementById('hud-xp-numbers'),
      xpToastContainer: document.getElementById('xp-toast-container'),
      levelUpModal: document.getElementById('levelup-modal'),
      levelUpTitle: document.getElementById('levelup-title'),
      levelUpRank: document.getElementById('levelup-rank'),

      // Modal do Dossiê do Operador
      profileModal: document.getElementById('profile-modal'),
      profileNameInput: document.getElementById('profile-name-input'),
      profileRankName: document.getElementById('profile-rank-name'),
      profileRankTag: document.getElementById('profile-rank-tag'),
      profileXpBar: document.getElementById('profile-xp-bar'),
      profileXpText: document.getElementById('profile-xp-text'),
      statKills: document.getElementById('stat-kills'),
      statDeaths: document.getElementById('stat-deaths'),
      statKd: document.getElementById('stat-kd'),
      statHeadshots: document.getElementById('stat-headshots'),
      statAccuracy: document.getElementById('stat-accuracy'),
      statDamage: document.getElementById('stat-damage'),
      statShots: document.getElementById('stat-shots'),

      // Elementos do Psycho Mode / Sobrecarga Tática (Fase 5)
      hudLayer: document.getElementById('hud-layer'),
      psychoHudContainer: document.getElementById('psycho-hud-container'),
      psychoBadge: document.getElementById('psycho-badge'),
      psychoLabel: document.getElementById('psycho-label'),
      psychoTimerBar: document.getElementById('psycho-timer-bar'),

      // Modal de Fim de Partida / MVP (Fase 6)
      matchEndModal: document.getElementById('match-end-modal'),
      matchEndTitle: document.getElementById('match-end-title'),
      matchEndSubtitle: document.getElementById('match-end-subtitle'),
      mvpName: document.getElementById('mvp-name'),
      mvpBadge: document.getElementById('mvp-badge'),
      endStatKills: document.getElementById('end-stat-kills'),
      endStatAccuracy: document.getElementById('end-stat-accuracy'),
      endStatXp: document.getElementById('end-stat-xp'),

      weaponSlots: [
        document.getElementById('slot-1'),
        document.getElementById('slot-2'),
        document.getElementById('slot-3'),
        document.getElementById('slot-4')
      ]
    };

    this.hitmarkerTimeout = null;
    this.killTimeout = null;
    this.vignetteTimeout = null;
    this.levelUpTimeout = null;
    this.kills = 0;
  }

  setPointerLockState(isLocked) {
    if (!this.elements.blocker) return;

    if (isLocked) {
      this.hasGameStarted = true;
      this.elements.blocker.classList.add('hidden');
    } else {
      // Se o jogo já iniciou, NUNCA mais exibe a tela escura de instruções inicial
      if (this.hasGameStarted) {
        this.elements.blocker.classList.add('hidden');
      } else {
        this.elements.blocker.classList.remove('hidden');
      }
    }
  }

  setPlayerSquad(name, color) {
    if (this.elements.playerSquadTag) {
      this.elements.playerSquadTag.textContent = name.toUpperCase();
      this.elements.playerSquadTag.style.color = color;
      this.elements.playerSquadTag.style.borderColor = color;
    }
  }

  // --- ATUALIZAÇÃO DA BARRA DE PROGRESSÃO / XP NO HUD ---
  updateXp(level, currentXp, neededXp, rankInfo) {
    if (this.elements.hudRankTag) {
      this.elements.hudRankTag.textContent = `[${rankInfo.tag || 'LVL ' + level}]`;
    }
    if (this.elements.hudRankName) {
      this.elements.hudRankName.textContent = rankInfo.name || `Nível ${level}`;
    }
    if (this.elements.hudXpNumbers) {
      this.elements.hudXpNumbers.textContent = `${currentXp} / ${neededXp} XP`;
    }
    if (this.elements.hudXpFill) {
      const pct = Math.max(0, Math.min(100, (currentXp / neededXp) * 100));
      this.elements.hudXpFill.style.width = `${pct}%`;
    }
  }

  // Toast flutuante de ganho de XP
  showXpToast(amount, reason = 'AÇÃO DE COMBATE') {
    if (!this.elements.xpToastContainer) return;

    const toast = document.createElement('div');
    toast.className = 'xp-toast';
    toast.innerHTML = `<span>+${amount} XP</span> <small>${reason}</small>`;
    this.elements.xpToastContainer.appendChild(toast);

    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 1800);
  }

  // Banner de Promoção de Patente (Level Up!)
  showLevelUpBanner(level, rankInfo) {
    if (!this.elements.levelUpModal) return;
    if (this.levelUpTimeout) clearTimeout(this.levelUpTimeout);

    if (this.elements.levelUpTitle) {
      this.elements.levelUpTitle.textContent = `PROMOÇÃO: NÍVEL ${level}`;
    }
    if (this.elements.levelUpRank) {
      this.elements.levelUpRank.textContent = `PATENTE CONCEDIDA: ${rankInfo.name.toUpperCase()} [${rankInfo.tag}]`;
    }

    this.elements.levelUpModal.classList.add('active');

    this.levelUpTimeout = setTimeout(() => {
      if (this.elements.levelUpModal) {
        this.elements.levelUpModal.classList.remove('active');
      }
    }, 3800);
  }

  // --- DOSSIÊ DO OPERADOR (MODAL DE PERFIL) ---
  toggleProfileModal(isOpen, profile, rankInfo, accuracy, kd) {
    if (!this.elements.profileModal) return;

    if (isOpen) {
      this.elements.profileModal.classList.add('active');
      if (this.elements.blocker) {
        this.elements.blocker.classList.add('hidden');
      }
      this.updateDossierStats(profile, rankInfo, accuracy, kd);
    } else {
      this.elements.profileModal.classList.remove('active');
    }
  }

  updateDossierStats(profile, rankInfo, accuracy, kd) {
    if (!profile) return;

    if (this.elements.profileNameInput && document.activeElement !== this.elements.profileNameInput) {
      this.elements.profileNameInput.value = profile.name;
    }
    if (this.elements.profileRankName) {
      this.elements.profileRankName.textContent = rankInfo.name;
    }
    if (this.elements.profileRankTag) {
      this.elements.profileRankTag.textContent = `PATENTE: ${rankInfo.tag} (NÍVEL ${profile.level})`;
    }
    if (this.elements.profileXpBar) {
      const pct = Math.max(0, Math.min(100, (profile.currentXp / rankInfo.neededXp) * 100));
      this.elements.profileXpBar.style.width = `${pct}%`;
    }
    if (this.elements.profileXpText) {
      this.elements.profileXpText.textContent = `${profile.currentXp} / ${rankInfo.neededXp} XP (Total: ${profile.totalXp} XP)`;
    }

    if (this.elements.statKills) this.elements.statKills.textContent = profile.stats.kills;
    if (this.elements.statDeaths) this.elements.statDeaths.textContent = profile.stats.deaths;
    if (this.elements.statKd) this.elements.statKd.textContent = kd;
    if (this.elements.statHeadshots) this.elements.statHeadshots.textContent = profile.stats.headshots;
    if (this.elements.statAccuracy) this.elements.statAccuracy.textContent = `${accuracy}%`;
    if (this.elements.statDamage) this.elements.statDamage.textContent = profile.stats.damageDealt;
    if (this.elements.statShots) this.elements.statShots.textContent = `${profile.stats.shotsHit} / ${profile.stats.shotsFired}`;
  }

  updateCompass(yaw) {
    if (!this.elements.compassDegrees) return;
    let deg = Math.round((-yaw * (180 / Math.PI)) % 360);
    if (deg < 0) deg += 360;

    let heading = `${deg}° `;
    if (deg >= 338 || deg < 23) heading += 'N';
    else if (deg >= 23 && deg < 68) heading += 'NE';
    else if (deg >= 68 && deg < 113) heading += 'E';
    else if (deg >= 113 && deg < 158) heading += 'SE';
    else if (deg >= 158 && deg < 203) heading += 'S';
    else if (deg >= 203 && deg < 248) heading += 'SW';
    else if (deg >= 248 && deg < 293) heading += 'W';
    else heading += 'NW';

    this.elements.compassDegrees.textContent = heading;
  }

  setActiveWeaponSlot(slotIndex, weaponConfig) {
    this.elements.weaponSlots.forEach((slotEl, idx) => {
      if (!slotEl) return;
      if (idx === slotIndex) {
        slotEl.classList.add('active');
        slotEl.style.borderColor = weaponConfig.color || '#38bdf8';
        slotEl.style.boxShadow = `0 0 10px ${weaponConfig.color || '#38bdf8'}33`;
      } else {
        slotEl.classList.remove('active');
        slotEl.style.borderColor = 'rgba(71, 85, 105, 0.4)';
        slotEl.style.boxShadow = 'none';
      }
    });

    if (this.elements.weaponName) {
      this.elements.weaponName.textContent = weaponConfig.name.toUpperCase();
      this.elements.weaponName.style.color = weaponConfig.color || '#f8fafc';
    }
  }

  showSniperScope(isActive) {
    if (!this.elements.sniperScope) return;
    if (isActive) {
      this.elements.sniperScope.classList.add('active');
      if (this.elements.crosshair) this.elements.crosshair.style.opacity = '0';
    } else {
      this.elements.sniperScope.classList.remove('active');
      if (this.elements.crosshair) this.elements.crosshair.style.opacity = '1';
    }
  }

  updateHealth(current, max = 100) {
    if (this.elements.healthValue) {
      this.elements.healthValue.textContent = `${Math.round(current)}`;
    }
    if (this.elements.healthFill) {
      const pct = Math.max(0, Math.min(100, (current / max) * 100));
      this.elements.healthFill.style.width = `${pct}%`;
      if (pct > 50) {
        this.elements.healthFill.style.background = 'linear-gradient(90deg, #16a34a, #22c55e)';
      } else if (pct > 25) {
        this.elements.healthFill.style.background = 'linear-gradient(90deg, #d97706, #eab308)';
      } else {
        this.elements.healthFill.style.background = 'linear-gradient(90deg, #b91c1c, #ef4444)';
      }
    }
  }

  flashDamageVignette() {
    if (!this.elements.damageVignette) return;
    if (this.vignetteTimeout) clearTimeout(this.vignetteTimeout);

    this.elements.damageVignette.classList.add('active');
    this.vignetteTimeout = setTimeout(() => {
      if (this.elements.damageVignette) {
        this.elements.damageVignette.classList.remove('active');
      }
    }, 180);
  }

  showRespawnScreen(isDead, remainingTime = 4) {
    if (!this.elements.respawnScreen) return;

    if (isDead) {
      this.elements.respawnScreen.classList.add('active');
      if (this.elements.respawnTimerText) {
        this.elements.respawnTimerText.textContent = `REAGRUPANDO EM ${Math.ceil(remainingTime)}S...`;
      }
    } else {
      this.elements.respawnScreen.classList.remove('active');
    }
  }

  updateScoreboard(players) {
    if (!this.elements.scoreboardList) return;
    this.elements.scoreboardList.innerHTML = '';

    players.forEach((p, idx) => {
      const row = document.createElement('div');
      row.className = 'score-row';
      row.innerHTML = `
        <span class="col-slot" style="color: ${p.color}">[OP ${idx + 1}]</span>
        <span class="col-name">${p.name}</span>
        <span class="col-stat">${p.kills}</span>
        <span class="col-stat">${p.deaths}</span>
        <span class="col-status ${p.isDead ? 'dead' : 'alive'}">${p.isDead ? 'ELIMINADO' : 'ATIVO'}</span>
      `;
      this.elements.scoreboardList.appendChild(row);
    });
  }

  updateAmmo(current, reserve, magSize) {
    if (this.elements.ammoCurrent) {
      this.elements.ammoCurrent.textContent = current;
      if (current === 0) {
        this.elements.ammoCurrent.classList.add('ammo-empty');
      } else if (current <= Math.ceil(magSize * 0.25)) {
        this.elements.ammoCurrent.classList.add('ammo-low');
        this.elements.ammoCurrent.classList.remove('ammo-empty');
      } else {
        this.elements.ammoCurrent.classList.remove('ammo-low', 'ammo-empty');
      }
    }
    if (this.elements.ammoReserve) {
      this.elements.ammoReserve.textContent = `/ ${reserve}`;
    }

    if (this.elements.reloadPrompt) {
      if (current === 0 && reserve > 0) {
        this.elements.reloadPrompt.textContent = 'APERTE [R] PARA RECARREGAR';
        this.elements.reloadPrompt.style.opacity = '1';
      } else {
        this.elements.reloadPrompt.style.opacity = '0';
      }
    }
  }

  triggerCrosshairKick() {
    if (!this.elements.crosshair) return;
    this.elements.crosshair.classList.add('crosshair-kick');
    setTimeout(() => {
      if (this.elements.crosshair) {
        this.elements.crosshair.classList.remove('crosshair-kick');
      }
    }, 60);
  }

  showHitmarker(type = 'body') {
    if (!this.elements.hitmarker) return;

    if (this.hitmarkerTimeout) clearTimeout(this.hitmarkerTimeout);

    this.elements.hitmarker.className = 'hitmarker active ' + type;

    this.hitmarkerTimeout = setTimeout(() => {
      if (this.elements.hitmarker) {
        this.elements.hitmarker.className = 'hitmarker';
      }
    }, 110);
  }

  showReloading(isReloading, duration = 1.8) {
    if (!this.elements.reloadContainer || !this.elements.reloadBar) return;

    if (isReloading) {
      this.elements.reloadContainer.style.display = 'block';
      this.elements.reloadBar.style.transition = 'none';
      this.elements.reloadBar.style.width = '0%';
      void this.elements.reloadBar.offsetWidth;
      this.elements.reloadBar.style.transition = `width ${duration}s linear`;
      this.elements.reloadBar.style.width = '100%';
    } else {
      this.elements.reloadContainer.style.display = 'none';
      this.elements.reloadBar.style.width = '0%';
    }
  }

  showKillNotification(text = 'ALVO ELIMINADO (+100 XP)') {
    if (!this.elements.killNotification) return;

    if (this.killTimeout) clearTimeout(this.killTimeout);

    if (this.elements.killBanner) {
      this.elements.killBanner.textContent = text;
    }

    this.elements.killNotification.classList.remove('show');
    void this.elements.killNotification.offsetWidth;
    this.elements.killNotification.classList.add('show');

    this.killTimeout = setTimeout(() => {
      if (this.elements.killNotification) {
        this.elements.killNotification.classList.remove('show');
      }
    }, 2200);
  }

  // Atualização do Indicador de Psycho Mode / Sobrecarga de Adrenalina no HUD
  updatePsychoMode(level, duration, maxDuration) {
    if (!this.elements.psychoHudContainer) return;

    if (level > 0 && duration > 0) {
      this.elements.psychoHudContainer.classList.add('active');
      this.elements.psychoHudContainer.className = `psycho-hud-container active level-${level}`;

      if (this.elements.psychoBadge) {
        this.elements.psychoBadge.textContent = `NÍVEL ${level}`;
      }

      if (this.elements.psychoLabel) {
        const names = ['', 'ADRENALINA FOCUS', 'COMBAT RUSH', 'CONCUSSÃO TÁTICA', 'SOBRECARGA EXTREMA'];
        this.elements.psychoLabel.textContent = names[level] || 'SOBRECARGA';
      }

      if (this.elements.psychoTimerBar) {
        const pct = Math.max(0, Math.min(100, (duration / maxDuration) * 100));
        this.elements.psychoTimerBar.style.width = `${pct}%`;
      }

      // Efeito de tremor no HUD nos níveis 3 e 4
      if (this.elements.hudLayer) {
        if (level >= 3) {
          this.elements.hudLayer.classList.add('hud-glitch');
        } else {
          this.elements.hudLayer.classList.remove('hud-glitch');
        }
      }
    } else {
      this.elements.psychoHudContainer.classList.remove('active');
      if (this.elements.hudLayer) {
        this.elements.hudLayer.classList.remove('hud-glitch');
      }
    }
  }

  // --- TELA DE FIM DE PARTIDA / VITÓRIA / MVP (FASE 6) ---
  showMatchEnd(isWinner, winnerName, winnerColor, localKills, accuracy, xpGained = 250) {
    if (!this.elements.matchEndModal) return;

    if (this.elements.blocker) this.elements.blocker.classList.add('hidden');
    this.elements.matchEndModal.classList.add('active');

    if (this.elements.matchEndTitle) {
      this.elements.matchEndTitle.textContent = isWinner ? '🏆 VITÓRIA DA OPERAÇÃO 🏆' : 'OPERAÇÃO ENCERRADA';
      this.elements.matchEndTitle.style.color = isWinner ? '#fbbf24' : '#f8fafc';
    }

    if (this.elements.matchEndSubtitle) {
      this.elements.matchEndSubtitle.textContent = isWinner
        ? 'PARABÉNS! SEU ESQUADRÃO ATINGIU O LIMITE DE 10 ELIMINAÇÕES'
        : 'O LIMITE DE ELIMINAÇÕES DA MISSÃO FOI ALCANÇADO';
    }

    if (this.elements.mvpName) {
      this.elements.mvpName.textContent = winnerName.toUpperCase();
      this.elements.mvpName.style.color = winnerColor || '#38bdf8';
    }

    if (this.elements.endStatKills) this.elements.endStatKills.textContent = localKills;
    if (this.elements.endStatAccuracy) this.elements.endStatAccuracy.textContent = `${accuracy}%`;
    if (this.elements.endStatXp) this.elements.endStatXp.textContent = `+${xpGained} XP`;
  }

  hideMatchEnd() {
    if (this.elements.matchEndModal) {
      this.elements.matchEndModal.classList.remove('active');
    }
  }
}
