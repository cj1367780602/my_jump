// Game state
let scene, camera, renderer;
let player, currentPlatform, nextPlatform;
let score = 0;
let isCharging = false;
let chargeStartTime = 0;
let isGameOver = false;
let isJumping = false;

const PLATFORM_SIZE = 2;
const PLAYER_SIZE = 0.5;
const MAX_CHARGE_TIME = 2000;
const CHARGE_POWER = 10;

// Manual camera orbit state (replaces OrbitControls)
const orbit = {
    theta: Math.PI / 4,
    phi: Math.PI / 3.5,
    radius: 12,
    target: new THREE.Vector3(0, 0, 0),
    isDragging: false,
    lastX: 0,
    lastY: 0,
};

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xd0d0d0);

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    createInitialState();
    applyCameraOrbit();

    // Left click: charge jump
    renderer.domElement.addEventListener('mousedown', (e) => {
        if (e.button === 0) startCharge();
    });
    renderer.domElement.addEventListener('mouseup', (e) => {
        if (e.button === 0) endCharge();
    });

    // Right click: rotate camera
    renderer.domElement.addEventListener('mousedown', (e) => {
        if (e.button === 2) {
            orbit.isDragging = true;
            orbit.lastX = e.clientX;
            orbit.lastY = e.clientY;
        }
    });
    renderer.domElement.addEventListener('mousemove', (e) => {
        if (!orbit.isDragging) return;
        const dx = e.clientX - orbit.lastX;
        const dy = e.clientY - orbit.lastY;
        orbit.theta -= dx * 0.008;
        orbit.phi = Math.max(0.15, Math.min(Math.PI / 2.2, orbit.phi - dy * 0.008));
        orbit.lastX = e.clientX;
        orbit.lastY = e.clientY;
        applyCameraOrbit();
    });
    renderer.domElement.addEventListener('mouseup', (e) => {
        if (e.button === 2) orbit.isDragging = false;
    });
    renderer.domElement.addEventListener('mouseleave', () => {
        orbit.isDragging = false;
    });

    // Scroll: zoom
    renderer.domElement.addEventListener('wheel', (e) => {
        orbit.radius = Math.max(5, Math.min(25, orbit.radius + e.deltaY * 0.02));
        applyCameraOrbit();
    });

    renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

    // Touch: charge jump
    renderer.domElement.addEventListener('touchstart', (e) => {
        e.preventDefault();
        startCharge();
    }, { passive: false });
    renderer.domElement.addEventListener('touchend', (e) => {
        e.preventDefault();
        endCharge();
    }, { passive: false });

    window.addEventListener('resize', onWindowResize);

    animate();
}

function applyCameraOrbit() {
    const x = orbit.target.x + orbit.radius * Math.sin(orbit.phi) * Math.sin(orbit.theta);
    const y = orbit.target.y + orbit.radius * Math.cos(orbit.phi);
    const z = orbit.target.z + orbit.radius * Math.sin(orbit.phi) * Math.cos(orbit.theta);
    camera.position.set(x, y, z);
    camera.lookAt(orbit.target);
}

function createInitialState() {
    while (scene.children.length > 0) {
        scene.remove(scene.children[0]);
    }

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    score = 0;
    isGameOver = false;
    isJumping = false;
    isCharging = false;
    document.getElementById('score').innerText = `Score: ${score}`;
    document.getElementById('game-over').style.display = 'none';

    currentPlatform = createPlatform(0, 0);
    player = createPlayer();
    player.position.y = PLATFORM_SIZE / 2 + PLAYER_SIZE / 2;

    spawnNextPlatform();

    orbit.target.set(0, 0, 0);
    applyCameraOrbit();
}

function createPlatform(x, z) {
    const geo = new THREE.BoxGeometry(PLATFORM_SIZE, PLATFORM_SIZE, PLATFORM_SIZE);
    const mat = new THREE.MeshPhongMaterial({ color: 0x888888 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, 0, z);
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
}

function createPlayer() {
    const geo = new THREE.BoxGeometry(PLAYER_SIZE, PLAYER_SIZE, PLAYER_SIZE);
    const mat = new THREE.MeshPhongMaterial({ color: 0xff4444 });
    const mesh = new THREE.Mesh(geo, mat);
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
    nextPlatform.material.color.setHex(0x4488ff + Math.floor(Math.random() * 0x8888));
}

function startCharge() {
    if (isGameOver || isCharging || isJumping) return;
    isCharging = true;
    chargeStartTime = Date.now();
    player.scale.y = 0.5;
    player.position.y = PLATFORM_SIZE / 2 + (PLAYER_SIZE * 0.5) / 2;
}

function endCharge() {
    if (!isCharging) return;
    isCharging = false;
    isJumping = true;

    const chargeDuration = Math.min(Date.now() - chargeStartTime, MAX_CHARGE_TIME);
    const power = (chargeDuration / MAX_CHARGE_TIME) * CHARGE_POWER;

    player.scale.y = 1;
    player.position.y = PLATFORM_SIZE / 2 + PLAYER_SIZE / 2;

    jump(power);
}

function jump(power) {
    const direction = Math.abs(nextPlatform.position.x - currentPlatform.position.x) >
                      Math.abs(nextPlatform.position.z - currentPlatform.position.z) ? 'x' : 'z';
    const startPos = player.position.clone();
    const targetPos = player.position.clone();
    const jumpDir = (nextPlatform.position[direction] - currentPlatform.position[direction]) > 0 ? 1 : -1;
    targetPos[direction] += power * jumpDir;

    const duration = 500;
    const startTime = Date.now();

    function animateJump() {
        const elapsed = Date.now() - startTime;
        const t = Math.min(elapsed / duration, 1);

        player.position[direction] = startPos[direction] + (targetPos[direction] - startPos[direction]) * t;
        player.position.y = startPos.y + Math.sin(t * Math.PI) * 2.5;

        updateCameraTarget();

        if (t < 1) {
            requestAnimationFrame(animateJump);
        } else {
            checkLanding();
        }
    }

    animateJump();
}

function checkLanding() {
    const dx = Math.abs(player.position.x - nextPlatform.position.x);
    const dz = Math.abs(player.position.z - nextPlatform.position.z);
    const onPlatform = dx < PLATFORM_SIZE / 2 && dz < PLATFORM_SIZE / 2;

    if (onPlatform) {
        score++;
        const distToCenter = Math.sqrt(dx * dx + dz * dz);
        if (distToCenter < 0.3) {
            score++;
            document.getElementById('score').innerText = `Score: ${score}  ✨ Perfect!`;
        } else {
            document.getElementById('score').innerText = `Score: ${score}`;
        }

        currentPlatform = nextPlatform;
        spawnNextPlatform();
        isJumping = false;
    } else {
        gameOver();
    }
}

function gameOver() {
    isGameOver = true;
    isJumping = false;
    document.getElementById('final-score').innerText = `Your score: ${score}`;
    document.getElementById('game-over').style.display = 'block';

    const startY = player.position.y;
    const startTime = Date.now();
    function animateFall() {
        const t = Math.min((Date.now() - startTime) / 600, 1);
        player.position.y = startY - t * 6;
        if (t < 1) requestAnimationFrame(animateFall);
    }
    animateFall();
}

function resetGame() {
    createInitialState();
}

function updateCameraTarget() {
    orbit.target.lerp(player.position, 0.1);
    applyCameraOrbit();
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}

init();
