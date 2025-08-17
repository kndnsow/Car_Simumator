const CONFIG = {
    gameSettings: {
        maxSpeed: 60, 
        acceleration: 0.4, 
        deceleration: 0.96,
        turnSpeed: 0.03, 
        cameraDistance: 20,
        cameraHeight: 10,
        roadWidth: 40, 
        roadSegmentLength: 50, 
        segmentsAhead: 12, 
        segmentsBehind: 5
    },
    carPhysics: {
        mass: 1000,
        dragCoefficient: 0.15,
        frictionCoefficient: 0.7,
        driftThreshold: 0.8,
        collisionSpeedThreshold: 50
    },
    obstacleSettings: {
        spawnChance: 0.2, 
        boxSizes: [1.5, 2, 2.5],
        sphereRadius: 1.8,
        maxObstaclesPerSegment: 2, 
        spawnDistance: 100 
    },
    upgradeSettings: {
        spawnChance: 0.05, 
        maxSpeedBoost: 10,
        collisionResistanceBoost: 15,
        dragReduction: 0.02,
        brakeImprovement: 0.1,
        spawnDistance: 120 
    },
    roadGeneration: {
        curveIntensity: 0.08,
        slopeIntensity: 0.04,
        bankingAngle: 0.15,
        variationSeed: 12345
    },
    rendering: {
        fogNear: 80,
        fogFar: 170,
        fogColor: 0x1a3452
    }
};

let gameState = {
    scene: 'start',
    score: 0,
    speed: 0,
    maxSpeedReached: 0,
    upgradesCollected: 0, 
    distance: 0,
    potentialTopSpeed: 0, 
    maxUpgradesHeld: 0    
};

let scene, camera, renderer, world, car, roadManager, obstacleManager, upgradeManager, gameEngine;
let gameContainer, uiElements;

let inputState = {
    accelerate: false,
    brake: false,
    turnLeft: false,
    turnRight: false,
    gyroEnabled: false,
    gyroTilt: 0
};

const upgradeInfo = {
    'speed': {
        color: '#ffaa00',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 17l5-5-5-5M6 17l5-5-5-5"/></svg>`,
        name: 'Max Speed',
        description: `Increases top speed by ${CONFIG.upgradeSettings.maxSpeedBoost} km/h.`
    },
    'resistance': {
        color: '#00aaff',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
        name: 'Resistance',
        description: `Lose fewer upgrades on high-speed collisions.`
    },
    'tires': {
        color: '#aa00ff',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>`,
        name: 'Better Tires',
        description: 'Reduces drag for faster acceleration.'
    },
    'brakes': {
        color: '#00ffaa',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 8v4l2 2"/></svg>`,
        name: 'Better Brakes',
        description: 'Increases braking force for quicker stops.'
    },
     'lost': {
        color: '#d32f2f',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
        name: 'Upgrade Lost'
    }
};

class GameEngine {
    constructor() {
        this.clock = new THREE.Clock();
        this.isRunning = false;
        this.init();
    }

    init() {
        console.log('Initializing game engine...');
        try {
            this.setupThreeJS();
            this.setupPhysics();
            this.setupLighting();
            this.setupUI();
            this.setupControls();
            this.setupGameObjects();
            console.log('Game engine initialized successfully');
        } catch (error) {
            console.error('Error initializing game:', error);
        }
    }

