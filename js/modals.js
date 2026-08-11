// Modais: detalhes do dia, agendamento, feriados e observações

// MODAIS
function closeModals() {
    // Fechar sem salvar descarta os blobs de imagem enviados nesta sessão que
    // não ficaram referenciados em nenhum agendamento já persistido.
    if (document.getElementById('modal-record')?.classList.contains('active')) {
        discardSessionBlobs('reg', blobsPersistidos());
    }
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
}

// IDs de imagem já referenciados em algum agendamento salvo (todas as agendas)
function blobsPersistidos() {
    const ids = [];
    Object.values(agendaData).forEach(lista => {
        lista.forEach(app => {
            (app.anexos || []).forEach(anexo => {
                if (anexo && anexo.tipo === 'imagem' && anexo.fileId) ids.push(anexo.fileId);
            });
        });
    });
    return ids;
}

// Funções para modal de data passada
let pendingPastDateAction = null;

function showPastDateModal(callback) {
    pendingPastDateAction = callback;
    document.getElementById('modal-past-date').classList.add('active');
}

function confirmPastDate() {
    document.getElementById('modal-past-date').classList.remove('active');
    if (pendingPastDateAction) {
        pendingPastDateAction();
        pendingPastDateAction = null;
    }
}

function cancelPastDate() {
    document.getElementById('modal-past-date').classList.remove('active');
    pendingPastDateAction = null;
}

// Funções para modal de horário de exceção (06h–07h coleta domiciliar)
let pendingHorarioExcecaoAction = null;

function showHorarioExcecaoModal(callback) {
    pendingHorarioExcecaoAction = callback;
    document.getElementById('modal-horario-excecao').classList.add('active');
}

function confirmHorarioExcecao() {
    document.getElementById('modal-horario-excecao').classList.remove('active');
    if (pendingHorarioExcecaoAction) {
        const acao = pendingHorarioExcecaoAction;
        pendingHorarioExcecaoAction = null;
        acao();
    }
}

function cancelHorarioExcecao() {
    document.getElementById('modal-horario-excecao').classList.remove('active');
    pendingHorarioExcecaoAction = null;
}

function openRecordModal() {
    document.getElementById('record-form').reset();
    document.getElementById('reg-id').value = '';
    applyAgendaConfig();
    const histBtnNew = document.getElementById('btn-record-history');
    histBtnNew.classList.add('hidden');
    histBtnNew.classList.remove('flex');
    
    // Reseta Checklist
    resetChecklistUI({});

    // Modo criação — zera a lista de anexos e a zona de upload
    clearAnexosUpload('reg');
    limparAcompanhantes();
    limparResponsavel();

    // Reseta Status e Comentários
    document.getElementById('reg-status').value = 'Agendado';
    toggleCancelado();

    // Limpa o realce de nome inválido de uma tentativa anterior
    marcarCampoNomeValido('atendente', true);
    marcarCampoNomeValido('coletador', true);

    // Atendente Responsável começa preenchido com o usuário logado
    if (currentUser && currentUser.fullName) {
        document.getElementById('reg-atendente').value = currentUser.fullName;
    }
    
    // Oculta campo metano inicialmente
    updateSubstratos();
    calculateTimes();

    // Padrão de endereço: Juazeiro do Norte / CE (editável)
    if (temCampo('endereco', currentAgenda())) {
        document.getElementById('reg-cidade').value = 'JUAZEIRO DO NORTE';
        document.getElementById('reg-estado').value = 'CE';
        document.getElementById('reg-distante').checked = false;
        atualizarDistanteUI();
        document.getElementById('reg-taxa-valor').value = '';
        document.getElementById('reg-taxa-pago').value = 'false';
        atualizarTaxaColetaUI();
    }

    document.getElementById('modal-title').innerText = `Novo Agendamento — ${currentAgenda().nome}`;
    document.getElementById('modal-record').classList.add('active');
}

