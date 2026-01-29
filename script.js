// Dashboard Monitoring ESP32 - JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // Fungsi untuk menampilkan username
    function displayUsername() {
        const username = localStorage.getItem('username') || 'Admin';
        document.getElementById('currentUser').textContent = username;
    }

    // Fungsi logout
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

    // Inisialisasi variabel
    let tempChart, humChart, soilChart, waterChart;
    let tempData = [], humData = [], soilData = [], waterData = [], timeLabels = [];
    let updateInterval = 2000;
    let dataCounter = 0;
    let simulationMode = true;
    let uptime = 0;
    
    // Element references
    const tempValueEl = document.getElementById('tempValue');
    const humValueEl = document.getElementById('humValue');
    const waterValueEl = document.getElementById('waterValue');
    const soilValueEl = document.getElementById('soilValue');
    const waterLevelFillEl = document.getElementById('waterLevelFill');
    const soilLevelFillEl = document.getElementById('soilLevelFill');
    const waterStatusEl = document.getElementById('waterStatus');
    const soilStatusEl = document.getElementById('soilStatus');
    const soilRecommendationEl = document.getElementById('soilRecommendation');
    const tempStatusEl = document.getElementById('tempStatus');
    const humStatusEl = document.getElementById('humStatus');
    const lastUpdateTimeEl = document.getElementById('lastUpdateTime');
    const updateIntervalEl = document.getElementById('updateInterval');
    const simulationToggleEl = document.getElementById('simulationToggle');
    const refreshBtn = document.getElementById('refreshBtn');
    const resetBtn = document.getElementById('resetBtn');
    const simulationStatusEl = document.getElementById('simulationStatus');
    const dataCounterEl = document.getElementById('dataCounter');
    const uptimeEl = document.getElementById('uptime');
    
    // Konfigurasi Chart.js
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
    
    // Inisialisasi grafik suhu
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
    
    // Inisialisasi grafik kelembaban udara
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
    
    // Inisialisasi grafik kelembaban tanah
    const soilCtx = document.getElementById('soilChart').getContext('2d');
    soilChart = new Chart(soilCtx, {
        type: 'line',
        data: {
            labels: timeLabels,
            datasets: [{
                label: 'Kelembaban Tanah (%)',
                data: soilData,
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
    
    // Inisialisasi grafik level air
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
    
    // Fungsi untuk menghasilkan data simulasi
    function generateSimulatedData() {
        const baseTemp = 25 + (Math.random() * 5 - 2.5); // 22.5-27.5°C
        const baseHum = 50 + (Math.random() * 20 - 10); // 40-60%
        const baseSoil = 30 + (Math.random() * 50); // 30-80%
        const baseWater = 40 + (Math.random() * 40); // 40-80%
        
        return {
            temp: parseFloat(baseTemp.toFixed(1)),
            hum: parseFloat(baseHum.toFixed(1)),
            soil: Math.round(baseSoil),
            water: Math.round(baseWater)
        };
    }
    
    // Fungsi untuk memperbarui nilai dengan animasi
    function updateValueWithAnimation(element, newValue) {
        const oldValue = element.textContent;
        if (oldValue !== newValue) {
            element.textContent = newValue;
            element.style.animation = 'none';
            element.offsetHeight; // Trigger reflow
            element.style.animation = 'valueUpdate 0.8s ease';
            setTimeout(() => {
                element.style.animation = '';
            }, 800);
        } else {
            element.textContent = newValue;
        }
    }

    // Fungsi untuk mengambil data dari ESP32 (atau simulasi)
    async function fetchData() {
        if (simulationMode) {
            // Mode simulasi: generate data acak
            return new Promise(resolve => {
                setTimeout(() => {
                    resolve(generateSimulatedData());
                }, 300);
            });
        } else {
            // Mode nyata: ambil data dari ESP32
            try {
                // Ganti URL ini dengan IP address ESP32 Anda
                const response = await fetch('http://192.168.1.100/data');
                if (!response.ok) throw new Error('Gagal mengambil data');
                return await response.json();
            } catch (error) {
                console.error('Error fetching data:', error);
                // Fallback ke mode simulasi jika gagal
                return generateSimulatedData();
            }
        }
    }
    
    // Fungsi untuk memperbarui dashboard dengan data baru
    async function updateDashboard() {
        try {
            const data = await fetchData();
            
            // Update nilai pada kartu dengan animasi
            updateValueWithAnimation(tempValueEl, data.temp);
            updateValueWithAnimation(humValueEl, data.hum);
            updateValueWithAnimation(waterValueEl, data.water);
            updateValueWithAnimation(soilValueEl, data.soil);
            
            // Update indikator level
            waterLevelFillEl.style.width = `${data.water}%`;
            soilLevelFillEl.style.width = `${data.soil}%`;

            // Update gauge bars for temperature and humidity
            const tempGaugeFillEl = document.getElementById('tempGaugeFill');
            const humGaugeFillEl = document.getElementById('humGaugeFill');
            if (tempGaugeFillEl) tempGaugeFillEl.style.width = `${Math.min(data.temp * 2, 100)}%`;
            if (humGaugeFillEl) humGaugeFillEl.style.width = `${data.hum}%`;
            
            // Update status berdasarkan nilai
            updateStatusIndicators(data);
            
            // Tambahkan data ke grafik
            const now = new Date();
            const timeString = now.toLocaleTimeString('id-ID', { 
                hour: '2-digit', 
                minute: '2-digit', 
                second: '2-digit' 
            });
            
            timeLabels.push(timeString);
            tempData.push(data.temp);
            humData.push(data.hum);
            soilData.push(data.soil);
            waterData.push(data.water);
            
            // Batasi data grafik ke 20 titik terakhir
            const maxDataPoints = 20;
            if (timeLabels.length > maxDataPoints) {
                timeLabels.shift();
                tempData.shift();
                humData.shift();
                soilData.shift();
                waterData.shift();
            }
            
            // Update semua grafik
            tempChart.update();
            humChart.update();
            soilChart.update();
            waterChart.update();
            
            // Update informasi lainnya
            lastUpdateTimeEl.textContent = timeString;
            dataCounter++;
            dataCounterEl.textContent = dataCounter;
            
            // Update uptime
            uptime += updateInterval / 1000;
            uptimeEl.textContent = Math.round(uptime);
            
        } catch (error) {
            console.error('Error updating dashboard:', error);
        }
    }
    
    // Fungsi untuk memperbarui indikator status
    function updateStatusIndicators(data) {
        // Fungsi untuk memperbarui condition markers
        function updateConditionMarkers(container, activeCondition) {
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

        // Status suhu udara
        let tempCondition = 'normal';
        if (data.temp < 20) {
            tempStatusEl.textContent = 'Dingin';
            tempStatusEl.style.color = '#4d96ff';
            tempCondition = 'cold';
        } else if (data.temp > 30) {
            tempStatusEl.textContent = 'Panas';
            tempStatusEl.style.color = '#ff6b6b';
            tempCondition = 'hot';
        } else {
            tempStatusEl.textContent = 'Normal';
            tempStatusEl.style.color = '#36d9d6';
            tempCondition = 'normal';
        }
        updateConditionMarkers(document.querySelector('.temp-condition-markers'), tempCondition);

        // Status kelembaban udara
        let humCondition = 'normal';
        if (data.hum < 40) {
            humStatusEl.textContent = 'Kering';
            humStatusEl.style.color = '#ffa726';
            humCondition = 'dry';
        } else if (data.hum > 70) {
            humStatusEl.textContent = 'Lembab';
            humStatusEl.style.color = '#4d96ff';
            humCondition = 'wet';
        } else {
            humStatusEl.textContent = 'Normal';
            humStatusEl.style.color = '#36d9d6';
            humCondition = 'normal';
        }
        updateConditionMarkers(document.querySelector('.hum-condition-markers'), humCondition);

        // Status kelembaban tanah
        let soilCondition = 'optimal';
        if (data.soil < 30) {
            soilStatusEl.textContent = 'Kering';
            soilStatusEl.style.color = '#D2691E';
            soilRecommendationEl.innerHTML = '<i class="fas fa-exclamation-triangle"></i><span>Butuh penyiraman</span>';
            soilRecommendationEl.style.color = '#D2691E';
            soilCondition = 'dry';
        } else if (data.soil > 70) {
            soilStatusEl.textContent = 'Basah';
            soilStatusEl.style.color = '#006400';
            soilRecommendationEl.innerHTML = '';
            soilRecommendationEl.style.color = '#006400';
            soilCondition = 'wet';
        } else {
            soilStatusEl.textContent = 'Optimal';
            soilStatusEl.style.color = '#228B22';
            soilRecommendationEl.innerHTML = '';
            soilRecommendationEl.style.color = '#228B22';
            soilCondition = 'optimal';
        }
        updateConditionMarkers(document.querySelector('.soil-level-markers'), soilCondition);

        // Status level air
        let waterCondition = 'normal';
        if (data.water < 20) {
            waterStatusEl.innerHTML = '<i class="fas fa-exclamation-triangle"></i><span>Rendah</span>';
            waterStatusEl.style.color = '#ff6b6b';
            waterLevelFillEl.style.background = 'linear-gradient(90deg, #ff6b6b, #ffa726)';
            waterCondition = 'low';
        } else if (data.water > 80) {
            waterStatusEl.innerHTML = '<i class="fas fa-check-circle"></i><span>Tinggi</span>';
            waterStatusEl.style.color = '#00cc66';
            waterLevelFillEl.style.background = 'linear-gradient(90deg, #00cc66, #36d9d6)';
            waterCondition = 'high';
        } else {
            waterStatusEl.innerHTML = '<i class="fas fa-check-circle"></i><span>Normal</span>';
            waterStatusEl.style.color = '#36d9d6';
            waterLevelFillEl.style.background = 'linear-gradient(90deg, #36d9d6, #4d96ff)';
            waterCondition = 'normal';
        }
        updateConditionMarkers(document.querySelector('.water-level-markers'), waterCondition);
    }
    
    // Fungsi untuk mengatur interval pembaruan data
    function setupUpdateInterval() {
        // Hentikan interval sebelumnya jika ada
        if (window.updateIntervalId) {
            clearInterval(window.updateIntervalId);
        }
        
        // Atur interval baru
        window.updateIntervalId = setInterval(updateDashboard, updateInterval);
    }
    
    // Event Listeners
    updateIntervalEl.addEventListener('change', function() {
        updateInterval = parseInt(this.value);
        setupUpdateInterval();
    });
    
    simulationToggleEl.addEventListener('change', function() {
        simulationMode = this.checked;
        simulationStatusEl.textContent = simulationMode ? 'Aktif' : 'Nonaktif';
        simulationStatusEl.style.color = simulationMode ? '#0077ff' : '#666';
    });
    
    refreshBtn.addEventListener('click', updateDashboard);
    
    resetBtn.addEventListener('click', function() {
        // Reset data grafik
        timeLabels = [];
        tempData = [];
        humData = [];
        soilData = [];
        waterData = [];
        
        // Reset semua grafik
        tempChart.data.labels = timeLabels;
        tempChart.data.datasets[0].data = tempData;
        tempChart.update();
        
        humChart.data.labels = timeLabels;
        humChart.data.datasets[0].data = humData;
        humChart.update();
        
        soilChart.data.labels = timeLabels;
        soilChart.data.datasets[0].data = soilData;
        soilChart.update();
        
        waterChart.data.labels = timeLabels;
        waterChart.data.datasets[0].data = waterData;
        waterChart.update();
        
        // Reset counter
        dataCounter = 0;
        dataCounterEl.textContent = dataCounter;
        
        // Reset uptime
        uptime = 0;
        uptimeEl.textContent = uptime;
    });
    
    // Event listeners untuk tombol kontrol grafik
    document.querySelectorAll('.chart-btn').forEach(button => {
        button.addEventListener('click', function() {
            // Hapus kelas active dari semua tombol
            document.querySelectorAll('.chart-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            
            // Tambahkan kelas active ke tombol yang diklik
            this.classList.add('active');
            
            // Di sini Anda bisa menambahkan logika untuk mengubah rentang waktu grafik
            const timeRange = this.getAttribute('data-time');
            console.log(`Mengubah rentang grafik ke: ${timeRange}`);
        });
    });
    
    // Inisialisasi pertama
    function initializeDashboard() {
        // Cek apakah user sudah login
        if (!localStorage.getItem('isLoggedIn')) {
            window.location.href = 'login.html';
            return;
        }

        // Tampilkan username
        displayUsername();

        // Setup logout
        setupLogout();
        
        // Set nilai awal
        updateDashboard();
        
        // Atur interval pembaruan
        setupUpdateInterval();
        
        // Update waktu awal
        const now = new Date();
        lastUpdateTimeEl.textContent = now.toLocaleTimeString('id-ID', { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit' 
        });
        
        console.log('Dashboard ESP32 telah dimuat dengan sukses!');
        
        // Setup auto logout setelah 30 menit tidak aktif
        setupAutoLogout();
    }
    
    // Fungsi untuk auto logout setelah 30 menit tidak aktif
    function setupAutoLogout() {
        let inactivityTimer;
        
        function resetInactivityTimer() {
            clearTimeout(inactivityTimer);
            inactivityTimer = setTimeout(logoutDueToInactivity, 30 * 60 * 1000); // 30 menit
        }
        
        function logoutDueToInactivity() {
            alert('Sesi telah berakhir karena tidak ada aktivitas. Silakan login kembali.');
            localStorage.removeItem('isLoggedIn');
            localStorage.removeItem('username');
            window.location.href = 'login.html';
        }
        
        // Deteksi aktivitas user
        document.addEventListener('mousemove', resetInactivityTimer);
        document.addEventListener('keypress', resetInactivityTimer);
        document.addEventListener('click', resetInactivityTimer);
        
        // Mulai timer saat halaman dimuat
        resetInactivityTimer();
    }
    
    // Jalankan inisialisasi
    initializeDashboard();
    
    // Tambahkan data dummy untuk mengisi grafik awal
    setTimeout(() => {
        // Generate data dummy untuk 5 titik pertama
        for (let i = 0; i < 5; i++) {
            const dummyData = generateSimulatedData();
            const time = new Date();
            time.setMinutes(time.getMinutes() - (5 - i));
            
            timeLabels.push(time.toLocaleTimeString('id-ID', { 
                hour: '2-digit', 
                minute: '2-digit' 
            }));
            tempData.push(dummyData.temp);
            humData.push(dummyData.hum);
            soilData.push(dummyData.soil);
            waterData.push(dummyData.water);
        }
        
        // Update semua grafik dengan data dummy
        tempChart.update();
        humChart.update();
        soilChart.update();
        waterChart.update();
    }, 500);
});