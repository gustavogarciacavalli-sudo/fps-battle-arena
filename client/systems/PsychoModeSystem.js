import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

// Shader GLSL 100% compatível com WebGL 1.0 e WebGL 2.0 (sem funções com sobrecarga inválida)
const PsychoShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0.0 },
    uIntensity: { value: 0.0 },
    uLevel: { value: 0 },
    uChromatic: { value: 0.0 },
    uDistortion: { value: 0.0 },
    uVignette: { value: 0.0 },
    uGlitch: { value: 0.0 },
    uContrast: { value: 1.0 }
  },

  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uIntensity;
    uniform int uLevel;
    uniform float uChromatic;
    uniform float uDistortion;
    uniform float uVignette;
    uniform float uGlitch;
    uniform float uContrast;
    varying vec2 vUv;

    // Distorção de Lente Suave
    vec2 barrelDistortion(vec2 coord, float amt) {
      vec2 cc = coord - vec2(0.5, 0.5);
      float dist = dot(cc, cc);
      return coord + cc * dist * amt;
    }

    void main() {
      vec2 uv = vUv;

      if (uIntensity <= 0.001) {
        gl_FragColor = texture2D(tDiffuse, uv);
        return;
      }

      // 1. Distorção de Lente
      float distStrength = uDistortion * uIntensity * 0.35;
      if (uLevel >= 3) {
        distStrength += sin(uTime * 8.0) * 0.015 * uIntensity;
      }
      uv = barrelDistortion(uv, distStrength);

      // 2. Glitch de Linhas
      if (uGlitch > 0.0 && uIntensity > 0.2) {
        float lineNoise = sin(uv.y * 260.0 + uTime * 14.0);
        if (lineNoise > 0.985) {
          uv.x += (sin(uTime * 20.0) * 0.006) * uGlitch * uIntensity;
        }
      }

      // Clamping seguro de UVs
      uv = clamp(uv, vec2(0.001, 0.001), vec2(0.999, 0.999));

      // 3. Aberração Cromática
      vec2 dir = uv - vec2(0.5, 0.5);
      float distFromCenter = length(dir);
      float chromAmt = uChromatic * uIntensity * (0.4 + distFromCenter * 0.6);

      vec2 uvR = clamp(uv + dir * chromAmt, vec2(0.001, 0.001), vec2(0.999, 0.999));
      vec2 uvB = clamp(uv - dir * chromAmt, vec2(0.001, 0.001), vec2(0.999, 0.999));

      float r = texture2D(tDiffuse, uvR).r;
      float g = texture2D(tDiffuse, uv).g;
      float b = texture2D(tDiffuse, uvB).b;
      vec3 color = vec3(r, g, b);

      // 4. Ghosting / Duplicação Suave (Nível 4)
      if (uLevel >= 4 && uIntensity > 0.3) {
        vec2 trailOffset = dir * (sin(uTime * 8.0) * 0.01);
        vec2 uvGhost = clamp(uv + trailOffset, vec2(0.001, 0.001), vec2(0.999, 0.999));
        vec3 ghost = texture2D(tDiffuse, uvGhost).rgb;
        color = mix(color, ghost, 0.18 * uIntensity);
      }

      // 5. Contraste
      color = (color - vec3(0.5, 0.5, 0.5)) * uContrast + vec3(0.5, 0.5, 0.5);

      // 6. Vinheta e Pulso de Adrenalina
      if (uVignette > 0.0 && uIntensity > 0.05) {
        float vigFactor = clamp(distFromCenter * (0.85 + uVignette * uIntensity * 0.35), 0.0, 1.0);
        float vignette = 1.0 - smoothstep(0.45, 0.95, vigFactor);
        
        color = mix(color * 0.85, color, vignette);

        if (uLevel >= 3) {
          float pulse = (0.5 + 0.5 * sin(uTime * 5.0)) * 0.22 * uIntensity;
          color = mix(color, vec3(0.85, 0.2, 0.2), (1.0 - vignette) * pulse);
        }
      }

      gl_FragColor = vec4(clamp(color, vec3(0.0, 0.0, 0.0), vec3(1.0, 1.0, 1.0)), 1.0);
    }
  `
};

export class PsychoModeSystem {
  constructor(renderer, scene, camera, audioSystem, hudSystem) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.audioSystem = audioSystem;
    this.hudSystem = hudSystem;

    this.currentLevel = 0; // 0 = Inativo, 1 = Focus, 2 = Rush, 3 = Shock, 4 = Overload
    this.targetIntensity = 0.0;
    this.currentIntensity = 0.0;

    this.duration = 0;
    this.maxDuration = 10.0;
    this.heartbeatTimer = 0;

    // Configurações calibradas e seguras de cada nível
    this.levelConfigs = {
      0: { name: 'NORMAL', chromatic: 0.0, distortion: 0.0, vignette: 0.0, glitch: 0.0, contrast: 1.0, fovOffset: 0, duration: 0 },
      1: { name: 'ADRENALINA FOCUS', chromatic: 0.003, distortion: 0.05, vignette: 0.15, glitch: 0.0, contrast: 1.08, fovOffset: 4, duration: 10.0 },
      2: { name: 'COMBAT RUSH', chromatic: 0.007, distortion: 0.10, vignette: 0.30, glitch: 0.08, contrast: 1.15, fovOffset: 7, duration: 10.0 },
      3: { name: 'CONCUSSÃO TÁTICA', chromatic: 0.014, distortion: 0.18, vignette: 0.50, glitch: 0.25, contrast: 1.22, fovOffset: 11, duration: 9.0 },
      4: { name: 'SOBRECARGA EXTREMA', chromatic: 0.022, distortion: 0.28, vignette: 0.70, glitch: 0.40, contrast: 1.30, fovOffset: 15, duration: 8.0 }
    };

    this._initComposer();
  }

  _initComposer() {
    this.composer = new EffectComposer(this.renderer);
    
    // Pass 1: Renderização da cena principal
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);

    // Pass 2: Shader customizado de Psycho Mode
    this.psychoPass = new ShaderPass(PsychoShader);
    this.psychoPass.renderToScreen = true;
    this.composer.addPass(this.psychoPass);
  }

  triggerLevel(level = 1, customDuration = null) {
    const clampedLevel = Math.max(1, Math.min(4, level));
    this.currentLevel = clampedLevel;
    const cfg = this.levelConfigs[clampedLevel];

    this.maxDuration = customDuration || cfg.duration;
    this.duration = this.maxDuration;
    this.targetIntensity = 1.0;

    // Áudio específico do nível
    if (this.audioSystem) {
      if (clampedLevel === 1) this.audioSystem.playStimInject();
      if (clampedLevel === 2) {
        this.audioSystem.playStimInject();
        this.audioSystem.playHeartbeat(2);
      }
      if (clampedLevel === 3) {
        this.audioSystem.playTinnitus();
        this.audioSystem.playHeartbeat(3);
      }
      if (clampedLevel === 4) {
        this.audioSystem.playStimInject();
        this.audioSystem.playTinnitus();
        this.audioSystem.playHeartbeat(4);
      }
    }
  }

  cycleNextLevel() {
    let next = this.currentLevel + 1;
    if (next > 4) next = 0;

    if (next === 0) {
      this.clear();
    } else {
      this.triggerLevel(next);
    }
  }

  clear() {
    this.currentLevel = 0;
    this.targetIntensity = 0.0;
    this.duration = 0;
    if (this.hudSystem) {
      this.hudSystem.updatePsychoMode(0, 0, 1);
    }
  }

  getFovOffset() {
    const cfg = this.levelConfigs[this.currentLevel] || this.levelConfigs[0];
    return cfg.fovOffset * this.currentIntensity;
  }

  onResize(width, height) {
    if (this.composer) {
      this.composer.setSize(width, height);
    }
  }

  update(deltaTime, elapsedTime) {
    // 1. Temporização e Decaimento
    if (this.duration > 0) {
      this.duration -= deltaTime;
      if (this.duration <= 0) {
        this.duration = 0;
        this.targetIntensity = 0.0;
        this.currentLevel = 0;
      }
    }

    // 2. Interpolação suave de intensidade
    this.currentIntensity = THREE.MathUtils.lerp(this.currentIntensity, this.targetIntensity, deltaTime * 5.0);

    // 3. Atualiza Uniforms do Shader
    const cfg = this.levelConfigs[this.currentLevel] || this.levelConfigs[0];
    const uniforms = this.psychoPass.uniforms;

    uniforms.uTime.value = elapsedTime;
    uniforms.uIntensity.value = this.currentIntensity;
    uniforms.uLevel.value = this.currentLevel;
    uniforms.uChromatic.value = cfg.chromatic;
    uniforms.uDistortion.value = cfg.distortion;
    uniforms.uVignette.value = cfg.vignette;
    uniforms.uGlitch.value = cfg.glitch;
    uniforms.uContrast.value = THREE.MathUtils.lerp(1.0, cfg.contrast, this.currentIntensity);

    // 4. Som de batimentos cardíacos
    if (this.currentLevel > 0 && this.currentIntensity > 0.2) {
      const interval = 0.8 - (this.currentLevel * 0.12);
      this.heartbeatTimer += deltaTime;
      if (this.heartbeatTimer >= interval) {
        this.heartbeatTimer = 0;
        if (this.audioSystem) {
          this.audioSystem.playHeartbeat(this.currentLevel);
        }
      }
    }

    // 5. Atualiza HUD
    if (this.hudSystem) {
      this.hudSystem.updatePsychoMode(this.currentLevel, this.duration, this.maxDuration);
    }
  }

  render() {
    if (this.currentIntensity > 0.005) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }
}
