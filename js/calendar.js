// Calendário mensal

// CALENDÁRIO
function changeMonth(dir) { currentDate.setMonth(currentDate.getMonth() + dir); renderCalendar(); }
function renderCalendar() {
    const body = document.getElementById('calendar-body'); body.innerHTML = '';
    const year = currentDate.getFullYear(); const month = currentDate.getMonth();
    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    document.getElementById('current-month-label').innerText = `${monthNames[month]} ${year}`;
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let i = 0; i < firstDay; i++) body.innerHTML += `<div class="p-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60"></div>`;
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dateObj = new Date(year, month, day);
        const isSunday = dateObj.getDay() === 0;
        const isHoliday = holidays[dateStr];
        
        // Exclui os cancelados da contagem de lotação do dia
        const dayApps = appointments.filter(a => a.data === dateStr && a.status !== 'Cancelado');
        const hasInfantil = dayApps.some(a => a.idade < 12);
        
        // Verifica se há agendamentos cancelados no dia
        const canceledApps = appointments.filter(a => a.data === dateStr && a.status === 'Cancelado');
        const hasCanceled = canceledApps.length > 0;
        
        // Verifica se todos os agendamentos do dia estão concluídos
        const allCompleted = dayApps.length > 0 && dayApps.every(a => a.status === 'Concluído');
        
        // Verifica se há agendamentos atrasados (data menor que hoje e não concluídos)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const calendarDate = new Date(year, month, day);
        calendarDate.setHours(0, 0, 0, 0);
        const isPastDate = calendarDate < today;
        const hasOverdue = isPastDate && dayApps.some(a => a.status !== 'Concluído');
        
        // Define classes baseado no estado do dia
        let boxClass, textColor, clickAction;
        
        if (isHoliday) {
            // Estilo de feriado (cinza, como domingo)
            boxClass = 'bg-slate-100 border-slate-300 opacity-60 cursor-pointer';
            textColor = 'text-slate-400';
            clickAction = `openDayDetails('${dateStr}')`;
        } else if (isSunday) {
            boxClass = 'bg-red-50/30 border-red-100 opacity-60 cursor-not-allowed';
            textColor = 'text-red-400';
            clickAction = '';
        } else {
            boxClass = 'bg-white hover:border-blue-300 border-slate-200 cursor-pointer';
            textColor = 'text-navy-900';
            clickAction = `openDayDetails('${dateStr}')`;
            
            if(dayApps.length > 0) {
                // Prioridade: Atrasado > Concluído > Em andamento > Infantil > Normal
                if(hasOverdue) {
                    // Dias com agendamentos atrasados ficam vermelhos
                    boxClass = 'bg-red-50 border-red-300 cursor-pointer';
                    textColor = 'text-red-700';
                } else if(allCompleted) {
                    // Dias com todos agendamentos concluídos ficam verdes
                    boxClass = 'bg-green-50 border-green-300 cursor-pointer';
                    textColor = 'text-green-700';
                } else {
                    // Verifica se há agendamentos "Em andamento" para priorizar a cor roxa
                    const hasAndamento = dayApps.some(a => a.status === 'Em andamento');
                    
                    if(hasAndamento) {
                        boxClass = 'bg-purple-50 border-purple-300 cursor-pointer';
                    } else if(hasInfantil) {
                        boxClass = 'bg-orange-50 border-orange-300 cursor-pointer';
                    } else {
                        boxClass = 'bg-blue-50 border-blue-200 cursor-pointer';
                    }
                }
            }
        }
        
        const dots = dayApps.map(a => {
            // Verifica se o checklist está incompleto e não se aplica a status cancelado e em andamento
            const isChecklistIncomplete = !a.chkOrientacao || !a.chkAnexo;
            const shouldShowClipboard = isChecklistIncomplete && a.status !== 'Cancelado' && a.status !== 'Em andamento';
            
            if (shouldShowClipboard) {
                // Ícone de prancheta para checklist incompleto com a cor do teste
                return `<div class="h-2 w-2 rounded-full flex items-center justify-center ${a.exame === 'TRESP' ? 'bg-blue-300' : 'bg-emerald-500'} border-2 border-yellow-400"><i class="fas fa-clipboard-list text-[10px]" style="color: ${a.exame === 'TRESP' ? '#3b82f6' : '#10b981'}"></i></div>`;
            } else {
                // Círculo normal para outros casos
                return `<div class="h-2 w-2 rounded-full ${a.exame === 'TRESP' ? 'bg-blue-500' : 'bg-emerald-500'}"></div>`;
            }
        }).join('');
        const canceledX = canceledApps.map(() => '<div class="h-2 w-2 rounded-full bg-red-500 flex items-center justify-center text-white text-[10px] font-black">×</div>').join('');
        const holidayIcon = isHoliday ? '<div class="absolute top-1 right-1 text-red-400"><i class="fas fa-calendar-times text-xs"></i></div>' : '';
        
        body.innerHTML += `<div onclick="${clickAction}" class="calendar-day p-3 h-24 border rounded-2xl flex flex-col items-center group relative ${boxClass}">
            ${holidayIcon}
            <span class="font-black text-sm ${textColor}">${day}</span>
            <div class="mt-2 flex gap-1 justify-center flex-wrap">${dots}${canceledX}</div>
            ${dayApps.length && !isHoliday ? `<span class="text-[8px] font-black uppercase tracking-wider mt-auto text-slate-500">${dayApps.length}/3 Vagas</span>` : ''}
            ${isHoliday ? '<span class="text-[8px] font-black uppercase tracking-wider mt-auto text-red-400">Feriado</span>' : ''}
        </div>`;
    }
}
