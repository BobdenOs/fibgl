function fib_BigInt(n) {
  let a = BigInt(0)
  let b = BigInt(1)
  let tmp
  // let temp2
  let bit = 1
  let i = 0
  for (; bit < n; bit <<= 1) { };
  for (; bit; bit >>= 1) {
    // const curMax = Math.ceil(Math.max(a.toString(2).length / 8, b.toString(2).length / 8))
    // const curGuess = Math.ceil((1 << i) / 16)
    // console.log('step:', i++, 'max:', curMax, 'guess:', curGuess, 'div:', curGuess / curMax)
    // if(curGuess < curMax) return -1
    // temp2 = a * b
    tmp = a * a // a ** 2n
    // temp2 = temp2 << 1n // temp2 * 2n // temp2 + temp2
    const t0 = (a * b << 1n)
    a = tmp + t0 // TODO: can do early exit when last compute without requirement for (n & bit)
    // temp2 = b * b // b ** 2n
    const t1 = b * b
    b = tmp + t1//temp1 + temp2
    if (n & bit) {
      tmp = a
      a = a + b
      b = tmp
    }
  }
  return a
}

class gl_int {
  constructor(gl, nr, size) {
    Error.captureStackTrace(this)

    this.gl = gl

    this.index = gl._textures.findIndex(a => a == null)
    if (this.index < 0) this.index = gl._textures.length
    gl._textures[this.index] = this
    // Create actual texture reference
    const texture = this.texture = gl.createTexture()

    // Set the new texture to the current active texture for configurations
    gl.activeTexture(gl.TEXTURE0 + this.index)
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)

    // Create initial number contents
    this.size = size ??= Math.ceil(Math.log2(nr || 1) / 8) || 1
    const size_pixels = Math.ceil(this.size / 4)
    for (let i = 1; i < gl._max_texture_size; i++) {
      let div_size_pixels = Math.ceil(size_pixels / i)
      if (div_size_pixels <= gl._max_texture_size) {
        this.width = div_size_pixels
        this.height = i
        break
      }
    }

    if (nr > 0) {
      const initial = new Uint8Array(this.width * this.height * 4)
      for (let i = 0; i < Math.min(4, this.size); i++) {
        initial[initial.length - 1 - i] = (nr >> (i * 8)) & 255
      }

      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.width, this.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, initial)
    } else {
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, this.width, this.height)
    }
  }

  src() {
    return this.index
  }

  target() {
    let { gl, framebuffer, texture } = this

    // Ensure that the number has a framebuffer to target
    if (!framebuffer) {
      framebuffer = this.framebuffer = gl.createFramebuffer()
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
    }
    gl.viewport(0, 0, this.width, this.height)
  }

  read() {
    const { gl } = this

    this.target()

    const height = Math.ceil(Math.ceil(this.size / 4) / this.width)

    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null)
    const pixels = new Uint8Array(this.width * height * 4)
    gl.readPixels(0, this.height - height, this.width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
    return BigInt('0x' + [...pixels].map(c => c.toString(16).padStart(2, '0')).join(''))
  }

  destroy() {
    const { gl, texture, framebuffer } = this
    gl.deleteTexture(texture)
    gl.deleteFramebuffer(framebuffer)
    gl._textures[this.index] = undefined
  }
}

class gl {
  constructor() {
    const canvas = document.createElement('canvas')
    const gl = this.gl = canvas.getContext('webgl2')
    if (!gl) {
      throw new Error(`webgl2 doesn't seem to be supported`)
    }

    canvas.addEventListener("webglcontextlost", (event) => {
      debugger
      canvas
      gl
    })

    gl._textures = []
    gl._max_texture_size = gl.getParameter(gl.MAX_TEXTURE_SIZE)
  }

  int(nr) {
    const { gl } = this
    return new gl_int(gl, nr)
  }

  async add(c, a, b) {
    // if (a.size == 1200) a.size = 1199
    const { gl } = this
    const program = this._add
    gl.useProgram(program)

    c.size = Math.max(a.size, b.size) + 1
    // const c = new gl_int(gl, 0, Math.max(a.size, b.size) + 1)

    // Set arguments
    gl.uniform2iv(program.params.resolution, [c.width, c.height])
    gl.uniform1i(program.params.a, a.src())
    gl.uniform1i(program.params.a_length, a.size)
    gl.uniform1i(program.params.b, b.src())
    gl.uniform1i(program.params.b_length, b.size)
    gl.uniform1i(program.params.c_length, c.size)
    c.target()

    // Execute actual function
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    // await this.sync()

    trace(() => {
      const c_read = c.read()
      const a_read = a.read()
      const b_read = b.read()

      console.log('add :', c_read, 'size', c.size, 'width', c.width, 'height', c.height)
      console.log('add(', a_read, ',', b_read, ')')
      if (a_read + b_read !== c_read) {
        debugger
      }
    }, 'add')

    return c
  }