    setupThreeJS() {
        scene = new THREE.Scene();
        scene.background = new THREE.Color(CONFIG.rendering.fogColor);
        scene.fog = new THREE.Fog(CONFIG.rendering.fogColor, CONFIG.rendering.fogNear, CONFIG.rendering.fogFar);
        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500);
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.setClearColor(CONFIG.rendering.fogColor);
        gameContainer = document.getElementById('gameContainer');
        gameContainer.appendChild(renderer.domElement);
        window.addEventListener('resize', this.onWindowResize.bind(this));
    }

    setupPhysics() {
        world = new CANNON.World();
        world.gravity.set(0, -30, 0);
        world.broadphase = new CANNON.NaiveBroadphase();
        world.defaultContactMaterial.friction = 0.4;
        world.defaultContactMaterial.restitution = 0.3;
        const sphereMat = new CANNON.Material('sphere');
        const roadMat = new CANNON.Material('road');
        const sphereRoadContact = new CANNON.ContactMaterial(sphereMat, roadMat, { friction: 0.4, restitution: 0.7 });
        world.addContactMaterial(sphereRoadContact);
        world.materials = { sphereMat, roadMat };
    }

    setupLighting() {
        scene.add(new THREE.AmbientLight(0x404040, 0.6));
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
        directionalLight.position.set(100, 100, 50);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        scene.add(directionalLight);
        this.carLight = new THREE.PointLight(0x32b8c6, 0.8, 40);
        this.carLight.position.set(0, 8, 0);
        scene.add(this.carLight);
        const carMat = new CANNON.Material('car');
        const barricadeMat = new CANNON.Material('barricade');
        world.materials.carMat = carMat;
        world.materials.barricadeMat = barricadeMat;
        const roadMat = world.materials.roadMat;
        world.addContactMaterial(new CANNON.ContactMaterial(carMat, roadMat, { friction: 0.3, restitution: 0 }));
        world.addContactMaterial(new CANNON.ContactMaterial(carMat, barricadeMat, { friction: 0.5, restitution: 0.2 }));
        world.addContactMaterial(new CANNON.ContactMaterial(barricadeMat, roadMat, { friction: 0.4, restitution: 0.7 }));
    }

    setupUI() {
        uiElements = {
            scoreValue: document.getElementById('scoreValue'),
            speedValue: document.getElementById('speedValue'),
            acquiredUpgradesContainer: document.getElementById('acquiredUpgradesContainer'),
            currentUpgradesIconList: document.getElementById('currentUpgradesIconList'),
            infoUpgradesContainer: document.getElementById('infoUpgradesContainer'),
            startScreen: document.getElementById('startScreen'),
            gameOverScreen: document.getElementById('gameOverScreen'),
            permissionModal: document.getElementById('permissionModal'),
            motionIndicatorDot: document.getElementById('motionIndicatorDot'),
            instructions: document.getElementById('instructions'),
            potentialTopSpeed: document.getElementById('potentialTopSpeed'),
            maxSpeedReached: document.getElementById('maxSpeedReached'),
            maxUpgradesHeld: document.getElementById('maxUpgradesHeld'),
            finalScore: document.getElementById('finalScore')
        };
        document.getElementById('startGameBtn').addEventListener('click', () => {
            
            if (this.isMobile() && typeof DeviceOrientationEvent !== 'undefined') {
                
                if (uiElements.infoUpgradesContainer && uiElements.permissionModal) {
                    uiElements.permissionModal.querySelectorAll(".modal-content")[0].appendChild(uiElements.infoUpgradesContainer);
                    
                }
                if (uiElements.startScreen) uiElements.startScreen.classList.add('hidden');
                uiElements.permissionModal.classList.remove('hidden');
                const elem = document.documentElement;
                const enterFullscreenAndLock = async () => {
                    try {
                        if (elem.requestFullscreen) {
                            await elem.requestFullscreen();
                        }
                        
                        if (screen.orientation && screen.orientation.lock) {
                            await screen.orientation.lock('landscape');
                        }
                    } catch (error) {
                        console.warn(`Could not set fullscreen or lock orientation: ${error}`);
                    }
                };

                enterFullscreenAndLock();
                this.enableGyroListener(); 
            } else {
                
                this.startGame();
            }
        });
        document.getElementById('restartBtn').addEventListener('click', () => this.restartGame());
        document.getElementById('mainMenuBtn').addEventListener('click', () => this.showMainMenu());
        const confirmMotionBtn = document.getElementById('confirmMotionBtn');
        const skipMotionBtn = document.getElementById('skipMotionBtn');
        if (confirmMotionBtn) confirmMotionBtn.addEventListener('click', () => this.confirmMotionControls());
        if (skipMotionBtn) skipMotionBtn.addEventListener('click', () => this.skipMotionControls());
        const accelerateBtn = document.getElementById('accelerateBtn');
        const brakeBtn = document.getElementById('brakeBtn');
        const onAccelerate = (e) => { e.preventDefault(); inputState.accelerate = true; };
        const offAccelerate = (e) => { e.preventDefault(); inputState.accelerate = false; };
        const onBrake = (e) => { e.preventDefault(); inputState.brake = true; };
        const offBrake = (e) => { e.preventDefault(); inputState.brake = false; };
        accelerateBtn.addEventListener('touchstart', onAccelerate);
        accelerateBtn.addEventListener('touchend', offAccelerate);
        accelerateBtn.addEventListener('mousedown', onAccelerate);
        accelerateBtn.addEventListener('mouseup', offAccelerate);
        brakeBtn.addEventListener('touchstart', onBrake);
        brakeBtn.addEventListener('touchend', offBrake);
        brakeBtn.addEventListener('mousedown', onBrake);
        brakeBtn.addEventListener('mouseup', offBrake);
        this.populateUpgradeInfo();
    }

    populateUpgradeInfo() {
        const container = uiElements.infoUpgradesContainer;
        if (!container) return;
        container.innerHTML = '';
        ['speed', 'resistance', 'tires', 'brakes'].forEach(upgradeType => {
            const info = upgradeInfo[upgradeType];
            const itemElement = document.createElement('div');
            itemElement.className = 'upgrade-info-item';
            itemElement.innerHTML = `<div class="upgrade-info-icon" style="border-color: ${info.color}; color: ${info.color};">${info.icon}</div><div class="upgrade-info-text"><h5>${info.name.toUpperCase()}</h5><p>${info.description}</p></div>`;
            container.appendChild(itemElement);
        });
    }

    setupControls() {
        window.addEventListener('keydown', (event) => {
            if (gameState.scene !== 'playing') return;
            switch (event.key) {
                case 'ArrowLeft': case 'a': case 'A': inputState.turnLeft = true; break;
                case 'ArrowRight': case 'd': case 'D': inputState.turnRight = true; break;
                case 'ArrowUp': case 'w': case 'W': inputState.accelerate = true; break;
                case 'ArrowDown': case 's': case 'S': inputState.brake = true; break;
            }
        });
        window.addEventListener('keyup', (event) => {
            switch (event.key) {
                case 'ArrowLeft': case 'a': case 'A': inputState.turnLeft = false; break;
                case 'ArrowRight': case 'd': case 'D': inputState.turnRight = false; break;
                case 'ArrowUp': case 'w': case 'W': inputState.accelerate = false; break;
                case 'ArrowDown': case 's': case 'S': inputState.brake = false; break;
            }
        });
    }

    setupGyroControls() {
        console.log(this.isMobile() ? 'Mobile device detected, enabling gyro controls.' : 'Non-mobile device detected, skipping gyro controls.');
        
        if (this.isMobile() && typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
            uiElements.permissionModal.classList.remove('hidden');
            this.enableGyroListener();
        }
    }

    isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || (navigator.maxTouchPoints && navigator.maxTouchPoints > 2);
    }
    
    confirmMotionControls() {
        
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            DeviceOrientationEvent.requestPermission().then(response => {
                inputState.gyroEnabled = (response === 'granted');
                uiElements.permissionModal.classList.add('hidden');
                this.startGame(); 
            }).catch(() => {
                
                inputState.gyroEnabled = false;
                uiElements.permissionModal.classList.add('hidden');
                this.startGame();
            });
        } else {
            
            inputState.gyroEnabled = true;
            uiElements.permissionModal.classList.add('hidden');
            this.startGame();
        }
    }
    
    skipMotionControls() {
        inputState.gyroEnabled = false;
        uiElements.permissionModal.classList.add('hidden');
        this.startGame();
    }

    enableGyroListener() {
        
        window.addEventListener('deviceorientation', (event) => {
            const tilt = Math.max(-1, Math.min(1, event.gamma / 30));
            inputState.gyroTilt = - tilt;
            if (!uiElements.permissionModal.classList.contains('hidden') && uiElements.motionIndicatorDot) {
                uiElements.motionIndicatorDot.style.left = `${(tilt + 1) / 2 * 100}%`;
            }
        });
    }

    setupGameObjects() {
        car = new Car();
        roadManager = new RoadManager();
        obstacleManager = new ObstacleManager();
        upgradeManager = new UpgradeManager();
    }

    startGame() {
        gameState.scene = 'playing';
        gameState.score = 0;
        gameState.speed = 0;
        gameState.maxSpeedReached = 0;
        gameState.upgradesCollected = 0;
        gameState.distance = 0;
        gameState.maxUpgradesHeld = 0;
        gameState.potentialTopSpeed = CONFIG.gameSettings.maxSpeed;
        if (uiElements.startScreen) uiElements.startScreen.classList.add('hidden');
        this.updateCurrentUpgradesDisplay();
        if (uiElements.acquiredUpgradesContainer) uiElements.acquiredUpgradesContainer.innerHTML = '';
        if (uiElements.instructions) {
            uiElements.instructions.classList.remove('hidden');
            setTimeout(() => { if (uiElements.instructions) uiElements.instructions.classList.add('hidden'); }, 5000);
        }
        if (car) car.reset();
        if (roadManager) roadManager.reset();
        if (obstacleManager) obstacleManager.reset();
        if (upgradeManager) upgradeManager.reset();
        this.isRunning = true;
        this.gameLoop();
    }

    restartGame() {
        if (uiElements.gameOverScreen) uiElements.gameOverScreen.classList.add('hidden');
        this.startGame();
    }

    showMainMenu() {
        gameState.scene = 'start';
        this.isRunning = false;
        if (uiElements.gameOverScreen) uiElements.gameOverScreen.classList.add('hidden');
        if (uiElements.startScreen) uiElements.startScreen.classList.remove('hidden');
    }

    gameOver() {
        console.log('Game over!');
        gameState.scene = 'gameOver';
        this.isRunning = false;

        
        if (uiElements.finalScore) {
            uiElements.finalScore.textContent = Math.floor(gameState.score);
        }
        if (uiElements.potentialTopSpeed) {
            uiElements.potentialTopSpeed.textContent = Math.floor(gameState.potentialTopSpeed);
        }
        if (uiElements.maxSpeedReached) {
            uiElements.maxSpeedReached.textContent = Math.floor(gameState.maxSpeedReached);
        }
        if (uiElements.maxUpgradesHeld) {
            uiElements.maxUpgradesHeld.textContent = gameState.maxUpgradesHeld;
        }

        if (uiElements.gameOverScreen) {
            uiElements.gameOverScreen.classList.remove('hidden');
        }
    }

    gameLoop() {
        if (!this.isRunning || gameState.scene !== 'playing') return;
        const deltaTime = Math.min(this.clock.getDelta(), 0.05);
        try {
            world.step(1 / 60, deltaTime, 3);
            if (car) car.update(deltaTime);
            if (roadManager) roadManager.update(car ? car.position.z : 0);
            if (obstacleManager) obstacleManager.update(deltaTime, car ? car.position.z : 0);
            if (upgradeManager) upgradeManager.update(deltaTime, car ? car.position.z : 0);
            this.updateCamera();
            this.updateUI();
            if (car) {
                gameState.speed = car.currentSpeed;
                gameState.maxSpeedReached = Math.max(gameState.maxSpeedReached, car.currentSpeed);
                gameState.distance = Math.abs(car.position.z);
            }
            gameState.score = gameState.distance * 0.1 + gameState.upgradesCollected * 200;
            this.checkCollisions();
            if (renderer && scene && camera) renderer.render(scene, camera);
        } catch (error) {
            console.error('Error in game loop:', error);
            this.isRunning = false;
            return;
        }
        requestAnimationFrame(() => this.gameLoop());
    }

    updateCamera() {
        if (!car || !camera) return;
        const targetPosition = new THREE.Vector3(car.position.x, car.position.y + CONFIG.gameSettings.cameraHeight, car.position.z + CONFIG.gameSettings.cameraDistance);
        camera.position.lerp(targetPosition, 0.08);
        camera.lookAt(car.position.x, car.position.y + 2, car.position.z - 15);
        if (this.carLight) {
            this.carLight.position.copy(car.position);
            this.carLight.position.y += 5;
        }
    }

    updateUI() {
        if (uiElements.scoreValue) uiElements.scoreValue.textContent = Math.floor(gameState.score);
        if (uiElements.speedValue) uiElements.speedValue.textContent = Math.floor(gameState.speed);
    }

    
    checkCollisions() {
        if (!car || !obstacleManager || !upgradeManager) return;

        try {
            

            
            const carBox = new THREE.Box3().setFromObject(car.mesh);
            
            for (let i = upgradeManager.upgrades.length - 1; i >= 0; i--) {
                const upgrade = upgradeManager.upgrades[i];
                if (upgrade.mesh && upgrade.mesh.position.z < car.position.z + 25 && upgrade.mesh.position.z > car.position.z - 8) {
                    const upgradeBox = new THREE.Box3().setFromObject(upgrade.mesh);
                    if (carBox.intersectsBox(upgradeBox)) {
                        this.collectUpgrade(upgrade.type);
                        upgradeManager.removeUpgrade(i); 
                        gameState.upgradesCollected++;
                    }
                }
            }

            
            const roadBoundary = CONFIG.gameSettings.roadWidth / 2 - 1;
            if (Math.abs(car.position.x) > roadBoundary) {
                car.position.x = Math.sign(car.position.x) * roadBoundary;
                car.currentSpeed *= 0.8;
            }

        } catch (error) {
            console.error('Error in collision detection:', error);
        }
    }

    collectUpgrade(type) {
        if (!car) return;
        car.activeUpgrades.push(type);
        gameState.upgradesCollected++;
        gameState.maxUpgradesHeld = Math.max(gameState.maxUpgradesHeld, gameState.upgradesCollected);
        let notificationText = upgradeInfo[type].name.toUpperCase();
        switch (type) {
            case 'speed': car.maxSpeed += CONFIG.upgradeSettings.maxSpeedBoost; gameState.potentialTopSpeed += CONFIG.upgradeSettings.maxSpeedBoost; notificationText += ` +${CONFIG.upgradeSettings.maxSpeedBoost}`; break;
            case 'resistance': car.collisionResistance += CONFIG.upgradeSettings.collisionResistanceBoost; notificationText += ` +${CONFIG.upgradeSettings.collisionResistanceBoost}`; break;
            case 'tires': car.dragCoefficient -= CONFIG.upgradeSettings.dragReduction; break;
            case 'brakes': car.brakeForce += CONFIG.upgradeSettings.brakeImprovement; break;
        }
        this.showAcquiredUpgradeNotification(type, notificationText);
        this.updateCurrentUpgradesDisplay();
    }

    showAcquiredUpgradeNotification(type, text) {
        if (!uiElements.acquiredUpgradesContainer) return;
        const info = upgradeInfo[type];
        const notification = document.createElement('div');
        notification.className = 'upgrade-notification';
        notification.style.borderColor = info.color;
        notification.innerHTML = `<div class="icon" style="color: ${info.color}">${info.icon}</div><span>${text}</span>`;
        uiElements.acquiredUpgradesContainer.appendChild(notification);
        setTimeout(() => { if (notification.parentNode) notification.parentNode.removeChild(notification); }, 4900);
    }
    
    
    updateCurrentUpgradesDisplay() {
        if (!uiElements.currentUpgradesIconList || !car) return;

        uiElements.currentUpgradesIconList.innerHTML = ''; 

        car.activeUpgrades.forEach(type => {
            const info = upgradeInfo[type];
            const iconWrapper = document.createElement('div');
            iconWrapper.className = 'current-upgrade-icon added';
            iconWrapper.style.borderColor = info.color;
            
            iconWrapper.title = info.name;
            
            iconWrapper.innerHTML = info.icon;
            
            uiElements.currentUpgradesIconList.appendChild(iconWrapper);
        });
    }

    onWindowResize() {
        if (camera && renderer) {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        }
    }
}

