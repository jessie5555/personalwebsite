import * as THREE from 'three';
import { Water } from 'three/examples/jsm/objects/Water.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import GUI from 'lil-gui';

const rocks = []; // Array to track all rock objects
const keys = { w: false, a: false, s: false, d: false };
const explosionTextures = [
    'jpegs/babypoop.jpg',
    'jpegs/faex.jpg',
    'jpegs/heatpump.jpg',
    'jpegs/simulation.png',
    'jpegs/solar charger.JPG',
]; // Array of texture paths
let explosionTextureIndex = 0; // Start with the first picture
let currentExplosionPlane = null; // Reference to the currently displayed plane


const playArea = {
    xMin: -50, // Minimum X coordinate
    xMax: 50,  // Maximum X coordinate
    zMin: -50, // Minimum Z coordinate
    zMax: 50,  // Maximum Z coordinate
};
const enemyCannonballs = []; // Array to track enemy cannonballs
const ENEMY_FIRE_DISTANCE = 100; // Distance at which ships fire at the player
const ENEMY_FIRE_COOLDOWN = 3; // Cooldown in seconds
let playerVelocity = new THREE.Vector3(0, 0, 0); // Velocity vector
const maxSpeed = 0.1; // Maximum speed
const acceleration = 0.02; // Acceleration factor
const friction = 0.9; // Damping factor
const rotationSpeed = 0.01; // Rotation speed

const enemyShips = []; // Array to store enemy ships
const GRAVITY = -9.8; // Simulated gravity (m/s²)
const CANNONBALL_SPEED = 40; // Initial speed (m/s)
const CANNONBALL_LIFESPAN = 5; // Time in seconds before cannonball is removed
const cannonballs = []; // Array to track active cannonballs
let totalCannonballs = 10; // Initial number of cannonballs
let reloadTime = 3; // Reload time in seconds
let isReloading = false; // Flag to track reloading state
let canFire = true; // Flag for firing cooldown
let reloadTimer = 0; // Tracks reload progress
let ship = null; // Global variable to store the loaded ship
let building1 = null;
let building2 = null;
let cachedBottleModel = null; // Cache the model after loading
const bottles = []; // Array to store bottles and their initial positions
// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const cameraOffset = new THREE.Vector3(0, 7, -15);
camera.position.set(0, 7, -15 );
camera.rotation.x =  -Math.PI/1.1;
camera.rotation.z = Math.PI;

// elevation (z) stays constant aswell as the camera x, z  roation
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);
const clock = new THREE.Clock();

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(10, 20, 10);
directionalLight.castShadow = true;
scene.add(directionalLight);

const gui = new GUI();
const gameState = { cannonballs: totalCannonballs, reloading: "No",health: 100,};

gui.add(gameState, 'cannonballs').name('Cannonballs Left').listen();
gui.add(gameState, 'reloading').name('Reloading').listen();
gui.add(gameState, 'health').name('Health').listen();
spawnRocks(10, 'textures/stylized_rocks.glb');


// Functions
skySetUp();
const water = addWater();
loadShip();
spawnEnemyShips(5); // Spawn 5 enemy ships
loadBuildings();

loadBottleModel(scene, {x :-3, y: 0, z: 30}, .01);
// const controls = new OrbitControls(camera, renderer.domElement);
// controls.maxPolarAngle = Math.PI * 0.495;
// controls.target.set(0, 10, 0);
// controls.update();
// Handle resizing
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

window.addEventListener('keydown', (event) => {
    if (event.key === ' ') {
        fireCannonball();
    }
});
// Handle key input
window.addEventListener('keydown', (event) => {
    if (keys.hasOwnProperty(event.key)) keys[event.key] = true;
});

window.addEventListener('keyup', (event) => {
    if (keys.hasOwnProperty(event.key)) keys[event.key] = false;
});

// Move the model
alert(" use WASD to move around ");
alert(" Spacebar to fire");
alert("defeat all the pirate ships to win the game");
animate();


function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();
    if (water.material.uniforms['time']) {
        water.material.uniforms['time'].value += delta * 1;
    }
    updateBobbing(delta);
    updateCamera();
    checkCollisions();
    moveModel();
    updateCannonballs(delta); // Update cannonball positions
    const playerPosition = ship.position.clone();
    
    updateEnemyMovement(playerPosition, delta);


    if (totalCannonballs <= 0 && !isReloading) {
        reloadCannonballs();
    }
    //console.log("camera position", camera.position.x, camera.position.y , camera.position.z)
    // controls.update();
    renderer.render(scene, camera);
}




