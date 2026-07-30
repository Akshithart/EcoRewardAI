// Global API URL config
const API_URL = window.location.origin;

// Category Default Points Configuration
const DEFAULT_POINTS = {
    "Plastic": 20,
    "Paper": 10,
    "Glass": 15,
    "Metal": 25,
    "E-waste": 50,
    "Organic": 5,
    "Cardboard": 12,
    "Trash": 2
};

// State Management
let token = localStorage.getItem("eco_token") || null;
let currentUser = null;
let currentScreen = "dashboard";
let adminTab = "verify";
let activeUploadData = null; // Holds scanned info before confirmation
let historyRecords = [];
let ratesMap = {
    "Plastic": { rate_per_kg: 18.0, carbon_saved_per_kg: 1.5 },
    "Paper": { rate_per_kg: 10.0, carbon_saved_per_kg: 0.9 },
    "Metal": { rate_per_kg: 30.0, carbon_saved_per_kg: 2.5 },
    "Glass": { rate_per_kg: 15.0, carbon_saved_per_kg: 1.2 },
    "Organic": { rate_per_kg: 5.0, carbon_saved_per_kg: 0.5 },
    "E-waste": { rate_per_kg: 50.0, carbon_saved_per_kg: 3.2 }
};

// Charts references
let carbonTrendChart = null;
let wastePieChart = null;

// Pagination
let currentPage = 1;
const recordsPerPage = 10;

// Initialize app when DOM loads
document.addEventListener("DOMContentLoaded", () => {
    initApp();
});

// App Entry Point
async function initApp() {
    setupAuthListeners();
    setupNavigationListeners();
    setupThemeToggle();
    setupImageUpload();
    setupChatAssistant();
    setupAdminListeners();
    setupNotifications();
    setupReportDownload();
    setupHistoryControls();
    
    // Check if token exists and fetch user profile
    if (token) {
        const authenticated = await fetchUserProfile();
        if (authenticated) {
            showDashboardScreen();
        } else {
            logout();
        }
    } else {
        showScreen("auth");
    }
}

// Authentication Listeners and State
function setupAuthListeners() {
    const toRegisterLink = document.getElementById("to-register");
    const toLoginLink = document.getElementById("to-login");
    const loginForm = document.getElementById("login-form");
    const registerForm = document.getElementById("register-form");
    const logoutBtn = document.getElementById("logout-btn");

    if (toRegisterLink) {
        toRegisterLink.addEventListener("click", (e) => {
            e.preventDefault();
            loginForm.classList.add("hidden");
            registerForm.classList.remove("hidden");
        });
    }

    if (toLoginLink) {
        toLoginLink.addEventListener("click", (e) => {
            e.preventDefault();
            registerForm.classList.add("hidden");
            loginForm.classList.remove("hidden");
        });
    }

    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const email = document.getElementById("login-email").value;
            const password = document.getElementById("login-password").value;
            
            try {
                const res = await fetch(`${API_URL}/api/auth/login`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, password })
                });
                if (!res.ok) throw new Error("Invalid credentials");
                const data = await res.json();
                token = data.access_token;
                localStorage.setItem("eco_token", token);
                showToast("Welcome back!", "success");
                
                const authenticated = await fetchUserProfile();
                if (authenticated) {
                    showDashboardScreen();
                }
            } catch (err) {
                showToast(err.message, "error");
            }
        });
    }

    if (registerForm) {
        registerForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const name = document.getElementById("register-name").value;
            const email = document.getElementById("register-email").value;
            const password = document.getElementById("register-password").value;
            
            try {
                const res = await fetch(`${API_URL}/api/auth/register`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name, email, password })
                });
                if (!res.ok) throw new Error("Registration failed");
                const data = await res.json();
                token = data.access_token;
                localStorage.setItem("eco_token", token);
                showToast("Account created successfully!", "success");
                
                const authenticated = await fetchUserProfile();
                if (authenticated) {
                    showDashboardScreen();
                }
            } catch (err) {
                showToast(err.message, "error");
            }
        });
    }

    if (logoutBtn) logoutBtn.addEventListener("click", logout);
}

function logout() {
    token = null;
    currentUser = null;
    localStorage.removeItem("eco_token");
    showScreen("auth");
    showToast("Logged out successfully.", "info");
}

async function fetchUserProfile() {
    try {
        const res = await fetch(`${API_URL}/api/auth/me?token=${token}`);
        if (!res.ok) return false;
        currentUser = await res.json();
        
        // Update user display header elements
        const nameEl = document.getElementById("user-display-name");
        const badgeEl = document.getElementById("user-badge-level");
        const avatarEl = document.getElementById("user-avatar-char");
        
        if (nameEl) nameEl.innerText = currentUser.name;
        if (badgeEl) badgeEl.innerText = `Lvl ${currentUser.level} - ${currentUser.badge}`;
        if (avatarEl) avatarEl.innerText = currentUser.name.charAt(0);
        
        // Check if user is admin
        const adminTabBtn = document.getElementById("nav-admin");
        if (adminTabBtn) {
            if (currentUser.is_admin) {
                adminTabBtn.classList.remove("hidden");
            } else {
                adminTabBtn.classList.add("hidden");
            }
        }
        
        return true;
    } catch (err) {
        return false;
    }
}

// Layout screens navigation
function setupNavigationListeners() {
    const navItems = [
        { id: "nav-dashboard", name: "dashboard" },
        { id: "nav-upload", name: "upload" },
        { id: "nav-history", name: "history" },
        { id: "nav-assistant", name: "assistant" },
        { id: "nav-admin", name: "admin" }
    ];

    navItems.forEach(item => {
        const el = document.getElementById(item.id);
        if (el) {
            el.addEventListener("click", (e) => {
                e.preventDefault();
                
                // Set active class styling
                navItems.forEach(x => {
                    const btn = document.getElementById(x.id);
                    if (btn) btn.classList.remove("active-link");
                });
                el.classList.add("active-link");
                
                showScreen(item.name);
            });
        }
    });

    const viewAllBtn = document.getElementById("view-all-history");
    if (viewAllBtn) {
        viewAllBtn.addEventListener("click", (e) => {
            e.preventDefault();
            const dashNav = document.getElementById("nav-dashboard");
            const histNav = document.getElementById("nav-history");
            if (dashNav) dashNav.classList.remove("active-link");
            if (histNav) histNav.classList.add("active-link");
            showScreen("history");
        });
    }
}

