// ==========================================
// ====== CLASA FILTRULUI KALMAN ============
// ==========================================

class KalmanFilter {
    constructor() {
        this.Q_angle = 0.001; 
        this.Q_bias = 0.003;  
        this.R_measure = 0.03; 

        this.angle = 0; 
        this.bias = 0;  

        this.P = [[0, 0], [0, 0]]; 
    }

    getAngle(newAngle, newRate, dt) {
        let rate = newRate - this.bias;
        this.angle += dt * rate;

        this.P[0][0] += dt * (dt * this.P[1][1] - this.P[0][1] - this.P[1][0] + this.Q_angle);
        this.P[0][1] -= dt * this.P[1][1];
        this.P[1][0] -= dt * this.P[1][1];
        this.P[1][1] += this.Q_bias * dt;

        let S = this.P[0][0] + this.R_measure;
        let K = [this.P[0][0] / S, this.P[1][0] / S]; 
        let y = newAngle - this.angle; 

        this.angle += K[0] * y;
        this.bias += K[1] * y;

        let P00_temp = this.P[0][0];
        let P01_temp = this.P[0][1];

        this.P[0][0] -= K[0] * P00_temp;
        this.P[0][1] -= K[0] * P01_temp;
        this.P[1][0] -= K[1] * P00_temp;
        this.P[1][1] -= K[1] * P01_temp;

        return this.angle;
    }
}

// ==========================================
// ====== VARIABILE GLOBALE & UI ============
// ==========================================

let chartInstance = null; 
let fullTimeData = []; 
let fullDatasetsData = {}; 

let currentIndex = 0; 
const WINDOW_SIZE = 30; 
let isPlaying = false;
let playInterval = null;

const colors = [
    '#ff0000','#ff7f00','#ffd400','#ffff00',
    '#bfff00','#00eaff','#0095ff','#0040ff',
    '#aa00ff','#edb9b9','#ff6666','#800000',
    '#008080','#000075','#a9a9a9','#bf4f51',
    '#9a6324','#e6beff','#469990','#f032e6',
    '#bfef45','#fabed4','#3cb44b','#e6194b'
]; 

// ==========================================
// ====== VARIABILE THREE.JS ================
// ==========================================

let scene, camera, renderer, submarine, submarinePitchRoll, controls;
let oceanFloor; // NOU: Variabilă pentru modelul podelei
let submarineLabel; 
let is3DMode = false;
let submarinePathCurve; 
let visualProgress = 0; 

let pathBounds = { minX: 0, maxX: 0, minZ: 0, maxZ: 0, minY: 0, maxY: 0 };
let pathCenter = new THREE.Vector3(0, 0, 0);

let kalmanPitchData = [];
let kalmanRollData = [];

// ==========================================
// ====== HELPERE & GRAFIC ==================
// ==========================================

function getLegendIdForColumn(colName) {
    let nume = colName.trim().toLowerCase();
    if (nume.includes('dist') || ['față', 'spate', 'stânga', 'dreapta', 'jos'].includes(nume)) return 'legend_distante';
    if (nume.includes('tds') || nume.includes('puritate')) return 'legend_puritate_tds';
    if (nume.includes('gyro')) return 'legend_gyro';
    if (nume.includes('acc')) return 'legend_acc';
    return 'legend_' + nume;
}

function updateThemeSmoothly() {
    let style = getComputedStyle(document.documentElement);
    let textColor = style.getPropertyValue('--text-color').trim();
    let gridColorCss = style.getPropertyValue('--border-color').trim();
    let bgColorCss = style.getPropertyValue('--background-color').trim();

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

        setTimeout(() => { if (chartInstance) chartInstance.options.animation = false; }, 500);
    }

    if (scene) {
        scene.background.set(0x0067ff);
    }
}

