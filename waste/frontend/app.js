// Global API URL config
const API_URL = window.location.origin;

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

    toRegisterLink.addEventListener("click", (e) => {
        e.preventDefault();
        loginForm.classList.add("hidden");
        registerForm.classList.remove("hidden");
    });

    toLoginLink.addEventListener("click", (e) => {
        e.preventDefault();
        registerForm.classList.add("hidden");
        loginForm.classList.remove("hidden");
    });

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

    logoutBtn.addEventListener("click", logout);
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
        document.getElementById("user-display-name").innerText = currentUser.name;
        document.getElementById("user-badge-level").innerText = `Lvl ${currentUser.level} - ${currentUser.badge}`;
        document.getElementById("user-avatar-char").innerText = currentUser.name.charAt(0);
        
        // Check if user is admin
        const adminTabBtn = document.getElementById("nav-admin");
        if (currentUser.is_admin) {
            adminTabBtn.classList.remove("hidden");
        } else {
            adminTabBtn.classList.add("hidden");
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
        document.getElementById(item.id).addEventListener("click", (e) => {
            e.preventDefault();
            
            // Set active class styling
            navItems.forEach(x => document.getElementById(x.id).classList.remove("active-link"));
            document.getElementById(item.id).classList.add("active-link");
            
            showScreen(item.name);
        });
    });

    document.getElementById("view-all-history").addEventListener("click", (e) => {
        e.preventDefault();
        document.getElementById("nav-dashboard").classList.remove("active-link");
        document.getElementById("nav-history").classList.add("active-link");
        showScreen("history");
    });
}

function showScreen(screen) {
    currentScreen = screen;
    const authScreen = document.getElementById("auth-screen");
    const appScreen = document.getElementById("app-screen");
    
    // Hide screens initially
    authScreen.classList.add("hidden");
    appScreen.classList.add("hidden");
    
    // Hide all sections
    const sections = ["dashboard", "upload", "history", "assistant", "admin"];
    sections.forEach(s => {
        document.getElementById(`section-${s}`).classList.add("hidden");
    });

    if (screen === "auth") {
        authScreen.classList.remove("hidden");
    } else {
        appScreen.classList.remove("hidden");
        document.getElementById(`section-${screen}`).classList.remove("hidden");
        
        // Setup header texts
        const headerTitle = document.getElementById("page-title");
        const headerSubtitle = document.getElementById("page-subtitle");
        
        if (screen === "dashboard") {
            headerTitle.innerText = `Welcome back, ${currentUser.name}!`;
            headerSubtitle.innerText = "Track your carbon impact and recycling rewards here.";
            loadDashboardData();
        } else if (screen === "upload") {
            headerTitle.innerText = "Waste Scanner & AI Classifier";
            headerSubtitle.innerText = "Upload waste images and get verified instantly.";
            resetUploadForm();
        } else if (screen === "history") {
            headerTitle.innerText = "Recycling Logs";
            headerSubtitle.innerText = "Your environmental contribution activities history.";
            loadHistoryData();
        } else if (screen === "assistant") {
            headerTitle.innerText = "Eco AI Assistant";
            headerSubtitle.innerText = "Ask questions and get multilingual guidance on waste management.";
        } else if (screen === "admin") {
            headerTitle.innerText = "Admin Portal Dashboard";
            headerSubtitle.innerText = "Manage recycling verifications, rates, and eco accounts.";
            loadAdminData();
        }
    }
    
    // Trigger Lucide icons reload
    lucide.createIcons();
}

function showDashboardScreen() {
    showScreen("dashboard");
}

