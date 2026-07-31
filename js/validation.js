// Regras de negócio e validação de agendamentos (dirigidas pela config da agenda)

const _DIAS_NOME = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

function validateAppointment(dataObj) {
    const agenda = currentAgenda();
    const appDate = new Date(dataObj.data + 'T12:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Verificar se a data é anterior a hoje
    if (appDate < today) {
        return "DATA_PASSADA";
    }

    const dayOfWeek = appDate.getDay();

    // Dia da semana atendido por esta agenda
    if (!agenda.dias.includes(dayOfWeek)) {
        return `A agenda ${agenda.nome} não atende ${_DIAS_NOME[dayOfWeek]}.`;
    }

    // Janela de horário de início (pode ter mais de um turno)
    const faixas = janelaAgenda(dayOfWeek, agenda);
    const inicioMin = timeToMin(dataObj.horaInicio);
    if (!faixas.length || inicioMin === null) {
        return "Horário de início inválido.";
    }

    const faixa = faixaDoMinuto(inicioMin, faixas);
    if (!faixa) {
        const brutas = faixasBrutas(dayOfWeek, agenda);
        const turnos = brutas.map(([i, f]) => `${minToTime(i)}–${minToTime(f)}`).join(' e ');
        const complemento = agenda.slotMin && agenda.duracao.tipo === 'fixa'
            ? ` (último início de cada turno recuado em ${agenda.duracao.fixaMin} minutos, a duração do atendimento)`
            : '';
        return `O horário permitido nesta agenda é ${turnos}${complemento}.`;
    }

    // Alinhamento à grade de slots, relativo ao início do turno
    if (agenda.slotMin && (inicioMin - faixa[0]) % agenda.slotMin !== 0) {
        return `Os agendamentos desta agenda ocorrem de ${agenda.slotMin} em ${agenda.slotMin} minutos. Escolha um horário válido da grade.`;
    }

    // Ocupação do dia: só o cancelamento devolve a vaga. Uma ausência mantém o
    // horário consumido — a vaga foi perdida pela falta e não é reaproveitada.
    const doDia = appointments.filter(a =>
        a.data === dataObj.data && a.id !== dataObj.id && !vagaLiberada(a.status)
    );

    // Lotação do horário — nas agendas que agrupam por endereço, vários pacientes
    // do MESMO endereço dividem uma única vaga (a coleta é a mesma visita).
    if (agenda.slotUnico && dataObj.status !== 'Cancelado') {
        const noSlot = doDia.filter(a => a.horaInicio === dataObj.horaInicio);
        if (!slotAceita(dataObj, noSlot, agenda)) {
            const limiteSlot = limiteDoSlot(agenda);
            return limiteSlot > 1
                ? `O horário das ${dataObj.horaInicio} já tem ${limiteSlot} endereços. Só é possível encaixar mais um agendamento se for no mesmo endereço de um dos existentes.`
                : `Já existe um agendamento às ${dataObj.horaInicio}. Escolha outro horário.`;
        }
    }

    // Limite diário — conta vagas (endereços), não agendamentos
    const limite = limiteDoDia(dayOfWeek, agenda);
    const vagasDia = vagasOcupadasNoDia(doDia, agenda);
    const jaTemEndereco = agenda.agrupaPorEndereco
        && doDia.some(a => a.horaInicio === dataObj.horaInicio && mesmoEndereco(a, dataObj));
    if (vagasDia >= limite && !jaTemEndereco && dataObj.status !== 'Cancelado') {
        return `Limite diário alcançado (Máx ${limite} ativos).`;
    }

    // Abstinência obrigatória apenas ao concluir
    if (temCampo('abstinencia', agenda) && dataObj.status === 'Concluído') {
        const dias = dataObj.abstinencia;
        if (dias === '' || dias === null || dias === undefined || isNaN(dias)) {
            return "Informe os dias de abstinência para concluir o agendamento.";
        }
    }

    // Endereço obrigatório nas agendas domiciliares
    if (temCampo('endereco', agenda) && dataObj.status !== 'Cancelado') {
        const faltando = [];
        if (!dataObj.logradouro) faltando.push('Logradouro');
        if (!dataObj.numero) faltando.push('Número');
        if (!dataObj.bairro) faltando.push('Bairro');
        if (!dataObj.cidade) faltando.push('Cidade');
        if (faltando.length) {
            return `Endereço incompleto. Preencha: ${faltando.join(', ')}.`;
        }
    }

    // Intervalo mínimo entre marcações do mesmo paciente
    if (agenda.regra48h) {
        const samePatient = appointments.filter(a =>
            normalizeStr(a.paciente) === normalizeStr(dataObj.paciente) &&
            a.id !== dataObj.id &&
            a.status !== 'Cancelado'
        );

        for (let app of samePatient) {
            const existingDate = new Date(app.data + 'T12:00:00');
            const diffDays = Math.ceil(Math.abs(appDate - existingDate) / (1000 * 60 * 60 * 24));
            if (diffDays < 2 && dataObj.status !== 'Cancelado') {
                return "Intervalo insuficiente. Só é permitido marcar após 48 Horas da última marcação do paciente.";
            }
        }
    }

    return null;
}
