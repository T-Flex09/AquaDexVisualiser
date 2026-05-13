// ==========================================
// ====== VARIABILE GLOBALE & UI ============
// ==========================================

let chartInstance = null;
let fullTimeData = [];
let fullDatasetsData = {};

let currentIndex = 0;
const WINDOW_SIZE = 50;
let isPlaying = false;
let playInterval = null;
let playbackSpeed = 1.0;

const colors = [
	"#ff0000",
	"#ff7f00",
	"#ffd400",
	"#ffff00",
	"#bfff00",
	"#00eaff",
	"#0095ff",
	"#0040ff",
	"#aa00ff",
	"#edb9b9",
	"#ff6666",
	"#800000",
	"#008080",
	"#000075",
	"#a9a9a9",
	"#bf4f51",
	"#9a6324",
	"#e6beff",
	"#469990",
	"#f032e6",
	"#bfef45",
	"#fabed4",
	"#3cb44b",
	"#e6194b",
];

// ==========================================
// ====== VARIABILE THREE.JS ================
// ==========================================

let scene, camera, renderer, submarine, submarinePitchRoll, controls;
let oceanFloor;
let submarineLabel;
let is3DMode = false;
let submarinePathCurve;
let visualProgress = 0;
let pathBounds = { minX: 0, maxX: 0, minZ: 0, maxZ: 0, minY: 0, maxY: 0 };
let pathCenter = new THREE.Vector3(0, 0, 0);
const WORLD_SCALE = 15;

// Date din CSV pentru vizualizare
let csvPitchData = [];
let csvRollData = [];
let csvYawData = [];
let csvXData = [];
let csvYData = [];
let csvZData = [];
let csvMotorStgData = [];
let csvMotorDrData = [];
let csvMotorTopData = [];

// ==========================================
// ====== HELPERE & GRAFIC ==================
// ==========================================

function getLegendIdForColumn(colName) {
	let nume = colName.trim().toLowerCase();

	if (
		nume.includes("dist") ||
		nume.includes("d_") ||
		["fata", "spate", "stanga", "dreapta", "jos"].some((d) => nume.includes(d))
	) {
		return "legend_distante";
	}
	if (nume.includes("temp")) {
		return "legend_temperatura";
	}
	if (nume.includes("ph")) {
		return "legend_ph";
	}
	if (nume.includes("tds") || nume.includes("puritate")) {
		return "legend_puritate_tds";
	}
	if (nume.includes("turbiditate") || nume.includes("ntu")) {
		return "legend_turbiditate";
	}

	if (nume.includes("acc") || nume.includes("accel")) {
		return "legend_acc";
	}
	if (
		nume.includes("gyro") ||
		nume.includes("giro") ||
		nume.includes("heading") ||
		nume.includes("yaw") ||
		nume.includes("pitch") ||
		nume.includes("roll")
	) {
		return "legend_gyro";
	}
	if (["x", "y", "z"].includes(nume) || nume.includes("pos")) {
		return "legend_distante";
	}
	if (nume.includes("m_") || nume.includes("motor")) {
		return "legend_distante";
	}
	if (nume.includes("bat") || nume.includes("stare")) {
		return "legend_distante";
	}

	return "legend_" + nume.replace(/[^a-z]/g, "");
}

function updateThemeSmoothly() {
	let style = getComputedStyle(document.documentElement);
	let textColor = style.getPropertyValue("--text-color").trim();
	let gridColorCss = style.getPropertyValue("--border-color").trim();

	if (chartInstance) {
		chartInstance.options.color = textColor;
		chartInstance.options.scales.x.title.color = textColor;
		chartInstance.options.scales.x.ticks.color = textColor;
		chartInstance.options.scales.x.grid.color = gridColorCss;
		chartInstance.options.scales.x.grid.tickColor = gridColorCss;
		chartInstance.options.scales.y.title.color = textColor;
		chartInstance.options.scales.y.ticks.color = textColor;
		chartInstance.options.scales.y.grid.color = gridColorCss;
		chartInstance.options.scales.y.grid.tickColor = gridColorCss;

		if (chartInstance.options.plugins && chartInstance.options.plugins.legend) {
			chartInstance.options.plugins.legend.labels.color = textColor;
		}

		chartInstance.options.animation = { duration: 500 };
		chartInstance.update();

		setTimeout(() => {
			if (chartInstance) chartInstance.options.animation = false;
		}, 500);
	}

	if (scene) {
		scene.background = new THREE.Color(
			document.documentElement.classList.contains("light-mode") ? 0x87ceeb : 0x0067ff,
		);
	}
}