function showScreen(screen) {
    currentScreen = screen;
    const authScreen = document.getElementById("auth-screen");
    const appScreen = document.getElementById("app-screen");
    
    if (!authScreen || !appScreen) return;

    // Hide screens initially
    authScreen.classList.add("hidden");
    appScreen.classList.add("hidden");
    
    // Hide all sections
    const sections = ["dashboard", "upload", "history", "assistant", "admin"];
    sections.forEach(s => {
        const sec = document.getElementById(`section-${s}`);
        if (sec) sec.classList.add("hidden");
    });

    if (screen === "auth") {
        authScreen.classList.remove("hidden");
    } else {
        appScreen.classList.remove("hidden");
        const activeSec = document.getElementById(`section-${screen}`);
        if (activeSec) activeSec.classList.remove("hidden");
        
        // Setup header texts
        const headerTitle = document.getElementById("page-title");
        const headerSubtitle = document.getElementById("page-subtitle");
        
        if (screen === "dashboard") {
            if (headerTitle) headerTitle.innerText = `Welcome back, ${currentUser ? currentUser.name : 'User'}!`;
            if (headerSubtitle) headerSubtitle.innerText = "Track your carbon impact and recycling rewards here.";
            loadDashboardData();
        } else if (screen === "upload") {
            if (headerTitle) headerTitle.innerText = "Waste Scanner & AI Classifier";
            if (headerSubtitle) headerSubtitle.innerText = "Upload waste images and get verified instantly.";
            resetUploadForm();
        } else if (screen === "history") {
            if (headerTitle) headerTitle.innerText = "Recycling Logs";
            if (headerSubtitle) headerSubtitle.innerText = "Your environmental contribution activities history.";
            loadHistoryData();
        } else if (screen === "assistant") {
            if (headerTitle) headerTitle.innerText = "Eco AI Assistant";
            if (headerSubtitle) headerSubtitle.innerText = "Ask questions and get multilingual guidance on waste management.";
        } else if (screen === "admin") {
            if (headerTitle) headerTitle.innerText = "Admin Portal Dashboard";
            if (headerSubtitle) headerSubtitle.innerText = "Manage recycling verifications, rates, and eco accounts.";
            loadAdminData();
        }
    }
    
    // Trigger Lucide icons reload if available
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function showDashboardScreen() {
    showScreen("dashboard");
}

// Light and Dark theme mode
function setupThemeToggle() {
    const themeBtn = document.getElementById("theme-toggle");
    
    if (localStorage.getItem("eco_theme") === "dark" || 
        (!localStorage.getItem("eco_theme") && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
        document.documentElement.classList.add("dark");
    } else {
        document.documentElement.classList.remove("dark");
    }
    
    if (themeBtn) {
        themeBtn.addEventListener("click", () => {
            if (document.documentElement.classList.contains("dark")) {
                document.documentElement.classList.remove("dark");
                localStorage.setItem("eco_theme", "light");
            } else {
                document.documentElement.classList.add("dark");
                localStorage.setItem("eco_theme", "dark");
            }
            
            if (currentScreen === "dashboard") {
                loadDashboardData();
            }
        });
    }
}

// Toast Notifications System
function showToast(message, type = "success") {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `notification-toast flex items-center gap-3 p-4 rounded-xl shadow-lg border text-xs font-semibold backdrop-blur-md text-white transition duration-300 animate-fade-in`;
    
    const iconColors = {
        success: { bg: "bg-emerald-600 border-emerald-500", icon: "check-circle" },
        error: { bg: "bg-rose-600 border-rose-500", icon: "alert-triangle" },
        info: { bg: "bg-blue-600 border-blue-500", icon: "info" }
    };
    
    const style = iconColors[type] || iconColors.success;
    toast.className += ` ${style.bg}`;
    
    toast.innerHTML = `
        <i data-lucide="${style.icon}" class="w-4 h-4 shrink-0"></i>
        <div class="flex-1">${message}</div>
    `;
    
    container.appendChild(toast);
    if (typeof lucide !== 'undefined') lucide.createIcons();
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Notifications drawer
function setupNotifications() {
    const toggleBtn = document.getElementById("notifications-toggle");
    const dropdown = document.getElementById("notifications-dropdown");
    const markReadBtn = document.getElementById("mark-read-btn");
    
    if (toggleBtn && dropdown) {
        toggleBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            dropdown.classList.toggle("hidden");
            if (!dropdown.classList.contains("hidden")) {
                loadNotificationsList();
            }
        });

        document.addEventListener("click", () => {
            dropdown.classList.add("hidden");
        });
        
        dropdown.addEventListener("click", (e) => e.stopPropagation());
    }

    if (markReadBtn) {
        markReadBtn.addEventListener("click", async () => {
            try {
                await fetch(`${API_URL}/api/notifications/read?token=${token}`, { method: "POST" });
                loadNotificationsList();
                showToast("Notifications marked as read", "info");
            } catch (err) {
                console.error(err);
            }
        });
    }
}

async function loadNotificationsList() {
    const listContainer = document.getElementById("notifications-list");
    const badge = document.getElementById("notification-badge");
    if (!listContainer) return;
    
    try {
        const res = await fetch(`${API_URL}/api/notifications?token=${token}`);
        if (!res.ok) return;
        const notifications = await res.json();
        
        const unreadCount = notifications.filter(n => !n.is_read).length;
        if (badge) {
            if (unreadCount > 0) badge.classList.remove("hidden");
            else badge.classList.add("hidden");
        }
        
        if (notifications.length === 0) {
            listContainer.innerHTML = `<p class="text-xs text-gray-500 text-center py-4">No notifications yet.</p>`;
            return;
        }
        
        listContainer.innerHTML = notifications.map(n => `
            <div class="p-2.5 rounded-lg border border-gray-200/20 ${n.is_read ? 'opacity-60' : 'bg-emerald-500/5 font-semibold'} transition">
                <p class="text-xs text-gray-800 dark:text-gray-200">${n.message}</p>
                <span class="text-[9px] text-gray-400 mt-1 block">${new Date(n.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
            </div>
        `).join("");
    } catch (err) {
        console.error(err);
    }
}

// Fetch rates from DB to update constants
async function fetchRates() {
    try {
        const res = await fetch(`${API_URL}/api/admin/rates`);
        if (res.ok) {
            const rates = await res.json();
            rates.forEach(r => {
                ratesMap[r.category] = {
                    rate_per_kg: r.rate_per_kg,
                    carbon_saved_per_kg: r.carbon_saved_per_kg
                };
            });
        }
    } catch (err) {
        console.error("Rates fetch error:", err);
    }
}

// Dashboard statistics loading
async function loadDashboardData() {
    await fetchRates();
    try {
        const res = await fetch(`${API_URL}/api/dashboard/stats?token=${token}`);
        if (!res.ok) throw new Error("Dashboard fetch failed");
        const stats = await res.json();
        
        currentUser.eco_points = stats.eco_points;
        currentUser.level = stats.level;
        currentUser.badge = stats.badge;
        
        const setTxt = (id, txt) => {
            const el = document.getElementById(id);
            if (el) el.innerText = txt;
        };

        setTxt("stat-uploads", stats.total_uploads);
        setTxt("stat-weight", `${stats.today_recycling_g} g`);
        setTxt("stat-co2", `${stats.carbon_saved_kg} kg`);
        setTxt("stat-revenue", `₹${stats.revenue_earned_inr}`);
        
        setTxt("user-points-total", `${stats.eco_points} Eco Points`);
        setTxt("gamification-badge", stats.badge);
        setTxt("badge-pill", stats.badge);
        setTxt("gamification-level", stats.level);
        
        const pointsInThisLevel = stats.eco_points % 100;
        const progressEl = document.getElementById("level-progress-bar");
        if (progressEl) progressEl.style.width = `${pointsInThisLevel}%`;

        setTxt("points-to-next", `${pointsInThisLevel} / 100 points to Level ${stats.level + 1}`);
        setTxt("level-text-prev", `Level ${stats.level}`);
        setTxt("level-text-next", `Level ${stats.level + 1}`);
        
        const leaderboardList = document.getElementById("leaderboard-list");
        if (leaderboardList) {
            if (stats.leaderboard.length === 0) {
                leaderboardList.innerHTML = `<p class="text-xs text-gray-500 text-center py-4">No users found.</p>`;
            } else {
                leaderboardList.innerHTML = stats.leaderboard.map((user, index) => `
                    <div class="flex items-center gap-3 p-2 border-b border-gray-200/10 last:border-b-0">
                        <span class="text-sm font-black w-6 text-center ${index === 0 ? 'text-amber-500 text-lg' : 'text-gray-400'}">${index + 1}</span>
                        <div class="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-xs uppercase">
                            ${user.name.charAt(0)}
                        </div>
                        <div class="flex-1">
                            <h4 class="text-xs font-bold dark:text-white">${user.name}</h4>
                            <span class="text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold">${user.badge}</span>
                        </div>
                        <span class="text-xs font-extrabold text-emerald-600">${user.points} pts</span>
                    </div>
                `).join("");
            }
        }
        
        const recentTbody = document.getElementById("recent-records-tbody");
        if (recentTbody) {
            if (stats.recent_records.length === 0) {
                recentTbody.innerHTML = `
                    <tr>
                        <td colspan="5" class="py-6 text-center text-gray-400">No recycling activity recorded yet.</td>
                    </tr>
                `;
            } else {
                recentTbody.innerHTML = stats.recent_records.map(r => `
                    <tr class="border-b border-gray-200/10">
                        <td class="py-2.5 font-semibold dark:text-white">${r.category}</td>
                        <td class="py-2.5 text-gray-500">${r.weight_g} g</td>
                        <td class="py-2.5 text-gray-500">${r.carbon_saved_kg} kg</td>
                        <td class="py-2.5">
                            <span class="px-2 py-0.5 text-[10px] font-semibold rounded-full ${getStatusPillClass(r.status)}">
                                ${r.status}
                            </span>
                        </td>
                        <td class="py-2.5 text-right font-extrabold text-emerald-600">₹${r.value_inr}</td>
                    </tr>
                `).join("");
            }
        }
        
        renderWeeklyCarbonChart(stats.weekly_analytics);
        renderMonthlyDistributionChart(stats.monthly_analytics);
        loadNotificationsList();
        
    } catch (err) {
        showToast(err.message, "error");
    }
}

function getStatusPillClass(status) {
    if (status === "Approved") return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
    if (status === "Rejected") return "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300";
    return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
}

// Chart.js renderings
function renderWeeklyCarbonChart(data) {
    const el = document.getElementById("weeklyCarbonChart");
    if (!el || typeof Chart === 'undefined') return;
    const ctx = el.getContext("2d");
    if (carbonTrendChart) carbonTrendChart.destroy();
    
    const isDark = document.documentElement.classList.contains("dark");
    const gridColor = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)";
    const textColor = isDark ? "#9ca3af" : "#4b5563";
    
    carbonTrendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data ? data.dates : [],
            datasets: [{
                label: 'CO₂ Saved (kg)',
                data: data ? data.carbon : [],
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.3,
                pointBackgroundColor: '#10b981',
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: {
                    grid: { color: gridColor },
                    ticks: { color: textColor, font: { family: 'Plus Jakarta Sans', size: 10 } }
                },
                y: {
                    grid: { color: gridColor },
                    ticks: { color: textColor, font: { family: 'Plus Jakarta Sans', size: 10 } }
                }
            }
        }
    });
}

