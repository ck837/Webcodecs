/**
 * 3D Gaussian Splat 叠加层 — 在 Three.js 渲染之后绘制（WebGL2）
 * 用于终点「高斯重建显现」杀手镜头
 */
const ROW = 32;

function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h * 6) % 2 - 1));
  const m = l - c / 2;
  let r, g, b;
  if (h < 1 / 6) [r, g, b] = [c, x, 0];
  else if (h < 2 / 6) [r, g, b] = [x, c, 0];
  else if (h < 3 / 6) [r, g, b] = [0, c, x];
  else if (h < 4 / 6) [r, g, b] = [0, x, c];
  else if (h < 5 / 6) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

/** 北广场实景扫描感高斯簇：广场铺地 + 弧形立面 + 屋檐灯带 */
export function createPlazaSplat(count = 9800) {
  const buf = new ArrayBuffer(count * ROW);
  const f32 = new Float32Array(buf);
  const u8 = new Uint8Array(buf);
  for (let i = 0; i < count; i++) {
    const o = i * ROW;
    const fi = i * 8;
    const roll = Math.random();
    let x, y, z, hue, sat, lit;

    if (roll < 0.34) {
      // 雾中先显现的是广场地面：低矮、宽、带一点扫描噪声。
      const ang = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random());
      x = Math.cos(ang) * r * 5.8;
      z = Math.sin(ang) * r * 3.9 + 0.4;
      y = (Math.random() - 0.5) * 0.18;
      hue = 0.52 + Math.random() * 0.08;
      sat = 0.76;
      lit = 0.48 + Math.random() * 0.1;
    } else if (roll < 0.7) {
      // 北广场建筑主立面：像一段被扫描出来的真实街区，而不是抽象塔。
      const side = Math.random();
      const u = Math.random() * 2 - 1;
      if (side < 0.62) {
        x = u * 5.4;
        z = -3.25 + Math.sin(u * Math.PI) * 0.55 + (Math.random() - 0.5) * 0.22;
      } else {
        const s = side < 0.81 ? -1 : 1;
        x = s * (4.7 + Math.random() * 0.75);
        z = -2.6 + Math.random() * 5.6;
      }
      y = Math.random() * 9.4;
      const windowBand = Math.abs((y % 1.35) - 0.25) < 0.13;
      hue = windowBand ? 0.53 + Math.random() * 0.05 : 0.62 + Math.random() * 0.08;
      sat = windowBand ? 0.9 : 0.38;
      lit = windowBand ? 0.68 + Math.random() * 0.18 : 0.38 + Math.random() * 0.16;
    } else if (roll < 0.84) {
      // 悬挑屋檐和入口光带。
      const u = Math.random() * 2 - 1;
      const band = Math.random();
      x = u * (band < 0.45 ? 5.8 : 4.2);
      z = band < 0.45 ? -1.6 + (Math.random() - 0.5) * 0.22 : -3.35 + (Math.random() - 0.5) * 0.18;
      y = band < 0.45 ? 3.1 + Math.random() * 0.34 : 7.4 + Math.random() * 0.48;
      hue = band < 0.45 ? 0.86 : 0.14;
      sat = 0.82;
      lit = 0.62 + Math.random() * 0.16;
    } else if (roll < 0.93) {
      // 中央数据中庭：窄而高，提供终章的视觉锚点。
      const ang = Math.random() * Math.PI * 2;
      const r = 0.18 + Math.random() * 0.55;
      x = Math.cos(ang) * r;
      z = -1.25 + Math.sin(ang) * r * 0.7;
      y = Math.random() * 11.5;
      hue = 0.5 + Math.random() * 0.06;
      sat = 0.92;
      lit = 0.62 + Math.random() * 0.18;
    } else {
      // 漂浮的扫描噪点，强化“从雾里 splat 化成形”的瞬间。
      x = (Math.random() - 0.5) * 11.5;
      z = (Math.random() - 0.5) * 8.2 - 0.3;
      y = Math.random() * 10.8;
      hue = Math.random() > 0.55 ? 0.52 : 0.82;
      sat = 0.9;
      lit = 0.54 + Math.random() * 0.18;
    }

    f32[fi + 0] = x;
    f32[fi + 1] = y;
    f32[fi + 2] = z;
    const s = 0.18 + Math.random() * (roll < 0.34 ? 0.46 : 0.32);
    f32[fi + 3] = s;
    f32[fi + 4] = s * (0.75 + Math.random() * 0.55);
    f32[fi + 5] = s * (0.8 + Math.random() * 0.35);

    const [r0, g0, b0] = hslToRgb(hue + (Math.random() - 0.5) * 0.04, sat, lit);
    u8[o + 24] = r0 | 0;
    u8[o + 25] = g0 | 0;
    u8[o + 26] = b0 | 0;
    u8[o + 27] = Math.floor(180 + Math.random() * 75);

    u8[o + 28] = 255;
    u8[o + 29] = 128;
    u8[o + 30] = 128;
    u8[o + 31] = 128;
  }
  return new Uint8Array(buf);
}

