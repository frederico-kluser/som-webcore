// Test-only kernel (P-03): y = W·x + b with W in FP16, two values per u32, and the
// arithmetic in f32 — the scheme of ROADMAP §6.2, decision 2. `unpack2x16float` is WGSL core,
// so no optional feature (`shader-f16`) is needed. K-02 brings the engine's real kernels.

struct Dims {
  rows: u32,
  cols: u32,
}

@group(0) @binding(0) var<uniform> dims: Dims;
@group(0) @binding(1) var<storage, read> w: array<u32>;
@group(0) @binding(2) var<storage, read> x: array<f32>;
@group(0) @binding(3) var<storage, read> b: array<f32>;
@group(0) @binding(4) var<storage, read_write> y: array<f32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let row = gid.x;
  if (row >= dims.rows) {
    return;
  }
  let pairs = dims.cols / 2u;
  var acc: f32 = 0.0;
  for (var p: u32 = 0u; p < pairs; p++) {
    let wp = unpack2x16float(w[row * pairs + p]);
    acc += wp.x * x[2u * p] + wp.y * x[2u * p + 1u];
  }
  y[row] = acc + b[row];
}