function renderMonthlyDistributionChart(data) {
    const el = document.getElementById("categoryDistributionChart");
    if (!el || typeof Chart === 'undefined') return;
    const ctx = el.getContext("2d");
    if (wastePieChart) wastePieChart.destroy();
    
    const isDark = document.documentElement.classList.contains("dark");
    const legendColor = isDark ? "#e5e7eb" : "#374151";
    
    const weights = data ? data.weights : [];
    const hasData = weights.some(w => w > 0);
    const chartWeights = hasData ? weights : [1, 1, 1, 1, 1, 1];
    
    wastePieChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: data ? data.categories : ["Plastic", "Paper", "Metal", "Glass", "Organic", "E-waste"],
            datasets: [{
                data: chartWeights,
                backgroundColor: ['#3b82f6', '#eab308', '#94a3b8', '#22c55e', '#f97316', '#a855f7'],
                borderWidth: isDark ? 2 : 1,
                borderColor: isDark ? '#0f172a' : '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: legendColor,
                        boxWidth: 12,
                        font: { family: 'Plus Jakarta Sans', size: 10, weight: 'bold' }
                    }
                }
            },
            cutout: '65%'
        }
    });
}

// Waste Image Upload & AI predictions module
function setupImageUpload() {
    const dropArea = document.getElementById("drop-area");
    const fileInput = document.getElementById("file-input");
    const processBtn = document.getElementById("process-image-btn");
    const resetBtn = document.getElementById("reset-upload-btn");
    const categorySelect = document.getElementById("ai-category-select");
    const weightSlider = document.getElementById("weight-slider");
    const weightVal = document.getElementById("weight-slider-val");
    const confirmBtn = document.getElementById("confirm-recycling-btn");
    
    if (!dropArea || !fileInput) return;

    dropArea.addEventListener("click", () => fileInput.click());
    
    dropArea.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropArea.classList.add("bg-emerald-500/20");
    });
    
    dropArea.addEventListener("dragleave", () => {
        dropArea.classList.remove("bg-emerald-500/20");
    });
    
    dropArea.addEventListener("drop", (e) => {
        e.preventDefault();
        dropArea.classList.remove("bg-emerald-500/20");
        if (e.dataTransfer.files.length) {
            fileInput.files = e.dataTransfer.files;
            handleFileSelect();
        }
    });
    
    fileInput.addEventListener("change", handleFileSelect);
    
    function handleFileSelect() {
        const file = fileInput.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = document.getElementById("uploaded-image");
            const preview = document.getElementById("preview-container");
            const placeholder = document.getElementById("drop-placeholder");
            if (img) img.src = e.target.result;
            if (preview) preview.classList.remove("hidden");
            if (placeholder) placeholder.classList.add("hidden");
            if (processBtn) processBtn.removeAttribute("disabled");
            if (resetBtn) resetBtn.classList.remove("hidden");
        };
        reader.readAsDataURL(file);
    }
    
    if (resetBtn) resetBtn.addEventListener("click", resetUploadForm);
    
    if (processBtn) {
        processBtn.addEventListener("click", async () => {
            const file = fileInput.files[0];
            if (!file) return;
            
            processBtn.innerText = "Analyzing...";
            processBtn.setAttribute("disabled", "true");
            
            const formData = new FormData();
            formData.append("file", file);
            formData.append("token", token);
            
            try {
                const res = await fetch(`${API_URL}/api/waste/upload`, {
                    method: "POST",
                    body: formData
                });
                if (!res.ok) throw new Error("Image analysis failed");
                
                const data = await res.json();
                activeUploadData = data;
                
                const box = data.bounding_box || [0, 0, 0, 0];
                const bboxEl = document.getElementById("bounding-box");
                if (bboxEl) {
                    bboxEl.style.left = `${box[0]}px`;
                    bboxEl.style.top = `${box[1]}px`;
                    bboxEl.style.width = `${box[2]}px`;
                    bboxEl.style.height = `${box[3]}px`;
                    bboxEl.classList.remove("hidden");
                }
                
                if (categorySelect) categorySelect.value = data.category;
                if (weightSlider) weightSlider.value = data.weight_g;
                if (weightVal) weightVal.innerText = `${data.weight_g}g`;
                
                const confEl = document.getElementById("ai-confidence");
                if (confEl) {
                    confEl.innerText = `${Math.round((data.confidence || 0.95) * 100)}% Confident`;
                    confEl.classList.remove("hidden");
                }
                
                updateAIFormEstimations();
                
                const resultsPanel = document.getElementById("ai-results-panel");
                if (resultsPanel) resultsPanel.classList.remove("opacity-50", "pointer-events-none");
                
                processBtn.innerText = "Scan Completed";
                showToast("AI Scanning complete!", "success");
                
            } catch (err) {
                showToast(err.message, "error");
                processBtn.innerText = "Scan Image";
                processBtn.removeAttribute("disabled");
            }
        });
    }
    
    if (categorySelect) {
        categorySelect.addEventListener("change", () => {
            if (!activeUploadData) return;
            activeUploadData.category = categorySelect.value;
            updateAIFormEstimations();
        });
    }
    
    if (weightSlider) {
        weightSlider.addEventListener("input", () => {
            if (!activeUploadData) return;
            if (weightVal) weightVal.innerText = `${weightSlider.value}g`;
            activeUploadData.weight_g = Number(weightSlider.value);
            updateAIFormEstimations();
        });
    }
    
    if (confirmBtn) {
        confirmBtn.addEventListener("click", async () => {
            if (!activeUploadData) return;
            
            confirmBtn.innerText = "Submitting...";
            confirmBtn.setAttribute("disabled", "true");
            
            const bodyFormData = new FormData();
            bodyFormData.append("token", token);
            bodyFormData.append("category", activeUploadData.category);
            bodyFormData.append("weight_g", activeUploadData.weight_g);
            bodyFormData.append("carbon_saved_kg", activeUploadData.carbon_saved_kg);
            bodyFormData.append("value_inr", activeUploadData.value_inr);
            bodyFormData.append("image_url", activeUploadData.image_url || "");
            bodyFormData.append("confidence", activeUploadData.confidence || 0.95);
            
            try {
                const res = await fetch(`${API_URL}/api/waste/confirm`, {
                    method: "POST",
                    body: bodyFormData
                });
                if (!res.ok) throw new Error("Recycling confirmation failed");
                
                showToast("Submission sent! Awaiting Admin verification.", "success");
                resetUploadForm();
                showScreen("dashboard");
            } catch (err) {
                showToast(err.message, "error");
                confirmBtn.innerText = "Confirm and Submit Recycling";
                confirmBtn.removeAttribute("disabled");
            }
        });
    }
}

