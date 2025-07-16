let scene, camera, renderer, composer;
let model, controls;
let asciiPass;
let autoRotate = true;

// ASCII characters from dark to light
const asciiChars = ' .:-=+*#%@';

// Initialize Three.js scene
function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    // Camera setup
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 0, 5);

    // Renderer setup
    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('canvas'), antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

    // Controls - check if OrbitControls is available
    if (typeof THREE.OrbitControls !== 'undefined') {
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
    } else {
        console.warn('OrbitControls not loaded, using fallback controls');
        // Simple fallback mouse controls
        let mouseX = 0, mouseY = 0;
        renderer.domElement.addEventListener('mousemove', (e) => {
            if (e.buttons === 1) {
                mouseX = (e.clientX / window.innerWidth) * 2 - 1;
                mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
                camera.position.x = mouseX * 5;
                camera.position.y = mouseY * 5;
                camera.lookAt(0, 0, 0);
            }
        });
    }

    // Create ASCII post-processing effect
    createAsciiEffect();

    // Add default geometry
    addDefaultGeometry();

    // Event listeners
    setupEventListeners();

    // Start animation loop
    animate();
}

// Create ASCII shader effect
function createAsciiEffect() {
    // ASCII vertex shader
    const vertexShader = `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `;

    // ASCII fragment shader
    const fragmentShader = `
        uniform sampler2D tDiffuse;
        uniform vec2 resolution;
        uniform float charSize;
        uniform float brightness;
        uniform float contrast;
        varying vec2 vUv;

        float gray(vec3 color) {
            return dot(color, vec3(0.299, 0.587, 0.114));
        }

        void main() {
            vec2 cellSize = vec2(charSize) / resolution;
            vec2 cellPos = floor(vUv / cellSize);
            vec2 cellUv = cellPos * cellSize + cellSize * 0.5;
            
            vec3 color = texture2D(tDiffuse, cellUv).rgb;
            float grayValue = gray(color);
            
            // Apply brightness and contrast
            grayValue = (grayValue - 0.5) * contrast + 0.5;
            grayValue = grayValue * brightness;
            grayValue = clamp(grayValue, 0.0, 1.0);
            
            // Map to ASCII character
            float charIndex = grayValue * 9.0;
            
            // Simple ASCII visualization
            vec2 inCellUv = mod(vUv * resolution / charSize, 1.0);
            float pattern = 1.0;
            
            // Create simple patterns for different brightness levels
            if (charIndex < 1.0) {
                pattern = 0.0; // Space
            } else if (charIndex < 2.0) {
                pattern = step(0.5, length(inCellUv - 0.5)) * 0.3; // Dot
            } else if (charIndex < 4.0) {
                pattern = step(0.45, abs(inCellUv.x - 0.5)) * 0.5; // Colon/dash
            } else if (charIndex < 6.0) {
                pattern = step(0.3, max(abs(inCellUv.x - 0.5), abs(inCellUv.y - 0.5))) * 0.7; // Plus
            } else if (charIndex < 8.0) {
                pattern = step(0.2, max(abs(inCellUv.x - 0.5), abs(inCellUv.y - 0.5))) * 0.85; // Hash
            } else {
                pattern = 1.0; // Full
            }
            
            vec3 finalColor = vec3(0.0, pattern, 0.0);
            gl_FragColor = vec4(finalColor, 1.0);
        }
    `;

    // Create custom pass
    asciiPass = {
        uniforms: {
            tDiffuse: { value: null },
            resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
            charSize: { value: 8.0 },
            brightness: { value: 1.0 },
            contrast: { value: 1.0 }
        },
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        material: null,
        fsQuad: null,
        render: function(renderer, writeBuffer, readBuffer) {
            if (!this.material) {
                this.material = new THREE.ShaderMaterial({
                    uniforms: this.uniforms,
                    vertexShader: this.vertexShader,
                    fragmentShader: this.fragmentShader
                });
                
                const geometry = new THREE.PlaneGeometry(2, 2);
                this.fsQuad = new THREE.Mesh(geometry, this.material);
                this.scene = new THREE.Scene();
                this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
                this.scene.add(this.fsQuad);
            }

            this.uniforms.tDiffuse.value = readBuffer.texture;
            
            if (writeBuffer) {
                renderer.setRenderTarget(writeBuffer);
                renderer.clear();
                renderer.render(this.scene, this.camera);
            } else {
                renderer.setRenderTarget(null);
                renderer.render(this.scene, this.camera);
            }
        }
    };
}

