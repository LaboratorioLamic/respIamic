// Autenticação, cadastro e gestão de usuários

// ============================================================
// AUTENTICAÇÃO — LOGIN / USUÁRIOS
// ============================================================
async function hashPassword(password) {
    const data = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function togglePwdVisibility(inputId, iconId) {
    const input = document.getElementById(inputId);
    const icon = document.getElementById(iconId);
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.replace('fa-eye-slash', 'fa-eye');
    }
}

function formatCpfInput(input) {
    let v = input.value.replace(/\D/g, '').slice(0, 11);
    if (v.length > 9) v = v.replace(/^(\d{3})(\d{3})(\d{3})(\d{0,2})/, '$1.$2.$3-$4');
    else if (v.length > 6) v = v.replace(/^(\d{3})(\d{3})(\d{0,3})/, '$1.$2.$3');
    else if (v.length > 3) v = v.replace(/^(\d{3})(\d{0,3})/, '$1.$2');
    input.value = v;
}

function maskCpf(cpf) {
    const d = (cpf || '').replace(/\D/g, '');
    if (d.length !== 11) return cpf || '—';
    return `${d.slice(0,3)}.***.***-${d.slice(9)}`;
}

function getInitials(fullName) {
    if (!fullName) return '?';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

async function initLoginOverlay() {
    // Sempre mostra o login primeiro; "Criar Conta" aparece conforme config
    const snapshot = await database.ref('users').once('value');
    const usersData = snapshot.val();
    const hasUsers = usersData && Object.keys(usersData).length > 0;

    const btn = document.getElementById('btn-criar-conta');
    if (!hasUsers) {
        // Nenhum usuário: libera criação de conta (primeiro usuário = admin)
        btn.classList.remove('hidden');
        btn.classList.add('flex');
    } else {
        const allowSnap = await database.ref('config/allowRegistration').once('value');
        const allow = !!allowSnap.val();
        if (allow) { btn.classList.remove('hidden'); btn.classList.add('flex'); }
        else        { btn.classList.add('hidden');   btn.classList.remove('flex'); }
    }
    showLoginForm();
}

function showLoginForm() {
    document.getElementById('login-form-box').classList.remove('hidden');
    document.getElementById('register-form-box').classList.add('hidden');
    document.getElementById('login-error').classList.add('hidden');
    setTimeout(() => document.getElementById('login-username').focus(), 100);
}

function showRegisterForm() {
    document.getElementById('login-form-box').classList.add('hidden');
    document.getElementById('register-form-box').classList.remove('hidden');
    document.getElementById('register-error').classList.add('hidden');
    populateRegAttendentesList();
    setTimeout(() => document.getElementById('reg-fullname').focus(), 100);
}

function populateRegAttendentesList() {
    const dl1 = document.getElementById('reg-atendentes-list');
    const dl2 = document.getElementById('modal-reg-atendentes-list');
    const opts = atendentesList.map(n => `<option value="${n}">`).join('');
    if (dl1) dl1.innerHTML = opts;
    if (dl2) dl2.innerHTML = opts;
}

async function submitLogin() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');
    errorEl.classList.add('hidden');

    if (!username || !password) {
        errorEl.innerText = 'Preencha usuário e senha.';
        errorEl.classList.remove('hidden');
        return;
    }

    const snap = await database.ref(`users/${username}`).once('value');
    const user = snap.val();

    if (!user || !user.active) {
        errorEl.innerText = 'Usuário não encontrado ou inativo.';
        errorEl.classList.remove('hidden');
        return;
    }

    const hash = await hashPassword(password);
    if (hash !== user.passwordHash) {
        errorEl.innerText = 'Senha incorreta.';
        errorEl.classList.remove('hidden');
        document.getElementById('login-password').value = '';
        return;
    }

    currentUser = user;
    document.getElementById('login-overlay').style.display = 'none';
    updateUserBadge();
    updateConfigSectionVisibility();
    showNotification(`Bem-vindo, ${user.fullName.split(' ')[0]}!`, 'success');
}