function openRecordModalWithDate(dateStr, hora) {
    openRecordModal();
    // Aceita dd/mm/aaaa (modal de detalhes do dia) ou aaaa-mm-dd (visão semanal)
    const iso = dateStr.includes('/') ? dateStr.split('/').reverse().join('-') : dateStr;
    document.getElementById('reg-data').value = iso;

    // Sem horário informado, sugere o primeiro slot livre do dia (agendas com grade fixa)
    const horaFinal = hora || primeiroSlotLivre(iso);
    if (horaFinal) {
        document.getElementById('reg-hora-inicio').value = horaFinal;
        calculateTimes();
    }
}

// Primeiro horário da grade ainda não ocupado no dia (percorre todos os turnos)
function primeiroSlotLivre(iso) {
    const agenda = currentAgenda();
    if (!agenda.slotMin) return null;
    const [y, m, d] = iso.split('-').map(Number);
    const slots = slotsAgenda(new Date(y, m - 1, d).getDay(), agenda);
    const doDia = appointments.filter(a => a.data === iso && a.status !== 'Cancelado');
    const livre = slots.map(minToTime).find(h =>
        slotAceita(null, doDia.filter(a => a.horaInicio === h), agenda)
    );
    return livre || null;
}

// Etiqueta de faixa etária usada nos cards do dia
function _faixaBadgeDia(app, agenda) {
    if (pacienteEncerrado(app.status)) return '';
    const t = temaFaixaEtaria(app, agenda);
    return t ? `[${t.rotulo}]` : '';
}