class Car {
    constructor() {
        this.position = new THREE.Vector3(0, 0, 0);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.rotation = 0;
        this.currentSpeed = 0;
        this.maxSpeed = CONFIG.gameSettings.maxSpeed;
        this.collisionResistance = 0;
        this.dragCoefficient = CONFIG.carPhysics.dragCoefficient;
        this.brakeForce = 1;
        this.activeUpgrades = [];
        this.createMesh();
    }
    createMesh() {
        const bodyGeometry = new THREE.BoxGeometry(2.5, 1.2, 5);
        const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0x32b8c6 });
        this.mesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        scene.add(this.mesh);
        const detailsGroup = new THREE.Group();
        const windowGeometry = new THREE.BoxGeometry(2, 1, 2.5);
        const windowMaterial = new THREE.MeshLambertMaterial({ color: 0x1a1a2e });
        const windows = new THREE.Mesh(windowGeometry, windowMaterial);
        windows.position.set(0, 0.5, 0);
        detailsGroup.add(windows);
        const headlightGeometry = new THREE.SphereGeometry(0.3, 8, 8);
        const headlightMaterial = new THREE.MeshLambertMaterial({ color: 0xffffaa, emissive: 0xffffaa, emissiveIntensity: 0.3 });
        const headlightLeft = new THREE.Mesh(headlightGeometry, headlightMaterial);
        const headlightRight = new THREE.Mesh(headlightGeometry, headlightMaterial);
        headlightLeft.position.set(-0.8, 0, -2.2);
        headlightRight.position.set(0.8, 0, -2.2);
        detailsGroup.add(headlightLeft);
        detailsGroup.add(headlightRight);
        this.mesh.add(detailsGroup);
        const carShape = new CANNON.Box(new CANNON.Vec3(1.25, 0.6, 2.5));
        this.body = new CANNON.Body({ mass: CONFIG.carPhysics.mass, material: world.materials.carMat });
        this.body.addShape(carShape);
        this.body.position.set(0, 2, 0);
        world.addBody(this.body);
    }
    update(deltaTime) {
        let turnInput = 0;
        if (inputState.turnLeft) turnInput += 1;
        if (inputState.turnRight) turnInput -= 1;
        if (inputState.gyroEnabled) turnInput += inputState.gyroTilt;
        const steeringMultiplier = Math.min(this.currentSpeed / 15, 1);
        this.rotation += turnInput * CONFIG.gameSettings.turnSpeed * steeringMultiplier;
        if (inputState.accelerate) {
            this.currentSpeed += CONFIG.gameSettings.acceleration;
        } else if (inputState.brake) {
            this.currentSpeed -= CONFIG.gameSettings.acceleration * 2.5 * this.brakeForce;
        } else {
            this.currentSpeed *= CONFIG.gameSettings.deceleration;
        }
        this.currentSpeed *= (1 - this.dragCoefficient * deltaTime);
        this.currentSpeed = Math.max(0, Math.min(this.currentSpeed, this.maxSpeed));
        this.velocity.x = -Math.sin(this.rotation) * this.currentSpeed * deltaTime;
        this.velocity.z = -Math.cos(this.rotation) * this.currentSpeed * deltaTime;
        this.position.add(this.velocity);
        this.mesh.position.copy(this.position);
        this.mesh.rotation.y = this.rotation;
        this.body.position.set(this.position.x, this.position.y + 1, this.position.z);
        this.body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), this.rotation);
    }
    removeLastUpgrade() {
        if (this.activeUpgrades.length === 0) return null;
        const lostUpgradeType = this.activeUpgrades.pop();
        switch (lostUpgradeType) {
            case 'speed': this.maxSpeed = Math.max(CONFIG.gameSettings.maxSpeed, this.maxSpeed - CONFIG.upgradeSettings.maxSpeedBoost); break;
            case 'resistance': this.collisionResistance = Math.max(0, this.collisionResistance - CONFIG.upgradeSettings.collisionResistanceBoost); break;
            case 'tires': this.dragCoefficient += CONFIG.upgradeSettings.dragReduction; break;
            case 'brakes': this.brakeForce = Math.max(1, this.brakeForce - CONFIG.upgradeSettings.brakeImprovement); break;
        }
        return lostUpgradeType;
    }
    reset() {
        this.position.set(0, 0, 0);
        this.velocity.set(0, 0, 0);
        this.rotation = 0;
        this.currentSpeed = 0;
        this.maxSpeed = CONFIG.gameSettings.maxSpeed;
        this.collisionResistance = 0;
        this.dragCoefficient = CONFIG.carPhysics.dragCoefficient;
        this.brakeForce = 1;
        this.activeUpgrades = [];
        this.mesh.position.copy(this.position);
        this.mesh.rotation.y = this.rotation;
        this.body.position.set(0, 2, 0);
        this.body.velocity.set(0, 0, 0);
        this.body.angularVelocity.set(0, 0, 0);
    }
}

