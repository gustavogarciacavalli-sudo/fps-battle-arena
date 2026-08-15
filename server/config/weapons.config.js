// Configuração de armas compartilhada com o servidor autoritativo

export const WEAPONS_CONFIG = {
  m4a1: {
    id: 'm4a1',
    slot: 1,
    name: 'M4A1 Tático',
    type: 'automatic',
    damage: 26,
    headshotMultiplier: 2.0,
    fireRate: 0.11,
    magazineSize: 30,
    maxReserveAmmo: 120,
    range: 180,
    spread: 0.014,
    pellets: 1
  },
  mp5: {
    id: 'mp5',
    slot: 2,
    name: 'MP5 Submetralhadora',
    type: 'automatic',
    damage: 16,
    headshotMultiplier: 1.75,
    fireRate: 0.075,
    magazineSize: 30,
    maxReserveAmmo: 180,
    range: 75,
    spread: 0.038,
    pellets: 1
  },
  shotgun: {
    id: 'shotgun',
    slot: 3,
    name: 'Escopeta 12 Gauge',
    type: 'pump-action',
    damage: 13,
    headshotMultiplier: 1.5,
    fireRate: 0.8,
    magazineSize: 8,
    maxReserveAmmo: 40,
    range: 50,
    spread: 0.07,
    pellets: 8
  },
  sniper: {
    id: 'sniper',
    slot: 4,
    name: 'M24 Sniper Tática',
    type: 'bolt-action',
    damage: 90,
    headshotMultiplier: 2.5,
    fireRate: 1.4,
    magazineSize: 5,
    maxReserveAmmo: 25,
    range: 400,
    spread: 0.001,
    pellets: 1
  }
};
