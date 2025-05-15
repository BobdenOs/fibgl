"use strict";

const vertexShaderSource = `#version 300 es

uniform ivec2 u_resolution;

// all shaders have a main function
void main() {
  // gl_Position is a special variable a vertex shader
  // is responsible for setting
  gl_Position = vec4(0,0,0,1);
  gl_PointSize = 1000.0f;
}
`;

const fragmentShaderSource = `#version 300 es

// fragment shaders don't have a default precision so we need
// to pick one. highp is a good default. It means "high precision"
precision highp float;

uniform ivec2 u_resolution;

uniform sampler2D u_phi;
uniform sampler2D u_last;

// we need to declare an output for the fragment shader
out vec4 outColor;

int pick_texture (int index, sampler2D tex) {
  // Convert index into pixel space
  float i = float(index / 4);

  // Get width and height of texture
  ivec2 tex_res = textureSize(tex,0);
  float w = float(tex_res.x);
  float h = float(tex_res.y);

  // Compute the pixel coordinates
  float r = i / w;
  float y = float(floor(r));
  float x = i - (y * w);

  // Convert pixel coordinates to texture float coordinates
  vec4 pixel = texture(tex, vec2(x / w, y / h));

  // Convert pixel into byte
  int offset = index - (index / 4 * 4);
  if (offset == 0) { return int(pixel.x * 255.0); }
  if (offset == 1) { return int(pixel.y * 255.0); }
  if (offset == 2) { return int(pixel.z * 255.0); }
  if (offset == 3) { return int(pixel.a * 255.0); }
}

int length_phi() {
  ivec2 size = textureSize(u_phi,0);
  return size.x * size.y;
}

int pick_phi (int index) {
  return pick_texture(index, u_phi);
}

int pick_last (int index) {
  return pick_texture(index, u_last);
}

int shift_last (int index, int shift) {
  float i = float(index);
  float bytes = float(shift) / 8.0;
  float bytesFloor = floor(bytes);

  if ( // Check whether index is inside shift bounds
    i < bytesFloor // ||
    // nr.length + Math.ceil(bytes) <= i
  ) return 0;

  int bits = int((bytes - bytesFloor) * 8.0);
  return (pick_last(int(i - bytesFloor)) >> bits | (pick_last(int(i - bytesFloor) - 1) | 0) << 8 - bits) & 255 /* 0b11111111 */;
}

int mul_last_phi_byte(int index) {
  int ret = 0;
  int carry = 0;

  // Compute the carry with a little offset
  // TODO: compute whether the carry might be impacted by previous bytes
  for (int i = index + 3; i >= index; i--) {
    int cur = pick_last(i) + carry;
    for (int x = length_phi() - 1; x >= 0; x--) {
      int offset = x * 8;
      int curPhi = pick_phi(x);
      if (128 == (curPhi & 128 /* 0b10000000 */)) { cur += shift_last(i, offset + 1); }
      if ( 64 == (curPhi &  64 /* 0b01000000 */)) { cur += shift_last(i, offset + 2); }
      if ( 32 == (curPhi &  32 /* 0b00100000 */)) { cur += shift_last(i, offset + 3); }
      if ( 16 == (curPhi &  16 /* 0b00010000 */)) { cur += shift_last(i, offset + 4); }
      if (  8 == (curPhi &   8 /* 0b00001000 */)) { cur += shift_last(i, offset + 5); }
      if (  4 == (curPhi &   4 /* 0b00000100 */)) { cur += shift_last(i, offset + 6); }
      if (  2 == (curPhi &   2 /* 0b00000010 */)) { cur += shift_last(i, offset + 7); }
      if (  1 == (curPhi &   1 /* 0b00000001 */)) { cur += shift_last(i, offset + 8); }
    }
    carry = cur >> 8;

    // Add Rounding behavior
    // When i is equal to the ret.length
    // It means it is the bit before the whole numbers
    // If the first bit is set it means it is 0.5 or higher
    // As the logic requires a Math.round
    // If the bit is set it should actually carry up
    if ((u_resolution.x * u_resolution.y) * 4 == i && 128 == (cur & 128 /* 0b10000000 */)) { carry += 1; }

    ret = cur & 255 /* 0b11111111 */;
  }
  return ret;
}

void main() {
  ivec2 pos = ivec2(gl_FragCoord);
  int i = ((pos.y * u_resolution.x) + pos.x) * 4;

  outColor = vec4(
    float(mul_last_phi_byte(i + 0)) / 255.0,
    float(mul_last_phi_byte(i + 1)) / 255.0,
    float(mul_last_phi_byte(i + 2)) / 255.0,
    float(mul_last_phi_byte(i + 3)) / 255.0
  );

  // Echo out every phi byte to make sure that pick works correctly
  // outColor = vec4(
  //   float(pick_phi(i + 0)) / 255.0,
  //   float(pick_phi(i + 1)) / 255.0,
  //   float(pick_phi(i + 2)) / 255.0,
  //   float(pick_phi(i + 3)) / 255.0
  // );

  // outColor = vec4(gl_FragCoord.x / 255.0,gl_FragCoord.y / 255.0, float(i) / 255.0, float(pick_phi(i)) / 255.0);
  // outColor = vec4(
  //   float(pick_phi(i))/255.0,
  //   float(pick_phi(i))/255.0,
  //   float(pick_phi(i))/255.0,
  //   float(pick_phi(i))/255.0
  // );
  // outColor = texture(u_phi, vec2(gl_FragCoord.x / u_resolution.x, gl_FragCoord.y / u_resolution.y));
  // outColor = vec4( gl_FragCoord.x / u_resolution.x, gl_FragCoord.y / u_resolution.y, 0, 1);
}
`;

