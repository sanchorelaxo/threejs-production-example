/**
 * Vitest setup — polyfill WebGL2 for Node.js / jsdom testing
 *
 * jsdom does NOT implement HTMLCanvasElement.getContext('webgl').
 * Three.js r184 requires a working WebGL2 context for renderer init.
 *
 * Actual WebGL constant values (decimal):
 *   VERSION              = 0x1F02 = 7938
 *   RENDERER             = 0x1F01 = 7937
 *   VENDOR               = 0x1F00 = 7936
 *   MAX_TEXTURE_SIZE     = 0x0D34 = 3379
 *   MAX_TEXTURE_IMAGE_UNITS = 0x8873 = 34931
 *   MAX_CUBE_MAP_TEXTURE_SIZE = 0x851C = 34076
 *   MAX_VERTEX_ATTRIBS  = 0x8869 = 34953
 *   FRAGMENT_SHADER_DERIVATIVE_HINT = 0x8B8C = 35724
 *   CONTEXT_LOST_WEBGL  = 0x9242 = 37442
 */

if (typeof HTMLCanvasElement !== 'undefined') {
    HTMLCanvasElement.prototype.getContext = function (type) {
        if (type === 'webgl2' || type === 'webgl' || type === 'experimental-webgl') {
            const mockGL = {
                canvas: this,

                // ── Extensions & basic info ─────────────────────────────
                getExtension: () => null,
                getParameter: (p) => {
                    switch (p) {
                        case 7938:  return 'WebGL 2.0 (Apple M2)'; // VERSION
                        case 7937:  return 'Mozilla';               // RENDERER
                        case 7936:  return 'Google Inc.';            // VENDOR
                        case 3379:  return 4096;                     // MAX_TEXTURE_SIZE
                        case 34931: return 8;                       // MAX_TEXTURE_IMAGE_UNITS
                        case 34076: return 2048;                    // MAX_CUBE_MAP_TEXTURE_SIZE
                        case 34953: return 8;                       // MAX_VERTEX_ATTRIBS
                        case 35724: return 0;                        // FRAGMENT_SHADER_DERIVATIVE_HINT
                        case 37442: return false;                    // CONTEXT_LOST_WEBGL
                        default:    return 0;
                    }
                },

                getShaderPrecisionFormat: () => ({
                    rangeMin: 1, rangeMax: 1, precision: 1,
                }),

                // ── Shader ──────────────────────────────────────────────
                createShader: () => ({ type: 0, source: '', deleteShader: () => {} }),
                shaderSource: () => {},
                compileShader: () => {},
                getShaderInfoLog: () => '',
                getShaderParameter: () => 0,
                createShaderType: () => 35633,

                // ── Program ─────────────────────────────────────────────
                createProgram: () => ({
                    attachShader: () => {},
                    linkProgram: () => {},
                    getProgramParameter: () => 0,
                    getActiveAttrib: () => ({ name: '' }),
                    getActiveUniform: () => ({ name: '' }),
                    bindAttribLocation: () => {},
                    deleteProgram: () => {},
                }),
                attachShader: () => {},
                linkProgram: () => {},
                useProgram: () => {},
                getAttribLocation: () => 0,
                getUniformLocation: () => ({}),
                getProgramInfoLog: () => '',

                // ── Uniforms ────────────────────────────────────────────
                uniform1f: () => {},
                uniform1i: () => {},
                uniform3f: () => {},
                uniformMatrix4fv: () => {},

                // ── Buffers ─────────────────────────────────────────────
                ARRAY_BUFFER: 34962,
                ELEMENT_ARRAY_BUFFER: 34963,
                STATIC_DRAW: 35044,
                DYNAMIC_DRAW: 35048,
                createBuffer: () => ({}),
                bindBuffer: () => {},
                bufferData: () => {},
                deleteBuffer: () => {},

                // ── Vertex attribs ──────────────────────────────────────
                enableVertexAttribArray: () => {},
                vertexAttribPointer: () => {},

                // ── Drawing ─────────────────────────────────────────────
                drawElements: () => {},
                drawArrays: () => {},
                clear: () => {},
                clearColor: () => {},
                clearDepth: () => {},
                clearStencil: () => {},
                stencilMask: () => {},
                colorMask: () => {},
                depthMask: () => {},

                // ── Viewport / scissor ─────────────────────────────────
                viewport: () => {},
                scissor: () => {},
                getViewport: () => new Float32Array([0, 0, 1, 1]),
                getScissor: () => new Int32Array([0, 0, 1, 1]),

                // ── Enable / disable ───────────────────────────────────
                enable: () => {},
                disable: () => {},
                BLEND: 3042,
                DEPTH_TEST: 2929,
                CULL_FACE: 2884,
                POLYGON_OFFSET_FILL: 35723,

                // ── Blending ───────────────────────────────────────────
                SRC_ALPHA: 770,
                ONE_MINUS_SRC_ALPHA: 771,
                ONE: 1,
                ZERO: 0,

                // ── Depth / stencil ─────────────────────────────────────
                depthFunc: () => {},
                depthRange: () => {},
                stencilFunc: () => {},
                stencilOp: () => {},
                stencilMask: () => {},

                // ── Textures ────────────────────────────────────────────
                createTexture: () => ({}),
                bindTexture: () => {},
                texImage2D: () => {},
                texSubImage2D: () => {},
                copyTexImage2D: () => {},
                copyTexSubImage2D: () => {},
                texParameteri: () => {},
                texParameterf: () => {},
                generateMipmap: () => {},
                deleteTexture: () => {},
                isTexture: () => false,

                // ── Render targets ──────────────────────────────────────
                createFramebuffer: () => ({}),
                bindFramebuffer: () => {},
                deleteFramebuffer: () => {},
                framebufferTexture2D: () => {},
                checkFramebufferStatus: () => 36053,
                generateMipmap: () => {},

                // ── Queries ─────────────────────────────────────────────
                createQuery: () => ({}),
                beginQuery: () => {},
                endQuery: () => {},
                getQueryParameter: () => 0,
                getQuery: () => 0,

                // ── VAO ─────────────────────────────────────────────────
                createVertexArray: () => ({}),
                bindVertexArray: () => {},
                deleteVertexArray: () => {},

                // ── State ───────────────────────────────────────────────
                pixelStorei: () => {},
                getError: () => 0,
                isContextLost: () => false,
                isBuffer: () => false,
                isEnabled: () => false,
                isFramebuffer: () => false,
                isProgram: () => false,
                isQuery: () => false,
                isRenderbuffer: () => false,
                isShader: () => false,
                isTexture: () => false,
                isVertexArray: () => false,

                // ── Constants needed by Three.js ────────────────────────
                /* generic: */ UNSIGNED_BYTE: 5121,
                /* textures: */ RGBA: 6408, RGB: 6407, ALPHA: 6406,
                UNSIGNED_INT: 5125, FLOAT: 5126,
                NEAREST: 9728, LINEAR: 9729,
                REPEAT: 10497, CLAMP_TO_EDGE: 33071,
                TYPE: 0x8E37,
            };
            return mockGL;
        }
        return null;
    };
}
