/*
controls
---
move: arrow keys
pause: "p" key
*/

const settings = {
	surfaceSize: 10000,
	lowestAltitude: 0.9,
	orbitControlsEnabled: false,
	showDebugControls: false,
};

const state = {
	speed: 10,
	direction: new THREE.Vector3(-1, 0, 0),
	turnAxis: new THREE.Vector3(0, 1, 0),
	isPressedUp: false,
	isPressedDown: false,
	isPressedRight: false,
	isPressedLeft: false,
	isPaused: false,
};

const axes = {
	x: new THREE.Vector3(1, 0, 0),
	y: new THREE.Vector3(0, 1, 0),
	z: new THREE.Vector3(0, 0, 1),
};

const DIRECTIONS = {
	LEFT: 1,
	CENTER: 0,
	RIGHT: -1,
	UP: 1,
	DOWN: -1,
};

const flightSimContainer = document.querySelector('.flight_sim_container');
const pausedOverlay = document.querySelector('.paused');
const canvas = document.querySelector('.flight_sim_canvas');
let gui;
if (settings.showDebugControls) {
	gui = new lil.GUI();
}




// ************************************************
// Textures
// ************************************************

const textureLoader = new THREE.TextureLoader();

const skyTexture = textureLoader.load('https://assets.codepen.io/246719/sky_tile_seamless.jpg');
skyTexture.mapping = THREE.EquirectangularReflectionMapping;

const grassTexture = textureLoader.load('https://assets.codepen.io/246719/Stylized_Grass_003_basecolor.jpg');
grassTexture.repeat.set(settings.surfaceSize / 2, settings.surfaceSize / 2);
grassTexture.wrapS = THREE.RepeatWrapping;
grassTexture.wrapT = THREE.RepeatWrapping;





// ************************************************
// Scene
// ************************************************
const scene = new THREE.Scene();
scene.background = skyTexture;




// ************************************************
// Sizes
// ************************************************
const dimensions = flightSimContainer.getBoundingClientRect();
const sizes = {
	width: dimensions.width,
	height: dimensions.height,
};
window.addEventListener('resize', () => {
	const newDimensions = flightSimContainer.getBoundingClientRect();
	sizes.width = newDimensions.width;
	sizes.height = newDimensions.height;
	camera.aspect = sizes.width / sizes.height;
	camera.updateProjectionMatrix();
	renderer.setSize(sizes.width, sizes.height);
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
});




// ************************************************
// Models
// ************************************************

/*
"Boeing787" (https://skfb.ly/YO66) by manilov.ap is licensed under Creative Commons Attribution (http://creativecommons.org/licenses/by/4.0/).

Modified in https://threejs.org/editor/
*/
const airplane = new THREE.Group();
airplane.position.y = settings.lowestAltitude;
airplane.rotation.y = 0.5 * Math.PI;
const rollBox = new THREE.Group();

let airplaneModel = {};
const gltfLoader = new THREE.GLTFLoader();
gltfLoader.load(
	'https://assets.codepen.io/246719/airplane.gltf',
	(gltf) => {
		const scale = 0.2;
		airplaneModel = gltf.scene;
		airplaneModel.rotation.y = Math.PI * -0.5;
		airplaneModel.position.set(0, -1.12, 0);
		airplaneModel.scale.set(scale, scale, scale);
		rollBox.add(airplaneModel);
	}
);
airplane.add(rollBox);
scene.add(airplane);

gui?.add(rollBox.rotation, 'x').name('pitch').min(-Math.PI).max(Math.PI);
gui?.add(rollBox.rotation, 'z').name('roll').min(-Math.PI).max(Math.PI);





// ************************************************
// Ground
// ************************************************

const surfaceMaterial = new THREE.MeshStandardMaterial();
surfaceMaterial.map = grassTexture;

const surface = new THREE.Mesh(
	new THREE.PlaneGeometry(settings.surfaceSize, settings.surfaceSize),
	surfaceMaterial
);
surface.position.y = -0.5;
surface.rotation.x = Math.PI * -0.5;

scene.add(surface);




const trackMaterial = new THREE.MeshStandardMaterial();
trackMaterial.color.set(0x000004);
const trackHeight = -0.3;