function openDayDetails(dateStr) {
    const agenda = currentAgenda();
    const cores = agendaCores(agenda);
    const dayApps = appointments.filter(a => a.data === dateStr).sort((a,b) => a.horaInicio.localeCompare(b.horaInicio));
    document.getElementById('day-details-date').innerText = dateStr.split('-').reverse().join('/');
    const list = document.getElementById('day-appointments-list');
    
    // Verifica se a data é anterior a hoje
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [year, month, day] = dateStr.split('-').map(Number);
    const appointmentDate = new Date(year, month - 1, day);
    appointmentDate.setHours(0, 0, 0, 0);
    const isPastDate = appointmentDate < today;
    
    list.innerHTML = dayApps.length ? dayApps.map(app => {
        
        let bgClass = 'bg-slate-50 border-slate-200';
        let textColor = 'text-slate-500';
        let accentColor = accentDoAgendamento(app, agenda);
        let overdueBadge = '';
        
        // Verifica se agendamento está atrasado
        const isOverdue = isPastDate && !pacienteEncerrado(app.status);

        if (isOverdue) {
            bgClass = 'bg-red-50 border-red-300';
            textColor = 'text-red-700';
            accentColor = 'bg-red-600';
            overdueBadge = '<div class="absolute top-2 right-4 bg-red-600 text-white text-[8px] font-black px-2 py-1 rounded-full z-10"><i class="fas fa-exclamation-triangle mr-1"></i>ATRASADO</div>';
        } else if (app.status === 'Ausente') {
            bgClass = 'bg-amber-50 border-amber-400';
            textColor = 'text-amber-800';
            accentColor = 'bg-amber-500';
            overdueBadge = '<div class="absolute top-2 right-4 bg-amber-500 text-white text-[8px] font-black px-2 py-1 rounded-full z-10"><i class="fas fa-user-xmark mr-1"></i>AUSENTE</div>';
        } else if (app.status === 'Cancelado') {
            bgClass = 'bg-slate-100 opacity-70 border-slate-200';
            textColor = 'text-slate-400 line-through';
            accentColor = 'bg-slate-400';
        } else if (app.status === 'Em andamento') {
            bgClass = 'bg-purple-50 border-purple-200';
            textColor = 'text-purple-700';
            accentColor = 'bg-purple-600';
        } else if (app.status === 'Concluído') {
            const checklistPendente = agenda.checklist.some(item => !app[CHECKLIST_ITENS[item].chave]);
            bgClass = checklistPendente
                ? 'border-yellow-300 checklist-pendente-stripes'
                : 'bg-green-50 border-green-300 card-concluido';
            textColor = 'text-green-700';
            accentColor = 'bg-green-600';
        } else if (temaFaixaEtaria(app, agenda)) {
            const t = temaFaixaEtaria(app, agenda);
            bgClass = `${t.bg} ${t.border}`;
            textColor = t.text;
        } else {
            // Agendado normal — cor da agenda
            bgClass = `${cores.bg} ${cores.border}`;
            textColor = cores.text;
        }

        const isChecklistComplete = agenda.checklist.every(item => !!app[CHECKLIST_ITENS[item].chave]);
        let checklistBadge;
        if (app.status === 'Concluído') {
            // Selo próprio do concluído — não deixa confundir com "em andamento"
            checklistBadge = !isChecklistComplete
                ? '<div class="h-8 w-8 rounded-md flex items-center justify-center" title="Concluído com checklist pendente"><i class="fas fa-triangle-exclamation text-yellow-500 text-lg"></i></div>'
                : '<div class="h-8 w-8 rounded-md border border-green-300 bg-green-600 text-white flex items-center justify-center shadow-sm" title="Concluído"><i class="fas fa-check-double"></i></div>';
        } else if (app.status === 'Ausente') {
            // Ausência é desfecho: cobra checklist não faz sentido
            checklistBadge = '<div class="h-8 w-8 rounded-md border border-amber-400 bg-amber-500 text-white flex items-center justify-center shadow-sm" title="Paciente ausente"><i class="fas fa-user-xmark"></i></div>';
        } else if (app.status === 'Em andamento') {
            // Para "Em andamento", não mostra aviso de checklist incompleto
            checklistBadge = '<div class="h-8 w-8 rounded-md border border-purple-200 bg-purple-50 text-purple-600 flex items-center justify-center shadow-sm" title="Em andamento"><i class="fas fa-spinner"></i></div>';
        } else {
            checklistBadge = isChecklistComplete 
                ? '<div class="h-8 w-8 rounded-md border border-blue-200 bg-blue-50 text-blue-600 flex items-center justify-center shadow-sm" title="Checklist Completo"><i class="fas fa-clipboard-check"></i></div>' 
                : '<div class="h-8 w-8 rounded-md border border-slate-200 bg-slate-50 text-slate-400 flex items-center justify-center shadow-sm" title="Checklist Incompleto"><i class="fas fa-clipboard-list"></i></div>';
        }
        
        // Localidade distante — contorno de destaque sem perder a cor do status
        const distanteClass = temCampo('endereco', agenda) && app.distante ? 'card-distante' : '';

        // Coleta em andamento — coletador no local, coletando (exclusivo domiciliar).
        // Listras diagonais azuis sobrepõem a cor original do card (não a substituem)
        // e um selo play com anel girando fica fixo à direita central do card.
        const coletaAtivaOn = temCampo('endereco', agenda) && !!app.coletaAtiva && _coletaAtivaDisponivel(app, agenda);
        const coletaListras = coletaAtivaOn ? '<div class="card-coleta-listras"></div>' : '';
        const coletaSelo = coletaAtivaOn
            ? `<span class="coleta-play-selo card-coleta-ativa-selo" title="Coleta em andamento"><i class="fas fa-play"></i></span>`
            : '';

        return `
        <div class="border rounded-xl p-4 ${bgClass} ${distanteClass} ${coletaAtivaOn ? 'card-coleta-ativa' : ''} relative overflow-hidden ${coletaAtivaOn ? 'pr-8' : ''}">
            ${coletaListras}
            <div class="absolute left-0 top-0 bottom-0 w-1.5 ${coletaAtivaOn ? 'card-coleta-accent' : accentColor}"></div>
            ${overdueBadge}
            ${coletaSelo}
            <div class="absolute right-4 ${isOverdue ? 'top-8' : 'top-4'}">
                ${checklistBadge}
            </div>
            <div class="flex justify-between items-start pl-2">
                <div>
                    <div class="font-black ${app.status === 'Cancelado' ? 'text-slate-400 line-through' : 'text-navy-900'} text-sm uppercase">${app.horaInicio} - ${app.horaFim} | ${app.paciente} (${idadeLabel(app.idade)})${extraPacientesLabel(app) ? `<span class="ml-1.5 px-1.5 py-0.5 rounded-full bg-navy-900 text-white text-[9px] align-middle" title="${nomesPacientes(app).join(', ')}">${extraPacientesLabel(app)}</span>` : ''}</div>
                    ${extraPacientesLabel(app) ? `<div class="text-[10px] font-bold text-slate-500 mt-0.5"><i class="fas fa-users mr-1"></i>${(app.acompanhantes || []).map(a => `${a.nome}${a.idade != null ? ` (${idadeLabel(a.idade)})` : ''} <span class="${statusPaciente(a) === 'Concluído' ? 'text-green-600' : statusPaciente(a) === 'Cancelado' ? 'text-slate-400' : 'text-amber-600'}">[${statusPaciente(a)}]</span>`).join(' · ')}</div>` : ''}
                    <div class="text-[10px] font-black ${textColor} uppercase">${
                        temCampo('exame', agenda)
                            ? `${app.exame} | ${app.substrato}${app.metano === 'Sim' ? ' (metano)' : ''}`
                            : temCampo('endereco', agenda)
                                ? `${[app.logradouro, app.numero].filter(Boolean).join(', ')}${app.bairro ? ' — ' + app.bairro : ''}`
                                : (temCampo('abstinencia', agenda) && app.abstinencia != null ? `Abstinência: ${app.abstinencia} dia(s)` : agenda.nome)
                    } ${_faixaBadgeDia(app, agenda)}</div>
                    ${temCampo('endereco', agenda) && app.distante ? `<div class="mt-1"><span class="inline-flex items-center gap-1 ${DISTANTE_TEMA.badge} text-white text-[8px] font-black px-1.5 py-0.5 rounded"><i class="fas ${DISTANTE_TEMA.icon}"></i>${DISTANTE_TEMA.rotulo}</span></div>` : ''}
                    ${temCampo('pontoReferencia', agenda) && app.pontoReferencia ? `<div class="text-[10px] font-bold text-slate-500 mt-1"><i class="fas fa-location-dot mr-1"></i>${app.pontoReferencia}</div>` : ''}
                </div>
            </div>
            <div class="pl-2 pt-3 border-t border-slate-200 mt-3 flex justify-between items-center">
                <div class="flex flex-col">
                    <span class="text-[10px] font-bold text-slate-500">👤 ${formatAtendenteName(app.atendente)}${temCampo('coletador', agenda) && app.coletador ? ` · 🚗 ${formatAtendenteName(app.coletador)}` : ''}</span>
                    ${app.status === 'Em andamento' 
                        ? '<span class="text-[10px] font-bold text-purple-600 mt-0.5">🔄 Em andamento</span>' 
                        : `<span class="text-[10px] font-bold text-slate-500 mt-0.5">Pedido: ${app.pedido}</span>`
                    }
                </div>
                <div class="flex gap-2 items-center">
                    <a href="https://wa.me/55${app.contato.replace(/\D/g, '')}" target="_blank" class="h-8 w-8 rounded-md border border-green-200 bg-white text-green-600 flex items-center justify-center hover:bg-green-500 hover:text-white transition-all shadow-sm" title="WhatsApp"><i class="fab fa-whatsapp text-lg"></i></a>
                    <button onclick="viewRecord(${app.id})" class="px-3 py-1.5 bg-blue-50 text-blue-700 font-black text-[9px] uppercase rounded-md border border-blue-200 hover:bg-blue-600 hover:text-white transition-all shadow-sm"><i class="fas fa-eye mr-1"></i> Visualizar</button>
                    ${isAdmin() ? `<button onclick="deleteRecord(${app.id})" class="px-3 py-1.5 bg-red-50 text-red-700 font-black text-[9px] uppercase rounded-md border border-red-200 hover:bg-red-600 hover:text-white transition-all shadow-sm"><i class="fas fa-trash mr-1"></i> Excluir</button>` : ''}
                </div>
            </div>
        </div>`;
    }).join('') : '<p class="text-center py-6 text-slate-400 font-bold uppercase text-[10px]">Sem marcações</p>';
    
    document.getElementById('modal-day-details').classList.add('active');
    
    // Verifica se o dia é feriado e atualiza o botão
    updateHolidayToggle(dateStr);
    
    // Oculta ou mostra o botão de agendar baseado no número de agendamentos ativos
    const activeApps = dayApps.filter(a => a.status !== 'Cancelado');
    const scheduleBtn = document.querySelector('button[onclick*="openRecordModalWithDate"]');
    const scheduleFooter = document.getElementById('day-details-footer');
    if (scheduleBtn) {
        const [_y, _m, _d] = dateStr.split('-').map(Number);
        const lotado = vagasOcupadasNoDia(activeApps, agenda) >= limiteDoDia(new Date(_y, _m - 1, _d).getDay(), agenda);
        scheduleBtn.style.display = lotado ? 'none' : 'block';
        if (scheduleFooter) scheduleFooter.style.display = lotado ? 'none' : 'block';
    }
}

