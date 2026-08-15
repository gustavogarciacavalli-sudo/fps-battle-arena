# 🛡️ Tactical FPS Battle Arena 3D

Um jogo de tiro em primeira pessoa (FPS) 3D tático, imersivo e militar desenvolvido com **Three.js (WebGL)**, **Node.js (WebSocket)** e **Web Audio API**.

![Banner](https://raw.githubusercontent.com/gustavogarciacavalli-sudo/fps-battle-arena/main/preview.png)

---

## 🎯 Destaques do Projeto

- **Arsenal Militar Moderno**:
  - `M4A1 Tático` (5.56mm — alta precisão e cadência equilibrada)
  - `MP5 Submetralhadora` (9mm — alta cadência para combate CQB)
  - `Escopeta 12 Gauge` (Letal a curta distância com dispersão de balins)
  - `M24 Sniper Tática` (7.62mm — tiro de precisão com luneta óptica Mil-Dot e sensibilidade adaptativa)
- **Física de Ejeção de Cápsulas 3D**:
  - Cartuchos de latão ejetados da arma em tempo real com física de rotação e gravidade.
- **Sistema de Progressão Militar & Dossiê do Operador**:
  - 10 patentes militares progressivas (`[PVT]` a `[COL]`).
  - Ganhos de XP dinâmicos (+100 Kill, +125 Headshot, +250 Vitória da Partida).
  - Rastreamento completo de estatísticas (K/D, precisão balística, headshots e dano total) persistidos em `localStorage`.
- **Psycho Mode (Sobrecarga de Adrenalina & Concussão)**:
  - Pipeline de pós-processamento com Shaders GLSL customizados:
    - Nível 1: Adrenalina Focus
    - Nível 2: Combat Rush
    - Nível 3: Concussão Tática (Zumbido/Tinnitus e aberração cromática)
    - Nível 4: Sobrecarga Berserk (Batimentos cardíacos acelerados e distorção óptica)
- **Multiplayer Autoritativo em Tempo Real**:
  - Servidor Node.js WebSocket rodando a 30 Hz.
  - Sincronização de operadores, killfeed, placar militar (TAB) e tela de fim de partida com MVP ao atingir 10 eliminações.

---

## 🎮 Controles

| Tecla / Comando | Ação |
| :--- | :--- |
| **W, A, S, D** | Movimentação tática |
| **SHIFT** | Corrida (Sprint) |
| **ESPAÇO** | Pular |
| **MOUSE** | Movimento de câmera / Mira |
| **CLICK ESQUERDO** | Disparar arma |
| **CLICK DIREITO** | Visada Tática ADS (Aproximação óptica e sensibilidade reduzida) |
| **1, 2, 3, 4 / SCROLL** | Troca rápida de armas |
| **R** | Recarregar arma |
| **X** | Injetar Estimulante / Ciclar Psycho Mode (Níveis 1 a 4) |
| **P** | Dossiê do Operador / Perfil militar |
| **TAB** | Placar de Operadores da Partida |

---

## 🚀 Como Executar Localmente

### 1. Clonar o Repositório
```bash
git clone https://github.com/gustavogarciacavalli-sudo/fps-battle-arena.git
cd fps-battle-arena
```

### 2. Instalar as Dependências
```bash
npm install
```

### 3. Iniciar o Servidor Autoritativo (WebSocket)
```bash
npm run server
```

### 4. Iniciar o Cliente Web (Vite)
```bash
npm run dev
```
Abra o navegador em `http://localhost:5173`.

---

## 🛠️ Tecnologias Utilizadas

- **Three.js** (WebGL 3D Engine & Postprocessing Pipeline)
- **Vite** (Build Tool & Dev Server)
- **Node.js + ws** (Servidor WebSocket Autoritativo a 30 Hz)
- **Web Audio API** (Síntese procedural de áudio para disparos, recargas, passos e batimentos cardíacos)
- **GLSL** (Custom Post-Processing Shaders)
- **HTML5 Canvas / CSS3** (Interface HUD Tática e Design Militar)