  get _add() {
    const vertexShaderSource = `#version 300 es

uniform ivec2 u_resolution;

uniform int c_length;

void main() {
  // Draw a square which covers the whole output
  float s = 1.0f - ((float(((c_length / 4 + 1) / u_resolution.x) + 1) / float(u_resolution.y)) * 2.0f);
  if (gl_VertexID == 0) { gl_Position = vec4(-1, s,0,1); }
  if (gl_VertexID == 2) { gl_Position = vec4(-1, 1,0,1); }
  if (gl_VertexID == 1) { gl_Position = vec4( 1, s,0,1); }
  if (gl_VertexID == 3) { gl_Position = vec4( 1, 1,0,1); }
}
`;

    const fragmentShaderSource = `#version 300 es

precision highp float;
precision highp int;

uniform ivec2 u_resolution;

uniform int a_length;
uniform int b_length;
uniform int c_length;

uniform sampler2D u_a;
uniform sampler2D u_b;

// we need to declare an output for the fragment shader
out vec4 outColor;

int pick_texture (int index, sampler2D tex, int length) {
  // Get width and height of texture
  ivec2 tex_res = textureSize(tex,0);

  int filler = (tex_res.x * tex_res.y * 4) - length;
  index += filler;

  float w = float(tex_res.x);
  float h = float(tex_res.y);

  // Convert index into pixel space
  float i = float(index / 4);

  // Prevent index from looking outside of texture space
  // as textures wrap while buffers overflow
  if (index < filler || i > w * h) return 0;

  // Compute the pixel coordinates
  float r = i / w;
  float y = float(floor(r));
  float x = i - (y * w);

  // Convert pixel coordinates to texture float coordinates
  vec4 pixel = texture(tex, vec2((x + 0.5f) / w, (y + 0.5f) / h));

  // Convert pixel into byte
  int offset = index - (index / 4 * 4);
  if (offset == 0) { return int(pixel.x * 255.0); }
  if (offset == 1) { return int(pixel.y * 255.0); }
  if (offset == 2) { return int(pixel.z * 255.0); }
  if (offset == 3) { return int(pixel.a * 255.0); }
}

void rreturn(int x, int y, int z, int w) {
  outColor = vec4(
    float(x & 255) / 255.0,
    float(y & 255) / 255.0,
    float(z & 255) / 255.0,
    float(w & 255) / 255.0
  );
}

void main() {
  ivec2 pos = ivec2(gl_FragCoord);
  int output_length = u_resolution.x * u_resolution.y * 4;
  int i = (((pos.y * u_resolution.x) + pos.x) * 4);

  if(output_length - i - 4 > c_length) {
    discard;
  }

  int o = output_length - i;
  int a0 = pick_texture(a_length - (o - 0), u_a, a_length);
  int a1 = pick_texture(a_length - (o - 1), u_a, a_length);
  int a2 = pick_texture(a_length - (o - 2), u_a, a_length);
  int a3 = pick_texture(a_length - (o - 3), u_a, a_length);

  int b0 = pick_texture(b_length - (o - 0), u_b, b_length);
  int b1 = pick_texture(b_length - (o - 1), u_b, b_length);
  int b2 = pick_texture(b_length - (o - 2), u_b, b_length);
  int b3 = pick_texture(b_length - (o - 3), u_b, b_length);

  int carry = 255;
  int offset = 4;
  while(carry == 255) {
    int ca = pick_texture(a_length - (o - offset), u_a, a_length);
    int cb = pick_texture(b_length - (o - offset), u_b, b_length);
    offset++;
    carry = ca + cb;
  }

  int c3 = a3 + b3 + (carry >> 8);
  int c2 = a2 + b2 + (c3 >> 8);
  int c1 = a1 + b1 + (c2 >> 8);
  int c0 = a0 + b0 + (c1 >> 8);

  rreturn(c0,c1,c2,c3);
  // rreturn(a0,a1,a2,a3);
  // rreturn(b0,b1,b2,b3);
}
`;

    const { gl } = this

    const vertexShader = this._createShader(gl.VERTEX_SHADER, vertexShaderSource)
    const fragmentShader = this._createShader(gl.FRAGMENT_SHADER, fragmentShaderSource)
    const program = this._createProgram(vertexShader, fragmentShader)

    program.params = {
      resolution: gl.getUniformLocation(program, "u_resolution"),
      a: gl.getUniformLocation(program, "u_a"),
      a_length: gl.getUniformLocation(program, "a_length"),
      b: gl.getUniformLocation(program, "u_b"),
      b_length: gl.getUniformLocation(program, "b_length"),
      c_length: gl.getUniformLocation(program, "c_length"),
    }

    return super._add = program
  }