// Estado para controle de feriados
let holidays = {};

function toggleHolidayMode() {
    const dateStr = document.getElementById('day-details-date').innerText.split('/').reverse().join('-');
    const btn = document.getElementById('btn-holiday-toggle');
    const slider = document.getElementById('holiday-toggle-slider');
    const icon = slider.querySelector('i');
    
    if (holidays[dateStr]) {
        // Desativa modo feriado (volta para ativo/verde) - bolinha vai para direita
        delete holidays[dateStr];
        btn.classList.remove('bg-red-500', 'border-red-400/50');
        btn.classList.add('bg-green-500', 'border-green-400/50');
        slider.style.transform = 'translateX(24px)';
        icon.className = 'fas fa-check text-white text-xs';
        
        // Reabilita botão de agendar
        const scheduleBtn = document.querySelector('button[onclick*="openRecordModalWithDate"]');
        if (scheduleBtn) {
            scheduleBtn.disabled = false;
            scheduleBtn.classList.remove('opacity-50', 'cursor-not-allowed', 'bg-slate-200');
            scheduleBtn.classList.add('bg-slate-100', 'hover:bg-slate-200');
        }
    } else {
        // Ativa modo feriado (só se não houver marcações) - bolinha vai para esquerda
        const dayApps = appointments.filter(a => a.data === dateStr);
        if (dayApps.length === 0) {
            holidays[dateStr] = true;
            btn.classList.remove('bg-green-500', 'border-green-400/50');
            btn.classList.add('bg-red-500', 'border-red-400/50');
            slider.style.transform = 'translateX(0)';
            icon.className = 'fas fa-calendar-times text-white text-xs';
            
            // Desabilita botão de agendar
            const scheduleBtn = document.querySelector('button[onclick*="openRecordModalWithDate"]');
            if (scheduleBtn) {
                scheduleBtn.disabled = true;
                scheduleBtn.classList.add('opacity-50', 'cursor-not-allowed', 'bg-slate-200');
                scheduleBtn.classList.remove('bg-slate-100', 'hover:bg-slate-200');
            }
        } else {
            showNotification('Não é possível marcar como feriado. Existem agendamentos neste dia.', 'warning');
            return; // Interrompe a função se houver marcações
        }
    }
    
    // Salva no Firebase (só se houver alteração)
    saveHolidaysToFirebase();
    
    // Atualiza o calendário
    renderCalendar();
}