function updateChart(recreate = false) {
    if (fullTimeData.length === 0) return;

    const ctx = document.getElementById('myChart').getContext('2d');
    let checkboxes = document.querySelectorAll('#data_selection input[type="checkbox"]:checked');
    let selectedColumns = Array.from(checkboxes).map(cb => cb.value);

    let startIdx = Math.max(0, currentIndex - WINDOW_SIZE + 1);
    let windowTimeData = fullTimeData.slice(startIdx, currentIndex + 1);
    
    let activeDatasets = selectedColumns.map((colName, index) => {
        return {
            label: colName,
            data: fullDatasetsData[colName] ? fullDatasetsData[colName].slice(startIdx, currentIndex + 1) : [],
            borderColor: colors[index % colors.length], 
            backgroundColor: colors[index % colors.length],
            borderWidth: 2,
            tension: 0.1, 
            pointRadius: 2 
        };
    });

    if (chartInstance && !recreate) {
        chartInstance.data.labels = windowTimeData;
        chartInstance.data.datasets = activeDatasets;
        chartInstance.update('none'); 
        return;
    }

    if (chartInstance) chartInstance.destroy();

    let style = getComputedStyle(document.documentElement);
    let textColor = style.getPropertyValue('--text-color').trim();
    let gridColorCss = style.getPropertyValue('--border-color').trim();

    chartInstance = new Chart(ctx, {
        type: 'line', 
        data: { labels: windowTimeData, datasets: activeDatasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            color: textColor, 
            animation: false, 
            scales: {
                x: {
                    title: { display: true, text: 'Time (s)', color: textColor },
                    ticks: { color: textColor },
                    grid: { color: gridColorCss, tickColor: gridColorCss, drawBorder: true }
                },
                y: {
                    title: { display: true, text: 'Value', color: textColor },
                    ticks: { color: textColor },
                    grid: { color: gridColorCss, tickColor: gridColorCss, drawBorder: true }
                }
            },
            plugins: { legend: { labels: { color: textColor } } }
        }
    });
}

// ==========================================
// ====== PROCESARE DATE & KALMAN ===========
// ==========================================

