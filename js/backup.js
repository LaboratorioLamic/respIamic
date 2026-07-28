// Backup, importação/exportação e status das configurações

// FUNÇÕES DE BACKUP E CONFIGURAÇÕES
function updateConfigStatus() {
    const total = AGENDA_IDS.reduce((soma, id) => soma + appointmentsDe(id).length, 0);
    document.getElementById('total-appointments').innerText = total;
}

function exportData() {
    const agendasExport = {};
    AGENDA_IDS.forEach(id => agendasExport[id] = appointmentsDe(id));
    const total = AGENDA_IDS.reduce((soma, id) => soma + appointmentsDe(id).length, 0);

    const backupData = {
        version: '2.0',
        exportDate: new Date().toISOString(),
        agendas: agendasExport,
        appointments: appointments,   // compatibilidade com backups v1.0 (agenda ativa)
        agendaAtiva: currentAgendaId,
        atendentesList: atendentesList,
        metadata: {
            totalAppointments: total,
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

            // v2.0 traz `agendas`; v1.0 traz só `appointments` (agenda respiratória)
            const porAgenda = {};
            if (backupData.agendas && typeof backupData.agendas === 'object') {
                AGENDA_IDS.forEach(id => {
                    if (Array.isArray(backupData.agendas[id])) porAgenda[id] = backupData.agendas[id];
                });
            } else if (Array.isArray(backupData.appointments)) {
                porAgenda[AGENDA_PADRAO] = backupData.appointments;
            }

            const alvos = Object.keys(porAgenda);
            if (!alvos.length) throw new Error('Formato de backup inválido');

            const total = alvos.reduce((soma, id) => soma + porAgenda[id].length, 0);
            const resumo = alvos.map(id => `• ${getAgenda(id).nome}: ${porAgenda[id].length}`).join('\n');

            const confirmImport = confirm(
                `⚠️ ATENÇÃO!\n\n` +
                `Você está prestes a importar ${total} agendamentos:\n${resumo}\n\n` +
                `Isso SUBSTITUIRÁ os dados atuais dessas agendas.\n\n` +
                `Deseja continuar?`
            );

            if (confirmImport) {
                alvos.forEach(id => {
                    const lista = porAgenda[id].map(app => {
                        if (!app.status) app.status = app.chkConcluido ? 'Concluído' : 'Agendado';
                        return app;
                    });
                    setAppointments(lista, id);
                    saveAppointmentsToFirebase(id);
                });

                // Restaurar lista de atendentes se existir
                if (backupData.atendentesList && Array.isArray(backupData.atendentesList)) {
                    atendentesList = backupData.atendentesList;
                    updateFilterDropdowns();
                }

                renderHomeCards();
                renderTable();
                renderCalendar();
                updateDatalists();
                updateConfigStatus();

                showNotification(`✅ Backup importado com sucesso! ${total} agendamentos restaurados.`, 'success');
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
    if (tab === 'inicio') renderHomeCards();
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