// Light and Dark theme mode
function setupThemeToggle() {
    const themeBtn = document.getElementById("theme-toggle");
    
    // Set theme on startup
    if (localStorage.getItem("eco_theme") === "dark" || 
        (!localStorage.getItem("eco_theme") && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
        document.documentElement.classList.add("dark");
    } else {
        document.documentElement.classList.remove("dark");
    }
    
    themeBtn.addEventListener("click", () => {
        if (document.documentElement.classList.contains("dark")) {
            document.documentElement.classList.remove("dark");
            localStorage.setItem("eco_theme", "light");
        } else {
            document.documentElement.classList.add("dark");
            localStorage.setItem("eco_theme", "dark");
        }
        
        // Re-render charts for dark mode styling
        if (currentScreen === "dashboard") {
            loadDashboardData();
        }
    });
}

// Toast Notifications System
function showToast(message, type = "success") {
    const container = document.getElementById("toast-container");
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
    lucide.createIcons();
    
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

async function loadNotificationsList() {
    const listContainer = document.getElementById("notifications-list");
    const badge = document.getElementById("notification-badge");
    
    try {
        const res = await fetch(`${API_URL}/api/notifications?token=${token}`);
        if (!res.ok) return;
        const notifications = await res.json();
        
        const unreadCount = notifications.filter(n => !n.is_read).length;
        if (unreadCount > 0) {
            badge.classList.remove("hidden");
        } else {
            badge.classList.add("hidden");
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
        
        // Update user profile gamification stats in local state
        currentUser.eco_points = stats.eco_points;
        currentUser.level = stats.level;
        currentUser.badge = stats.badge;
        
        // Render general dashboard stats
        document.getElementById("stat-uploads").innerText = stats.total_uploads;
        document.getElementById("stat-weight").innerText = `${stats.today_recycling_g} g`;
        document.getElementById("stat-co2").innerText = `${stats.carbon_saved_kg} kg`;
        document.getElementById("stat-revenue").innerText = `₹${stats.revenue_earned_inr}`;
        
        // Gamification metrics
        document.getElementById("user-points-total").innerText = `${stats.eco_points} Eco Points`;
        document.getElementById("gamification-badge").innerText = stats.badge;
        document.getElementById("badge-pill").innerText = stats.badge;
        document.getElementById("gamification-level").innerText = stats.level;
        
        // Level calculations
        const pointsInThisLevel = stats.eco_points % 100;
        const percentProgress = pointsInThisLevel;
        document.getElementById("level-progress-bar").style.width = `${percentProgress}%`;
        document.getElementById("points-to-next").innerText = `${pointsInThisLevel} / 100 points to Level ${stats.level + 1}`;
        document.getElementById("level-text-prev").innerText = `Level ${stats.level}`;
        document.getElementById("level-text-next").innerText = `Level ${stats.level + 1}`;
        
        // Populate leaderboard list
        const leaderboardList = document.getElementById("leaderboard-list");
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
        
        // Populate recent records list
        const recentTbody = document.getElementById("recent-records-tbody");
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
        
        // Render Weekly trends chart
        renderWeeklyCarbonChart(stats.weekly_analytics);
        
        // Render Monthly distribution chart
        renderMonthlyDistributionChart(stats.monthly_analytics);
        
        // Refresh notifications badge
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
    const ctx = document.getElementById("weeklyCarbonChart").getContext("2d");
    if (carbonTrendChart) carbonTrendChart.destroy();
    
    const isDark = document.documentElement.classList.contains("dark");
    const gridColor = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)";
    const textColor = isDark ? "#9ca3af" : "#4b5563";
    
    carbonTrendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.dates,
            datasets: [{
                label: 'CO₂ Saved (kg)',
                data: data.carbon,
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
            plugins: {
                legend: { display: false }
            },
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
    const ctx = document.getElementById("categoryDistributionChart").getContext("2d");
    if (wastePieChart) wastePieChart.destroy();
    
    const isDark = document.documentElement.classList.contains("dark");
    const legendColor = isDark ? "#e5e7eb" : "#374151";
    
    // Only show categories that have weights > 0 to keep chart tidy
    const hasData = data.weights.some(w => w > 0);
    const chartWeights = hasData ? data.weights : [1, 1, 1, 1, 1, 1];
    
    wastePieChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: data.categories,
            datasets: [{
                data: chartWeights,
                backgroundColor: [
                    '#3b82f6', // Plastic: Blue
                    '#eab308', // Paper: Yellow
                    '#94a3b8', // Metal: Slate
                    '#22c55e', // Glass: Green
                    '#f97316', // Organic: Orange
                    '#a855f7'  // E-waste: Purple
                ],
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
    
    // Drag events
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
        
        // Preview image
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById("uploaded-image").src = e.target.result;
            document.getElementById("preview-container").classList.remove("hidden");
            document.getElementById("drop-placeholder").classList.add("hidden");
            processBtn.removeAttribute("disabled");
            resetBtn.classList.remove("hidden");
        };
        reader.readAsDataURL(file);
    }
    
    resetBtn.addEventListener("click", resetUploadForm);
    
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
            
            // Render bounding box
            const box = data.bounding_box; // [x, y, w, h]
            const bboxEl = document.getElementById("bounding-box");
            bboxEl.style.left = `${box[0]}px`;
            bboxEl.style.top = `${box[1]}px`;
            bboxEl.style.width = `${box[2]}px`;
            bboxEl.style.height = `${box[3]}px`;
            bboxEl.classList.remove("hidden");
            
            // Render details
            categorySelect.value = data.category;
            weightSlider.value = data.weight_g;
            weightVal.innerText = `${data.weight_g}g`;
            
            document.getElementById("ai-confidence").innerText = `${Math.round(data.confidence * 100)}% Confident`;
            document.getElementById("ai-confidence").classList.remove("hidden");
            
            updateAIFormEstimations();
            
            // Enable side panel
            const resultsPanel = document.getElementById("ai-results-panel");
            resultsPanel.classList.remove("opacity-50", "pointer-events-none");
            
            processBtn.innerText = "Scan Completed";
            showToast("AI Scanning complete!", "success");
            
        } catch (err) {
            showToast(err.message, "error");
            processBtn.innerText = "Scan Image";
            processBtn.removeAttribute("disabled");
        }
    });
    
    // Sliders and edits listeners
    categorySelect.addEventListener("change", () => {
        if (!activeUploadData) return;
        activeUploadData.category = categorySelect.value;
        updateAIFormEstimations();
    });
    
    weightSlider.addEventListener("input", () => {
        if (!activeUploadData) return;
        weightVal.innerText = `${weightSlider.value}g`;
        activeUploadData.weight_g = Number(weightSlider.value);
        updateAIFormEstimations();
    });
    
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
        bodyFormData.append("image_url", activeUploadData.image_url);
        bodyFormData.append("confidence", activeUploadData.confidence);
        
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

function updateAIFormEstimations() {
    if (!activeUploadData) return;
    
    const category = activeUploadData.category;
    const weight_g = activeUploadData.weight_g;
    
    const rateConstants = ratesMap[category] || { rate_per_kg: 10, carbon_saved_per_kg: 1 };
    
    // Calculate values
    activeUploadData.carbon_saved_kg = roundValue((weight_g / 1000.0) * rateConstants.carbon_saved_per_kg, 3);
    activeUploadData.value_inr = roundValue((weight_g / 1000.0) * rateConstants.rate_per_kg, 2);
    
    const awardPoints = DEFAULT_POINTS[category] || 10;
    activeUploadData.points = awardPoints;
    
    // Update labels
    document.getElementById("ai-carbon-saved").innerText = `${activeUploadData.carbon_saved_kg} kg CO₂`;
    document.getElementById("ai-recycling-value").innerText = `₹${activeUploadData.value_inr}`;
    document.getElementById("ai-points-award").innerText = awardPoints;
}

function resetUploadForm() {
    document.getElementById("file-input").value = "";
    document.getElementById("uploaded-image").src = "";
    document.getElementById("preview-container").classList.add("hidden");
    document.getElementById("bounding-box").classList.add("hidden");
    document.getElementById("drop-placeholder").classList.remove("hidden");
    
    const processBtn = document.getElementById("process-image-btn");
    processBtn.innerText = "Scan Image";
    processBtn.setAttribute("disabled", "true");
    
    document.getElementById("reset-upload-btn").classList.add("hidden");
    document.getElementById("ai-confidence").classList.add("hidden");
    
    const resultsPanel = document.getElementById("ai-results-panel");
    resultsPanel.classList.add("opacity-50", "pointer-events-none");
    
    const confirmBtn = document.getElementById("confirm-recycling-btn");
    confirmBtn.innerText = "Confirm and Submit Recycling";
    confirmBtn.removeAttribute("disabled");
    
    activeUploadData = null;
}

// Activity logs list
async function loadHistoryData() {
    const tableBody = document.getElementById("history-table-body");
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

function renderHistoryTable() {
    const tableBody = document.getElementById("history-table-body");
    const searchVal = document.getElementById("history-search").value.toLowerCase();
    const filterCat = document.getElementById("history-filter-category").value;
    const filterStatus = document.getElementById("history-filter-status").value;
    
    // Filter records locally
    const filtered = historyRecords.filter(r => {
        const matchSearch = r.category.toLowerCase().includes(searchVal);
        const matchCat = filterCat === "" || r.category === filterCat;
        const matchStatus = filterStatus === "" || r.status === filterStatus;
        return matchSearch && matchCat && matchStatus;
    });
    
    // Pagination slicing
    const totalPages = Math.ceil(filtered.length / recordsPerPage) || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    
    const startIndex = (currentPage - 1) * recordsPerPage;
    const endIndex = startIndex + recordsPerPage;
    const paginated = filtered.slice(startIndex, endIndex);
    
    document.getElementById("history-page-info").innerText = `Showing page ${currentPage} of ${totalPages}`;
    document.getElementById("history-prev-btn").disabled = currentPage === 1;
    document.getElementById("history-next-btn").disabled = currentPage === totalPages;
    
    if (paginated.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="py-12 text-center text-gray-400">No records found matching filters.</td>
            </tr>
        `;
        return;
    }
    
    tableBody.innerHTML = paginated.map(r => `
        <tr class="hover:bg-emerald-500/5 transition">
            <td class="py-3 px-4 font-medium dark:text-white">${new Date(r.created_at).toLocaleDateString()}</td>
            <td class="py-3 px-4">
                <button onclick="previewWasteImage('${r.image_path}', '${r.category}', ${r.weight_g}, ${r.confidence})" class="p-1 bg-gray-100 hover:bg-emerald-100 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg text-emerald-600 transition">
                    <i data-lucide="image" class="w-4 h-4"></i>
                </button>
            </td>
            <td class="py-3 px-4 font-bold dark:text-white">${r.category}</td>
            <td class="py-3 px-4 text-gray-500">${r.weight_g} g</td>
            <td class="py-3 px-4 text-gray-500">${r.carbon_saved_kg} kg</td>
            <td class="py-3 px-4 font-bold text-emerald-600">₹${r.value_inr}</td>
            <td class="py-3 px-4">
                <span class="px-2 py-0.5 text-[10px] font-bold rounded-full ${getStatusPillClass(r.status)}">
                    ${r.status}
                </span>
            </td>
        </tr>
    `).join("");
    
    lucide.createIcons();
    
    // Pagination event bindings
    document.getElementById("history-prev-btn").onclick = () => {
        if (currentPage > 1) {
            currentPage--;
            renderHistoryTable();
        }
    };
    document.getElementById("history-next-btn").onclick = () => {
        if (currentPage < totalPages) {
            currentPage++;
            renderHistoryTable();
        }
    };
    
    // Filter/search event attachments (once)
    if (!tableBody.dataset.eventsAttached) {
        document.getElementById("history-search").oninput = () => { currentPage = 1; renderHistoryTable(); };
        document.getElementById("history-filter-category").onchange = () => { currentPage = 1; renderHistoryTable(); };
        document.getElementById("history-filter-status").onchange = () => { currentPage = 1; renderHistoryTable(); };
        tableBody.dataset.eventsAttached = "true";
    }
}

// Preview Modal details
window.previewWasteImage = function(url, category, weight, confidence) {
    const modal = document.getElementById("image-modal");
    document.getElementById("image-modal-src").src = API_URL + url;
    document.getElementById("image-modal-title").innerText = `Scan Preview: ${category}`;
    document.getElementById("image-modal-details").innerText = `Weight: ${weight}g | Confidence: ${Math.round(confidence * 100)}%`;
    modal.classList.remove("hidden");
    lucide.createIcons();
};

document.getElementById("image-modal-close").addEventListener("click", () => {
    document.getElementById("image-modal").classList.add("hidden");
});

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

// Admin Panel operations
function setupAdminListeners() {
    const tabVerify = document.getElementById("admin-tab-verify");
    const tabRates = document.getElementById("admin-tab-rates");
    const tabUsers = document.getElementById("admin-tab-users");
    
    const panelVerify = document.getElementById("admin-panel-verify");
    const panelRates = document.getElementById("admin-panel-rates");
    const panelUsers = document.getElementById("admin-panel-users");
    
    const rateForm = document.getElementById("rate-update-form");
    
    const tabMapping = [
        { btn: tabVerify, panel: panelVerify, name: "verify" },
        { btn: tabRates, panel: panelRates, name: "rates" },
        { btn: tabUsers, panel: panelUsers, name: "users" }
    ];
    
    tabMapping.forEach(tab => {
        tab.btn.addEventListener("click", () => {
            tabMapping.forEach(x => {
                x.btn.classList.replace("border-emerald-600", "border-transparent");
                x.btn.classList.replace("text-emerald-600", "text-gray-500");
                x.panel.classList.add("hidden");
            });
            
            tab.btn.classList.replace("border-transparent", "border-emerald-600");
            tab.btn.classList.replace("text-gray-500", "text-emerald-600");
            tab.panel.classList.remove("hidden");
            
            adminTab = tab.name;
            loadAdminTabDetails();
        });
    });
    
    rateForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const category = document.getElementById("rate-update-category").value;
        const rate_per_kg = Number(document.getElementById("rate-update-price").value);
        const carbon_saved_per_kg = Number(document.getElementById("rate-update-co2").value);
        
        try {
            const res = await fetch(`${API_URL}/api/admin/rates/update?token=${token}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ category, rate_per_kg, carbon_saved_per_kg })
            });
            if (!res.ok) throw new Error("Constants update failed");
            
            showToast("Recycling constants updated successfully!", "success");
            loadAdminTabDetails();
        } catch (err) {
            showToast(err.message, "error");
        }
    });
}

