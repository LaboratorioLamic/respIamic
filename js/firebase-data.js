// Persistência de agendamentos no Firebase — um nó por agenda

// Normaliza registros vindos do Firebase (array antigo ou objeto novo)
function _toAppointmentList(data) {
    if (!data) return [];
    const lista = Array.isArray(data) ? data.filter(Boolean) : Object.values(data);
    return lista.map(app => {
        if (!app.status) app.status = app.chkConcluido ? 'Concluído' : 'Agendado';
        return app;
    });
}

function _appointmentsRef(agendaId) {
    return database.ref(`${getAgenda(agendaId).fbPath}/appointments`);
}

// MIGRAÇÃO ÚNICA DO NÓ LEGADO
// Copia `appointments` (estrutura antiga, agenda única) para o nó da agenda.
// O nó legado NUNCA é apagado — permite rollback.
function migrateLegacyAgenda(agendaId) {
    const agenda = getAgenda(agendaId);
    if (!agenda.legacyPath) return Promise.resolve(false);

    return _appointmentsRef(agendaId).once('value').then(snap => {
        if (snap.exists() && Object.keys(snap.val() || {}).length > 0) return false;

        return database.ref(agenda.legacyPath).once('value').then(legacySnap => {
            const legacy = _toAppointmentList(legacySnap.val());
            if (!legacy.length) return false;

            const obj = {};
            legacy.forEach(app => obj[app.id] = app);
            return _appointmentsRef(agendaId).set(obj)
                .then(() => database.ref('agendas/_migracao').update({
                    [agenda.id]: { em: new Date().toISOString(), registros: legacy.length, origem: agenda.legacyPath }
                }))
                .then(() => {
                    console.log(`Migração concluída: ${legacy.length} registros de '${agenda.legacyPath}' → '${agenda.fbPath}/appointments'. Nó legado preservado.`);
                    return true;
                });
        });
    }).catch(error => {
        console.error(`Erro na migração da agenda ${agendaId}:`, error);
        return false;
    });
}

// CARGA
function loadAgendaFromFirebase(agendaId) {
    const agenda = getAgenda(agendaId);
    return migrateLegacyAgenda(agendaId)
        .then(() => _appointmentsRef(agendaId).once('value'))
        .then(snapshot => {
            const lista = _toAppointmentList(snapshot.val());
            setAppointments(lista, agendaId);
            localStorage.setItem(agenda.lsKey, JSON.stringify(lista));
            console.log(`Agenda '${agendaId}': ${lista.length} registros carregados do Firebase.`);
        })
        .catch(error => {
            console.error(`Erro ao carregar agenda '${agendaId}' do Firebase:`, error);
            const localData = localStorage.getItem(agenda.lsKey);
            if (localData) {
                try {
                    setAppointments(_toAppointmentList(JSON.parse(localData)), agendaId);
                    console.warn(`Agenda '${agendaId}': usando backup local temporariamente.`);
                } catch (e) {
                    console.error('Backup local inválido:', e);
                }
            }
        });
}

// Carrega todas as agendas (os cards da tela inicial precisam dos dados de todas)
function loadAppointmentsFromFirebase() {
    return Promise.all(AGENDA_IDS.map(loadAgendaFromFirebase))
        .then(() => loadHolidaysFromFirebase())
        .then(() => {
            renderHomeCards();
            renderTable();
            renderCalendar();
            updateDatalists();
            updateFilterDropdowns();
        });
}

// GRAVAÇÃO
function saveAppointmentsToFirebase(agendaId) {
    const id = agendaId || currentAgendaId;
    const agenda = getAgenda(id);
    const lista = appointmentsDe(id);

    // O Realtime Database rejeita `undefined` em qualquer campo do objeto e
    // lança de forma síncrona no .set() — JSON.stringify/parse troca esses
    // campos por ausência total (equivalente a null no Firebase) em vez de
    // travar o salvamento inteiro.
    const obj = JSON.parse(JSON.stringify(lista.reduce((acc, app) => {
        acc[app.id] = app;
        return acc;
    }, {})));

    return _appointmentsRef(id).set(obj)
        .then(() => {
            console.log(`Agenda '${id}': agendamentos salvos no Firebase.`);
            localStorage.setItem(agenda.lsKey, JSON.stringify(lista));
        })
        .catch(error => {
            console.error(`Erro ao salvar agenda '${id}' no Firebase:`, error);
            if (!navigator.onLine) {
                localStorage.setItem(agenda.lsKey, JSON.stringify(lista));
                console.warn('Offline: dados salvos temporariamente no localStorage.');
            } else {
                showNotification("Erro ao sincronizar com Firebase. Verifique sua conexão.", "error");
            }
            throw error;
        });
}

// Sobe o backup local caso o Firebase esteja vazio (ex.: primeiro acesso após falha)
function syncLocalStorageToFirebase() {
    AGENDA_IDS.forEach(id => {
        const agenda = getAgenda(id);
        const localData = localStorage.getItem(agenda.lsKey);
        if (!localData) return;
        try {
            const locais = JSON.parse(localData);
            if (!locais.length) return;
            _appointmentsRef(id).once('value').then(snapshot => {
                const remotos = _toAppointmentList(snapshot.val());
                if (remotos.length === 0) {
                    setAppointments(locais, id);
                    saveAppointmentsToFirebase(id);
                } else {
                    localStorage.setItem(agenda.lsKey, JSON.stringify(remotos));
                }
            });
        } catch (error) {
            console.error(`Erro ao sincronizar backup local da agenda '${id}':`, error);
        }
    });
}