function updateChart(recreate = false) {
	if (fullTimeData.length === 0) return;

	const ctx = document.getElementById("myChart").getContext("2d");
	let checkboxes = document.querySelectorAll('#data_selection input[type="checkbox"]:checked');
	let selectedColumns = Array.from(checkboxes).map((cb) => cb.value);

	let startIdx = Math.max(0, currentIndex - WINDOW_SIZE + 1);
	let windowTimeData = fullTimeData.slice(startIdx, currentIndex + 1);

	let activeDatasets = selectedColumns.map((colName, index) => {
		return {
			label: colName,
			data: fullDatasetsData[colName]
				? fullDatasetsData[colName].slice(startIdx, currentIndex + 1)
				: [],
			borderColor: colors[index % colors.length],
			backgroundColor: colors[index % colors.length],
			borderWidth: 2,
			tension: 0.3,
			pointRadius: 1,
			fill: false,
		};
	});

	if (chartInstance && !recreate) {
		chartInstance.data.labels = windowTimeData;
		chartInstance.data.datasets = activeDatasets;
		chartInstance.update("none");
		return;
	}

	if (chartInstance) chartInstance.destroy();

	let style = getComputedStyle(document.documentElement);
	let textColor = style.getPropertyValue("--text-color").trim();
	let gridColorCss = style.getPropertyValue("--border-color").trim();

	chartInstance = new Chart(ctx, {
		type: "line",
		data: { labels: windowTimeData, datasets: activeDatasets },
		options: {
			responsive: true,
			maintainAspectRatio: false,
			color: textColor,
			animation: false,
			interaction: {
				intersect: false,
				mode: "index",
			},
			scales: {
				x: {
					title: { display: true, text: "Time (s)", color: textColor },
					ticks: { color: textColor, maxTicksLimit: 10 },
					grid: { color: gridColorCss, tickColor: gridColorCss, drawBorder: false },
				},
				y: {
					title: { display: true, text: "Value", color: textColor },
					ticks: { color: textColor },
					grid: { color: gridColorCss, tickColor: gridColorCss, drawBorder: false },
				},
			},
			plugins: {
				legend: {
					labels: { color: textColor, maxColumns: 3 },
					position: "bottom",
				},
				tooltip: {
					enabled: true,
					mode: "index",
					intersect: false,
				},
			},
		},
	});
}

// ==========================================
// ====== PROCESARE DATE DIN CSV ============
// ==========================================

