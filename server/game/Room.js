import { WEAPONS_CONFIG } from '../config/weapons.config.js';

export class Room {
  constructor(roomId = 'battle-arena-1') {
    this.roomId = roomId;
    this.maxPlayers = 4;
    this.players = new Map(); // id -> playerData

    this.spawnPoints = [
      { x: 0, y: 1.8, z: 18 },
      { x: 0, y: 1.8, z: -18 },
      { x: 18, y: 1.8, z: 0 },
      { x: -18, y: 1.8, z: 0 }
    ];

    this.slotColors = [
      { name: 'Operador Alfa', color: '#38bdf8', camo: 'black', hex: 0x38bdf8 },
      { name: 'Operador Bravo', color: '#4ade80', camo: 'olive', hex: 0x4ade80 },
      { name: 'Operador Charlie', color: '#fbbf24', camo: 'tan', hex: 0xfbbf24 },
      { name: 'Operador Delta', color: '#f87171', camo: 'navy', hex: 0xf87171 }
    ];

    this.tickRate = 30; // 30 updates por segundo
    this.intervalId = null;
    this._startLoop();
  }

  _startLoop() {
    const tickInterval = 1000 / this.tickRate;
    let lastTime = Date.now();

    this.intervalId = setInterval(() => {
      const now = Date.now();
      const deltaTime = (now - lastTime) / 1000;
      lastTime = now;

      this.update(deltaTime);
    }, tickInterval);
  }

  addPlayer(ws, playerName) {
    if (this.players.size >= this.maxPlayers) {
      ws.send(JSON.stringify({ type: 'error', message: 'Sala cheia (máx 4 operadores)' }));
      return null;
    }

    // Encontra primeiro slot disponível (0..3)
    const usedSlots = new Set();
    this.players.forEach(p => usedSlots.add(p.slot));
    let slot = 0;
    for (let i = 0; i < this.maxPlayers; i++) {
      if (!usedSlots.has(i)) {
        slot = i;
        break;
      }
    }

    const slotInfo = this.slotColors[slot];
    const spawn = this.spawnPoints[slot] || this.spawnPoints[0];
    const id = 'op_' + Math.random().toString(36).substr(2, 9);

    const player = {
      id,
      ws,
      slot,
      name: playerName || slotInfo.name,
      color: slotInfo.color,
      camo: slotInfo.camo,
      position: { x: spawn.x, y: spawn.y, z: spawn.z },
      rotation: { yaw: 0, pitch: 0 },
      weapon: 'm4a1',
      isMoving: false,
      isSprinting: false,
      health: 100,
      maxHealth: 100,
      isDead: false,
      respawnTimer: 0,
      kills: 0,
      deaths: 0,
      lastShotTime: 0
    };

    this.players.set(id, player);

    // 1. Envia mensagem de inicialização para o jogador conectado
    const initialPlayers = [];
    this.players.forEach(p => {
      if (p.id !== id) {
        initialPlayers.push(this._serializePlayer(p));
      }
    });

    ws.send(JSON.stringify({
      type: 'init',
      self: this._serializePlayer(player),
      players: initialPlayers
    }));

    // 2. Notifica todos os outros jogadores
    this._broadcastExcept(id, {
      type: 'player_joined',
      player: this._serializePlayer(player)
    });

    console.log(`[Multiplayer] ${player.name} (${id}) entrou no slot ${slot + 1}`);
    return player;
  }

  removePlayer(id) {
    const player = this.players.get(id);
    if (!player) return;

    this.players.delete(id);
    this._broadcast({
      type: 'player_left',
      id
    });
    console.log(`[Multiplayer] ${player.name} (${id}) desconectou.`);
  }

  handlePlayerUpdate(id, data) {
    const player = this.players.get(id);
    if (!player || player.isDead) return;

    if (data.position) {
      player.position.x = data.position.x;
      player.position.y = data.position.y;
      player.position.z = data.position.z;
    }
    if (data.rotation) {
      player.rotation.yaw = data.rotation.yaw;
      player.rotation.pitch = data.rotation.pitch;
    }
    if (data.weapon) {
      player.weapon = data.weapon;
    }
    player.isMoving = !!data.isMoving;
    player.isSprinting = !!data.isSprinting;
  }