  _createShader(type, source) {
    const { gl } = this
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

  _createProgram(vertexShader, fragmentShader) {
    const { gl } = this

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

  pow2(r, a) {
    return this.mul(r, a, a, 0)
  }

  async mul(c, a, b, shift) {
    const { gl } = this
    const program = this._mul
    gl.useProgram(program)

    if (b.size > a.size) {
      const t = a
      a = b
      b = t
    }

    c.size = a.size + b.size
    // const c = new gl_int(gl, 0, a.size + b.size)

    // Set arguments
    gl.uniform2iv(program.params.resolution, [c.width, c.height])
    gl.uniform1i(program.params.a, a.src())
    gl.uniform1i(program.params.a_length, a.size)
    gl.uniform1i(program.params.b, b.src())
    gl.uniform1i(program.params.b_length, b.size)
    gl.uniform1i(program.params.c_length, c.size)
    gl.uniform1i(program.params.shift, shift)
    c.target()

    // Execute actual function
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    // await this.sync()

    trace(() => {
      const c_read = c.read()
      const a_read = a.read()
      const b_read = b.read()

      console.log(`mul${shift ? 's' : ' '}:`, c_read, 'size', c.size, 'width', c.width, 'height', c.height)
      console.log(`mul${shift ? 's' : ' '}(`, a_read, ',', b_read, ')')
      if ((a_read * b_read) << BigInt(shift) !== c_read) {
        debugger
      }
    }, 'mul')

    return c
  }

  get _mul() {
    const vertexShaderSource = `#version 300 es

precision highp float;
precision highp int;

uniform ivec2 u_resolution;

uniform int c_length;

void main() {
  // Draw a square which covers the whole output
  float s = 1.0f - ((float(((c_length / 4 + 1) / u_resolution.x) + 1) / float(u_resolution.y)) * 2.0f);
  if (gl_VertexID == 0) { gl_Position = vec4(-1, s,0,1); }
  if (gl_VertexID == 2) { gl_Position = vec4(-1, 1,0,1); }
  if (gl_VertexID == 1) { gl_Position = vec4( 1, s,0,1); }
  if (gl_VertexID == 3) { gl_Position = vec4( 1, 1,0,1); }
}
`;

    const fragmentShaderSource = `#version 300 es

precision highp float;
precision highp int;

uniform ivec2 u_resolution;

uniform int a_length;
uniform int b_length;
uniform int c_length;

uniform int u_shift;

uniform sampler2D u_a;
uniform sampler2D u_b;

// we need to declare an output for the fragment shader
out vec4 outColor;

int pick_texture (int index, sampler2D tex, int length) {
  // Get width and height of texture
  ivec2 tex_res = textureSize(tex,0);
  int filler = (tex_res.x * tex_res.y * 4) - length;
  index += filler;

  float w = float(tex_res.x);
  float h = float(tex_res.y);

  // Convert index into pixel space
  float i = float(index / 4);

  // Prevent index from looking outside of texture space
  // as textures wrap while buffers overflow
  if (index < filler || i > w * h) return 0;

  // Compute the pixel coordinates
  float r = i / w;
  float y = float(floor(r));
  float x = i - (y * w);

  // Convert pixel coordinates to texture float coordinates
  vec4 pixel = texture(tex, vec2((x + 0.5f) / w, (y + 0.5f) / h));

  // Convert pixel into byte
  int offset = index - (index / 4 * 4);
  if (offset == 0) { return int(pixel.x * 255.0); }
  if (offset == 1) { return int(pixel.y * 255.0); }
  if (offset == 2) { return int(pixel.z * 255.0); }
  if (offset == 3) { return int(pixel.a * 255.0); }
}

int length_texture(sampler2D tex) {
  ivec2 tex_res = textureSize(tex,0);
  return tex_res.x * tex_res.y;
}

void rreturn(int x, int y, int z, int w) {
  outColor = vec4(
    float(x & 255) / 255.0,
    float(y & 255) / 255.0,
    float(z & 255) / 255.0,
    float(w & 255) / 255.0
  );
}

int mul_x(sampler2D a, sampler2D b, int x) {
  int c_filler = (u_resolution.x * u_resolution.y * 4) - c_length;
  if(x < c_filler) return 0;

  int ret = 0;
  int src = x - c_filler - b_length;
  int i = b_length - 1;
  if (x < a_length) { // Skip some loop steps when possible
    src = (b_length - 1) - x;
    i = x;
  }
  int end = max(-1, src - 1);
  for (; i > -1; i--) {
    int c = src++;
    if (c <= -1) continue;
    if (c >= a_length) break;
    ret += ( pick_texture(c  ,a,a_length) * pick_texture(i,b,b_length))       & 255;
    ret += ((pick_texture(c+1,a,a_length) * pick_texture(i,b,b_length)) >> 8) & 255;
  }

  return ret;
}

// mul
void main() {
  ivec2 pos = ivec2(gl_FragCoord);
  int output_length = u_resolution.x * u_resolution.y * 4;
  int i = ((pos.y * u_resolution.x) + pos.x) * 4;

  if(output_length - i - 4 > c_length) {
    discard;
  }

  // TODO: fix carry logic
  int org = i + 4;
  int carry = 0;
  // int[16] carries;
  // int carry_offset = 4;
  // int carry_count = 0;
  // while(i + carry_offset < output_length && carry_offset < 16) {
    // if (
      // TODO: translate into glsl because of int and float mixing
      // (
      //   (org < c_length * 0.75 && i <= c_length * 0.75) ||
      //   (org >= c_length * 0.75)
      // ) &&
    // ) {
    // carries[carry_count] = mul_x(u_a,u_b,i+carry_offset++) << u_shift;
    // carry_count++;
    // }
  // }

  // for(;carry_count > -1; carry_count--) {
  //   carry += carries[carry_count];
  //   carry = carry >> 8;
  // }

  int c3 = (mul_x(u_a,u_b,i+3) << u_shift) + (carry);
  int c2 = (mul_x(u_a,u_b,i+2) << u_shift) + (c3 >> 8);
  int c1 = (mul_x(u_a,u_b,i+1) << u_shift) + (c2 >> 8);
  int c0 = (mul_x(u_a,u_b,i+0) << u_shift) + (c1 >> 8);

  rreturn(c0,c1,c2,c3);
}
`;

    const { gl } = this

    const vertexShader = this._createShader(gl.VERTEX_SHADER, vertexShaderSource)
    const fragmentShader = this._createShader(gl.FRAGMENT_SHADER, fragmentShaderSource)
    const program = this._createProgram(vertexShader, fragmentShader)

    program.params = {
      resolution: gl.getUniformLocation(program, "u_resolution"),
      a: gl.getUniformLocation(program, "u_a"),
      a_length: gl.getUniformLocation(program, "a_length"),
      b: gl.getUniformLocation(program, "u_b"),
      b_length: gl.getUniformLocation(program, "b_length"),
      c_length: gl.getUniformLocation(program, "c_length"),
      shift: gl.getUniformLocation(program, "u_shift"),
    }

    return super._mul = program
  }

  async sync() {
    const { gl } = this
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    return new Promise((resolve, reject) => {
      function check() {
        const status = gl.clientWaitSync(sync, 0, gl.getParameter(gl.MAX_CLIENT_WAIT_TIMEOUT_WEBGL));
        switch (status) {
          case gl.TIMEOUT_EXPIRED:
            return setTimeout(check, 1)
          case gl.WAIT_FAILED:
            return reject(new Error('Operation failed ...'))
          case gl.ALREADY_SIGNALED:
          case gl.CONDITION_SATISFIED:
            return resolve()
        }
      }
      setTimeout(check, 1)
    }).finally(() => {
      gl.deleteSync(sync)
    })
  }

  async fib(n) {
    const maxSize = Math.ceil(Math.max(n / 32 * 23, 1))
    let a = new gl_int(this.gl, 0, maxSize)
    let b = new gl_int(this.gl, 1, maxSize)
    let tmp0 = new gl_int(this.gl, 0, maxSize)
    let tmp1 = new gl_int(this.gl, 0, maxSize)
    let bit = 1
    let i = 1
    for (; bit < n; bit <<= 1) { };
    for (; bit; bit >>= 1) {
      const curMax = Math.min(maxSize, Math.max(Math.ceil((1 << i++) / 16), 1)) // Math.ceil(Math.max((1 << i++) / 32 * 23, 1))
      // console.log(curMax)
      a.size = b.size = tmp0.size = tmp1.size = curMax
      await this.mul(tmp0, a, b, 1)
      await this.pow2(tmp1, a)
      await this.add(a, tmp1, tmp0)
      await this.pow2(tmp0, b)
      await this.add(b, tmp1, tmp0)
      if (n & bit) {
        const tmp = a
        await this.add(tmp0, a, b)
        a = tmp0
        tmp0 = b
        b = tmp
      }
      await this.sync()
    }
    b.destroy()
    tmp0.destroy()
    tmp1.destroy()
    return a
  }

  async fib_add(n) {
    const maxSize = Math.ceil(Math.max(n / 32 * 23, 1))
    let a = new gl_int(this.gl, 0, maxSize)
    let b = new gl_int(this.gl, 1, maxSize)
    let tmp0 = new gl_int(this.gl, 0, maxSize)
    let i = 0
    for (let i = 0; i < n; i++) {
      const curSize = Math.ceil(Math.max(i / 32 * 23, 1))
      a.size = b.size = tmp0.size = curSize
      this.add(tmp0, a, b)
      const tmp1 = a
      a = b
      b = tmp0
      tmp0 = tmp1
      if (i % 128) await this.sync()
    }
    b.destroy()
    tmp0.destroy()
    return a
  }

  async stress_mul() {
    const maxSize = 1 * 1024 * 1024
    let a = new gl_int(this.gl, 2, maxSize)
    let b = new gl_int(this.gl, 2, maxSize)
    let tmp0 = new gl_int(this.gl, 2, maxSize)
    let bitSize = 2n
    for (let i = 0; i < 1000; i++) {
      bitSize <<= 1n
      a.size = b.size = Number(bitSize / 8n) || 8

      this.mul(tmp0, a, b, 0)
      const tmp1 = a
      a = b
      b = tmp0
      tmp0 = tmp1
      await this.sync()
      console.log(`stress mul(${bitSize / 8n})`)
    }
    a.destroy()
    b.destroy()
    tmp0.destroy()
  }
}

async function init() {
  window.tracing = false

  // TODO: make the shaders work in nvidia gpu
  const inst = new gl()
  // const a = new gl_int(inst.gl, 2, 8) // TODO: 8 works, but 9 doesn't work
  // const b = new gl_int(inst.gl, 1, 8)
  // const c = new gl_int(inst.gl, 0, 16384 * 8)
  // inst.add(c, a, b, 0)
  // return
  let r, s

  await inst.stress_mul()

  return

  let pass = 0
  let fail = 0
  let highestPass = 0
  // TODO: figure out why fib(48) is missing an 1 at the start of the number
  for (let i = 1; i < 1000000000; i *= 2) {
    s = performance.now()
    r = await inst.fib(i)
    const fib_gl = performance.now() - s
    s = performance.now()
    const result = r.read()
    const read_gl = performance.now() - s
    s = performance.now()
    const expected = fib_BigInt(i)
    const fib_big = performance.now() - s
    console.log(`fib(${i})`, 'gl:', fib_gl, 'BigInt:', fib_big, 'read:', read_gl)
    if (result === expected) {
      console.log('pass', i)
      highestPass = i
      pass++
    } else {
      console.log('fail', i)
      fail++
      break
    }
    r.destroy()

    // Do a quick detach from the event loop for refresh to work
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  console.log('pass', pass, 'fail', fail)

  // TODO: figure out why fib(>190) returns 0
  // for (let i = 180; i < 200; i++) {
  //   const r = inst.fib(i)
  //   const result = r.read()
  //   console.log(`fib(${i})`, result)
  //   r.destroy()
  // }


  debugger
}

function trace(cb, name) {
  if (window.tracing) cb()
  // else console.log(name)
}