function moveModel() {
    if (ship) {
        if (keys.w) playerVelocity.z = Math.max(playerVelocity.z + acceleration, maxSpeed);
        if (keys.s) playerVelocity.z = Math.min(playerVelocity.z - acceleration, -maxSpeed);
        if (keys.a) ship.rotation.y += rotationSpeed; // Rotate left
        if (keys.d) ship.rotation.y -= rotationSpeed; // Rotate right
        playerVelocity.multiplyScalar(friction);
        ship.translateX(playerVelocity.x);
        ship.translateZ(playerVelocity.z);
        
    }
}
// Add dynamic water
function addWater() {
    const waterGeometry = new THREE.PlaneGeometry(1000, 1000);
    const waterNormals = new THREE.TextureLoader().load('textures/waternormal.jpeg', (texture) => {
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    });

    const water = new Water(waterGeometry, {
        textureWidth: 512,
        textureHeight: 512,
        waterNormals: waterNormals,
        sunDirection: new THREE.Vector3(0, 1, 0),
        sunColor: 0xffffff,
        waterColor: 0x4385df,
        distortionScale: 1,
    });

    water.rotation.x = -Math.PI / 2;
    scene.add(water);
    return water;
}
function skySetUp() {
    const sky = new Sky();
    sky.scale.setScalar(10000);
    scene.add(sky);

    const skyUniforms = sky.material.uniforms;
    skyUniforms['turbidity'].value = 20;
    skyUniforms['rayleigh'].value = 2;
    skyUniforms['mieCoefficient'].value = 0.005;
    skyUniforms['mieDirectionalG'].value = 0.8;

    const sun = new THREE.Vector3();
    const phi = THREE.MathUtils.degToRad(90 - 15);
    const theta = THREE.MathUtils.degToRad(180);
    sun.setFromSphericalCoords(1, phi, theta);
    sky.material.uniforms['sunPosition'].value.copy(sun);
}
function loadBuildings(){
    const loader = new GLTFLoader();
    loader.load('textures/oriental_building.glb',
        (gltf) => {
            building1 = gltf.scene;
            building1.position.set(-30, 0, 45);
            building1.scale.set(1, 1, 1);
            building1.rotation.y = Math.PI/2;
            scene.add(building1);
            console.log('loaded model');
        },
        undefined,
        (error) => {
            console.error('Error loading the model:', error);
        });
        loader.load('textures/pirate_building.glb',
            (gltf) => {
                building2 = gltf.scene;
                building2.position.set(20, 0 , 20);
                building2.rotation.y = -Math.PI/2;
                building2.scale.set(10,10, 10);
                scene.add(building2);
                console.log('loaded model');
            },
            undefined,
            (error) => {
                console.error('Error loading the model:', error);
            });
}

