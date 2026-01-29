// Dashboard Monitoring ESP32 - JavaScript Lengkap
document.addEventListener('DOMContentLoaded', function() {
    // ===== SISTEM LOGIN =====
    if (document.querySelector('.login-page')) {
        initializeLogin();
        return;
    }
    
    // ===== DASHBOARD =====
    initializeDashboard();
});

// ===== FUNGSI SISTEM LOGIN =====
function initializeLogin() {
    const loginForm = document.getElementById('loginForm');
    const togglePassword = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');
    const loginBtn = document.querySelector('.login-btn');
    const btnContent = document.querySelector('.btn-content');
    const btnLoader = document.querySelector('.btn-loader');
    const rememberMe = document.getElementById('rememberMe');
    
    // Cek jika user sudah login
    if (localStorage.getItem('isLoggedIn') === 'true') {
        redirectToDashboard();
        return;
    }
    
    // Toggle password visibility
    togglePassword.addEventListener('click', function() {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        this.innerHTML = type === 'password' ? '<i class="fas fa-eye"></i>' : '<i class="fas fa-eye-slash"></i>';
    });
    
    // Handle form submission
    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        
        // Validasi input
        if (!username || !password) {
            showLoginMessage('Harap isi semua field!', 'error');
            return;
        }
        
        // Tampilkan loading
        btnContent.style.display = 'none';
        btnLoader.style.display = 'flex';
        loginBtn.disabled = true;
        
        // Simulasi proses login
        setTimeout(() => {
            // Cek credentials (dalam real app, ini akan ke server)
            if (username === 'admin' && password === 'admin123') {
                // Simpan status login
                localStorage.setItem('isLoggedIn', 'true');
                localStorage.setItem('username', username);
                
                if (rememberMe.checked) {
                    localStorage.setItem('rememberMe', 'true');
                }
                
                // Tampilkan sukses
                showLoginMessage('Login berhasil! Mengarahkan ke dashboard...', 'success');
                
                // Animasi sukses
                loginBtn.classList.add('animate__animated', 'animate__pulse');
                
                // Redirect ke dashboard setelah delay
                setTimeout(() => {
                    redirectToDashboard();
                }, 1500);
            } else {
                // Tampilkan error
                showLoginMessage('Username atau password salah!', 'error');
                
                // Reset button
                btnContent.style.display = 'flex';
                btnLoader.style.display = 'none';
                loginBtn.disabled = false;
                
                // Shake animation pada form
                loginForm.classList.add('animate__animated', 'animate__shakeX');
                setTimeout(() => {
                    loginForm.classList.remove('animate__animated', 'animate__shakeX');
                }, 1000);
            }
        }, 1500);
    });
    
    // Pre-fill jika ada data remember me
    if (localStorage.getItem('rememberMe') === 'true') {
        document.getElementById('username').value = 'admin';
        rememberMe.checked = true;
    }
    
    // Animasi input focus
    const inputs = document.querySelectorAll('input');
    inputs.forEach(input => {
        input.addEventListener('focus', function() {
            this.parentElement.classList.add('focused');
        });
        
        input.addEventListener('blur', function() {
            if (!this.value) {
                this.parentElement.classList.remove('focused');
            }
        });
    });
    
    // Tambahkan particle background
    createParticles();
}

function showLoginMessage(message, type) {
    // Hapus pesan sebelumnya
    const existingMessage = document.querySelector('.login-status-message');
    if (existingMessage) {
        existingMessage.remove();
    }
    
    // Buat elemen pesan baru
    const messageEl = document.createElement('div');
    messageEl.className = `login-status-message ${type}`;
    messageEl.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    
    // Tambahkan sebelum form
    const loginForm = document.getElementById('loginForm');
    loginForm.parentNode.insertBefore(messageEl, loginForm.nextSibling);
    
    // Tampilkan dengan animasi
    setTimeout(() => {
        messageEl.style.display = 'block';
    }, 10);
    
    // Auto remove setelah 5 detik
    setTimeout(() => {
        messageEl.style.opacity = '0';
        messageEl.style.transform = 'translateY(-10px)';
        setTimeout(() => {
            if (messageEl.parentNode) {
                messageEl.remove();
            }
        }, 300);
    }, 5000);
}

function redirectToDashboard() {
    // Simpan timestamp login untuk session management
    localStorage.setItem('loginTime', new Date().getTime());
    
    // Redirect ke dashboard
    window.location.href = 'dashboard.html';
}

function createParticles() {
    const container = document.createElement('div');
    container.className = 'login-particle-bg';
    
    // Buat beberapa partikel
    for (let i = 0; i < 4; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        container.appendChild(particle);
    }
    
    // Tambahkan ke body
    document.body.appendChild(container);
}

