// Smart Greenhouse Dual Control - Real Data, Manual Default, No Humidity
document.addEventListener('DOMContentLoaded', function() {
    const ESP32_IP = '192.168.1.100'; // GANTI DENGAN IP ESP32 ANDA
    const ESP32_BASE_URL = `http://${ESP32_IP}`;

    // Auth
    function displayUsername() {
        document.getElementById('currentUser').textContent = localStorage.getItem('username') || 'Admin';
    }
    function setupLogout() {
        document.getElementById('logoutBtn')?.addEventListener('click', () => {
            if (confirm('Apakah Anda yakin ingin keluar?')) {
                localStorage.removeItem('isLoggedIn');
                localStorage.removeItem('username');
                window.location.href = 'login.html';
            }
        });
    }
    function setupAutoLogout() {
        let timer;
        function reset() {
            clearTimeout(timer);
            timer = setTimeout(() => {
                alert('Sesi berakhir. Silakan login kembali.');
                localStorage.removeItem('isLoggedIn');
                localStorage.removeItem('username');
                window.location.href = 'login.html';
            }, 30 * 60 * 1000);
        }
        document.addEventListener('mousemove', reset);
        document.addEventListener('keypress', reset);
        document.addEventListener('click', reset);
        reset();
    }

    // State (tanpa humidity)
    const state = {
        mode: 'manual',           // DEFAULT MANUAL
        updateInterval: 2000,
        dataCounter: 0,
        uptime: 0,
        pump1On: false,
        isWatering1: false,
        wateringTimer1: null,
        dryThreshold1: 30,
        optimalThreshold1: 60,
        wateringDuration1: 15,
        pump2On: false,
        isWatering2: false,
        wateringTimer2: null,
        dryThreshold2: 30,
        optimalThreshold2: 60,
        wateringDuration2: 15,
        mqttConnected: false,
        lastRealData: null,
        esp32Reachable: false
    };

    // MQTT
    const MQTT_BROKER = 'wss://broker.emqx.io:8084/mqtt';
    const MQTT_TOPIC = 'tandon/status';
    let mqttClient = null;

    // Charts (tanpa humidity)
    let tempChart, soil1Chart, soil2Chart, waterChart;
    let tempData = [], soil1Data = [], soil2Data = [], waterData = [], timeLabels = [];
    const chartOptions = {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'top' }, tooltip: { mode: 'index', intersect: false } },
        scales: { x: { grid: { display: true, color: 'rgba(0,0,0,0.05)' }, ticks: { maxTicksLimit: 10 } },
                  y: { grid: { display: true, color: 'rgba(0,0,0,0.05)' }, beginAtZero: false } },
        animation: { duration: 1000 },
        interaction: { intersect: false, mode: 'nearest' }
    };

    function initCharts() {
        tempChart = new Chart(document.getElementById('tempChart').getContext('2d'), {
            type: 'line',
            data: { labels: timeLabels, datasets: [{ label: 'Suhu (°C)', data: tempData, borderColor: '#ff6b6b', backgroundColor: 'rgba(255,107,107,0.1)', borderWidth: 3, tension: 0.4, fill: true, pointRadius: 4, pointHoverRadius: 6 }] },
            options: chartOptions
        });
        soil1Chart = new Chart(document.getElementById('soil1Chart').getContext('2d'), {
            type: 'line',
            data: { labels: timeLabels, datasets: [{ label: 'Soil 1 (%)', data: soil1Data, borderColor: '#8B4513', backgroundColor: 'rgba(139,69,19,0.1)', borderWidth: 3, tension: 0.4, fill: true, pointRadius: 4, pointHoverRadius: 6 }] },
            options: chartOptions
        });
        soil2Chart = new Chart(document.getElementById('soil2Chart').getContext('2d'), {
            type: 'line',
            data: { labels: timeLabels, datasets: [{ label: 'Soil 2 (%)', data: soil2Data, borderColor: '#006400', backgroundColor: 'rgba(0,100,0,0.1)', borderWidth: 3, tension: 0.4, fill: true, pointRadius: 4, pointHoverRadius: 6 }] },
            options: chartOptions
        });
        waterChart = new Chart(document.getElementById('waterChart').getContext('2d'), {
            type: 'line',
            data: { labels: timeLabels, datasets: [{ label: 'Level Air (%)', data: waterData, borderColor: '#36d9d6', backgroundColor: 'rgba(54,217,214,0.1)', borderWidth: 3, tension: 0.4, fill: true, pointRadius: 4, pointHoverRadius: 6 }] },
            options: chartOptions
        });
    }

    // Fetch data (tanpa hum)
    async function fetchDataFromESP32() {
        try {
            const response = await fetch(`${ESP32_BASE_URL}/status`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            state.esp32Reachable = true;
            return {
                temp: data.temp || 0,
                soil1: data.soil1 || 0,
                soil2: data.soil2 || 0,
                water: data.water || 0,
                pump1: data.pump1 || false,
                pump2: data.pump2 || false
            };
        } catch (e) {
            console.error('ESP32 fetch gagal:', e);
            state.esp32Reachable = false;
            return null;
        }
    }

    async function fetchData() {
        const esp32Data = await fetchDataFromESP32();
        if (esp32Data) {
            state.lastRealData = esp32Data;
            state.pump1On = esp32Data.pump1;
            state.pump2On = esp32Data.pump2;
            updatePumpStatusUI(1, state.pump1On);
            updatePumpStatusUI(2, state.pump2On);
            return esp32Data;
        }
        return state.lastRealData;
    }

    // UI Update (tanpa humidity)
    function updateValueWithAnimation(el, val) {
        if (!el) return;
        if (el.textContent !== String(val)) {
            el.textContent = val;
            el.style.animation = 'none';
            el.offsetHeight;
            el.style.animation = 'valueUpdate 0.8s ease';
            setTimeout(() => el.style.animation = '', 800);
        } else el.textContent = val;
    }

    function updateConditionMarkers(container, active) {
        container?.querySelectorAll('.condition-marker').forEach(m => {
            m.classList.toggle('active', m.dataset.condition === active);
        });
    }

    function updatePumpStatusUI(pump, on) {
        const id1 = pump === 1 ? 'pump1Status' : 'pump2Status';
        const id2 = pump === 1 ? 'pump1ManualStatus' : 'pump2ManualStatus';
        const color = on ? '#00cc66' : '#ccc';
        const text = on ? 'Menyala' : 'Mati';
        const el1 = document.getElementById(id1);
        if (el1) {
            el1.innerHTML = `<i class="fas fa-circle" style="color:${color};"></i> ${text}`;
            el1.style.color = on ? '#00cc66' : '#999';
        }
        const el2 = document.getElementById(id2);
        if (el2) {
            el2.innerHTML = `<i class="fas fa-circle" style="color:${color};"></i> ${text}`;
            el2.className = `pump-status ${on ? 'on' : 'off'}`;
        }
    }

    function updateStatusIndicators(data) {
        // Temperature only
        let cond = 'normal';
        if (data.temp < 20) { document.getElementById('tempStatus').textContent = 'Dingin'; document.getElementById('tempStatus').style.color = '#4d96ff'; cond = 'cold'; }
        else if (data.temp > 30) { document.getElementById('tempStatus').textContent = 'Panas'; document.getElementById('tempStatus').style.color = '#ff6b6b'; cond = 'hot'; }
        else { document.getElementById('tempStatus').textContent = 'Normal'; document.getElementById('tempStatus').style.color = '#36d9d6'; }
        updateConditionMarkers(document.querySelector('.temp-condition-markers'), cond);

        // Soil 1
        updateSoilStatus('soil1', data.soil1, state.dryThreshold1, state.optimalThreshold1,
            document.querySelector('.soil-1 .soil-level-markers'));
        // Soil 2
        updateSoilStatus('soil2', data.soil2, state.dryThreshold2, state.optimalThreshold2,
            document.querySelector('.soil-2 .soil-level-markers'));

        // Water Level
        const wf = document.getElementById('waterLevelFill');
        let wcond = 'normal';
        if (data.water < 20) {
            document.getElementById('waterStatus').innerHTML = '<i class="fas fa-exclamation-triangle"></i> Rendah';
            document.getElementById('waterStatus').style.color = '#ff6b6b';
            wf.style.background = 'linear-gradient(90deg, #ff6b6b, #ffa726)';
            wcond = 'low';
        } else if (data.water > 80) {
            document.getElementById('waterStatus').innerHTML = '<i class="fas fa-check-circle"></i> Tinggi';
            document.getElementById('waterStatus').style.color = '#00cc66';
            wf.style.background = 'linear-gradient(90deg, #00cc66, #36d9d6)';
            wcond = 'high';
        } else {
            document.getElementById('waterStatus').innerHTML = '<i class="fas fa-check-circle"></i> Normal';
            document.getElementById('waterStatus').style.color = '#36d9d6';
            wf.style.background = 'linear-gradient(90deg, #36d9d6, #4d96ff)';
        }
        updateConditionMarkers(document.querySelector('.water-level-markers'), wcond);
    }

    function updateSoilStatus(prefix, value, dry, optimal, markers) {
        const st = document.getElementById(`${prefix}Status`);
        const rec = document.getElementById(`${prefix}Recommendation`);
        const fill = document.getElementById(`${prefix}LevelFill`);
        let cond = 'optimal';
        if (value < dry) {
            st.textContent = 'Kering'; st.style.color = '#D2691E';
            rec.innerHTML = '<i class="fas fa-exclamation-triangle"></i> <span>Butuh penyiraman!</span>';
            rec.style.color = '#D2691E'; cond = 'dry';
        } else if (value > optimal) {
            st.textContent = 'Basah'; st.style.color = '#006400';
            rec.innerHTML = '<i class="fas fa-check-circle"></i> <span>Kelembaban cukup</span>';
            rec.style.color = '#006400'; cond = 'wet';
        } else {
            st.textContent = 'Optimal'; st.style.color = '#228B22';
            rec.innerHTML = '<i class="fas fa-check-circle"></i> <span>Kondisi ideal</span>';
            rec.style.color = '#228B22';
        }
        if (fill) fill.style.width = `${value}%`;
        updateConditionMarkers(markers, cond);
    }

    // Watering
    function addLogEntry(msg, type='info') {
        const log = document.getElementById('logContent');
        const entry = document.createElement('div');
        const time = new Date().toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
        entry.className = `log-entry ${type}`;
        entry.innerHTML = `<span class="log-time">${time}</span><span class="log-message">${msg}</span>`;
        log.appendChild(entry);
        log.scrollTop = log.scrollHeight;
        while (log.children.length > 50) log.firstChild.remove();
    }

    function sendPumpCommand(pump, cmd) {
        return fetch(`${ESP32_BASE_URL}/pump${pump}?state=${cmd}`)
            .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); console.log(`Pompa ${pump}: ${cmd}`); })
            .catch(err => {
                console.error(err);
                if (mqttClient && state.mqttConnected) {
                    mqttClient.publish(`tandon/pump${pump}/control`, cmd, { qos: 1 });
                    console.log(`MQTT fallback: pompa ${pump} ${cmd}`);
                } else throw err;
            });
    }

    function startWatering(pump) {
        const isWatering = pump === 1 ? state.isWatering1 : state.isWatering2;
        if (isWatering) { addLogEntry(`⚠️ Pompa ${pump} sudah berjalan`, 'warning'); return; }
        const dur = pump === 1 ? state.wateringDuration1 : state.wateringDuration2;
        sendPumpCommand(pump, 'on').then(() => {
            if (pump === 1) { state.isWatering1 = true; state.pump1On = true; }
            else { state.isWatering2 = true; state.pump2On = true; }
            updatePumpStatusUI(pump, true);
            addLogEntry(`💧 Zona ${pump}: Penyiraman dimulai (${dur} detik)`, 'water-on');
            const timer = setTimeout(() => stopWatering(pump), dur * 1000);
            if (pump === 1) state.wateringTimer1 = timer;
            else state.wateringTimer2 = timer;
        }).catch(e => addLogEntry(`❌ Gagal menyalakan pompa ${pump}: ${e.message}`, 'error'));
    }

    function stopWatering(pump) {
        sendPumpCommand(pump, 'off').then(() => {
            if (pump === 1) {
                state.isWatering1 = false; state.pump1On = false;
                if (state.wateringTimer1) { clearTimeout(state.wateringTimer1); state.wateringTimer1 = null; }
            } else {
                state.isWatering2 = false; state.pump2On = false;
                if (state.wateringTimer2) { clearTimeout(state.wateringTimer2); state.wateringTimer2 = null; }
            }
            updatePumpStatusUI(pump, false);
            addLogEntry(`💧 Zona ${pump}: Penyiraman selesai`, 'water-off');
        }).catch(e => addLogEntry(`❌ Gagal mematikan pompa ${pump}: ${e.message}`, 'error'));
    }

    function checkAutoWatering(data) {
        if (state.mode !== 'auto') return;
        if (!state.isWatering1 && data.soil1 < state.dryThreshold1) { addLogEntry(`🌱 Zona 1 auto watering`, 'auto-water'); startWatering(1); }
        else if (!state.isWatering1 && data.soil1 < state.dryThreshold1 + 10) addLogEntry(`⚠️ Zona 1 mendekati kering`, 'warning');
        if (!state.isWatering2 && data.soil2 < state.dryThreshold2) { addLogEntry(`🌱 Zona 2 auto watering`, 'auto-water'); startWatering(2); }
        else if (!state.isWatering2 && data.soil2 < state.dryThreshold2 + 10) addLogEntry(`⚠️ Zona 2 mendekati kering`, 'warning');
    }

    // MQTT (tanpa humidity parsing)
    function connectMQTT() {
        if (mqttClient) { try { mqttClient.end(true); } catch(e) {} }
        mqttClient = mqtt.connect(MQTT_BROKER, {
            clientId: 'web_dashboard_' + Math.random().toString(16).substr(2,8),
            clean: true, reconnectPeriod: 5000, connectTimeout: 10000
        });
        mqttClient.on('connect', () => {
            state.mqttConnected = true;
            mqttClient.subscribe(MQTT_TOPIC, err => { if (!err) addLogEntry('📡 Terhubung ke MQTT (EMQX)', 'info'); });
        });
        mqttClient.on('message', (topic, payload) => {
            try {
                let raw = payload.toString();
                raw = raw.replace(/:nan([,}])/gi, ':null$1').replace(/:inf(?:inity)?([,}])/gi, ':null$1');
                const json = JSON.parse(raw);
                const realData = {
                    temp: parseFloat(json.temp_C) || 0,
                    soil1: parseInt(json.soil1_pct) || 0,
                    soil2: parseInt(json.soil2_pct) || 0,
                    water: parseFloat(json.level_pct) || 0,
                    pump1: json.pump1 === true,
                    pump2: json.pump2 === true
                };
                state.lastRealData = realData;
                state.pump1On = realData.pump1;
                state.pump2On = realData.pump2;
                updatePumpStatusUI(1, state.pump1On);
                updatePumpStatusUI(2, state.pump2On);
                if (!state.esp32Reachable) updateDashboardWithData(realData);
            } catch(e) { console.error('MQTT parse error:', e); }
        });
        mqttClient.on('error', () => state.mqttConnected = false);
        mqttClient.on('close', () => state.mqttConnected = false);
    }

    // Dashboard update
    function updateDashboardWithData(data) {
        if (!data) return;
        updateValueWithAnimation(document.getElementById('tempValue'), data.temp);
        updateValueWithAnimation(document.getElementById('soil1Value'), data.soil1);
        updateValueWithAnimation(document.getElementById('soil2Value'), data.soil2);
        updateValueWithAnimation(document.getElementById('waterValue'), data.water);

        document.getElementById('waterLevelFill').style.width = `${data.water}%`;
        document.getElementById('soil1LevelFill').style.width = `${data.soil1}%`;
        document.getElementById('soil2LevelFill').style.width = `${data.soil2}%`;
        document.getElementById('tempGaugeFill').style.width = `${Math.min(data.temp * 2, 100)}%`;

        updateStatusIndicators(data);
        checkAutoWatering(data);

        const time = new Date().toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
        timeLabels.push(time);
        tempData.push(data.temp);
        soil1Data.push(data.soil1);
        soil2Data.push(data.soil2);
        waterData.push(data.water);
        const max = 20;
        while (timeLabels.length > max) {
            timeLabels.shift(); tempData.shift(); soil1Data.shift(); soil2Data.shift(); waterData.shift();
        }
        tempChart.update(); soil1Chart.update(); soil2Chart.update(); waterChart.update();

        document.getElementById('lastUpdateTime').textContent = time;
        state.dataCounter++;
        document.getElementById('dataCounter').textContent = state.dataCounter;
        state.uptime += state.updateInterval / 1000;
        document.getElementById('uptime').textContent = Math.round(state.uptime);
    }

    async function updateDashboard() {
        const data = await fetchData();
        if (data) updateDashboardWithData(data);
    }

    // Setup UI
    function setupModeControl() {
        const autoBtn = document.getElementById('autoModeBtn');
        const manualBtn = document.getElementById('manualModeBtn');
        const manualControls = document.getElementById('manualControls');
        const autoSettings = document.getElementById('autoSettings');
        const modeStatus = document.getElementById('currentModeStatus');

        function setMode(mode) {
            state.mode = mode;
            autoBtn.classList.toggle('active', mode === 'auto');
            manualBtn.classList.toggle('active', mode === 'manual');
            manualControls.style.display = mode === 'manual' ? 'block' : 'none';
            autoSettings.style.display = mode === 'auto' ? 'block' : 'none';
            modeStatus.textContent = mode === 'auto' ? 'Otomatis' : 'Manual';
            modeStatus.style.color = mode === 'auto' ? '#43c51e' : '#ff2626';
            addLogEntry(`Mode: ${mode === 'auto' ? 'Otomatis' : 'Manual'}`, 'mode-change');
        }

        autoBtn.addEventListener('click', () => setMode('auto'));
        manualBtn.addEventListener('click', () => setMode('manual'));
        setMode('manual'); // DEFAULT MANUAL
    }

    function setupManualControls() {
        document.querySelectorAll('.pump-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                if (state.mode !== 'manual') {
                    addLogEntry('⚠️ Ganti ke mode manual terlebih dahulu', 'warning');
                    return;
                }
                const pump = parseInt(this.dataset.pump);
                const action = this.dataset.action;
                action === 'on' ? startWatering(pump) : stopWatering(pump);
            });
        });
    }

    function setupAutoSettings() {
        document.getElementById('dryThreshold1').addEventListener('input', function() {
            state.dryThreshold1 = parseInt(this.value);
            document.getElementById('dryThresholdValue1').textContent = this.value + '%';
        });
        document.getElementById('optimalThreshold1').addEventListener('input', function() {
            state.optimalThreshold1 = parseInt(this.value);
            document.getElementById('optimalThresholdValue1').textContent = this.value + '%';
        });
        document.getElementById('wateringDuration1').addEventListener('input', function() {
            state.wateringDuration1 = parseInt(this.value);
            document.getElementById('wateringDurationValue1').textContent = this.value + ' detik';
        });
        document.getElementById('dryThreshold2').addEventListener('input', function() {
            state.dryThreshold2 = parseInt(this.value);
            document.getElementById('dryThresholdValue2').textContent = this.value + '%';
        });
        document.getElementById('optimalThreshold2').addEventListener('input', function() {
            state.optimalThreshold2 = parseInt(this.value);
            document.getElementById('optimalThresholdValue2').textContent = this.value + '%';
        });
        document.getElementById('wateringDuration2').addEventListener('input', function() {
            state.wateringDuration2 = parseInt(this.value);
            document.getElementById('wateringDurationValue2').textContent = this.value + ' detik';
        });
    }

    function setupCommonControls() {
        document.getElementById('updateInterval').addEventListener('change', function() {
            state.updateInterval = parseInt(this.value);
            if (window.updateIntervalId) {
                clearInterval(window.updateIntervalId);
                window.updateIntervalId = setInterval(updateDashboard, state.updateInterval);
            }
        });
        document.getElementById('refreshBtn').addEventListener('click', updateDashboard);
        document.getElementById('resetBtn').addEventListener('click', () => {
            timeLabels.length = 0; tempData.length = 0; soil1Data.length = 0; soil2Data.length = 0; waterData.length = 0;
            tempChart.update(); soil1Chart.update(); soil2Chart.update(); waterChart.update();
            state.dataCounter = 0; document.getElementById('dataCounter').textContent = '0';
            state.uptime = 0; document.getElementById('uptime').textContent = '0';
            addLogEntry('🔄 Data grafik direset', 'info');
        });
        setInterval(() => {
            const el = document.getElementById('mqttStatus');
            if (state.esp32Reachable) {
                el.innerHTML = '<i class="fas fa-wifi"></i> ESP32 Online';
                el.style.color = '#00cc66';
            } else if (state.mqttConnected) {
                el.innerHTML = '<i class="fas fa-cloud"></i> MQTT Terhubung';
                el.style.color = '#36d9d6';
            } else {
                el.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Terputus';
                el.style.color = '#ff6b6b';
            }
        }, 2000);
    }

    // Init
    function initDashboard() {
        if (!localStorage.getItem('isLoggedIn')) { window.location.href = 'login.html'; return; }
        displayUsername();
        setupLogout();
        setupAutoLogout();
        initCharts();
        setupModeControl();       // ini sudah set manual default
        setupManualControls();
        setupAutoSettings();
        setupCommonControls();
        updateDashboard();
        window.updateIntervalId = setInterval(updateDashboard, state.updateInterval);
        connectMQTT();
        addLogEntry('🚀 Dashboard siap (data real, manual default)', 'info');
        addLogEntry(`📡 ESP32 IP: ${ESP32_IP}`, 'info');
    }

    initDashboard();
});