function loadShip() {
    const loader = new GLTFLoader();

    loader.load(
        'textures/pirate.glb',
        (gltf) => {
            ship = gltf.scene;
            ship.position.set(0, 0, 0);
            ship.scale.set(0.001, 0.001, 0.001);
            scene.add(ship);
        },
        undefined,
        (error) => {
            console.error('Error loading the model:', error);
        }
    );
}
function updateCamera() {
  if (ship) {
      // Clone the camera offset
      const offset = cameraOffset.clone();

      // Apply the ship's rotation to the offset
      offset.applyQuaternion(ship.quaternion);

      // Add the offset to the ship's position
      camera.position.copy(ship.position.clone().add(offset));

      // Make the camera look at the ship
      camera.lookAt(ship.position);
  }
}
function loadBottleModel(scene, position = { x: 0, y: 0, z: 0 }, scale = 1) {
    return new Promise((resolve, reject) => {
        const loader = new GLTFLoader();

        loader.load(
            'textures/message_in_a_bottle.glb', // Path to the bottle model
            (gltf) => {
                const bottle = gltf.scene.clone();
                bottle.position.set(position.x, position.y, position.z);
                bottle.scale.set(scale, scale, scale);
                scene.add(bottle);

                // Store the bottle and its initial position
                bottles.push({
                    object: bottle,
                    initialY: position.y,
                    bobPhase: Math.random() * Math.PI * 2 // Random phase for sine wave
                });

                resolve(bottle);
            },
            undefined,
            (error) => {
                console.error('Error loading bottle model:', error);
                reject(error);
            }
        );
    });
}
function updateBobbing(delta) {
    const bobSpeed = 2; // Speed of bobbing
    const bobHeight = 0.2; // Height of bobbing

    bottles.forEach((bottleData) => {
        const { object, initialY, bobPhase } = bottleData;
    
        const offsetY = Math.sin(bobSpeed * clock.elapsedTime + bobPhase) * bobHeight;
    
        // Update bottle position
        object.position.y = initialY + offsetY;
    
        // Add a slight tilt
        object.rotation.z = Math.sin(clock.elapsedTime + bobPhase) * 0.1; // Small tilt
        object.rotation.x = Math.cos(clock.elapsedTime + bobPhase) * 0.1;
    });
}
function addImagePlane(imagePath) {
    const textureLoader = new THREE.TextureLoader();

    textureLoader.load(
        imagePath,
        (texture) => {
            const geometry = new THREE.PlaneGeometry(4, 5);
            const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
            const plane = new THREE.Mesh(geometry, material);

            plane.position.set(camera.position.x+1, camera.position.y - 1 , camera.position.z);
            plane.rotation.set(camera.rotation.x,camera.rotation.y,camera.rotation.z);
            //plane.lookAt(camera.position); // Ensure the plane faces the camera
            scene.add(plane);

            // Optionally remove the plane after some time
            setTimeout(() => {
                scene.remove(plane);
            }, 10000); // Remove after 10 seconds
        },
        undefined,
        (error) => {
            console.error('Error loading texture:', error);
        }
    );
}

function showNoteOnCollision(bottleIndex) {
    const imagePath = 'textures/pirateresume.png'; // Replace with your image path
    const bottlePosition = bottles[bottleIndex].object.position;

    addImagePlane(imagePath);
    removeBottle(bottleIndex);
}

function removeBottle(bottleIndex) {
    const { object } = bottles[bottleIndex];
    scene.remove(object);
    bottles.splice(bottleIndex, 1);
}

