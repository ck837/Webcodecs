export interface RealSplatScene {
  id: string;
  label: string;
  url: string;
  sizeMb: number;
  source: string;
  cameraPosition: [number, number, number];
  lookAt: [number, number, number];
  cameraUp: [number, number, number];
  fov: number;
  maxDistance: number;
}

export const realSplatScenes: RealSplatScene[] = [
  {
    id: 'bonsai-trimmed',
    label: 'Bonsai Trimmed',
    url: '/real-splats/official/bonsai/bonsai_trimmed.ksplat',
    sizeMb: 4.0,
    source: 'GaussianSplats3D official demo data',
    cameraPosition: [5.3867, -3.0341, 3.2702],
    lookAt: [-0.4846, 2.0406, 1.3271],
    cameraUp: [0, -1, -0.6],
    fov: 48,
    maxDistance: 8
  },
  {
    id: 'bonsai',
    label: 'Bonsai',
    url: '/real-splats/official/bonsai/bonsai.ksplat',
    sizeMb: 19.9,
    source: 'GaussianSplats3D official demo data',
    cameraPosition: [5.3867, -3.0341, 3.2702],
    lookAt: [-0.4846, 2.0406, 1.3271],
    cameraUp: [0, -1, -0.6],
    fov: 48,
    maxDistance: 8
  },
  {
    id: 'truck',
    label: 'Truck',
    url: '/real-splats/official/truck/truck.ksplat',
    sizeMb: 27.9,
    source: 'GaussianSplats3D official demo data',
    cameraPosition: [-1, -4, 6],
    lookAt: [0, 4, 0],
    cameraUp: [0, -1, -0.6],
    fov: 48,
    maxDistance: 18
  },
  {
    id: 'stump',
    label: 'Stump',
    url: '/real-splats/official/stump/stump.ksplat',
    sizeMb: 70.3,
    source: 'GaussianSplats3D official demo data',
    cameraPosition: [-1, -4, 6],
    lookAt: [0, 4, 0],
    cameraUp: [0, -1, -0.6],
    fov: 48,
    maxDistance: 18
  },
  {
    id: 'garden',
    label: 'Garden',
    url: '/real-splats/official/garden/garden.ksplat',
    sizeMb: 71.9,
    source: 'GaussianSplats3D official demo data',
    cameraPosition: [-1, -4, 6],
    lookAt: [0, 4, 0],
    cameraUp: [0, -1, -0.6],
    fov: 48,
    maxDistance: 22
  }
];
