// Salvamento de agendamentos e modal de checklist

// SALVAR
function saveRecord(e) {
    e.preventDefault();
    const agenda = currentAgenda();
    const id = document.getElementById('reg-id').value;
    const atendenteInput = document.getElementById('reg-atendente').value.trim();

    // Validação Checklist & Status — só os itens que a agenda usa
    const statusVal = document.getElementById('reg-status').value;
    const valores = lerChecklist();
    const itensAtivos = agenda.checklist;
    const faltando = itensAtivos.filter(item => !valores[item]);

    // Em "Em andamento" e "Cancelado", o checklist não é obrigatório
    if (statusVal === 'Em andamento' || statusVal === 'Cancelado') {
        resetChecklistUI({});
        proceedWithSave(id, atendenteInput, {}, statusVal);
        return;
    }

    // Validação específica para status "Concluído"
    if (statusVal === 'Concluído' && faltando.length) {
        const nomes = itensAtivos.map(i => CHECKLIST_ITENS[i].rotulo).join(', ');
        showNotification(`ERRO: Para marcar o status como Concluído, o checklist (${nomes}) deve estar ativado.`, "error");
        return;
    }

    // Aviso para checklist incompleto nos demais status
    if (faltando.length) {
        pendingChecklistAction = () => {
            proceedWithSave(id, atendenteInput, valores, statusVal);
        };
        showChecklistConfirmModal(faltando.map(i => CHECKLIST_ITENS[i].aviso));
        return;
    }

    proceedWithSave(id, atendenteInput, valores, statusVal);
}

function proceedWithSave(id, atendenteInput, chkValores, statusVal) {
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

    const agenda = currentAgenda();
    const record = {
        id: id ? parseInt(id) : Date.now(),
        agendaId: agenda.id,
        data: document.getElementById('reg-data').value,
        horaInicio: document.getElementById('reg-hora-inicio').value,
        horaFim: document.getElementById('reg-hora-fim').value,
        duracao: document.getElementById('reg-duracao').value,
        paciente: document.getElementById('reg-paciente').value,
        idade: parseInt(document.getElementById('reg-idade').value),
        contato: document.getElementById('reg-contato').value,
        pedido: document.getElementById('reg-pedido').value,
        atendente: document.getElementById('reg-atendente').value,
        chkConcluido: statusVal === 'Concluído', // legado/garantia
        status: statusVal,
        comentarios: document.getElementById('reg-comentarios').value,
        motivoPerda: statusVal === 'Cancelado' ? document.getElementById('reg-motivo-perda').value : '',
        anexos: getAnexosUpload('reg')
    };

    // Checklist — grava sempre as três chaves para manter o formato estável
    Object.keys(CHECKLIST_ITENS).forEach(item => {
        record[CHECKLIST_ITENS[item].chave] = temChecklist(item, agenda) ? !!chkValores[item] : false;
    });

    // Campos específicos da agenda
    if (temCampo('exame', agenda))     record.exame = document.getElementById('reg-exame').value;
    if (temCampo('substrato', agenda)) record.substrato = document.getElementById('reg-substrato').value;
    if (temCampo('metano', agenda))    record.metano = document.getElementById('reg-metano').value;
    if (temCampo('abstinencia', agenda)) {
        const val = document.getElementById('reg-abstinencia').value;
        record.abstinencia = val === '' ? null : parseInt(val);
    }
    if (temCampo('endereco', agenda)) {
        record.cep         = document.getElementById('reg-cep').value.trim();
        record.logradouro  = document.getElementById('reg-logradouro').value.trim();
        record.numero      = document.getElementById('reg-numero').value.trim();
        record.complemento = document.getElementById('reg-complemento').value.trim();
        record.bairro      = document.getElementById('reg-bairro').value.trim().toUpperCase();
        record.cidade      = document.getElementById('reg-cidade').value.trim().toUpperCase();
        record.estado      = document.getElementById('reg-estado').value.trim().toUpperCase();
        record.distante    = document.getElementById('reg-distante').checked;
    }
    if (temCampo('multiPaciente', agenda)) {
        record.acompanhantes = lerAcompanhantes();
    }
    if (temCampo('pontoReferencia', agenda)) {
        record.pontoReferencia = document.getElementById('reg-ponto-referencia').value.trim();
    }
    if (temCampo('coletador', agenda)) {
        record.coletador = document.getElementById('reg-coletador').value.trim().toUpperCase();
    }

    // NOTA: O status "atrasado" é calculado dinamicamente nas funções de renderização
    // (renderCalendar, openDayDetails, renderTable) com base na data atual vs data do agendamento
    // Ao alterar a data para hoje ou futuro, a visualização será atualizada automaticamente
    
    const error = validateAppointment(record);
    if (error) {
        if (error === "DATA_PASSADA") {
            // Mostrar modal elegante de confirmação para data passada
            showPastDateModal(() => {
                // Usuário confirmou, continuar com o salvamento
                proceedWithSaveAfterValidation(record, id);
            });
            return;
        } else {
            showNotification(error, "error");
            return;
        }
    }
    
    // Se não houver erro, continuar com salvamento normal
    proceedWithSaveAfterValidation(record, id);
}

// Agendas que exigem anexo avisam (sem bloquear) quando o registro vai sem nenhum.
function exigeAnexo(agenda) {
    return (agenda || currentAgenda()).id === 'coletaDomiciliar';
}

function proceedWithSaveAfterValidation(record, id) {
    // Aviso de anexo faltando — cancelado não precisa de anexo
    if (exigeAnexo(currentAgenda()) && !(record.anexos || []).length
        && record.status !== 'Cancelado' && !_anexoAvisoConfirmado) {
        pendingAnexoAction = () => proceedWithSaveAfterValidation(record, id);
        showAnexoFaltandoModal();
        return;
    }
    _anexoAvisoConfirmado = false;

    const isNew = !id;
    const oldRecord = isNew ? null : appointments.find(a => a.id == id) || null;
    if(id) setAppointments(appointments.map(a => a.id == id ? record : a)); else setAppointments([...appointments, record]);
    saveAppointmentsToFirebase();
    addAuditLog(isNew ? 'create' : 'edit', record, oldRecord);
    showNotification(id ? "Agendamento atualizado com sucesso!" : "Agendamento criado com sucesso!", "success");
    closeModals(); renderTable(); renderCalendar(); updateDatalists(); updateFilterDropdowns();
}

// MODAL DE AVISO — AGENDAMENTO SEM ANEXO
let pendingAnexoAction = null;
let _anexoAvisoConfirmado = false;

function showAnexoFaltandoModal() {
    document.getElementById('modal-anexo-faltando').classList.add('active');
}

function confirmAnexoFaltando() {
    document.getElementById('modal-anexo-faltando').classList.remove('active');
    _anexoAvisoConfirmado = true;
    if (pendingAnexoAction) {
        const acao = pendingAnexoAction;
        pendingAnexoAction = null;
        acao();
    }
}

function cancelAnexoFaltando() {
    document.getElementById('modal-anexo-faltando').classList.remove('active');
    pendingAnexoAction = null;
    _anexoAvisoConfirmado = false;
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