async function init() {
  // Configurations
  const precisionConfig = Number.parseFloat(new window.URLSearchParams(window.location.search).get('prec'))
  const precision = precisionConfig && !Number.isNaN(precisionConfig)
    ? Math.ceil(Math.sqrt(precisionConfig / 32)) ** 2 * 32
    : 8 ** 2 * 32

  const resolution = Math.ceil(Math.sqrt(precision / 32))
  const canvas = document.querySelector('#webcl')
  const gl = canvas.getContext('webgl2')
  if (!gl) {
    return // TODO: show error in HTML
  }

  // Create a texture for phi to be stored into
  const phi_texture = gl.createTexture()
  gl.activeTexture(gl.TEXTURE0)
  gl.bindTexture(gl.TEXTURE_2D, phi_texture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)

  // Download pre compute phi in binary format
  await fetch('phi.bin').then(async res => {
    const data = new Uint8Array(await res.arrayBuffer())
    // Map the binary data into an 2D array texture format
    const size = Math.sqrt(data.length / 4)
    gl.bindTexture(gl.TEXTURE_2D, phi_texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, data)
  })

  // Create a texture for phi to be stored into
  const last_texture = gl.createTexture()
  gl.activeTexture(gl.TEXTURE1)
  gl.bindTexture(gl.TEXTURE_2D, last_texture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)

  // Set the last texture value to a valid fib(n) result
  const initial = new Uint8Array(resolution ** 2 * 4)
  initial[initial.length - 1] = 1

  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, resolution, resolution, 0, gl.RGBA, gl.UNSIGNED_BYTE, initial)

  // Create last_texture framebuffer
  const last_framebuffer = gl.createFramebuffer()
  gl.bindFramebuffer(gl.FRAMEBUFFER, last_framebuffer)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, last_texture, 0)

  // Set framebuffer back to the canvas
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)

  // Setup computation shaders and program
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource)
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource)
  const program = createProgram(gl, vertexShader, fragmentShader)

  const resolutionLocation = gl.getUniformLocation(program, "u_resolution")
  const phiLocation = gl.getUniformLocation(program, "u_phi")
  const lastLocation = gl.getUniformLocation(program, "u_last")

  gl.canvas.width = gl.canvas.height = resolution
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
  gl.useProgram(program)

  // Convert the numeric precision into texture resolution
  gl.uniform2iv(resolutionLocation, [resolution, resolution])

  // Make sure to align the texture uniform variables with their texture indexes
  gl.uniform1i(phiLocation, 0)
  gl.uniform1i(lastLocation, 1)

  const output = document.querySelector('#output')
  document.body.appendChild(output)

  const s = performance.now()
  let i = 3

  // Estimate max fib number that fits inside the configured precision safely
  const max = Math.ceil(precision / 23 * 32) + 1
  const next = () => {
    // Do the actual computation
    gl.drawArrays(gl.POINTS, 0, 1)

    output.innerHTML = `fib(${i}) / fib(${max})<br/>${extractResult(gl).toLocaleString().replace(/[,.]/g, (m) => `${m}&shy;`)}`

    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, last_framebuffer)
    gl.blitFramebuffer(
      0, 0, canvas.width, canvas.height,
      0, 0, canvas.width, canvas.height,
      gl.COLOR_BUFFER_BIT, gl.NEAREST,
    )
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null)

    i++
    if (i > max) return // Stop when the number would overflow
    if (i % 4 === 0) requestAnimationFrame(next)
    else next()
  }
  requestAnimationFrame(next)
}

let pixels
function extractResult(gl) {
  const canvas = gl.canvas
  // Extract result from the output frame buffer
  gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null)
  if (!pixels) pixels = new Uint8Array(canvas.width * canvas.height * 4)
  gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)

  // Convert from binary to base10 with hex intermediate
  let hex = '0x'
  for (let i = 0; i < pixels.length; i++) {
    hex += pixels[i].toString(16).padStart(2, '0')
  }
  return BigInt(hex)
}

function createShader(gl, type, source) {
  var shader = gl.createShader(type)
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  var success = gl.getShaderParameter(shader, gl.COMPILE_STATUS)
  if (success) {
    return shader
  }

  console.log(gl.getShaderInfoLog(shader))
  gl.deleteShader(shader)
  return undefined
}

function createProgram(gl, vertexShader, fragmentShader) {
  var program = gl.createProgram()
  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)
  gl.linkProgram(program)
  var success = gl.getProgramParameter(program, gl.LINK_STATUS)
  if (success) {
    return program
  }

  console.log(gl.getProgramInfoLog(program))
  gl.deleteProgram(program)
  return undefined
}