function getProjectionMatrix(fx, fy, w, h) {
  const zn = 0.2, zf = 200;
  return [
    (2 * fx) / w, 0, 0, 0,
    0, -(2 * fy) / h, 0, 0,
    0, 0, zf / (zf - zn), 1,
    0, 0, -(zf * zn) / (zf - zn), 0,
  ];
}

function multiply4(a, b) {
  return [
    b[0] * a[0] + b[1] * a[4] + b[2] * a[8] + b[3] * a[12],
    b[0] * a[1] + b[1] * a[5] + b[2] * a[9] + b[3] * a[13],
    b[0] * a[2] + b[1] * a[6] + b[2] * a[10] + b[3] * a[14],
    b[0] * a[3] + b[1] * a[7] + b[2] * a[11] + b[3] * a[15],
    b[4] * a[0] + b[5] * a[4] + b[6] * a[8] + b[7] * a[12],
    b[4] * a[1] + b[5] * a[5] + b[6] * a[9] + b[7] * a[13],
    b[4] * a[2] + b[5] * a[6] + b[6] * a[10] + b[7] * a[14],
    b[4] * a[3] + b[5] * a[7] + b[6] * a[11] + b[7] * a[15],
    b[8] * a[0] + b[9] * a[4] + b[10] * a[8] + b[11] * a[12],
    b[8] * a[1] + b[9] * a[5] + b[10] * a[9] + b[11] * a[13],
    b[8] * a[2] + b[9] * a[6] + b[10] * a[10] + b[11] * a[14],
    b[8] * a[3] + b[9] * a[7] + b[10] * a[11] + b[11] * a[15],
    b[12] * a[0] + b[13] * a[4] + b[14] * a[8] + b[15] * a[12],
    b[12] * a[1] + b[13] * a[5] + b[14] * a[9] + b[15] * a[13],
    b[12] * a[2] + b[13] * a[6] + b[14] * a[10] + b[15] * a[14],
    b[12] * a[3] + b[13] * a[7] + b[14] * a[11] + b[15] * a[15],
  ];
}

function translate4(a, x, y, z) {
  return [
    ...a.slice(0, 12),
    a[0] * x + a[4] * y + a[8] * z + a[12],
    a[1] * x + a[5] * y + a[9] * z + a[13],
    a[2] * x + a[6] * y + a[10] * z + a[14],
    a[3] * x + a[7] * y + a[11] * z + a[15],
  ];
}

const VS = `#version 300 es
precision highp float;precision highp int;
uniform highp usampler2D u_texture;uniform mat4 projection,view;uniform vec2 focal,viewport;
uniform float uReveal;
in vec2 position;in int index;out vec4 vColor;out vec2 vPosition;
void main(){
  uvec4 cen=texelFetch(u_texture,ivec2((uint(index)&0x3ffu)<<1,uint(index)>>10),0);
  vec4 cam=view*vec4(uintBitsToFloat(cen.xyz),1.);vec4 pos2d=projection*cam;
  float clip=1.2*pos2d.w;
  if(pos2d.z<-clip||pos2d.x<-clip||pos2d.x>clip||pos2d.y<-clip||pos2d.y>clip){gl_Position=vec4(0.,0.,2.,1.);return;}
  uvec4 cov=texelFetch(u_texture,ivec2(((uint(index)&0x3ffu)<<1)|1u,uint(index)>>10),0);
  vec2 u1=unpackHalf2x16(cov.x),u2=unpackHalf2x16(cov.y),u3=unpackHalf2x16(cov.z);
  mat3 Vrk=mat3(u1.x,u1.y,u2.x,u1.y,u2.y,u3.x,u2.x,u3.x,u3.y);
  mat3 J=mat3(focal.x/cam.z,0.,-(focal.x*cam.x)/(cam.z*cam.z),0.,-focal.y/cam.z,(focal.y*cam.y)/(cam.z*cam.z),0.,0.,0.);
  mat3 T=transpose(mat3(view))*J;mat3 cov2d=transpose(T)*Vrk*T;
  float mid=(cov2d[0][0]+cov2d[1][1])/2.;float radius=length(vec2((cov2d[0][0]-cov2d[1][1])/2.,cov2d[0][1]));
  float lambda1=mid+radius,lambda2=mid-radius;if(lambda2<0.)return;
  vec2 dv=vec2(cov2d[0][1],lambda1-cov2d[0][0]);float dvl=length(dv);
  if(dvl<1e-4)dv=vec2(1.,0.);else dv/=dvl;
  vec2 majorAxis=min(sqrt(2.*lambda1),1024.)*dv*uReveal;
  vec2 minorAxis=min(sqrt(2.*lambda2),1024.)*vec2(dv.y,-dv.x)*uReveal;
  vColor=vec4((cov.w)&0xffu,(cov.w>>8)&0xffu,(cov.w>>16)&0xffu,((cov.w>>24)&0xffu)*uReveal)/255.;
  vPosition=position;vec2 vCenter=vec2(pos2d)/pos2d.w;
  gl_Position=vec4(vCenter+position.x*majorAxis/viewport+position.y*minorAxis/viewport,0.,1.);
}`;