function checkCollisions() {
    const threshold = 5;
        // Player collisions with rocks
        // Player collisions with rocks
    rocks.forEach((rock) => {
        const distance = ship.position.distanceTo(rock.position);

        if (distance < threshold) {
            // Move player back to avoid passing through the rock
            const direction = ship.position.clone().sub(rock.position).normalize();
            ship.position.add(direction.multiplyScalar(0.1)); // Push the player slightly away
        }
    });

    // Enemy collisions with rocks
    enemyShips.forEach((enemy) => {
        rocks.forEach((rock) => {
            const distance = enemy.object.position.distanceTo(rock.position);


            if (distance < threshold) {
                // Move enemy back to avoid passing through the rock
                const direction = enemy.object.position.clone().sub(rock.position).normalize();
                enemy.object.position.add(direction.multiplyScalar(0.1)); // Push the enemy slightly away
                enemy.object.position.y = 1.5; 
            }
        });
    });
    bottles.forEach((bottleData, index) => {
        const { object } = bottleData;

        const distance = ship.position.distanceTo(object.position);

        if (distance < threshold) {
            showNoteOnCollision(index);
        }
    });

    for (let i = enemyCannonballs.length - 1; i >= 0; i--) {
        const cannonballData = enemyCannonballs[i];
        const distance = ship.position.distanceTo(cannonballData.object.position);
        rocks.forEach((rock)=> {
            const cannonDistance = rock.position.distanceTo(cannonballData.object.position)
            if (cannonDistance < 10){
                scene.remove(cannonballData.object);
                enemyCannonballs.splice(i, 1);
            }
        });
        if (distance < threshold) {
            // Decrease health
            
            createExplosion(cannonballData.object.position);
             // Remove the cannonball
            scene.remove(cannonballData.object);
            enemyCannonballs.splice(i, 1);
            gameState.health -= 10; // Decrease health by 10 on each hit
            if (gameState.health <= 0) {
                gameState.health = 0;
                handlePlayerDefeat(); // Call a function to handle game over
            }
            
           
        }
    }
    // Player cannonball collisions with enemy ships
    for (let i = cannonballs.length - 1; i >= 0; i--) {
        const cannonballData = cannonballs[i];

        for (let j = enemyShips.length - 1; j >= 0; j--) {
            const enemy = enemyShips[j];
            const distance = enemy.object.position.distanceTo(cannonballData.object.position);

            if (distance < threshold) {
                createExplosion(cannonballData.object.position);
                scene.remove(cannonballData.object);
                cannonballs.splice(i, 1);

                enemy.health -= 20; // Decrease enemy health
                if (enemy.health <= 0) {
                    createShipExplosion(enemy.object.position);
                    scene.remove(enemy.object); // Remove enemy ship from scene
                    enemyShips.splice(j, 1); // Remove from enemyShips array
                    if (enemyShips.length === 0) {
                        onAllEnemiesDestroyed(); // Call a function to handle this event
                    }
                }
                break; // Stop checking this cannonball after a hit
            }
        }
    }
}
function reloadCannonballs() {
    if (isReloading || totalCannonballs > 0) return; // Prevent reloading if not needed

    isReloading = true;
    gameState.reloading = "Yes";

    reloadTimer = reloadTime; // Start reload timer
    const reloadInterval = setInterval(() => {
        reloadTimer -= 1; // Update timer
        if (reloadTimer <= 0) {
            totalCannonballs = 10; // Replenish cannonballs
            gameState.cannonballs = totalCannonballs;
            isReloading = false;
            gameState.reloading = "No";
            clearInterval(reloadInterval); // Stop timer
        }
    }, 1000); // Update every second
}
function fireCannonball() {
    if (!canFire || isReloading || totalCannonballs <= 0) return; // Prevent firing

    // Deduct a cannonball
    totalCannonballs--;
    gameState.cannonballs = totalCannonballs;

    canFire = false;
    setTimeout(() => {
        canFire = true;
    }, 1000); // 1-second cooldown between shots

    // Create a cannonball
    const geometry = new THREE.SphereGeometry(0.2, 16, 16); // Small sphere for the cannonball
    const material = new THREE.MeshBasicMaterial({ color: 0x000000 }); // Black cannonball
    const cannonball = new THREE.Mesh(geometry, material);

    // Set the initial position of the cannonball (from the ship)
    const cannonballPosition = ship.position.clone();
    cannonballPosition.y += 2; // Adjust to match the cannon's height
    cannonball.position.copy(cannonballPosition);

    // Calculate initial velocity based on ship's rotation
    const direction = new THREE.Vector3();
    ship.getWorldDirection(direction);
    direction.multiplyScalar(CANNONBALL_SPEED);

    const velocity = {
        x: direction.x ,
        y: 10, // Add an upward velocity for the arc
        z: direction.z ,
    };

    // Add the cannonball to the scene and track its velocity
    scene.add(cannonball);
    addMuzzleFlash(cannonballPosition);
    cannonballs.push({ object: cannonball, velocity, life: 0 });
}