function generateSubmarinePathAndFilterSensors() {
    if (fullTimeData.length === 0) return;

    const findData = (keywords) => {
        const keys = Object.keys(fullDatasetsData);
        for (let k of keys) {
            let lowerK = k.toLowerCase();
            if (keywords.some(word => lowerK.includes(word))) return fullDatasetsData[k];
        }
        return null;
    };

    let dataAX = findData(['acc_x', 'acceleratie_x', 'acc x']);
    let dataAY = findData(['acc_y', 'acceleratie_y', 'acc y']);
    let dataAZ = findData(['acc_z', 'acceleratie_z', 'acc z']);
    let dataGX = findData(['gyro_x', 'giroscop_x', 'gyro x']);
    let dataGY = findData(['gyro_y', 'giroscop_y', 'gyro y']);

    let rawPoints = [];
    kalmanPitchData = [];
    kalmanRollData = [];
    pathBounds = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity, minY: Infinity, maxY: -Infinity };

    let kfPitch = new KalmanFilter();
    let kfRoll = new KalmanFilter();

    let gravityOffset = 0;
    if (dataAZ) {
        let sampleCount = Math.min(10, dataAZ.length);
        for(let s=0; s<sampleCount; s++) gravityOffset += dataAZ[s];
        gravityOffset /= sampleCount;
    }

    let currentPos = new THREE.Vector3(0, 0, 0); 
    let currentVel = new THREE.Vector3(0, 0, 0);

    for (let i = 0; i < fullTimeData.length; i++) {
        let aX = dataAX ? dataAX[i] : 0;
        let aY = dataAY ? dataAY[i] : 0;
        let aZ = dataAZ ? (dataAZ[i] - gravityOffset) : 0;
        let aZ_raw = dataAZ ? dataAZ[i] : 1; 

        let gX = dataGX ? dataGX[i] : 0;
        let gY = dataGY ? dataGY[i] : 0;

        let dt = 0.1; 
        if (i > 0) {
            let t1 = parseFloat(fullTimeData[i]);
            let t0 = parseFloat(fullTimeData[i-1]);
            if (!isNaN(t1) && !isNaN(t0)) dt = Math.min(t1 - t0, 0.5);
        }

        let accRoll = 0, accPitch = 0;
        if (aX !== 0 || aY !== 0 || aZ_raw !== 0) {
            accRoll  = Math.atan2(aY, aZ_raw) * (180 / Math.PI);
            accPitch = Math.atan2(-aX, Math.sqrt(aY * aY + aZ_raw * aZ_raw)) * (180 / Math.PI);
        }

        let finalPitch = kfPitch.getAngle(accPitch, gX, dt);
        let finalRoll = kfRoll.getAngle(accRoll, gY, dt);

        kalmanPitchData.push(finalPitch * (Math.PI / 180));
        kalmanRollData.push(finalRoll * (Math.PI / 180));

        if (Math.abs(aX) < 0.05) aX = 0;
        if (Math.abs(aY) < 0.05) aY = 0;
        if (Math.abs(aZ) < 0.05) aZ = 0;

        currentVel.x -= aX * dt * 25; 
        currentVel.z += aY * dt * 25; 
        currentVel.y += aZ * dt * 25;

        currentVel.multiplyScalar(0.88); 

        currentPos.x += currentVel.x * dt;
        currentPos.z += currentVel.z * dt;
        currentPos.y += currentVel.y * dt;

        rawPoints.push(currentPos.clone().multiplyScalar(5));

        pathBounds.minX = Math.min(pathBounds.minX, currentPos.x);
        pathBounds.maxX = Math.max(pathBounds.maxX, currentPos.x);
        pathBounds.minZ = Math.min(pathBounds.minZ, currentPos.z);
        pathBounds.maxZ = Math.max(pathBounds.maxZ, currentPos.z);
        pathBounds.minY = Math.min(pathBounds.minY, currentPos.y);
        pathBounds.maxY = Math.max(pathBounds.maxY, currentPos.y);
    }

    if (rawPoints.length === 1) rawPoints.push(rawPoints[0].clone().add(new THREE.Vector3(0,0,0.1)));

    if (pathBounds.maxX === 0 && pathBounds.minX === 0) {
        pathBounds = { minX: -25, maxX: 25, minZ: -25, maxZ: 25, minY: -5, maxY: 5 };
    }

    if (rawPoints.length > 1) {
        submarinePathCurve = new THREE.CatmullRomCurve3(rawPoints);
        submarinePathCurve.curveType = 'centripetal';
        submarinePathCurve.tension = 0.1; 
    }

    pathCenter.set(
        (pathBounds.minX + pathBounds.maxX) / 2,
        (pathBounds.minY + pathBounds.maxY) / 2,
        (pathBounds.minZ + pathBounds.maxZ) / 2
    );

    if (is3DMode && submarine && submarinePathCurve) {
        visualProgress = 0;
        adjustCameraAndFloor();
    }
}

// ==========================================
// ====== REPOZIȚIONARE CAMERĂ ȘI PODEA =====
// ==========================================

function adjustCameraAndFloor() {
    if (!scene) return;

    let pathWidth = pathBounds.maxX - pathBounds.minX;
    let pathDepth = pathBounds.maxZ - pathBounds.minZ;

    let paddingFactor = 1.3; 
    let finalSizeX = Math.max(100, pathWidth * paddingFactor); 
    let finalSizeZ = Math.max(100, pathDepth * paddingFactor);
    let gridSquareSize = Math.max(finalSizeX, finalSizeZ); 
    
    // Dacă am încărcat un model de podea, îl punem sub traseu
    if (oceanFloor) {
        let seabedY = pathBounds.minY - 5000; // 20 de unități sub cel mai jos punct al traseului
        oceanFloor.position.set(pathCenter.x, seabedY, pathCenter.z);
        
        // Opțional: Scalează modelul podelei ca să acopere tot traseul.
        // Ai putea avea nevoie să ajustezi valorile (ex. 10, 10, 10) în funcție de dimensiunea originală a modelului tău.
        oceanFloor.scale.set(gridSquareSize, gridSquareSize, gridSquareSize); 
    }

    if(controls) {
        controls.target.copy(pathCenter);
        controls.update();
    }
    
    camera.position.set(pathCenter.x, pathCenter.y + 150, pathCenter.z + gridSquareSize*2);
    camera.lookAt(pathCenter);
}