function updateHolidayToggle(dateStr) {
    const btn = document.getElementById('btn-holiday-toggle');
    const slider = document.getElementById('holiday-toggle-slider');
    const icon = slider.querySelector('i');
    const scheduleBtn = document.querySelector('button[onclick*="openRecordModalWithDate"]');
    
    if (holidays[dateStr]) {
        // Modo feriado ativo (vermelho) - bolinha à esquerda
        btn.classList.remove('bg-green-500', 'border-green-400/50');
        btn.classList.add('bg-red-500', 'border-red-400/50');
        slider.style.transform = 'translateX(0)';
        icon.className = 'fas fa-calendar-times text-white text-xs';
        
        // Desabilita botão de agendar
        if (scheduleBtn) {
            scheduleBtn.disabled = true;
            scheduleBtn.classList.add('opacity-50', 'cursor-not-allowed', 'bg-slate-200');
            scheduleBtn.classList.remove('bg-slate-100', 'hover:bg-slate-200');
        }
    } else {
        // Modo ativo (verde) - bolinha à direita
        btn.classList.remove('bg-red-500', 'border-red-400/50');
        btn.classList.add('bg-green-500', 'border-green-400/50');
        slider.style.transform = 'translateX(24px)';
        icon.className = 'fas fa-check text-white text-xs';
        
        // Reabilita botão de agendar
        if (scheduleBtn) {
            scheduleBtn.disabled = false;
            scheduleBtn.classList.remove('opacity-50', 'cursor-not-allowed', 'bg-slate-200');
            scheduleBtn.classList.add('bg-slate-100', 'hover:bg-slate-200');
        }
    }
}