async function submitRegister(fromModal) {
    const prefix = fromModal ? 'modal-reg' : 'reg';
    const fullName = document.getElementById(`${prefix}-fullname`).value.trim();
    const username = document.getElementById(`${prefix}-username`).value.trim();
    const cpf = document.getElementById(`${prefix}-cpf`).value.trim();
    const pwd = document.getElementById(`${prefix}-pwd`).value;
    const pwdConfirm = document.getElementById(`${prefix}-pwd-confirm`).value;
    const errorEl = document.getElementById(fromModal ? 'modal-register-error' : 'register-error');
    errorEl.classList.add('hidden');

    if (!fullName || !username || !cpf || !pwd || !pwdConfirm) {
        errorEl.innerText = 'Preencha todos os campos obrigatórios.';
        errorEl.classList.remove('hidden');
        return;
    }
    if (atendentesList.length > 0 && !atendentesList.includes(fullName)) {
        errorEl.innerText = 'O nome deve corresponder a um atendente da lista.';
        errorEl.classList.remove('hidden');
        return;
    }
    if (cpf.replace(/\D/g, '').length !== 11) {
        errorEl.innerText = 'CPF inválido.';
        errorEl.classList.remove('hidden');
        return;
    }
    if (pwd.length < 4) {
        errorEl.innerText = 'A senha deve ter ao menos 4 caracteres.';
        errorEl.classList.remove('hidden');
        return;
    }
    if (pwd !== pwdConfirm) {
        errorEl.innerText = 'As senhas não coincidem.';
        errorEl.classList.remove('hidden');
        return;
    }

    const existing = await database.ref(`users/${username}`).once('value');
    if (existing.val()) {
        errorEl.innerText = 'Este nome de usuário já existe.';
        errorEl.classList.remove('hidden');
        return;
    }

    const allSnap = await database.ref('users').once('value');
    const allUsers = allSnap.val();
    const isFirstUser = !allUsers || Object.keys(allUsers).length === 0;

    const passwordHash = await hashPassword(pwd);
    const newUser = {
        username,
        fullName,
        cpf: cpf.replace(/\D/g, ''),
        passwordHash,
        role: isFirstUser ? 'admin' : 'user',
        active: true,
        createdAt: new Date().toISOString()
    };

    await database.ref(`users/${username}`).set(newUser);

    if (fromModal) {
        document.getElementById('modal-create-user').classList.remove('active');
        clearCreateUserForm();
        showNotification('Usuário criado com sucesso!', 'success');
        addUserAuditLog('user_create', newUser);
        renderUsersTable();
    } else {
        currentUser = newUser;
        document.getElementById('login-overlay').style.display = 'none';
        updateUserBadge();
        updateConfigSectionVisibility();
        showNotification(`Conta criada! Bem-vindo, ${newUser.fullName.split(' ')[0]}!`, 'success');
    }
}