function updateAIFormEstimations() {
    if (!activeUploadData) return;
    
    const category = activeUploadData.category;
    const weight_g = activeUploadData.weight_g;
    
    const rateConstants = ratesMap[category] || { rate_per_kg: 10, carbon_saved_per_kg: 1 };
    
    activeUploadData.carbon_saved_kg = roundValue((weight_g / 1000.0) * rateConstants.carbon_saved_per_kg, 3);
    activeUploadData.value_inr = roundValue((weight_g / 1000.0) * rateConstants.rate_per_kg, 2);
    
    const awardPoints = DEFAULT_POINTS[category] !== undefined ? DEFAULT_POINTS[category] : 10;
    activeUploadData.points = awardPoints;
    
    const setTxt = (id, txt) => {
        const el = document.getElementById(id);
        if (el) el.innerText = txt;
    };

    setTxt("ai-carbon-saved", `${activeUploadData.carbon_saved_kg} kg CO₂`);
    setTxt("ai-recycling-value", `₹${activeUploadData.value_inr}`);
    setTxt("ai-points-award", awardPoints);
}

function resetUploadForm() {
    const fileInput = document.getElementById("file-input");
    const uploadedImg = document.getElementById("uploaded-image");
    const preview = document.getElementById("preview-container");
    const bbox = document.getElementById("bounding-box");
    const placeholder = document.getElementById("drop-placeholder");
    const processBtn = document.getElementById("process-image-btn");
    const resetBtn = document.getElementById("reset-upload-btn");
    const confEl = document.getElementById("ai-confidence");
    const resultsPanel = document.getElementById("ai-results-panel");
    const confirmBtn = document.getElementById("confirm-recycling-btn");

    if (fileInput) fileInput.value = "";
    if (uploadedImg) uploadedImg.src = "";
    if (preview) preview.classList.add("hidden");
    if (bbox) bbox.classList.add("hidden");
    if (placeholder) placeholder.classList.remove("hidden");
    
    if (processBtn) {
        processBtn.innerText = "Scan Image";
        processBtn.setAttribute("disabled", "true");
    }
    
    if (resetBtn) resetBtn.classList.add("hidden");
    if (confEl) confEl.classList.add("hidden");
    if (resultsPanel) resultsPanel.classList.add("opacity-50", "pointer-events-none");
    
    if (confirmBtn) {
        confirmBtn.innerText = "Confirm and Submit Recycling";
        confirmBtn.removeAttribute("disabled");
    }
    
    activeUploadData = null;
}