function updateCannonballs(deltaTime) {
    for (let i = cannonballs.length - 1; i >= 0; i--) {
        const cannonballData = cannonballs[i];
        const { object, velocity } = cannonballData;

        // Update velocity (gravity affects the Y-component)
        velocity.y += GRAVITY * deltaTime;

        // Update position based on velocity
        object.position.x += velocity.x * deltaTime;
        object.position.y += velocity.y * deltaTime;
        object.position.z += velocity.z * deltaTime;

        // Remove the cannonball if it goes below the ground or exceeds its lifespan
        cannonballData.life += deltaTime;
        if (object.position.y < 0 || cannonballData.life > CANNONBALL_LIFESPAN) {
            scene.remove(object);
            cannonballs.splice(i, 1); // Remove from the array
        }
    }
    // Enemy cannonballs
    for (let i = enemyCannonballs.length - 1; i >= 0; i--) {
        const cannonballData = enemyCannonballs[i];
        const { object, velocity } = cannonballData;

        // Apply gravity
        velocity.y += GRAVITY * deltaTime;

        // Update position based on velocity
        object.position.x += velocity.x * deltaTime;
        object.position.y += velocity.y * deltaTime;
        object.position.z += velocity.z * deltaTime;

        // Remove the cannonball if it goes below the ground or exceeds its lifespan
        cannonballData.life += deltaTime;
        if (object.position.y < 0 || cannonballData.life > CANNONBALL_LIFESPAN) {
            scene.remove(object);
            enemyCannonballs.splice(i, 1);
        }
    }
}
function addMuzzleFlash(position) {
    const flash = new THREE.PointLight(0xffaa00, 2, 10);
    flash.position.copy(position);
    scene.add(flash);

    setTimeout(() => {
        scene.remove(flash); // Remove after 0.1 seconds
    }, 100);
}
function getRandomPosition() {
    const x = Math.random() * (playArea.xMax - playArea.xMin) + playArea.xMin;
    const z = Math.random() * (playArea.zMax - playArea.zMin) + playArea.zMin;
    return new THREE.Vector3(x, 1, z); // Enemies spawn at ground level (Y = 0)
}
async function spawnEnemyShips(numShips) {
    for (let i = 0; i < numShips; i++) {
        const position = getRandomPosition(); // Get a random position
        await spawnEnemyShip(position); // Spawn an enemy ship
    }
    console.log(`${numShips} enemy ships spawned.`);
}
function spawnEnemyShip(position) {
    const loader = new GLTFLoader();

    return new Promise((resolve, reject) => {
        loader.load(
            'textures/bad_pirate_ship.glb', // Path to the enemy ship model
            (gltf) => {
                const enemyShipModel = gltf.scene.clone();

                // Set the enemy ship's initial position and scale
                enemyShipModel.position.copy(position);
                enemyShipModel.position.setY(1.5);
                enemyShipModel.scale.set(0.002, 0.002, 0.002); // Adjust scale as needed
                enemyShipModel.rotation.y = Math.PI;

                // Add the enemy ship to the scene
                scene.add(enemyShipModel);
                const enemyShip = {
                    object: enemyShipModel,
                    enemyVelocity: new THREE.Vector3(0, 0, 0),
                    behavior: 'wander', // Default behavior
                    target: null, // Current movement target
                    fireCooldown: 3, // Track cooldown for firing
                    health: 10, // Enemy ship starts with 50 health
                };

                enemyShips.push(enemyShip); // Track the enemy ship
                resolve(enemyShip);
            },
            undefined,
            (error) => {
                console.error('Error loading enemy ship:', error);
                reject(error);
            }
        );
    });
}


function updateEnemyMovement(playerPosition, delta) {
    enemyShips.forEach((enemy) => {
        if (Math.random() < 0.005) {
            // Randomly switch behavior
            enemy.behavior = Math.random() > 0.5 ? 'patrol' : 'chase';
        }
        if (enemy.fireCooldown > 0) {
            enemy.fireCooldown -= delta;
        }
        const distanceToPlayer = enemy.object.position.distanceTo(playerPosition);
        if (distanceToPlayer < ENEMY_FIRE_DISTANCE) {
            enemyFireCannonball(enemy, playerPosition, delta);
        }

        switch (enemy.behavior) {
            case 'patrol':
                patrolMovement(enemy, delta);
                break;
            case 'chase':
                chasePlayer(enemy, playerPosition, delta);
                break;
            case 'wander':
                wanderMovement(enemy, delta);
                break;
        }
    });
}

function patrolMovement(enemy, delta) {
    if (!enemy.target) {
        enemy.target = getRandomPosition();
        enemy.target.y = enemy.object.position.y; // Ensure target is on the same plane
    }

    const direction = enemy.target.clone().sub(enemy.object.position);
    const angleToTarget = Math.atan2(direction.x, direction.z)+ Math.PI; // Calculate angle to target
    const currentAngle = enemy.object.rotation.y;
    const angleDifference = angleToTarget - currentAngle;

    // Gradually rotate toward the target
    enemy.object.rotation.y += Math.sign(angleDifference) * Math.min(Math.abs(angleDifference), 0.02);

    // Move forward in the direction the ship is facing
    enemy.object.translateZ(-3 * delta); // Speed = 3 units/second

    if (enemy.object.position.distanceTo(enemy.target) < 1) {
        enemy.target = null; // Reached target, pick a new one
    }
}

