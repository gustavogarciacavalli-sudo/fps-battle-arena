export const WEAPON_BALLISTICS = {
  m4a1: {
    mode: 'hitscan'
  },
  mp5: {
    mode: 'hitscan'
  },
  shotgun: {
    mode: 'hitscan'
  },
  sniper: {
    mode: 'projectile',
    projectileSpeed: 135,
    // Gravidade perceptível para tiros de sniper a longa distância
    gravityScale: 0.34,
    maxDistance: 500
  }
};