function saveHolidaysToFirebase() {
    database.ref('holidays').set(holidays)
        .then(() => {
            console.log('Status de feriado salvo com sucesso no Firebase');
            showNotification('Status de feriado atualizado com sucesso', 'success');
        })
        .catch((error) => {
            console.error('Erro ao salvar status de feriado:', error);
            showNotification('Erro ao salvar status de feriado', 'error');
        });
}

function loadHolidaysFromFirebase() {
    return database.ref('holidays').once('value')
        .then(snapshot => {
            const data = snapshot.val();
            if (data) {
                holidays = data;
                console.log('Feriados carregados do Firebase:', holidays);
            }
        })
        .catch((error) => {
            console.error('Erro ao carregar feriados do Firebase:', error);
            showNotification('Erro ao carregar status de feriados', 'error');
        });
}

// Configurar listener em tempo real para atualizações de feriados
function setupHolidaysRealtimeListener() {
    database.ref('holidays').on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            holidays = data;
            console.log('Feriados atualizados em tempo real:', holidays);
            renderCalendar();
        }
    });
}

function editRecord(id) {
    const app = appointments.find(a => a.id == id);
    if(!app) return;
    applyAgendaConfig();
    document.getElementById('reg-id').value = app.id;
    document.getElementById('reg-data').value = app.data;
    document.getElementById('reg-hora-inicio').value = app.horaInicio;
    document.getElementById('reg-paciente').value = app.paciente ? app.paciente.toUpperCase() : '';
    document.getElementById('reg-idade').value = app.idade;
    carregarAcompanhantes(app);
    carregarResponsavel(app);
    document.getElementById('reg-contato').value = app.contato;
    document.getElementById('reg-exame').value = app.exame || '';
    updateSubstratos();
    document.getElementById('reg-metano').value = app.metano || 'Não';
    document.getElementById('reg-substrato').value = app.substrato || '';
    document.getElementById('reg-abstinencia').value = app.abstinencia != null ? app.abstinencia : '';
    document.getElementById('reg-cep').value = app.cep || '';
    document.getElementById('reg-logradouro').value = app.logradouro || '';
    document.getElementById('reg-numero').value = app.numero || '';
    document.getElementById('reg-complemento').value = app.complemento || '';
    document.getElementById('reg-bairro').value = app.bairro || '';
    document.getElementById('reg-cidade').value = app.cidade || '';
    document.getElementById('reg-estado').value = app.estado || '';
    document.getElementById('reg-distante').checked = !!app.distante;
    atualizarDistanteUI();
    document.getElementById('reg-taxa-valor').value = app.taxaColeta ? String(app.taxaColeta.toFixed(2)).replace('.', ',').replace(/\B(?=(\d{3})+(?=,))/g, '.') : '';
    document.getElementById('reg-taxa-pago').value = app.taxaColetaPaga ? 'true' : 'false';
    atualizarTaxaColetaUI();
    document.getElementById('reg-ponto-referencia').value = app.pontoReferencia || '';
    document.getElementById('reg-coletador').value = app.coletador || '';
    document.getElementById('reg-duracao').value = app.duracao;
    document.getElementById('reg-hora-fim').value = app.horaFim;
    document.getElementById('reg-pedido').value = app.pedido;
    document.getElementById('reg-atendente').value = app.atendente;

    // Registros antigos podem ter nome fora da lista atual (atendente desligado,
    // por exemplo): marca na abertura para o erro ficar visível antes de salvar.
    conferirNomeOficial('atendente');
    if (temCampo('coletador', currentAgenda())) conferirNomeOficial('coletador');

    // Modo edição — carrega os anexos já vinculados
    restoreAnexosUpload('reg', app.anexos || []);

    // Restaura Checklist
    resetChecklistUI({
        orientacao: !!app.chkOrientacao,
        anexo: !!app.chkAnexo,
        endereco: !!app.chkEndereco
    });

    // Restaura Status
    document.getElementById('reg-status').value = app.status;
    document.getElementById('reg-comentarios').value = app.comentarios || '';

    // Trata exibição do campo comentário
    toggleCancelado();
    if (app.comentarios && app.status !== 'Cancelado') {
        document.getElementById('box-motivo').classList.remove('hidden');
    }

    // Restaura Motivo de Perda
    if (app.status === 'Cancelado' && app.motivoPerda) {
        updateMotivosPerdaSelect();
        document.getElementById('reg-motivo-perda').value = app.motivoPerda;
    }
    
    document.getElementById('modal-title').innerText = `Editar Agendamento — ${currentAgenda().nome}`;
    const histBtn = document.getElementById('btn-record-history');
    histBtn.classList.remove('hidden');
    histBtn.classList.add('flex');
    document.getElementById('modal-record').classList.add('active');
}

