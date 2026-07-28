// Indicadores e gráficos (dirigidos pela config da agenda)

// INDICADORES & FILTROS
function toggleIndFilters() {
    const type = document.getElementById('ind-filter-type').value;
    document.getElementById('ind-box-year').classList.toggle('hidden', type !== 'year');
    document.getElementById('ind-box-month').classList.toggle('hidden', type !== 'month');
    document.getElementById('ind-box-start').classList.toggle('hidden', type !== 'range');
    document.getElementById('ind-box-end').classList.toggle('hidden', type !== 'range');
}

function filterIndData() {
    const type = document.getElementById('ind-filter-type').value;
    return appointments.filter(app => {
        if (type === 'all') return true;
        if (type === 'year') return app.data.startsWith(document.getElementById('ind-year').value);
        if (type === 'month') return app.data.startsWith(document.getElementById('ind-month').value);
        if (type === 'range') {
            const s = document.getElementById('ind-start').value;
            const e = document.getElementById('ind-end').value;
            return (s ? app.data >= s : true) && (e ? app.data <= e : true);
        }
        return true;
    });
}

// Destrói um gráfico existente antes de recriá-lo
function _resetChart(chave) {
    if (charts[chave]) { charts[chave].destroy(); charts[chave] = null; }
}

const MESES_CURTOS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function renderIndicadores() {
    const agenda = currentAgenda();
    const cores = agendaCores(agenda);
    const indData = filterIndData();

    const tresp = indData.filter(a => a.exame === 'TRESP');
    const tsbac = indData.filter(a => a.exame === 'TSBAC');
    const concluidos = indData.filter(a => a.status === 'Concluído');
    const andamento = indData.filter(a => a.status === 'Em andamento');
    const pendentes = indData.filter(a => a.status === 'Agendado');
    const cancelados = indData.filter(a => a.status === 'Cancelado');

    const setKpi = (id, valor) => { const el = document.getElementById(id); if (el) el.innerText = valor; };
    setKpi('kpi-total', indData.length);
    setKpi('kpi-tresp', tresp.length);
    setKpi('kpi-tsbac', tsbac.length);
    setKpi('kpi-concluidos', concluidos.length);
    setKpi('kpi-andamento', andamento.length);
    setKpi('kpi-pendentes', pendentes.length);
    setKpi('kpi-cancelados', cancelados.length);

    const usa = nome => agenda.charts.includes(nome);

    // Volume mensal
    if (usa('barMensal')) {
        const monthlyData = new Array(12).fill(0);
        indData.forEach(a => monthlyData[new Date(a.data + 'T12:00:00').getMonth()]++);
        _resetChart('bar');
        charts.bar = new Chart(document.getElementById('chart-bar-monthly'), {
            type: 'bar',
            data: { labels: MESES_CURTOS, datasets: [{ label: 'Volume Total', data: monthlyData, backgroundColor: cores.chart }] }
        });
    } else {
        _resetChart('bar');
    }

    // Tendência por tipo de exame
    if (usa('linhaTipo')) {
        const trespData = new Array(12).fill(0);
        const tsbacData = new Array(12).fill(0);
        indData.forEach(a => {
            const month = new Date(a.data + 'T12:00:00').getMonth();
            if (a.exame === 'TRESP') trespData[month]++;
            if (a.exame === 'TSBAC') tsbacData[month]++;
        });
        _resetChart('line');
        charts.line = new Chart(document.getElementById('chart-line-trend'), {
            type: 'line',
            data: {
                labels: MESES_CURTOS,
                datasets: [
                    { label: 'TRESP', data: trespData, borderColor: '#3b82f6', backgroundColor: '#3b82f6', tension: 0.3 },
                    { label: 'TSBAC', data: tsbacData, borderColor: '#10b981', backgroundColor: '#10b981', tension: 0.3 }
                ]
            }
        });
    } else {
        _resetChart('line');
    }

    // Donut por tipo de exame
    if (usa('donutExame')) {
        _resetChart('donutE');
        charts.donutE = new Chart(document.getElementById('chart-donut-exame'), {
            type: 'doughnut',
            data: { labels: ['TRESP', 'TSBAC'], datasets: [{ data: [tresp.length, tsbac.length], backgroundColor: ['#3b82f6', '#10b981'] }] }
        });
    } else {
        _resetChart('donutE');
    }

    // Donut de substratos
    if (usa('donutSubstrato')) {
        const subMap = {};
        indData.forEach(a => { if (a.substrato) subMap[a.substrato] = (subMap[a.substrato] || 0) + 1; });
        _resetChart('donutS');
        charts.donutS = new Chart(document.getElementById('chart-donut-substrato'), {
            type: 'doughnut',
            data: { labels: Object.keys(subMap), datasets: [{ data: Object.values(subMap), backgroundColor: ['#6366f1', '#f43f5e', '#f59e0b', '#10b981', '#06b6d4', '#8b5cf6'] }] }
        });
    } else {
        _resetChart('donutS');
    }

    // Donut de status (agendas sem tipos de exame)
    if (usa('donutStatus')) {
        _resetChart('donutStatus');
        charts.donutStatus = new Chart(document.getElementById('chart-donut-status'), {
            type: 'doughnut',
            data: {
                labels: ['Agendado', 'Em andamento', 'Concluído', 'Cancelado'],
                datasets: [{
                    data: [pendentes.length, andamento.length, concluidos.length, cancelados.length],
                    backgroundColor: ['#f59e0b', '#8b5cf6', '#22c55e', '#ef4444']
                }]
            }
        });
    } else {
        _resetChart('donutStatus');
    }
}
