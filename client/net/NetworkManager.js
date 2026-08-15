export class NetworkManager {
  constructor(options = {}) {
    this.serverUrl = options.serverUrl || `ws://${window.location.hostname || 'localhost'}:3001`;
    this.ws = null;
    this.isConnected = false;
    this.selfId = null;
    this.selfSlot = 0;
    this.selfData = null;

    // Callbacks de eventos
    this.onInit = options.onInit || null;
    this.onPlayerJoined = options.onPlayerJoined || null;
    this.onPlayerLeft = options.onPlayerLeft || null;
    this.onWorldState = options.onWorldState || null;
    this.onRemoteShot = options.onRemoteShot || null;
    this.onDamageDealt = options.onDamageDealt || null;
    this.onPlayerKilled = options.onPlayerKilled || null;
    this.onPlayerRespawn = options.onPlayerRespawn || null;
    this.onMatchEnded = options.onMatchEnded || null;
    this.onMatchRestarted = options.onMatchRestarted || null;

    this.sendInterval = 1000 / 30; // 30 Hz
    this.lastSendTime = 0;

    this.connect();
  }

  connect() {
    console.log(`[Rede] Conectando ao servidor: ${this.serverUrl}...`);
    try {
      this.ws = new WebSocket(this.serverUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        console.log(`[Rede] Conectado com sucesso ao servidor autoritativo!`);
        this.sendJoin('Operador ' + Math.floor(1 + Math.random() * 99));
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this._handleMessage(msg);
        } catch (e) {
          console.error('[Rede] Erro ao analisar mensagem:', e);
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        console.warn(`[Rede] Conexão com o servidor perdida. Tentando reconectar em 2s...`);
        setTimeout(() => this.connect(), 2000);
      };

      this.ws.onerror = (err) => {
        console.error('[Rede] Erro no socket:', err);
      };
    } catch (err) {
      console.error('[Rede] Falha ao instanciar WebSocket:', err);
    }
  }

  _handleMessage(msg) {
    switch (msg.type) {
      case 'init': {
        this.selfId = msg.self.id;
        this.selfSlot = msg.self.slot;
        this.selfData = msg.self;
        if (this.onInit) this.onInit(msg.self, msg.players);
        break;
      }

      case 'player_joined': {
        if (this.onPlayerJoined) this.onPlayerJoined(msg.player);
        break;
      }

      case 'player_left': {
        if (this.onPlayerLeft) this.onPlayerLeft(msg.id);
        break;
      }

      case 'world_state': {
        if (this.onWorldState) this.onWorldState(msg.players);
        break;
      }

      case 'player_shot': {
        if (this.onRemoteShot) this.onRemoteShot(msg);
        break;
      }

      case 'damage_dealt': {
        if (this.onDamageDealt) this.onDamageDealt(msg);
        break;
      }

      case 'player_killed': {
        if (this.onPlayerKilled) this.onPlayerKilled(msg);
        break;
      }

      case 'player_respawn': {
        if (this.onPlayerRespawn) this.onPlayerRespawn(msg);
        break;
      }

      case 'match_ended': {
        if (this.onMatchEnded) this.onMatchEnded(msg);
        break;
      }

      case 'match_restarted': {
        if (this.onMatchRestarted) this.onMatchRestarted(msg);
        break;
      }
    }
  }

  sendRestartMatch() {
    this._send({ type: 'restart_match' });
  }

  sendJoin(name) {
    this._send({
      type: 'join',
      name
    });
  }

  sendPlayerUpdate(position, rotation, weaponKey, isMoving, isSprinting) {
    if (!this.isConnected || !this.selfId) return;

    this._send({
      type: 'player_update',
      position: { x: position.x, y: position.y, z: position.z },
      rotation: { yaw: rotation.y, pitch: rotation.x },
      weapon: weaponKey,
      isMoving,
      isSprinting
    });
  }

  sendShoot(weaponKey, origin, direction, hitPoint, targetId = null, isHeadshot = false) {
    if (!this.isConnected || !this.selfId) return;

    this._send({
      type: 'shoot',
      weapon: weaponKey,
      origin: { x: origin.x, y: origin.y, z: origin.z },
      direction: { x: direction.x, y: direction.y, z: direction.z },
      hitPoint: hitPoint ? { x: hitPoint.x, y: hitPoint.y, z: hitPoint.z } : null,
      targetId,
      isHeadshot
    });
  }

  _send(obj) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
    }
  }
}
