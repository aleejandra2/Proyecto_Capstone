// Script principal para LevelUp
class LevelUpApp {
    constructor() {
        this.currentUser = null;
        this.currentView = 'login';
        this.activities = [];
        this.rewards = [];
        this.leaderboard = [];
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.checkSession();
        this.initAnimations();
    }

    // Gestión de sesiones
    checkSession() {
        const userData = localStorage.getItem('levelup_user');
        const token = localStorage.getItem('levelup_token');
        
        if (userData && token) {
            this.currentUser = JSON.parse(userData);
            this.switchView(this.getUserDashboard());
        } else {
            this.switchView('login');
        }
    }

    login(email, password, role = 'student') {
        // Simulación de login
        const mockUsers = {
            'student@test.com': {
                id: 1,
                email: 'student@test.com',
                first_name: 'Ana',
                last_name: 'García',
                role: 'student',
                level: 5,
                experience: 2450,
                experience_to_next_level: 3000,
                points: 1200,
                badges: ['first_activity', 'math_expert', 'perfect_week']
            },
            'teacher@test.com': {
                id: 2,
                email: 'teacher@test.com',
                first_name: 'Carlos',
                last_name: 'Rodríguez',
                role: 'teacher',
                level: 10,
                experience: 5000,
                points: 0
            },
            'admin@test.com': {
                id: 3,
                email: 'admin@test.com',
                first_name: 'María',
                last_name: 'López',
                role: 'admin',
                level: 15,
                experience: 8000,
                points: 0
            }
        };

        if (mockUsers[email] && password === 'password') {
            this.currentUser = mockUsers[email];
            localStorage.setItem('levelup_user', JSON.stringify(this.currentUser));
            localStorage.setItem('levelup_token', 'mock_token_' + Date.now());
            
            this.switchView(this.getUserDashboard());
            this.showNotification('¡Bienvenido a LevelUp!', 'success');
            return true;
        }
        
        this.showNotification('Credenciales incorrectas', 'error');
        return false;
    }

    logout() {
        this.currentUser = null;
        localStorage.removeItem('levelup_user');
        localStorage.removeItem('levelup_token');
        this.switchView('login');
        this.showNotification('Sesión cerrada', 'info');
    }

    getUserDashboard() {
        switch(this.currentUser?.role) {
            case 'student': return 'student_dashboard';
            case 'teacher': return 'teacher_dashboard';
            case 'admin': return 'admin_dashboard';
            default: return 'login';
        }
    }

    // Gestión de vistas
    switchView(viewName) {
        // Ocultar todas las vistas
        document.querySelectorAll('.view').forEach(view => {
            view.classList.add('hidden');
        });

        // Mostrar vista solicitada
        const targetView = document.getElementById(viewName);
        if (targetView) {
            targetView.classList.remove('hidden');
            this.currentView = viewName;
            
            // Cargar datos específicos de la vista
            this.loadViewData(viewName);
        }
    }

    loadViewData(viewName) {
        switch(viewName) {
            case 'student_dashboard':
                this.loadStudentData();
                break;
            case 'teacher_dashboard':
                this.loadTeacherData();
                break;
            case 'admin_dashboard':
                this.loadAdminData();
                break;
        }
    }

    // Datos específicos por rol
    loadStudentData() {
        this.updateUserInfo();
        this.loadActivities();
        this.loadRewards();
        this.loadLeaderboard();
        this.updateProgressBars();
    }

    loadTeacherData() {
        this.updateUserInfo();
        this.loadTeacherActivities();
        this.loadStudentProgress();
    }

    loadAdminData() {
        this.updateUserInfo();
        this.loadSystemStats();
        this.loadAllUsers();
    }