function generateSubmarinePathAndFilterSensors() {
	if (fullTimeData.length === 0) return;

	const findData = (keywords) => {
		const keys = Object.keys(fullDatasetsData);
		for (let k of keys) {
			let lowerK = k.toLowerCase();
			if (keywords.some((word) => lowerK.includes(word))) return fullDatasetsData[k];
		}
		return null;
	};

	csvXData = findData(["x", "pos_x"]) || [];
	csvYData = findData(["y", "pos_y"]) || [];
	csvZData = findData(["z", "pos_z"]) || [];
	csvPitchData = findData(["pitch"]) || [];
	csvRollData = findData(["roll"]) || [];
	csvYawData = findData(["heading", "yaw"]) || [];
	csvMotorStgData = findData(["m_stg"]) || [];
	csvMotorDrData = findData(["m_dr"]) || [];
	csvMotorTopData = findData(["m_top"]) || [];

	pathBounds = {
		minX: Infinity,
		maxX: -Infinity,
		minZ: Infinity,
		maxZ: -Infinity,
		minY: Infinity,
		maxY: -Infinity,
	};

	for (let i = 0; i < csvXData.length; i++) {
		let x = csvXData[i] || 0;
		let y = csvYData[i] || 0;
		let z = csvZData[i] || 0;

		pathBounds.minX = Math.min(pathBounds.minX, x);
		pathBounds.maxX = Math.max(pathBounds.maxX, x);
		pathBounds.minY = Math.min(pathBounds.minY, y);
		pathBounds.maxY = Math.max(pathBounds.maxY, y);
		pathBounds.minZ = Math.min(pathBounds.minZ, z);
		pathBounds.maxZ = Math.max(pathBounds.maxZ, z);
	}

	if (pathBounds.maxX === -Infinity) {
		pathBounds = { minX: -100, maxX: 100, minZ: -100, maxZ: 100, minY: -50, maxY: 50 };
	}

	let rawPoints = [];
	for (let i = 0; i < csvXData.length; i++) {
		let x = csvXData[i] || 0;
		let y = csvZData[i] || 0;
		let z = csvYData[i] || 0;
		rawPoints.push(new THREE.Vector3(x * WORLD_SCALE, -y * WORLD_SCALE, z * WORLD_SCALE));
	}

	if (rawPoints.length === 1) {
		rawPoints.push(rawPoints[0].clone().add(new THREE.Vector3(0, 0, 1)));
	}

	if (rawPoints.length > 1) {
		submarinePathCurve = new THREE.CatmullRomCurve3(rawPoints);
		submarinePathCurve.curveType = "centripetal";
		submarinePathCurve.tension = 0.1;
	}

	pathCenter.set(
		(pathBounds.minX + pathBounds.maxX) / 2,
		(pathBounds.minY + pathBounds.maxY) / 2,
		(pathBounds.minZ + pathBounds.maxZ) / 2,
	);

	if (is3DMode && submarine && submarinePathCurve) {
		visualProgress = 0;
		adjustCameraAndFloor();
	}

	console.log(`[3D] Traseu generat: ${rawPoints.length} puncte`);
}

// ==========================================
// ====== REPOZIȚIONARE CAMERĂ ȘI PODEA =====
// ==========================================

function adjustCameraAndFloor() {
	if (!scene) return;

	let pathWidth = pathBounds.maxX - pathBounds.minX;
	let pathDepth = pathBounds.maxZ - pathBounds.minZ;

	let paddingFactor = 1.5;
	let finalSizeX = Math.max(200, pathWidth * paddingFactor);
	let finalSizeZ = Math.max(200, pathDepth * paddingFactor);
	let gridSquareSize = Math.max(finalSizeX, finalSizeZ);

	if (oceanFloor) {
		let seabedY = -pathBounds.maxY;
		oceanFloor.position.set(
			pathCenter.x * WORLD_SCALE,
			seabedY * WORLD_SCALE,
			pathCenter.z * WORLD_SCALE,
		);
		oceanFloor.scale.set(gridSquareSize, gridSquareSize, gridSquareSize);
	}

	if (controls) {
		controls.target.set(
			pathCenter.x * WORLD_SCALE,
			pathCenter.y * WORLD_SCALE,
			pathCenter.z * WORLD_SCALE,
		);
		controls.update();
	}

	const ISO_ANGLE = 0.615;
	const cameraDistance = gridSquareSize * 0.5;

	camera.position.set(
		pathCenter.x * WORLD_SCALE + cameraDistance * Math.cos(ISO_ANGLE),
		pathCenter.y * WORLD_SCALE + cameraDistance * Math.sin(ISO_ANGLE),
		pathCenter.z * WORLD_SCALE + cameraDistance * Math.cos(ISO_ANGLE),
	);

	camera.lookAt(
		pathCenter.x * WORLD_SCALE,
		pathCenter.y * WORLD_SCALE,
		pathCenter.z * WORLD_SCALE,
	);

	if (controls) {
		controls.minPolarAngle = 0.3;
		controls.maxPolarAngle = 1.2;
		controls.minDistance = 0;
		controls.maxDistance = cameraDistance * 5;
	}
}

// ==========================================
// ====== HELPER: CREATOR NAME TAG ==========
// ==========================================