// ==========================================
// ====== HELPER: CREATOR NAME TAG ==========
// ==========================================

// ==========================================
// ====== HELPER NOU: CREATOR NAME TAG ======
// ==========================================

function createTextLabel(text) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    canvas.width = 512;
    canvas.height = 128;
    
    context.clearRect(0, 0, canvas.width, canvas.height);
    
    context.font = 'bold 80px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    
    // Umbră mai puternică pentru contrast bun al textului alb
    context.shadowColor = 'rgba(0,0,0,0.8)';
    context.shadowBlur = 15;
    context.shadowOffsetX = 5;
    context.shadowOffsetY = 5;

    // --- MODIFICAREA AICI: Forțăm culoarea pe ALB ---
    context.fillStyle = '#ffffff';
    
    context.fillText(text, canvas.width / 2, canvas.height / 2);
    
    const texture = new THREE.Texture(canvas);
    texture.needsUpdate = true; 
    
    const spriteMaterial = new THREE.SpriteMaterial({ 
        map: texture, 
        transparent: true,
        depthTest: false 
    });
    
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(800, 240, 20); 
    
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

        let headers = lines[0].split(",");
        
        fullTimeData = [];
        fullDatasetsData = {};
        for (let i = 1; i < headers.length; i++) fullDatasetsData[headers[i]] = [];

        for (let i = 1; i < lines.length; i++) {
            let currentLine = lines[i].split(",");
            if (currentLine.length === headers.length) {
                fullTimeData.push(currentLine[0]); 
                for (let j = 1; j < headers.length; j++) {
                    fullDatasetsData[headers[j]].push(parseFloat(currentLine[j]));
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
            if (i === 1) checkbox.checked = true; 
            checkbox.addEventListener('change', () => updateChart(true));

            let textSpan = document.createElement("span");
            textSpan.textContent = colName;
            textSpan.style.color = "var(--text-color)";
            textSpan.style.cursor = "pointer";
            textSpan.style.marginLeft = "8px";
            
            textSpan.addEventListener('mouseenter', () => textSpan.style.color = "var(--accent-color)");
            textSpan.addEventListener('mouseleave', () => textSpan.style.color = "var(--text-color)");

            textSpan.addEventListener('click', () => {
                let targetId = getLegendIdForColumn(colName);
                let targetEl = document.getElementById(targetId);
                
                if (targetEl) {
                    targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    let originalBg = getComputedStyle(targetEl).backgroundColor;
                    targetEl.style.transition = "background-color 0.3s";
                    targetEl.style.backgroundColor = "var(--accent-color)";
                    
                    setTimeout(() => {
                        targetEl.style.backgroundColor = originalBg;
                        setTimeout(() => targetEl.style.backgroundColor = "", 300);
                    }, 500);
                }
            });
            
            dataNode.appendChild(checkbox);
            dataNode.appendChild(textSpan);
            dataSelectorDiv.appendChild(dataNode);
        }
        
        let timeline = document.getElementById('timeline');
        timeline.max = fullTimeData.length - 1;
        timeline.value = 0;
        currentIndex = 0;
        document.getElementById('playback_controls').style.display = 'flex';
        
        updateChart(true); 
    };
    reader.readAsText(file);
});

const playBtn = document.getElementById('play_btn');
const timeline = document.getElementById('timeline');

playBtn.addEventListener('click', () => {
    if (isPlaying) pausePlayback();
    else startPlayback();
});

timeline.addEventListener('input', (e) => {
    pausePlayback(); 
    currentIndex = parseInt(e.target.value);
    updateChart(false);
});

function startPlayback() {
    if (fullTimeData.length === 0) return;
    if (currentIndex >= fullTimeData.length - 1) currentIndex = 0;
    
    isPlaying = true;
    playBtn.innerText = '⏸ Pause';
    
    playInterval = setInterval(() => {
        if (currentIndex < fullTimeData.length - 1) {
            currentIndex++;
            timeline.value = currentIndex;
            updateChart(false); 
        } else pausePlayback(); 
    }, 200); 
}

