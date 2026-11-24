// Deliberately invalid WGSL (P-03 validation): CI must fail on it.
@compute @workgroup_size(1)
fn main() { let x: f32 = 1u; }
