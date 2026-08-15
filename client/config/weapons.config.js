// Configuração centralizada das armas militares modernas

export const WEAPONS_CONFIG = {
  m4a1: {
    id: 'm4a1',
    slot: 1,
    name: 'M4A1 Tático',
    type: 'automatic',
    damage: 26,
    headshotMultiplier: 2.0, // 52 dano
    fireRate: 0.11, // ~545 RPM
    magazineSize: 30,
    maxReserveAmmo: 120,
    reloadTime: 1.8,
    range: 180,
    spread: 0.014,
    pellets: 1,
    hasZoom: false,
    zoomFov: 58,
    recoilKick: { x: 0.01, y: 0.028, z: 0.075 },
    recoilPitch: 0.012,
    color: '#38bdf8', // Tactical Light Blue
    themeColor: '#38bdf8',
    accentColor: 0xffe066
  },
  mp5: {
    id: 'mp5',
    slot: 2,
    name: 'MP5 Submetralhadora',
    type: 'automatic',
    damage: 16,
    headshotMultiplier: 1.75, // 28 dano
    fireRate: 0.075, // ~800 RPM
    magazineSize: 30,
    maxReserveAmmo: 180,
    reloadTime: 1.4,
    range: 75,
    spread: 0.038,
    pellets: 1,
    hasZoom: false,
    zoomFov: 62,
    recoilKick: { x: 0.015, y: 0.016, z: 0.045 },
    recoilPitch: 0.014,
    color: '#4ade80', // Tactical Green
    themeColor: '#4ade80',
    accentColor: 0xffee88
  },
  shotgun: {
    id: 'shotgun',
    slot: 3,
    name: 'Escopeta 12 Gauge',
    type: 'pump-action',
    damage: 13, // 13 x 8 pellets = 104 dano total máximo de perto
    headshotMultiplier: 1.5,
    fireRate: 0.8,
    magazineSize: 8,
    maxReserveAmmo: 40,
    reloadTime: 2.5,
    range: 50,
    spread: 0.07,
    pellets: 8,
    hasZoom: false,
    zoomFov: 62,
    recoilKick: { x: 0.025, y: 0.08, z: 0.18 },
    recoilPitch: 0.05,
    color: '#f87171', // Tactical Red/Amber
    themeColor: '#f87171',
    accentColor: 0xffaa44
  },
  sniper: {
    id: 'sniper',
    slot: 4,
    name: 'M24 Sniper Tática',
    type: 'bolt-action',
    damage: 90,
    headshotMultiplier: 2.5, // 225 dano (eliminação instantânea garantida)
    fireRate: 1.4,
    magazineSize: 5,
    maxReserveAmmo: 25,
    reloadTime: 3.0,
    range: 400,
    spread: 0.001,
    pellets: 1,
    hasZoom: true,
    zoomFov: 20, // Luneta militar de alta ampliação
    recoilKick: { x: 0.012, y: 0.12, z: 0.28 },
    recoilPitch: 0.075,
    color: '#fbbf24', // Tactical Amber
    themeColor: '#fbbf24',
    accentColor: 0xffdd44
  }
};

export const WEAPON_SLOTS = [
  'm4a1',
  'mp5',
  'shotgun',
  'sniper'
];
