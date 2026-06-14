export interface RealSplatScene {
  id: string;
  label: string;
  url: string;
  sizeMb: number;
  source: string;
  cameraPosition: [number, number, number];
  lookAt: [number, number, number];
  maxDistance: number;
}

export const realSplatScenes: RealSplatScene[] = [
  {
    id: 'bonsai-trimmed',
    label: 'Bonsai Trimmed',
    url: '/real-splats/official/bonsai/bonsai_trimmed.ksplat',
    sizeMb: 4.0,
    source: 'GaussianSplats3D official demo data',
    cameraPosition: [0, 1.2, 3.4],
    lookAt: [0, 0.8, 0],
    maxDistance: 8
  },
  {
    id: 'bonsai',
    label: 'Bonsai',
    url: '/real-splats/official/bonsai/bonsai.ksplat',
    sizeMb: 19.9,
    source: 'GaussianSplats3D official demo data',
    cameraPosition: [0, 1.2, 3.4],
    lookAt: [0, 0.8, 0],
    maxDistance: 8
  },
  {
    id: 'truck',
    label: 'Truck',
    url: '/real-splats/official/truck/truck.ksplat',
    sizeMb: 27.9,
    source: 'GaussianSplats3D official demo data',
    cameraPosition: [3.2, 1.8, 4.2],
    lookAt: [0, 0.6, 0],
    maxDistance: 18
  },
  {
    id: 'stump',
    label: 'Stump',
    url: '/real-splats/official/stump/stump.ksplat',
    sizeMb: 70.3,
    source: 'GaussianSplats3D official demo data',
    cameraPosition: [2.8, 1.7, 4.6],
    lookAt: [0, 0.7, 0],
    maxDistance: 18
  },
  {
    id: 'garden',
    label: 'Garden',
    url: '/real-splats/official/garden/garden.ksplat',
    sizeMb: 71.9,
    source: 'GaussianSplats3D official demo data',
    cameraPosition: [3.8, 2.2, 5.5],
    lookAt: [0, 0.8, 0],
    maxDistance: 22
  }
];