function createTextLabel(text) {
	const canvas = document.createElement("canvas");
	const context = canvas.getContext("2d");

	canvas.width = 512;
	canvas.height = 128;

	context.clearRect(0, 0, canvas.width, canvas.height);
	context.font = "bold 80px sans-serif";
	context.textAlign = "center";
	context.textBaseline = "middle";
	context.shadowColor = "rgba(0,0,0,0.8)";
	context.shadowBlur = 15;
	context.shadowOffsetX = 5;
	context.shadowOffsetY = 5;
	context.fillStyle = "#ffffff";
	context.fillText(text, canvas.width / 2, canvas.height / 2);

	const texture = new THREE.Texture(canvas);
	texture.needsUpdate = true;

	const spriteMaterial = new THREE.SpriteMaterial({
		map: texture,
		transparent: true,
		depthTest: false,
	});

	const sprite = new THREE.Sprite(spriteMaterial);
	sprite.scale.set(100, 30, 2.5);

	return sprite;
}

// ==========================================
// ====== LOGICA DE BAZĂ (UI & PLAYBACK) ====
// ==========================================

document.getElementById("file_input").addEventListener("change", (event) => {
	let file = event.target.files[0];
	if (!file) return;

	let reader = new FileReader();
	let dataSelectorDiv = document.getElementById("data_selection");
	dataSelectorDiv.innerHTML = "";

	reader.onload = (event) => {
		let csvText = event.target.result;
		let lines = csvText.trim().split(/\r?\n/);
		if (lines.length === 0) return;

		let headers = lines[0].split(",").map((h) => h.trim());

		fullTimeData = [];
		fullDatasetsData = {};
		for (let i = 1; i < headers.length; i++) {
			fullDatasetsData[headers[i]] = [];
		}

		for (let i = 1; i < lines.length; i++) {
			let currentLine = lines[i].split(",");
			if (currentLine.length >= headers.length) {
				fullTimeData.push(currentLine[0]);
				for (let j = 1; j < headers.length; j++) {
					let val = parseFloat(currentLine[j]);
					fullDatasetsData[headers[j]].push(isNaN(val) ? 0 : val);
				}
			}
		}

		generateSubmarinePathAndFilterSensors();

		for (let i = 1; i < headers.length; i++) {
			let colName = headers[i];
			let dataNode = document.createElement("div");
			dataNode.style.display = "flex";
			dataNode.style.alignItems = "center";

			let checkbox = document.createElement("input");
			checkbox.type = "checkbox";
			checkbox.value = colName;
			if (
				["pitch", "z", "d_fata", "m_stg", "temp", "ntu"].some((k) =>
					colName.toLowerCase().includes(k),
				)
			) {
				checkbox.checked = true;
			}
			checkbox.addEventListener("change", () => updateChart(true));

			let textSpan = document.createElement("span");
			textSpan.textContent = colName;
			textSpan.style.color = "var(--text-color)";
			textSpan.style.cursor = "pointer";
			textSpan.style.marginLeft = "8px";

			textSpan.addEventListener(
				"mouseenter",
				() => (textSpan.style.color = "var(--accent-color)"),
			);
			textSpan.addEventListener(
				"mouseleave",
				() => (textSpan.style.color = "var(--text-color)"),
			);

			textSpan.addEventListener("click", () => {
				let targetId = getLegendIdForColumn(colName);
				let targetEl = document.getElementById(targetId);

				if (targetEl) {
					document.querySelectorAll(".legend_item").forEach((el) => {
						el.style.backgroundColor = "";
					});

					targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
					targetEl.style.transition = "background-color 0.3s";
					targetEl.style.backgroundColor = "var(--accent-color)";

					setTimeout(() => {
						targetEl.style.backgroundColor = "";
					}, 500);
				}
			});

			dataNode.appendChild(checkbox);
			dataNode.appendChild(textSpan);
			dataSelectorDiv.appendChild(dataNode);
		}

		let timeline = document.getElementById("timeline");
		timeline.max = fullTimeData.length - 1;
		timeline.value = 0;
		currentIndex = 0;
		document.getElementById("playback_controls").style.display = "flex";

		updateChart(true);
	};
	reader.readAsText(file);
});

const playBtn = document.getElementById("play_btn");
const timeline = document.getElementById("timeline");
const timeDisplay = document.getElementById("time_display");

playBtn.addEventListener("click", () => {
	if (isPlaying) pausePlayback();
	else startPlayback();
});

timeline.addEventListener("input", (e) => {
	pausePlayback();
	currentIndex = parseInt(e.target.value);
	updateChart(false);
	updateHUD();
});