function chasePlayer(enemy, playerPosition, delta) {
    // Calculate direction to the player on the XZ plane
    const direction = playerPosition.clone().sub(enemy.object.position);
    direction.y = 0; // Ignore Y-axis for chasing
    const angleToPlayer = Math.atan2(direction.x, direction.z)+ Math.PI; // Calculate angle to player
    const currentAngle = enemy.object.rotation.y;
    const angleDifference = angleToPlayer - currentAngle;

    // Gradually rotate toward the player
    enemy.object.rotation.y += Math.sign(angleDifference) * Math.min(Math.abs(angleDifference), 0.03);

    // Move forward in the direction the ship is facing
    enemy.object.translateZ(-5 * delta); // Speed = 5 units/second
}

function wanderMovement(enemy, delta) {
    if (!enemy.target || Math.random() < 0.01) {
        enemy.target = getRandomPosition();
        enemy.target.y = enemy.object.position.y; // Ensure target is on the same plane
    }

    const direction = enemy.target.clone().sub(enemy.object.position);
    const angleToTarget = Math.atan2(direction.x, direction.z) + Math.PI; // Calculate angle to target
    const currentAngle = enemy.object.rotation.y;
    const angleDifference = angleToTarget - currentAngle;

    // Gradually rotate toward the target
    enemy.object.rotation.y += Math.sign(angleDifference) * Math.min(Math.abs(angleDifference), 0.015) ;

    // Move forward in the direction the ship is facing
    enemy.object.translateZ(-2 * delta); // Speed = 2 units/second

    if (enemy.object.position.distanceTo(enemy.target) < 1) {
        enemy.target = null; // Reached target, pick a new one
    }
}

