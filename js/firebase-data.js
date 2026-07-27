// Persistência de agendamentos no Firebase

// FUNÇÕES DO FIREBASE
function loadAppointmentsFromFirebase() {
    return database.ref('appointments').once('value')
        .then(snapshot => {
            const data = snapshot.val();
            let firebaseAppointments = [];
            
            if (data) {
                // Verificar se data é array (estrutura antiga) ou objeto (nova estrutura)
                if (Array.isArray(data)) {
                    // Estrutura antiga
                    firebaseAppointments = data;
                } else {
                    // Nova estrutura - objeto com IDs como chaves
                    firebaseAppointments = Object.values(data);
                }
            }
            
            // Migrar dados antigos para nova estrutura de status
            firebaseAppointments = firebaseAppointments.map(app => {
                if(!app.status) {
                    app.status = app.chkConcluido ? 'Concluído' : 'Agendado';
                }
                return app;
            });
            
            // SEMPRE priorizar Firebase sobre localStorage
            appointments = firebaseAppointments;
            
            // Atualizar localStorage com dados do Firebase (backup)
            localStorage.setItem('respiroLamicData', JSON.stringify(appointments));
            
            console.log("Dados carregados do Firebase. LocalStorage atualizado como backup.");
            
            return loadHolidaysFromFirebase().then(() => {
                renderTable();
                renderCalendar();
                updateDatalists();
                updateFilterDropdowns();
            });
        })
        .catch(error => {
            console.error("Erro ao carregar do Firebase:", error);
            // Apenas usar localStorage como último recurso, mas não salvar nele
            const localData = localStorage.getItem('respiroLamicData');
            if (localData) {
                appointments = JSON.parse(localData);
                appointments = appointments.map(app => {
                    if(!app.status) {
                        app.status = app.chkConcluido ? 'Concluído' : 'Agendado';
                    }
                    return app;
                });
                
                // Tentar sincronizar dados locais com Firebase quando possível
                setTimeout(() => {
                    saveAppointmentsToFirebase();
                }, 1000);
                
                return loadHolidaysFromFirebase().then(() => {
                    renderTable();
                    renderCalendar();
                    updateDatalists();
                    updateFilterDropdowns();
                });
                
                console.warn("Usando dados locais temporariamente. Tentando sincronizar com Firebase...");
            } else {
                console.error("Nenhum dado encontrado localmente.");
            }
        });
}

function saveAppointmentsToFirebase() {
    // Converter array para objeto com IDs como chaves para melhor sincronização
    const appointmentsObject = {};
    appointments.forEach(app => {
        appointmentsObject[app.id] = app;
    });
    
    return database.ref('appointments').set(appointmentsObject)
        .then(() => {
            console.log("Agendamentos salvos com sucesso no Firebase");
            // Atualizar localStorage APENAS como backup dos dados do Firebase
            localStorage.setItem('respiroLamicData', JSON.stringify(appointments));
        })
        .catch(error => {
            console.error("Erro ao salvar no Firebase:", error);
            // NÃO salvar no localStorage automaticamente para evitar conflitos
            // Apenas salvar se for fallback crítico
            if (!navigator.onLine) {
                localStorage.setItem('respiroLamicData', JSON.stringify(appointments));
                console.warn("Offline: Dados salvos temporariamente no localStorage.");
            } else {
                showNotification("Erro ao sincronizar com Firebase. Verifique sua conexão.", "error");
            }
            throw error; // Propagar erro para tratamento acima
        });
}

// Função para forçar sincronização do localStorage com Firebase
function syncLocalStorageToFirebase() {
    const localData = localStorage.getItem('respiroLamicData');
    if (localData) {
        try {
            const localAppointments = JSON.parse(localData);
            database.ref('appointments').once('value')
                .then(snapshot => {
                    const firebaseData = snapshot.val();
                    const firebaseAppointments = firebaseData ? Object.values(firebaseData) : [];
                    
                    // Se Firebase está vazio, usar dados locais
                    if (firebaseAppointments.length === 0 && localAppointments.length > 0) {
                        appointments = localAppointments;
                        return saveAppointmentsToFirebase();
                    }
                    // Se Firebase tem dados, manter como prioridade
                    else if (firebaseAppointments.length > 0) {
                        appointments = firebaseAppointments;
                        localStorage.setItem('respiroLamicData', JSON.stringify(appointments));
                        console.log("Firebase tem prioridade. Dados locais ignorados.");
                    }
                });
        } catch (error) {
            console.error("Erro ao sincronizar localStorage com Firebase:", error);
        }
    }
}
