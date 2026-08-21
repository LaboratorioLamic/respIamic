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

// GRAVAÇÃO POR REGISTRO
// Escreve só o nó do próprio agendamento (`.../appointments/<id>`). A gravação
// da agenda inteira (saveAppointmentsToFirebase) continua existindo para
// importação de backup e renomeação em massa, mas NÃO deve ser usada no
// salvamento do dia a dia: com dois atendentes salvando ao mesmo tempo, o
// último `.set()` do nó inteiro apaga o que o outro acabou de criar — foi
// assim que registros sumiram da agenda sem nenhum log de exclusão.

// O Realtime Database rejeita `undefined` em qualquer campo e lança de forma
// síncrona no .set(); JSON.stringify/parse troca esses campos por ausência
// total (equivalente a null) em vez de travar o salvamento inteiro.
function _semUndefined(valor) {
    return JSON.parse(JSON.stringify(valor));
}

function _atualizarBackupLocal(agendaId) {
    const agenda = getAgenda(agendaId);
    localStorage.setItem(agenda.lsKey, JSON.stringify(appointmentsDe(agendaId)));
}

// CONTROLE DE CONCORRÊNCIA (campo `rev`)
// Cada gravação incrementa `rev`. Quem abre um registro para editar guarda a rev
// que viu; no salvamento, uma transação recusa a escrita se a rev no servidor já
// for outra — sinal de que alguém salvou o MESMO agendamento nesse meio-tempo.
// Sem isso, o segundo a salvar sobrescrevia em silêncio os campos que o primeiro
// tinha acabado de alterar (o registro sobrevive, os dados dele não).
//
// Registros anteriores a este campo não têm `rev`: valem como rev 0 e passam a
// ter rev na primeira gravação.
function revDe(record) {
    return Number(record && record.rev) || 0;
}

function _erroDeConflito() {
    const erro = new Error('CONFLITO_DE_EDICAO');
    erro.conflito = true;
    return erro;
}

// `revEsperada` nula/ausente = grava sem checar (criação, importação).
function salvarAgendamentoNoFirebase(record, agendaId, revEsperada) {
    const id = agendaId || record.agendaId || currentAgendaId;
    const ref = _appointmentsRef(id).child(String(record.id));

    const comRev = rev => _semUndefined({ ...record, rev });

    const gravado = novo => {
        // Reflete a rev nova no objeto que já está na lista local: sem isso, uma
        // segunda alteração feita logo em seguida partiria de uma rev velha e
        // seria recusada como conflito falso.
        record.rev = novo.rev;
        _atualizarBackupLocal(id);
        return novo;
    };

    if (revEsperada == null) {
        const novo = comRev(revDe(record) + 1);
        return ref.set(novo).then(() => gravado(novo)).catch(error => {
            console.error(`Erro ao salvar agendamento ${record.id} da agenda '${id}':`, error);
            throw error;
        });
    }

    return ref.transaction(atual => {
        // `atual` nulo pode ser só o cache local ainda vazio. Devolver um valor
        // (em vez de abortar) faz o Firebase reexecutar esta função com o dado
        // do servidor, e é aí que um conflito de verdade é detectado. Abortar
        // às cegas no nulo produziria conflito falso a cada gravação.
        //
        // Consequência assumida: se o registro tiver sido REALMENTE excluído por
        // outra pessoa enquanto este usuário editava, a gravação o recria. É o
        // erro menos destrutivo dos dois — ressuscitar um registro é reversível
        // (e fica no histórico), perder a edição em silêncio não é.
        if (atual && revDe(atual) !== revEsperada) return;   // conflito real: aborta
        return comRev(revEsperada + 1);
    }).then(res => {
        if (!res.committed) throw _erroDeConflito();
        return gravado(res.snapshot.val());
    }, error => {
        console.error(`Erro ao salvar agendamento ${record.id} da agenda '${id}':`, error);
        throw error;
    });
}

