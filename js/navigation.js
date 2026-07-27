// Navegação: abas, sub-abas de configurações e drawer

// SUB-ABAS DE CONFIGURAÇÕES
function switchConfigTab(tab) {
    document.querySelectorAll('.cfg-tab').forEach(el => el.classList.add('hidden'));
    document.getElementById(`cfg-tab-${tab}`).classList.remove('hidden');
    ['usuarios', 'backup'].forEach(t => {
        const btn = document.getElementById(`cfg-btn-${t}`);
        if (t === tab) {
            btn.classList.add('bg-navy-900', 'text-white', 'shadow-md');
            btn.classList.remove('text-slate-500', 'hover:bg-slate-100');
        } else {
            btn.classList.remove('bg-navy-900', 'text-white', 'shadow-md');
            btn.classList.add('text-slate-500', 'hover:bg-slate-100');
        }
    });
}

// NAVEGAÇÃO DE ABAS
function markActiveTab(tab) {
    document.querySelectorAll('[data-drawer-tab]').forEach(b => b.classList.toggle('is-active', b.dataset.drawerTab === tab));
}

function switchTab(tab) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.getElementById(`tab-${tab}`).classList.add('active');
    markActiveTab(tab);

    if(tab === 'dashboard') renderCalendar();
    if(tab === 'indicadores') renderIndicadores();
}

// ── MENU SUSPENSO LATERAL (DRAWER) ──────────────────────────
function isDrawerOpen() {
    return document.getElementById('side-drawer').classList.contains('is-open');
}

function openDrawer() {
    document.getElementById('side-drawer').classList.add('is-open');
    document.getElementById('drawer-backdrop').classList.add('is-open');
    const burger = document.getElementById('burger-btn');
    burger.classList.add('is-open');
    burger.setAttribute('aria-expanded', 'true');
    burger.setAttribute('aria-label', 'Fechar menu');
    syncDrawerUser();
}

function closeDrawer() {
    document.getElementById('side-drawer').classList.remove('is-open');
    document.getElementById('drawer-backdrop').classList.remove('is-open');
    const burger = document.getElementById('burger-btn');
    burger.classList.remove('is-open');
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Abrir menu');
}

function toggleDrawer() {
    isDrawerOpen() ? closeDrawer() : openDrawer();
}

function drawerNavigate(tab) {
    closeDrawer();
    switchTab(tab);
}

// Reflete o usuário logado dentro do drawer
function syncDrawerUser() {
    const box = document.getElementById('drawer-user');
    const cfgBtn = document.getElementById('drawer-btn-config');
    if (!currentUser) {
        box.classList.add('hidden');
        box.classList.remove('flex');
        cfgBtn.classList.add('hidden');
        return;
    }
    box.classList.remove('hidden');
    box.classList.add('flex');
    document.getElementById('drawer-user-initials').innerText = getInitials(currentUser.fullName);
    document.getElementById('drawer-user-name').innerText = formatAtendenteName(currentUser.fullName);
    document.getElementById('drawer-user-role').innerText = isAdmin() ? 'Administrador' : 'Atendente';
    cfgBtn.classList.toggle('hidden', !isAdmin());
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isDrawerOpen()) closeDrawer();
});
