import { WebSocketServer } from 'ws';
import { Room } from './game/Room.js';

const PORT = process.env.PORT || 3001;
const wss = new WebSocketServer({ port: PORT });
const gameRoom = new Room('tactical-ops-main');

console.log(`===================================================`);
console.log(`🛡️  FPS BATTLE ARENA — SERVIDOR MILITAR AUTORITATIVO`);
console.log(`📡 WebSocket escutando na porta: ${PORT}`);
console.log(`👥 Capacidade máxima: 4 Operadores Simultâneos`);
console.log(`===================================================`);

wss.on('connection', (ws) => {
  let playerId = null;

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());

      switch (data.type) {
        case 'join': {
          const player = gameRoom.addPlayer(ws, data.name);
          if (player) playerId = player.id;
          break;
        }

        case 'player_update': {
          if (playerId) {
            gameRoom.handlePlayerUpdate(playerId, data);
          }
          break;
        }

        case 'shoot': {
          if (playerId) {
            gameRoom.handleShoot(playerId, data);
          }
          break;
        }

        case 'restart_match': {
          gameRoom.restartMatch();
          break;
        }
      }
    } catch (err) {
      console.error('Erro ao processar mensagem do cliente:', err);
    }
  });

  ws.on('close', () => {
    if (playerId) {
      gameRoom.removePlayer(playerId);
    }
  });

  ws.on('error', (err) => {
    console.error('Erro no WebSocket:', err);
  });
});
