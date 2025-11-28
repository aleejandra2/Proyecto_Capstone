// Navbar de LevelUp
class LevelUpNavbar {
    constructor() {
        this.init();
    }

    init() {
        this.bindEvents();
        this.updateProgress();
        this.initDropdowns();
    }

    bindEvents() {
        // Alternar menú móvil
        const mobileToggle = document.querySelector('.navbar-mobile-toggle');
        const mobileMenu = document.querySelector('.navbar-mobile-menu');
        
        if (mobileToggle && mobileMenu) {
            mobileToggle.addEventListener('click', () => {
                mobileMenu.classList.toggle('active');
                this.updateMobileToggleIcon();
            });
        }

        // Cierra el menú móvil al hacer clic fuera
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.navbar') && mobileMenu) {
                mobileMenu.classList.remove('active');
                this.updateMobileToggleIcon();
            }
        });

        // Manejo de clics en la navegación
        document.querySelectorAll('.navbar-link, .navbar-mobile-link').forEach(link => {
            link.addEventListener('click', (e) => {
                this.handleNavigation(e);
            });
        });

        // Dropdown de usuario
        const userDropdown = document.querySelector('.navbar-dropdown');
        if (userDropdown) {
            userDropdown.addEventListener('mouseenter', () => {
                this.showDropdown(userDropdown);
            });
            
            userDropdown.addEventListener('mouseleave', () => {
                this.hideDropdown(userDropdown);
            });
        }

        // Manejo responsivo
        window.addEventListener('resize', () => {
            this.handleResize();
        });

        // Efectos de desplazamiento
        window.addEventListener('scroll', () => {
            this.handleScroll();
        });
    }

    updateMobileToggleIcon() {
        const toggle = document.querySelector('.navbar-mobile-toggle');
        const menu = document.querySelector('.navbar-mobile-menu');
        
        if (toggle && menu) {
            const isOpen = menu.classList.contains('active');
            toggle.innerHTML = isOpen ? '✕' : '☰';
        }
    }

    handleNavigation(e) {
        const link = e.target;
        const view = link.dataset.view;
        
        if (view) {
            e.preventDefault();
            
            // Actualiza el estado activo
            document.querySelectorAll('.navbar-link').forEach(l => {
                l.classList.remove('active');
            });
            link.classList.add('active');
            
            // Cierra el menú móvil si está abierto
            const mobileMenu = document.querySelector('.navbar-mobile-menu');
            if (mobileMenu && mobileMenu.classList.contains('active')) {
                mobileMenu.classList.remove('active');
                this.updateMobileToggleIcon();
            }
            
            // Dispara el cambio de vista si la app está disponible
            if (window.app && typeof window.app.switchView === 'function') {
                window.app.switchView(view);
            }
        }
    }

    initDropdowns() {
        // Inicializa el dropdown de usuario
        const userInfo = document.querySelector('.navbar-user-info');
        if (userInfo) {
            userInfo.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleUserDropdown();
            });
        }

        // Cierra el dropdown al hacer clic fuera
        document.addEventListener('click', () => {
            this.closeAllDropdowns();
        });
    }

    toggleUserDropdown() {
        const dropdown = document.querySelector('.navbar-dropdown-menu');
        if (dropdown) {
            const isVisible = dropdown.style.opacity === '1';
            if (isVisible) {
                this.hideDropdown(dropdown.parentElement);
            } else {
                this.showDropdown(dropdown.parentElement);
            }
        }
    }

    showDropdown(container) {
        const dropdown = container.querySelector('.navbar-dropdown-menu');
        if (dropdown) {
            dropdown.style.opacity = '1';
            dropdown.style.visibility = 'visible';
            dropdown.style.transform = 'translateY(0)';
        }
    }

    hideDropdown(container) {
        const dropdown = container.querySelector('.navbar-dropdown-menu');
        if (dropdown) {
            dropdown.style.opacity = '0';
            dropdown.style.visibility = 'hidden';
            dropdown.style.transform = 'translateY(-10px)';
        }
    }

    closeAllDropdowns() {
        document.querySelectorAll('.navbar-dropdown').forEach(dropdown => {
            this.hideDropdown(dropdown);
        });
    }

    updateProgress() {
        // Actualiza la barra de progreso del nivel
        const progressBar = document.querySelector('.navbar-progress');
        if (progressBar && window.app && window.app.currentUser) {
            const user = window.app.currentUser;
            const percentage = user.experience_to_next_level ? 
                (user.experience / user.experience_to_next_level) * 100 : 0;
            progressBar.style.width = `${Math.min(percentage, 100)}%`;
        }
    }

    updateUserInfo(user) {
        if (!user) return;

        // Actualiza el avatar
        const avatar = document.querySelector('.navbar-avatar');
        if (avatar) {
            avatar.textContent = user.first_name.charAt(0).toUpperCase();
        }

        // Actualiza el nombre de usuario
        const username = document.querySelector('.navbar-username');
        if (username) {
            username.textContent = `${user.first_name} ${user.last_name}`;
        }

        // Actualiza el nivel
        const levelBadge = document.querySelector('.navbar-level');
        if (levelBadge) {
            levelBadge.textContent = `Nivel ${user.level}`;
        }

        // Actualiza las notificaciones si las hay
        this.updateNotifications(user);
        
        // Actualiza la barra de progreso
        this.updateProgress();
    }

    updateNotifications(user) {
        const notificationBadge = document.querySelector('.navbar-level-notification');
        
        // Ejemplo: Mostrar notificación para nuevos logros
        const hasNewAchievements = user.badges && user.badges.some(badge => badge.isNew);
        
        if (hasNewAchievements && notificationBadge) {
            notificationBadge.style.display = 'flex';
        } else if (notificationBadge) {
            notificationBadge.style.display = 'none';
        }
    }

    handleResize() {
        // Cierra el menú móvil al cambiar el tamaño a escritorio
        if (window.innerWidth >= 768) {
            const mobileMenu = document.querySelector('.navbar-mobile-menu');
            if (mobileMenu && mobileMenu.classList.contains('active')) {
                mobileMenu.classList.remove('active');
                this.updateMobileToggleIcon();
            }
        }
    }

    handleScroll() {
        const navbar = document.querySelector('.navbar');
        if (!navbar) return;

        // Agregar/quitar sombra según la posición del desplazamiento
        if (window.pageYOffset > 10) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }

        // Actualiza la barra de progreso si está en modo desplazamiento
        const progressBar = document.querySelector('.navbar-progress');
        if (progressBar && progressBar.dataset.mode === 'scroll') {
            const windowHeight = document.documentElement.scrollHeight - window.innerHeight;
            const scrolled = (window.pageYOffset / windowHeight) * 100;
            progressBar.style.width = `${scrolled}%`;
        }
    }

    // Sistema de notificaciones
    showNavbarNotification(message, type = 'info', duration = 3000) {
        const notification = document.createElement('div');
        notification.className = `navbar-notification navbar-notification-${type}`;
        notification.innerHTML = `
            <span class="navbar-notification-text">${message}</span>
            <button class="navbar-notification-close">&times;</button>
        `;

        const navbar = document.querySelector('.navbar');
        if (navbar) {
            navbar.appendChild(notification);

            // Mostrar notificación
            setTimeout(() => notification.classList.add('show'), 100);

            // Manejar botón de cierre
            const closeBtn = notification.querySelector('.navbar-notification-close');
            closeBtn.addEventListener('click', () => {
                this.hideNavbarNotification(notification);
            });

            // Ocultado automático
            if (duration > 0) {
                setTimeout(() => {
                    this.hideNavbarNotification(notification);
                }, duration);
            }
        }
    }

    hideNavbarNotification(notification) {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }

    // Animación de subida de nivel
    triggerLevelUpAnimation(newLevel) {
        const levelBadge = document.querySelector('.navbar-level');
        if (!levelBadge) return;

        // Crear elemento de animación
        const animation = document.createElement('div');
        animation.className = 'navbar-level-up-animation';
        animation.innerHTML = `
            <div class="level-up-burst">🎆</div>
            <div class="level-up-text">¡Nivel ${newLevel}!</div>
        `;

        levelBadge.parentNode.appendChild(animation);

        // Disparar animación
        setTimeout(() => animation.classList.add('show'), 100);

        // Eliminar animación
        setTimeout(() => {
            animation.classList.remove('show');
            setTimeout(() => {
                if (animation.parentNode) {
                    animation.parentNode.removeChild(animation);
                }
            }, 500);
        }, 3000);

        // Actualizar insignia de nivel con animación
        levelBadge.classList.add('level-up');
        setTimeout(() => {
            levelBadge.textContent = `Nivel ${newLevel}`;
            levelBadge.classList.remove('level-up');
        }, 500);
    }

    // Funcionalidad de búsqueda
    initSearch() {
        const searchInput = document.querySelector('.navbar-search-input');
        const searchResults = document.querySelector('.navbar-search-results');
        
        if (searchInput && searchResults) {
            let searchTimeout;
            
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                const query = e.target.value.trim();
                
                if (query.length > 2) {
                    searchTimeout = setTimeout(() => {
                        this.performSearch(query);
                    }, 300);
                } else {
                    this.hideSearchResults();
                }
            });

            // Cerrar búsqueda al hacer clic fuera
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.navbar-search')) {
                    this.hideSearchResults();
                }
            });
        }
    }

    performSearch(query) {
        // Resultados de búsqueda simulados
        const mockResults = [
            { title: 'Operaciones Básicas', type: 'activity', icon: '📊' },
            { title: 'Fracciones', type: 'activity', icon: '📊' },
            { title: 'Ana García', type: 'student', icon: '👤' },
            { title: 'Matemáticas', type: 'subject', icon: '📚' }
        ].filter(item => 
            item.title.toLowerCase().includes(query.toLowerCase())
        );

        this.showSearchResults(mockResults);
    }

    showSearchResults(results) {
        const searchResults = document.querySelector('.navbar-search-results');
        if (!searchResults) return;

        if (results.length === 0) {
            searchResults.innerHTML = '<div class="search-no-results">No se encontraron resultados</div>';
        } else {
            searchResults.innerHTML = results.map(result => `
                <div class="search-result-item" data-type="${result.type}">
                    <span class="search-result-icon">${result.icon}</span>
                    <span class="search-result-title">${result.title}</span>
                    <span class="search-result-type">${result.type}</span>
                </div>
            `).join('');
        }

        searchResults.classList.add('show');
    }

    hideSearchResults() {
        const searchResults = document.querySelector('.navbar-search-results');
        if (searchResults) {
            searchResults.classList.remove('show');
        }
    }
}

