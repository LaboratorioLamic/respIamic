// Inicialização da aplicação e listeners em tempo real

// INICIALIZAÇÃO
window.onload = () => {
    loadAtendentes();
    initLoginOverlay();
    applyAgendaConfig();
    loadAppointmentsFromFirebase();
    loadMotivosPerdaFromFirebase();
    setupHolidaysRealtimeListener();
    setupAuditLogRealtimeListener();

    // Verificar sincronização inicial após carregar
    setTimeout(() => {
        syncLocalStorageToFirebase();
    }, 2000);

    // Listener em tempo real por agenda — Firebase sempre tem prioridade
    AGENDA_IDS.forEach(agendaId => {
        const agenda = getAgenda(agendaId);
        database.ref(`${agenda.fbPath}/appointments`).on('value', (snapshot) => {
            const lista = _toAppointmentList(snapshot.val());
            setAppointments(lista, agendaId);
            localStorage.setItem(agenda.lsKey, JSON.stringify(lista));

            renderHomeCards();
            if (agendaId === currentAgendaId) {
                renderTable();
                renderCalendar();
                updateDatalists();
                updateFilterDropdowns();
            }
            console.log(`Agenda '${agendaId}' sincronizada do Firebase (${lista.length} registros).`);
        });
    });
};