const FS = `#version 300 es
precision highp float;in vec4 vColor;in vec2 vPosition;out vec4 fragColor;
void main(){float A=-dot(vPosition,vPosition);if(A<-4.)discard;float B=exp(A)*vColor.a;fragColor=vec4(B*vColor.rgb,B);}`;

function createWorker(self) {
  let buffer, vertexCount = 0, viewProj, lastProj = [], depthIndex = new Uint32Array(), lastVertexCount = 0, sortRunning;
  const fv = new Float32Array(1), iv = new Int32Array(fv.buffer);
  function floatToHalf(f) {
    fv[0] = f;
    let x = iv[0], sign = (x >> 31) & 1, exp = (x >> 23) & 0xff, frac = x & 0x7fffff, ne;
    if (exp === 0) ne = 0;
    else if (exp < 113) { ne = 0; frac |= 0x800000; frac >>= (113 - exp); if (frac & 0x1000000) { ne = 1; frac = 0; } }
    else if (exp < 142) ne = exp - 112;
    else { ne = 31; frac = 0; }
    return (sign << 15) | (ne << 10) | (frac >> 13);
  }
  function packHalf2x16(x, y) { return (floatToHalf(x) | (floatToHalf(y) << 16)) >>> 0; }
  function generateTexture() {
    if (!buffer) return;
    const f_buffer = new Float32Array(buffer), u_buffer = new Uint8Array(buffer);
    const texwidth = 2048, texheight = Math.ceil((2 * vertexCount) / texwidth);
    const texdata = new Uint32Array(texwidth * texheight * 4), texdata_c = new Uint8Array(texdata.buffer), texdata_f = new Float32Array(texdata.buffer);
    for (let i = 0; i < vertexCount; i++) {
      texdata_f[8 * i + 0] = f_buffer[8 * i + 0]; texdata_f[8 * i + 1] = f_buffer[8 * i + 1]; texdata_f[8 * i + 2] = f_buffer[8 * i + 2];
      texdata_c[4 * (8 * i + 7) + 0] = u_buffer[32 * i + 24 + 0]; texdata_c[4 * (8 * i + 7) + 1] = u_buffer[32 * i + 24 + 1];
      texdata_c[4 * (8 * i + 7) + 2] = u_buffer[32 * i + 24 + 2]; texdata_c[4 * (8 * i + 7) + 3] = u_buffer[32 * i + 24 + 3];
      const scale = [f_buffer[8 * i + 3], f_buffer[8 * i + 4], f_buffer[8 * i + 5]];
      const rot = [(u_buffer[32 * i + 28] - 128) / 128, (u_buffer[32 * i + 29] - 128) / 128, (u_buffer[32 * i + 30] - 128) / 128, (u_buffer[32 * i + 31] - 128) / 128];
      const M = [1 - 2 * (rot[2] ** 2 + rot[3] ** 2), 2 * (rot[1] * rot[2] + rot[0] * rot[3]), 2 * (rot[1] * rot[3] - rot[0] * rot[2]),
        2 * (rot[1] * rot[2] - rot[0] * rot[3]), 1 - 2 * (rot[1] ** 2 + rot[3] ** 2), 2 * (rot[2] * rot[3] + rot[0] * rot[1]),
        2 * (rot[1] * rot[3] + rot[0] * rot[2]), 2 * (rot[2] * rot[3] - rot[0] * rot[1]), 1 - 2 * (rot[1] ** 2 + rot[2] ** 2)].map((k, j) => k * scale[(j / 3) | 0]);
      const sigma = [M[0] ** 2 + M[3] ** 2 + M[6] ** 2, M[0] * M[1] + M[3] * M[4] + M[6] * M[7], M[0] * M[2] + M[3] * M[5] + M[6] * M[8],
        M[1] ** 2 + M[4] ** 2 + M[7] ** 2, M[1] * M[2] + M[4] * M[5] + M[7] * M[8], M[2] ** 2 + M[5] ** 2 + M[8] ** 2];
      texdata[8 * i + 4] = packHalf2x16(4 * sigma[0], 4 * sigma[1]);
      texdata[8 * i + 5] = packHalf2x16(4 * sigma[2], 4 * sigma[3]);
      texdata[8 * i + 6] = packHalf2x16(4 * sigma[4], 4 * sigma[5]);
    }
    self.postMessage({ texdata, texwidth, texheight }, [texdata.buffer]);
  }
  function runSort(viewProjIn) {
    if (!buffer) return;
    const f_buffer = new Float32Array(buffer);
    if (lastVertexCount !== vertexCount) { generateTexture(); lastVertexCount = vertexCount; }
    else {
      const dot = lastProj[2] * viewProjIn[2] + lastProj[6] * viewProjIn[6] + lastProj[10] * viewProjIn[10];
      if (Math.abs(dot - 1) < 0.01) return;
    }
    let maxD = -Infinity, minD = Infinity, sizeList = new Int32Array(vertexCount);
    for (let i = 0; i < vertexCount; i++) {
      const d = ((viewProjIn[2] * f_buffer[8 * i] + viewProjIn[6] * f_buffer[8 * i + 1] + viewProjIn[10] * f_buffer[8 * i + 2]) * 4096) | 0;
      sizeList[i] = d;
      if (d > maxD) maxD = d;
      if (d < minD) minD = d;
    }
    let span = maxD - minD;
    if (span < 1) span = 1;
    const inv = (256 * 256 - 1) / span, counts0 = new Uint32Array(256 * 256);
    for (let i = 0; i < vertexCount; i++) { sizeList[i] = ((sizeList[i] - minD) * inv) | 0; counts0[sizeList[i]]++; }
    const starts0 = new Uint32Array(256 * 256);
    for (let i = 1; i < 256 * 256; i++) starts0[i] = starts0[i - 1] + counts0[i - 1];
    depthIndex = new Uint32Array(vertexCount);
    for (let i = 0; i < vertexCount; i++) depthIndex[starts0[sizeList[i]]++] = i;
    lastProj = viewProjIn;
    self.postMessage({ depthIndex, viewProj: viewProjIn, vertexCount }, [depthIndex.buffer]);
  }
  const throttledSort = () => {
    if (!sortRunning) {
      sortRunning = true;
      const lv = viewProj;
      runSort(lv);
      setTimeout(() => { sortRunning = false; if (lv !== viewProj) throttledSort(); }, 0);
    }
  };
  self.onmessage = (e) => {
    if (e.data.buffer) { buffer = e.data.buffer; vertexCount = e.data.vertexCount; lastVertexCount = 0; lastProj = []; }
    else if (e.data.view) { viewProj = e.data.view; throttledSort(); }
  };
}