// ===== FUNGSI DASHBOARD =====
function initializeDashboard() {
    // Cek jika user sudah login
    if (localStorage.getItem('isLoggedIn') !== 'true') {
        window.location.href = 'index.html';
        return;
    }
    
    // Cek session timeout (8 jam)
    const loginTime = parseInt(localStorage.getItem('loginTime') || '0');
    const currentTime = new Date().getTime();
    const eightHours = 8 * 60 * 60 * 1000;
    
    if (currentTime - loginTime > eightHours) {
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('loginTime');
        showNotification('Session expired. Silakan login kembali.', 'warning');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);
        return;
    }
    
    // Inisialisasi variabel
    let tempChart, humChart, soilChart, allChart;
    let tempData = [], humData = [], soilData = [], allTempData = [], allHumData = [], allSoilData = [];
    let timeLabels = [];
    let updateInterval = 2000;
    let dataCounter = 0;
    let simulationMode = true;
    let uptime = 0;
    let chartTimeRange = '1h';
    let isAutoWatering = false;
    let wateringThreshold = 40;
    
    // Element references
    const loggedUserEl = document.getElementById('loggedUser');
    const userDropdown = document.getElementById('userDropdown');
    const userMenuBtn = document.getElementById('userMenuBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const notificationBtn = document.getElementById('notificationBtn');
    const notificationModal = document.getElementById('notificationModal');
    const tempValueEl = document.getElementById('tempValue');
    const humValueEl = document.getElementById('humValue');
    const soilValueEl = document.getElementById('soilValue');
    const waterValueEl = document.getElementById('waterValue');
    const tempStatusEl = document.getElementById('tempStatus');
    const humStatusEl = document.getElementById('humStatus');
    const soilStatusEl = document.getElementById('soilStatus');
    const waterStatusEl = document.getElementById('waterStatus');
    const waterAlertEl = document.getElementById('waterAlert');
    const waterTankFillEl = document.getElementById('waterTankFill');
    const soilMoistureFillEl = document.getElementById('soilMoistureFill');
    const soilIndicatorEl = document.getElementById('soilIndicator');
    const humidityFillEl = document.getElementById('humidityFill');
    const lastUpdateTimeEl = document.getElementById('lastUpdateTime');
    const updateIntervalEl = document.getElementById('updateInterval');
    const simulationToggleEl = document.getElementById('simulationToggle');
    const simulationLabelEl = document.getElementById('simulationLabel');
    const refreshBtn = document.getElementById('refreshBtn');
    const resetBtn = document.getElementById('resetBtn');
    const exportBtn = document.getElementById('exportBtn');
    const simulationStatusEl = document.getElementById('simulationStatus');
    const dataCounterEl = document.getElementById('dataCounter');
    const uptimeEl = document.getElementById('uptime');
    const tempLastUpdateEl = document.getElementById('tempLastUpdate');
    const humLastUpdateEl = document.getElementById('humLastUpdate');
    const soilLastUpdateEl = document.getElementById('soilLastUpdate');
    const dataVariationEl = document.getElementById('dataVariation');
    const variationValueEl = document.getElementById('variationValue');
    const themeSelectEl = document.getElementById('themeSelect');
    const notificationToggleEl = document.getElementById('notificationToggle');
    const autoWateringToggleEl = document.getElementById('autoWateringToggle');
    const humidityThresholdEl = document.getElementById('humidityThreshold');
    const thresholdValueEl = document.getElementById('thresholdValue');
    const wateringTimeEl = document.getElementById('wateringTime');
    const setScheduleBtn = document.getElementById('setScheduleBtn');
    const systemStatusEl = document.getElementById('systemStatus');
    
    // Preloader
    const preloader = document.querySelector('.preloader');
    
    // Set username dari localStorage
    const username = localStorage.getItem('username') || 'Administrator';
    loggedUserEl.textContent = username;
    
    // Hide preloader setelah halaman dimuat
    setTimeout(() => {
        preloader.style.opacity = '0';
        setTimeout(() => {
            preloader.style.display = 'none';
            
            // Tampilkan welcome notification
            showNotification(`Selamat datang, ${username}! Dashboard siap digunakan.`, 'success', 'Login Berhasil');
        }, 500);
    }, 1500);
    
    // Inisialisasi Chart.js
    initializeCharts();
    
    // Event Listeners untuk UI
    setupEventListeners();
    
    // Inisialisasi dashboard
    initializeDashboardData();
    
    // ===== FUNCTIONS DASHBOARD =====
    
    function initializeCharts() {
        // Konfigurasi umum untuk chart
        const chartOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        color: 'rgba(255, 255, 255, 0.8)',
                        font: {
                            size: 12
                        }
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(30, 41, 59, 0.9)',
                    titleColor: '#f1f5f9',
                    bodyColor: '#cbd5e1',
                    borderColor: '#475569',
                    borderWidth: 1,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += context.parsed.y;
                                if (context.dataset.label.includes('Suhu')) {
                                    label += '°C';
                                } else {
                                    label += '%';
                                }
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.6)',
                        maxTicksLimit: 10
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.6)'
                    },
                    beginAtZero: true
                }
            },
            interaction: {
                intersect: false,
                mode: 'nearest'
            },
            animations: {
                tension: {
                    duration: 1000,
                    easing: 'linear'
                }
            }
        };
        
        // Grafik Suhu
        const tempCtx = document.getElementById('tempChartCanvas').getContext('2d');
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
            options: {
                ...chartOptions,
                scales: {
                    ...chartOptions.scales,
                    y: {
                        ...chartOptions.scales.y,
                        min: 15,
                        max: 35,
                        title: {
                            display: true,
                            text: 'Suhu (°C)',
                            color: 'rgba(255, 255, 255, 0.7)'
                        }
                    }
                }
            }
        });
        
        // Grafik Kelembaban Udara
        const humCtx = document.getElementById('humChartCanvas').getContext('2d');
        humChart = new Chart(humCtx, {
            type: 'line',
            data: {
                labels: timeLabels,
                datasets: [{
                    label: 'Kelembaban Udara (%)',
                    data: humData,
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
            options: {
                ...chartOptions,
                scales: {
                    ...chartOptions.scales,
                    y: {
                        ...chartOptions.scales.y,
                        min: 30,
                        max: 80,
                        title: {
                            display: true,
                            text: 'Kelembaban (%)',
                            color: 'rgba(255, 255, 255, 0.7)'
                        }
                    }
                }
            }
        });
        
        // Grafik Kelembaban Tanah
        const soilCtx = document.getElementById('soilChartCanvas').getContext('2d');
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
            options: {
                ...chartOptions,
                scales: {
                    ...chartOptions.scales,
                    y: {
                        ...chartOptions.scales.y,
                        max: 100,
                        title: {
                            display: true,
                            text: 'Kelembaban Tanah (%)',
                            color: 'rgba(255, 255, 255, 0.7)'
                        }
                    }
                }
            }
        });
        
        // Grafik Semua Data
        const allCtx = document.getElementById('allChartCanvas').getContext('2d');
        allChart = new Chart(allCtx, {
            type: 'line',
            data: {
                labels: timeLabels,
                datasets: [
                    {
                        label: 'Suhu (°C)',
                        data: allTempData,
                        borderColor: '#ff6b6b',
                        backgroundColor: 'rgba(255, 107, 107, 0.1)',
                        borderWidth: 2,
                        tension: 0.4,
                        yAxisID: 'y',
                        fill: false
                    },
                    {
                        label: 'Kelembaban Udara (%)',
                        data: allHumData,
                        borderColor: '#36d9d6',
                        backgroundColor: 'rgba(54, 217, 214, 0.1)',
                        borderWidth: 2,
                        tension: 0.4,
                        yAxisID: 'y1',
                        fill: false
                    },
                    {
                        label: 'Kelembaban Tanah (%)',
                        data: allSoilData,
                        borderColor: '#8B4513',
                        backgroundColor: 'rgba(139, 69, 19, 0.1)',
                        borderWidth: 2,
                        tension: 0.4,
                        yAxisID: 'y',
                        fill: false
                    }
                ]
            },
            options: {
                ...chartOptions,
                scales: {
                    x: chartOptions.scales.x,
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)'
                        },
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.6)'
                        },
                        title: {
                            display: true,
                            text: 'Suhu (°C) & Kelembaban Tanah (%)',
                            color: 'rgba(255, 255, 255, 0.7)'
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        grid: {
                            drawOnChartArea: false
                        },
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.6)'
                        },
                        title: {
                            display: true,
                            text: 'Kelembaban Udara (%)',
                            color: 'rgba(255, 255, 255, 0.7)'
                        }
                    }
                }
            }
        });
        
        // Mini chart untuk kartu suhu
        const tempMiniCtx = document.getElementById('tempMiniChart');
        if (tempMiniCtx) {
            new Chart(tempMiniCtx.getContext('2d'), {
                type: 'line',
                data: {
                    labels: ['', '', '', '', ''],
                    datasets: [{
                        data: [25, 26, 25.5, 26.5, 27],
                        borderColor: '#ff6b6b',
                        backgroundColor: 'transparent',
                        borderWidth: 2,
                        tension: 0.4,
                        fill: false
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: { enabled: false }
                    },
                    scales: {
                        x: { display: false },
                        y: { display: false }
                    },
                    elements: {
                        point: { radius: 0 }
                    }
                }
            });
        }
    }
    
    function setupEventListeners() {
        // User dropdown
        userMenuBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            userDropdown.classList.toggle('show');
        });
        
        // Close dropdown ketika klik di luar
        document.addEventListener('click', function() {
            userDropdown.classList.remove('show');
        });
        
        // Logout
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            showNotification('Logout berhasil!', 'success');
            
            setTimeout(() => {
                localStorage.removeItem('isLoggedIn');
                localStorage.removeItem('loginTime');
                window.location.href = 'index.html';
            }, 1000);
        });
        
        // Notification modal
        notificationBtn.addEventListener('click', function() {
            notificationModal.classList.add('show');
        });
        
        notificationModal.addEventListener('click', function(e) {
            if (e.target === notificationModal || e.target.classList.contains('modal-close')) {
                notificationModal.classList.remove('show');
            }
        });
        
        // Chart tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                // Update active tab
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                
                // Show corresponding chart
                const tabId = this.getAttribute('data-tab');
                document.querySelectorAll('.tab-content').forEach(content => {
                    content.classList.remove('active');
                });
                document.getElementById(tabId).classList.add('active');
            });
        });
        
        // Chart time controls
        document.querySelectorAll('.chart-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                // Update active button
                this.parentElement.querySelectorAll('.chart-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                
                // Update time range
                chartTimeRange = this.getAttribute('data-time');
                updateChartDataRange();
            });
        });
        
        // Update interval
        updateIntervalEl.addEventListener('change', function() {
            updateInterval = parseInt(this.value);
            setupUpdateInterval();
            showNotification(`Interval pembaruan diubah menjadi ${updateInterval/1000} detik`, 'info');
        });
        
        // Simulation toggle
        simulationToggleEl.addEventListener('change', function() {
            simulationMode = this.checked;
            simulationLabelEl.textContent = simulationMode ? 'Simulasi' : 'Real';
            simulationStatusEl.textContent = simulationMode ? 'Simulasi' : 'Real-time';
            
            if (simulationMode) {
                simulationStatusEl.className = 'simulation-badge';
                showNotification('Mode simulasi diaktifkan', 'info');
            } else {
                simulationStatusEl.className = '';
                simulationStatusEl.style.background = 'rgba(0, 204, 102, 0.2)';
                simulationStatusEl.style.color = '#00cc66';
                showNotification('Mode real-time diaktifkan. Menghubungkan ke ESP32...', 'success');
            }
        });
        
        // Data variation slider
        dataVariationEl.addEventListener('input', function() {
            variationValueEl.textContent = this.value;
        });
        
        // Theme selector
        themeSelectEl.addEventListener('change', function() {
            changeTheme(this.value);
        });
        
        // Humidity threshold slider
        humidityThresholdEl.addEventListener('input', function() {
            wateringThreshold = parseInt(this.value);
            thresholdValueEl.textContent = this.value + '%';
        });
        
        // Control buttons
        refreshBtn.addEventListener('click', function() {
            updateDashboard();
            this.classList.add('animate__animated', 'animate__rotateIn');
            setTimeout(() => {
                this.classList.remove('animate__animated', 'animate__rotateIn');
            }, 1000);
        });
        
        resetBtn.addEventListener('click', function() {
            resetCharts();
            showNotification('Grafik telah direset', 'warning');
        });
        
        exportBtn.addEventListener('click', function() {
            exportData();
        });
        
        // Auto-watering toggle
        autoWateringToggleEl.addEventListener('change', function() {
            isAutoWatering = this.checked;
            const label = this.nextElementSibling.nextElementSibling;
            label.textContent = this.checked ? 'Aktif' : 'Mati';
            
            if (this.checked) {
                showNotification('Penyiraman otomatis diaktifkan', 'success');
            } else {
                showNotification('Penyiraman otomatis dimatikan', 'warning');
            }
        });
        
        // Set watering schedule
        setScheduleBtn.addEventListener('click', function() {
            const time = wateringTimeEl.value;
            if (time) {
                showNotification(`Jadwal penyiraman diatur pukul ${time}`, 'success');
                // Di sini bisa ditambahkan kode untuk mengirim jadwal ke ESP32
            }
        });
        
        // Card menu buttons
        document.querySelectorAll('.card-menu-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                // Tampilkan menu konteks untuk kartu
                showCardMenu(this);
            });
        });
    }
    
    function showCardMenu(button) {
        // Hapus menu sebelumnya jika ada
        const existingMenu = document.querySelector('.card-context-menu');
        if (existingMenu) {
            existingMenu.remove();
        }
        
        // Buat menu konteks
        const menu = document.createElement('div');
        menu.className = 'card-context-menu';
        menu.innerHTML = `
            <button class="menu-item"><i class="fas fa-chart-line"></i> Lihat Detail</button>
            <button class="menu-item"><i class="fas fa-history"></i> Riwayat Data</button>
            <button class="menu-item"><i class="fas fa-bell"></i> Atur Alarm</button>
            <button class="menu-item"><i class="fas fa-cog"></i> Pengaturan</button>
        `;
        
        // Posisikan menu
        const rect = button.getBoundingClientRect();
        menu.style.top = `${rect.bottom + 5}px`;
        menu.style.left = `${rect.left - 150}px`;
        
        document.body.appendChild(menu);
        
        // Tutup menu saat klik di luar
        setTimeout(() => {
            document.addEventListener('click', function closeMenu(e) {
                if (!menu.contains(e.target) && e.target !== button) {
                    menu.remove();
                    document.removeEventListener('click', closeMenu);
                }
            });
        }, 0);
    }
    
    function initializeDashboardData() {
        // Set initial data
        updateDashboard();
        
        // Setup update interval
        setupUpdateInterval();
        
        // Update waktu awal
        updateTime();
        
        // Load sample notifications
        loadNotifications();
        
        // Generate initial chart data
        generateInitialChartData();
        
        console.log('Dashboard ESP32 telah dimuat dengan sukses!');
    }
    
    function generateSimulatedData() {
        const variation = parseInt(dataVariationEl.value);
        const baseTemp = 25 + (Math.random() * variation - variation/2);
        const baseHum = 50 + (Math.random() * variation*2 - variation);
        const baseSoil = 40 + (Math.random() * variation*3 - variation*1.5);
        const baseWater = 30 + (Math.random() * variation*4 - variation*2);
        
        // Simulasi penyiraman otomatis
        let soilValue = Math.max(0, Math.min(100, Math.round(baseSoil)));
        if (isAutoWatering && soilValue < wateringThreshold) {
            // Naikkan kelembaban tanah karena penyiraman otomatis
            soilValue = Math.min(100, soilValue + Math.random() * 20 + 10);
        }
        
        return {
            temp: parseFloat(baseTemp.toFixed(1)),
            hum: parseFloat(baseHum.toFixed(1)),
            soil: soilValue,
            water: Math.max(0, Math.min(100, Math.round(baseWater)))
        };
    }
    
    async function fetchData() {
        if (simulationMode) {
            return new Promise(resolve => {
                setTimeout(() => {
                    resolve(generateSimulatedData());
                }, 300);
            });
        } else {
            try {
                // Ganti dengan IP ESP32 Anda
                const response = await fetch('http://192.168.1.100/data');
                if (!response.ok) throw new Error('Gagal mengambil data');
                const data = await response.json();
                return {
                    temp: data.temp || 0,
                    hum: data.hum || 0,
                    soil: data.soil || 0,
                    water: data.water || 0
                };
            } catch (error) {
                console.error('Error fetching data:', error);
                showNotification('Gagal mengambil data dari ESP32. Beralih ke mode simulasi.', 'error');
                simulationToggleEl.checked = true;
                simulationMode = true;
                simulationLabelEl.textContent = 'Simulasi';
                simulationStatusEl.textContent = 'Simulasi';
                return generateSimulatedData();
            }
        }
    }
    
    async function updateDashboard() {
        try {
            const data = await fetchData();
            
            // Update kartu nilai dengan animasi
            animateValueChange(tempValueEl, data.temp, '°C');
            animateValueChange(humValueEl, data.hum, '%');
            animateValueChange(soilValueEl, data.soil, '%');
            animateValueChange(waterValueEl, data.water, '%');
            
            // Update visual indicators
            waterTankFillEl.style.height = `${data.water}%`;
            soilMoistureFillEl.style.width = `${data.soil}%`;
            if (soilIndicatorEl) {
                soilIndicatorEl.style.left = `calc(${data.soil}% - 15px)`;
            }
            if (humidityFillEl) {
                humidityFillEl.style.height = `${data.hum}%`;
            }
            
            // Update status
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
            allTempData.push(data.temp);
            allHumData.push(data.hum);
            allSoilData.push(data.soil);
            
            // Batasi data grafik
            const maxDataPoints = getMaxDataPointsForRange();
            if (timeLabels.length > maxDataPoints) {
                timeLabels.shift();
                tempData.shift();
                humData.shift();
                soilData.shift();
                allTempData.shift();
                allHumData.shift();
                allSoilData.shift();
            }
            
            // Update grafik
            updateCharts();
            
            // Update informasi lainnya
            lastUpdateTimeEl.textContent = timeString;
            updateLastReadingTimes();
            
            dataCounter++;
            dataCounterEl.textContent = dataCounter;
            
            // Update uptime
            uptime += updateInterval / 1000;
            uptimeEl.textContent = Math.round(uptime);
            
            // Update system status
            updateSystemStatus(data);
            
            // Check for alerts
            checkAlerts(data);
            
        } catch (error) {
            console.error('Error updating dashboard:', error);
        }
    }
    
    function animateValueChange(element, newValue, unit) {
        const oldValue = parseFloat(element.textContent) || 0;
        const container = element.parentElement;
        
        // Add animation class
        container.classList.add('animate__animated', 'animate__pulse');
        
        // Update value
        element.textContent = newValue;
        
        // Remove animation class after animation completes
        setTimeout(() => {
            container.classList.remove('animate__animated', 'animate__pulse');
        }, 1000);
        
        // Color animation for significant changes
        if (Math.abs(newValue - oldValue) > 5) {
            container.style.color = newValue > oldValue ? '#ff6b6b' : '#36d9d6';
            setTimeout(() => {
                container.style.color = '';
            }, 1500);
        }
    }
    
    function updateStatusIndicators(data) {
        // Suhu
        if (data.temp < 20) {
            tempStatusEl.textContent = 'Dingin';
            tempStatusEl.style.background = 'rgba(77, 150, 255, 0.2)';
            tempStatusEl.style.color = '#4d96ff';
        } else if (data.temp > 30) {
            tempStatusEl.textContent = 'Panas';
            tempStatusEl.style.background = 'rgba(255, 107, 107, 0.2)';
            tempStatusEl.style.color = '#ff6b6b';
        } else {
            tempStatusEl.textContent = 'Normal';
            tempStatusEl.style.background = 'rgba(54, 217, 214, 0.2)';
            tempStatusEl.style.color = '#36d9d6';
        }
        
        // Kelembaban Udara
        if (data.hum < 40) {
            humStatusEl.textContent = 'Kering';
            humStatusEl.style.background = 'rgba(255, 167, 38, 0.2)';
            humStatusEl.style.color = '#ffa726';
        } else if (data.hum > 70) {
            humStatusEl.textContent = 'Lembab';
            humStatusEl.style.background = 'rgba(77, 150, 255, 0.2)';
            humStatusEl.style.color = '#4d96ff';
        } else {
            humStatusEl.textContent = 'Normal';
            humStatusEl.style.background = 'rgba(54, 217, 214, 0.2)';
            humStatusEl.style.color = '#36d9d6';
        }
        
        // Kelembaban Tanah
        if (data.soil < 30) {
            soilStatusEl.textContent = 'Kering';
            soilStatusEl.style.background = 'rgba(255, 167, 38, 0.2)';
            soilStatusEl.style.color = '#ffa726';
        } else if (data.soil > 70) {
            soilStatusEl.textContent = 'Basah';
            soilStatusEl.style.background = 'rgba(77, 150, 255, 0.2)';
            soilStatusEl.style.color = '#4d96ff';
        } else {
            soilStatusEl.textContent = 'Optimal';
            soilStatusEl.style.background = 'rgba(0, 204, 102, 0.2)';
            soilStatusEl.style.color = '#00cc66';
        }
        
        // Level Air
        if (data.water < 20) {
            waterStatusEl.style.display = 'none';
            waterAlertEl.style.display = 'flex';
            waterAlertEl.innerHTML = '<i class="fas fa-exclamation-triangle"></i><span>Rendah!</span>';
            waterAlertEl.style.color = '#ff6b6b';
        } else if (data.water > 80) {
            waterStatusEl.style.display = 'flex';
            waterAlertEl.style.display = 'none';
            waterStatusEl.innerHTML = '<i class="fas fa-check-circle"></i><span>Tinggi</span>';
            waterStatusEl.style.color = '#00cc66';
        } else {
            waterStatusEl.style.display = 'flex';
            waterAlertEl.style.display = 'none';
            waterStatusEl.innerHTML = '<i class="fas fa-check-circle"></i><span>Normal</span>';
            waterStatusEl.style.color = '#36d9d6';
        }
    }
    
    function updateSystemStatus(data) {
        let status = 'Normal';
        let statusClass = 'online';
        
        // Periksa semua kondisi
        if (data.temp > 32 || data.water < 20 || data.soil < 20) {
            status = 'Perhatian';
            statusClass = 'warning';
        }
        
        if (data.temp > 35 || data.water < 10) {
            status = 'Kritis';
            statusClass = 'error';
        }
        
        systemStatusEl.textContent = status;
        systemStatusEl.className = statusClass;
    }
    
    function checkAlerts(data) {
        // Periksa kondisi yang memerlukan notifikasi
        const notifications = [];
        
        if (data.water < 20) {
            notifications.push({
                title: 'Level Air Rendah!',
                message: `Level air hanya ${data.water}%. Harap isi ulang.`,
                type: 'warning'
            });
        }
        
        if (data.soil < wateringThreshold && isAutoWatering) {
            notifications.push({
                title: 'Penyiraman Otomatis',
                message: `Kelembaban tanah ${data.soil}% < ${wateringThreshold}%. Sistem penyiraman diaktifkan.`,
                type: 'info'
            });
        }
        
        if (data.temp > 32) {
            notifications.push({
                title: 'Suhu Tinggi',
                message: `Suhu mencapai ${data.temp}°C. Periksa sistem pendingin.`,
                type: 'warning'
            });
        }
        
        if (data.hum > 80) {
            notifications.push({
                title: 'Kelembaban Tinggi',
                message: `Kelembaban udara ${data.hum}%. Ventilasi mungkin diperlukan.`,
                type: 'info'
            });
        }
        
        // Tampilkan notifikasi
        notifications.forEach(notif => {
            if (notificationToggleEl.checked) {
                showNotification(notif.message, notif.type, notif.title);
            }
        });
    }
    
    function updateLastReadingTimes() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('id-ID', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        if (tempLastUpdateEl) tempLastUpdateEl.textContent = timeString;
        if (humLastUpdateEl) humLastUpdateEl.textContent = timeString;
        if (soilLastUpdateEl) soilLastUpdateEl.textContent = timeString;
    }
    
    function updateCharts() {
        tempChart.update();
        humChart.update();
        soilChart.update();
        allChart.update();
    }
    
    function resetCharts() {
        timeLabels = [];
        tempData = [];
        humData = [];
        soilData = [];
        allTempData = [];
        allHumData = [];
        allSoilData = [];
        
        tempChart.data.labels = timeLabels;
        tempChart.data.datasets[0].data = tempData;
        
        humChart.data.labels = timeLabels;
        humChart.data.datasets[0].data = humData;
        
        soilChart.data.labels = timeLabels;
        soilChart.data.datasets[0].data = soilData;
        
        allChart.data.labels = timeLabels;
        allChart.data.datasets[0].data = allTempData;
        allChart.data.datasets[1].data = allHumData;
        allChart.data.datasets[2].data = allSoilData;
        
        updateCharts();
        
        dataCounter = 0;
        dataCounterEl.textContent = dataCounter;
        uptime = 0;
        uptimeEl.textContent = uptime;
    }
    
    function setupUpdateInterval() {
        if (window.updateIntervalId) {
            clearInterval(window.updateIntervalId);
        }
        
        window.updateIntervalId = setInterval(updateDashboard, updateInterval);
    }
    
    function updateTime() {
        const now = new Date();
        lastUpdateTimeEl.textContent = now.toLocaleTimeString('id-ID', { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit' 
        });
        
        setTimeout(updateTime, 1000);
    }
    
    function getMaxDataPointsForRange() {
        switch(chartTimeRange) {
            case '1h': return 60; // 1 data per menit
            case '6h': return 72; // 1 data per 5 menit
            case '24h': return 96; // 1 data per 15 menit
            case '7d': return 168; // 1 data per jam
            default: return 20;
        }
    }
    
    function updateChartDataRange() {
        // Dalam implementasi nyata, ini akan mengambil data historis dari server
        // Untuk demo, kita reset dan generate data baru
        resetCharts();
        generateInitialChartData();
        showNotification(`Rentang grafik diubah ke ${chartTimeRange}`, 'info');
    }
    
    function generateInitialChartData() {
        // Generate initial data points based on time range
        const points = getMaxDataPointsForRange();
        const now = new Date();
        
        for (let i = points; i >= 0; i--) {
            const time = new Date(now.getTime() - i * 60000); // Kurangi i menit
            timeLabels.push(time.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
            
            // Generate realistic data
            const baseTemp = 25 + Math.sin(i/10) * 3;
            const baseHum = 50 + Math.cos(i/8) * 15;
            const baseSoil = 40 + Math.sin(i/12) * 30;
            
            tempData.push(parseFloat(baseTemp.toFixed(1)));
            humData.push(parseFloat(baseHum.toFixed(1)));
            soilData.push(Math.max(0, Math.min(100, Math.round(baseSoil))));
            allTempData.push(parseFloat(baseTemp.toFixed(1)));
            allHumData.push(parseFloat(baseHum.toFixed(1)));
            allSoilData.push(Math.max(0, Math.min(100, Math.round(baseSoil))));
        }
        
        updateCharts();
    }
    
    function changeTheme(theme) {
        const root = document.documentElement;
        
        switch(theme) {
            case 'light':
                root.style.setProperty('--bg-color', '#f8f9fa');
                root.style.setProperty('--card-bg', '#ffffff');
                root.style.setProperty('--text-color', '#212529');
                root.style.setProperty('--text-secondary', '#6c757d');
                root.style.setProperty('--border-color', '#dee2e6');
                document.querySelectorAll('.dashboard-card').forEach(card => {
                    card.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
                });
                break;
            case 'dark':
                root.style.setProperty('--bg-color', '#0f172a');
                root.style.setProperty('--card-bg', '#1e293b');
                root.style.setProperty('--text-color', '#f1f5f9');
                root.style.setProperty('--text-secondary', '#94a3b8');
                root.style.setProperty('--border-color', '#334155');
                document.querySelectorAll('.dashboard-card').forEach(card => {
                    card.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.3)';
                });
                break;
            case 'blue':
                root.style.setProperty('--bg-color', '#0c1a32');
                root.style.setProperty('--card-bg', '#1a2b4a');
                root.style.setProperty('--text-color', '#e2e8f0');
                root.style.setProperty('--text-secondary', '#8ca3c7');
                root.style.setProperty('--border-color', '#2d4366');
                break;
            case 'green':
                root.style.setProperty('--bg-color', '#0d2b1a');
                root.style.setProperty('--card-bg', '#1a3d2b');
                root.style.setProperty('--text-color', '#d4f7e2');
                root.style.setProperty('--text-secondary', '#8fc9a9');
                root.style.setProperty('--border-color', '#2d6b4a');
                break;
        }
        
        // Simpan tema ke localStorage
        localStorage.setItem('dashboardTheme', theme);
        
        showNotification(`Tema diubah ke ${theme}`, 'success');
    }
    
    function exportData() {
        const data = {
            timestamp: new Date().toISOString(),
            temperature: tempData,
            humidity: humData,
            soilMoisture: soilData,
            labels: timeLabels,
            metadata: {
                updateInterval: updateInterval,
                simulationMode: simulationMode,
                dataPoints: dataCounter
            }
        };
        
        const dataStr = JSON.stringify(data, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        
        const exportFileDefaultName = `esp32-data-${new Date().toISOString().split('T')[0]}.json`;
        
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
        
        showNotification('Data berhasil diexport', 'success');
    }
    
    function showNotification(message, type = 'info', title = '') {
        const notificationCenter = document.querySelector('.notification-center');
        
        const notification = document.createElement('div');
        notification.className = 'notification';
        
        let icon = 'info-circle';
        let color = '#0077ff';
        
        switch(type) {
            case 'success':
                icon = 'check-circle';
                color = '#00cc66';
                break;
            case 'warning':
                icon = 'exclamation-triangle';
                color = '#ffa726';
                break;
            case 'error':
                icon = 'times-circle';
                color = '#ff6b6b';
                break;
            case 'info':
            default:
                icon = 'info-circle';
                color = '#0077ff';
        }
        
        notification.innerHTML = `
            <i class="fas fa-${icon}" style="color: ${color}"></i>
            <div class="notification-content">
                ${title ? `<div class="notification-title">${title}</div>` : ''}
                <div class="notification-message">${message}</div>
            </div>
            <button class="notification-close">&times;</button>
        `;
        
        notification.style.borderLeftColor = color;
        
        notificationCenter.appendChild(notification);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 5000);
        
        // Close button
        notification.querySelector('.notification-close').addEventListener('click', function() {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                notification.remove();
            }, 300);
        });
    }
    
    function loadNotifications() {
        const notifications = [
            {
                title: 'Sistem Online',
                message: 'Dashboard berhasil terhubung ke ESP32',
                type: 'success',
                time: 'Baru saja'
            },
            {
                title: 'Mode Simulasi',
                message: 'Saat ini menggunakan data simulasi',
                type: 'info',
                time: '2 menit lalu'
            },
            {
                title: 'Pembaruan Sistem',
                message: 'Versi 2.1.0 telah diinstall',
                type: 'info',
                time: '1 jam lalu'
            }
        ];
        
        const notificationList = document.querySelector('.notification-list');
        
        if (!notificationList) return;
        
        notifications.forEach(notif => {
            const item = document.createElement('div');
            item.className = 'notification-item';
            
            let icon = 'info-circle';
            let color = '#0077ff';
            
            switch(notif.type) {
                case 'success': icon = 'check-circle'; color = '#00cc66'; break;
                case 'warning': icon = 'exclamation-triangle'; color = '#ffa726'; break;
                case 'error': icon = 'times-circle'; color = '#ff6b6b'; break;
            }
            
            item.innerHTML = `
                <div class="notification-item-icon" style="background: ${color}20; color: ${color}">
                    <i class="fas fa-${icon}"></i>
                </div>
                <div class="notification-item-content">
                    <div class="notification-item-title">${notif.title}</div>
                    <div class="notification-item-message">${notif.message}</div>
                    <div class="notification-item-time">${notif.time}</div>
                </div>
            `;
            
            notificationList.appendChild(item);
        });
    }
    
    // Load saved theme
    const savedTheme = localStorage.getItem('dashboardTheme') || 'dark';
    themeSelectEl.value = savedTheme;
    changeTheme(savedTheme);
    
    // Session keep-alive
    setInterval(() => {
        if (localStorage.getItem('isLoggedIn') === 'true') {
            localStorage.setItem('loginTime', new Date().getTime());
        }
    }, 30 * 60 * 1000); // Setiap 30 menit
}