// Inicialização da aplicação e listeners em tempo real

// INICIALIZAÇÃO
window.onload = () => {
    loadAtendentes();
    initLoginOverlay();
    loadAppointmentsFromFirebase();
    loadMotivosPerdaFromFirebase();
    setupHolidaysRealtimeListener();
    setupAuditLogRealtimeListener();
    
    // Verificar sincronização inicial após carregar
    setTimeout(() => {
        syncLocalStorageToFirebase();
    }, 2000);
    
    // Listener para atualizações em tempo real com prioridade do Firebase
    database.ref('appointments').on('value', (snapshot) => {
        const data = snapshot.val();
        let firebaseAppointments = [];
        
        if (data) {
            // Verificar se data é array (estrutura antiga) ou objeto (nova estrutura)
            if (Array.isArray(data)) {
                // Estrutura antiga - converter para nova
                firebaseAppointments = data;
                // Migrar para nova estrutura em background
                setTimeout(() => {
                    const appointmentsObject = {};
                    firebaseAppointments.forEach(app => {
                        appointmentsObject[app.id] = app;
                    });
                    database.ref('appointments').set(appointmentsObject);
                }, 1000);
            } else {
                // Nova estrutura - objeto com IDs como chaves
                firebaseAppointments = Object.values(data);
            }
        }
        
        // Migrar dados antigos para nova estrutura de status
        const processedAppointments = firebaseAppointments.map(app => {
            if(!app.status) {
                app.status = app.chkConcluido ? 'Concluído' : 'Agendado';
            }
            return app;
        });
        
        // SEMPRE priorizar Firebase - ignorar comparação para forçar sincronização
        appointments = processedAppointments;
        
        // Atualizar localStorage com dados do Firebase (sempre como backup)
        localStorage.setItem('respiroLamicData', JSON.stringify(appointments));
        
        renderTable();
        renderCalendar();
        updateDatalists();
        updateFilterDropdowns();
        
        console.log("Dados sincronizados do Firebase. LocalStorage atualizado como backup.");
    });
};