// Add default geometry
function addDefaultGeometry() {
    const geometry = new THREE.TorusKnotGeometry(1, 0.3, 100, 16);
    const material = new THREE.MeshPhongMaterial({ 
        color: 0xffffff,
        shininess: 100
    });
    model = new THREE.Mesh(geometry, material);
    scene.add(model);
}

// Setup event listeners
function setupEventListeners() {
    // File input
    document.getElementById('file-input').addEventListener('change', handleFileUpload);

    // Controls
    document.getElementById('char-size').addEventListener('input', (e) => {
        asciiPass.uniforms.charSize.value = parseFloat(e.target.value);
        document.getElementById('char-size-value').textContent = e.target.value;
    });

    document.getElementById('brightness').addEventListener('input', (e) => {
        asciiPass.uniforms.brightness.value = parseFloat(e.target.value);
        document.getElementById('brightness-value').textContent = e.target.value;
    });

    document.getElementById('contrast').addEventListener('input', (e) => {
        asciiPass.uniforms.contrast.value = parseFloat(e.target.value);
        document.getElementById('contrast-value').textContent = e.target.value;
    });

    document.getElementById('auto-rotate').addEventListener('change', (e) => {
        autoRotate = e.target.checked;
    });

    // Window resize
    window.addEventListener('resize', onWindowResize);
}

// Handle file upload
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    const reader = new FileReader();
    
    document.getElementById('loading').style.display = 'block';

    reader.onload = function(e) {
        const contents = e.target.result;
        console.log('File loaded, size:', contents.byteLength || contents.length);
        
        // Remove existing model
        if (model) {
            scene.remove(model);
            // Don't dispose default geometry
            if (model.geometry && !model.geometry.isTorusKnotGeometry) {
                model.geometry.dispose();
            }
            if (model.material) {
                if (Array.isArray(model.material)) {
                    model.material.forEach(m => m.dispose());
                } else if (!model.material.isMeshPhongMaterial) {
                    model.material.dispose();
                }
            }
        }

        // Load based on file type
        if (fileName.endsWith('.gltf') || fileName.endsWith('.glb')) {
            console.log('Loading GLTF/GLB file...');
            const loader = new THREE.GLTFLoader();
            loader.parse(contents, '', (gltf) => {
                console.log('GLTF loaded successfully:', gltf);
                model = gltf.scene;
                scene.add(model);
                centerModel();
                document.getElementById('loading').style.display = 'none';
            }, (error) => {
                console.error('Error loading GLTF:', error);
                document.getElementById('loading').style.display = 'none';
                alert('Error loading file: ' + error.message);
            });
        } else if (fileName.endsWith('.obj')) {
            const loader = new THREE.OBJLoader();
            try {
                const obj = loader.parse(contents);
                model = obj;
                scene.add(model);
                
                // Add material to OBJ
                model.traverse((child) => {
                    if (child.isMesh) {
                        child.material = new THREE.MeshPhongMaterial({ 
                            color: 0xffffff,
                            shininess: 100
                        });
                    }
                });
                
                centerModel();
                document.getElementById('loading').style.display = 'none';
            } catch (error) {
                console.error('Error loading OBJ:', error);
                document.getElementById('loading').style.display = 'none';
                alert('Error loading file: ' + error.message);
            }
        }
    };

    if (fileName.endsWith('.glb') || fileName.endsWith('.gltf')) {
        reader.readAsArrayBuffer(file);
    } else if (fileName.endsWith('.obj')) {
        reader.readAsText(file);
    }
}

// Center and scale model
function centerModel() {
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 2.5 / maxDim;
    
    model.scale.setScalar(scale);
    model.position.sub(center.multiplyScalar(scale));
    
    // Adjust camera
    camera.position.set(0, 0, 5);
    if (controls && controls.target) {
        controls.target.set(0, 0, 0);
        controls.update();
    }
}

// Window resize handler
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    asciiPass.uniforms.resolution.value.set(window.innerWidth, window.innerHeight);
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    if (controls && controls.update) {
        controls.update();
    }
    
    // Auto rotation
    if (autoRotate && model) {
        model.rotation.y += 0.01;
    }
    
    // Render scene to render target
    const renderTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight);
    renderer.setRenderTarget(renderTarget);
    renderer.render(scene, camera);
    
    // Apply ASCII effect
    renderer.setRenderTarget(null);
    asciiPass.render(renderer, null, renderTarget);
    
    renderTarget.dispose();
}

// Initialize on load
window.addEventListener('DOMContentLoaded', init);