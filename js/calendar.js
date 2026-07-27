// Calendário — visões mensal e semanal

const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const MONTH_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

// Janela horária exibida na visão semanal
const WEEK_START_HOUR = 6;
const WEEK_END_HOUR = 14;
const WEEK_HOUR_PX = 56;
const WEEK_SLOT_MIN = 30;

// HELPERS DE DATA
function toDateStr(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function startOfDay(d) { const c = new Date(d); c.setHours(0, 0, 0, 0); return c; }
function getWeekStart(date) {
    const d = startOfDay(date);
    d.setDate(d.getDate() - d.getDay()); // domingo
    return d;
}
function timeToMin(hhmm) {
    if (!hhmm) return null;
    const [h, m] = hhmm.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return null;
    return h * 60 + m;
}
function minToTime(min) {
    return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

// Limite de horário inicial permitido por dia da semana (espelha validation.js)
function allowedStartWindow(dayOfWeek) {
    if (dayOfWeek === 0) return null;               // domingo bloqueado
    if (dayOfWeek === 6) return [420, 480];         // sábado 07:00–08:00
    return [420, 540];                              // seg–sex 07:00–09:00
}

// CONTROLE DE VISÃO
function setCalendarView(view) {
    calendarView = view === 'week' ? 'week' : 'month';
    localStorage.setItem('respiroCalendarView', calendarView);
    renderCalendar();
}

function goToToday() {
    currentDate = new Date();
    renderCalendar();
}

function navigatePeriod(dir) {
    if (calendarView === 'week') {
        currentDate.setDate(currentDate.getDate() + dir * 7);
    } else {
        currentDate.setDate(1);
        currentDate.setMonth(currentDate.getMonth() + dir);
    }
    renderCalendar();
}

// Mantido por compatibilidade com chamadas existentes
function changeMonth(dir) { navigatePeriod(dir); }

function syncViewTabs() {
    ['month', 'week'].forEach(v => {
        const tab = document.getElementById(`view-tab-${v}`);
        if (!tab) return;
        const active = calendarView === v;
        tab.classList.toggle('view-tab-active', active);
        tab.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    const monthEl = document.getElementById('calendar-month-view');
    const weekEl = document.getElementById('calendar-week-view');
    if (monthEl) monthEl.classList.toggle('hidden', calendarView !== 'month');
    if (weekEl) weekEl.classList.toggle('hidden', calendarView !== 'week');

    const prev = document.getElementById('btn-period-prev');
    const next = document.getElementById('btn-period-next');
    if (prev) prev.title = calendarView === 'week' ? 'Semana anterior' : 'Mês anterior';
    if (next) next.title = calendarView === 'week' ? 'Próxima semana' : 'Próximo mês';
}

// DISPATCHER
function renderCalendar() {
    syncViewTabs();
    if (calendarView === 'week') renderWeekView();
    else renderMonthView();
}

// TEMA COMPARTILHADO DE AGENDAMENTO
function getAppointmentTheme(app, isPastDate) {
    const isOverdue = isPastDate && app.status !== 'Concluído' && app.status !== 'Cancelado';
    if (isOverdue) return { bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-700', accent: 'bg-red-600', overdue: true };
    if (app.status === 'Cancelado') return { bg: 'bg-slate-100', border: 'border-slate-200', text: 'text-slate-400', accent: 'bg-slate-400', canceled: true };
    if (app.status === 'Em andamento') return { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', accent: 'bg-purple-600' };
    if (app.status === 'Concluído') return { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', accent: 'bg-green-600' };
    if (app.idade < 12) return { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', accent: app.exame === 'TRESP' ? 'bg-blue-600' : 'bg-emerald-600' };
    return { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', accent: app.exame === 'TRESP' ? 'bg-blue-600' : 'bg-emerald-600' };
}

// VISÃO MENSAL
function renderMonthView() {
    const body = document.getElementById('calendar-body'); body.innerHTML = '';
    const year = currentDate.getFullYear(); const month = currentDate.getMonth();
    document.getElementById('current-month-label').innerText = `${MONTH_NAMES[month]} ${year}`;
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

        // Verifica se todos os agendamentos do dia estão concluídos
        const allCompleted = dayApps.length > 0 && dayApps.every(a => a.status === 'Concluído');

        // Verifica se há agendamentos atrasados (data menor que hoje e não concluídos)
        const today = startOfDay(new Date());
        const calendarDate = startOfDay(new Date(year, month, day));
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
        const isToday = calendarDate.getTime() === today.getTime();

        body.innerHTML += `<div onclick="${clickAction}" class="calendar-day p-3 h-24 border rounded-2xl flex flex-col items-center group relative ${boxClass} ${isToday ? 'calendar-day-today' : ''}">
            ${holidayIcon}
            <span class="font-black text-sm ${textColor}">${day}</span>
            <div class="mt-2 flex gap-1 justify-center flex-wrap">${dots}${canceledX}</div>
            ${dayApps.length && !isHoliday ? `<span class="text-[8px] font-black uppercase tracking-wider mt-auto text-slate-500">${dayApps.length}/3 Vagas</span>` : ''}
            ${isHoliday ? '<span class="text-[8px] font-black uppercase tracking-wider mt-auto text-red-400">Feriado</span>' : ''}
        </div>`;
    }
}

// VISÃO SEMANAL
function renderWeekView() {
    const head = document.getElementById('week-head');
    const canvas = document.getElementById('week-canvas');
    if (!head || !canvas) return;

    const weekStart = getWeekStart(currentDate);
    const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 6);
    const today = startOfDay(new Date());

    // Rótulo do período
    const sameYear = weekStart.getFullYear() === weekEnd.getFullYear();
    const left = `${String(weekStart.getDate()).padStart(2, '0')} ${MONTH_SHORT[weekStart.getMonth()]}${sameYear ? '' : ' ' + weekStart.getFullYear()}`;
    const right = `${String(weekEnd.getDate()).padStart(2, '0')} ${MONTH_SHORT[weekEnd.getMonth()]} ${weekEnd.getFullYear()}`;
    document.getElementById('current-month-label').innerText = `${left} – ${right}`;

    // CABEÇALHO
    let headHtml = '<div class="week-gutter-head"></div>';
    for (let i = 0; i < 7; i++) {
        const d = new Date(weekStart); d.setDate(d.getDate() + i);
        const dateStr = toDateStr(d);
        const isToday = d.getTime() === today.getTime();
        const isSunday = d.getDay() === 0;
        const isHoliday = !!holidays[dateStr];
        const activeCount = appointments.filter(a => a.data === dateStr && a.status !== 'Cancelado').length;

        let stateClass = '';
        if (isHoliday) stateClass = 'week-day-head-holiday';
        else if (isSunday) stateClass = 'week-day-head-sunday';

        const clickable = !isSunday;
        headHtml += `<div class="week-day-head ${stateClass} ${isToday ? 'week-day-head-today' : ''} ${clickable ? 'week-day-head-clickable' : ''}"
            ${clickable ? `onclick="openDayDetails('${dateStr}')" title="Ver detalhes do dia"` : ''}>
            <span class="week-day-name">${WEEKDAY_SHORT[d.getDay()]}</span>
            <span class="week-day-number">${d.getDate()}</span>
            ${isHoliday ? '<span class="week-day-tag week-day-tag-holiday">Feriado</span>'
                : isSunday ? '<span class="week-day-tag week-day-tag-off">Fechado</span>'
                : `<span class="week-day-tag">${activeCount}/3 vagas</span>`}
        </div>`;
    }
    head.innerHTML = headHtml;

    // GRADE HORÁRIA — janela padrão expandida se houver agendamentos fora dela
    const weekEndStr = toDateStr(weekEnd);
    const weekStartStr = toDateStr(weekStart);
    let firstHour = WEEK_START_HOUR;
    let lastHour = WEEK_END_HOUR;
    appointments.filter(a => a.data >= weekStartStr && a.data <= weekEndStr).forEach(a => {
        const s = timeToMin(a.horaInicio);
        const e = timeToMin(a.horaFim);
        if (s !== null) firstHour = Math.min(firstHour, Math.floor(s / 60));
        if (e !== null && e > (s ?? 0)) lastHour = Math.max(lastHour, Math.ceil(e / 60));
    });
    const viewStart = firstHour * 60;
    const viewEnd = lastHour * 60;
    const colHeight = ((viewEnd - viewStart) / 60) * WEEK_HOUR_PX;

    let gutter = `<div class="week-gutter" style="height:${colHeight}px">`;
    for (let h = firstHour; h <= lastHour; h++) {
        gutter += `<div class="week-gutter-label" style="top:${(h - firstHour) * WEEK_HOUR_PX}px">${String(h).padStart(2, '0')}:00</div>`;
    }
    gutter += '</div>';

    let colsHtml = '';
    for (let i = 0; i < 7; i++) {
        const d = new Date(weekStart); d.setDate(d.getDate() + i);
        const dateStr = toDateStr(d);
        const isPastDate = d < today;
        const isToday = d.getTime() === today.getTime();
        const isHoliday = !!holidays[dateStr];
        const startWindow = allowedStartWindow(d.getDay());
        const activeCount = appointments.filter(a => a.data === dateStr && a.status !== 'Cancelado').length;
        const dayOpen = !!startWindow && !isHoliday && !isPastDate && activeCount < 3;

        // Slots de fundo
        let slots = '';
        for (let m = viewStart; m < viewEnd; m += WEEK_SLOT_MIN) {
            const inWindow = startWindow && m >= startWindow[0] && m <= startWindow[1];
            const selectable = dayOpen && inWindow;
            const hora = minToTime(m);
            slots += `<div class="week-slot ${m % 60 === 0 ? 'week-slot-hour' : ''} ${inWindow ? 'week-slot-open' : 'week-slot-closed'} ${selectable ? 'week-slot-selectable' : ''}"
                style="top:${((m - viewStart) / 60) * WEEK_HOUR_PX}px;height:${(WEEK_SLOT_MIN / 60) * WEEK_HOUR_PX}px"
                ${selectable ? `onclick="openRecordModalWithDate('${dateStr}','${hora}')" title="Agendar às ${hora}"` : ''}>
                ${selectable ? '<span class="week-slot-plus"><i class="fas fa-plus"></i></span>' : ''}
            </div>`;
        }

        // Eventos do dia, com layout de sobreposição
        const dayApps = appointments
            .filter(a => a.data === dateStr)
            .map(a => {
                let start = timeToMin(a.horaInicio);
                let end = timeToMin(a.horaFim);
                if (start === null) start = viewStart;
                if (end === null || end <= start) end = start + 60;
                return { app: a, start, end };
            })
            .sort((a, b) => a.start - b.start || a.end - b.end);

        layoutOverlaps(dayApps);

        const events = dayApps.map(ev => {
            const a = ev.app;
            const theme = getAppointmentTheme(a, isPastDate);
            const top = ((Math.max(ev.start, viewStart) - viewStart) / 60) * WEEK_HOUR_PX;
            const height = Math.max(24, ((Math.min(ev.end, viewEnd) - Math.max(ev.start, viewStart)) / 60) * WEEK_HOUR_PX - 3);
            const width = 100 / ev.cols;
            const leftPct = ev.col * width;
            const compact = height < 52;
            const tooltip = `${a.horaInicio} – ${a.horaFim} | ${a.paciente} (${a.idade} anos)\n${a.exame} · ${a.substrato}${a.metano === 'Sim' ? ' (metano)' : ''}\nStatus: ${a.status}\nAtendente: ${formatAtendenteName(a.atendente)}`;

            return `<div class="week-event ${theme.bg} ${theme.border} ${theme.canceled ? 'week-event-canceled' : ''}"
                style="top:${top}px;height:${height}px;left:calc(${leftPct}% + 2px);width:calc(${width}% - 5px)"
                onclick="event.stopPropagation(); editRecord(${a.id})"
                title="${tooltip.replace(/"/g, '&quot;')}">
                <span class="week-event-accent ${theme.accent}"></span>
                <div class="week-event-body">
                    <div class="week-event-time ${theme.text}">${a.horaInicio}${compact ? '' : ` – ${a.horaFim}`}</div>
                    <div class="week-event-name">${a.paciente}</div>
                    ${compact ? '' : `<div class="week-event-meta ${theme.text}">${a.exame} · ${a.substrato}${a.idade < 12 ? ' · Infantil' : ''}</div>`}
                </div>
                ${theme.overdue ? '<span class="week-event-badge"><i class="fas fa-exclamation-triangle"></i></span>' : ''}
            </div>`;
        }).join('');

        // Linha do horário atual
        let nowLine = '';
        if (isToday) {
            const now = new Date();
            const nowMin = now.getHours() * 60 + now.getMinutes();
            if (nowMin >= viewStart && nowMin <= viewEnd) {
                nowLine = `<div class="week-now" style="top:${((nowMin - viewStart) / 60) * WEEK_HOUR_PX}px"></div>`;
            }
        }

        colsHtml += `<div class="week-col ${isToday ? 'week-col-today' : ''} ${isHoliday || !startWindow ? 'week-col-off' : ''}" style="height:${colHeight}px">
            ${slots}${events}${nowLine}
        </div>`;
    }

    canvas.innerHTML = gutter + colsHtml;
}

// Distribui colunas para agendamentos que se sobrepõem no mesmo dia
function layoutOverlaps(events) {
    let cluster = [];
    let clusterEnd = -1;

    const flush = () => {
        if (!cluster.length) return;
        const cols = [];
        cluster.forEach(ev => {
            let placed = false;
            for (let c = 0; c < cols.length; c++) {
                if (cols[c] <= ev.start) { ev.col = c; cols[c] = ev.end; placed = true; break; }
            }
            if (!placed) { ev.col = cols.length; cols.push(ev.end); }
        });
        cluster.forEach(ev => ev.cols = cols.length);
        cluster = [];
    };

    events.forEach(ev => {
        if (cluster.length && ev.start >= clusterEnd) { flush(); clusterEnd = -1; }
        cluster.push(ev);
        clusterEnd = Math.max(clusterEnd, ev.end);
    });
    flush();
}
