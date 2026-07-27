// Salvamento de agendamentos e modal de checklist

// SALVAR
function saveRecord(e) {
    e.preventDefault();
    const id = document.getElementById('reg-id').value;
    const atendenteInput = document.getElementById('reg-atendente').value.trim();
    
    // Validação Checklist & Status
    const statusVal = document.getElementById('reg-status').value;
    const chkOr = document.getElementById('chk-orientacao-val').value === 'true';
    const chkAn = document.getElementById('chk-anexo-val').value === 'true';
    
    // Se o status for "Em andamento" ou "Cancelado", pula toda a validação de checklist e continua diretamente
    if (statusVal === 'Em andamento' || statusVal === 'Cancelado') {
        // Para "Em andamento" e "Cancelado", o checklist não é obrigatório
        // Define os valores como false para garantir consistência
        document.getElementById('chk-orientacao-val').value = 'false';
        document.getElementById('chk-anexo-val').value = 'false';
        proceedWithSave(id, atendenteInput, false, false, statusVal);
        return;
    }
    
    // Validação específica para status "Concluído"
    if (statusVal === 'Concluído' && (!chkOr || !chkAn)) {
        showNotification("ERRO: Para marcar o status como Concluído, todo o checklist (Orientação e Anexo) deve estar ativado.", "error");
        return;
    }
    
    // Aviso para checklist incompleto em outros status (exceto "Em andamento")
    if (!chkOr || !chkAn) {
        const checklistItems = [];
        if (!chkOr) checklistItems.push("Enviar orientação ao paciente");
        if (!chkAn) checklistItems.push("Anexar guia no sistema UniLab");
        
        // Salvar ação pendente e mostrar modal
        pendingChecklistAction = () => {
            // Continuar com o salvamento
            proceedWithSave(id, atendenteInput, chkOr, chkAn, statusVal);
        };
        
        showChecklistConfirmModal(checklistItems);
        return;
    }

    // Se não houver problema com checklist, continuar com validação
    proceedWithSave(id, atendenteInput, chkOr, chkAn, statusVal);
}

function proceedWithSave(id, atendenteInput, chkOr, chkAn, statusVal) {
    // Forçar nome do paciente para maiúsculas
    const pacienteInput = document.getElementById('reg-paciente').value.trim();
    document.getElementById('reg-paciente').value = pacienteInput.toUpperCase();
    
    // Validação rigorosa do Atendente se a lista existir
    if (atendentesList.length > 0 && !atendentesList.includes(atendenteInput.toUpperCase())) {
        const caseSensitiveMatch = atendentesList.find(a => a.toUpperCase() === atendenteInput.toUpperCase());
        if (caseSensitiveMatch) {
            document.getElementById('reg-atendente').value = caseSensitiveMatch; 
        } else {
            showNotification("ATENDENTE INVÁLIDO. O nome inserido não corresponde a nenhum atendente da lista obrigatória.", "error");
            return;
        }
    }

    const record = {
        id: id ? parseInt(id) : Date.now(),
        data: document.getElementById('reg-data').value,
        horaInicio: document.getElementById('reg-hora-inicio').value,
        horaFim: document.getElementById('reg-hora-fim').value,
        duracao: document.getElementById('reg-duracao').value,
        paciente: document.getElementById('reg-paciente').value,
        idade: parseInt(document.getElementById('reg-idade').value),
        contato: document.getElementById('reg-contato').value,
        exame: document.getElementById('reg-exame').value,
        metano: document.getElementById('reg-metano').value,
        substrato: document.getElementById('reg-substrato').value,
        pedido: document.getElementById('reg-pedido').value,
        atendente: document.getElementById('reg-atendente').value,
        chkOrientacao: chkOr,
        chkAnexo: chkAn,
        chkConcluido: statusVal === 'Concluído', // legado/garantia
        status: statusVal,
        comentarios: document.getElementById('reg-comentarios').value,
        motivoPerda: statusVal === 'Cancelado' ? document.getElementById('reg-motivo-perda').value : ''
    };
    
    // NOTA: O status "atrasado" é calculado dinamicamente nas funções de renderização
    // (renderCalendar, openDayDetails, renderTable) com base na data atual vs data do agendamento
    // Ao alterar a data para hoje ou futuro, a visualização será atualizada automaticamente
    
    const error = validateAppointment(record);
    if (error) {
        if (error === "DATA_PASSADA") {
            // Mostrar modal elegante de confirmação para data passada
            showPastDateModal(() => {
                // Usuário confirmou, continuar com o salvamento
                proceedWithSaveAfterValidation(record, id, chkOr, chkAn, statusVal);
            });
            return;
        } else {
            showNotification(error, "error");
            return;
        }
    }
    
    // Se não houver erro, continuar com salvamento normal
    proceedWithSaveAfterValidation(record, id, chkOr, chkAn, statusVal);
}

function proceedWithSaveAfterValidation(record, id, chkOr, chkAn, statusVal) {
    const isNew = !id;
    const oldRecord = isNew ? null : appointments.find(a => a.id == id) || null;
    if(id) appointments = appointments.map(a => a.id == id ? record : a); else appointments.push(record);
    saveAppointmentsToFirebase();
    addAuditLog(isNew ? 'create' : 'edit', record, oldRecord);
    showNotification(id ? "Agendamento atualizado com sucesso!" : "Agendamento criado com sucesso!", "success");
    closeModals(); renderTable(); renderCalendar(); updateDatalists(); updateFilterDropdowns();
}

// FUNÇÕES DA MODAL DE CHECKLIST
function showChecklistConfirmModal(checklistItems) {
    const itemsContainer = document.getElementById('checklist-missing-items');
    itemsContainer.innerHTML = checklistItems.map(item => `
        <div class="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div class="h-6 w-6 bg-red-500 rounded-full flex items-center justify-center">
                <i class="fas fa-times text-white text-xs"></i>
            </div>
            <span class="text-red-800 font-medium text-sm">${item}</span>
        </div>
    `).join('');
    
    document.getElementById('modal-checklist-confirm').classList.add('active');
}

function confirmChecklistIncomplete() {
    document.getElementById('modal-checklist-confirm').classList.remove('active');
    if (pendingChecklistAction) {
        pendingChecklistAction();
        pendingChecklistAction = null;
    }
}

function cancelChecklistConfirm() {
    document.getElementById('modal-checklist-confirm').classList.remove('active');
    pendingChecklistAction = null;
}