// Activity logs list
async function loadHistoryData() {
    try {
        const res = await fetch(`${API_URL}/api/waste/history?token=${token}`);
        if (!res.ok) throw new Error("History fetch failed");
        historyRecords = await res.json();
        
        currentPage = 1;
        renderHistoryTable();
    } catch (err) {
        showToast(err.message, "error");
    }
}

function setupHistoryControls() {
    const searchInput = document.getElementById("history-search");
    const catFilter = document.getElementById("history-filter-category");
    const statusFilter = document.getElementById("history-filter-status");
    const prevBtn = document.getElementById("history-prev-btn");
    const nextBtn = document.getElementById("history-next-btn");

    if (searchInput) searchInput.addEventListener("input", renderHistoryTable);
    if (catFilter) catFilter.addEventListener("change", renderHistoryTable);
    if (statusFilter) statusFilter.addEventListener("change", renderHistoryTable);

    if (prevBtn) {
        prevBtn.addEventListener("click", () => {
            if (currentPage > 1) {
                currentPage--;
                renderHistoryTable();
            }
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener("click", () => {
            currentPage++;
            renderHistoryTable();
        });
    }
}

function renderHistoryTable() {
    const tableBody = document.getElementById("history-table-body");
    if (!tableBody) return;

    const searchVal = (document.getElementById("history-search")?.value || "").toLowerCase();
    const filterCat = document.getElementById("history-filter-category")?.value || "";
    const filterStatus = document.getElementById("history-filter-status")?.value || "";
    
    const filtered = historyRecords.filter(r => {
        const matchSearch = r.category.toLowerCase().includes(searchVal);
        const matchCat = filterCat === "" || r.category === filterCat;
        const matchStatus = filterStatus === "" || r.status === filterStatus;
        return matchSearch && matchCat && matchStatus;
    });
    
    const totalPages = Math.ceil(filtered.length / recordsPerPage) || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    
    const startIndex = (currentPage - 1) * recordsPerPage;
    const paginated = filtered.slice(startIndex, startIndex + recordsPerPage);
    
    const pageInfo = document.getElementById("history-page-info");
    const prevBtn = document.getElementById("history-prev-btn");
    const nextBtn = document.getElementById("history-next-btn");

    if (pageInfo) pageInfo.innerText = `Showing page ${currentPage} of ${totalPages}`;
    if (prevBtn) prevBtn.disabled = currentPage === 1;
    if (nextBtn) nextBtn.disabled = currentPage === totalPages;
    
    if (paginated.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="py-12 text-center text-gray-400">No records found matching filters.</td>
            </tr>
        `;
        return;
    }
    
    tableBody.innerHTML = paginated.map(r => `
        <tr class="hover:bg-emerald-500/5 transition border-b border-gray-200/10">
            <td class="py-3 px-4 font-medium dark:text-white">${new Date(r.created_at).toLocaleDateString()}</td>
            <td class="py-3 px-4 font-semibold text-emerald-600">${r.category}</td>
            <td class="py-3 px-4 text-gray-500">${r.weight_g} g</td>
            <td class="py-3 px-4 text-gray-500">${r.carbon_saved_kg} kg</td>
            <td class="py-3 px-4 font-extrabold text-emerald-600">₹${r.value_inr}</td>
            <td class="py-3 px-4">
                <span class="px-2 py-0.5 text-[10px] font-semibold rounded-full ${getStatusPillClass(r.status)}">
                    ${r.status}
                </span>
            </td>
            <td class="py-3 px-4 text-right">
                <button onclick="downloadSingleReceipt('${r.id}')" class="p-1 text-gray-400 hover:text-emerald-500 transition">
                    <i data-lucide="download" class="w-4 h-4"></i>
                </button>
            </td>
        </tr>
    `).join("");

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// Chat Assistant Module
function setupChatAssistant() {
    const chatInput = document.getElementById("chat-input");
    const sendBtn = document.getElementById("chat-send-btn");
    const chatBox = document.getElementById("chat-messages");

    if (!chatInput || !sendBtn || !chatBox) return;

    const sendMessage = async () => {
        const message = chatInput.value.trim();
        if (!message) return;

        appendChatMessage("user", message);
        chatInput.value = "";

        try {
            const res = await fetch(`${API_URL}/api/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message, token })
            });
            const data = await res.json();
            appendChatMessage("assistant", data.response || "I am having trouble answering that right now.");
        } catch (err) {
            appendChatMessage("assistant", "Sorry, I am unable to connect to the assistant service.");
        }
    };

    sendBtn.addEventListener("click", sendMessage);
    chatInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") sendMessage();
    });
}