    updateUserInfo() {
        if (!this.currentUser) return;

        // Actualizar información del usuario en la navbar
        const userInfo = document.querySelector('.navbar-user-info');
        if (userInfo) {
            const avatar = userInfo.querySelector('.navbar-avatar');
            const username = userInfo.querySelector('.navbar-username');
            const level = userInfo.querySelector('.navbar-level');

            if (avatar) {
                avatar.textContent = this.currentUser.first_name.charAt(0).toUpperCase();
            }
            if (username) {
                username.textContent = `${this.currentUser.first_name} ${this.currentUser.last_name}`;
            }
            if (level) {
                level.textContent = `Nivel ${this.currentUser.level}`;
            }
        }

        // Actualizar stats en el dashboard
        this.updateDashboardStats();
    }

    updateDashboardStats() {
        const stats = {
            level: this.currentUser.level,
            experience: this.currentUser.experience,
            points: this.currentUser.points,
            badges: this.currentUser.badges?.length || 0
        };

        Object.keys(stats).forEach(key => {
            const element = document.querySelector(`[data-stat="${key}"]`);
            if (element) {
                element.textContent = stats[key];
            }
        });
    }

    updateProgressBars() {
        // Barra de experiencia
        const expBar = document.querySelector('.experience-fill');
        if (expBar && this.currentUser.experience_to_next_level) {
            const percentage = (this.currentUser.experience / this.currentUser.experience_to_next_level) * 100;
            expBar.style.width = `${Math.min(percentage, 100)}%`;
        }

        // Progreso de actividades
        setTimeout(() => {
            document.querySelectorAll('.progress-bar').forEach(bar => {
                const progress = bar.dataset.progress || Math.random() * 100;
                bar.style.width = `${progress}%`;
            });
        }, 500);
    }

    // Gestión de actividades
    loadActivities() {
        const mockActivities = [
            {
                id: 1,
                title: 'Operaciones Básicas',
                subject: 'Matemáticas',
                difficulty: 'easy',
                points: 100,
                completed: false,
                progress: 0
            },
            {
                id: 2,
                title: 'Comprensión Lectora',
                subject: 'Lenguaje',
                difficulty: 'medium',
                points: 150,
                completed: true,
                progress: 100
            },
            {
                id: 3,
                title: 'Fracciones Equivalentes',
                subject: 'Matemáticas',
                difficulty: 'hard',
                points: 200,
                completed: false,
                progress: 60
            }
        ];

        this.activities = mockActivities;
        this.renderActivities();
    }

    renderActivities() {
        const container = document.getElementById('activities-container');
        if (!container) return;

        container.innerHTML = this.activities.map(activity => `
            <div class="card activity-card animate-fade-in" data-activity-id="${activity.id}">
                <div class="card-content">
                    <div class="flex justify-between items-start mb-4">
                        <div>
                            <h3 class="card-title">${activity.title}</h3>
                            <div class="flex gap-2 mb-2">
                                <span class="badge badge-primary">${activity.subject}</span>
                                <span class="badge badge-${this.getDifficultyColor(activity.difficulty)}">
                                    ${this.getDifficultyText(activity.difficulty)}
                                </span>
                            </div>
                        </div>
                        <span class="badge badge-success">${activity.points} pts</span>
                    </div>
                    
                    <div class="progress mb-4">
                        <div class="progress-bar" data-progress="${activity.progress}"></div>
                    </div>
                    
                    <div class="flex justify-between items-center">
                        <span class="text-sm text-gray-600">Progreso: ${activity.progress}%</span>
                        <button class="btn btn-primary btn-sm" onclick="app.startActivity(${activity.id})">
                            ${activity.completed ? 'Revisar' : activity.progress > 0 ? 'Continuar' : 'Iniciar'}
                        </button>
                    </div>
                </div>
            </div>
        `).join('');

        // Actualizar barras de progreso
        setTimeout(() => this.updateProgressBars(), 100);
    }

    startActivity(activityId) {
        const activity = this.activities.find(a => a.id === activityId);
        if (!activity) return;

        this.showNotification(`Iniciando actividad: ${activity.title}`, 'info');
        
        // Simular progreso de actividad
        this.simulateActivityProgress(activityId);
    }

