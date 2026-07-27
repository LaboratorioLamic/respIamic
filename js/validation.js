// Regras de negócio e validação de agendamentos

// REGRAS DE NEGÓCIO
function validateAppointment(dataObj) {
    const appDate = new Date(dataObj.data + 'T12:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Zerar horas para comparação apenas de datas
    
    // Verificar se a data é anterior a hoje
    if (appDate < today) {
        return "DATA_PASSADA";
    }
    
    const dayOfWeek = appDate.getDay();
    const startTime = dataObj.horaInicio;
    
    // Validação de horários permitidos
    if (dayOfWeek === 6) { // Sábado
        if (startTime < '07:00' || startTime > '08:00') {
            return "Aos sábados, o horário permitido para agendamento é entre 07:00 e 08:00.";
        }
    } else if (dayOfWeek >= 1 && dayOfWeek <= 5) { // Segunda a Sexta
        if (startTime < '07:00' || startTime > '09:00') {
            return "De segunda a sexta, o horário permitido para agendamento é entre 07:00 e 09:00.";
        }
    }
    
    if (appDate.getDay() === 0) return "Não é permitido marcar exames aos domingos.";
    if (appointments.filter(a => a.data === dataObj.data && a.id !== dataObj.id && a.status !== 'Cancelado').length >= 3 && dataObj.status !== 'Cancelado') return "Limite diário alcançado (Máx 3 ativos).";
    
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
    return null;
}