class RoadManager {
    constructor() {
        this.segments = [];
        this.segmentGeometry = new THREE.PlaneGeometry(CONFIG.gameSettings.roadWidth, CONFIG.gameSettings.roadSegmentLength);
        this.roadMaterial = new THREE.MeshLambertMaterial({ color: 0x2c2c54 });
        this.barrierMaterial = new THREE.MeshLambertMaterial({ color: 0xffff00, transparent: true, opacity: 0.75 });
        this.generateInitialRoad();
    }
    generateInitialRoad() {
        for (let i = -CONFIG.gameSettings.segmentsBehind; i <= CONFIG.gameSettings.segmentsAhead; i++) {
            this.createRoadSegment(i);
        }
    }
    createRoadSegment(segmentIndex) {
        const segment = { index: segmentIndex, meshes: [], barriers: [] };
        const zPosition = segmentIndex * CONFIG.gameSettings.roadSegmentLength;
        const roadMesh = new THREE.Mesh(this.segmentGeometry, this.roadMaterial);
        roadMesh.rotation.x = -Math.PI / 2;
        roadMesh.position.set(0, 0, zPosition);
        roadMesh.receiveShadow = true;
        scene.add(roadMesh);
        segment.meshes.push(roadMesh);
        const roadBody = new CANNON.Body({ mass: 0, material: world.materials.roadMat });
        roadBody.addShape(new CANNON.Box(new CANNON.Vec3(CONFIG.gameSettings.roadWidth / 2, 0.1, CONFIG.gameSettings.roadSegmentLength / 2)));
        roadBody.position.set(0, 0, zPosition);
        world.addBody(roadBody);
        const barrierGeometry = new THREE.BoxGeometry(2, 4, CONFIG.gameSettings.roadSegmentLength);
        const leftBarrier = new THREE.Mesh(barrierGeometry, this.barrierMaterial);
        leftBarrier.position.set(-CONFIG.gameSettings.roadWidth / 2 - 1, 2, zPosition);
        leftBarrier.castShadow = true;
        scene.add(leftBarrier);
        segment.barriers.push(leftBarrier);
        const rightBarrier = new THREE.Mesh(barrierGeometry, this.barrierMaterial);
        rightBarrier.position.set(CONFIG.gameSettings.roadWidth / 2 + 1, 2, zPosition);
        rightBarrier.castShadow = true;
        scene.add(rightBarrier);
        segment.barriers.push(rightBarrier);
        this.createLaneMarkings(segment, zPosition);
        this.segments.push(segment);
    }
    createLaneMarkings(segment, zPosition) {
        const markingGeometry = new THREE.PlaneGeometry(0.3, 6);
        const markingMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });
        const centerLineSegments = 5;
        for (let i = 0; i < centerLineSegments; i++) {
            const marking = new THREE.Mesh(markingGeometry, markingMaterial);
            marking.rotation.x = -Math.PI / 2;
            marking.position.set(0, 0.02, zPosition - CONFIG.gameSettings.roadSegmentLength / 2 + (i * 10) + 5);
            scene.add(marking);
            segment.meshes.push(marking);
        }
        const lanePositions = [-CONFIG.gameSettings.roadWidth / 4, CONFIG.gameSettings.roadWidth / 4];
        lanePositions.forEach(laneX => {
            for (let i = 0; i < centerLineSegments; i++) {
                const marking = new THREE.Mesh(markingGeometry, markingMaterial);
                marking.rotation.x = -Math.PI / 2;
                marking.position.set(laneX, 0.02, zPosition - CONFIG.gameSettings.roadSegmentLength / 2 + (i * 10) + 5);
                scene.add(marking);
                segment.meshes.push(marking);
            }
        });
    }
    update(carZ) {
        const currentSegmentIndex = Math.floor(carZ / CONFIG.gameSettings.roadSegmentLength);
        const neededMinIndex = currentSegmentIndex - CONFIG.gameSettings.segmentsAhead;
        const neededMaxIndex = currentSegmentIndex + CONFIG.gameSettings.segmentsBehind;
        const existingIndices = this.segments.map(s => s.index);
        const currentMinIndex = existingIndices.length > 0 ? Math.min(...existingIndices) : 0;
        const currentMaxIndex = existingIndices.length > 0 ? Math.max(...existingIndices) : 0;
        for (let i = neededMinIndex; i < currentMinIndex; i++) this.createRoadSegment(i);
        for (let i = currentMaxIndex + 1; i <= neededMaxIndex; i++) this.createRoadSegment(i);
        this.segments = this.segments.filter(segment => {
            if (segment.index > neededMaxIndex || segment.index < neededMinIndex) {
                this.removeSegment(segment);
                return false;
            }
            return true;
        });
    }
    removeSegment(segment) {
        segment.meshes.forEach(mesh => {
            scene.remove(mesh);
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) mesh.material.dispose();
        });
        segment.barriers.forEach(barrier => {
            scene.remove(barrier);
            if (barrier.geometry) barrier.geometry.dispose();
            if (barrier.material) barrier.material.dispose();
        });
    }
    reset() {
        this.segments.forEach(segment => this.removeSegment(segment));
        this.segments = [];
        this.generateInitialRoad();
    }
}

