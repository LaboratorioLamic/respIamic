// Sistema de notificações (toasts)

// SISTEMA DE NOTIFICAÇÕES
function showNotification(message, type = 'info', duration = 10000) {
    const container = document.getElementById('notification-container');
    const notification = document.createElement('div');
    
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    
    notification.className = `notification notification-${type} rounded-xl shadow-2xl p-4 min-w-[320px] max-w-[400px] flex items-start gap-3`;
    notification.innerHTML = `
        <div class="flex-shrink-0">
            <i class="fas ${icons[type]} text-xl"></i>
        </div>
        <div class="flex-1">
            <p class="font-bold text-sm uppercase tracking-wider">${message}</p>
        </div>
        <button onclick="this.parentElement.remove()" class="flex-shrink-0 hover:opacity-70 transition-opacity">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    container.appendChild(notification);
    
    // Remover automaticamente após o tempo definido
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, duration);
}