    simulateActivityProgress(activityId) {
        const activity = this.activities.find(a => a.id === activityId);
        if (!activity || activity.completed) return;

        const progressIncrement = Math.random() * 30 + 20; // 20-50%
        activity.progress = Math.min(activity.progress + progressIncrement, 100);

        if (activity.progress >= 100) {
            activity.completed = true;
            this.completeActivity(activity);
        }

        this.renderActivities();
    }

    completeActivity(activity) {
        // Agregar puntos y experiencia
        this.currentUser.points += activity.points;
        this.currentUser.experience += activity.points;

        // Verificar subida de nivel
        this.checkLevelUp();

        // Mostrar notificación
        this.showRewardNotification({
            title: '¡Actividad Completada!',
            description: `Has ganado ${activity.points} puntos`,
            type: 'activity_completed'
        });

        // Actualizar localStorage
        localStorage.setItem('levelup_user', JSON.stringify(this.currentUser));
    }

    checkLevelUp() {
        const currentLevel = this.currentUser.level;
        const expNeeded = currentLevel * 1000; // Fórmula simple

        if (this.currentUser.experience >= expNeeded) {
            this.currentUser.level++;
            this.currentUser.experience_to_next_level = this.currentUser.level * 1000;
            
            this.showRewardNotification({
                title: '¡SUBIDA DE NIVEL!',
                description: `¡Felicidades! Ahora eres nivel ${this.currentUser.level}`,
                type: 'level_up'
            });
        }
    }

    // Sistema de recompensas
    loadRewards() {
        const mockRewards = [
            {
                id: 1,
                title: 'Primera Actividad',
                description: 'Completa tu primera actividad',
                icon: '🎯',
                earned: true,
                earned_date: '2024-01-15'
            },
            {
                id: 2,
                title: 'Experto en Matemáticas',
                description: 'Completa 5 actividades de matemáticas',
                icon: '🔢',
                earned: true,
                earned_date: '2024-01-20'
            },
            {
                id: 3,
                title: 'Semana Perfecta',
                description: 'Completa actividades todos los días de la semana',
                icon: '🌟',
                earned: false,
                progress: 5,
                total: 7
            }
        ];

        this.rewards = mockRewards;
        this.renderRewards();
    }

    renderRewards() {
        const container = document.getElementById('rewards-container');
        if (!container) return;

        container.innerHTML = this.rewards.map(reward => `
            <div class="card reward-card ${reward.earned ? 'earned' : ''}" data-reward-id="${reward.id}">
                <div class="card-content text-center">
                    <div class="achievement-medal ${reward.earned ? 'earned' : 'locked'} mb-4">
                        ${reward.earned ? reward.icon : '🔒'}
                    </div>
                    <h4 class="card-title mb-2">${reward.title}</h4>
                    <p class="text-sm text-gray-600 mb-4">${reward.description}</p>
                    
                    ${!reward.earned && reward.progress !== undefined ? `
                        <div class="progress mb-2">
                            <div class="progress-bar" data-progress="${(reward.progress / reward.total) * 100}"></div>
                        </div>
                        <span class="text-xs text-gray-500">${reward.progress}/${reward.total}</span>
                    ` : ''}
                    
                    ${reward.earned ? `
                        <span class="badge badge-success">Conseguido</span>
                    ` : `
                        <span class="badge badge-warning">En progreso</span>
                    `}
                </div>
            </div>
        `).join('');

        setTimeout(() => this.updateProgressBars(), 100);
    }

