// InstancedMesh 图集选帧助手（R19：参数碑数字面 / 幕墙三变体共用）
//
// 问题：一个 InstancedMesh 只有一份材质一张贴图，64 个实例想要「各自不同的画面」，
//      常规做法是拆 mesh（+draw call）或拆纹理单元（+贴图绑定）。
// 做法：把多张画面烘进一张图集，给材质注入 per-instance uvOffset，
//      顶点阶段把 vMapUv（及 vEmissiveMapUv）重映射到本实例那一格 ——
//      0 额外 draw call、0 额外贴图单元。
import * as THREE from 'three'

/**
 * 给材质打图集补丁：vMapUv = vMapUv * scale + uvOffset（per-instance）。
 * 必须在材质首次编译前设置（JSX 里直接作为 onBeforeCompile prop 传入即可）。
 */
export function atlasOnBeforeCompile(scaleX: number, scaleY: number) {
  return (shader: THREE.WebGLProgramParametersWithUniforms) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 uvOffset;')
      .replace(
        '#include <uv_vertex>',
        `#include <uv_vertex>
#ifdef USE_MAP
  vMapUv = vMapUv * vec2(${scaleX.toFixed(6)}, ${scaleY.toFixed(6)}) + uvOffset;
#endif
#ifdef USE_EMISSIVEMAP
  vEmissiveMapUv = vEmissiveMapUv * vec2(${scaleX.toFixed(6)}, ${scaleY.toFixed(6)}) + uvOffset;
#endif`,
      )
  }
}

/** 生成 uvOffset instanced attribute 的底层数组（n 实例 × vec2） */
export function makeUvOffsetArray(n: number): Float32Array {
  return new Float32Array(n * 2)
}