function clearCreateUserForm() {
    ['modal-reg-fullname','modal-reg-username','modal-reg-cpf','modal-reg-pwd','modal-reg-pwd-confirm'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    document.getElementById('modal-register-error').classList.add('hidden');
}

function logoutUser() {
    currentUser = null;
    document.getElementById('login-overlay').style.display = 'flex';
    document.getElementById('login-username').value = '';
    document.getElementById('login-password').value = '';
    document.getElementById('login-error').classList.add('hidden');
    initLoginOverlay();
    switchTabDirect('dashboard');
    syncDrawerUser();
}

// O badge do cabeçalho foi removido; a identidade do usuário aparece só no drawer
function updateUserBadge() {
    if (!currentUser) return;
    syncDrawerUser();
}

function updateConfigSectionVisibility() {
    if (isAdmin()) {
        renderUsersTable();
        loadAllowRegistrationToggle();
    }
    switchConfigTab('usuarios');
}

async function loadAllowRegistrationToggle() {
    const snap = await database.ref('config/allowRegistration').once('value');
    const val = !!snap.val();
    const checkbox = document.getElementById('toggle-allow-registration');
    const track = document.getElementById('toggle-allow-reg-track');
    const thumb = document.getElementById('toggle-allow-reg-thumb');
    checkbox.checked = val;
    if (val) {
        track.classList.replace('bg-slate-600', 'bg-blue-500');
        thumb.style.transform = 'translateX(20px)';
    } else {
        track.classList.replace('bg-blue-500', 'bg-slate-600');
        thumb.style.transform = 'translateX(0)';
    }
}

async function saveAllowRegistration(val) {
    await database.ref('config/allowRegistration').set(val);
    const track = document.getElementById('toggle-allow-reg-track');
    const thumb = document.getElementById('toggle-allow-reg-thumb');
    if (val) {
        track.classList.replace('bg-slate-600', 'bg-blue-500');
        thumb.style.transform = 'translateX(20px)';
    } else {
        track.classList.replace('bg-blue-500', 'bg-slate-600');
        thumb.style.transform = 'translateX(0)';
    }
}

function openCreateUserModal() {
    clearCreateUserForm();
    populateRegAttendentesList();
    document.getElementById('modal-create-user').classList.add('active');
}

async function renderUsersTable() {
    const snap = await database.ref('users').once('value');
    const data = snap.val() || {};
    let users = Object.values(data).sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
    if (_usersFilter === 'active')   users = users.filter(u => u.active !== false);
    if (_usersFilter === 'inactive') users = users.filter(u => u.active === false);
    const tbody = document.getElementById('users-table-body');
    if (!tbody) return;
    tbody.innerHTML = users.map(u => `
        <tr class="hover:bg-slate-50">
            <td class="px-4 py-3 font-bold text-slate-700">${u.fullName}</td>
            <td class="px-4 py-3 text-slate-500 font-mono">${u.username}</td>
            <td class="px-4 py-3 text-slate-400">${maskCpf(u.cpf)}</td>
            <td class="px-4 py-3">
                <span class="px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${u.role === 'admin' ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-slate-100 text-slate-500 border border-slate-200'}">${u.role === 'admin' ? 'Admin' : 'Usuário'}</span>
            </td>
            <td class="px-4 py-3">
                <span class="px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${u.active ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-100 text-red-600 border border-red-200'}">${u.active ? 'Ativo' : 'Inativo'}</span>
            </td>
            <td class="px-4 py-3">
                <div class="flex justify-center gap-1">
                    <button onclick="openEditUserModal('${u.username}')" title="Editar" class="h-7 w-7 rounded-lg flex items-center justify-center text-xs bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-600 hover:text-white transition-all">
                        <i class="fas fa-pen"></i>
                    </button>
                    <button onclick="toggleUserActive('${u.username}', ${!u.active})" title="${u.active ? 'Inativar' : 'Ativar'}" class="h-7 w-7 rounded-lg flex items-center justify-center text-xs ${u.active ? 'bg-yellow-50 text-yellow-600 border border-yellow-200 hover:bg-yellow-500 hover:text-white' : 'bg-green-50 text-green-600 border border-green-200 hover:bg-green-500 hover:text-white'} transition-all">
                        <i class="fas ${u.active ? 'fa-user-slash' : 'fa-user-check'}"></i>
                    </button>
                    <button onclick="toggleUserRole('${u.username}', '${u.role}')" title="${u.role === 'admin' ? 'Rebaixar para Usuário' : 'Promover para Admin'}" class="h-7 w-7 rounded-lg flex items-center justify-center text-xs ${u.role === 'admin' ? 'bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-500 hover:text-white' : 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-blue-500 hover:text-white'} transition-all">
                        <i class="fas ${u.role === 'admin' ? 'fa-user-minus' : 'fa-user-shield'}"></i>
                    </button>
                    <button onclick="deleteUser('${u.username}')" title="Excluir" class="h-7 w-7 rounded-lg flex items-center justify-center text-xs bg-red-50 text-red-500 border border-red-200 hover:bg-red-500 hover:text-white transition-all">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

async function toggleUserActive(username, newActive) {
    await database.ref(`users/${username}/active`).set(newActive);
    renderUsersTable();
}

async function toggleUserRole(username, currentRole) {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    await database.ref(`users/${username}/role`).set(newRole);
    renderUsersTable();
}

// Filtro de status na tabela de usuários
let _usersFilter = 'all';
function setUsersFilter(filter) {
    _usersFilter = filter;
    ['all','active','inactive'].forEach(f => {
        const btn = document.getElementById(`filter-users-${f}`);
        const isActive = f === filter;
        btn.classList.toggle('bg-navy-900',    isActive);
        btn.classList.toggle('text-white',     isActive);
        btn.classList.toggle('shadow',         isActive);
        btn.classList.toggle('border-2',       !isActive);
        if (!isActive) {
            if (f === 'active')   { btn.classList.add('border-green-500','text-green-700'); btn.classList.remove('border-red-400','text-red-600'); }
            if (f === 'inactive') { btn.classList.add('border-red-400','text-red-600');     btn.classList.remove('border-green-500','text-green-700'); }
        }
    });
    renderUsersTable();
}

// Exclusão com modal de confirmação
let _pendingDeleteUsername = null;
function deleteUser(username) {
    _pendingDeleteUsername = username;
    document.getElementById('delete-user-subtitle').innerText = '@' + username;
    document.getElementById('modal-delete-user-confirm').classList.add('active');
}
async function confirmDeleteUser() {
    const username = _pendingDeleteUsername;
    _pendingDeleteUsername = null;
    document.getElementById('modal-delete-user-confirm').classList.remove('active');
    if (!username) return;
    const snap = await database.ref(`users/${username}`).once('value');
    const deletedUser = snap.val() || { username };
    await database.ref(`users/${username}`).remove();
    addUserAuditLog('user_delete', deletedUser);
    renderUsersTable();
    showNotification('Usuário excluído.', 'success');
}

// Modal Minha Conta
function openMyAccountModal() {
    if (!currentUser) return;
    document.getElementById('myaccount-fullname').innerText = currentUser.fullName || '—';
    document.getElementById('myaccount-username').innerText = '@' + currentUser.username;
    document.getElementById('myaccount-cpf').innerText     = maskCpf(currentUser.cpf);
    document.getElementById('myaccount-role').innerText    = currentUser.role === 'admin' ? 'Administrador' : 'Usuário';
    document.getElementById('myaccount-old-pwd').value     = '';
    document.getElementById('myaccount-new-pwd').value     = '';
    document.getElementById('myaccount-confirm-pwd').value = '';
    document.getElementById('myaccount-error').classList.add('hidden');
    document.getElementById('modal-my-account').classList.add('active');
}
async function saveMyAccountPassword() {
    const oldPwd    = document.getElementById('myaccount-old-pwd').value;
    const newPwd    = document.getElementById('myaccount-new-pwd').value;
    const confirmPwd= document.getElementById('myaccount-confirm-pwd').value;
    const errorEl   = document.getElementById('myaccount-error');
    errorEl.classList.add('hidden');
    if (!oldPwd || !newPwd || !confirmPwd) { errorEl.innerText='Preencha todos os campos de senha.'; errorEl.classList.remove('hidden'); return; }
    if (newPwd !== confirmPwd) { errorEl.innerText='As novas senhas não coincidem.'; errorEl.classList.remove('hidden'); return; }
    if (newPwd.length < 4)    { errorEl.innerText='A nova senha deve ter ao menos 4 caracteres.'; errorEl.classList.remove('hidden'); return; }
    const oldHash = await hashPassword(oldPwd);
    const snap    = await database.ref(`users/${currentUser.username}/passwordHash`).once('value');
    if (oldHash !== snap.val()) { errorEl.innerText='Senha atual incorreta.'; errorEl.classList.remove('hidden'); return; }
    const newHash = await hashPassword(newPwd);
    await database.ref(`users/${currentUser.username}/passwordHash`).set(newHash);
    document.getElementById('modal-my-account').classList.remove('active');
    showNotification('Senha alterada com sucesso!', 'success');
}

async function openEditUserModal(username) {
    const snap = await database.ref(`users/${username}`).once('value');
    const u = snap.val();
    if (!u) return;
    document.getElementById('edit-user-username').value = u.username;
    document.getElementById('edit-user-subtitle').innerText = '@' + u.username;
    document.getElementById('edit-user-fullname').value = u.fullName || '';
    document.getElementById('edit-user-cpf').value = u.cpf ? u.cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4') : '';
    document.getElementById('edit-user-role').value = u.role || 'user';
    document.getElementById('edit-user-active').value = String(u.active !== false);
    document.getElementById('edit-user-pwd').value = '';
    document.getElementById('edit-user-pwd-confirm').value = '';
    document.getElementById('edit-user-error').classList.add('hidden');
    // populate datalist
    const dl = document.getElementById('edit-user-atendentes-list');
    dl.innerHTML = atendentesList.map(a => `<option value="${a}">`).join('');
    document.getElementById('modal-edit-user').classList.add('active');
}

async function saveEditUser() {
    const username = document.getElementById('edit-user-username').value;
    const fullName = document.getElementById('edit-user-fullname').value.trim();
    const cpfRaw = document.getElementById('edit-user-cpf').value.replace(/\D/g, '');
    const role = document.getElementById('edit-user-role').value;
    const active = document.getElementById('edit-user-active').value === 'true';
    const pwd = document.getElementById('edit-user-pwd').value;
    const pwdConfirm = document.getElementById('edit-user-pwd-confirm').value;
    const errorEl = document.getElementById('edit-user-error');
    errorEl.classList.add('hidden');

    if (!fullName) { errorEl.innerText = 'Nome completo é obrigatório.'; errorEl.classList.remove('hidden'); return; }
    if (atendentesList.length > 0 && !atendentesList.some(a => a.toUpperCase() === fullName.toUpperCase())) {
        errorEl.innerText = 'Nome deve corresponder a um colaborador da lista.'; errorEl.classList.remove('hidden'); return;
    }
    if (pwd && pwd !== pwdConfirm) { errorEl.innerText = 'As senhas não coincidem.'; errorEl.classList.remove('hidden'); return; }
    if (pwd && pwd.length < 4) { errorEl.innerText = 'A senha deve ter ao menos 4 caracteres.'; errorEl.classList.remove('hidden'); return; }

    // Buscar nome atual antes de atualizar para propagar mudança nos agendamentos
    const snapOld = await database.ref(`users/${username}`).once('value');
    const oldData = snapOld.val() || {};
    const oldFullName = oldData.fullName || '';

    const updates = { fullName, cpf: cpfRaw, role, active };
    if (pwd) updates.passwordHash = await hashPassword(pwd);

    await database.ref(`users/${username}`).update(updates);

    // Propagar mudança de nome em todos os agendamentos onde era atendente
    if (oldFullName && fullName && oldFullName.toUpperCase() !== fullName.toUpperCase()) {
        appointments = appointments.map(a =>
            a.atendente && a.atendente.toUpperCase() === oldFullName.toUpperCase()
                ? { ...a, atendente: fullName.toUpperCase() }
                : a
        );
        saveAppointmentsToFirebase();
        // Atualizar badge se for o próprio usuário logado
        if (currentUser && currentUser.username === username) {
            currentUser.fullName = fullName;
            updateUserBadge();
        }
    }

    // Calcular campos alterados para o diff
    const userChanges = [];
    if (oldData.fullName !== fullName) userChanges.push({ label: 'Nome', oldVal: oldData.fullName || '—', newVal: fullName });
    if (oldData.role !== role) userChanges.push({ label: 'Papel', oldVal: oldData.role === 'admin' ? 'Admin' : 'Usuário', newVal: role === 'admin' ? 'Admin' : 'Usuário' });
    if (String(oldData.active) !== String(active)) userChanges.push({ label: 'Status', oldVal: oldData.active !== false ? 'Ativo' : 'Inativo', newVal: active ? 'Ativo' : 'Inativo' });
    if (pwd) userChanges.push({ label: 'Senha', oldVal: '••••••••', newVal: '(nova senha)' });
    if (userChanges.length > 0) addUserAuditLog('user_edit', { username, fullName }, userChanges);

    document.getElementById('modal-edit-user').classList.remove('active');
    renderUsersTable();
    showNotification('Usuário atualizado com sucesso.', 'success');
}

let _pendingAuditDeleteId = null;

function deleteAuditLogEntry(id) {
    if (!isAdmin()) return;
    _pendingAuditDeleteId = id;
    document.getElementById('modal-audit-delete-confirm').classList.add('active');
}

function confirmAuditDeleteEntry() {
    const id = _pendingAuditDeleteId;
    _pendingAuditDeleteId = null;
    document.getElementById('modal-audit-delete-confirm').classList.remove('active');
    if (!id) return;
    auditLog = auditLog.filter(e => e.id !== id);
    database.ref(`auditLog/${id}`).remove().catch(console.error);
    renderHistoryList();
    renderTraceability();
}
// ============================================================