class ObstacleManager {
    constructor() {
        this.obstacles = [];
        this.lastSpawnZ = 0;
    }
    update(deltaTime, carZ) {
        const distanceTraveled = Math.abs(carZ);
        const spawnInterval = 30;
        if (distanceTraveled > this.lastSpawnZ + spawnInterval) {
            this.spawnObstacle(carZ - CONFIG.obstacleSettings.spawnDistance);
            this.lastSpawnZ = distanceTraveled;
        }
        this.obstacles.forEach(obstacle => {
            if (obstacle.type === 'sphere' && obstacle.body) {
                obstacle.mesh.position.copy(obstacle.body.position);
                obstacle.mesh.quaternion.copy(obstacle.body.quaternion);
            }
        });
        this.obstacles = this.obstacles.filter((obstacle, index) => {
            if (obstacle.mesh.position.z > carZ + 100) {
                this.removeObstacle(index, false);
                return false;
            }
            return true;
        });
    }
    spawnObstacle(z) {
        const numObstacles = Math.floor(Math.random() * 2) + 1;
        const laneWidth = CONFIG.gameSettings.roadWidth / 4;
        const usedLanes = [];
        for (let i = 0; i < numObstacles; i++) {
            let lane;
            do { lane = Math.floor(Math.random() * 4); } while (usedLanes.includes(lane));
            usedLanes.push(lane);
            const xPosition = (lane - 1.5) * laneWidth;
            if (Math.random() > 0.6) { this.createSphereObstacle(z, xPosition); }
            else { this.createBoxObstacle(z, lane); }
        }
    }
    createBoxObstacle(z, laneIndex) {
        const laneWidth = CONFIG.gameSettings.roadWidth / 4;
        const x = (laneIndex - 1.5) * laneWidth;
        const width = laneWidth;
        const height = 4;
        const depth = 1.5;
        const geo  = new THREE.BoxGeometry(width, height, depth);
        const mat  = new THREE.MeshLambertMaterial({ color: 0xd32f2f });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = true;
        mesh.position.set(x, height/2, z);
        scene.add(mesh);

        const shape = new CANNON.Box(new CANNON.Vec3(width/2, height/2, depth/2));
        const body  = new CANNON.Body({ mass: 80, material: world.materials.barricadeMat });
        body.addShape(shape);
        body.position.set(x, height/2, z);
        world.addBody(body);
        
        
        const obstacleObject = { type: 'barricade', mesh, body, laneX: x, hasCollided: false };

        body.addEventListener('collide', (e) => {
            
            if (e.body !== car.body || obstacleObject.hasCollided) {
                return;
            }

            const carSpeed = car.body.velocity.length();
            const highSpeedThreshold = 15;

            if (carSpeed > highSpeedThreshold) {
                if (car.activeUpgrades.length > 0) {
                    
                    
                    obstacleObject.hasCollided = true; 

                    const lostUpgrade = car.removeLastUpgrade();
                    gameState.upgradesCollected--;

                    if (lostUpgrade === 'speed') {
                        gameState.potentialTopSpeed -= CONFIG.upgradeSettings.maxSpeedBoost;
                    }

                    gameEngine.showAcquiredUpgradeNotification('lost', `LOST: ${lostUpgrade.toUpperCase()}!`);
                    gameEngine.updateCurrentUpgradesDisplay();

                    const backwardImpulse = car.body.velocity.clone().unit().negate().scale(carSpeed * 1.5);
                    car.body.applyImpulse(backwardImpulse, car.body.position);
                    car.currentSpeed = 0;

                    
                    setTimeout(() => {
                        const obstacleIndex = this.obstacles.findIndex(obs => obs.body.id === body.id);
                        if (obstacleIndex !== -1) {
                            this.removeObstacle(obstacleIndex);
                        }
                    }, 0);
                } else {
                    gameEngine.gameOver();
                }
            } else {
                 
                const pushForce = car.body.velocity.clone().scale(body.mass * 0.5);
                body.applyImpulse(pushForce, e.contact.ri);
                
                const slowDownFactor = 0.5;
                car.body.velocity.scale(slowDownFactor, car.body.velocity);
                car.currentSpeed *= slowDownFactor;
            }
        });
        
        this.obstacles.push(obstacleObject);
    }
    createSphereObstacle(z, x) {
        const radius = CONFIG.obstacleSettings.sphereRadius * (0.6 + Math.random() * 0.8);
        const mass = 5 + radius * 10;
        const geometry = new THREE.SphereGeometry(radius, 16, 16);
        const material = new THREE.MeshLambertMaterial({ color: 0x44ff44, emissive: 0x114411, emissiveIntensity: 0.2 });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        scene.add(mesh);
        const shape = new CANNON.Sphere(radius);
        const body = new CANNON.Body({ mass: mass, material: world.materials.barricadeMat });
        body.addShape(shape);
        body.position.set(x, radius + 1, z);
        world.addBody(body);
        body.addEventListener('collide', (e) => {
            if (e.body === car.body) {
                const relVel = car.body.velocity.clone().negate();
                const impulseMag = car.body.velocity.length() * (car.body.mass / (mass + car.body.mass)) * 0.2;
                const impulse = relVel.unit().scale(impulseMag);
                body.applyImpulse(impulse, body.position);
                const slowF = mass / (mass + car.body.mass);
                car.body.velocity.scale(1 - slowF, car.body.velocity);
            }
        });
        this.obstacles.push({ type: 'sphere', mesh, body });
    }
    removeObstacle(index, fromArray = true) {
        if (index < 0 || index >= this.obstacles.length) return;
        const obstacle = this.obstacles[index];
        scene.remove(obstacle.mesh);
        if (obstacle.mesh.geometry) obstacle.mesh.geometry.dispose();
        if (obstacle.mesh.material) obstacle.mesh.material.dispose();
        if (obstacle.body) world.removeBody(obstacle.body);
        if (fromArray) this.obstacles.splice(index, 1);
    }
    reset() {
        this.obstacles.forEach((obstacle, index) => this.removeObstacle(index, false));
        this.obstacles = [];
        this.lastSpawnZ = 0;
    }
}

