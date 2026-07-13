// Smart Greenhouse - Pure MQTT + Smoothing
// Dashboard monitoring + kontrol manual. Kontrol otomatis diserahkan ke ESP32.
// Threshold terpisah untuk Zona 1 dan Zona 2 dikirim ke ESP32.
document.addEventListener('DOMContentLoaded', function () {

    // ===========================
    // STATE
    // ===========================
    const state = {
        mode: 'manual',
        updateInterval: 2000,
        dataCounter: 0,
        uptime: 0,
        pump1On: false,
        isWatering1: false,
        wateringTimer1: null,
        dryThreshold1: 30,          // Zona 1
        wetThreshold1: 60,
        wateringDuration1: 15,
        pump2On: false,
        isWatering2: false,
        wateringTimer2: null,
        dryThreshold2: 30,          // Zona 2
        wetThreshold2: 60,
        wateringDuration2: 15,
        mqttConnected: false,
        lastData: null
    };

    // ===========================
    // SMOOTHING
    // ===========================
    const SMOOTH_WINDOW_SOIL = 8;
    const SMOOTH_WINDOW_TEMP = 3;
    const soil1Buffer = [];
    const soil2Buffer = [];
    const tempBuffer = [];

    function smoothValue(buffer, newValue, windowSize) {
        buffer.push(newValue);
        if (buffer.length > windowSize) buffer.shift();
        const sum = buffer.reduce((a, b) => a + b, 0);
        return +(sum / buffer.length).toFixed(1);
    }

    function smoothTempValue(buffer, newValue, windowSize) {
        const avg = smoothValue(buffer, newValue, windowSize);
        return Math.round(avg);
    }

    // ===========================
    // MQTT CONFIG
    // ===========================
    const MQTT_BROKER = 'wss://broker.emqx.io:8084/mqtt';
    const MQTT_TOPIC_STATUS = 'tandon/status';
    const MQTT_TOPIC_PUMP1 = 'tandon/pump1/control';
    const MQTT_TOPIC_PUMP2 = 'tandon/pump2/control';
    const MQTT_TOPIC_MODE = 'tandon/mode';
    const MQTT_TOPIC_THRESHOLD = 'tandon/threshold';
    let mqttClient = null;

    // ===========================
    // CHARTS
    // ===========================
    let tempChart, soil1Chart, soil2Chart, waterChart;
    let tempData = [], soil1Data = [], soil2Data = [], waterData = [], timeLabels = [];

    const commonChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'top' },
            tooltip: { mode: 'index', intersect: false }
        },
        scales: {
            x: { grid: { display: true, color: 'rgba(0,0,0,0.05)' }, ticks: { maxTicksLimit: 10 } },
            y: { grid: { display: true, color: 'rgba(0,0,0,0.05)' }, beginAtZero: false }
        },
        animation: { duration: 1000 },
        interaction: { intersect: false, mode: 'nearest' }
    };

    function initCharts() {
        tempChart = new Chart(document.getElementById('tempChart').getContext('2d'), {
            type: 'line',
            data: { labels: timeLabels, datasets: [{ label: 'Suhu (°C)', data: tempData, borderColor: '#ff6b6b', backgroundColor: 'rgba(255,107,107,0.1)', borderWidth: 3, tension: 0.4, fill: true, pointRadius: 2, pointHoverRadius: 6 }] },
            options: commonChartOptions
        });
        soil1Chart = new Chart(document.getElementById('soil1Chart').getContext('2d'), {
            type: 'line',
            data: { labels: timeLabels, datasets: [{ label: 'Soil 1 (%)', data: soil1Data, borderColor: '#8B4513', backgroundColor: 'rgba(139,69,19,0.1)', borderWidth: 3, tension: 0.4, fill: true, pointRadius: 2, pointHoverRadius: 6 }] },
            options: { ...commonChartOptions, scales: { ...commonChartOptions.scales, y: { ...commonChartOptions.scales.y, ticks: { stepSize: 1, callback: v => v + '%' }, min: 0, max: 100 } } }
        });
        soil2Chart = new Chart(document.getElementById('soil2Chart').getContext('2d'), {
            type: 'line',
            data: { labels: timeLabels, datasets: [{ label: 'Soil 2 (%)', data: soil2Data, borderColor: '#006400', backgroundColor: 'rgba(0,100,0,0.1)', borderWidth: 3, tension: 0.4, fill: true, pointRadius: 2, pointHoverRadius: 6 }] },
            options: { ...commonChartOptions, scales: { ...commonChartOptions.scales, y: { ...commonChartOptions.scales.y, ticks: { stepSize: 1, callback: v => v + '%' }, min: 0, max: 100 } } }
        });
        waterChart = new Chart(document.getElementById('waterChart').getContext('2d'), {
            type: 'line',
            data: { labels: timeLabels, datasets: [{ label: 'Level Air (%)', data: waterData, borderColor: '#36d9d6', backgroundColor: 'rgba(54,217,214,0.1)', borderWidth: 3, tension: 0.4, fill: true, pointRadius: 2, pointHoverRadius: 6 }] },
            options: commonChartOptions
        });
    }

    // ===========================
    // MQTT FUNCTIONS
    // ===========================
    function connectMQTT() {
        console.log('🔄 [MQTT] Menghubungkan ke broker:', MQTT_BROKER);
        if (mqttClient) {
            try { mqttClient.end(true); } catch (e) { }
        }
        mqttClient = mqtt.connect(MQTT_BROKER, {
            clientId: 'web_dashboard_' + Math.random().toString(16).substr(2, 8),
            clean: true,
            reconnectPeriod: 10000,
            connectTimeout: 5000
        });

        mqttClient.on('connect', () => {
            console.log('✅ [MQTT] Terhubung ke broker!');
            state.mqttConnected = true;
            mqttClient.subscribe(MQTT_TOPIC_STATUS, { qos: 0 }, (err) => {
                if (!err) {
                    console.log('📡 [MQTT] Berhasil subscribe ke', MQTT_TOPIC_STATUS);
                } else {
                    console.error('❌ [MQTT] Gagal subscribe:', err);
                }
            });
            // Kirim threshold default saat terkoneksi
            sendThreshold();
        });

        mqttClient.on('message', (topic, payload) => {
            if (topic !== MQTT_TOPIC_STATUS) return;
            const msg = payload.toString();
            console.log('📩 [MQTT] Pesan masuk di', topic, ':', msg);
            try {
                let raw = msg.replace(/:nan([,}])/gi, ':null$1').replace(/:inf(?:inity)?([,}])/gi, ':null$1');
                const json = JSON.parse(raw);
                const data = {
                    temp: parseFloat(json.temp_C || json.temp) || 0,
                    soil1: parseFloat(json.soil1_pct || json.soil1) || 0,
                    soil2: parseFloat(json.soil2_pct || json.soil2) || 0,
                    water: parseFloat(json.level_pct || json.water) || 0,
                    pump1: json.pump1 === true,
                    pump2: json.pump2 === true
                };
                console.log('🔢 [MQTT] Data diparsing:', data);
                state.pump1On = data.pump1;
                state.pump2On = data.pump2;
                updatePumpStatusUI(1, state.pump1On);
                updatePumpStatusUI(2, state.pump2On);
                processAndUpdateDashboard(data);
            } catch (e) {
                console.error('❌ [MQTT] Gagal parse pesan:', e);
            }
        });

        mqttClient.on('error', (err) => {
            console.error('❌ [MQTT] Error:', err.message);
            state.mqttConnected = false;
        });

        mqttClient.on('close', () => {
            console.warn('⚠️ [MQTT] Koneksi ditutup');
            state.mqttConnected = false;
        });

        mqttClient.on('offline', () => {
            console.warn('⚡ [MQTT] Offline');
        });

        mqttClient.on('reconnect', () => {
            console.log('🔄 [MQTT] Mencoba reconnect...');
        });
    }

    function sendPumpCommand(pump, cmd) {
        if (!mqttClient || !state.mqttConnected) {
            console.error('❌ MQTT tidak terhubung, tidak bisa mengirim perintah');
            return Promise.reject('MQTT not connected');
        }
        const topic = pump === 1 ? MQTT_TOPIC_PUMP1 : MQTT_TOPIC_PUMP2;
        return new Promise((resolve, reject) => {
            mqttClient.publish(topic, cmd, { qos: 1 }, (err) => {
                if (err) {
                    console.error(`❌ MQTT pump${pump} gagal:`, err);
                    reject(err);
                } else {
                    console.log(`✅ MQTT pompa ${pump} -> ${cmd} terkirim`);
                    resolve();
                }
            });
        });
    }

    function sendModeCommand(mode) {
        if (!mqttClient || !state.mqttConnected) {
            console.error('❌ MQTT tidak terhubung, tidak bisa mengirim mode');
            return;
        }
        mqttClient.publish(MQTT_TOPIC_MODE, mode, { qos: 1 }, (err) => {
            if (err) {
                console.error('❌ Gagal mengirim mode:', err);
            } else {
                console.log(`📤 Mode terkirim ke ESP32: ${mode}`);
            }
        });
    }

    // Kirim threshold kedua zona ke ESP32
    function sendThreshold() {
        if (!mqttClient || !state.mqttConnected) return;
        const payload = JSON.stringify({
            zone1: { dry: state.dryThreshold1, wet: state.wetThreshold1 },
            zone2: { dry: state.dryThreshold2, wet: state.wetThreshold2 }
        });
        mqttClient.publish(MQTT_TOPIC_THRESHOLD, payload, { qos: 1 }, (err) => {
            if (err) {
                console.error('❌ Gagal mengirim threshold:', err);
            } else {
                console.log(`📤 Threshold terkirim: Z1(dry=${state.dryThreshold1},wet=${state.wetThreshold1}) Z2(dry=${state.dryThreshold2},wet=${state.wetThreshold2})`);
            }
        });
    }

    // ===========================
    // UI UPDATE FUNCTIONS
    // ===========================
    function updateValueWithAnimation(el, val) {
        if (!el) return;
        const strVal = typeof val === 'number' ? val.toFixed(1) : String(val);
        if (el.textContent !== strVal) {
            el.textContent = strVal;
            el.style.animation = 'none';
            el.offsetHeight;
            el.style.animation = 'valueUpdate 0.8s ease';
            setTimeout(() => el.style.animation = '', 800);
        } else el.textContent = strVal;
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
        if (el1) { el1.innerHTML = `<i class="fas fa-circle" style="color:${color};"></i> ${text}`; el1.style.color = on ? '#00cc66' : '#999'; }
        const el2 = document.getElementById(id2);
        if (el2) { el2.innerHTML = `<i class="fas fa-circle" style="color:${color};"></i> ${text}`; el2.className = `pump-status ${on ? 'on' : 'off'}`; }
    }

    function updateStatusIndicators(data) {
        let cond = 'normal';
        if (data.temp < 20) { document.getElementById('tempStatus').textContent = 'Dingin'; document.getElementById('tempStatus').style.color = '#4d96ff'; cond = 'cold'; }
        else if (data.temp > 30) { document.getElementById('tempStatus').textContent = 'Panas'; document.getElementById('tempStatus').style.color = '#ff6b6b'; cond = 'hot'; }
        else { document.getElementById('tempStatus').textContent = 'Normal'; document.getElementById('tempStatus').style.color = '#36d9d6'; }
        updateConditionMarkers(document.querySelector('.temp-condition-markers'), cond);

        // Gunakan threshold per zona
        updateSoilStatus('soil1', data.soil1, state.dryThreshold1, state.wetThreshold1, document.querySelector('.soil-1 .soil-level-markers'));
        updateSoilStatus('soil2', data.soil2, state.dryThreshold2, state.wetThreshold2, document.querySelector('.soil-2 .soil-level-markers'));

        const wf = document.getElementById('waterLevelFill');
        let wcond = 'normal';
        if (data.water < 20) { document.getElementById('waterStatus').innerHTML = '<i class="fas fa-exclamation-triangle"></i> Rendah'; document.getElementById('waterStatus').style.color = '#ff6b6b'; wf.style.background = 'linear-gradient(90deg, #ff6b6b, #ffa726)'; wcond = 'low'; }
        else if (data.water > 80) { document.getElementById('waterStatus').innerHTML = '<i class="fas fa-check-circle"></i> Tinggi'; document.getElementById('waterStatus').style.color = '#00cc66'; wf.style.background = 'linear-gradient(90deg, #00cc66, #36d9d6)'; wcond = 'high'; }
        else { document.getElementById('waterStatus').innerHTML = '<i class="fas fa-check-circle"></i> Normal'; document.getElementById('waterStatus').style.color = '#36d9d6'; wf.style.background = 'linear-gradient(90deg, #36d9d6, #4d96ff)'; }
        updateConditionMarkers(document.querySelector('.water-level-markers'), wcond);
    }

    function updateSoilStatus(prefix, value, dry, wet, markers) {
        const st = document.getElementById(`${prefix}Status`);
        const rec = document.getElementById(`${prefix}Recommendation`);
        const fill = document.getElementById(`${prefix}LevelFill`);
        let cond = 'optimal';
        if (value < dry) { st.textContent = 'Kering'; st.style.color = '#D2691E'; rec.innerHTML = '<i class="fas fa-exclamation-triangle"></i> <span>Butuh penyiraman!</span>'; rec.style.color = '#D2691E'; cond = 'dry'; }
        else if (value > wet) { st.textContent = 'Basah'; st.style.color = '#006400'; rec.innerHTML = '<i class="fas fa-check-circle"></i> <span>Kelembaban cukup</span>'; rec.style.color = '#006400'; cond = 'wet'; }
        else { st.textContent = 'Optimal'; st.style.color = '#228B22'; rec.innerHTML = '<i class="fas fa-check-circle"></i> <span>Kondisi ideal</span>'; rec.style.color = '#228B22'; }
        if (fill) fill.style.width = `${value}%`;
        updateConditionMarkers(markers, cond);
    }

    // ===========================
    // WATERING LOGIC (hanya untuk perintah manual)
    // ===========================
    function addLogEntry(msg, type = 'info') {
        const log = document.getElementById('logContent');
        const entry = document.createElement('div');
        const time = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        entry.className = `log-entry ${type}`;
        entry.innerHTML = `<span class="log-time">${time}</span><span class="log-message">${msg}</span>`;
        log.appendChild(entry);
        log.scrollTop = log.scrollHeight;
        while (log.children.length > 50) log.firstChild.remove();
    }

    function startWatering(pump, noTimer = false) {
        const isWatering = pump === 1 ? state.isWatering1 : state.isWatering2;
        if (isWatering) { addLogEntry(`⚠️ Pompa ${pump} sudah berjalan`, 'warning'); return; }
        const dur = pump === 1 ? state.wateringDuration1 : state.wateringDuration2;
        sendPumpCommand(pump, 'on').then(() => {
            if (pump === 1) { state.isWatering1 = true; state.pump1On = true; }
            else { state.isWatering2 = true; state.pump2On = true; }
            updatePumpStatusUI(pump, true);
            if (noTimer) {
                addLogEntry(`💧 Zona ${pump}: Penyiraman manual (tanpa timer)`, 'water-on');
            } else {
                addLogEntry(`💧 Zona ${pump}: Penyiraman manual (${dur} detik)`, 'water-on');
                const timer = setTimeout(() => stopWatering(pump), dur * 1000);
                if (pump === 1) state.wateringTimer1 = timer;
                else state.wateringTimer2 = timer;
            }
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

    // ===========================
    // DATA PROCESSING & DASHBOARD UPDATE
    // ===========================
    function processAndUpdateDashboard(rawData) {
        const smoothTemp = smoothTempValue(tempBuffer, rawData.temp, SMOOTH_WINDOW_TEMP);
        const smoothSoil1 = smoothValue(soil1Buffer, rawData.soil1, SMOOTH_WINDOW_SOIL);
        const smoothSoil2 = smoothValue(soil2Buffer, rawData.soil2, SMOOTH_WINDOW_SOIL);

        const data = {
            ...rawData,
            temp: smoothTemp,
            soil1: smoothSoil1,
            soil2: smoothSoil2
        };
        state.lastData = data;
        updateDashboardWithData(data);
    }

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
        // Tidak ada checkAutoWatering – kontrol otomatis di ESP32

        const time = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
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
        state.uptime += 2;
        document.getElementById('uptime').textContent = Math.round(state.uptime);
    }

    // ===========================
    // UI SETUP
    // ===========================
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

            // Kirim mode ke ESP32
            sendModeCommand(mode);

            if (mode === 'manual') {
                // Matikan semua timer dan pompa
                if (state.wateringTimer1) { clearTimeout(state.wateringTimer1); state.wateringTimer1 = null; }
                if (state.wateringTimer2) { clearTimeout(state.wateringTimer2); state.wateringTimer2 = null; }
                stopWatering(1);
                stopWatering(2);
                state.isWatering1 = false;
                state.isWatering2 = false;
                state.pump1On = false;
                state.pump2On = false;
                updatePumpStatusUI(1, false);
                updatePumpStatusUI(2, false);
            }
        }

        autoBtn.addEventListener('click', () => setMode('auto'));
        manualBtn.addEventListener('click', () => setMode('manual'));
        setMode('manual');
    }

    function setupManualControls() {
        document.querySelectorAll('.pump-btn').forEach(btn => {
            btn.addEventListener('click', function () {
                if (state.mode !== 'manual') { addLogEntry('⚠️ Ganti ke mode manual terlebih dahulu', 'warning'); return; }
                const pump = parseInt(this.dataset.pump);
                const action = this.dataset.action;
                if (action === 'on') startWatering(pump, true);
                else stopWatering(pump);
            });
        });
    }

    function setupAutoSettings() {
        // Zona 1
        document.getElementById('dryThreshold1').addEventListener('input', function () {
            state.dryThreshold1 = parseInt(this.value);
            document.getElementById('dryThresholdValue1').textContent = this.value + '%';
            sendThreshold();
        });
        document.getElementById('optimalThreshold1').addEventListener('input', function () {
            state.wetThreshold1 = parseInt(this.value);
            document.getElementById('optimalThresholdValue1').textContent = this.value + '%';
            sendThreshold();
        });
        // Zona 2
        document.getElementById('dryThreshold2').addEventListener('input', function () {
            state.dryThreshold2 = parseInt(this.value);
            document.getElementById('dryThresholdValue2').textContent = this.value + '%';
            sendThreshold();
        });
        document.getElementById('optimalThreshold2').addEventListener('input', function () {
            state.wetThreshold2 = parseInt(this.value);
            document.getElementById('optimalThresholdValue2').textContent = this.value + '%';
            sendThreshold();
        });
    }

    function setupCommonControls() {
        document.getElementById('updateInterval').addEventListener('change', function () {
            state.updateInterval = parseInt(this.value);
        });
        document.getElementById('refreshBtn').addEventListener('click', () => {
            addLogEntry('🔄 Refresh manual', 'info');
            if (state.lastData) updateDashboardWithData(state.lastData);
            else addLogEntry('⚠️ Belum ada data dari MQTT', 'warning');
        });
        document.getElementById('resetBtn').addEventListener('click', () => {
            timeLabels.length = 0; tempData.length = 0; soil1Data.length = 0; soil2Data.length = 0; waterData.length = 0;
            soil1Buffer.length = 0; soil2Buffer.length = 0; tempBuffer.length = 0;
            tempChart.update(); soil1Chart.update(); soil2Chart.update(); waterChart.update();
            state.dataCounter = 0; document.getElementById('dataCounter').textContent = '0';
            state.uptime = 0; document.getElementById('uptime').textContent = '0';
            addLogEntry('🔄 Data grafik dan smoothing direset', 'info');
        });
    }

    // ===========================
    // AUTH
    // ===========================
    function displayUsername() { document.getElementById('currentUser').textContent = localStorage.getItem('username') || 'Admin'; }
    function setupLogout() { document.getElementById('logoutBtn')?.addEventListener('click', () => { if (confirm('Apakah Anda yakin ingin keluar?')) { localStorage.removeItem('isLoggedIn'); localStorage.removeItem('username'); window.location.href = 'login.html'; } }); }
    function setupAutoLogout() {
        let timer;
        function reset() { clearTimeout(timer); timer = setTimeout(() => { alert('Sesi berakhir. Silakan login kembali.'); localStorage.removeItem('isLoggedIn'); localStorage.removeItem('username'); window.location.href = 'login.html'; }, 30 * 60 * 1000); }
        document.addEventListener('mousemove', reset); document.addEventListener('keypress', reset); document.addEventListener('click', reset); reset();
    }

    // ===========================
    // INIT
    // ===========================
    function initDashboard() {
        if (!localStorage.getItem('isLoggedIn')) { window.location.href = 'login.html'; return; }
        displayUsername();
        setupLogout();
        setupAutoLogout();
        initCharts();
        setupModeControl();
        setupManualControls();
        setupAutoSettings();
        setupCommonControls();
        connectMQTT();

        setInterval(() => {
            const el = document.getElementById('mqttStatus');
            if (state.mqttConnected) {
                el.innerHTML = '<i class="fas fa-cloud"></i> MQTT Terhubung';
                el.style.color = '#36d9d6';
            } else {
                el.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Terputus';
                el.style.color = '#ff6b6b';
            }
        }, 2000);

        addLogEntry('🚀 Dashboard siap (MQTT murni, kontrol otomatis di ESP32, threshold 2 zona)', 'info');
    }

    initDashboard();
});