    showRewardNotification(reward) {
        const notification = document.createElement('div');
        notification.className = 'reward-notification';
        notification.innerHTML = `
            <div class="reward-notification-content">
                <div class="reward-notification-icon">
                    ${reward.type === 'level_up' ? '🎆' : reward.type === 'badge' ? '🏆' : '✨'}
                </div>
                <div class="reward-notification-text">
                    <h4>${reward.title}</h4>
                    <p>${reward.description}</p>
                </div>
            </div>
        `;

        document.body.appendChild(notification);

        // Animar entrada
        setTimeout(() => notification.classList.add('show'), 100);

        // Remover después de 5 segundos
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 5000);
    }

    // Leaderboard
    loadLeaderboard() {
        const mockLeaderboard = [
            { rank: 1, name: 'Elena Martínez', points: 2500, level: 8, avatar: 'E' },
            { rank: 2, name: 'Diego Silva', points: 2200, level: 7, avatar: 'D' },
            { rank: 3, name: 'Ana García', points: 1200, level: 5, avatar: 'A' },
            { rank: 4, name: 'Luis Torres', points: 1100, level: 5, avatar: 'L' },
            { rank: 5, name: 'Sofía Ruiz', points: 950, level: 4, avatar: 'S' }
        ];

        this.leaderboard = mockLeaderboard;
        this.renderLeaderboard();
    }

    renderLeaderboard() {
        const container = document.getElementById('leaderboard-container');
        if (!container) return;

        container.innerHTML = this.leaderboard.map((user, index) => `
            <div class="leaderboard-item ${user.name.includes(this.currentUser?.first_name) ? 'current-user' : ''}" 
                 data-rank="${user.rank}">
                <div class="leaderboard-rank">
                    ${user.rank <= 3 ? this.getRankMedal(user.rank) : user.rank}
                </div>
                <div class="leaderboard-avatar">${user.avatar}</div>
                <div class="leaderboard-info">
                    <div class="leaderboard-name">${user.name}</div>
                    <div class="leaderboard-level">Nivel ${user.level}</div>
                </div>
                <div class="leaderboard-points">${user.points} pts</div>
            </div>
        `).join('');
    }

    getRankMedal(rank) {
        const medals = { 1: '🥇', 2: '🥈', 3: '🥉' };
        return medals[rank] || rank;
    }

    // Utilidades
    getDifficultyColor(difficulty) {
        const colors = {
            'easy': 'success',
            'medium': 'warning',
            'hard': 'danger'
        };
        return colors[difficulty] || 'primary';
    }

    getDifficultyText(difficulty) {
        const texts = {
            'easy': 'Fácil',
            'medium': 'Medio',
            'hard': 'Difícil'
        };
        return texts[difficulty] || difficulty;
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;

        document.body.appendChild(notification);

        setTimeout(() => notification.classList.add('show'), 100);
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // Event Listeners
    bindEvents() {
        // Login form
        document.addEventListener('submit', (e) => {
            if (e.target.id === 'login-form') {
                e.preventDefault();
                const email = e.target.email.value;
                const password = e.target.password.value;
                this.login(email, password);
            }
        });

        // Logout
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('logout-btn')) {
                e.preventDefault();
                this.logout();
            }
        });

        // Navigation
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('nav-link')) {
                e.preventDefault();
                const view = e.target.dataset.view;
                if (view) {
                    this.switchView(view);
                }
            }
        });

        // Mobile menu toggle
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('navbar-mobile-toggle')) {
                const menu = document.querySelector('.navbar-mobile-menu');
                menu.classList.toggle('active');
            }
        });

        // Scroll to top
        const scrollBtn = document.querySelector('.footer-scroll-top');
        if (scrollBtn) {
            window.addEventListener('scroll', () => {
                if (window.pageYOffset > 300) {
                    scrollBtn.classList.add('visible');
                } else {
                    scrollBtn.classList.remove('visible');
                }
            });

            scrollBtn.addEventListener('click', () => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        }
    }

    initAnimations() {
        // Intersection Observer para animaciones
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animate-fade-in');
                }
            });
        });

        // Observar elementos animables
        document.querySelectorAll('.card, .stats-card').forEach(el => {
            observer.observe(el);
        });
    }
}

// Inicializar aplicación
const app = new LevelUpApp();

// Funciones globales para compatibilidad
window.app = app;