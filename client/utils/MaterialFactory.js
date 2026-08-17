import * as THREE from 'three';

export class MaterialFactory {
  static canvasTexture(
    draw,
    size = 512,
    repeatX = 1,
    repeatY = 1
  ) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext('2d');
    draw(ctx, size);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeatX, repeatY);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;

    return texture;
  }

  static desertGround() {
    return this.canvasTexture(
      (ctx, size) => {
        ctx.fillStyle = '#b98e61';
        ctx.fillRect(0, 0, size, size);

        // Grãos e variações de areia
        for (let i = 0; i < 3500; i++) {
          const shade = 80 + Math.floor(Math.random() * 70);
          ctx.fillStyle = `rgb(${shade + 70}, ${shade + 35}, ${shade})`;
          const radius = Math.random() * 2.5;
          ctx.beginPath();
          ctx.arc(
            Math.random() * size,
            Math.random() * size,
            radius,
            0,
            Math.PI * 2
          );
          ctx.fill();
        }

        // Pedregulhos e cascalho
        for (let i = 0; i < 220; i++) {
          ctx.fillStyle = 'rgba(70,55,40,0.25)';
          const w = 2 + Math.random() * 8;
          const h = 1 + Math.random() * 4;
          ctx.fillRect(Math.random() * size, Math.random() * size, w, h);
        }

        // Marcas de pneus de veículos militares
        ctx.strokeStyle = 'rgba(55,45,38,0.16)';
        ctx.lineWidth = 7;
        for (let i = 0; i < 5; i++) {
          ctx.beginPath();
          ctx.moveTo(Math.random() * size, 0);
          ctx.bezierCurveTo(
            size * 0.25,
            size * 0.3,
            size * 0.7,
            size * 0.65,
            Math.random() * size,
            size
          );
          ctx.stroke();
        }
      },
      512,
      5,
      5
    );
  }

  static concrete() {
    return this.canvasTexture(
      (ctx, size) => {
        ctx.fillStyle = '#a89b87';
        ctx.fillRect(0, 0, size, size);

        // Variação e porosidade de concreto
        for (let i = 0; i < 5000; i++) {
          const v = 85 + Math.random() * 60;
          ctx.fillStyle = `rgba(${v},${v - 5},${v - 15},0.12)`;
          const s = 1 + Math.random() * 5;
          ctx.fillRect(Math.random() * size, Math.random() * size, s, s);
        }

        // Rachaduras táticas de desgaste
        ctx.strokeStyle = 'rgba(45,39,32,0.25)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 35; i++) {
          let x = Math.random() * size;
          let y = Math.random() * size;
          ctx.beginPath();
          ctx.moveTo(x, y);
          for (let j = 0; j < 5; j++) {
            x += (Math.random() - 0.5) * 70;
            y += Math.random() * 45;
            ctx.lineTo(x, y);
          }
          ctx.stroke();
        }

        // Manchas de intempéries e umidade
        for (let i = 0; i < 80; i++) {
          ctx.fillStyle = 'rgba(30,25,20,0.10)';
          ctx.beginPath();
          ctx.arc(
            Math.random() * size,
            Math.random() * size,
            5 + Math.random() * 18,
            0,
            Math.PI * 2
          );
          ctx.fill();
        }
      },
      512,
      4,
      4
    );
  }

  static rustedMetal() {
    return this.canvasTexture(
      (ctx, size) => {
        ctx.fillStyle = '#5b5b54';
        ctx.fillRect(0, 0, size, size);

        for (let i = 0; i < 2500; i++) {
          const rust = Math.random();
          if (rust > 0.82) {
            ctx.fillStyle = 'rgba(130,65,35,0.28)';
          } else {
            ctx.fillStyle = 'rgba(255,255,255,0.04)';
          }
          ctx.fillRect(
            Math.random() * size,
            Math.random() * size,
            1 + Math.random() * 4,
            1 + Math.random() * 4
          );
        }

        // Riscos e arranhões no metal
        ctx.strokeStyle = 'rgba(20,20,20,0.22)';
        for (let i = 0; i < 50; i++) {
          ctx.beginPath();
          const x = Math.random() * size;
          ctx.moveTo(x, Math.random() * size);
          ctx.lineTo(x + 20 + Math.random() * 80, Math.random() * size);
          ctx.stroke();
        }
      },
      512,
      3,
      2
    );
  }

  static sandbag() {
    return this.canvasTexture(
      (ctx, size) => {
        ctx.fillStyle = '#a88a61';
        ctx.fillRect(0, 0, size, size);

        // Trama de juta
        for (let i = 0; i < 5000; i++) {
          ctx.fillStyle = Math.random() > 0.5 ? 'rgba(60,45,30,0.07)' : 'rgba(255,255,255,0.05)';
          ctx.fillRect(Math.random() * size, Math.random() * size, 2, 2);
        }

        for (let i = 0; i < 60; i++) {
          ctx.strokeStyle = 'rgba(55,42,28,0.18)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          const y = Math.random() * size;
          ctx.moveTo(0, y);
          ctx.lineTo(size, y + (Math.random() - 0.5) * 20);
          ctx.stroke();
        }
      },
      512,
      5,
      5
    );
  }
}