const edgeMaterial = new THREE.MeshStandardMaterial();
edgeMaterial.color.set(0xdddddd);

function buildStraightaway({ width, length, rotation, x, z }) {
	const track = new THREE.Group();
	const edgeWidth = 1;

	const pavement = new THREE.Mesh(
		new THREE.PlaneGeometry(width, length),
		trackMaterial
	);
	const edges = [
		new THREE.Mesh(
			new THREE.PlaneGeometry(edgeWidth, length),
			edgeMaterial
		),
		new THREE.Mesh(
			new THREE.PlaneGeometry(edgeWidth, length),
			edgeMaterial
		),
	];
	edges[0].position.x = (width - edgeWidth) / 2;
	edges[0].position.z = 0.1;
	edges[1].position.x = -(width - edgeWidth) / 2;
	edges[1].position.z = 0.1;
	
	track.position.y = trackHeight;
	track.rotation.x = Math.PI * -0.5;
	track.position.x = x;
	track.position.z = z;
	track.rotation.z = rotation * Math.PI * 2;
	
	track.add(pavement, ...edges);

	return track;
}

function buildCurve({ width, rotation, radiusInner, arcSweep, x, z }) {
	const track = new THREE.Group();
	const radiusOuter = radiusInner + width;
	const curveSegments = 50;
	const curveLength = Math.PI * 2 * arcSweep;
	const edgeWidth = 1;

	const pavement = new THREE.Mesh(
		new THREE.RingGeometry(radiusInner, radiusOuter, curveSegments, 1, 0, curveLength),
		trackMaterial
	);

	const edges = [
		new THREE.Mesh(
			new THREE.RingGeometry(radiusInner, radiusInner + edgeWidth, curveSegments, 1, 0, curveLength),
			edgeMaterial
		),
		new THREE.Mesh(
			new THREE.RingGeometry(radiusOuter - edgeWidth, radiusOuter, curveSegments, 1, 0, curveLength),
			edgeMaterial
		),
	];
	edges[0].position.z = 0.1;
	edges[1].position.z = 0.1;	
	
	track.position.y = trackHeight;
	track.rotation.x = Math.PI * -0.5;
	track.position.x = x;
	track.position.z = z;
	track.rotation.z = rotation * Math.PI * 2;

	track.add(pavement, ...edges);
	return track;
}

const trackSegments = [
	buildStraightaway({ width: 20, length: 200, rotation: 0.25, x: 0, z: 0 }),
	buildStraightaway({ width: 20, length: 200, rotation: 0.25, x: 0, z: 80 }),
	buildCurve({ width: 20, rotation: 0.25, radiusInner: 30, arcSweep: 0.5, x: -100, z: 40 }),
	buildCurve({ width: 20, rotation: -0.25, radiusInner: 30, arcSweep: 0.5, x: 100, z: 40 }),
];

scene.add(...trackSegments);














// ************************************************
// Lights
// ************************************************
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const pointLight = new THREE.PointLight(0xffffff, 0.5);
pointLight.position.set(2, 3, 4);
scene.add(pointLight);





// ************************************************
// Camera
// ************************************************
const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.1, 1000);
const getCameraLookTarget = () => {
	return new THREE.Vector3(
		airplane.position.x,
		airplane.position.y + 2,
		airplane.position.z,
	);
};
const cameraHeight = 1.6;
camera.position.set(0, cameraHeight, 12);
camera.lookAt(getCameraLookTarget());
airplane.add(camera);

gui?.add(camera.position, 'x').name('Camera x pos').min(-1).max(2).step(0.1);
gui?.add(camera.position, 'y').name('Camera y pos').min(-1).max(20).step(0.1);

let orbitControls;
if (settings.orbitControlsEnabled) {
	orbitControls = new THREE.OrbitControls(camera, canvas);
}






// ************************************************
// Renderer
// ************************************************
const renderer = new THREE.WebGLRenderer({
	canvas,
});

renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputEncoding = THREE.sRGBEncoding;

renderer.render(scene, camera);






// ************************************************
// Movement
// ************************************************

function move(timeInterval) {
	if (!airplaneModel?.position) { return; }

	const copyOfDirection = Object.create(state.direction);
	const speedScalar = state.speed * timeInterval;
	const velocity = copyOfDirection.multiplyScalar(speedScalar);

	airplane.position.add(velocity);
	camera.lookAt(getCameraLookTarget());
}