// ==========================================
// ====== FIX #2: PLAYBACK SPEED ============
// ==========================================

function startPlayback() {
	if (fullTimeData.length === 0) return;
	if (currentIndex >= fullTimeData.length - 1) currentIndex = 0;

	isPlaying = true;
	playBtn.innerText = "⏸ Pause";

	const playStep = () => {
		if (!isPlaying) return;

		if (currentIndex < fullTimeData.length - 1) {
			// Get current and next timestamp from CSV column 't'
			let currentTime = parseFloat(fullTimeData[currentIndex]);
			let nextTime = parseFloat(fullTimeData[currentIndex + 1]);

			// Calculate time delta in milliseconds
			let deltaMs = (nextTime - currentTime) * 1000;

			// Apply playback speed multiplier
			deltaMs = deltaMs / playbackSpeed;

			// Clamp between 10ms and 500ms for stability
			deltaMs = Math.max(10, Math.min(500, deltaMs));

			currentIndex++;
			timeline.value = currentIndex;
			updateChart(false);
			updateHUD();

			// Schedule next frame based on ACTUAL CSV timestamps
			setTimeout(playStep, deltaMs);
		} else {
			pausePlayback();
		}
	};

	playStep();
}

function pausePlayback() {
	isPlaying = false;
	playBtn.innerText = "▶ Play";
}

function updateHUD() {
	if (fullTimeData.length === 0) return;

	const findData = (keywords) => {
		const keys = Object.keys(fullDatasetsData);
		for (let k of keys) {
			if (keywords.some((word) => k.toLowerCase().includes(word))) {
				return fullDatasetsData[k][currentIndex] || 0;
			}
		}
		return 0;
	};

	const formatHUD = (val) => (val || 0).toFixed(2);

	let el_pitch = document.getElementById("hud_pitch");
	if (el_pitch) el_pitch.innerText = formatHUD(findData(["pitch"]));

	let el_roll = document.getElementById("hud_roll");
	if (el_roll) el_roll.innerText = formatHUD(findData(["roll"]));

	let el_yaw = document.getElementById("hud_yaw");
	if (el_yaw) el_yaw.innerText = formatHUD(findData(["heading", "yaw"]));

	let el_ax = document.getElementById("hud_ax");
	if (el_ax) el_ax.innerText = formatHUD(findData(["acc_x"]));

	let el_ay = document.getElementById("hud_ay");
	if (el_ay) el_ay.innerText = formatHUD(findData(["acc_y"]));

	let el_az = document.getElementById("hud_az");
	if (el_az) el_az.innerText = formatHUD(findData(["acc_z"]));

	let el_gx = document.getElementById("hud_gx");
	if (el_gx) el_gx.innerText = formatHUD(findData(["gyro_x"]));

	let el_gy = document.getElementById("hud_gy");
	if (el_gy) el_gy.innerText = formatHUD(findData(["gyro_y"]));

	let el_gz = document.getElementById("hud_gz");
	if (el_gz) el_gz.innerText = formatHUD(findData(["gyro_z"]));

	let el_m_stg = document.getElementById("hud_m_stg");
	if (el_m_stg) el_m_stg.innerText = Math.round(findData(["m_stg"]));

	let el_m_dr = document.getElementById("hud_m_dr");
	if (el_m_dr) el_m_dr.innerText = Math.round(findData(["m_dr"]));

	let el_m_top = document.getElementById("hud_m_top");
	if (el_m_top) el_m_top.innerText = Math.round(findData(["m_top"]));

	let el_x = document.getElementById("hud_x");
	if (el_x) el_x.innerText = formatHUD(findData(["x"]));

	let el_y = document.getElementById("hud_y");
	if (el_y) el_y.innerText = formatHUD(findData(["y"]));

	let el_z = document.getElementById("hud_z");
	if (el_z) el_z.innerText = formatHUD(findData(["z"]));

	if (timeDisplay) {
		timeDisplay.innerText = fullTimeData[currentIndex] + "s";
	}
}

// ==========================================
// ====== FIX #1: 3D VISUALIZER =============
// ==========================================

