// Conclusão da visita a partir da janela de visualização.
// Nas agendas com vários pacientes por visita (coleta domiciliar) a conclusão
// pode ser fracionada: marca-se quem foi atendido e quem ficou pendente.
// O status do agendamento passa a ser derivado dos pacientes.

let _concluirVisitaId = null;

function abrirConcluirVisita(id) {
    const app = appointments.find(a => a.id == (id != null ? id : _viewRecordId));
    if (!app) return;

    const agenda = getAgenda(app.agendaId || currentAgendaId);
    _concluirVisitaId = app.id;

    // Concluir exige o mesmo checklist que o formulário exige
    const faltando = agenda.checklist.filter(item => !app[CHECKLIST_ITENS[item].chave]);
    const aviso = document.getElementById('concluir-aviso-checklist');
    if (faltando.length) {
        aviso.innerHTML = `<i class="fas fa-triangle-exclamation mr-1"></i>Checklist pendente: ${
            faltando.map(i => CHECKLIST_ITENS[i].rotulo).join(', ')}. Conclua o checklist na edição do agendamento.`;
        aviso.classList.remove('hidden');
    } else {
        aviso.classList.add('hidden');
    }

    const lista = document.getElementById('concluir-lista');
    const pacientes = pacientesDaVisita(app);
    lista.innerHTML = pacientes.map(p => {
        const encerrado = p.status === 'Concluído' || p.status === 'Cancelado';
        const tema = p.status === 'Concluído' ? 'border-green-200 bg-green-50'
                   : p.status === 'Cancelado' ? 'border-slate-200 bg-slate-100'
                   : 'border-slate-200 bg-white';
        const selo = p.status === 'Concluído' ? '<span class="text-[9px] font-black uppercase text-green-700">Concluído</span>'
                   : p.status === 'Cancelado' ? '<span class="text-[9px] font-black uppercase text-slate-500">Cancelado</span>'
                   : '<span class="text-[9px] font-black uppercase text-amber-600">Pendente</span>';
        return `
        <label class="flex items-center gap-3 p-3 rounded-xl border ${tema} cursor-pointer">
            <input type="checkbox" class="concluir-check h-4 w-4 accent-green-600"
                data-indice="${p.indice}" ${p.status === 'Concluído' ? 'checked' : ''} ${p.status === 'Cancelado' ? 'disabled' : ''}>
            <div class="flex-1 min-w-0">
                <div class="text-xs font-black uppercase text-navy-900 truncate">${_cvEscape(p.nome)}${p.titular ? ' <span class="text-[9px] font-bold text-slate-400">(principal)</span>' : ''}</div>
                <div class="text-[10px] font-bold text-slate-400">${idadeLabel(p.idade) || '—'}${p.pedido ? ` · Pedido ${_cvEscape(p.pedido)}` : ''}</div>
            </div>
            ${selo}
        </label>`;
    }).join('');

    document.getElementById('concluir-resumo').textContent =
        `${pacientes.length} paciente${pacientes.length === 1 ? '' : 's'} nesta visita`;

    // Abstinência: obrigatória para concluir nas agendas que usam o campo
    const blocoAbst = document.getElementById('concluir-abstinencia-bloco');
    const inputAbst = document.getElementById('concluir-abstinencia');
    const usaAbst = temCampo('abstinencia', agenda);
    blocoAbst.classList.toggle('hidden', !usaAbst);
    inputAbst.value = usaAbst && app.abstinencia != null ? app.abstinencia : '';

    document.getElementById('modal-view-record').classList.remove('active');
    document.getElementById('modal-concluir-visita').classList.add('active');
}

function fecharConcluirVisita() {
    document.getElementById('modal-concluir-visita').classList.remove('active');
    _concluirVisitaId = null;
}

function marcarTodosConcluirVisita() {
    document.querySelectorAll('#concluir-lista .concluir-check:not(:disabled)')
        .forEach(c => { c.checked = true; });
}

function confirmarConcluirVisita() {
    const app = appointments.find(a => a.id == _concluirVisitaId);
    if (!app) return fecharConcluirVisita();

    const agenda = getAgenda(app.agendaId || currentAgendaId);
    const faltando = agenda.checklist.filter(item => !app[CHECKLIST_ITENS[item].chave]);
    if (faltando.length) {
        const nomes = faltando.map(i => CHECKLIST_ITENS[i].rotulo).join(', ');
        showNotification(`ERRO: Para concluir, o checklist (${nomes}) deve estar ativado.`, 'error');
        return;
    }

    const marcados = {};
    document.querySelectorAll('#concluir-lista .concluir-check').forEach(c => {
        marcados[c.dataset.indice] = c.checked;
    });

    // Abstinência é obrigatória quando alguém está sendo concluído nesta agenda
    let abstinencia = app.abstinencia;
    if (temCampo('abstinencia', agenda) && Object.values(marcados).some(Boolean)) {
        const val = document.getElementById('concluir-abstinencia').value;
        const dias = val === '' ? null : parseInt(val);
        if (dias == null || isNaN(dias) || dias < 0) {
            showNotification('ERRO: Informe os dias de abstinência para concluir o agendamento.', 'error');
            document.getElementById('concluir-abstinencia').focus();
            return;
        }
        abstinencia = dias;
    }

    const oldRecord = { ...app, acompanhantes: (app.acompanhantes || []).map(a => ({ ...a })) };

    // Só mexe em quem não está cancelado — cancelamento continua saindo da edição
    const acompanhantes = (app.acompanhantes || []).map((a, i) => {
        if (statusPaciente(a) === 'Cancelado') return { ...a };
        return { ...a, status: marcados[i] ? 'Concluído' : 'Agendado' };
    });

    const record = { ...app, acompanhantes, abstinencia };
    if (app.status !== 'Cancelado') {
        record.status = marcados['-1'] ? 'Concluído' : 'Agendado';
    }
    record.status = statusDerivadoDaVisita(record);
    record.chkConcluido = record.status === 'Concluído';

    setAppointments(appointments.map(a => a.id == record.id ? record : a));
    saveAppointmentsToFirebase();
    addAuditLog('edit', record, oldRecord);

    const r = resumoPacientes(record);
    showNotification(r.pendentes
        ? `Conclusão parcial: ${r.concluidos} de ${r.total} paciente(s) concluído(s).`
        : 'Visita concluída para todos os pacientes.', 'success');

    fecharConcluirVisita();
    renderTable(); renderCalendar(); updateFilterDropdowns();
}

function _cvEscape(v) {
    return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
