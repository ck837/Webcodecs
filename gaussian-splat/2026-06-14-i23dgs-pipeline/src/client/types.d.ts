declare module '@mkkellogg/gaussian-splats-3d' {
  import type * as THREE from 'three';

  export interface ViewerOptions {
    selfDrivenMode?: boolean;
    renderer?: THREE.WebGLRenderer;
    camera?: THREE.PerspectiveCamera;
    threeScene?: THREE.Scene;
    useBuiltInControls?: boolean;
    ignoreDevicePixelRatio?: boolean;
    sharedMemoryForWorkers?: boolean;
    dynamicScene?: boolean;
  }

  export interface SceneOptions {
    showLoadingUI?: boolean;
    splatAlphaRemovalThreshold?: number;
    position?: [number, number, number];
    rotation?: [number, number, number, number];
    scale?: [number, number, number];
  }

  export class Viewer {
    constructor(options?: ViewerOptions);
    addSplatScene(path: string, options?: SceneOptions): Promise<void>;
    removeSplatScenes(indexes: number[], showLoadingUI?: boolean): Promise<void>;
    update(): void;
    render(): void;
    dispose(): void;
  }
}