function roll({ direction, amount = 0.3 }) {
	gsap.to(rollBox.rotation, { duration: 0.5, z: direction * amount });
	gsap.to(camera.position, { duration: 0.5, x: direction * -1 });
}
function resetRoll() {
	roll({ direction: DIRECTIONS.CENTER, amount: 0 });
	gsap.to(camera.position, { duration: 0.5, x: 0 });
}

function pitch({ direction, amount = 0.3 }) {
	gsap.to(rollBox.rotation, { duration: 1, x: direction * amount });
	gsap.to(camera.position, { duration: 1, y: cameraHeight + direction * -2 });
}
function resetPitch() {
	pitch({ direction: DIRECTIONS.CENTER, amount: 0 });
	gsap.to(camera.position, { duration: 1, y: cameraHeight });
}

function turn({ direction }) {
	const turnAngle = 0.005 * direction;
	state.direction.applyAxisAngle(axes.y, turnAngle);
	airplane.rotation.y += turnAngle;
}

function changeAltitude({ direction }) {
	const isGoingTooLow = (
		direction === DIRECTIONS.DOWN &&
		airplane.position.y <= settings.lowestAltitude
	);
	if (isGoingTooLow) {
		resetPitch();
		return;
	}
	const change = 0.1 * direction;
	airplane.position.y += change;
}

function updateTurn() {
	if (state.isPressedRight) {		
		turn({ direction: DIRECTIONS.RIGHT });
	}
	if (state.isPressedLeft) {
		turn({ direction: DIRECTIONS.LEFT });
	}
	if (state.isPressedUp) {
		changeAltitude({ direction: DIRECTIONS.DOWN })
	}
	if (state.isPressedDown) {
		changeAltitude({ direction: DIRECTIONS.UP })
	}
}

function isAirplaneOnGround() {
	return airplane.position.y <= settings.lowestAltitude;
}


// ************************************************
// Controls
// ************************************************
function pause() {
	state.isPaused = true;
	pausedOverlay.classList.add('paused--visible');
	clock.stop();
}
function unpause() {
	state.isPaused = false;
	pausedOverlay.classList.remove('paused--visible');
	clock.start();
	tick();
}
function togglePause() {
	if (state.isPaused) { unpause(); }
	else { pause(); }
}

window.addEventListener('keydown', (e) => {
	if (e.repeat) { return; }

	if (e.key === 'ArrowRight') {
		state.isPressedRight = true;
		if (!isAirplaneOnGround()) {
			roll({ direction: DIRECTIONS.RIGHT });
		}
	}
	else if (e.key === 'ArrowLeft') {
		state.isPressedLeft = true;
		if (!isAirplaneOnGround()) {
			roll({ direction: DIRECTIONS.LEFT });
		}
	}
	else if (e.key === 'ArrowUp') {
		state.isPressedUp = true;
		pitch({ direction: DIRECTIONS.DOWN });
	}
	else if (e.key === 'ArrowDown') {
		state.isPressedDown = true;
		pitch({ direction: DIRECTIONS.UP });
	}
	else if (e.key === 'p') {
		togglePause();
	}
});

window.addEventListener('keyup', (e) => {
	if (e.key === 'ArrowRight') {
		state.isPressedRight = false;
		resetRoll();
	}
	else if (e.key === 'ArrowLeft') {
		state.isPressedLeft = false;
		resetRoll();
	}
	else if (e.key === 'ArrowUp') {
		state.isPressedUp = false;
		resetPitch();
	}
	else if (e.key === 'ArrowDown') {
		state.isPressedDown = false;
		resetPitch();
	}
});




// ************************************************
// Timer loop
// ************************************************

const clock = new THREE.Clock();
function tick() {
	if (state.isPaused) { return; }
	window.requestAnimationFrame(tick);
	const timeInterval = clock.getDelta();

	move(timeInterval);
	updateTurn();

	if (settings.orbitControlsEnabled) {
		orbitControls.update();
	}
	renderer.render(scene, camera);
};
tick();



gui?.add(settings, 'lowestAltitude').name('bottom').min(0).max(2);