async function loadAdminData() {
    try {
        const res = await fetch(`${API_URL}/api/admin/stats?token=${token}`);
        if (!res.ok) return;
        const stats = await res.json();
        
        document.getElementById("admin-stat-users").innerText = stats.total_users;
        document.getElementById("admin-stat-uploads").innerText = stats.total_uploads;
        document.getElementById("admin-stat-pending").innerText = stats.pending_approvals;
        document.getElementById("admin-stat-co2").innerText = stats.total_carbon_saved_kg;
        document.getElementById("admin-stat-revenue").innerText = stats.total_value_inr;
        
        loadAdminTabDetails();
    } catch (err) {
        console.error(err);
    }
}

function loadAdminTabDetails() {
    if (adminTab === "verify") {
        loadAdminVerifyQueue();
    } else if (adminTab === "rates") {
        loadAdminRatesTable();
    } else if (adminTab === "users") {
        loadAdminUsersTable();
    }
}

async function loadAdminVerifyQueue() {
    const tbody = document.getElementById("admin-verify-tbody");
    try {
        const res = await fetch(`${API_URL}/api/admin/records?token=${token}`);
        if (!res.ok) return;
        const records = await res.json();
        
        const pending = records.filter(r => r.status === "Pending");
        if (pending.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="py-8 text-center text-gray-400">No pending approvals remaining.</td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = pending.map(r => `
            <tr class="hover:bg-emerald-500/5 transition">
                <td class="py-3 px-4 font-semibold dark:text-white">${r.user_name}</td>
                <td class="py-3 px-4 text-gray-500">${new Date(r.created_at).toLocaleDateString()}</td>
                <td class="py-3 px-4">
                    <button onclick="previewWasteImage('${r.image_path}', '${r.category}', ${r.weight_g}, ${r.confidence})" class="p-1 bg-gray-100 hover:bg-emerald-100 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg text-emerald-600 transition">
                        <i data-lucide="image" class="w-4 h-4"></i>
                    </button>
                </td>
                <td class="py-3 px-4 font-bold dark:text-white">${r.category}</td>
                <td class="py-3 px-4 text-gray-500">${r.weight_g} g</td>
                <td class="py-3 px-4 text-gray-500">+${DEFAULT_POINTS[r.category] || 10} pts</td>
                <td class="py-3 px-4 flex gap-2 justify-center">
                    <button onclick="adminVerifyAction(${r.id}, 'Approve')" class="py-1 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold transition">Approve</button>
                    <button onclick="adminVerifyAction(${r.id}, 'Reject')" class="py-1 px-3 border border-rose-500 text-rose-500 hover:bg-rose-500/10 rounded-lg font-semibold transition">Reject</button>
                </td>
            </tr>
        `).join("");
        
        lucide.createIcons();
    } catch (err) {
        console.error(err);
    }
}

window.adminVerifyAction = async function(recordId, action) {
    try {
        const res = await fetch(`${API_URL}/api/admin/records/${recordId}/action?action=${action}&token=${token}`, {
            method: "POST"
        });
        if (!res.ok) throw new Error("Action failed");
        
        showToast(`Record ${action}d successfully`, "info");
        loadAdminData();
    } catch (err) {
        showToast(err.message, "error");
    }
};

async function loadAdminRatesTable() {
    const tbody = document.getElementById("admin-rates-tbody");
    try {
        const res = await fetch(`${API_URL}/api/admin/rates`);
        if (!res.ok) return;
        const rates = await res.json();
        
        tbody.innerHTML = rates.map(r => `
            <tr class="hover:bg-emerald-500/5 transition">
                <td class="py-2.5 font-semibold dark:text-white">${r.category}</td>
                <td class="py-2.5 dark:text-gray-300">₹${r.rate_per_kg}</td>
                <td class="py-2.5 dark:text-gray-300">${r.carbon_saved_per_kg} kg/kg</td>
                <td class="py-2.5 text-right">
                    <button onclick="populateRateForm('${r.category}', ${r.rate_per_kg}, ${r.carbon_saved_per_kg})" class="text-emerald-600 hover:underline">Select</button>
                </td>
            </tr>
        `).join("");
    } catch (err) {
        console.error(err);
    }
}

window.populateRateForm = function(category, rate, carbon) {
    document.getElementById("rate-update-category").value = category;
    document.getElementById("rate-update-price").value = rate;
    document.getElementById("rate-update-co2").value = carbon;
};

async function loadAdminUsersTable() {
    const tbody = document.getElementById("admin-users-tbody");
    try {
        const res = await fetch(`${API_URL}/api/admin/users?token=${token}`);
        if (!res.ok) return;
        const users = await res.json();
        
        tbody.innerHTML = users.map(u => `
            <tr class="hover:bg-emerald-500/5 transition">
                <td class="py-2.5 font-semibold dark:text-white">${u.name} ${u.is_admin ? '<span class="ml-2 px-1.5 py-0.5 bg-rose-500/10 text-rose-500 rounded text-[9px] font-bold">ADMIN</span>' : ''}</td>
                <td class="py-2.5 text-gray-500">${u.email}</td>
                <td class="py-2.5 font-bold text-emerald-600">${u.eco_points}</td>
                <td class="py-2.5 dark:text-gray-300">${u.level}</td>
                <td class="py-2.5 text-gray-500">${u.badge}</td>
                <td class="py-2.5 text-gray-500">${u.is_admin ? 'Admin Account' : 'Standard User'}</td>
            </tr>
        `).join("");
    } catch (err) {
        console.error(err);
    }
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