function pausePlayback() {
    isPlaying = false;
    playBtn.innerText = '▶ Play';
    clearInterval(playInterval);
}

const goToLegendBtn = document.getElementById('go_to_legend');
if (goToLegendBtn) {
    goToLegendBtn.addEventListener('click', () => {
        const legend = document.getElementById('legend_container');
        if (legend) legend.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
}

document.addEventListener("DOMContentLoaded", () => {
    const themeToggleBtn = document.getElementById('theme_toggle');
    const savedTheme = localStorage.getItem('theme');
    
    if (savedTheme === 'light') {
        document.documentElement.classList.add('light-mode');
        if (themeToggleBtn) themeToggleBtn.innerText = '🌙 Dark Mode';
    } else {
        if (themeToggleBtn) themeToggleBtn.innerText = '☀️ Light Mode';
    }
});

const themeToggleBtn = document.getElementById('theme_toggle');
if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
        document.documentElement.classList.toggle('light-mode');
        
        if (document.documentElement.classList.contains('light-mode')) {
            themeToggleBtn.innerText = '🌙 Dark Mode';
            localStorage.setItem('theme', 'light');
        } else {
            themeToggleBtn.innerText = '☀️ Light Mode';
            localStorage.setItem('theme', 'dark');
        }
        updateThemeSmoothly(); 
    });
}

// ==========================================
// ====== LOGICA 3D (THREE.JS) =============
// ==========================================

function initThreeJS() {
    const container = document.getElementById('three_container');

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0067ff);

    camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100000);
    camera.position.set(0, 40, 50);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(10, 20, 10);
    scene.add(dirLight);

    const loader = new THREE.GLTFLoader();

    // --- NOU: ÎNCĂRCAREA PODELEI ---
    loader.load('fund_ocean.glb', function (gltf) {
        oceanFloor = gltf.scene;
        // Asigură-te că materialele din model arată bine, poți adăuga lumini mai târziu dacă e prea întunecat
        scene.add(oceanFloor);
        
        // Dacă traseul e deja generat (din CSV), aliniază podeaua
        if (submarinePathCurve) {
            adjustCameraAndFloor();
        } else {
            // Altfel, o punem temporar undeva jos
            oceanFloor.position.y = -20;
        }
    });

    // --- ÎNCĂRCAREA SUBMARINULUI ---
    submarine = new THREE.Group();
    scene.add(submarine);

    submarinePitchRoll = new THREE.Group();
    submarine.add(submarinePitchRoll);

    loader.load('submarin.glb', function (gltf) {
        const model = gltf.scene;
        submarinePitchRoll.add(model);
        
        submarineLabel = createTextLabel("Aquadex");
        submarineLabel.position.set(0, 300, 0); 
        submarine.add(submarineLabel);
    });

    if (submarinePathCurve) {
        visualProgress = 0;
        submarine.position.copy(submarinePathCurve.getPointAt(0));
        adjustCameraAndFloor();
    }

    function animate() {
        requestAnimationFrame(animate);
        update3DSubmarinePosition();
        if (controls) controls.update();
        renderer.render(scene, camera);
    }
    animate();

    window.addEventListener('resize', () => {
        if (!is3DMode) return;
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    });
}