function appendChatMessage(role, text) {
    const chatBox = document.getElementById("chat-messages");
    if (!chatBox) return;

    const isUser = role === "user";
    const msgDiv = document.createElement("div");
    msgDiv.className = `flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`;
    msgDiv.innerHTML = `
        <div class="max-w-[80%] p-3 rounded-2xl text-xs font-medium ${isUser ? 'bg-emerald-600 text-white rounded-br-none' : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-bl-none'}">
            ${text}
        </div>
    `;
    chatBox.appendChild(msgDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}

// Admin Portal Handlers
function setupAdminListeners() {
    const verifyTab = document.getElementById("admin-tab-verify");
    const ratesTab = document.getElementById("admin-tab-rates");

    if (verifyTab) {
        verifyTab.addEventListener("click", () => {
            adminTab = "verify";
            loadAdminData();
        });
    }

    if (ratesTab) {
        ratesTab.addEventListener("click", () => {
            adminTab = "rates";
            loadAdminData();
        });
    }
}

async function loadAdminData() {
    if (!currentUser || !currentUser.is_admin) return;

    const verifySec = document.getElementById("admin-section-verify");
    const ratesSec = document.getElementById("admin-section-rates");

    if (adminTab === "verify") {
        if (verifySec) verifySec.classList.remove("hidden");
        if (ratesSec) ratesSec.classList.add("hidden");
        await loadAdminVerifications();
    } else {
        if (verifySec) verifySec.classList.add("hidden");
        if (ratesSec) ratesSec.classList.remove("hidden");
        await loadAdminRates();
    }
}

async function loadAdminVerifications() {
    const tableBody = document.getElementById("admin-verify-tbody");
    if (!tableBody) return;

    try {
        const res = await fetch(`${API_URL}/api/admin/pending?token=${token}`);
        const data = await res.json();

        if (data.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" class="py-6 text-center text-gray-400">No pending verification requests.</td></tr>`;
            return;
        }

        tableBody.innerHTML = data.map(item => `
            <tr class="border-b border-gray-200/10">
                <td class="py-3 px-4 dark:text-white font-medium">${item.user_name}</td>
                <td class="py-3 px-4 text-emerald-600 font-semibold">${item.category}</td>
                <td class="py-3 px-4 text-gray-500">${item.weight_g} g</td>
                <td class="py-3 px-4 text-gray-500">₹${item.value_inr}</td>
                <td class="py-3 px-4">${new Date(item.created_at).toLocaleDateString()}</td>
                <td class="py-3 px-4 text-right">
                    <button onclick="verifyRecord('${item.id}', 'Approved')" class="px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-bold mr-2 hover:bg-emerald-700">Approve</button>
                    <button onclick="verifyRecord('${item.id}', 'Rejected')" class="px-3 py-1 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700">Reject</button>
                </td>
            </tr>
        `).join("");
    } catch (err) {
        showToast("Failed to load admin verifications", "error");
    }
}

async function verifyRecord(recordId, status) {
    try {
        const res = await fetch(`${API_URL}/api/admin/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ record_id: recordId, status, token })
        });
        if (!res.ok) throw new Error("Action failed");
        showToast(`Record ${status.toLowerCase()} successfully`, "success");
        loadAdminVerifications();
    } catch (err) {
        showToast(err.message, "error");
    }
}

async function loadAdminRates() {
    const container = document.getElementById("admin-rates-container");
    if (!container) return;

    await fetchRates();
    container.innerHTML = Object.keys(ratesMap).map(cat => `
        <div class="p-4 border border-gray-200/10 rounded-xl flex items-center justify-between">
            <div>
                <h4 class="font-bold text-sm dark:text-white">${cat}</h4>
                <p class="text-xs text-gray-400">Carbon Saved: ${ratesMap[cat].carbon_saved_per_kg} kg/kg</p>
            </div>
            <div class="flex items-center gap-2">
                <span class="text-xs text-gray-400">₹/kg</span>
                <input type="number" id="rate-val-${cat}" value="${ratesMap[cat].rate_per_kg}" class="w-20 p-1 text-xs border border-gray-300 dark:border-gray-700 rounded dark:bg-gray-800 dark:text-white">
                <button onclick="updateCategoryRate('${cat}')" class="px-3 py-1 bg-emerald-600 text-white text-xs font-bold rounded hover:bg-emerald-700">Save</button>
            </div>
        </div>
    `).join("");
}

async function updateCategoryRate(category) {
    const valInput = document.getElementById(`rate-val-${category}`);
    if (!valInput) return;

    try {
        const res = await fetch(`${API_URL}/api/admin/rates`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                category,
                rate_per_kg: parseFloat(valInput.value),
                token
            })
        });
        if (!res.ok) throw new Error("Failed to update rate");
        showToast(`${category} rate updated!`, "success");
        fetchRates();
    } catch (err) {
        showToast(err.message, "error");
    }
}

// Reports & Export Functions
function setupReportDownload() {
    const reportBtn = document.getElementById("download-report-btn");
    if (reportBtn) {
        reportBtn.addEventListener("click", downloadPDFReport);
    }
}

async function downloadPDFReport() {
    try {
        showToast("Generating PDF report...", "info");
        const res = await fetch(`${API_URL}/api/reports/summary?token=${token}`);
        if (!res.ok) throw new Error("Report generation failed");
        
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `EcoTracker_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        showToast("Report downloaded successfully!", "success");
    } catch (err) {
        showToast(err.message, "error");
    }
}

async function downloadSingleReceipt(recordId) {
    try {
        showToast("Preparing receipt...", "info");
        const res = await fetch(`${API_URL}/api/reports/receipt/${recordId}?token=${token}`);
        if (!res.ok) throw new Error("Receipt download failed");
        
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Receipt_${recordId}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
    } catch (err) {
        showToast(err.message, "error");
    }
}

// Utility Math Calculations
function roundValue(val, decimals = 2) {
    return Number(Math.round(parseFloat(val + 'e' + decimals)) + 'e-' + decimals) || 0;
}

// Chatbot Interface
function setupChatAssistant() {
    const chatForm = document.getElementById("chat-form");
    const chatInput = document.getElementById("chat-input");
    const chatMessages = document.getElementById("chat-messages");
    const langSelect = document.getElementById("chat-lang-select");
    
    chatForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const msgText = chatInput.value.trim();
        if (!msgText) return;
        
        // Append user bubble
        appendChatBubble(msgText, "user");
        chatInput.value = "";
        
        try {
            const res = await fetch(`${API_URL}/api/chatbot`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: msgText, language: langSelect.value })
            });
            if (!res.ok) throw new Error();
            const data = await res.json();
            
            // Append bot bubble
            appendChatBubble(data.response, "bot");
        } catch (err) {
            appendChatBubble("Sorry, I could not process your query at this time. Please try again.", "bot");
        }
    });
    
    // Preset prompt buttons
    const faqButtons = document.querySelectorAll(".faq-btn");
    faqButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const val = btn.innerText.trim();
            chatInput.value = val;
            chatForm.dispatchEvent(new Event("submit"));
        });
    });
}

