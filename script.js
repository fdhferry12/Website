// Smart Greenhouse Dual Control - JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // ============================
    // AUTHENTICATION FUNCTIONS
    // ============================
    function displayUsername() {
        const username = localStorage.getItem('username') || 'Admin';
        document.getElementById('currentUser').textContent = username;
    }

    function setupLogout() {
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', function() {
                if (confirm('Apakah Anda yakin ingin keluar?')) {
                    localStorage.removeItem('isLoggedIn');
                    localStorage.removeItem('username');
                    window.location.href = 'login.html';
                }
            });
        }
    }

    function setupAutoLogout() {
        let inactivityTimer;
        
        function resetInactivityTimer() {
            clearTimeout(inactivityTimer);
            inactivityTimer = setTimeout(logoutDueToInactivity, 30 * 60 * 1000);
        }
        
        function logoutDueToInactivity() {
            alert('Sesi telah berakhir karena tidak ada aktivitas. Silakan login kembali.');
            localStorage.removeItem('isLoggedIn');
            localStorage.removeItem('username');
            window.location.href = 'login.html';
        }
        
        document.addEventListener('mousemove', resetInactivityTimer);
        document.addEventListener('keypress', resetInactivityTimer);
        document.addEventListener('click', resetInactivityTimer);
        resetInactivityTimer();
    }

    // ============================
    // WATERING SYSTEM STATE
    // ============================
    const state = {
        mode: 'auto',
        simulationMode: true,
        updateInterval: 2000,
        dataCounter: 0,
        uptime: 0,
        
        // Zone 1
        pump1On: false,
        isWatering1: false,
        wateringTimer1: null,
        dryThreshold1: 30,
        optimalThreshold1: 60,
        wateringDuration1: 15,
        
        // Zone 2
        pump2On: false,
        isWatering2: false,
        wateringTimer2: null,
        dryThreshold2: 30,
        optimalThreshold2: 60,
        wateringDuration2: 15
    };

    // ============================
    // CHART INSTANCES
    // ============================
    let tempChart, humChart, soil1Chart, soil2Chart, waterChart;
    let tempData = [], humData = [], soil1Data = [], soil2Data = [], waterData = [], timeLabels = [];
    
    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: true,
                position: 'top',
            },
            tooltip: {
                mode: 'index',
                intersect: false,
            }
        },
        scales: {
            x: {
                grid: {
                    display: true,
                    color: 'rgba(0,0,0,0.05)'
                },
                ticks: {
                    maxTicksLimit: 10
                }
            },
            y: {
                grid: {
                    display: true,
                    color: 'rgba(0,0,0,0.05)'
                },
                beginAtZero: false
            }
        },
        animation: {
            duration: 1000
        },
        interaction: {
            intersect: false,
            mode: 'nearest'
        }
    };

    function initCharts() {
        // Temperature Chart
        const tempCtx = document.getElementById('tempChart').getContext('2d');
        tempChart = new Chart(tempCtx, {
            type: 'line',
            data: {
                labels: timeLabels,
                datasets: [{
                    label: 'Suhu Udara (°C)',
                    data: tempData,
                    borderColor: '#ff6b6b',
                    backgroundColor: 'rgba(255, 107, 107, 0.1)',
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: '#ff6b6b',
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: chartOptions
        });

        // Humidity Chart
        const humCtx = document.getElementById('humChart').getContext('2d');
        humChart = new Chart(humCtx, {
            type: 'line',
            data: {
                labels: timeLabels,
                datasets: [{
                    label: 'Kelembaban Udara (%)',
                    data: humData,
                    borderColor: '#4d96ff',
                    backgroundColor: 'rgba(77, 150, 255, 0.1)',
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: '#4d96ff',
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: chartOptions
        });

        // Soil Moisture 1 Chart
        const soil1Ctx = document.getElementById('soil1Chart').getContext('2d');
        soil1Chart = new Chart(soil1Ctx, {
            type: 'line',
            data: {
                labels: timeLabels,
                datasets: [{
                    label: 'Kelembaban Tanah 1 (%)',
                    data: soil1Data,
                    borderColor: '#8B4513',
                    backgroundColor: 'rgba(139, 69, 19, 0.1)',
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: '#8B4513',
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: chartOptions
        });

        // Soil Moisture 2 Chart
        const soil2Ctx = document.getElementById('soil2Chart').getContext('2d');
        soil2Chart = new Chart(soil2Ctx, {
            type: 'line',
            data: {
                labels: timeLabels,
                datasets: [{
                    label: 'Kelembaban Tanah 2 (%)',
                    data: soil2Data,
                    borderColor: '#006400',
                    backgroundColor: 'rgba(0, 100, 0, 0.1)',
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: '#006400',
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: chartOptions
        });

        // Water Level Chart
        const waterCtx = document.getElementById('waterChart').getContext('2d');
        waterChart = new Chart(waterCtx, {
            type: 'line',
            data: {
                labels: timeLabels,
                datasets: [{
                    label: 'Level Air (%)',
                    data: waterData,
                    borderColor: '#36d9d6',
                    backgroundColor: 'rgba(54, 217, 214, 0.1)',
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: '#36d9d6',
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: chartOptions
        });
    }

    // ============================
    // DATA GENERATION & FETCHING
    // ============================
    function generateSimulatedData() {
        return {
            temp: parseFloat((25 + Math.random() * 5 - 2.5).toFixed(1)),
            hum: parseFloat((50 + Math.random() * 20 - 10).toFixed(1)),
            soil1: Math.round(30 + Math.random() * 50),
            soil2: Math.round(30 + Math.random() * 50),
            water: Math.round(40 + Math.random() * 40)
        };
    }

    async function fetchData() {
        if (state.simulationMode) {
            return new Promise(resolve => {
                setTimeout(() => resolve(generateSimulatedData()), 300);
            });
        } else {
            try {
                const response = await fetch('http://192.168.1.100/data');
                if (!response.ok) throw new Error('Gagal mengambil data');
                return await response.json();
            } catch (error) {
                console.error('Error fetching data:', error);
                return generateSimulatedData();
            }
        }
    }

    // ============================
    // UI UPDATE FUNCTIONS
    // ============================
    function updateValueWithAnimation(element, newValue) {
        if (!element) return;
        const oldValue = element.textContent;
        if (oldValue !== String(newValue)) {
            element.textContent = newValue;
            element.style.animation = 'none';
            element.offsetHeight;
            element.style.animation = 'valueUpdate 0.8s ease';
            setTimeout(() => {
                element.style.animation = '';
            }, 800);
        } else {
            element.textContent = newValue;
        }
    }

    function updateConditionMarkers(container, activeCondition) {
        if (!container) return;
        const markers = container.querySelectorAll('.condition-marker');
        markers.forEach(marker => {
            const condition = marker.getAttribute('data-condition');
            if (condition === activeCondition) {
                marker.classList.add('active');
            } else {
                marker.classList.remove('active');
            }
        });
    }

    function updatePumpStatusUI(pumpNumber, isOn) {
        const statusId = pumpNumber === 1 ? 'pump1Status' : 'pump2Status';
        const manualStatusId = pumpNumber === 1 ? 'pump1ManualStatus' : 'pump2ManualStatus';
        
        const statusEl = document.getElementById(statusId);
        const manualStatusEl = document.getElementById(manualStatusId);
        
        const icon = isOn ? 'fa-circle' : 'fa-circle';
        const color = isOn ? '#00cc66' : '#ccc';
        const text = isOn ? 'Menyala' : 'Mati';
        
        if (statusEl) {
            statusEl.innerHTML = `<i class="fas ${icon}" style="color: ${color};"></i> ${text}`;
            statusEl.style.color = isOn ? '#00cc66' : '#999';
        }
        if (manualStatusEl) {
            manualStatusEl.innerHTML = `<i class="fas ${icon}" style="color: ${color};"></i> ${text}`;
            manualStatusEl.className = `pump-status ${isOn ? 'on' : 'off'}`;
        }
    }

    function updateStatusIndicators(data) {
        // Temperature
        let tempCondition = 'normal';
        if (data.temp < 20) {
            document.getElementById('tempStatus').textContent = 'Dingin';
            document.getElementById('tempStatus').style.color = '#4d96ff';
            tempCondition = 'cold';
        } else if (data.temp > 30) {
            document.getElementById('tempStatus').textContent = 'Panas';
            document.getElementById('tempStatus').style.color = '#ff6b6b';
            tempCondition = 'hot';
        } else {
            document.getElementById('tempStatus').textContent = 'Normal';
            document.getElementById('tempStatus').style.color = '#36d9d6';
            tempCondition = 'normal';
        }
        updateConditionMarkers(document.querySelector('.temp-condition-markers'), tempCondition);

        // Humidity
        let humCondition = 'normal';
        if (data.hum < 40) {
            document.getElementById('humStatus').textContent = 'Kering';
            document.getElementById('humStatus').style.color = '#ffa726';
            humCondition = 'dry';
        } else if (data.hum > 70) {
            document.getElementById('humStatus').textContent = 'Lembab';
            document.getElementById('humStatus').style.color = '#4d96ff';
            humCondition = 'wet';
        } else {
            document.getElementById('humStatus').textContent = 'Normal';
            document.getElementById('humStatus').style.color = '#36d9d6';
            humCondition = 'normal';
        }
        updateConditionMarkers(document.querySelector('.hum-condition-markers'), humCondition);

        // Soil 1
        updateSoilStatus('soil1', data.soil1, state.dryThreshold1, state.optimalThreshold1, 
            document.querySelector('.soil-1 .soil-level-markers'));

        // Soil 2
        updateSoilStatus('soil2', data.soil2, state.dryThreshold2, state.optimalThreshold2,
            document.querySelector('.soil-2 .soil-level-markers'));

        // Water Level
        const waterLevelFillEl = document.getElementById('waterLevelFill');
        let waterCondition = 'normal';
        if (data.water < 20) {
            document.getElementById('waterStatus').innerHTML = '<i class="fas fa-exclamation-triangle"></i> Rendah';
            document.getElementById('waterStatus').style.color = '#ff6b6b';
            waterLevelFillEl.style.background = 'linear-gradient(90deg, #ff6b6b, #ffa726)';
            waterCondition = 'low';
        } else if (data.water > 80) {
            document.getElementById('waterStatus').innerHTML = '<i class="fas fa-check-circle"></i> Tinggi';
            document.getElementById('waterStatus').style.color = '#00cc66';
            waterLevelFillEl.style.background = 'linear-gradient(90deg, #00cc66, #36d9d6)';
            waterCondition = 'high';
        } else {
            document.getElementById('waterStatus').innerHTML = '<i class="fas fa-check-circle"></i> Normal';
            document.getElementById('waterStatus').style.color = '#36d9d6';
            waterLevelFillEl.style.background = 'linear-gradient(90deg, #36d9d6, #4d96ff)';
            waterCondition = 'normal';
        }
        updateConditionMarkers(document.querySelector('.water-level-markers'), waterCondition);
    }

    function updateSoilStatus(prefix, value, dryThreshold, optimalThreshold, markersContainer) {
        const statusEl = document.getElementById(`${prefix}Status`);
        const recEl = document.getElementById(`${prefix}Recommendation`);
        const levelFillEl = document.getElementById(`${prefix}LevelFill`);
        
        let condition = 'optimal';
        if (value < dryThreshold) {
            statusEl.textContent = 'Kering';
            statusEl.style.color = '#D2691E';
            recEl.innerHTML = '<i class="fas fa-exclamation-triangle"></i> <span>Butuh penyiraman!</span>';
            recEl.style.color = '#D2691E';
            condition = 'dry';
        } else if (value > optimalThreshold) {
            statusEl.textContent = 'Basah';
            statusEl.style.color = '#006400';
            recEl.innerHTML = '<i class="fas fa-check-circle"></i> <span>Kelembaban cukup</span>';
            recEl.style.color = '#006400';
            condition = 'wet';
        } else {
            statusEl.textContent = 'Optimal';
            statusEl.style.color = '#228B22';
            recEl.innerHTML = '<i class="fas fa-check-circle"></i> <span>Kondisi ideal</span>';
            recEl.style.color = '#228B22';
            condition = 'optimal';
        }
        
        if (levelFillEl) {
            levelFillEl.style.width = `${value}%`;
        }
        
        updateConditionMarkers(markersContainer, condition);
    }

    // ============================
    // WATERING CONTROL FUNCTIONS
    // ============================
    function addLogEntry(message, type = 'info') {
        const logContent = document.getElementById('logContent');
        if (!logContent) return;
        
        const entry = document.createElement('div');
        const now = new Date();
        const timeString = now.toLocaleTimeString('id-ID', { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit' 
        });
        
        entry.className = `log-entry ${type}`;
        entry.innerHTML = `
            <span class="log-time">${timeString}</span>
            <span class="log-message">${message}</span>
        `;
        
        logContent.appendChild(entry);
        logContent.scrollTop = logContent.scrollHeight;
        
        while (logContent.children.length > 50) {
            logContent.removeChild(logContent.firstChild);
        }
    }

    function startWatering(pumpNumber) {
        const isPumpOn = pumpNumber === 1 ? state.pump1On : state.pump2On;
        const isWatering = pumpNumber === 1 ? state.isWatering1 : state.isWatering2;
        
        if (isWatering) {
            addLogEntry(`⚠️ Pompa ${pumpNumber} sudah berjalan`, 'warning');
            return;
        }

        const duration = pumpNumber === 1 ? state.wateringDuration1 : state.wateringDuration2;
        
        if (pumpNumber === 1) {
            state.isWatering1 = true;
            state.pump1On = true;
        } else {
            state.isWatering2 = true;
            state.pump2On = true;
        }
        
        updatePumpStatusUI(pumpNumber, true);
        addLogEntry(`💧 Zona ${pumpNumber}: Penyiraman dimulai (${duration} detik)`, 'water-on');
        
        sendPumpCommand(pumpNumber, 'on');

        const timer = setTimeout(() => {
            stopWatering(pumpNumber);
        }, duration * 1000);
        
        if (pumpNumber === 1) {
            state.wateringTimer1 = timer;
        } else {
            state.wateringTimer2 = timer;
        }
    }

    function stopWatering(pumpNumber) {
        const isPumpOn = pumpNumber === 1 ? state.pump1On : state.pump2On;
        const isWatering = pumpNumber === 1 ? state.isWatering1 : state.isWatering2;
        
        if (!isWatering && !isPumpOn) return;
        
        if (pumpNumber === 1) {
            state.isWatering1 = false;
            state.pump1On = false;
            if (state.wateringTimer1) {
                clearTimeout(state.wateringTimer1);
                state.wateringTimer1 = null;
            }
        } else {
            state.isWatering2 = false;
            state.pump2On = false;
            if (state.wateringTimer2) {
                clearTimeout(state.wateringTimer2);
                state.wateringTimer2 = null;
            }
        }
        
        updatePumpStatusUI(pumpNumber, false);
        addLogEntry(`💧 Zona ${pumpNumber}: Penyiraman selesai`, 'water-off');
        sendPumpCommand(pumpNumber, 'off');
    }

    function sendPumpCommand(pumpNumber, command) {
        if (state.simulationMode) {
            console.log(`[SIMULASI] Pompa ${pumpNumber}: ${command}`);
            return;
        }
        
        try {
            fetch(`http://192.168.1.100/pump${pumpNumber}?state=${command}`)
                .catch(err => console.error(`Gagal mengirim perintah ke pompa ${pumpNumber}:`, err));
        } catch (error) {
            console.error(`Error sending pump ${pumpNumber} command:`, error);
        }
    }

    function checkAutoWatering(data) {
        if (state.mode !== 'auto') return;
        
        // Check Zone 1
        if (!state.isWatering1 && data.soil1 < state.dryThreshold1) {
            addLogEntry(`🌱 Zona 1: Kelembaban ${data.soil1}% < ${state.dryThreshold1}%, penyiraman otomatis dimulai`, 'auto-water');
            startWatering(1);
        } else if (!state.isWatering1 && data.soil1 < state.dryThreshold1 + 10) {
            addLogEntry(`⚠️ Zona 1: Kelembaban ${data.soil1}% mendekati batas kering (${state.dryThreshold1}%)`, 'warning');
        }
        
        // Check Zone 2
        if (!state.isWatering2 && data.soil2 < state.dryThreshold2) {
            addLogEntry(`🌱 Zona 2: Kelembaban ${data.soil2}% < ${state.dryThreshold2}%, penyiraman otomatis dimulai`, 'auto-water');
            startWatering(2);
        } else if (!state.isWatering2 && data.soil2 < state.dryThreshold2 + 10) {
            addLogEntry(`⚠️ Zona 2: Kelembaban ${data.soil2}% mendekati batas kering (${state.dryThreshold2}%)`, 'warning');
        }
    }

    // ============================
    // MAIN DASHBOARD UPDATE
    // ============================
    async function updateDashboard() {
        try {
            const data = await fetchData();
            
            // Update values
            updateValueWithAnimation(document.getElementById('tempValue'), data.temp);
            updateValueWithAnimation(document.getElementById('humValue'), data.hum);
            updateValueWithAnimation(document.getElementById('soil1Value'), data.soil1);
            updateValueWithAnimation(document.getElementById('soil2Value'), data.soil2);
            updateValueWithAnimation(document.getElementById('waterValue'), data.water);
            
            // Update gauge bars
            document.getElementById('waterLevelFill').style.width = `${data.water}%`;
            document.getElementById('soil1LevelFill').style.width = `${data.soil1}%`;
            document.getElementById('soil2LevelFill').style.width = `${data.soil2}%`;
            document.getElementById('tempGaugeFill').style.width = `${Math.min(data.temp * 2, 100)}%`;
            document.getElementById('humGaugeFill').style.width = `${data.hum}%`;
            
            // Update status indicators
            updateStatusIndicators(data);
            
            // Check auto watering
            checkAutoWatering(data);
            
            // Update charts
            const now = new Date();
            const timeString = now.toLocaleTimeString('id-ID', { 
                hour: '2-digit', 
                minute: '2-digit', 
                second: '2-digit' 
            });
            
            timeLabels.push(timeString);
            tempData.push(data.temp);
            humData.push(data.hum);
            soil1Data.push(data.soil1);
            soil2Data.push(data.soil2);
            waterData.push(data.water);
            
            const maxDataPoints = 20;
            if (timeLabels.length > maxDataPoints) {
                timeLabels.shift();
                tempData.shift();
                humData.shift();
                soil1Data.shift();
                soil2Data.shift();
                waterData.shift();
            }
            
            tempChart.update();
            humChart.update();
            soil1Chart.update();
            soil2Chart.update();
            waterChart.update();
            
            // Update metadata
            document.getElementById('lastUpdateTime').textContent = timeString;
            state.dataCounter++;
            document.getElementById('dataCounter').textContent = state.dataCounter;
            state.uptime += state.updateInterval / 1000;
            document.getElementById('uptime').textContent = Math.round(state.uptime);
            
        } catch (error) {
            console.error('Error updating dashboard:', error);
        }
    }

    // ============================
    // SETUP FUNCTIONS
    // ============================
    function setupModeControl() {
        const autoBtn = document.getElementById('autoModeBtn');
        const manualBtn = document.getElementById('manualModeBtn');
        const manualControls = document.getElementById('manualControls');
        const autoSettings = document.getElementById('autoSettings');
        const modeStatus = document.getElementById('currentModeStatus');

        function setMode(mode) {
            state.mode = mode;
            
            [autoBtn, manualBtn].forEach(btn => {
                btn.classList.toggle('active', btn.dataset.mode === mode);
            });
            
            manualControls.style.display = mode === 'manual' ? 'block' : 'none';
            autoSettings.style.display = mode === 'auto' ? 'block' : 'none';
            
            if (mode === 'auto') {
                modeStatus.textContent = 'Otomatis';  // Tanpa icon
                modeStatus.style.color = '#43c51e';
                addLogEntry('Mode berubah ke Otomatis', 'mode-change');
                if (state.pump1On) stopWatering(1);
                if (state.pump2On) stopWatering(2);
            } else {
                modeStatus.textContent = 'Manual';    // Tanpa icon
                modeStatus.style.color = '#ff2626';
                addLogEntry('Mode berubah ke Manual', 'mode-change');
            }
        }

        autoBtn.addEventListener('click', () => setMode('auto'));
        manualBtn.addEventListener('click', () => setMode('manual'));
        setMode('auto');
    }

    function setupManualControls() {
        document.querySelectorAll('.pump-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const pump = parseInt(this.dataset.pump);
                const action = this.dataset.action;
                
                if (state.mode !== 'manual') {
                    addLogEntry(`⚠️ Ganti ke mode manual untuk kontrol manual`, 'warning');
                    return;
                }
                
                if (action === 'on') {
                    startWatering(pump);
                } else if (action === 'off') {
                    stopWatering(pump);
                }
            });
        });
    }

    function setupAutoSettings() {
        // Zone 1
        const dry1 = document.getElementById('dryThreshold1');
        const opt1 = document.getElementById('optimalThreshold1');
        const dur1 = document.getElementById('wateringDuration1');

        dry1.addEventListener('input', function() {
            const val = parseInt(this.value);
            state.dryThreshold1 = val;
            document.getElementById('dryThresholdValue1').textContent = val + '%';
            if (val > state.optimalThreshold1) {
                opt1.value = val + 10;
                state.optimalThreshold1 = val + 10;
                document.getElementById('optimalThresholdValue1').textContent = (val + 10) + '%';
            }
        });

        opt1.addEventListener('input', function() {
            const val = parseInt(this.value);
            state.optimalThreshold1 = val;
            document.getElementById('optimalThresholdValue1').textContent = val + '%';
            if (val < state.dryThreshold1) {
                dry1.value = val - 10;
                state.dryThreshold1 = val - 10;
                document.getElementById('dryThresholdValue1').textContent = (val - 10) + '%';
            }
        });

        dur1.addEventListener('input', function() {
            const val = parseInt(this.value);
            state.wateringDuration1 = val;
            document.getElementById('wateringDurationValue1').textContent = val + ' detik';
        });

        // Zone 2
        const dry2 = document.getElementById('dryThreshold2');
        const opt2 = document.getElementById('optimalThreshold2');
        const dur2 = document.getElementById('wateringDuration2');

        dry2.addEventListener('input', function() {
            const val = parseInt(this.value);
            state.dryThreshold2 = val;
            document.getElementById('dryThresholdValue2').textContent = val + '%';
            if (val > state.optimalThreshold2) {
                opt2.value = val + 10;
                state.optimalThreshold2 = val + 10;
                document.getElementById('optimalThresholdValue2').textContent = (val + 10) + '%';
            }
        });

        opt2.addEventListener('input', function() {
            const val = parseInt(this.value);
            state.optimalThreshold2 = val;
            document.getElementById('optimalThresholdValue2').textContent = val + '%';
            if (val < state.dryThreshold2) {
                dry2.value = val - 10;
                state.dryThreshold2 = val - 10;
                document.getElementById('dryThresholdValue2').textContent = (val - 10) + '%';
            }
        });

        dur2.addEventListener('input', function() {
            const val = parseInt(this.value);
            state.wateringDuration2 = val;
            document.getElementById('wateringDurationValue2').textContent = val + ' detik';
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

        document.getElementById('simulationToggle').addEventListener('change', function() {
            state.simulationMode = this.checked;
            const statusEl = document.getElementById('simulationStatus');
            statusEl.textContent = state.simulationMode ? 'Aktif' : 'Nonaktif';
            statusEl.style.color = state.simulationMode ? '#0077ff' : '#666';
            addLogEntry(`🔧 Mode simulasi ${state.simulationMode ? 'Aktif' : 'Nonaktif'}`, 'mode-change');
        });

        document.getElementById('refreshBtn').addEventListener('click', updateDashboard);

        document.getElementById('resetBtn').addEventListener('click', function() {
            timeLabels = [];
            tempData = [];
            humData = [];
            soil1Data = [];
            soil2Data = [];
            waterData = [];
            
            tempChart.update();
            humChart.update();
            soil1Chart.update();
            soil2Chart.update();
            waterChart.update();
            
            state.dataCounter = 0;
            document.getElementById('dataCounter').textContent = state.dataCounter;
            state.uptime = 0;
            document.getElementById('uptime').textContent = state.uptime;
            
            addLogEntry('🔄 Data grafik direset', 'info');
        });
    }

    // ============================
    // INITIALIZATION
    // ============================
    function initializeDashboard() {
        if (!localStorage.getItem('isLoggedIn')) {
            window.location.href = 'login.html';
            return;
        }

        displayUsername();
        setupLogout();
        setupAutoLogout();
        
        initCharts();
        setupModeControl();
        setupManualControls();
        setupAutoSettings();
        setupCommonControls();
        
        updateDashboard();
        window.updateIntervalId = setInterval(updateDashboard, state.updateInterval);
        
        addLogEntry('🚀 Smart Greenhouse Dual Control siap digunakan', 'info');
        addLogEntry(`🌱 Mode: ${state.mode === 'auto' ? 'Otomatis' : 'Manual'}`, 'mode-change');
        addLogEntry(`🔧 Zona 1 - Kering: ${state.dryThreshold1}% | Optimal: ${state.optimalThreshold1}%`, 'info');
        addLogEntry(`🔧 Zona 2 - Kering: ${state.dryThreshold2}% | Optimal: ${state.optimalThreshold2}%`, 'info');
        
        console.log('Smart Greenhouse Dual Control loaded successfully!');
    }

    // ============================
    // LOAD DUMMY DATA
    // ============================
    function loadDummyData() {
        for (let i = 0; i < 5; i++) {
            const dummy = generateSimulatedData();
            const time = new Date();
            time.setMinutes(time.getMinutes() - (5 - i));
            
            timeLabels.push(time.toLocaleTimeString('id-ID', { 
                hour: '2-digit', 
                minute: '2-digit' 
            }));
            tempData.push(dummy.temp);
            humData.push(dummy.hum);
            soil1Data.push(dummy.soil1);
            soil2Data.push(dummy.soil2);
            waterData.push(dummy.water);
        }
        
        tempChart.update();
        humChart.update();
        soil1Chart.update();
        soil2Chart.update();
        waterChart.update();
    }

    // Start
    initializeDashboard();
    setTimeout(loadDummyData, 500);
});
