import { RemotePlayer } from './RemotePlayer.js';

export class PlayerManager {
  constructor(scene) {
    this.scene = scene;
    this.remotePlayers = new Map(); // id -> RemotePlayer
  }

  addPlayer(data) {
    if (this.remotePlayers.has(data.id)) return;
    const player = new RemotePlayer(this.scene, data);
    this.remotePlayers.set(data.id, player);
    console.log(`[PlayerManager] Operador ${data.name} adicionado à cena`);
  }

  removePlayer(id) {
    const player = this.remotePlayers.get(id);
    if (player) {
      player.destroy();
      this.remotePlayers.delete(id);
      console.log(`[PlayerManager] Operador ${id} removido da cena`);
    }
  }

  updatePlayerState(data) {
    const player = this.remotePlayers.get(data.id);
    if (player) {
      player.updateState(data);
    } else {
      this.addPlayer(data);
    }
  }

  getPlayer(id) {
    return this.remotePlayers.get(id);
  }

  getAllHitMeshes() {
    const meshes = [];
    this.remotePlayers.forEach(p => {
      if (!p.isDead) {
        meshes.push(...p.hitMeshes);
      }
    });
    return meshes;
  }

  update(deltaTime) {
    this.remotePlayers.forEach(p => p.update(deltaTime));
  }

  clear() {
    this.remotePlayers.forEach(p => p.destroy());
    this.remotePlayers.clear();
  }
}