  handleShoot(shooterId, data) {
    const shooter = this.players.get(shooterId);
    if (!shooter || shooter.isDead) return;

    const weaponKey = data.weapon || shooter.weapon;
    const weaponCfg = WEAPONS_CONFIG[weaponKey] || WEAPONS_CONFIG.m4a1;

    // Notifica outros jogadores sobre o disparo para renderizar efeitos visuais e áudio
    this._broadcastExcept(shooterId, {
      type: 'player_shot',
      shooterId,
      weapon: weaponKey,
      origin: data.origin,
      direction: data.direction,
      hitPoint: data.hitPoint
    });

    // Se o cliente reportou acerto em outro jogador, valida no servidor
    if (data.targetId && this.players.has(data.targetId)) {
      const victim = this.players.get(data.targetId);
      if (victim && !victim.isDead) {
        let isHeadshot = !!data.isHeadshot;
        let damage = weaponCfg.damage;
        if (isHeadshot) damage *= weaponCfg.headshotMultiplier;

        // Aplica dano autoritativo
        victim.health = Math.max(0, victim.health - damage);

        // Notifica todos sobre o dano
        this._broadcast({
          type: 'damage_dealt',
          shooterId,
          targetId: victim.id,
          damage,
          isHeadshot,
          remainingHealth: victim.health,
          hitPoint: data.hitPoint
        });

        // Checa morte
        if (victim.health <= 0) {
          victim.isDead = true;
          victim.deaths++;
          victim.respawnTimer = 4.0; // 4 segundos para respawn
          shooter.kills++;

          this._broadcast({
            type: 'player_killed',
            victimId: victim.id,
            victimName: victim.name,
            killerId: shooter.id,
            killerName: shooter.name,
            weapon: weaponKey,
            isHeadshot
          });

          console.log(`[Killfeed] ${shooter.name} eliminou ${victim.name} com ${weaponCfg.name}`);

          // Checa vitória da rodada (10 kills)
          if (shooter.kills >= 10) {
            this._broadcast({
              type: 'match_ended',
              winnerId: shooter.id,
              winnerName: shooter.name,
              winnerColor: shooter.color,
              scoreLimit: 10,
              players: Array.from(this.players.values()).map(p => this._serializePlayer(p))
            });
            console.log(`🏆 [Vitória] ${shooter.name} venceu a operação ao atingir 10 eliminações!`);
          }
        }
      }
    }
  }

  restartMatch() {
    this.players.forEach((p, idx) => {
      p.kills = 0;
      p.deaths = 0;
      p.health = p.maxHealth;
      p.isDead = false;
      const spawn = this.spawnPoints[p.slot] || this.spawnPoints[0];
      p.position = { x: spawn.x, y: spawn.y, z: spawn.z };
    });

    this._broadcast({
      type: 'match_restarted',
      players: Array.from(this.players.values()).map(p => this._serializePlayer(p))
    });
    console.log('🔄 [Partida] Operação reiniciada com sucesso!');
  }

  update(deltaTime) {
    // Atualiza timers de respawn
    this.players.forEach(player => {
      if (player.isDead) {
        player.respawnTimer -= deltaTime;
        if (player.respawnTimer <= 0) {
          this._respawnPlayer(player);
        }
      }
    });

    // Envia world_state para todos os clientes conectados
    const statePayload = {
      type: 'world_state',
      timestamp: Date.now(),
      players: Array.from(this.players.values()).map(p => this._serializePlayer(p))
    };

    this._broadcast(statePayload);
  }

  _respawnPlayer(player) {
    player.isDead = false;
    player.health = player.maxHealth;
    
    // Ponto de spawn aleatório
    const spawnIndex = Math.floor(Math.random() * this.spawnPoints.length);
    const spawn = this.spawnPoints[spawnIndex];
    player.position = { x: spawn.x, y: spawn.y, z: spawn.z };

    this._broadcast({
      type: 'player_respawn',
      id: player.id,
      position: player.position,
      health: player.health
    });
  }

  _serializePlayer(p) {
    return {
      id: p.id,
      slot: p.slot,
      name: p.name,
      color: p.color,
      camo: p.camo,
      position: p.position,
      rotation: p.rotation,
      weapon: p.weapon,
      health: p.health,
      maxHealth: p.maxHealth,
      isDead: p.isDead,
      kills: p.kills,
      deaths: p.deaths,
      isMoving: p.isMoving,
      isSprinting: p.isSprinting
    };
  }

  _broadcast(data) {
    const msg = JSON.stringify(data);
    this.players.forEach(p => {
      if (p.ws.readyState === 1) { // WebSocket.OPEN
        p.ws.send(msg);
      }
    });
  }

  _broadcastExcept(exceptId, data) {
    const msg = JSON.stringify(data);
    this.players.forEach(p => {
      if (p.id !== exceptId && p.ws.readyState === 1) {
        p.ws.send(msg);
      }
    });
  }
}