function initThreeJS() {
	const container = document.getElementById("three_container");
	if (!container) {
		console.error("[3D] Container not found!");
		return;
	}

	// Ensure container has dimensions
	container.style.width = "100%";
	container.style.height = "100%";
	container.style.position = "relative";

	scene = new THREE.Scene();
	scene.background = new THREE.Color(
		document.documentElement.classList.contains("light-mode") ? 0x87ceeb : 0x0067ff,
	);
	scene.fog = new THREE.Fog(scene.background, 500, 100000);

	camera = new THREE.PerspectiveCamera(
		45,
		container.clientWidth / container.clientHeight,
		0.1,
		100000,
	);
	camera.position.set(0, 0, 0); // Isometric starting position

	renderer = new THREE.WebGLRenderer({ antialias: true });
	renderer.setSize(container.clientWidth, container.clientHeight);
	renderer.setPixelRatio(window.devicePixelRatio);
	renderer.shadowMap.enabled = true;

	// Clear any existing canvas
	while (container.firstChild) {
		container.removeChild(container.firstChild);
	}
	container.appendChild(renderer.domElement);

	controls = new THREE.OrbitControls(camera, renderer.domElement);
	controls.enableDamping = true;
	controls.dampingFactor = 0.05;
	controls.maxPolarAngle = Math.PI * 2;

	// Lighting - CRITICAL for 3D to not be black
	const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
	scene.add(ambientLight);

	const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
	dirLight.position.set(100, 200, 100);
	dirLight.castShadow = true;
	scene.add(dirLight);

	const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.5);
	dirLight2.position.set(-100, 100, -100);
	scene.add(dirLight2);

	const loader = new THREE.GLTFLoader();

	// Load ocean floor (optional)
	loader.load(
		"fund_ocean.glb",
		function (gltf) {
			oceanFloor = gltf.scene;
			oceanFloor.traverse((child) => {
				if (child.isMesh) {
					child.material.transparent = true;
					child.material.opacity = 0.9;
					child.material.needsUpdate = true;
				}
			});
			scene.add(oceanFloor);
			console.log("[3D] Ocean floor loaded");

			if (submarinePathCurve) {
				adjustCameraAndFloor();
			}
		},
		undefined,
		function (error) {
			console.warn("[3D] Could not load fund_ocean.glb - continuing without ocean floor");
			// Create simple grid as fallback
			const gridHelper = new THREE.GridHelper(500, 50, 0x444444, 0x444444);
			gridHelper.position.y = -100;
			scene.add(gridHelper);
		},
	);

	// Load submarine
	submarine = new THREE.Group();
	scene.add(submarine);

	submarinePitchRoll = new THREE.Group();
	submarine.add(submarinePitchRoll);

	loader.load(
		"submarin.glb",
		function (gltf) {
			const model = gltf.scene;
			model.scale.set(0.05, 0.05, 0.05);
			model.traverse((child) => {
				if (child.isMesh) {
					child.material.needsUpdate = true;
					child.castShadow = true;
				}
			});
			submarinePitchRoll.add(model);
			console.log("[3D] Submarine model loaded");

			submarineLabel = createTextLabel("Aquadex");
			submarineLabel.position.set(0, 50, 0);
			submarine.add(submarineLabel);
		},
		undefined,
		function (error) {
			console.warn("[3D] Could not load submarin.glb - using fallback cube");
			// Fallback: visible cube
			const geometry = new THREE.BoxGeometry(20, 10, 40);
			const material = new THREE.MeshPhongMaterial({
				color: 0xffaa00,
				shininess: 100,
			});
			const cube = new THREE.Mesh(geometry, material);
			cube.castShadow = true;
			submarinePitchRoll.add(cube);
		},
	);

	if (submarinePathCurve) {
		visualProgress = 0;
		submarine.position.copy(submarinePathCurve.getPointAt(0));
		adjustCameraAndFloor();
	}

	// Animation loop
	function animate() {
		requestAnimationFrame(animate);
		update3DSubmarinePosition();
		if (controls) controls.update();
		renderer.render(scene, camera);
	}
	animate();

	// Handle resize
	window.addEventListener("resize", () => {
		if (!is3DMode) return;
		camera.aspect = container.clientWidth / container.clientHeight;
		camera.updateProjectionMatrix();
		renderer.setSize(container.clientWidth, container.clientHeight);
	});

	console.log("[3D] Three.js initialized successfully");
}

