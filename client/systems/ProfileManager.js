// Gerenciador de Perfil, Progressão, Níveis e Estatísticas do Operador

export const MILITARY_RANKS = [
  { level: 1, name: 'Recruta', tag: 'PVT', neededXp: 100 },
  { level: 2, name: 'Soldado de 1ª Classe', tag: 'PFC', neededXp: 150 },
  { level: 3, name: 'Cabo', tag: 'CPL', neededXp: 200 },
  { level: 4, name: '3º Sargento', tag: 'SGT', neededXp: 250 },
  { level: 5, name: '1º Sargento', tag: '1SG', neededXp: 300 },
  { level: 6, name: 'Subtenente', tag: 'WO', neededXp: 350 },
  { level: 7, name: 'Tenente', tag: 'LT', neededXp: 400 },
  { level: 8, name: 'Capitão', tag: 'CPT', neededXp: 450 },
  { level: 9, name: 'Major', tag: 'MAJ', neededXp: 500 },
  { level: 10, name: 'Coronel Comandante', tag: 'COL', neededXp: 600 }
];

export class ProfileManager {
  constructor(options = {}) {
    this.storageKey = 'tactical_fps_profile_v1';
    this.onLevelUp = options.onLevelUp || null;
    this.onXpGain = options.onXpGain || null;
    this.onProfileChange = options.onProfileChange || null;

    this.profile = this._loadProfile();
  }

  _getDefaultProfile() {
    return {
      name: 'Operador Ghost',
      level: 1,
      currentXp: 0,
      totalXp: 0,
      stats: {
        kills: 0,
        deaths: 0,
        headshots: 0,
        shotsFired: 0,
        shotsHit: 0,
        damageDealt: 0,
        timeSurvivedSeconds: 0
      }
    };
  }

  _loadProfile() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        return Object.assign(this._getDefaultProfile(), parsed);
      }
    } catch (e) {
      console.warn('Erro ao carregar perfil do localStorage:', e);
    }
    return this._getDefaultProfile();
  }

  saveProfile() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.profile));
      if (this.onProfileChange) {
        this.onProfileChange(this.profile);
      }
    } catch (e) {
      console.warn('Erro ao salvar perfil no localStorage:', e);
    }
  }

  getName() {
    return this.profile.name;
  }

  setName(newName) {
    if (!newName || !newName.trim()) return;
    this.profile.name = newName.trim().substring(0, 20);
    this.saveProfile();
  }

  getRankInfo(level = this.profile.level) {
    const rank = MILITARY_RANKS.find(r => r.level === level);
    if (rank) return rank;
    return {
      level,
      name: 'Comandante Geral',
      tag: 'GEN',
      neededXp: 500 + level * 50
    };
  }

  getXpNeededForNextLevel() {
    const rank = this.getRankInfo(this.profile.level);
    return rank.neededXp;
  }

  addXp(amount, reason = 'AÇÃO DE COMBATE') {
    if (amount <= 0) return;

    this.profile.currentXp += amount;
    this.profile.totalXp += amount;

    if (this.onXpGain) {
      this.onXpGain(amount, reason);
    }

    let neededXp = this.getXpNeededForNextLevel();
    while (this.profile.currentXp >= neededXp) {
      this.profile.currentXp -= neededXp;
      this.profile.level++;
      neededXp = this.getXpNeededForNextLevel();

      const newRank = this.getRankInfo(this.profile.level);
      if (this.onLevelUp) {
        this.onLevelUp(this.profile.level, newRank);
      }
    }

    this.saveProfile();
  }

  recordKill(isHeadshot = false) {
    this.profile.stats.kills++;
    if (isHeadshot) {
      this.profile.stats.headshots++;
      this.addXp(125, 'ELIMINAÇÃO [HEADSHOT]');
    } else {
      this.addXp(100, 'ELIMINAÇÃO');
    }
    this.saveProfile();
  }

  recordDeath() {
    this.profile.stats.deaths++;
    this.saveProfile();
  }

  recordShot(didHit = false) {
    this.profile.stats.shotsFired++;
    if (didHit) {
      this.profile.stats.shotsHit++;
    }
    this.saveProfile();
  }

  recordDamage(amount) {
    this.profile.stats.damageDealt += amount;
    // Concede 1 XP a cada 15 de dano
    const bonusXp = Math.floor(amount / 15);
    if (bonusXp > 0) {
      this.addXp(bonusXp, 'DANO CAUSADO');
    }
    this.saveProfile();
  }

  recordSurvivalTime(seconds = 30) {
    this.profile.stats.timeSurvivedSeconds += seconds;
    this.addXp(15, 'SOBREVIVÊNCIA TÁTICA');
    this.saveProfile();
  }

  getAccuracyPercent() {
    if (this.profile.stats.shotsFired === 0) return 0;
    return Math.round((this.profile.stats.shotsHit / this.profile.stats.shotsFired) * 100);
  }

  getKdRatio() {
    if (this.profile.stats.deaths === 0) return this.profile.stats.kills.toFixed(2);
    return (this.profile.stats.kills / this.profile.stats.deaths).toFixed(2);
  }

  resetProfile() {
    this.profile = this._getDefaultProfile();
    this.saveProfile();
  }
}
