// Dashboard Monitoring ESP32 - JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // Inisialisasi variabel
    let tempChart, humChart;
    let tempData = [];
    let humData = [];
    let waterData = [];
    let timeLabels = [];
    let updateInterval = 2000;
    let dataCounter = 0;
    let simulationMode = true;
    let uptime = 0;
    
    // Element references
    const tempValueEl = document.getElementById('tempValue');
    const humValueEl = document.getElementById('humValue');
    const waterValueEl = document.getElementById('waterValue');
    const waterLevelFillEl = document.getElementById('waterLevelFill');
    const waterStatusEl = document.getElementById('waterStatus');
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
                label: 'Suhu (°C)',
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
    
    // Inisialisasi grafik kelembaban
    const humCtx = document.getElementById('humChart').getContext('2d');
    humChart = new Chart(humCtx, {
        type: 'line',
        data: {
            labels: timeLabels,
            datasets: [{
                label: 'Kelembaban (%)',
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
    
    // Fungsi untuk menghasilkan data simulasi
    function generateSimulatedData() {
        const baseTemp = 25 + (Math.random() * 5 - 2.5); // 22.5-27.5°C
        const baseHum = 50 + (Math.random() * 20 - 10); // 40-60%
        const baseWater = 30 + (Math.random() * 50); // 30-80%
        
        return {
            temp: parseFloat(baseTemp.toFixed(1)),
            hum: parseFloat(baseHum.toFixed(1)),
            water: Math.round(baseWater)
        };
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
            
            // Update nilai pada kartu
            tempValueEl.textContent = data.temp;
            humValueEl.textContent = data.hum;
            waterValueEl.textContent = data.water;
            waterLevelFillEl.style.width = `${data.water}%`;
            
            // Update status berdasarkan nilai
            updateStatusIndicators(data);
            
            // Tambahkan data ke grafik
            const now = new Date();
            const timeString = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            
            timeLabels.push(timeString);
            tempData.push(data.temp);
            humData.push(data.hum);
            waterData.push(data.water);
            
            // Batasi data grafik ke 20 titik terakhir
            const maxDataPoints = 20;
            if (timeLabels.length > maxDataPoints) {
                timeLabels.shift();
                tempData.shift();
                humData.shift();
                waterData.shift();
            }
            
            // Update grafik
            tempChart.update();
            humChart.update();
            
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
        // Status suhu
        if (data.temp < 20) {
            tempStatusEl.textContent = 'Dingin';
            tempStatusEl.style.color = '#4d96ff';
        } else if (data.temp > 30) {
            tempStatusEl.textContent = 'Panas';
            tempStatusEl.style.color = '#ff6b6b';
        } else {
            tempStatusEl.textContent = 'Normal';
            tempStatusEl.style.color = '#36d9d6';
        }
        
        // Status kelembaban
        if (data.hum < 40) {
            humStatusEl.textContent = 'Kering';
            humStatusEl.style.color = '#ffa726';
        } else if (data.hum > 70) {
            humStatusEl.textContent = 'Lembab';
            humStatusEl.style.color = '#4d96ff';
        } else {
            humStatusEl.textContent = 'Normal';
            humStatusEl.style.color = '#36d9d6';
        }
        
        // Status level air
        if (data.water < 20) {
            waterStatusEl.innerHTML = '<i class="fas fa-exclamation-triangle"></i><span>Rendah</span>';
            waterStatusEl.style.color = '#ff6b6b';
            waterLevelFillEl.style.background = 'linear-gradient(90deg, #ff6b6b, #ffa726)';
        } else if (data.water > 80) {
            waterStatusEl.innerHTML = '<i class="fas fa-check-circle"></i><span>Tinggi</span>';
            waterStatusEl.style.color = '#00cc66';
            waterLevelFillEl.style.background = 'linear-gradient(90deg, #00cc66, #36d9d6)';
        } else {
            waterStatusEl.innerHTML = '<i class="fas fa-check-circle"></i><span>Normal</span>';
            waterStatusEl.style.color = '#36d9d6';
            waterLevelFillEl.style.background = 'linear-gradient(90deg, #36d9d6, #4d96ff)';
        }
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
        waterData = [];
        
        // Reset grafik
        tempChart.data.labels = timeLabels;
        tempChart.data.datasets[0].data = tempData;
        tempChart.update();
        
        humChart.data.labels = timeLabels;
        humChart.data.datasets[0].data = humData;
        humChart.update();
        
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
            
            timeLabels.push(time.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
            tempData.push(dummyData.temp);
            humData.push(dummyData.hum);
            waterData.push(dummyData.water);
        }
        
        // Update grafik dengan data dummy
        tempChart.update();
        humChart.update();
    }, 500);
});