function update3DSubmarinePosition() {
	if (!submarine || fullTimeData.length === 0 || !submarinePathCurve) return;

	const targetProgress = currentIndex / (fullTimeData.length - 1);

	if (Math.abs(targetProgress - visualProgress) > 0.5) {
		visualProgress = targetProgress;
	} else {
		visualProgress += (targetProgress - visualProgress) * 0.1;
	}

	let safeProgress = Math.max(0.0001, Math.min(0.9999, visualProgress));

	const currentPos = submarinePathCurve.getPointAt(safeProgress);
	submarine.position.lerp(currentPos, 0.1);

	let nextPos = submarinePathCurve.getPointAt(Math.min(safeProgress + 0.01, 0.9999));
	let lookTarget = nextPos.clone();

	const dummyCompass = new THREE.Object3D();
	dummyCompass.position.copy(submarine.position);
	dummyCompass.lookAt(lookTarget);

	submarine.quaternion.slerp(dummyCompass.quaternion, 0.05);

	let targetPitch = csvPitchData[currentIndex] || 0;
	let targetRoll = csvRollData[currentIndex] || 0;

	if (submarinePitchRoll) {
		submarinePitchRoll.rotation.x +=
			((targetPitch * Math.PI) / 180 - submarinePitchRoll.rotation.x) * 0.1;
		submarinePitchRoll.rotation.z +=
			((-targetRoll * Math.PI) / 180 - submarinePitchRoll.rotation.z) * 0.1;
	}
}

// ==========================================
// ====== TOGGLE GRAFIC <-> 3D =============
// ==========================================

const viewToggleBtn = document.getElementById("view_toggle");
const graphDiv = document.getElementById("graph");
const threeDiv = document.getElementById("three_container");
const dataSelectionDiv = document.getElementById("data_selection");
const telemetryHud = document.getElementById("telemetry_hud");

if (viewToggleBtn) {
	viewToggleBtn.addEventListener("click", () => {
		is3DMode = !is3DMode;

		if (is3DMode) {
			viewToggleBtn.innerText = "📈 Vizualizare Grafic";

			if (graphDiv) graphDiv.style.display = "none";
			if (dataSelectionDiv) dataSelectionDiv.style.display = "none";

			if (threeDiv) threeDiv.style.display = "block";
			if (telemetryHud) telemetryHud.style.display = "flex";

			// Force resize after display change
			setTimeout(() => {
				if (!scene) initThreeJS();
				if (camera && renderer && threeDiv) {
					camera.aspect = threeDiv.clientWidth / threeDiv.clientHeight;
					camera.updateProjectionMatrix();
					renderer.setSize(threeDiv.clientWidth, threeDiv.clientHeight);
				}
			}, 100);
		} else {
			viewToggleBtn.innerText = "🌐 Vizualizare 3D";

			if (threeDiv) threeDiv.style.display = "none";
			if (telemetryHud) telemetryHud.style.display = "none";

			if (graphDiv) graphDiv.style.display = "block";
			if (dataSelectionDiv) dataSelectionDiv.style.display = "flex";
		}
	});
}

// ==========================================
// ====== THEME TOGGLE =====================
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
	const themeToggleBtn = document.getElementById("theme_toggle");
	const savedTheme = localStorage.getItem("theme");

	if (savedTheme === "light") {
		document.documentElement.classList.add("light-mode");
		if (themeToggleBtn) themeToggleBtn.innerText = "🌙 Dark Mode";
	} else {
		if (themeToggleBtn) themeToggleBtn.innerText = "☀️ Light Mode";
	}
});

const themeToggleBtn = document.getElementById("theme_toggle");
if (themeToggleBtn) {
	themeToggleBtn.addEventListener("click", () => {
		document.documentElement.classList.toggle("light-mode");

		if (document.documentElement.classList.contains("light-mode")) {
			themeToggleBtn.innerText = "🌙 Dark Mode";
			localStorage.setItem("theme", "light");
		} else {
			themeToggleBtn.innerText = "☀️ Light Mode";
			localStorage.setItem("theme", "dark");
		}
		updateThemeSmoothly();
	});
}