function enemyFireCannonball(enemy, playerPosition, delta) {
    // Prevent firing if cooldown is active
    // Prevent firing if cooldown is active
    if (enemy.fireCooldown > 0) return;

    // Create a cannonball
    const geometry = new THREE.SphereGeometry(0.2, 16, 16); // Small sphere for the cannonball
    const material = new THREE.MeshBasicMaterial({ color: 0x000000 }); // Red cannonball
    const cannonball = new THREE.Mesh(geometry, material);

    // Set the initial position of the cannonball (from the enemy ship)
    const cannonballPosition = enemy.object.position.clone();
    cannonballPosition.y += 2; // Adjust to match the cannon's height
    cannonball.position.copy(cannonballPosition);

    // Calculate direction toward the player
    const direction = playerPosition.clone().sub(enemy.object.position).normalize();

    // Calculate velocity
    const velocity = {
        x: direction.x * CANNONBALL_SPEED,
        y: 5, // Account for height difference
        z: direction.z * CANNONBALL_SPEED,
    };

    // Add the cannonball to the scene and track it
    scene.add(cannonball);
    enemyCannonballs.push({ object: cannonball, velocity, life: 0 });

    // Set cooldown
    enemy.fireCooldown = ENEMY_FIRE_COOLDOWN;

    // Add a muzzle flash for effect
    addMuzzleFlash(cannonballPosition);
}
function handlePlayerDefeat() {
    alert("Game Over! You've been defeated.");
    // Optionally reload the game or reset health
    gameState.health = 100;
    // Reset any other game-related states
}
function createExplosion(position) {
    const particleCount = 100; // Number of particles in the explosion

    // Create positions for particles
    const positions = new Float32Array(particleCount * 3); // Each particle has x, y, z
    for (let i = 0; i < particleCount; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 2; // X
        positions[i * 3 + 1] = (Math.random() - 0.5) * 2; // Y
        positions[i * 3 + 2] = (Math.random() - 0.5) * 2; // Z
    }

    // Create BufferGeometry and set the position attribute
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    // Create material
    const material = new THREE.PointsMaterial({
        color: 0xff5500, // Bright orange for fire
        size: 0.2, // Size of each particle
        transparent: true,
        opacity: 1.0,
    });

    // Create Points object for explosion particles
    const particleSystem = new THREE.Points(geometry, material);
    particleSystem.position.copy(position);

    // Add particle system to the scene
    scene.add(particleSystem);

    // Fade out particles over time
    let life = 1.0; // Explosion lifespan in seconds
    const interval = setInterval(() => {
        life -= 0.1; // Reduce lifespan
        material.opacity = Math.max(0, life); // Fade out

        if (life <= 0) {
            clearInterval(interval);
            scene.remove(particleSystem); // Remove particles from scene
        }
    }, 100); // Update every 100ms
}
function createShipExplosion(position) {
    const sphereCount = 10; // Number of spheres in the explosion
    const spheres = [];
    const colors = [0xff5500, 0xffa500, 0xffd700, 0xffffff]; // Warm colors ending in white

    // Create the spheres
    for (let i = 0; i < sphereCount; i++) {
        const geometry = new THREE.SphereGeometry(5, 16, 16);
        const material = new THREE.MeshBasicMaterial({ color: colors[Math.floor(Math.random() * colors.length)], transparent: true, opacity: 1 });
        const sphere = new THREE.Mesh(geometry, material);

        // Set random initial position around the explosion center
        sphere.position.set(
            position.x + (Math.random() - 0.5) * 2,
            position.y + (Math.random() - 0.5) * 2,
            position.z + (Math.random() - 0.5) * 2
        );

        scene.add(sphere);
        spheres.push({ object: sphere, material, scaleSpeed: Math.random() * 0.05 + 0.05 });
    }

    // Animate the spheres
    let life = 1.5; // Explosion lifespan in seconds
    const interval = setInterval(() => {
        life -= 0.1; // Decrease lifespan
        spheres.forEach(({ object, material, scaleSpeed }) => {
            // Gradually enlarge the sphere
            object.scale.x += scaleSpeed;
            object.scale.y += scaleSpeed;
            object.scale.z += scaleSpeed;

            // Fade to white and reduce opacity
            material.color.lerp(new THREE.Color(0xffffff), 0.1); // Blend color toward white
            material.opacity = Math.max(0, material.opacity - 0.1); // Fade out
        });

        if (life <= 0) {
            // Cleanup: Remove spheres from the scene
            spheres.forEach(({ object }) => {
                scene.remove(object);
            });
            clearInterval(interval);
            // Spawn multiple planes with textures after the explosion
            const texturePath = getNextExplosionTexture();
            createMultipleExplosionPlanes(position, texturePath);
        }
    }, 100); // Update every 100ms
}
function createMultipleExplosionPlanes(position, texturePath) {
    const loader = new THREE.TextureLoader();

    loader.load(
        texturePath,
        (texture) => {
            // Remove the current plane if it exists
            if (currentExplosionPlane) {
                scene.remove(currentExplosionPlane);
                currentExplosionPlane = null;
            }

            const geometry = new THREE.PlaneGeometry(5, 5); // Size of the plane
            const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
            const plane = new THREE.Mesh(geometry, material);

            // Position the plane at the explosion site
            plane.position.copy(position);
            plane.position.y += 2; // Adjust height to appear above the ground

            // Rotate the plane to face the camera
            plane.lookAt(camera.position);

            // Add the plane to the scene
            scene.add(plane);
            currentExplosionPlane = plane; // Store the reference

            // Optionally remove the plane after a few seconds
            setTimeout(() => {
                if (currentExplosionPlane === plane) {
                    scene.remove(plane);
                    currentExplosionPlane = null; // Clear the reference
                }
            }, 5000); // Remove after 5 seconds
        },
        undefined,
        (error) => {
            console.error('Error loading texture:', error);
        }
    );
}
function getNextExplosionTexture() {
    const texturePath = explosionTextures[explosionTextureIndex]; // Get the current texture
    explosionTextureIndex = (explosionTextureIndex + 1) % explosionTextures.length; // Move to the next, looping if necessary
    return texturePath;
}
function spawnRocks(count, texturePath) {
    const loader = new GLTFLoader();

    for (let i = 0; i < count; i++) {
        loader.load(
            texturePath,
            (gltf) => {
                const rock = gltf.scene.clone();

                // Set random position for the rock
                rock.position.set(
                    Math.random() * (playArea.xMax - playArea.xMin) + playArea.xMin, // Random X within bounds
                    0, // Ensure the rock sits on the ground
                    Math.random() * (playArea.zMax - playArea.zMin) + playArea.zMin  // Random Z within bounds
                );

                // Adjust scale if needed
                const scale = Math.random() * 1.5 + 0.5;
                rock.scale.set(scale, scale , scale); // Scale up the rock to an appropriate size

                scene.add(rock);
                rocks.push(rock); // Add to rocks array
            },
            undefined,
            (error) => {
                console.error('Error loading rock model:', error);
            }
        );
    }
}
function onAllEnemiesDestroyed() {
    alert("Congratulations! You've defeated all the ships!");
    const pdfUrl = 'textures/Jessie_Fehrenbach_best1.pdf';
    window.open(pdfUrl, '_blank');
}