// CSS adicional para las nuevas funcionalidades
const additionalNavbarStyles = `
<style>
.navbar.scrolled {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.navbar-notification {
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%) translateY(-10px);
    background: white;
    color: #374151;
    padding: 0.75rem 1rem;
    border-radius: 0.5rem;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 200px;
    opacity: 0;
    visibility: hidden;
    transition: all 0.3s ease;
    z-index: 60;
}

.navbar-notification.show {
    opacity: 1;
    visibility: visible;
    transform: translateX(-50%) translateY(0);
}

.navbar-notification-close {
    background: none;
    border: none;
    font-size: 1.25rem;
    cursor: pointer;
    color: #6b7280;
    padding: 0;
    width: 1.5rem;
    height: 1.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
}

.navbar-level-up-animation {
    position: absolute;
    top: -2rem;
    right: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    opacity: 0;
    transform: translateY(20px);
    transition: all 0.5s ease;
    z-index: 70;
}

.navbar-level-up-animation.show {
    opacity: 1;
    transform: translateY(0);
}

.level-up-burst {
    font-size: 2rem;
    animation: burst 0.6s ease-out;
}

.level-up-text {
    background: linear-gradient(45deg, #ffd700, #ffed4e);
    color: #744210;
    padding: 0.25rem 0.75rem;
    border-radius: 1rem;
    font-weight: 700;
    font-size: 0.875rem;
    margin-top: 0.5rem;
    animation: glow 0.6s ease-out;
}

@keyframes burst {
    0% { transform: scale(0.5) rotate(0deg); }
    50% { transform: scale(1.3) rotate(180deg); }
    100% { transform: scale(1) rotate(360deg); }
}

@keyframes glow {
    0%, 100% { box-shadow: 0 0 5px rgba(255, 215, 0, 0.5); }
    50% { box-shadow: 0 0 20px rgba(255, 215, 0, 0.8); }
}

.navbar-level.level-up {
    animation: levelUpPulse 0.6s ease-out;
}

@keyframes levelUpPulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.2); }
}

.navbar-search {
    position: relative;
    margin: 0 1rem;
}

.navbar-search-input {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: white;
    padding: 0.5rem 1rem;
    border-radius: 1.5rem;
    width: 200px;
    transition: all 0.3s ease;
}

.navbar-search-input::placeholder {
    color: rgba(255, 255, 255, 0.7);
}

.navbar-search-input:focus {
    outline: none;
    background: rgba(255, 255, 255, 0.2);
    border-color: rgba(255, 255, 255, 0.4);
    width: 250px;
}

.navbar-search-results {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: white;
    border-radius: 0.5rem;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    margin-top: 0.5rem;
    max-height: 300px;
    overflow-y: auto;
    opacity: 0;
    visibility: hidden;
    transform: translateY(-10px);
    transition: all 0.3s ease;
    z-index: 60;
}

.navbar-search-results.show {
    opacity: 1;
    visibility: visible;
    transform: translateY(0);
}

.search-result-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    color: #374151;
    cursor: pointer;
    transition: background-color 0.2s ease;
}

.search-result-item:hover {
    background: #f3f4f6;
}

.search-result-type {
    margin-left: auto;
    font-size: 0.75rem;
    color: #6b7280;
    text-transform: capitalize;
}

.search-no-results {
    padding: 1rem;
    text-align: center;
    color: #6b7280;
    font-style: italic;
}
</style>
`;

// Insertar estilos adicionales
document.head.insertAdjacentHTML('beforeend', additionalNavbarStyles);

// Inicializar navbar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    window.levelUpNavbar = new LevelUpNavbar();
});

// Exportar para uso global
window.LevelUpNavbar = LevelUpNavbar;