function update3DSubmarinePosition() {
    if (!submarine || fullTimeData.length === 0 || !submarinePathCurve) return;

    // --- 1. DEPLASARE PE TRASEUL INERȚIAL PRECALCULAT ---
    const targetProgress = currentIndex / (fullTimeData.length - 1);

    if (Math.abs(targetProgress - visualProgress) > 0.5) {
        visualProgress = targetProgress; 
    } else {
        visualProgress += (targetProgress - visualProgress) * 0.015; 
    }

    let safeProgress = Math.max(0.0001, Math.min(0.9999, visualProgress));

    const currentPos = submarinePathCurve.getPointAt(safeProgress);
    submarine.position.copy(currentPos);
    
    const tangent = submarinePathCurve.getTangentAt(safeProgress);
    if (tangent.length() > 0.001) {
        const lookTarget = currentPos.clone().add(tangent);
        
        const dummyCompass = new THREE.Object3D();
        dummyCompass.position.copy(submarine.position);
        dummyCompass.lookAt(lookTarget);
        
        submarine.quaternion.slerp(dummyCompass.quaternion, 0.1); 
    }

    // --- 2. TELEMETRIE ȘI ÎNCLINARE FIZICĂ (KALMAN) ---
    let targetPitch = kalmanPitchData[currentIndex] || 0;
    let targetRoll  = kalmanRollData[currentIndex]  || 0;

    if (is3DMode) {
        const findData = (keywords) => {
            const keys = Object.keys(fullDatasetsData);
            for (let k of keys) {
                if (keywords.some(word => k.toLowerCase().includes(word))) return fullDatasetsData[k];
            }
            return null;
        };

        let gX = findData(['gyro_x', 'pitch']) ? findData(['gyro_x', 'pitch'])[currentIndex] : 0;
        let gY = findData(['gyro_y', 'roll']) ? findData(['gyro_y', 'roll'])[currentIndex] : 0;
        let gZ = findData(['gyro_z', 'yaw']) ? findData(['gyro_z', 'yaw'])[currentIndex] : 0;
        let aX = findData(['acceleratie_x']) ? findData(['acceleratie_x'])[currentIndex] : 0;
        let aY = findData(['acceleratie_y']) ? findData(['acceleratie_y'])[currentIndex] : 0;
        let aZ = findData(['acceleratie_z']) ? findData(['acceleratie_z'])[currentIndex] : 0;

        const formatHUD = (val) => val === 0 ? "0.00" : (val || 0).toFixed(2);
        let el_gx = document.getElementById('hud_gx'); if(el_gx) el_gx.innerText = formatHUD(gX);
        let el_gy = document.getElementById('hud_gy'); if(el_gy) el_gy.innerText = formatHUD(gY);
        let el_gz = document.getElementById('hud_gz'); if(el_gz) el_gz.innerText = formatHUD(gZ);
        let el_ax = document.getElementById('hud_ax'); if(el_ax) el_ax.innerText = formatHUD(aX);
        let el_ay = document.getElementById('hud_ay'); if(el_ay) el_ay.innerText = formatHUD(aY);
        let el_az = document.getElementById('hud_az'); if(el_az) el_az.innerText = formatHUD(aZ);
    }

    if (submarinePitchRoll) {
        submarinePitchRoll.rotation.x += (targetPitch - submarinePitchRoll.rotation.x) * 0.1;
        submarinePitchRoll.rotation.z += (targetRoll - submarinePitchRoll.rotation.z) * 0.1;
    }
}

// Butonul Toggle Grafic <-> 3D
const viewToggleBtn = document.getElementById('view_toggle');
const graphDiv = document.getElementById('graph');
const threeDiv = document.getElementById('three_container');
const dataSelectionDiv = document.getElementById('data_selection');
const telemetryHud = document.getElementById('telemetry_hud');

if (viewToggleBtn) {
    viewToggleBtn.addEventListener('click', () => {
        is3DMode = !is3DMode;
        
        if (is3DMode) {
            viewToggleBtn.innerText = '📈 Vizualizare Grafic';
            
            if(graphDiv) graphDiv.style.display = 'none';
            if(dataSelectionDiv) dataSelectionDiv.style.display = 'none';
            
            if(threeDiv) threeDiv.style.display = 'block';
            if(telemetryHud) telemetryHud.style.display = 'flex';
            
            if (!scene) initThreeJS();
            
            if (camera && renderer) {
                camera.aspect = threeDiv.clientWidth / threeDiv.clientHeight;
                camera.updateProjectionMatrix();
                renderer.setSize(threeDiv.clientWidth, threeDiv.clientHeight);
            }
        } else {
            viewToggleBtn.innerText = '🌐 Vizualizare 3D';
            
            if(threeDiv) threeDiv.style.display = 'none';
            if(telemetryHud) telemetryHud.style.display = 'none';
            
            if(graphDiv) graphDiv.style.display = 'block';
            if(dataSelectionDiv) dataSelectionDiv.style.display = 'flex';
        }
    });
}