function threeToCols(m) {
  const e = m.elements;
  return [
    e[0], e[1], e[2], e[3],
    e[4], e[5], e[6], e[7],
    e[8], e[9], e[10], e[11],
    e[12], e[13], e[14], e[15],
  ];
}

export class SplatOverlay {
  constructor(gl) {
    if (!(gl instanceof WebGL2RenderingContext)) throw new Error('SplatOverlay 需要 WebGL2');
    this.gl = gl;
    this.vertexCount = 0;
    this.reveal = 0;
    this.worldPos = { x: 0, y: 0, z: 0 };
    this.scale = 1;
    this.projectionMatrix = null;
    this.ready = false;

    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    this.prog = gl.createProgram();
    gl.attachShader(this.prog, compile(gl.VERTEX_SHADER, VS));
    gl.attachShader(this.prog, compile(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(this.prog);

    this.uP = gl.getUniformLocation(this.prog, 'projection');
    this.uV = gl.getUniformLocation(this.prog, 'view');
    this.uF = gl.getUniformLocation(this.prog, 'focal');
    this.uVp = gl.getUniformLocation(this.prog, 'viewport');
    this.uT = gl.getUniformLocation(this.prog, 'u_texture');
    this.uReveal = gl.getUniformLocation(this.prog, 'uReveal');
    gl.uniform1i(this.uT, 0);

    const tri = new Float32Array([-2, -2, 2, -2, 2, 2, -2, 2]);
    this.vb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vb);
    gl.bufferData(gl.ARRAY_BUFFER, tri, gl.STATIC_DRAW);
    const aP = gl.getAttribLocation(this.prog, 'position');
    gl.enableVertexAttribArray(aP);
    gl.vertexAttribPointer(aP, 2, gl.FLOAT, false, 0, 0);

    this.ib = gl.createBuffer();
    const aI = gl.getAttribLocation(this.prog, 'index');
    gl.enableVertexAttribArray(aI);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.ib);
    gl.vertexAttribIPointer(aI, 1, gl.INT, false, 0, 0);
    gl.vertexAttribDivisor(aI, 1);

    this.tex = gl.createTexture();
    this.worker = new Worker(URL.createObjectURL(new Blob([`(${createWorker.toString()})(self)`], { type: 'application/javascript' })));
    this.worker.onmessage = (e) => {
      if (e.data.texdata) {
        const { texdata, texwidth, texheight } = e.data;
        gl.bindTexture(gl.TEXTURE_2D, this.tex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32UI, texwidth, texheight, 0, gl.RGBA_INTEGER, gl.UNSIGNED_INT, texdata);
      } else if (e.data.depthIndex) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.ib);
        gl.bufferData(gl.ARRAY_BUFFER, e.data.depthIndex, gl.DYNAMIC_DRAW);
        this.vertexCount = e.data.vertexCount;
        this.ready = this.vertexCount > 0;
      }
    };

    this.loadBuffer(createPlazaSplat());
  }

  loadBuffer(buf) {
    const n = Math.floor(buf.byteLength / ROW);
    this.vertexCount = 0;
    this.ready = false;
    this.worker.postMessage({ buffer: buf.buffer.slice(0), vertexCount: n });
  }

  setWorldPosition(x, y, z) {
    this.worldPos = { x, y, z };
  }

  setReveal(v) {
    this.reveal = Math.max(0, Math.min(1, v));
  }

  resize(w, h, fovDeg) {
    const fy = (h / 2) / Math.tan((fovDeg * Math.PI) / 360);
    const fx = fy * (w / h);
    this.projectionMatrix = getProjectionMatrix(fx, fy, w, h);
    this.fx = fx;
    this.fy = fy;
    this.width = w;
    this.height = h;
  }

  renderFromCamera(camera) {
    if (!this.ready || this.reveal < 0.001 || !this.projectionMatrix) return;
    const gl = this.gl;

    camera.updateMatrixWorld();
    const view = threeToCols(camera.matrixWorldInverse);
    const model = translate4(
      [this.scale, 0, 0, 0, 0, this.scale, 0, 0, 0, 0, this.scale, 0, 0, 0, 0, 1],
      this.worldPos.x, this.worldPos.y, this.worldPos.z,
    );
    const viewModel = multiply4(view, model);
    const viewProj = multiply4(this.projectionMatrix, viewModel);
    this.worker.postMessage({ view: viewProj });

    gl.useProgram(this.prog);
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.ONE_MINUS_DST_ALPHA, gl.ONE, gl.ONE_MINUS_DST_ALPHA, gl.ONE);
    gl.blendEquationSeparate(gl.FUNC_ADD, gl.FUNC_ADD);

    gl.uniformMatrix4fv(this.uP, false, this.projectionMatrix);
    gl.uniformMatrix4fv(this.uV, false, viewModel);
    gl.uniform2fv(this.uF, new Float32Array([this.fx, this.fy]));
    gl.uniform2fv(this.uVp, new Float32Array([this.width, this.height]));
    gl.uniform1f(this.uReveal, this.reveal);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vb);
    const aP = gl.getAttribLocation(this.prog, 'position');
    gl.vertexAttribPointer(aP, 2, gl.FLOAT, false, 0, 0);

    if (this.vertexCount > 0) {
      gl.drawArraysInstanced(gl.TRIANGLE_FAN, 0, 4, this.vertexCount);
    }
  }

  dispose() {
    this.worker.terminate();
  }
}