function removerAgendamentoNoFirebase(recordId, agendaId, revEsperada) {
    const id = agendaId || currentAgendaId;
    const ref = _appointmentsRef(id).child(String(recordId));

    const removido = () => { _atualizarBackupLocal(id); };

    if (revEsperada == null) {
        return ref.remove().then(removido).catch(error => {
            console.error(`Erro ao excluir agendamento ${recordId} da agenda '${id}':`, error);
            throw error;
        });
    }

    return ref.transaction(atual => {
        if (atual && revDe(atual) !== revEsperada) return;   // alterado por outro: aborta
        return null;                                          // null remove o nó
    }).then(res => {
        if (!res.committed) throw _erroDeConflito();
        removido();
    }, error => {
        console.error(`Erro ao excluir agendamento ${recordId} da agenda '${id}':`, error);
        throw error;
    });
}

// Tempo sem resposta do servidor a partir do qual o usuário é avisado. Offline,
// o SDK do Firebase enfileira a escrita e a promessa não resolve nem rejeita —
// sem esse aviso a tela ficaria muda, como se estivesse tudo salvo.
const PERSIST_AVISO_MS = 8000;

function _recarregarAgenda(agendaId) {
    return loadAgendaFromFirebase(agendaId).then(() => {
        renderHomeCards();
        if (agendaId === currentAgendaId) {
            renderTable(); renderCalendar(); updateDatalists(); updateFilterDropdowns();
        }
    });
}

// Persiste o agendamento e SÓ ENTÃO registra a auditoria e avisa "sucesso".
// A ordem importa: gravar o histórico antes da confirmação do servidor gerava
// entradas de "Criado" para registros que nunca chegaram ao banco — o registro
// aparecia no histórico e não aparecia na agenda.
function _persistir(operacao, alvo, opcoes) {
    const { audit, record, mensagem, aoFalhar } = opcoes;
    let respondeu = false;
    const avisoPendente = setTimeout(() => {
        if (respondeu) return;
        showNotification('SALVAMENTO PENDENTE: o servidor ainda não confirmou a gravação. Mantenha esta página aberta e verifique a conexão.', 'warning', 15000);
    }, PERSIST_AVISO_MS);

    // `.then(ok, erro)` em vez de `.then().catch()`: um erro dentro do ramo de
    // sucesso (auditoria, notificação) não pode ser confundido com falha de
    // gravação e disparar o recarregamento.
    return operacao.then(() => {
        respondeu = true; clearTimeout(avisoPendente);
        if (audit) addAuditLog(audit.action, audit.record || record, audit.oldRecord || null);
        if (mensagem) showNotification(mensagem, 'success');
        return true;
    }, erro => {
        respondeu = true; clearTimeout(avisoPendente);
        showNotification(erro && erro.conflito
            ? 'ALTERAÇÃO NÃO SALVA: outra pessoa alterou este agendamento enquanto você editava. Nada foi sobrescrito. Os dados foram recarregados — confira o que mudou e refaça sua alteração.'
            : 'FALHA AO SALVAR: a alteração NÃO foi gravada no servidor. Os dados foram recarregados — refaça a operação.',
            'error', 20000);
        if (aoFalhar) aoFalhar();
        return _recarregarAgenda(alvo).then(() => false);
    });
}

// `opcoes.rev` — a rev que o usuário tinha em mãos quando começou a alterar
// (capturada ao abrir o formulário/modal). Ausente = grava sem checar conflito.
function persistirAgendamento(record, opcoes = {}) {
    const alvo = opcoes.agendaId || record.agendaId || currentAgendaId;
    return _persistir(salvarAgendamentoNoFirebase(record, alvo, opcoes.rev), alvo, { ...opcoes, record });
}

function removerAgendamento(record, opcoes = {}) {
    const alvo = opcoes.agendaId || record.agendaId || currentAgendaId;
    return _persistir(removerAgendamentoNoFirebase(record.id, alvo, opcoes.rev), alvo, { ...opcoes, record });
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
