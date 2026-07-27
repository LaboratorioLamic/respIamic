// Backup, importação/exportação e status das configurações

// FUNÇÕES DE BACKUP E CONFIGURAÇÕES
function updateConfigStatus() {
    document.getElementById('total-appointments').innerText = appointments.length;
}

function exportData() {
    const backupData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        appointments: appointments,
        atendentesList: atendentesList,
        metadata: {
            totalAppointments: appointments.length,
            firebaseConnected: !!database,
            exportType: 'full_backup'
        }
    };

    const dataStr = JSON.stringify(backupData, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `respiroLamic_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showNotification('✅ Backup exportado com sucesso! Arquivo salvo como: respiroLamic_backup_' + new Date().toISOString().split('T')[0] + '.json', 'success');
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const backupData = JSON.parse(e.target.result);
            
            if (!backupData.appointments || !Array.isArray(backupData.appointments)) {
                throw new Error('Formato de backup inválido');
            }

            const confirmImport = confirm(
                `⚠️ ATENÇÃO!\n\n` +
                `Você está prestes a importar ${backupData.appointments.length} agendamentos.\n` +
                `Isso SUBSTITUIRÁ todos os dados atuais.\n\n` +
                `Deseja continuar?`
            );

            if (confirmImport) {
                appointments = backupData.appointments;
                
                // Migrar dados antigos para nova estrutura se necessário
                appointments = appointments.map(app => {
                    if(!app.status) {
                        app.status = app.chkConcluido ? 'Concluído' : 'Agendado';
                    }
                    return app;
                });

                // Restaurar lista de atendentes se existir
                if (backupData.atendentesList && Array.isArray(backupData.atendentesList)) {
                    atendentesList = backupData.atendentesList;
                    updateFilterDropdowns();
                }

                saveAppointmentsToFirebase();
                renderTable();
                renderCalendar();
                updateDatalists();
                updateConfigStatus();

                showNotification('✅ Backup importado com sucesso! ' + backupData.appointments.length + ' agendamentos restaurados.', 'success');
            }
        } catch (error) {
            showNotification('❌ Erro ao importar backup: ' + error.message + '. Verifique se o arquivo é um backup válido.', 'error');
        }
    };
    reader.readAsText(file);
    
    // Limpar o input para permitir importar o mesmo arquivo novamente
    event.target.value = '';
}


// Navega diretamente (uso interno)
function switchTabDirect(tab) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.getElementById(`tab-${tab}`).classList.add('active');
    markActiveTab(tab);
    if (tab === 'dashboard') renderCalendar();
    if (tab === 'indicadores') renderIndicadores();
    if (tab === 'config') { updateConfigStatus(); updateConfigSectionVisibility(); }
}

const _origSwitchTab = switchTab;
switchTab = function(tab) {
    if (tab === 'config' && !isAdmin()) {
        showNotification('Acesso restrito a administradores.', 'warning');
        return;
    }
    _origSwitchTab(tab);
    if (tab === 'config') { updateConfigStatus(); updateConfigSectionVisibility(); }
};
