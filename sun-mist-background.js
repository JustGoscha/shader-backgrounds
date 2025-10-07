/**
 * Sun & Mist Shader Background
 * Creates an animated shader background with sun and cloud effects
 */

export function createSunMistBackground(elementOrSelector, config = {}) {
    const { THREE } = config;
    
    if (!THREE) {
        throw new Error('THREE.js library is required. Pass it via config: { THREE }');
    }

    // Get the target element
    let element;
    if (typeof elementOrSelector === 'string') {
        element = document.querySelector(elementOrSelector);
        if (!element) {
            throw new Error(`Element not found: ${elementOrSelector}`);
        }
    } else if (elementOrSelector instanceof HTMLElement) {
        element = elementOrSelector;
    } else {
        throw new Error('First argument must be a DOM element or CSS selector string');
    }

    // Scene setup
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    
    // Get element dimensions
    const rect = element.getBoundingClientRect();
    const width = rect.width || element.clientWidth;
    const height = rect.height || element.clientHeight;
    
    renderer.setSize(width, height);
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.zIndex = '-1';
    
    element.appendChild(renderer.domElement);

    // Mouse tracking relative to element
    let mouseX = 0.5;
    let mouseY = 0.5;
    let targetMouseX = 0.5;
    let targetMouseY = 0.5;

    // Mouse move handler
    const handleMouseMove = (event) => {
        const rect = element.getBoundingClientRect();
        targetMouseX = (event.clientX - rect.left) / rect.width;
        targetMouseY = 1.0 - ((event.clientY - rect.top) / rect.height);
    };
    
    document.addEventListener('mousemove', handleMouseMove);

    // Shader material
    const material = new THREE.ShaderMaterial({
        uniforms: {
            iTime: { value: 0 },
            iResolution: { value: new THREE.Vector2(width, height) },
            iMouse: { value: new THREE.Vector2(mouseX, mouseY) }
        },
        vertexShader: `
            void main() {
                gl_Position = vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            precision highp float;
            uniform vec2 iResolution;
            uniform float iTime;
            uniform vec2 iMouse;

            // Hash function for noise - returns different random values for different p vectors
            float hash(vec3 p) {
                p = fract(p * 0.1031);
                p += dot(p, p.yzx + 19.19);
                return fract((p.x + p.y) * p.z);
            }

            // 3D noise function
            float noise(vec3 p) {
                vec3 i = floor(p);
                vec3 f = fract(p);
                f = f * f * (3.0 - 2.0 * f);

                return mix(
                    mix(
                        mix(hash(i + vec3(0.0, 0.0, 0.0)), hash(i + vec3(1.0, 0.0, 0.0)), f.x),
                        mix(hash(i + vec3(0.0, 1.0, 0.0)), hash(i + vec3(1.0, 1.0, 0.0)), f.x),
                        f.y
                    ),
                    mix(
                        mix(hash(i + vec3(0.0, 0.0, 1.0)), hash(i + vec3(1.0, 0.0, 1.0)), f.x),
                        mix(hash(i + vec3(0.0, 1.0, 1.0)), hash(i + vec3(1.0, 1.0, 1.0)), f.x),
                        f.y
                    ),
                    f.z
                );
            }

            // Fractal Brownian Motion for detailed clouds
            float fbm(vec3 p, float amplitudeChange, float frequencyChange) {
                float value = 0.0;
                float amplitude = 0.5;
                float frequency = 1.0;
                for(int i = 0; i < 6; i++) {
                    value += amplitude * noise(p * frequency);
                    amplitude *= amplitudeChange;
                    frequency *= frequencyChange;
                }
                return value;
            }

            void main() {
                vec2 uv = gl_FragCoord.xy / iResolution.xy;
                // Maintain aspect ratio for proper circular shapes
                float aspectRatio = iResolution.x / iResolution.y;
                uv = (uv - 0.5) * vec2(max(aspectRatio, 1.0), max(1.0/aspectRatio, 1.0)) + 0.5;

                // Mouse-influenced center position with slight following
                vec2 center = vec2(0.5, 0.45);
                vec2 mouseInfluence = (iMouse - 0.5) * 0.15; // Scale mouse influence
                center += mouseInfluence;

                // Background color - dark blue
                vec3 bgColor = vec3(0.03, 0.12, 0.18);
                
                // Sun setup (calculate on original UV)
                vec2 sunUV = uv - center;
                float dist = length(sunUV);
                float sunRadius = 0.10;
                float angle = atan(sunUV.y, sunUV.x);
                
                // Emanating waves from behind the sun - create displacement field
                float waveSpeed = 0.06;
                float maxWaveRadius = 0.6;
                
                // Create multiple wave rings with displacement vectors
                float waves = 0.0;
                vec2 displacement = vec2(0.0);
                
                for(int i = 0; i < 5; i++) {
                    float offset = float(i) * 1.39723;
                    float expandingRadius = mod(iTime * waveSpeed + offset, maxWaveRadius);
                    
                    // Angular distortion for organic feel - use sin/cos to avoid seam at 0 degrees
                    float angleNoise = noise(vec3(sin(3.0 + angle * 3.0) +sin(angle * 2.0), cos(angle * 0.2), iTime * 0.1 + float(i) * 10.0)) * 0.06;
                    float distortedDist = dist + angleNoise;
                    
                    // Create ring pattern
                    float ring = abs(distortedDist - expandingRadius);
                    float waveThickness = 0.015 + 0.005 * sin(iTime * 2.0 + float(i));
                    float wave = smoothstep(waveThickness, 0.002, ring);
                    float displacementWidth = waveThickness * 2.0;
                    float displacementEnvelope = 1.0 - smoothstep(0.0, displacementWidth, ring);
                    
                    // Fade out as wave expands
                    float fadeFactor = 1.0 - (expandingRadius / maxWaveRadius);
                    fadeFactor = pow(fadeFactor, 1.5);
                    
                    // Additional radial noise modulation
                    float radialNoise = fbm(vec3(sunUV * 5.0, iTime * 0.2 + float(i)), 0.5, 2.0);
                    wave *= radialNoise * 0.5 + 0.5;
                    
                    waves += wave * fadeFactor;
                    
                    // Calculate displacement - radial outward from sun center
                    // Stronger displacement towards edges
                    float edgeFalloff = 0.5 + dist * 2.5;
                    float displacementStrength = displacementEnvelope * fadeFactor * 0.041 * edgeFalloff;
                    vec2 directionFromSun = normalize(sunUV + vec2(0.0001)); // Prevent division by zero
                    displacement += directionFromSun * displacementStrength;
                    
                    // Add tangential/rotational component for water-like swirl
                    vec2 tangent = vec2(-directionFromSun.y, directionFromSun.x);
                    float swirl = sin(expandingRadius * 20.0 + angle * 3.0 + iTime * 2.0) * 0.3;
                    displacement += tangent * displacementStrength * swirl;
                }
                
                // Apply displacement to UV for sampling clouds
                vec2 distortedUV = uv + displacement;
                
                // Clamp and adjust wave intensity for visual effect
                waves = clamp(waves * 0.4, 0.0, 0.2);
                
                // Wave colors - warm orange/red glow
                vec3 waveColor1 = vec3(0.95, 0.35, 0.15);
                vec3 waveColor2 = vec3(0.98, 0.55, 0.25);
                vec3 finalWaveColor = mix(waveColor1, waveColor2, waves);
                
                // Simple sun circle (use original UV, not distorted)
                float sunGlow = smoothstep(sunRadius + 0.002, sunRadius - 0.002, dist);
                vec3 sunColor = vec3(0.95, 0.35, 0.15);
                
                // Background clouds (behind sun) - use distorted UV for water effect
                float bgMoveSpeed = 0.015;
                vec2 bgUV = distortedUV * 4.0;
                bgUV.x += iTime * bgMoveSpeed;

                // Add mouse-influenced movement to background clouds
                vec2 mouseFlow = (iMouse - 0.5) * 0.5;
                bgUV += mouseFlow * 0.3;

                // Each background layer moves at slightly different speeds and heights
                vec2 bgUV1 = bgUV;
                bgUV1.x += iTime * 0.008; // Slower additional movement
                bgUV1.y -= 0.4; // Highest layer

                vec2 bgUV2 = bgUV * 1.5;
                bgUV2.x += iTime * 0.012; // Medium additional movement
                bgUV2.y -= 0.2; // Middle-high layer

                float bgCloud1 = fbm(vec3(bgUV1 + vec2(iTime * 0.012, iTime * -0.0011), iTime * 0.01) + vec3(0.0, 0.0, 100.0), 0.59, 2.5);
                float bgCloud2 = fbm(vec3(bgUV2 + vec2(iTime * 0.0225, iTime * -0.014), iTime * 0.025) + vec3(0.0, 0.0, 200.0), 0.55, 2.3);
                // Process background cloud layers separately (use distorted UV)
                float bgCloud1Processed = bgCloud1;
                bgCloud1Processed *= pow(1.6 - distortedUV.y, 2.8);
                bgCloud1Processed = smoothstep(0.689, 0.69, bgCloud1Processed);

                float bgCloud2Processed = bgCloud2;
                bgCloud2Processed *= pow(1.55 - distortedUV.y, 2.3);
                bgCloud2Processed = smoothstep(0.75, 0.78, bgCloud2Processed);

                // Foreground clouds (in front of sun) - use distorted UV for water effect
                float fgMoveSpeed = 0.06;
                vec2 fgUV = distortedUV * 5.5;
                fgUV.x += iTime * fgMoveSpeed;

                // Add mouse-influenced movement to foreground clouds (stronger effect)
                vec2 fgMouseFlow = (iMouse - 0.5) * 0.8;
                fgUV += fgMouseFlow * 0.5;

                // Each foreground layer moves at different speeds and heights
                vec2 fgUV1 = fgUV;
                fgUV1.x += iTime * 0.05; // Slower additional movement
                fgUV1.y -= 100.00; // Middle layer

                vec2 fgUV2 = fgUV * 1.3;
                fgUV2.x += iTime * 0.035; // Medium additional movement
                fgUV2.y += 100.0; // Base level (no offset)

                vec2 fgUV3 = fgUV * 0.7;
                fgUV3.x += iTime * 0.1; // Faster additional movement
                fgUV3.y += 200.1; // Lower layer

                float fgCloud1 = fbm(vec3(fgUV1 + vec2(iTime * 0.0020, iTime * -0.013), iTime * 0.028) + vec3(0.0, 0.0, 300.0), 0.48, 2.3);
                float fgCloud2 = fbm(vec3(fgUV2 + vec2(iTime * 0.0025, iTime * -0.015), iTime * 0.042) + vec3(0.0, 0.0, 400.0), 0.49, 2.2);
                float fgCloud3 = fbm(vec3(fgUV3 + vec2(iTime * 0.0035, iTime * -0.032), iTime * 0.03) + vec3(0.0, 0.0, 500.0), 0.55, 2.8);

                // Process foreground cloud layers separately (use distorted UV)
                float fgCloud1Processed = fgCloud1;
                fgCloud1Processed *= pow(1.14 - distortedUV.y, 1.5);
                fgCloud1Processed = smoothstep(0.4, 0.55, fgCloud1Processed);

                float fgCloud2Processed = fgCloud2;
                fgCloud2Processed *= pow(1.12 - distortedUV.y, 1.3);
                fgCloud2Processed = smoothstep(0.35, 0.45, fgCloud2Processed);

                float fgCloud3Processed = fgCloud3;
                fgCloud3Processed *= pow(1.14 - distortedUV.y, 1.4);
                fgCloud3Processed = smoothstep(0.50, 0.65, fgCloud3Processed);

                // Compose final color with distinct colors for each layer
                vec3 color = bgColor;

                // Add background cloud layers with distinct colors
                vec3 bgColor1 = vec3(0.03098, 0.16176, 0.22804); // Red
                vec3 bgColor2 = vec3(0.04618, 0.19276, 0.26804); // Green
                color = mix(color, bgColor1, bgCloud1Processed * 1.0);
                color = mix(color, bgColor2, bgCloud2Processed * 1.0);

                // Add emanating waves (behind sun)
                color = mix(color, finalWaveColor, waves);

                // Add sun (sharp, no glow unless obscured)
                color = mix(color, sunColor, sunGlow);

                // Add foreground cloud layers with distinct colors
                vec3 fgColor1 = vec3(0.05098, 0.21176, 0.29804); // Blue
                vec3 fgColor2 = vec3(0.07098, 0.24176, 0.34804); 
                vec3 fgColor3 = vec3(0.13098, 0.33176, 0.41804); // #0D364C

                // Depth-based opacity: closer clouds more opaque
                color = mix(color, fgColor1, fgCloud1Processed * 0.7); // back layer
                color = mix(color, fgColor2, fgCloud2Processed * 0.7); // middle layer
                color = mix(color, fgColor3, fgCloud3Processed * 0.7); // front layer
                
                // Film grain overlay
                vec2 grainUV = gl_FragCoord.xy / iResolution.xy;
                float grain = hash(vec3(grainUV * 1000.0, floor(iTime * 24.0))) * 2.0 - 1.0;
                grain *= 0.025; // Grain intensity
                color += grain;
                
                gl_FragColor = vec4(color, 1.0);
            }
        `
    });

    // Create plane geometry
    const geometry = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    // Animation state
    let animationId = null;
    let isRunning = true;

    // Animation loop
    function animate() {
        if (!isRunning) return;
        animationId = requestAnimationFrame(animate);

        // Smooth mouse interpolation for fluid movement
        mouseX += (targetMouseX - mouseX) * 0.01;
        mouseY += (targetMouseY - mouseY) * 0.01;

        material.uniforms.iTime.value = performance.now() / 1000;
        material.uniforms.iMouse.value.set(mouseX, mouseY);
        renderer.render(scene, camera);
    }

    // Handle window resize
    const handleResize = () => {
        const rect = element.getBoundingClientRect();
        const width = rect.width || element.clientWidth;
        const height = rect.height || element.clientHeight;
        
        renderer.setSize(width, height);
        material.uniforms.iResolution.value.set(width, height);
    };
    
    window.addEventListener('resize', handleResize);

    // Start animation
    animate();

    // Return API for control
    return {
        start: () => {
            if (!isRunning) {
                isRunning = true;
                animate();
            }
        },
        stop: () => {
            isRunning = false;
            if (animationId) {
                cancelAnimationFrame(animationId);
                animationId = null;
            }
        },
        destroy: () => {
            isRunning = false;
            if (animationId) {
                cancelAnimationFrame(animationId);
            }
            window.removeEventListener('resize', handleResize);
            document.removeEventListener('mousemove', handleMouseMove);
            if (renderer.domElement.parentElement) {
                renderer.domElement.parentElement.removeChild(renderer.domElement);
            }
            geometry.dispose();
            material.dispose();
            renderer.dispose();
        },
        element: element,
        renderer: renderer,
        scene: scene,
        camera: camera
    };
}

