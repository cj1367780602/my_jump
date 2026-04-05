// Game state
let scene, camera, renderer, controls;
let player, currentPlatform, nextPlatform;
let score = 0;
let isCharging = false;
let chargeStartTime = 0;
let isGameOver = false;
let isJumping = false; // Add this to prevent multiple jumps

const PLATFORM_SIZE = 2;
const PLAYER_SIZE = 0.5;
const GRAVITY = -9.8;
const MAX_CHARGE_TIME = 2000; // ms
const CHARGE_POWER = 10; // Max jump distance

function init() {
    // Scene setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xd0d0d0);

    // Camera setup
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(5, 5, 5);
    camera.lookAt(0, 0, 0);

    // Renderer setup
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    // OrbitControls for rotation
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 5;
    controls.maxDistance = 20;
    controls.maxPolarAngle = Math.PI / 2.5;
    controls.mouseButtons = {
        LEFT: null, // Disable left click rotation (reserved for charging)
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.ROTATE
    };

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    // Initial platforms and player
    createInitialState();

    // Event listeners
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('contextmenu', (e) => e.preventDefault()); // Prevent context menu on right click
    window.addEventListener('touchstart', (e) => { e.preventDefault(); startCharge(); });
    window.addEventListener('touchend', (e) => { e.preventDefault(); endCharge(); });
    window.addEventListener('resize', onWindowResize);

    animate();
}

function onMouseDown(e) {
    if (e.button === 0) { // Left click
        startCharge();
    }
}

function onMouseUp(e) {
    if (e.button === 0) { // Left click
        endCharge();
    }
}

function createInitialState() {
    // Clear scene if needed
    while(scene.children.length > 0){ 
        scene.remove(scene.children[0]); 
    }
    
    // Add lights back
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    score = 0;
    isGameOver = false;
    isJumping = false; // Reset jumping state
    document.getElementById('score').innerText = `Score: ${score}`;
    document.getElementById('game-over').style.display = 'none';

    // Current platform
    currentPlatform = createPlatform(0, 0);
    
    // Player
    player = createPlayer();
    player.position.y = PLATFORM_SIZE / 2 + PLAYER_SIZE / 2;

    // Next platform
    spawnNextPlatform();

    // Reset camera
    camera.position.set(5, 5, 5);
    camera.lookAt(player.position);
}

function createPlatform(x, z) {
    const geometry = new THREE.BoxGeometry(PLATFORM_SIZE, PLATFORM_SIZE, PLATFORM_SIZE);
    const material = new THREE.MeshPhongMaterial({ color: 0x888888 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, 0, z);
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
}

function createPlayer() {
    const geometry = new THREE.BoxGeometry(PLAYER_SIZE, PLAYER_SIZE, PLAYER_SIZE);
    const material = new THREE.MeshPhongMaterial({ color: 0xff0000 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    scene.add(mesh);
    return mesh;
}

function spawnNextPlatform() {
    const distance = 3 + Math.random() * 4;
    const direction = Math.random() > 0.5 ? 'x' : 'z';
    
    const x = currentPlatform.position.x + (direction === 'x' ? distance : 0);
    const z = currentPlatform.position.z + (direction === 'z' ? distance : 0);
    
    nextPlatform = createPlatform(x, z);
    nextPlatform.material.color.setHex(Math.random() * 0xffffff);
}

function startCharge() {
    if (isGameOver || isCharging || isJumping) return;
    isCharging = true;
    chargeStartTime = Date.now();
    
    // Visual feedback for charging (squash player)
    player.scale.y = 0.5;
    player.position.y = PLATFORM_SIZE / 2 + (PLAYER_SIZE * 0.5) / 2;
}

function endCharge() {
    if (!isCharging) return;
    isCharging = false;
    isJumping = true; // Set jumping state
    
    const chargeDuration = Math.min(Date.now() - chargeStartTime, MAX_CHARGE_TIME);
    const power = (chargeDuration / MAX_CHARGE_TIME) * CHARGE_POWER;
    
    // Reset player scale
    player.scale.y = 1;
    player.position.y = PLATFORM_SIZE / 2 + PLAYER_SIZE / 2;

    jump(power);
}

function jump(power) {
    const direction = nextPlatform.position.x !== currentPlatform.position.x ? 'x' : 'z';
    const startPos = player.position.clone();
    const targetPos = player.position.clone();
    targetPos[direction] += power;

    // Simple parabolic jump animation
    const duration = 500; // ms
    const startTime = Date.now();

    function animateJump() {
        const elapsed = Date.now() - startTime;
        const t = Math.min(elapsed / duration, 1);

        // Linear interpolation for X/Z
        player.position[direction] = startPos[direction] + (targetPos[direction] - startPos[direction]) * t;
        
        // Parabolic for Y
        const height = 2;
        player.position.y = startPos.y + Math.sin(t * Math.PI) * height;

        if (t < 1) {
            requestAnimationFrame(animateJump);
        } else {
            checkLanding();
        }
        
        updateCamera();
    }
    
    animateJump();
}

function checkLanding() {
    const dx = Math.abs(player.position.x - nextPlatform.position.x);
    const dz = Math.abs(player.position.z - nextPlatform.position.z);
    
    const onPlatform = dx < PLATFORM_SIZE / 2 && dz < PLATFORM_SIZE / 2;

    if (onPlatform) {
        // Success!
        score++;
        document.getElementById('score').innerText = `Score: ${score}`;
        
        // Bonus for center landing
        const distToCenter = Math.sqrt(dx*dx + dz*dz);
        if (distToCenter < 0.2) {
            console.log("Perfect!");
            score += 1; // Extra point
            document.getElementById('score').innerText = `Score: ${score} (Perfect!)`;
        }

        currentPlatform = nextPlatform;
        spawnNextPlatform();
        isJumping = false; // Reset jumping state
    } else {
        // Fail
        gameOver();
    }
}

function gameOver() {
    isGameOver = true;
    isJumping = false; // Reset jumping state
    document.getElementById('final-score').innerText = `Your score: ${score}`;
    document.getElementById('game-over').style.display = 'block';
    
    // Player falls
    const fallDuration = 500;
    const startTime = Date.now();
    const startY = player.position.y;
    
    function animateFall() {
        const elapsed = Date.now() - startTime;
        const t = Math.min(elapsed / fallDuration, 1);
        player.position.y = startY - t * 5;
        if (t < 1) requestAnimationFrame(animateFall);
    }
    animateFall();
}

function resetGame() {
    createInitialState();
}

function updateCamera() {
    if (isJumping || isGameOver) {
        const targetPos = new THREE.Vector3(
            player.position.x + 5,
            player.position.y + 5,
            player.position.z + 5
        );
        camera.position.lerp(targetPos, 0.1);
        camera.lookAt(player.position);
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    if (controls) controls.update();
    renderer.render(scene, camera);
}

init();