let _pendingDeleteId = null;

function deleteRecord(id) {
    _pendingDeleteId = id;
    const input = document.getElementById('delete-confirm-input');
    input.value = '';
    const btn = document.getElementById('btn-confirm-delete');
    btn.disabled = true;
    btn.classList.add('opacity-60', 'cursor-not-allowed', 'from-red-300', 'to-red-400');
    btn.classList.remove('from-red-600', 'to-red-700', 'hover:from-red-700', 'hover:to-red-800', 'shadow-red-200', 'cursor-pointer');
    document.getElementById('modal-delete-confirm').classList.add('active');
}

function onDeleteInputChange() {
    const input = document.getElementById('delete-confirm-input');
    const btn = document.getElementById('btn-confirm-delete');
    const isValid = input.value.trim().toUpperCase() === 'SIM';
    btn.disabled = !isValid;
    if (isValid) {
        btn.classList.remove('opacity-60', 'cursor-not-allowed', 'from-red-300', 'to-red-400');
        btn.classList.add('from-red-600', 'to-red-700', 'hover:from-red-700', 'hover:to-red-800', 'shadow-red-200', 'cursor-pointer');
    } else {
        btn.classList.add('opacity-60', 'cursor-not-allowed', 'from-red-300', 'to-red-400');
        btn.classList.remove('from-red-600', 'to-red-700', 'hover:from-red-700', 'hover:to-red-800', 'shadow-red-200', 'cursor-pointer');
    }
}

function cancelDeleteRecord() {
    _pendingDeleteId = null;
    document.getElementById('delete-confirm-input').value = '';
    document.getElementById('modal-delete-confirm').classList.remove('active');
}

function confirmDeleteRecord() {
    const input = document.getElementById('delete-confirm-input');
    if (input.value.trim().toUpperCase() !== 'SIM') return;
    const id = _pendingDeleteId;
    _pendingDeleteId = null;
    input.value = '';
    document.getElementById('modal-delete-confirm').classList.remove('active');

    if (!id) return;

    const deleted = appointments.find(a => a.id === id);
    setAppointments(appointments.filter(a => a.id !== id));
    if (deleted) {
        addAuditLog('delete', deleted);
        apagarAnexosDoRegistro(deleted);   // remove os arquivos reais (Drive / imgBlobs)
    }

    saveAppointmentsToFirebase()
        .then(() => {
            renderTable();
            renderCalendar();
            closeModals();
            showNotification("Agendamento excluído com sucesso.", "success");
        })
        .catch(error => {
            console.error("Erro ao excluir agendamento:", error);
            showNotification("Erro ao excluir o agendamento. Tente novamente.", "error");
            loadAppointmentsFromFirebase();
        });
}

function openObsModal(id) {
    const app = appointments.find(a => a.id == id);
    document.getElementById('obs-id').value = app.id;
    document.getElementById('obs-text').value = app.comentarios || '';
    document.getElementById('modal-obs').classList.add('active');
}

function saveObservation() {
    const id = document.getElementById('obs-id').value;
    setAppointments(appointments.map(a => a.id == id ? {...a, comentarios: document.getElementById('obs-text').value} : a));
    saveAppointmentsToFirebase();
    closeModals(); renderTable();
}