class UpgradeManager {
    constructor() {
        this.upgrades = [];
        this.lastSpawnZ = 0;
        this.upgradeTypes = ['speed', 'resistance', 'tires', 'brakes'];
        this.upgradeColors = { speed: 0xffaa00, resistance: 0x00aaff, tires: 0xaa00ff, brakes: 0x00ffaa };
    }
    update(deltaTime, carZ) {
        const distanceTraveled = Math.abs(carZ);
        if (distanceTraveled > this.lastSpawnZ + 120) {
            this.spawnUpgrade(carZ - CONFIG.upgradeSettings.spawnDistance);
            this.lastSpawnZ = distanceTraveled;
        }
        this.upgrades.forEach(upgrade => {
            if (upgrade.mesh) {
                upgrade.mesh.rotation.y += deltaTime * 3;
                upgrade.mesh.rotation.x += deltaTime * 1.5;
                upgrade.mesh.position.y = 2 + Math.sin(Date.now() * 0.008 + upgrade.offset) * 0.5;
            }
        });
        this.upgrades = this.upgrades.filter((upgrade, index) => {
            if (upgrade.mesh.position.z > carZ + 100) {
                this.removeUpgrade(index, false);
                return false;
            }
            return true;
        });
    }
    spawnUpgrade(z) {
        const upgradeType = this.upgradeTypes[Math.floor(Math.random() * this.upgradeTypes.length)];
        const geometry = new THREE.OctahedronGeometry(1.5);
        const material = new THREE.MeshLambertMaterial({ color: this.upgradeColors[upgradeType], emissive: this.upgradeColors[upgradeType], emissiveIntensity: 0.4 });
        const mesh = new THREE.Mesh(geometry, material);
        const lane = Math.floor(Math.random() * 4);
        const xPosition = (lane - 1.5) * (CONFIG.gameSettings.roadWidth / 4);
        mesh.position.set(xPosition, 2, z);
        mesh.castShadow = true;
        scene.add(mesh);
        this.upgrades.push({ type: upgradeType, mesh: mesh, offset: Math.random() * Math.PI * 2 });
    }
    removeUpgrade(index, fromArray = true) {
        if (index < 0 || index >= this.upgrades.length) return;
        const upgrade = this.upgrades[index];
        scene.remove(upgrade.mesh);
        if (upgrade.mesh.geometry) upgrade.mesh.geometry.dispose();
        if (upgrade.mesh.material) upgrade.mesh.material.dispose();
        if (fromArray) this.upgrades.splice(index, 1);
    }
    reset() {
        this.upgrades.forEach((upgrade, index) => this.removeUpgrade(index, false));
        this.upgrades = [];
        this.lastSpawnZ = 0;
    }
}

window.addEventListener('load', () => {
    try {
        gameEngine = new GameEngine();
    } catch (error) {
        console.error('Failed to initialize game:', error);
    }
});