function appendChatBubble(text, sender) {
    const chatMessages = document.getElementById("chat-messages");
    const bubble = document.createElement("div");
    bubble.className = "flex items-start gap-3 animate-fade-in";
    
    if (sender === "user") {
        bubble.className += " flex-row-reverse";
        bubble.innerHTML = `
            <div class="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shrink-0">ME</div>
            <div class="p-3 bg-emerald-600 text-white text-xs rounded-2xl max-w-[80%] chat-bubble-user shadow-sm">
                ${text.replace(/\n/g, '<br>')}
            </div>
        `;
    } else {
        bubble.innerHTML = `
            <div class="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center text-xs font-bold shrink-0">AI</div>
            <div class="p-3 bg-gray-100 dark:bg-slate-800/80 text-gray-800 dark:text-gray-200 text-xs rounded-2xl max-w-[80%] chat-bubble-bot shadow-sm">
                ${text.replace(/\n/g, '<br>')}
            </div>
        `;
    }
    
    chatMessages.appendChild(bubble);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}
// PDF Report Downloader using jsPDF
function setupReportDownload() {
    const downloadBtn = document.getElementById("download-report-btn");
    
    downloadBtn.addEventListener("click", async () => {
        downloadBtn.innerHTML = "<i data-lucide='loader' class='w-4 h-4 animate-spin'></i> Generating...";
        lucide.createIcons();
        
        try {
            const statsRes = await fetch(`${API_URL}/api/dashboard/stats?token=${token}`);
            if (!statsRes.ok) throw new Error("Failed to load dashboard report statistics");
            const stats = await statsRes.json();
            
            // Generate PDF using jsPDF
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('p', 'mm', 'a4');
            
            // Header Bar
            doc.setFillColor(5, 150, 105); // emerald-600
            doc.rect(0, 0, 210, 40, 'F');
            
            doc.setTextColor(255, 255, 255);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(22);
            doc.text("ECOREWARD AI", 15, 18);
            
            doc.setFontSize(10);
            doc.setFont("helvetica", "normal");
            doc.text("Smart Waste Classification & Recycling Reward System", 15, 25);
            doc.text(`Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, 15, 31);
            
            // User stats box
            doc.setFillColor(240, 253, 244); // light green bg
            doc.rect(15, 50, 180, 25, 'F');
            doc.setDrawColor(16, 185, 129); // emerald-500 border
            doc.rect(15, 50, 180, 25);
            
            doc.setTextColor(6, 95, 70); // deep green
            doc.setFont("helvetica", "bold");
            doc.setFontSize(11);
            doc.text(`RECYCLING REPORT FOR: ${stats.leaderboard[0] ? currentUser.name.toUpperCase() : "ECOWARRIOR"}`, 22, 57);
            
            doc.setFontSize(10);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(100, 116, 139); // gray text
            doc.text(`Level: ${stats.level}  |  Badge: ${stats.badge}  |  Eco Points Balance: ${stats.eco_points} points`, 22, 66);
            
            // Stats summary columns
            doc.setTextColor(30, 41, 59);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(12);
            doc.text("RECYCLING PERFORMANCE SUMMARY", 15, 90);
            doc.line(15, 92, 195, 92);
            
            doc.setFontSize(10);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(71, 85, 105);
            
            doc.text(`• Total Scans Submitted:`, 15, 100);
            doc.setFont("helvetica", "bold");
            doc.text(`${stats.total_uploads} uploads`, 75, 100);
            
            doc.setFont("helvetica", "normal");
            doc.text(`• Carbon Emissions Prevented:`, 15, 107);
            doc.setFont("helvetica", "bold");
            doc.text(`${stats.carbon_saved_kg} kg CO2`, 75, 107);
            
            doc.setFont("helvetica", "normal");
            doc.text(`• Today's Recycling Quantity:`, 15, 114);
            doc.setFont("helvetica", "bold");
            doc.text(`${stats.today_recycling_g} grams`, 75, 114);
            
            doc.setFont("helvetica", "normal");
            doc.text(`• Total Estimated Value:`, 15, 121);
            doc.setFont("helvetica", "bold");
            doc.text(`INR ${stats.revenue_earned_inr}`, 75, 121);
            
            // Render active chart image if available
            if (wastePieChart) {
                const chartImg = wastePieChart.toBase64Image();
                doc.addImage(chartImg, 'PNG', 115, 130, 75, 75);
                
                doc.setTextColor(30, 41, 59);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(10);
                doc.text("Waste Category Ratio", 130, 210);
            }
            
            // Detailed breakdown Table Header
            doc.setTextColor(30, 41, 59);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(12);
            doc.text("CATEGORY BREAKDOWN DETAILS", 15, 140);
            doc.line(15, 142, 100, 142);
            
            // Generate rows
            doc.setFontSize(9);
            let yOffset = 150;
            doc.setFont("helvetica", "bold");
            doc.text("Category", 15, yOffset);
            doc.text("Weight (kg)", 55, yOffset);
            doc.text("CO2 Saved", 85, yOffset);
            doc.line(15, yOffset + 2, 100, yOffset + 2);
            
            yOffset += 8;
            doc.setFont("helvetica", "normal");
            stats.monthly_analytics.categories.forEach((cat, index) => {
                const weight = stats.monthly_analytics.weights[index].toFixed(2);
                const co2 = (stats.monthly_analytics.weights[index] * (ratesMap[cat]?.carbon_saved_per_kg || 1)).toFixed(2);
                doc.text(cat, 15, yOffset);
                doc.text(`${weight} kg`, 55, yOffset);
                doc.text(`${co2} kg`, 85, yOffset);
                yOffset += 7;
            });
            
            // Footer
            doc.line(15, 260, 195, 260);
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text("EcoReward AI - Saving the planet one recycle at a time.", 15, 266);
            doc.text("Powered by Vision AI models and gamified recycling systems.", 15, 271);
            
            doc.save(`EcoReward_Sustainability_Report_${new Date().toISOString().split('T')[0]}.pdf`);
            
            showToast("Report PDF downloaded!", "success");
        } catch (err) {
            showToast(err.message, "error");
        } finally {
            downloadBtn.innerHTML = "<i data-lucide='file-down' class='w-4 h-4'></i> Download Report";
            lucide.createIcons();
        }
    });
}

// Basic rounding helper
function roundValue(num, decimals) {
    const t = Math.pow(10, decimals);
    return Math.round((num + Number.EPSILON) * t) / t;
}

// Global State & Token Check
function getToken() {
    return localStorage.getItem("token");
}

// -------------------------------------------------------------
// 1. IMAGE UPLOAD & AI CLASSIFICATION HANDLER
// -------------------------------------------------------------
async function handleUpload(event) {
    if (event) event.preventDefault();

    const token = getToken();
    if (!token) {
        alert("Please login first to upload images!");
        return;
    }

    // Checking both possible file input IDs
    const fileInput = document.getElementById("wasteImageInput") || document.getElementById("scanFileInput");
    if (!fileInput || !fileInput.files[0]) {
        alert("Please select an image file first!");
        return;
    }

    const formData = new FormData();
    formData.append("token", token);
    formData.append("file", fileInput.files[0]);

    try {
        const response = await fetch("/api/waste/upload", {
            method: "POST",
            body: formData
        });

        const data = await response.json();

        if (response.ok) {
            // Points Safety Check (Fallback to 10 if null/undefined)
            const earnedPoints = data.points !== undefined && data.points !== null ? data.points : 10;

            // Set values safely to UI Elements
            if (document.getElementById("resCategory")) document.getElementById("resCategory").innerText = data.category || "General";
            if (document.getElementById("resWeight")) document.getElementById("resWeight").innerText = (data.weight_g || 0) + " g";
            if (document.getElementById("resCarbon")) document.getElementById("resCarbon").innerText = (data.carbon_saved_kg || 0) + " kg";
            if (document.getElementById("resPoints")) document.getElementById("resPoints").innerText = earnedPoints + " Points";
            if (document.getElementById("resValue")) document.getElementById("resValue").innerText = "₹" + (data.recycling_value || 0);

            // Set Image Preview if image element exists
            const previewImg = document.getElementById("resImagePreview");
            if (previewImg && data.image_url) {
                previewImg.src = data.image_url;
            }

            console.log("Upload Success Data:", data);

            // If confirmation modal or result panel exists, make it visible
            const resultModal = document.getElementById("uploadResultModal") || document.getElementById("scanResultSection");
            if (resultModal) {
                resultModal.style.display = "block";
            }
        } else {
            alert(data.detail || "Upload failed. Please try again.");
        }
    } catch (err) {
        console.error("Upload error:", err);
        alert("Network error while uploading image.");
    }
}

// -------------------------------------------------------------
// 2. REPORT DOWNLOAD FUNCTIONS (CSV & PDF)
// -------------------------------------------------------------

// 📄 Download CSV Report Function
function downloadCSVReport() {
    const token = getToken();
    if (!token) {
        alert("Please login first!");
        return;
    }

    fetch(`/api/waste/history?token=${token}`)
        .then(res => {
            if (!res.ok) throw new Error("Failed to fetch history");
            return res.json();
        })
        .then(data => {
            if (!data || data.length === 0) {
                alert("No waste records found to download!");
                return;
            }

            // CSV Header Creation
            let csvContent = "data:text/csv;charset=utf-8,ID,Category,Weight(g),Carbon Saved(kg),Value(INR),Status,Date\n";
            
            // CSV Rows Loop
            data.forEach(row => {
                let dateStr = row.created_at ? new Date(row.created_at).toLocaleDateString() : "N/A";
                csvContent += `${row.id},${row.category},${row.weight_g},${row.carbon_saved_kg},${row.value_inr},${row.status},${dateStr}\n`;
            });

            // Trigger Browser Download
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `EcoReward_Report_${new Date().toISOString().slice(0, 10)}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        })
        .catch(err => {
            console.error("CSV Download Error:", err);
            alert("Failed to download CSV report.");
        });
}

// 🖨️ Download PDF / Print Report Function
function downloadPDFReport() {
    window.print();
}

// -------------------------------------------------------------
// 3. HTML BUTTON CLICK LISTENERS ATTACHMENT
// -------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
    // Attach Upload Form Handler
    const uploadForm = document.getElementById("uploadForm");
    if (uploadForm) {
        uploadForm.addEventListener("submit", handleUpload);
    }

    // Attach CSV Download Button Handler
    const csvBtn = document.getElementById("downloadCsvBtn") || document.getElementById("btnDownloadCSV");
    if (csvBtn) {
        csvBtn.addEventListener("click", downloadCSVReport);
    }

    // Attach PDF Download Button Handler
    const pdfBtn = document.getElementById("downloadPdfBtn") || document.getElementById("btnDownloadPDF");
    if (pdfBtn) {
        pdfBtn.addEventListener("click", downloadPDFReport);
    }
});